import { timingSafeEqual } from "node:crypto";
import cors from "cors";

function parseOrigins(value) {
  return (value || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function corsOrigins() {
  return parseOrigins(process.env.CORS_ORIGIN);
}

export function applyCors(app) {
  const allowed = corsOrigins();

  if (allowed.length) {
    app.use(cors({ origin: allowed }));
    return;
  }

  // No allowlist configured. Outside production that is convenient; in
  // production it would let any site on the internet read the API with a key
  // lifted from the frontend bundle, so `index.js` refuses to start instead.
  console.warn(
    "CORS_ORIGIN is not set — allowing every origin. Set it before deploying.",
  );
  app.use(cors());
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

  // Fail closed. `index.js` already refuses to start without a key, so reaching
  // here with none means something is misconfigured — do not wave the request
  // through.
  if (!expected) {
    return res.status(500).json({ error: "server misconfigured" });
  }

  if (matches(req.headers["x-api-key"], expected)) {
    return next();
  }

  return res.status(401).json({ error: "unauthorized" });
}
