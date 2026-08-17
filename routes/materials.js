import express from "express";
import Material from "../schemas/Material.js";

const router = express.Router();

router.get("/get-price", async (req, res) => {
  try {
    const name = req.query.material;
    if (!name || typeof name !== "string") {
      return res.status(400).json({ error: "material query required" });
    }

    const material = await Material.findOne({ material: name });
    if (!material) {
      return res.status(404).json({ error: "material not found" });
    }

    res.json(material);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to load price" });
  }
});

router.post("/get-prices", async (req, res) => {
  try {
    const matArr = Object.keys(req.body?.obj || {});
    const resArr = {};

    for (const material of matArr) {
      const matDb = await Material.find({ material });
      for (const row of matDb) {
        resArr[row.material] = row.price;
      }
    }

    res.json(resArr);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to load prices" });
  }
});

router.post("/set-prices", async (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [];
    if (!incoming.length) {
      return res.status(400).json({ error: "expected an array of materials" });
    }

    const matsArray = [];
    for (const mat of incoming) {
      if (!mat?.material) {
        continue;
      }

      const updated = await Material.findOneAndUpdate(
        { material: mat.material },
        { price: mat.price || "0", updatedAt: new Date() },
        { upsert: true, new: true }
      );
      matsArray.push(updated);
    }

    res.json(matsArray);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to set prices" });
  }
});

router.post("/set-price", async (req, res) => {
  try {
    const { material, price } = req.body || {};
    if (!material) {
      return res.status(400).json({ error: "material required" });
    }

    const updated = await Material.findOneAndUpdate(
      { material },
      { price, updatedAt: new Date() },
      { upsert: true, new: true }
    );

    res.json(updated);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to set price" });
  }
});

export default router;
