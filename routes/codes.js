import express from "express";
import Codes from "../schemas/Codes.js";

const router = express.Router();

router.post("/codes", async (req, res) => {
  try {
    const incoming = Array.isArray(req.body) ? req.body : [];
    if (!incoming.length) {
      return res.status(400).json({ error: "expected an array of codes" });
    }

    for (const c of incoming) {
      if (!c?.code) {
        continue;
      }

      const existing = await Codes.findOne({ code: c.code });
      if (existing) {
        const materials =
          c.materials !== "" && c.materials != null
            ? c.materials
            : existing.materials;
        const description =
          c.description && c.description !== existing.description
            ? c.description
            : existing.description;

        await Codes.updateOne(
          { _id: existing._id },
          { description, materials, updatedAt: new Date() }
        );
      } else {
        await Codes.create({
          code: c.code,
          description: c.description,
          materials: "",
        });
      }
    }

    const codes = [];
    for (const c of incoming) {
      const codeToAdd = await Codes.findOne({ code: c.code });
      if (codeToAdd) {
        codes.push(codeToAdd);
      }
    }

    res.json(codes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to upsert codes" });
  }
});

router.get("/latest", async (_req, res) => {
  try {
    const codes = await Codes.find({}).sort({ updatedAt: -1 }).limit(20);
    res.json(codes);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to load codes" });
  }
});

router.post("/code", async (req, res) => {
  try {
    const { id, materials } = req.body?.param ?? {};
    if (!id) {
      return res.status(400).json({ error: "id required" });
    }

    const updated = await Codes.findByIdAndUpdate(
      id,
      { materials, updatedAt: new Date() },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ error: "code not found" });
    }

    res.json([updated]);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to update code" });
  }
});

export default router;
