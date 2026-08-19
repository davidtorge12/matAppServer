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

/**
 * Configuration is checked, but never with `process.exit()` at import time.
 * On a serverless host this module is imported per cold start and the exported app
 * is invoked per request — exiting there is not "refusing to start", it is a crash
 * that returns no HTTP response at all, which the browser reports only as
 * "Failed to fetch". A misconfigured deploy has to answer with something readable.
 */
const fatalConfigErrors: string[] = [];

if (!process.env.API_KEY) {
  // Fatal: serving an unauthenticated API is worse than being unavailable.
  fatalConfigErrors.push("API_KEY is not set");
}

// Not fatal. The API key ships inside the frontend bundle, so this allowlist is
// what really restricts access — but taking a working tool offline over it is the
// wrong trade, so it warns loudly and stays permissive instead.
if (isProduction && !corsOrigins().length) {
  console.error(
    "CORS_ORIGIN is not set: every origin is allowed. Set it to your frontend " +
      "origin and redeploy.",
  );
}

const app = express();

// Applied first, and unconditionally, so even an error response carries the
// headers the browser needs in order to read it.
applyCors(app);

if (fatalConfigErrors.length) {
  for (const problem of fatalConfigErrors) {
    console.error(`Configuration error: ${problem}`);
  }

  app.use((_req, res) => {
    res.status(503).json({
      error: `Server is misconfigured: ${fatalConfigErrors.join("; ")}`,
    });
  });
}
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

async function start(): Promise<void> {
  const port = process.env.PORT || 3000;

  // Failing fast is useful here and only here: a local run is a long-lived process
  // a developer is watching, not a function serving live traffic.
  if (fatalConfigErrors.length) {
    console.error("Refusing to start. Fix the configuration errors above.");
    process.exit(1);
  }

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
  void start();
}

export default app;
