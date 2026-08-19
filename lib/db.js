import mongoose from "mongoose";
import { ensureVoSearchIndex } from "../schemas/Codes.js";

/**
 * Serverless hosts start a fresh module instance on every cold start and reuse
 * warm ones, so an unconditional `mongoose.connect()` opens a new Atlas
 * connection per instance and can exhaust the cluster's connection limit. The
 * connection promise is cached on `globalThis` so warm invocations reuse the
 * socket that is already open.
 */
const CACHE_KEY = Symbol.for("matapp.mongoose");

function cache() {
  if (!globalThis[CACHE_KEY]) {
    globalThis[CACHE_KEY] = { conn: null, promise: null };
  }
  return globalThis[CACHE_KEY];
}

export async function connectDb(mongoUrl = process.env.MONGO_DB_URL) {
  if (!mongoUrl) {
    throw new Error("MONGO_DB_URL is not set");
  }

  const store = cache();
  if (store.conn) {
    await ensureVoSearchIndex();
    return store.conn;
  }

  if (!store.promise) {
    store.promise = mongoose
      .connect(mongoUrl, {
        // Default is 30s, which on a serverless host means the request sits
        // burning wall clock before the platform kills it. Fail fast instead.
        serverSelectionTimeoutMS: 8000,
      })
      .then((connection) => {
        console.log("MongoDB connected");
        return connection;
      })
      .catch((error) => {
        // Drop the rejected promise so the next request retries rather than
        // replaying the same failure for the life of the instance.
        store.promise = null;
        throw error;
      });
  }

  store.conn = await store.promise;
  await ensureVoSearchIndex();
  return store.conn;
}

/**
 * Guarantees a live connection before any route touches a model. Needed because
 * on a serverless host nothing runs `start()` — the platform imports the app
 * and calls it per request.
 */
export function withDb(_req, _res, next) {
  connectDb().then(() => next(), next);
}
