import mongoose, { type InferSchemaType } from "mongoose";

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

// Every route looks a code up by `code`; without this index each one is a
// collection scan. Not unique on purpose: existing data may already hold
// duplicates from before upserts were used, and a unique index fails to build
// against them. See docs/REVIEW.md for the de-duplication step.
codesSchema.index({ code: 1 });

// Backs the `$text` search used by the VO matcher. Both the catalogue wording
// (`info`) and the latest job-sheet wording (`description`) are searchable.
codesSchema.index({ info: "text", description: "text" });

const CodesModel = mongoose.model("Codes", codesSchema);

const VO_INDEX_READY = Symbol.for("matapp.voSearchIndex");

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

export default CodesModel;
