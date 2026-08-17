import mongoose from "mongoose";

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

// Every route looks a code up by `code`; without this index each one is a
// collection scan. Not unique on purpose: existing data may already hold
// duplicates from before upserts were used, and a unique index fails to build
// against them. See docs/REVIEW.md for the de-duplication step.
codesSchema.index({ code: 1 });

// Backs the `$text` search used by the VO matcher.
codesSchema.index({ info: "text" });

const CodesModel = mongoose.model("Codes", codesSchema);

export default CodesModel;
