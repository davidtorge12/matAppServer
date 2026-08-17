import express from "express";
import { config } from "dotenv";
import { applyCors, corsOrigins, requireApiKey } from "./middleware/security.js";
import { connectDb, withDb } from "./lib/db.js";
import { errorHandler } from "./lib/route.js";
import codesRouter from "./routes/codes.js";
import materialsRouter from "./routes/materials.js";
import voRouter from "./routes/vo.js";

config();

const isProduction = process.env.NODE_ENV === "production";

if (!process.env.API_KEY) {
  console.error("API_KEY is not set. Refusing to start an open API.");
  process.exit(1);
}

// The API key ships inside the frontend bundle, so the origin allowlist is what
// actually stops an arbitrary site from using it. Missing in production is a
// misconfiguration, not a default worth falling back to.
if (isProduction && !corsOrigins().length) {
  console.error("CORS_ORIGIN is not set. Refusing to start an open API.");
  process.exit(1);
}

const app = express();

applyCors(app);
// Default is 100kb. A job upload posts codes in chunks of 50, so this is
// generous, and a cap keeps a hostile body from being buffered in full.
app.use(express.json({ limit: "1mb" }));

app.get("/", (_req, res) => {
  res.json({ ok: true });
});

app.use(requireApiKey);
// After the key check, so an unauthenticated request never touches the database.
app.use(withDb);
app.use(codesRouter);
app.use(materialsRouter);
app.use(voRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "not found" });
});
app.use(errorHandler);

async function start() {
  const port = process.env.PORT || 3000;

  try {
    await connectDb(process.env.MONGO_DB_URL);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }

  app.listen(port, () => {
    console.log(`API listening on port ${port}`);
  });
}

// Vercel imports this module and invokes `app` per request. Calling listen()
// (and process.exit on a failed Mongo connect) races the handler and shows up
// as FUNCTION_INVOCATION_FAILED on otherwise healthy routes.
if (!process.env.VERCEL) {
  start();
}

export default app;
