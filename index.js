import express from "express";
import mongoose from "mongoose";
import Codes from "./schemas/Codes.js";
import Material from "./schemas/Material.js";
import cors from "cors";
import { config } from "dotenv";
import fs from "fs";

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

  for await (let vo of VOArr) {
    const startWithX = vo.startsWith("x ") || vo.startsWith("X ");

    if (!vo.trim()) {
      response += "\n";
      continue;
    }

    if (!startWithX) {
      response += `${vo}\n`;
    }

    if (startWithX) {
      const x = vo.slice(0, 2);
      const voTrimmed = vo.replace(x, "").trim();
      const codesFound = await Codes.find(
        { $text: { $search: voTrimmed } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(1);

      if (codesFound?.length && codesFound[0].code) {
        const theCode = codesFound[0].code;
        response += `${theCode} ${vo.trim()}\n`;
      } else {
        response += `       ${vo.trim()}\n`;
      }
    }
  }

  res.send(JSON.stringify({ vo: response }));

  // const result = await VOArr.forEach(async (vo, index) => {
  //   const isLatest = index === VOArr.length - 1;
  //   let voTrimmed = vo.trim().toString();
  //   if (voTrimmed.startsWith("x ")) {
  //     voTrimmed = voTrimmed.replace("x ", "");
  //   }
  //   if (voTrimmed.startsWith("X ")) {
  //     voTrimmed = voTrimmed.replace("X ", "");
  //   }
  //   voTrimmed = voTrimmed.trim();

  //   console.log(voTrimmed);
  //   if (voTrimmed) {
  //     const codesFound = await Codes.find(
  //       { $text: { $search: voTrimmed } },
  //       { score: { $meta: "textScore" } }
  //     )
  //       .sort({ score: { $meta: "textScore" } })
  //       .limit(1);

  //     if (codesFound?.length && codesFound[0].code) {
  //       response += `${codesFound[0].code} ${vo.trim()}\n`;
  //     } else {
  //       response += `       ${vo.trim()}\n`;
  //     }
  //   }

  //   if (isLatest) {
  //     res.send(JSON.stringify({ vo: response }));
  //     return true;
  //   }
  // });
});

const run = async () => {
  try {
    const data = fs.readFileSync("voDbUpdated.text", "utf-8");
    const lines = data.split("\n");

    await Codes.updateMany({}, { info: "" });
    for (const line of lines) {
      const [code, description] = line.split(" x ");

      if (code && description) {
        const existingCode = await Codes.findOne({ code });

        if (existingCode) {
          existingCode.info = description;
          await existingCode.save();
        }
      }
    }

    console.log("Data inserted successfully");
  } catch (error) {
    console.error("Error inserting data:", error);
  }
};

// run();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
