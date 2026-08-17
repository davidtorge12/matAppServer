import express from "express";
import { MAX_VO_LINES } from "../lib/constants.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { badRequest, route } from "../lib/route.js";
import {
  formatVoLine,
  isMatchLine,
  joinVoLines,
  searchTermFor,
  splitVoLines,
} from "../lib/voLines.js";
import Codes from "../schemas/Codes.js";

const router = express.Router();

/** How many text searches to have in flight at once. */
const SEARCH_CONCURRENCY = 5;

async function bestMatchingCode(term) {
  if (!term) {
    return null;
  }

  const [best] = await Codes.find(
    { $text: { $search: term } },
    { code: 1, score: { $meta: "textScore" } },
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(1)
    .lean();

  return best?.code ?? null;
}

router.post(
  "/vo",
  route(async (req, res) => {
    const voString = req.body?.vo;
    if (typeof voString !== "string") {
      throw badRequest("vo must be a string");
    }

    const lines = splitVoLines(voString);
    if (lines.length > MAX_VO_LINES) {
      throw badRequest(`at most ${MAX_VO_LINES} lines per request`);
    }

    // Only the marked lines cost a query, and they run a few at a time rather
    // than strictly one after another — a 60-line VO used to be 60 sequential
    // round trips to Atlas.
    const codes = await mapWithConcurrency(lines, SEARCH_CONCURRENCY, (line) =>
      isMatchLine(line) ? bestMatchingCode(searchTermFor(line)) : null,
    );

    res.json({
      vo: joinVoLines(lines.map((line, i) => formatVoLine(line, codes[i]))),
    });
  }),
);

export default router;
