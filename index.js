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

app.get("/proba", (req, res) => {
  res.send("proba");
});

app.post("/codes", async (req, res) => {
  if (req.body.length) {
    let codes = await Codes.find({ code: { $in: req.body } });
    res.send(codes);
  }
});

app.get("/latest", async (req, res) => {
  let codes = await Codes.find({}).sort({ updatedAt: -1 }).limit(20);

  console.log(codes);
  res.send(codes);
});

app.post("/code", async (req, res) => {
  if (req.body.param) {
    const { id, materials } = req.body.param;

    await Codes.findOne({ _id: id }).updateOne({ materials: materials }).updateOne({ updatedAt: Date.now() });

    const updated = await Codes.find({ _id: id });
    res.send(updated);
  }
});

const run = async () => {
  await Codes.updateOne({ _id: "63e63a68388ef1d5649c03cc" }, { updatedAt: Date.now() });
  const doc = await Codes.find({ _id: "63e63a68388ef1d5649c03cc" });
  console.log(doc);
};

// run();

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
