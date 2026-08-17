import cors from "cors";

export function applyCors(app) {
  const allowed = (process.env.CORS_ORIGIN || "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(allowed.length ? cors({ origin: allowed }) : cors());
}

export function requireApiKey(req, res, next) {
  const expected = process.env.API_KEY;
  if (!expected) {
    return next();
  }

  if (req.headers["x-api-key"] === expected) {
    return next();
  }

  return res.status(401).json({ error: "unauthorized" });
}
