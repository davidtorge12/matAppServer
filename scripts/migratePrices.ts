/**
 * One-off migration: converts `materials.price` from the string it used to be
 * stored as into a number.
 *
 * Safe to run more than once — rows already holding a number are skipped, so a
 * second run reports nothing to do.
 *
 * Reads and writes through the raw driver collection rather than the Mongoose
 * model on purpose: the schema now declares `price` as a Number, and hydrating a
 * document that still holds `"n/a"` through that schema would throw before the
 * migration had a chance to fix it.
 *
 *   npm run migrate:prices          # dry run — reports what would change
 *   npm run migrate:prices -- --apply
 *
 * Point MONGO_DB_URL at a copy or a staging database first if you have one.
 */
import { config } from "dotenv";
import mongoose from "mongoose";
import { parsePrice } from "../lib/price.js";
import Material from "../schemas/Material.js";

config();

const APPLY = process.argv.includes("--apply");
/** How many examples to print, so a dry run stays readable on a long collection. */
const SAMPLE_SIZE = 20;

function describe(value: unknown): string {
  return `${JSON.stringify(value)} (${typeof value})`;
}

type StalePriceRow = {
  _id: mongoose.Types.ObjectId;
  material: string;
  price: unknown;
};

async function migratePrices(): Promise<void> {
  const mongoUrl = process.env.MONGO_DB_URL;
  if (!mongoUrl) {
    throw new Error("MONGO_DB_URL is not set");
  }

  await mongoose.connect(mongoUrl);

  try {
    const collection = Material.collection;
    const total = await collection.countDocuments({});

    // Anything not already a BSON number: strings, nulls, and missing fields.
    const stale = (await collection
      .find({ price: { $not: { $type: "number" } } })
      .project({ material: 1, price: 1 })
      .toArray()) as StalePriceRow[];

    console.log(`${total} material rows, ${stale.length} needing conversion.`);

    if (!stale.length) {
      console.log("Nothing to do — prices are already numbers.");
      return;
    }

    const changes = stale.map((row) => ({
      _id: row._id,
      material: row.material,
      from: row.price,
      to: parsePrice(row.price),
    }));

    // Worth eyeballing before applying: a row that lands on 0 was unparseable, and
    // means someone's typed price is about to be discarded.
    const zeroed = changes.filter(
      (change) =>
        change.to === 0 && parsePrice(change.from) !== Number(change.from),
    );

    console.log(`\nFirst ${Math.min(SAMPLE_SIZE, changes.length)} conversions:`);
    for (const change of changes.slice(0, SAMPLE_SIZE)) {
      console.log(`  ${change.material}: ${describe(change.from)} -> ${change.to}`);
    }

    if (zeroed.length) {
      console.log(
        `\n${zeroed.length} row(s) hold a value that cannot be read as a price ` +
          `and will become 0:`,
      );
      for (const change of zeroed.slice(0, SAMPLE_SIZE)) {
        console.log(`  ${change.material}: ${describe(change.from)}`);
      }
    }

    if (!APPLY) {
      console.log("\nDry run — nothing written. Re-run with --apply to convert.");
      return;
    }

    const result = await collection.bulkWrite(
      changes.map((change) => ({
        updateOne: {
          filter: { _id: change._id },
          update: { $set: { price: change.to } },
        },
      })),
    );

    console.log(`\nConverted ${result.modifiedCount} row(s).`);

    const remaining = await collection.countDocuments({
      price: { $not: { $type: "number" } },
    });
    console.log(
      remaining
        ? `Warning: ${remaining} row(s) still not numeric.`
        : "All prices are now numbers.",
    );
  } finally {
    await mongoose.disconnect();
  }
}

migratePrices().catch((error: unknown) => {
  console.error("Price migration failed:", error);
  process.exit(1);
});
