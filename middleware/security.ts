import { timingSafeEqual } from "node:crypto";
import cors, { type CorsOptions } from "cors";
import type { Express, RequestHandler } from "express";

export function normalizeOrigin(value: unknown): string {
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

export function parseOrigins(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((origin) => normalizeOrigin(origin))
    .filter(Boolean);
}

export function corsOrigins(): string[] {
  return parseOrigins(process.env.CORS_ORIGIN);
}

export function originAllowed(
  requestOrigin: string | undefined,
  configured: string | undefined = process.env.CORS_ORIGIN,
): boolean {
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
export function corsConfig(
  value: string | undefined = process.env.CORS_ORIGIN,
): CorsOptions {
  const allowed = parseOrigins(value);
  if (!allowed.length || allowed.includes("*")) {
    return {};
  }
  return { origin: allowed };
}

export function applyCors(app: Express): void {
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
function matches(provided: unknown, expected: string): boolean {
  if (typeof provided !== "string") {
    return false;
  }

  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export const requireApiKey: RequestHandler = (req, res, next) => {
  const expected = process.env.API_KEY;

  // Fail closed. `index.ts` answers 503 for every route when the key is missing,
  // so reaching here without one means something is badly misconfigured — never
  // wave the request through.
  if (!expected) {
    return res.status(503).json({ error: "server misconfigured" });
  }

  if (matches(req.headers["x-api-key"], expected)) {
    return next();
  }

  return res.status(401).json({ error: "unauthorized" });
};
