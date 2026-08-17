import express from "express";
import Codes from "../schemas/Codes.js";

const router = express.Router();

router.post("/vo", async (req, res) => {
  try {
    const voString = req.body?.vo;
    if (typeof voString !== "string") {
      return res.status(400).json({ error: "invalid request" });
    }

    let response = "";
    const VOArr = voString.split("\n");

    for (const vo of VOArr) {
      const startWithX = vo.startsWith("x ") || vo.startsWith("X ");

      if (!vo.trim()) {
        response += "\n";
        continue;
      }

      if (!startWithX) {
        response += `${vo}\n`;
        continue;
      }

      const x = vo.slice(0, 2);
      const voTrimmed = vo.replace(x, "").split("-")[0].trim();

      const codesFound = await Codes.find(
        { $text: { $search: voTrimmed } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" } })
        .limit(1);

      if (codesFound?.length && codesFound[0].code) {
        response += `${codesFound[0].code} ${vo.trim()}\n`;
      } else {
        response += `       ${vo.trim()}\n`;
      }
    }

    res.json({ vo: response });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "failed to match VO codes" });
  }
});

export default router;
