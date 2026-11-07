
import "dotenv/config";
import Redis from "ioredis";

export const redisOptions = {
    host: process.env.REDIS_HOST || "localhost",
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,

    // Required by BullMQ
    maxRetriesPerRequest: null
};

export const createRedisConnection = () => {
    return new Redis(redisOptions);
};
