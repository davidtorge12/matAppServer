import express from "express";
import mongoose from "mongoose";
import Codes from "./schemas/Codes.js";
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
  if (req.body.length) {
    req.body.forEach(async (c) => {
      let codeInDb = await Codes.findOne({ code: c.code });

      if (codeInDb && codeInDb.description !== c.description) {
        await Codes.updateOne({ description: c.description }).updateOne({
          materials: c.materials !== "" ? c.materials : codeInDb.materials,
        });
      } else {
        await Codes.create({ code: c.code, description: c.description, materials: "" });
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
      await code.updateOne({ materials: materials }).updateOne({ updatedAt: Date.now() });
    }

    const updated = await Codes.find({ _id: id });
    res.send(updated);
  }
});

const run = async () => {
  await Codes.updateOne({ _id: "63e63a68388ef1d5649c03cc" }, { updatedAt: Date.now() });
  const doc = await Codes.find({ _id: "63e63a68388ef1d5649c03cc" });
};

// run();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
