/**
 * Collapses duplicate `Codes` documents that share the same `code`, then
 * promotes the `{ code: 1 }` index to unique.
 *
 * Safe to run more than once — unique codes are left alone, so a second run
 * reports nothing to do.
 *
 *   npm run dedupe:codes              # dry run — reports what would change
 *   npm run dedupe:codes -- --apply
 *
 * Point MONGO_DB_URL at a copy or a staging database first if you have one.
 */
import { config } from "dotenv";
import mongoose from "mongoose";
import { planDedupe, type CodeCopy } from "../lib/dedupeCodes.js";
import Codes, { ensureCodeIndex } from "../schemas/Codes.js";

config();

const APPLY = process.argv.includes("--apply");
const SAMPLE_SIZE = 20;

type StoredCode = {
  _id: mongoose.Types.ObjectId;
  code?: unknown;
  description?: unknown;
  info?: unknown;
  unit?: unknown;
  price?: unknown;
  materials?: unknown;
  createdAt?: Date;
  updatedAt?: Date;
};

function textField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asCopy(row: StoredCode): CodeCopy {
  return {
    _id: String(row._id),
    code: typeof row.code === "string" ? row.code : "",
    description: textField(row.description),
    info: textField(row.info),
    unit: textField(row.unit),
    price: textField(row.price),
    materials: textField(row.materials),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function objectId(id: string): mongoose.Types.ObjectId {
  return new mongoose.Types.ObjectId(id);
}

async function dedupeCodes(): Promise<void> {
  const mongoUrl = process.env.MONGO_DB_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_DB_URL is not set");
  }

  await mongoose.connect(mongoUrl);

  try {
    const collection = Codes.collection;
    const rows = (await collection
      .find({})
      .project({
        code: 1,
        description: 1,
        info: 1,
        unit: 1,
        price: 1,
        materials: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .toArray()) as StoredCode[];

    const docs = rows.map(asCopy);
    const blank = docs.filter((doc) => !doc.code.trim());
    const plans = planDedupe(docs);
    const dropCount = plans.reduce((sum, plan) => sum + plan.dropIds.length, 0);

    console.log(
      `${docs.length} code rows, ${plans.length} duplicated code(s), ` +
        `${dropCount} extra document(s) to drop` +
        (blank.length ? `, ${blank.length} with a blank code` : "") +
        ".",
    );

    if (!plans.length && !blank.length) {
      console.log("Nothing to merge. Ensuring the unique index exists.");
      if (APPLY) {
        const unique = await ensureCodeIndex();
        console.log(
          unique
            ? "Unique index on Codes.code is in place."
            : "Unique index was not created — leftover duplicates remain.",
        );
      } else {
        console.log("Dry run — nothing written. Re-run with --apply to index.");
      }
      return;
    }

    console.log(`\nFirst ${Math.min(SAMPLE_SIZE, plans.length)} merge(s):`);
    for (const plan of plans.slice(0, SAMPLE_SIZE)) {
      const salvaged = Object.keys(plan.set);
      console.log(
        `  ${plan.code}: keep ${plan.keepId}, drop ${plan.dropIds.join(", ")}` +
          (salvaged.length ? `, copy ${salvaged.join(", ")} onto keeper` : ""),
      );
    }

    if (blank.length) {
      console.log(
        `\n${blank.length} row(s) have a blank code and will block a unique ` +
          `index until they are deleted by hand:`,
      );
      for (const doc of blank.slice(0, SAMPLE_SIZE)) {
        console.log(`  ${doc._id}`);
      }
    }

    if (!APPLY) {
      console.log("\nDry run — nothing written. Re-run with --apply to merge.");
      return;
    }

    let updated = 0;
    let deleted = 0;

    for (const plan of plans) {
      const set = { code: plan.code, ...plan.set };
      const update = await collection.updateOne(
        { _id: objectId(plan.keepId) },
        { $set: set },
      );
      updated += update.modifiedCount;

      const removed = await collection.deleteMany({
        _id: { $in: plan.dropIds.map(objectId) },
      });
      deleted += removed.deletedCount;
    }

    console.log(`\nUpdated ${updated} keeper(s), deleted ${deleted} duplicate(s).`);

    if (blank.length) {
      console.log(
        "Skipped the unique index because blank-code rows remain. Delete those, then re-run.",
      );
      return;
    }

    const unique = await ensureCodeIndex();
    console.log(
      unique
        ? "Unique index on Codes.code is in place."
        : "Unique index was not created — leftover duplicates remain.",
    );
  } finally {
    await mongoose.disconnect();
  }
}

dedupeCodes().catch((error: unknown) => {
  console.error("Code de-duplication failed:", error);
  process.exit(1);
});
