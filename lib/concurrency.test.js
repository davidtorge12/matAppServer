import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapWithConcurrency } from "./concurrency.js";

describe("mapWithConcurrency", () => {
  it("keeps results in input order", async () => {
    const out = await mapWithConcurrency([3, 1, 2], 2, async (n) => n * 2);
    assert.deepEqual(out, [6, 2, 4]);
  });

  it("never exceeds the limit", async () => {
    let running = 0;
    let peak = 0;

    await mapWithConcurrency(
      Array.from({ length: 20 }, (_, i) => i),
      4,
      async () => {
        running += 1;
        peak = Math.max(peak, running);
        await new Promise((resolve) => setTimeout(resolve, 1));
        running -= 1;
      },
    );

    assert.equal(peak, 4);
  });

  it("handles an empty list", async () => {
    assert.deepEqual(await mapWithConcurrency([], 4, async () => 1), []);
  });

  it("passes the index to the mapper", async () => {
    const out = await mapWithConcurrency(["a", "b"], 1, async (v, i) => `${i}${v}`);
    assert.deepEqual(out, ["0a", "1b"]);
  });
});
