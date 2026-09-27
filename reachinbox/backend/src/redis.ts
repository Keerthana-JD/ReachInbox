import IORedis from "ioredis";
import dotenv from "dotenv";
dotenv.config();

// BullMQ requires this exact option when you pass a shared connection.
export const redisConnection = new IORedis(
  process.env.REDIS_URL || "redis://localhost:6379",
  { maxRetriesPerRequest: null }
);
