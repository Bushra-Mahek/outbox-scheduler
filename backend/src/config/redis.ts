import "dotenv/config";
import { Redis } from "ioredis";

export const redisOptions = {
  host: process.env.REDIS_HOST || "localhost",
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,

  // BullMQ requires this to be null.
  maxRetriesPerRequest: null as null
};

export const createRedisConnection = (): Redis => {
  return new Redis(redisOptions);
};