import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatVoLine,
  isMatchLine,
  joinVoLines,
  searchTermFor,
  serializeVo,
  splitVoLines,
} from "./voLines.js";

describe("splitVoLines", () => {
  it("splits on newlines", () => {
    assert.deepEqual(splitVoLines("a\nb\nc"), ["a", "b", "c"]);
  });

  it("normalises CRLF from a Windows or Excel paste", () => {
    assert.deepEqual(splitVoLines("a\r\nb\rc"), ["a", "b", "c"]);
  });

  it("keeps blank lines, which the answer preserves", () => {
    assert.deepEqual(splitVoLines("a\n\nb"), ["a", "", "b"]);
  });
});

describe("isMatchLine", () => {
  it("matches a lower or upper case x marker", () => {
    assert.equal(isMatchLine("x renew bath panel"), true);
    assert.equal(isMatchLine("X renew bath panel"), true);
  });

  it("ignores a line that only starts with the letter x", () => {
    assert.equal(isMatchLine("xtra sockets"), false);
  });

  it("ignores an unmarked line", () => {
    assert.equal(isMatchLine("Kitchen"), false);
  });
});

describe("searchTermFor", () => {
  it("drops the marker", () => {
    assert.equal(searchTermFor("x Bonding coat in patch"), "Bonding coat in patch");
  });

  it("stops at the first dash, where the location note starts", () => {
    assert.equal(
      searchTermFor("x renew bath panel - bathroom"),
      "renew bath panel",
    );
  });
});

describe("formatVoLine", () => {
  // The "x " marker stays in the answer: the firm's own paste target expects it.
  it("prefixes a matched code", () => {
    assert.equal(
      formatVoLine("x renew bath panel", "P1234"),
      "P1234 x renew bath panel",
    );
  });

  it("pads to the same column when nothing matched", () => {
    assert.equal(
      formatVoLine("x renew bath panel", null),
      "       x renew bath panel",
    );
  });

  it("leaves an unmarked line untouched", () => {
    assert.equal(formatVoLine("  Kitchen", null), "  Kitchen");
  });

  it("empties a blank line rather than padding it", () => {
    assert.equal(formatVoLine("   ", null), "");
  });
});

describe("joinVoLines", () => {
  it("terminates every line, including the last", () => {
    assert.equal(joinVoLines(["a", "", "b"]), "a\n\nb\n");
  });
});

describe("serializeVo", () => {
  it("trims each row and prefixes a missing x marker", () => {
    assert.equal(
      serializeVo("  renew Bath panel  \n Bonding coat in patch"),
      "x renew Bath panel\nx Bonding coat in patch",
    );
  });

  it("keeps an existing marker and collapses extra spaces after it", () => {
    assert.equal(serializeVo("x  renew Bath panel"), "x renew Bath panel");
    assert.equal(serializeVo("X   Bonding coat"), "x Bonding coat");
  });

  it("does not add a second marker when the line is already marked", () => {
    assert.equal(serializeVo("x renew Bath panel"), "x renew Bath panel");
  });

  it("leaves blank lines empty after trim", () => {
    assert.equal(serializeVo("a\n  \nb"), "x a\n\nx b");
  });

  it("leaves a matched code prefix in place", () => {
    assert.equal(
      serializeVo("P1234 x renew Bath panel"),
      "P1234 x renew Bath panel",
    );
    assert.equal(
      serializeVo("  P1234  x   renew Bath panel  "),
      "P1234 x renew Bath panel",
    );
  });
});
