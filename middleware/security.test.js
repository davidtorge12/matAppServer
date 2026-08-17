import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { corsConfig, originAllowed, parseOrigins } from "./security.js";

describe("parseOrigins", () => {
  it("splits a comma list and drops empties", () => {
    assert.deepEqual(
      parseOrigins("https://mat-app.vercel.app, http://localhost:5173"),
      ["https://mat-app.vercel.app", "http://localhost:5173"],
    );
  });

  it("strips a trailing slash so the browser Origin header matches", () => {
    assert.deepEqual(parseOrigins("https://mat-app.vercel.app/"), [
      "https://mat-app.vercel.app",
    ]);
  });

  it("strips wrapping quotes from a pasted env value", () => {
    assert.deepEqual(parseOrigins('"https://mat-app.vercel.app"'), [
      "https://mat-app.vercel.app",
    ]);
  });
});

describe("originAllowed", () => {
  it("allows the production frontend against a trailing-slash allowlist", () => {
    assert.equal(
      originAllowed(
        "https://mat-app.vercel.app",
        "https://mat-app.vercel.app/",
      ),
      true,
    );
  });

  it("rejects an origin that is not on the list", () => {
    assert.equal(
      originAllowed("https://evil.example", "https://mat-app.vercel.app"),
      false,
    );
  });

  it("treats * as allow any origin", () => {
    assert.equal(originAllowed("https://mat-app.vercel.app", "*"), true);
  });
});

describe("corsConfig", () => {
  it("uses cors defaults when the allowlist is * so ACAO is actually sent", () => {
    assert.deepEqual(corsConfig("*"), {});
  });

  it("passes a real allowlist through as origin", () => {
    assert.deepEqual(corsConfig("https://mat-app.vercel.app"), {
      origin: ["https://mat-app.vercel.app"],
    });
  });
});
