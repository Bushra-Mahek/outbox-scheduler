
import { createRedisConnection } from "./redis.js";

const redis = createRedisConnection();

try {
    const response = await redis.ping();

    console.log("Redis connected successfully!");
    console.log("Redis response:", response);
} catch (error) {
    console.error("Redis connection failed:", error);
} finally {
    await redis.quit();
}
