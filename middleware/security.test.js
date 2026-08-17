import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  corsConfig,
  normalizeOrigin,
  originAllowed,
  parseOrigins,
} from "./security.js";

/**
 * A CORS misconfiguration does not look like an error: the server answers 200, the
 * browser drops the response, and the only symptom anyone sees is "Failed to
 * fetch". These are pure functions on purpose — no database, no dotenv, no
 * network — so the rules can be checked without touching a deployment.
 */

describe("normalizeOrigin", () => {
  it("strips a trailing slash, which a browser Origin header never has", () => {
    assert.equal(
      normalizeOrigin("https://mat-app.vercel.app/"),
      "https://mat-app.vercel.app",
    );
    assert.equal(
      normalizeOrigin("https://mat-app.vercel.app///"),
      "https://mat-app.vercel.app",
    );
  });

  it("strips quotes pasted in from a dashboard field", () => {
    assert.equal(
      normalizeOrigin('"https://mat-app.vercel.app"'),
      "https://mat-app.vercel.app",
    );
    assert.equal(
      normalizeOrigin("'https://mat-app.vercel.app'"),
      "https://mat-app.vercel.app",
    );
  });

  it("trims surrounding whitespace", () => {
    assert.equal(normalizeOrigin("  https://a.app  "), "https://a.app");
  });

  it("answers empty for a non-string", () => {
    assert.equal(normalizeOrigin(undefined), "");
    assert.equal(normalizeOrigin(null), "");
  });
});

describe("parseOrigins", () => {
  it("splits a comma-separated list and normalises each entry", () => {
    assert.deepEqual(parseOrigins("https://a.app/, https://b.app"), [
      "https://a.app",
      "https://b.app",
    ]);
  });

  it("drops empty entries from a trailing comma", () => {
    assert.deepEqual(parseOrigins("https://a.app,,"), ["https://a.app"]);
  });

  it("answers empty for unset", () => {
    assert.deepEqual(parseOrigins(undefined), []);
    assert.deepEqual(parseOrigins(""), []);
  });
});

describe("corsConfig", () => {
  /**
   * The bug this exists to prevent: `cors({ origin: ["*"] })` compares the browser's
   * Origin header against the literal string "*", so it never matches and no real
   * site is sent Access-Control-Allow-Origin. Falling back to `{}` lets the cors
   * package apply its own `origin: "*"` default, which does work.
   */
  it("uses cors defaults for a literal * rather than matching it as an origin", () => {
    assert.deepEqual(corsConfig("*"), {});
  });

  it("uses cors defaults when nothing is configured", () => {
    assert.deepEqual(corsConfig(""), {});
    assert.deepEqual(corsConfig(undefined), {});
  });

  it("passes a real allowlist through, normalised", () => {
    assert.deepEqual(corsConfig("https://mat-app.vercel.app/"), {
      origin: ["https://mat-app.vercel.app"],
    });
  });

  it("treats a list containing * as fully open", () => {
    assert.deepEqual(corsConfig("https://a.app,*"), {});
  });
});

describe("originAllowed", () => {
  it("allows the configured origin", () => {
    assert.equal(
      originAllowed("https://mat-app.vercel.app", "https://mat-app.vercel.app"),
      true,
    );
  });

  // The outage: a configured value that cannot match what the browser sends.
  it("allows a configured origin written with a trailing slash", () => {
    assert.equal(
      originAllowed("https://mat-app.vercel.app", "https://mat-app.vercel.app/"),
      true,
    );
  });

  it("refuses an origin that is not on the list", () => {
    assert.equal(
      originAllowed("https://evil.example", "https://mat-app.vercel.app"),
      false,
    );
  });

  it("is open when nothing is configured or a wildcard is used", () => {
    assert.equal(originAllowed("https://anything.app", ""), true);
    assert.equal(originAllowed("https://anything.app", "*"), true);
  });

  it("allows a request with no Origin at all, such as curl or a health check", () => {
    assert.equal(originAllowed(undefined, "https://mat-app.vercel.app"), true);
  });
});
