
import { Queue } from "bullmq";
import { redisOptions } from "../config/redis.js";

export const emailQueue = new Queue("email-queue", {
    connection: redisOptions,

    defaultJobOptions: {
        attempts: 3,

        backoff: {
            type: "exponential",
            delay: 5000
        },

        removeOnComplete: 100,
        removeOnFail: 500
    }
});
