import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { pickBestCode } from "./voMatch.js";

function candidate(overrides) {
  return {
    code: "000000",
    info: "",
    description: "",
    materials: "",
    updatedAt: new Date("2026-01-01"),
    score: 1,
    ...overrides,
  };
}

describe("pickBestCode", () => {
  it("returns null when there is no term or no candidates", () => {
    assert.equal(pickBestCode("", [candidate({ code: "A" })]), null);
    assert.equal(pickBestCode("renew bath panel", []), null);
  });

  it("prefers a code with materials over a closer wording that has none", () => {
    const picked = pickBestCode("Bonding coat in patch", [
      candidate({
        code: "413109",
        info: "IT Ceiling 2 coat Bonding in Patch",
        materials: "",
        score: 10,
      }),
      candidate({
        code: "411133",
        info: "IT Wall Bonding coat in Patch",
        materials: "bonding plaster",
        score: 4,
      }),
    ]);

    assert.equal(picked, "411133");
  });

  it("matches the job-sheet description when the catalogue wording differs", () => {
    const picked = pickBestCode("renew bath panel", [
      candidate({
        code: "388007",
        info: "IT Bath front panel including clips",
        description: "renew Bath panel",
      }),
      candidate({
        code: "630921",
        info: "Bath renew Waste",
        description: "renew bath waste",
      }),
    ]);

    assert.equal(picked, "388007");
  });

  it("ignores case and extra spaces when comparing wording", () => {
    const picked = pickBestCode("  Renew   Bath  Panel ", [
      candidate({
        code: "388007",
        info: "renew bath panel",
        materials: "panel",
      }),
      candidate({
        code: "999999",
        info: "unrelated",
        materials: "also has materials",
      }),
    ]);

    assert.equal(picked, "388007");
  });

  it("prefers an exact catalogue match over a weaker overlap when materials are equal", () => {
    const picked = pickBestCode("renew bath panel", [
      candidate({
        code: "388007",
        info: "renew Bath panel",
        materials: "panel",
      }),
      candidate({
        code: "630927",
        info: "Bath Touch up Chip",
        description: "bath panel chip",
        materials: "filler",
      }),
    ]);

    assert.equal(picked, "388007");
  });

  it("prefers the more recently used code when wording and materials tie", () => {
    const picked = pickBestCode("renew deadlock", [
      candidate({
        code: "OLD",
        info: "renew deadlock",
        materials: "lock",
        updatedAt: new Date("2026-01-01"),
      }),
      candidate({
        code: "NEW",
        info: "renew deadlock",
        materials: "lock",
        updatedAt: new Date("2026-08-01"),
      }),
    ]);

    assert.equal(picked, "NEW");
  });

  it("uses the text score only as a last tie-break", () => {
    const picked = pickBestCode("gain access", [
      candidate({
        code: "LOW",
        info: "gain access",
        score: 1,
      }),
      candidate({
        code: "HIGH",
        info: "gain access",
        score: 9,
      }),
    ]);

    assert.equal(picked, "HIGH");
  });
});
