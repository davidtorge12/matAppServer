import mongoose, { type InferSchemaType } from "mongoose";
import { codeIndexAction } from "../lib/dedupeCodes.js";

const codesSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      trim: true,
    },
    description: { type: String },
    info: { type: String },
    unit: String,
    price: String,
    materials: String,
  },
  // Replaces the `updatedAt: new Date()` written by hand in every route, which
  // was easy to forget and silently left `/latest` sorting on a stale value.
  { timestamps: true },
);

export type CodesDoc = InferSchemaType<typeof codesSchema>;

// `{ code: 1 }` is created in `ensureCodeIndex`, unique once duplicates are
// gone. Declaring unique here would make `createIndexes()` fail the whole boot
// while old duplicate rows still exist.

// Backs the `$text` search used by the VO matcher. Both the catalogue wording
// (`info`) and the latest job-sheet wording (`description`) are searchable.
codesSchema.index({ info: "text", description: "text" });

const CodesModel = mongoose.model("Codes", codesSchema);

const VO_INDEX_READY = Symbol.for("matapp.voSearchIndex");
const CODE_INDEX_READY = Symbol.for("matapp.codeIndex");

function mongoErrorFields(error: unknown): { code?: number; codeName?: string } {
  if (typeof error !== "object" || error === null) {
    return {};
  }
  return error as { code?: number; codeName?: string };
}

/**
 * Mongo only allows one text index. The previous `{ info: "text" }` index must
 * be dropped before the combined index can be created.
 */
export async function ensureVoSearchIndex(): Promise<void> {
  const globals = globalThis as Record<symbol, unknown>;
  if (globals[VO_INDEX_READY]) {
    return;
  }

  const indexes = await CodesModel.collection.indexes();
  for (const index of indexes) {
    const isText = Object.values(index.key).includes("text");
    if (!isText) {
      continue;
    }
    const coversDescription = index.weights && "description" in index.weights;
    if (!coversDescription && index.name) {
      try {
        await CodesModel.collection.dropIndex(index.name);
      } catch (error) {
        const mongoError = mongoErrorFields(error);
        if (mongoError.code !== 27 && mongoError.codeName !== "IndexNotFound") {
          throw error;
        }
      }
    }
  }

  await CodesModel.createIndexes();
  globals[VO_INDEX_READY] = true;
}

/**
 * Unique on `code` so a second insert cannot recreate the duplicates upserts
 * already prevent. If leftover dupes (or blank codes) still exist, Mongo
 * refuses the unique index — we keep the non-unique one and log, so the API
 * still boots. Run `npm run dedupe:codes -- --apply` then the next cold start
 * will promote it.
 */
export async function ensureCodeIndex(): Promise<boolean> {
  const globals = globalThis as Record<symbol, unknown>;
  if (globals[CODE_INDEX_READY] === "unique") {
    return true;
  }
  if (globals[CODE_INDEX_READY] === "plain") {
    return false;
  }

  const indexes = await CodesModel.collection.indexes();
  const action = codeIndexAction(indexes);

  if (action.action === "ok") {
    globals[CODE_INDEX_READY] = "unique";
    return true;
  }

  if (action.action === "replace") {
    try {
      await CodesModel.collection.dropIndex(action.name);
    } catch (error) {
      const mongoError = mongoErrorFields(error);
      if (mongoError.code !== 27 && mongoError.codeName !== "IndexNotFound") {
        throw error;
      }
    }
  }

  try {
    await CodesModel.collection.createIndex({ code: 1 }, { unique: true });
    globals[CODE_INDEX_READY] = "unique";
    return true;
  } catch (error) {
    const mongoError = mongoErrorFields(error);
    if (mongoError.code !== 11000 && mongoError.codeName !== "DuplicateKey") {
      throw error;
    }

    console.error(
      "Codes.code is not unique yet, so the unique index was not created. " +
        "Run `npm run dedupe:codes -- --apply` and redeploy. Lookups stay " +
        "indexed without uniqueness until then.",
    );
    await CodesModel.collection.createIndex({ code: 1 });
    globals[CODE_INDEX_READY] = "plain";
    return false;
  }
}

export default CodesModel;
