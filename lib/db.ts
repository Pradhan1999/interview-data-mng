import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  throw new Error(
    "Missing MONGODB_URI environment variable. Set it in .env.local (see .env.example)."
  );
}

/**
 * Cache the connection on `globalThis` so that:
 *  - During development, Next.js HMR doesn't open a new connection on every
 *    file change (which would quickly exhaust Atlas connection limits).
 *  - In serverless, warm lambdas reuse the existing connection.
 */
interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var _mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache =
  globalThis._mongooseCache ?? { conn: null, promise: null };

if (!globalThis._mongooseCache) {
  globalThis._mongooseCache = cached;
}

/**
 * Connect to MongoDB (idempotent). Every data-access function should await this
 * before issuing queries. Returns the shared mongoose instance.
 */
export async function dbConnect(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI as string, {
        bufferCommands: false,
        // Serverless: each function instance only needs one connection.
        // A larger pool wastes the handshake time and Atlas connection slots.
        maxPoolSize: 1,
        // Fail fast rather than hanging if Atlas is unreachable on cold start.
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      })
      .then((m) => m);
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Reset so the next call retries instead of reusing a rejected promise.
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
