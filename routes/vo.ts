import express from "express";
import { MAX_VO_LINES } from "../lib/constants.js";
import { mapWithConcurrency } from "../lib/concurrency.js";
import { badRequest, route } from "../lib/route.js";
import { pickBestCode, type VoCandidate } from "../lib/voMatch.js";
import {
  formatVoLine,
  isMatchLine,
  joinVoLines,
  searchTermFor,
  serializeVo,
  splitVoLines,
} from "../lib/voLines.js";
import Codes from "../schemas/Codes.js";

const router = express.Router();

type VoBody = { vo?: unknown };

/** How many text searches to have in flight at once. */
const SEARCH_CONCURRENCY = 5;

/** How many catalogue hits to re-rank in the app. */
const CANDIDATE_LIMIT = 20;

async function bestMatchingCode(term: string): Promise<string | null> {
  if (!term) {
    return null;
  }

  const candidates = await Codes.find(
    { $text: { $search: term } },
    {
      code: 1,
      info: 1,
      description: 1,
      materials: 1,
      updatedAt: 1,
      score: { $meta: "textScore" },
    },
  )
    .sort({ score: { $meta: "textScore" } })
    .limit(CANDIDATE_LIMIT)
    .lean();

  return pickBestCode(term, candidates as VoCandidate[]);
}

router.post(
  "/vo",
  route(async (req, res) => {
    const voString = (req.body as VoBody | undefined)?.vo;
    if (typeof voString !== "string") {
      throw badRequest("vo must be a string");
    }

    const lines = splitVoLines(serializeVo(voString));
    if (lines.length > MAX_VO_LINES) {
      throw badRequest(`at most ${MAX_VO_LINES} lines per request`);
    }

    // Only the marked lines cost a query, and they run a few at a time rather
    // than strictly one after another — a 60-line VO used to be 60 sequential
    // round trips to Atlas.
    const codes = await mapWithConcurrency(lines, SEARCH_CONCURRENCY, (line) =>
      isMatchLine(line)
        ? bestMatchingCode(searchTermFor(line))
        : Promise.resolve(null),
    );

    res.json({
      vo: joinVoLines(lines.map((line, i) => formatVoLine(line, codes[i]))),
    });
  }),
);

export default router;
