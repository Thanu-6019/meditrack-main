// src/lib/mongodb.ts
// ─────────────────────────────────────────────────────────────────────────────
// Singleton Mongoose connection for Next.js App Router.
//
// WHY A SINGLETON?
// Next.js in development runs with hot-module reloading. Without caching,
// every file save would create a new Mongoose connection — quickly exhausting
// your MongoDB Atlas connection pool (free tier = 500 max).
//
// HOW IT WORKS:
// Node.js module caching means `global` persists across HMR cycles. We store
// the connection promise on `global` so it survives reloads. In production,
// the module is loaded once and the cache is effectively a no-op (still clean).
// ─────────────────────────────────────────────────────────────────────────────

import mongoose, { type Mongoose } from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Please define the MONGODB_URI environment variable in .env.local\n" +
    "Example: MONGODB_URI=mongodb+srv://<user>:<pass>@cluster.mongodb.net/meditrack"
  );
}

// ─── Global cache type ────────────────────────────────────────────────────────
// We extend the Node.js `global` object so TypeScript is happy with our cache.

interface MongooseCache {
  conn: Mongoose | null;
  promise: Promise<Mongoose> | null;
}

declare global {
  // eslint-disable-next-line no-var
  var _mongoose: MongooseCache | undefined;
}

// Initialise the cache bucket on first import
const cached: MongooseCache = global._mongoose ?? { conn: null, promise: null };
global._mongoose = cached;

// ─── connectDB ───────────────────────────────────────────────────────────────

/**
 * Returns a connected Mongoose instance.
 *
 * - First call: opens the connection and caches the promise.
 * - Subsequent calls in the same process: returns the cached connection
 *   immediately (no extra round-trip to MongoDB).
 *
 * Usage (in any Server Component, Route Handler, or Server Action):
 * ```ts
 * import { connectDB } from "@/lib/mongodb";
 * await connectDB();
 * ```
 */
export async function connectDB(): Promise<Mongoose> {
  // Already connected — return immediately
  if (cached.conn) return cached.conn;

  // Connection in progress — await the existing promise instead of opening
  // a second connection
  if (!cached.promise) {
    const opts = {
      bufferCommands: false, // fail fast if not connected rather than queuing
      maxPoolSize: 10,       // sensible default for serverless / edge
    } as any;

    cached.promise = mongoose
      .connect(MONGODB_URI as string, opts)
      .then((m) => {
        console.log("✅ MongoDB connected");
        return m;
      })
      .catch((err) => {
        // Clear the promise so the next call retries
        cached.promise = null;
        throw err;
      });
  }

  cached.conn = await cached.promise;
  return cached.conn;
}

export default connectDB;