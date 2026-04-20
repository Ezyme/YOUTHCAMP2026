import mongoose from "mongoose";
import { Team } from "@/lib/db/models";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cache: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cache;
}

export async function dbConnect(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    throw new Error(
      "Please define MONGODB_URI in .env.local (MongoDB connection string).",
    );
  }
  if (cache.conn) {
    return cache.conn;
  }
  if (!cache.promise) {
    cache.promise = mongoose.connect(MONGODB_URI);
  }
  cache.conn = await cache.promise;
  // Migrate Team login index (sparse → partial) so bootstrap can insert 6 rows before sync.
  await Team.syncIndexes().catch((err) => {
    console.warn("[db] Team.syncIndexes:", err);
  });
  return cache.conn;
}
