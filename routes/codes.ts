import express from "express";
import mongoose from "mongoose";
import { MAX_CODES_PER_REQUEST, PAGE_SIZE } from "../lib/constants.js";
import { badRequest, notFound, route } from "../lib/route.js";
import Codes from "../schemas/Codes.js";

const router = express.Router();

export type CodeUploadRow = {
  code?: unknown;
  description?: unknown;
  materials?: unknown;
};

export type CodeRow = {
  code: string;
  description: string;
  materials: string;
};

type UpsertSet = { description?: string; materials?: string };
type UpsertSetOnInsert = {
  code: string;
  description?: string;
  materials?: string;
};

export type CodeUpsert = {
  updateOne: {
    filter: { code: string };
    update: {
      $set?: UpsertSet;
      $setOnInsert: UpsertSetOnInsert;
    };
    upsert: true;
  };
};

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Normalises the upload payload, dropping rows with no usable code. */
export function normaliseCodes(body: unknown): CodeRow[] {
  if (!Array.isArray(body)) {
    return [];
  }

  return body
    .map((row: CodeUploadRow) => ({
      code: text(row?.code),
      description: text(row?.description),
      materials: text(row?.materials),
    }))
    .filter((row) => row.code);
}

/**
 * One upsert per distinct code. A job sheet regularly lists the same SOR code on
 * several lines, and `bulkWrite` rejects a batch that touches one document
 * twice, so duplicates collapse here.
 *
 * A field can appear in `$set` or `$setOnInsert` but not both, hence the split:
 * a value the upload actually supplies overwrites what is stored, and anything
 * it leaves blank is only seeded when the document is created. That preserves
 * the previous behaviour of never clearing a stored description or materials
 * list with an empty cell from a spreadsheet.
 */
export function buildCodeUpserts(rows: CodeRow[]): CodeUpsert[] {
  const byCode = new Map<string, CodeRow>();
  for (const row of rows) {
    byCode.set(row.code, row);
  }

  return [...byCode.values()].map((row) => {
    const set: UpsertSet = {};
    const setOnInsert: UpsertSetOnInsert = { code: row.code };

    if (row.description) {
      set.description = row.description;
    } else {
      setOnInsert.description = "";
    }

    if (row.materials) {
      set.materials = row.materials;
    } else {
      setOnInsert.materials = "";
    }

    return {
      updateOne: {
        filter: { code: row.code },
        update: {
          ...(Object.keys(set).length ? { $set: set } : {}),
          $setOnInsert: setOnInsert,
        },
        upsert: true as const,
      },
    };
  });
}

type CodeUpdateBody = { param?: { id?: unknown; materials?: unknown } };

router.post(
  "/codes",
  route(async (req, res) => {
    const rows = normaliseCodes(req.body);
    if (!rows.length) {
      throw badRequest("expected an array of codes");
    }
    if (rows.length > MAX_CODES_PER_REQUEST) {
      throw badRequest(`at most ${MAX_CODES_PER_REQUEST} codes per request`);
    }

    const operations = buildCodeUpserts(rows);
    await Codes.bulkWrite(operations);

    // Two round trips total. The previous version ran a findOne plus a write per
    // row and then a second findOne per row, so a 50-row chunk cost up to 150.
    const saved = await Codes.find({
      code: { $in: operations.map((op) => op.updateOne.filter.code) },
    });
    const byCode = new Map(saved.map((doc) => [doc.code, doc]));

    // Answered in upload order, repeats included, because the client pairs each
    // returned code with the sheet row it came from.
    res.json(rows.map((row) => byCode.get(row.code)).filter(Boolean));
  }),
);

export function parsePage(value: unknown): number {
  const page = Number.parseInt(String(value ?? "1"), 10);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

router.get(
  "/latest",
  route(async (req, res) => {
    const page = parsePage(req.query.page);
    const [items, total] = await Promise.all([
      Codes.find({})
        .sort({ updatedAt: -1 })
        .skip((page - 1) * PAGE_SIZE)
        .limit(PAGE_SIZE)
        .lean(),
      Codes.estimatedDocumentCount(),
    ]);

    res.json({ items, total, page, pageSize: PAGE_SIZE });
  }),
);

router.post(
  "/code",
  route(async (req, res) => {
    const { id, materials } = (req.body as CodeUpdateBody | undefined)?.param ?? {};
    if (!id) {
      throw badRequest("id required");
    }
    // Without this check a malformed id raises a Mongoose CastError, which the
    // error handler can only report as a 500.
    if (!mongoose.isValidObjectId(id)) {
      throw badRequest("invalid id");
    }
    if (typeof materials !== "string") {
      throw badRequest("materials must be a string");
    }

    const updated = await Codes.findByIdAndUpdate(
      id,
      { materials: materials.trim() },
      { new: true },
    );

    if (!updated) {
      throw notFound("code not found");
    }

    res.json([updated]);
  }),
);

export default router;
