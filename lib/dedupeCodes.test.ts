import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  codeIndexAction,
  planDedupe,
  type CodeCopy,
} from "./dedupeCodes.js";

function copy(
  id: string,
  code: string,
  fields: Partial<Omit<CodeCopy, "_id" | "code">> = {},
): CodeCopy {
  return { _id: id, code, ...fields };
}

describe("planDedupe", () => {
  it("returns nothing when every code appears once", () => {
    assert.deepEqual(
      planDedupe([
        copy("1", "P100", { materials: "2x screws" }),
        copy("2", "P200", { materials: "1x clip" }),
      ]),
      [],
    );
  });

  it("keeps the most recently updated copy and drops the rest", () => {
    const [plan] = planDedupe([
      copy("old", "P100", {
        materials: "1x nail",
        updatedAt: new Date("2024-01-01"),
      }),
      copy("new", "P100", {
        materials: "3x screws",
        updatedAt: new Date("2025-06-01"),
      }),
    ]);

    assert.ok(plan);
    assert.equal(plan.code, "P100");
    assert.equal(plan.keepId, "new");
    assert.deepEqual(plan.dropIds, ["old"]);
  });

  it("groups by trimmed code so padded duplicates collapse", () => {
    const [plan] = planDedupe([
      copy("a", "P100", { updatedAt: new Date("2025-01-01") }),
      copy("b", " P100 ", { updatedAt: new Date("2024-01-01") }),
    ]);

    assert.ok(plan);
    assert.equal(plan.code, "P100");
    assert.equal(plan.keepId, "a");
    assert.deepEqual(plan.dropIds, ["b"]);
  });

  it("does not overwrite a keeper field that already has a value", () => {
    const [plan] = planDedupe([
      copy("new", "P100", {
        materials: "3x screws",
        description: "Renew panel",
        updatedAt: new Date("2025-06-01"),
      }),
      copy("old", "P100", {
        materials: "1x nail",
        info: "catalogue line",
        updatedAt: new Date("2024-01-01"),
      }),
    ]);

    assert.ok(plan);
    assert.equal(plan.set.materials, undefined);
    assert.equal(plan.set.description, undefined);
    assert.equal(plan.set.info, "catalogue line");
  });

  it("salvages empty keeper fields from the newest other copy that has them", () => {
    const [plan] = planDedupe([
      copy("new", "P100", {
        materials: "",
        info: "   ",
        updatedAt: new Date("2025-06-01"),
      }),
      copy("mid", "P100", {
        materials: "2x screws",
        info: "newer catalogue",
        updatedAt: new Date("2025-01-01"),
      }),
      copy("old", "P100", {
        materials: "9x obsolete",
        info: "older catalogue",
        unit: "nr",
        updatedAt: new Date("2020-01-01"),
      }),
    ]);

    assert.ok(plan);
    assert.equal(plan.keepId, "new");
    assert.deepEqual(plan.set, {
      materials: "2x screws",
      info: "newer catalogue",
      unit: "nr",
    });
  });

  it("breaks ties with createdAt then _id so the plan is stable", () => {
    const same = new Date("2025-01-01");
    const [plan] = planDedupe([
      copy("b", "P100", { updatedAt: same, createdAt: new Date("2024-06-01") }),
      copy("a", "P100", { updatedAt: same, createdAt: new Date("2024-06-01") }),
      copy("c", "P100", { updatedAt: same, createdAt: new Date("2023-01-01") }),
    ]);

    assert.ok(plan);
    assert.equal(plan.keepId, "a");
    assert.deepEqual(plan.dropIds, ["b", "c"]);
  });

  it("plans every duplicated code, not only the first", () => {
    const plans = planDedupe([
      copy("1", "A", { updatedAt: new Date("2025-01-01") }),
      copy("2", "A", { updatedAt: new Date("2024-01-01") }),
      copy("3", "B", { updatedAt: new Date("2025-01-01") }),
      copy("4", "B", { updatedAt: new Date("2024-01-01") }),
      copy("5", "C"),
    ]);

    assert.deepEqual(
      plans.map((plan) => plan.code).sort(),
      ["A", "B"],
    );
  });
});

describe("codeIndexAction", () => {
  it("leaves a unique code index alone", () => {
    assert.deepEqual(
      codeIndexAction([{ name: "code_1", key: { code: 1 }, unique: true }]),
      { action: "ok" },
    );
  });

  it("replaces the existing non-unique code index", () => {
    assert.deepEqual(
      codeIndexAction([{ name: "code_1", key: { code: 1 } }]),
      { action: "replace", name: "code_1" },
    );
  });

  it("creates the index when none exists yet", () => {
    assert.deepEqual(
      codeIndexAction([{ name: "info_text", key: { info: "text" } }]),
      { action: "create" },
    );
  });

  it("ignores compound indexes that happen to include code", () => {
    assert.deepEqual(
      codeIndexAction([{ name: "code_updated", key: { code: 1, updatedAt: -1 } }]),
      { action: "create" },
    );
  });
});
