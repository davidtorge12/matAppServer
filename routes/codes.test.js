import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCodeUpserts, normaliseCodes, parsePage } from "./codes.js";

describe("normaliseCodes", () => {
  it("trims and keeps only rows with a code", () => {
    assert.deepEqual(
      normaliseCodes([
        { code: " P100 ", description: " Renew panel ", materials: "" },
        { code: "", description: "no code" },
        { description: "missing code" },
      ]),
      [{ code: "P100", description: "Renew panel", materials: "" }],
    );
  });

  it("coerces non-string fields to empty rather than throwing", () => {
    assert.deepEqual(normaliseCodes([{ code: "P1", description: 42 }]), [
      { code: "P1", description: "", materials: "" },
    ]);
  });

  it("returns nothing for a non-array body", () => {
    assert.deepEqual(normaliseCodes({ code: "P1" }), []);
    assert.deepEqual(normaliseCodes(null), []);
  });
});

describe("buildCodeUpserts", () => {
  it("writes supplied values and seeds the rest only on insert", () => {
    const [op] = buildCodeUpserts([
      { code: "P100", description: "Renew panel", materials: "" },
    ]);

    assert.deepEqual(op, {
      updateOne: {
        filter: { code: "P100" },
        update: {
          $set: { description: "Renew panel" },
          $setOnInsert: { code: "P100", materials: "" },
        },
        upsert: true,
      },
    });
  });

  it("never puts a field in both $set and $setOnInsert, which Mongo rejects", () => {
    for (const op of buildCodeUpserts([
      { code: "A", description: "d", materials: "m" },
      { code: "B", description: "", materials: "" },
    ])) {
      const { $set = {}, $setOnInsert = {} } = op.updateOne.update;
      for (const field of Object.keys($set)) {
        assert.ok(!(field in $setOnInsert), `${field} appears in both`);
      }
    }
  });

  it("collapses a code the sheet lists more than once", () => {
    const ops = buildCodeUpserts([
      { code: "P100", description: "first", materials: "" },
      { code: "P100", description: "second", materials: "" },
    ]);

    assert.equal(ops.length, 1);
    assert.equal(ops[0].updateOne.update.$set.description, "second");
  });

  it("leaves a stored description alone when the sheet cell is blank", () => {
    const [op] = buildCodeUpserts([
      { code: "P100", description: "", materials: "" },
    ]);
    assert.equal(op.updateOne.update.$set, undefined);
    assert.deepEqual(op.updateOne.update.$setOnInsert, {
      code: "P100",
      description: "",
      materials: "",
    });
  });
});

describe("parsePage", () => {
  it("defaults to the first page", () => {
    assert.equal(parsePage(undefined), 1);
    assert.equal(parsePage(""), 1);
  });

  it("rejects zero, negatives and junk", () => {
    assert.equal(parsePage("0"), 1);
    assert.equal(parsePage("-3"), 1);
    assert.equal(parsePage("abc"), 1);
  });

  it("accepts a real page number", () => {
    assert.equal(parsePage("4"), 4);
  });
});
