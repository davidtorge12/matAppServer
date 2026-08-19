import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { listMaterialNames } from "./materialNames.js";

describe("listMaterialNames", () => {
  it("returns trimmed unique names in case-insensitive order", () => {
    assert.deepEqual(
      listMaterialNames([
        { material: " screws " },
        { material: "White silicone" },
        { material: "screws" },
        { material: "  " },
        { material: 12 },
      ]),
      ["screws", "White silicone"],
    );
  });

  it("returns nothing for an empty catalogue", () => {
    assert.deepEqual(listMaterialNames([]), []);
  });
});
