import express from "express";
import mongoose from "mongoose";
import Codes from "./schemas/Codes.js";
import Material from "./schemas/Material.js";
import cors from "cors";
import { config } from "dotenv";

config();

const app = express();
app.use(cors());
const port = process.env.PROT || 3000;

mongoose.connect(process.env.MONGO_DB_URL);

app.use(express.json());

app.get("/", (req, res) => {
  res.send("home");
});

app.post("/codes", async (req, res) => {
  try {
    if (req.body.length) {
      req.body.forEach(async (c) => {
        let codeInDb = await Codes.findOne({ code: c.code });

        if (codeInDb) {
          if (codeInDb.description !== c.description) {
            await Codes.updateOne({ description: c.description }).updateOne({
              materials: c.materials !== "" ? c.materials : codeInDb.materials,
            });
          } else {
            await Codes.updateOne({
              materials: c.materials !== "" ? c.materials : codeInDb.materials,
            });
          }
        } else {
          await Codes.create({
            code: c.code,
            description: c.description,
            materials: "",
          });
        }
      });

      const codesArr = req.body.reduce((acc, val) => {
        return [...acc, val.code];
      }, []);

      let codes = [];

      for await (let cod of codesArr) {
        const codeToAdd = await Codes.findOne({ code: cod });
        if (codeToAdd) {
          codes = [...codes, codeToAdd];
        }
      }

      res.send(codes);
    }
  } catch (error) {
    res.send("error", error);
  }
});

app.get("/latest", async (req, res) => {
  let codes = await Codes.find({}).sort({ updatedAt: -1 }).limit(20);

  res.send(codes);
});

app.post("/code", async (req, res) => {
  if (req.body.param) {
    const { id, materials } = req.body.param;

    const code = Codes.findOne({ _id: id });

    if (code) {
      await code
        .updateOne({ materials: materials })
        .updateOne({ updatedAt: Date.now() });
    }

    const updated = await Codes.find({ _id: id });
    res.send(updated);
  }
});

app.get("/get-price", async (req, res) => {
  if (req.body) {
    const material = await Material.findOne({ material: req.body });

    if (material) {
      res.send(material);
    } else {
      res.send("material not found");
    }
  }
});

app.post("/get-prices", async (req, res) => {
  if (req.body.obj) {
    const matArr = Object.keys(req.body.obj);

    let resArr = {};
    for await (let material of matArr) {
      const matDb = await Material.find({ material });

      if (matDb.length) {
        matDb.forEach(({ material, price }) => {
          resArr = { ...resArr, [material]: price };
        });
      }
    }

    res.send(JSON.stringify(resArr));
  }
});

app.post("/set-prices", async (req, res) => {
  if (req.body.length) {
    const matsArray = [];
    req.body.forEach(async (mat) => {
      let matInDb = await Material.findOne({ material: mat.material });

      let matObj;
      if (matInDb) {
        matObj = await Material.updateOne({ price: mat.price });
      } else {
        matObj = await Material.create({
          material: mat.material,
          price: mat.price || "0",
        });
      }

      matsArray.push(matObj);
    });

    res.send(matsArray);
  } else {
    res.send("error getting prices");
  }
});

app.post("/set-price", async (req, res) => {
  if (req.body) {
    const { material, price } = req.body;

    const updated = await Material.findOneAndUpdate(
      { material },
      { price },
      { upsert: true, new: true }
    );

    res.send(updated);
  }
});

app.post("/vo", async (req, res) => {
  if (!req.body) return res.send("invalid request");
  const { vo: voString } = req.body;

  let response = "";
  const VOArr = voString.split("\n");

  const result = await VOArr.forEach(async (vo, index) => {
    const isLatest = index === VOArr.length - 1;
    const voTrimmed = vo.trim();
    if (voTrimmed) {
      const codesFound = await Codes.find(
        { $text: { $search: voTrimmed } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(1);

      if (codesFound?.length && codesFound[0].code) {
        response += `${codesFound[0].code} ${voTrimmed}\n`;
      } else {
        response += `     ${voTrimmed}\n`;
      }
    }

    if (isLatest) {
      res.send(JSON.stringify({ vo: response }));
      return true;
    }
  });
});

const run = async () => {
  // writeFileSync("db.json", "[", { flag: "a+" });
  // for await (let code of codes) {
  //   if (code.materials) {
  //     writeFileSync(
  //       "db.json",
  //       `
  //     {
  //       "id": "${code._id}",
  //       "code": "${code.code}",
  //       "description": "${code.description.split("\n").join(" ")}",
  //       "materials": "${code.materials.split("\n").join("; ")}",
  //     },
  //     `,
  //       { flag: "a+" }
  //     );
  //   }
  // }
  // writeFileSync("db.json", "]", { flag: "a+" });
};

// run();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
