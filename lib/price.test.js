import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isMigratedPrice, MAX_PRICE, parsePrice } from "./price.js";

describe("parsePrice", () => {
  it("passes a clean number through", () => {
    assert.equal(parsePrice(1.5), 1.5);
    assert.equal(parsePrice(0), 0);
  });

  it("reads the strings already stored in Atlas", () => {
    assert.equal(parsePrice("1.50"), 1.5);
    assert.equal(parsePrice("0"), 0);
    assert.equal(parsePrice("12"), 12);
  });

  it("tolerates surrounding spaces and a currency symbol", () => {
    assert.equal(parsePrice("  2.25 "), 2.25);
    assert.equal(parsePrice("£3.00"), 3);
    assert.equal(parsePrice("$3"), 3);
  });

  // The whole point of the change: none of these may become NaN.
  it("turns unusable input into zero rather than NaN", () => {
    assert.equal(parsePrice(""), 0);
    assert.equal(parsePrice("   "), 0);
    assert.equal(parsePrice("n/a"), 0);
    assert.equal(parsePrice(null), 0);
    assert.equal(parsePrice(undefined), 0);
    assert.equal(parsePrice({}), 0);
    assert.equal(parsePrice(Number.NaN), 0);
  });

  it("refuses a negative price", () => {
    assert.equal(parsePrice(-5), 0);
    assert.equal(parsePrice("-5"), 0);
  });

  it("rounds to pennies", () => {
    assert.equal(parsePrice("2.349"), 2.35);
    assert.equal(parsePrice("2.344"), 2.34);
    // 1.005 is really 1.00499… in binary floating point, so it rounds down. Worth
    // pinning: it is the classic surprise in any money-rounding helper.
    assert.equal(parsePrice(1.005), 1);
  });

  it("caps a fat-fingered paste", () => {
    assert.equal(parsePrice(99_999_999), MAX_PRICE);
    assert.equal(parsePrice(Number.POSITIVE_INFINITY), 0);
  });

  it("takes the leading number from a trailing-unit string", () => {
    assert.equal(parsePrice("4.50 each"), 4.5);
  });
});

describe("isMigratedPrice", () => {
  it("recognises a value that needs no conversion", () => {
    assert.equal(isMigratedPrice(1.5), true);
    assert.equal(isMigratedPrice(0), true);
  });

  it("flags anything still stored as a string or unusable", () => {
    assert.equal(isMigratedPrice("1.50"), false);
    assert.equal(isMigratedPrice(null), false);
    assert.equal(isMigratedPrice(undefined), false);
    assert.equal(isMigratedPrice(-1), false);
    assert.equal(isMigratedPrice(Number.NaN), false);
  });
});
