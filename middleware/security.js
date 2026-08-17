import { timingSafeEqual } from "node:crypto";
import cors from "cors";

export function normalizeOrigin(value) {
  if (typeof value !== "string") {
    return "";
  }

  let origin = value.trim();
  if (
    (origin.startsWith('"') && origin.endsWith('"')) ||
    (origin.startsWith("'") && origin.endsWith("'"))
  ) {
    origin = origin.slice(1, -1).trim();
  }

  return origin.replace(/\/+$/, "");
}

export function parseOrigins(value) {
  return (value || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

export function corsOrigins() {
  return parseOrigins(process.env.CORS_ORIGIN);
}

export function originAllowed(requestOrigin, configured = process.env.CORS_ORIGIN) {
  const allowed = parseOrigins(configured);
  if (!allowed.length || allowed.includes("*")) {
    return true;
  }
  if (!requestOrigin) {
    return true;
  }
  return allowed.includes(normalizeOrigin(requestOrigin));
}

/**
 * Options passed to the `cors` package. `origin: ['*']` is not a wildcard — it
 * looks for a browser Origin header that is literally `*`, so no real site
 * gets `Access-Control-Allow-Origin`. An empty list or `*` uses cors defaults
 * (`origin: '*'`) instead.
 */
export function corsConfig(value = process.env.CORS_ORIGIN) {
  const allowed = parseOrigins(value);
  if (!allowed.length || allowed.includes("*")) {
    return {};
  }
  return { origin: allowed };
}

export function applyCors(app) {
  const allowed = corsOrigins();

  if (!allowed.length) {
    // No allowlist configured, so every origin is allowed. In production that
    // means any site can use the API with a key lifted from the frontend bundle —
    // but it warns rather than refusing, because taking a working tool offline
    // over a config gap is the worse outcome.
    console.warn(
      "CORS_ORIGIN is not set — allowing every origin. Set it before deploying.",
    );
  } else if (allowed.includes("*")) {
    console.warn(
      "CORS_ORIGIN=* allows every origin. Set it to the frontend URL before deploying.",
    );
  }

  app.use(cors(corsConfig()));
}

/** Constant-time compare, so a wrong key cannot be narrowed down byte by byte. */
function matches(provided, expected) {
  if (typeof provided !== "string") {
    return false;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;

  // Fail closed. `index.js` answers 503 for every route when the key is missing,
  // so reaching here without one means something is badly misconfigured — never
  // wave the request through.
  if (!expected) {
    return res.status(503).json({ error: "server misconfigured" });
  }

  if (matches(req.headers["x-api-key"], expected)) {
    return next();
  }

  return res.status(401).json({ error: "unauthorized" });
}
