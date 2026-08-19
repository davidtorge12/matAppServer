import mongoose from "mongoose";
import type { RequestHandler } from "express";
import { ensureCodeIndex, ensureVoSearchIndex } from "../schemas/Codes.js";

/**
 * Serverless hosts start a fresh module instance on every cold start and reuse
 * warm ones, so an unconditional `mongoose.connect()` opens a new Atlas
 * connection per instance and can exhaust the cluster's connection limit. The
 * connection promise is cached on `globalThis` so warm invocations reuse the
 * socket that is already open.
 */
const CACHE_KEY = Symbol.for("matapp.mongoose");

type DbCache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

function cache(): DbCache {
  const store = globalThis as Record<symbol, DbCache | undefined>;
  if (!store[CACHE_KEY]) {
    store[CACHE_KEY] = { conn: null, promise: null };
  }
  return store[CACHE_KEY];
}

export async function connectDb(
  mongoUrl: string | undefined = process.env.MONGO_DB_URL,
): Promise<typeof mongoose> {
  if (!mongoUrl) {
    throw new Error("MONGO_DB_URL is not set");
  }

  const store = cache();
  if (store.conn) {
    await ensureVoSearchIndex();
    await ensureCodeIndex();
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
      .catch((error: unknown) => {
        // Drop the rejected promise so the next request retries rather than
        // replaying the same failure for the life of the instance.
        store.promise = null;
        throw error;
      });
  }

  store.conn = await store.promise;
  await ensureVoSearchIndex();
  await ensureCodeIndex();
  return store.conn;
}

/**
 * Guarantees a live connection before any route touches a model. Needed because
 * on a serverless host nothing runs `start()` — the platform imports the app
 * and calls it per request.
 */
export const withDb: RequestHandler = (_req, _res, next) => {
  connectDb().then(() => next(), next);
};
