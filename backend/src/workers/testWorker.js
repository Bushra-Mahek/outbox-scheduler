
import { Worker } from "bullmq";
import { createRedisConnection } from "../config/redis.js";

const worker = new Worker(
    "email-queue",

    async (job) => {
        console.log("Processing job:", job.id);
        console.log("Job data:", job.data);

        // Temporary simulation of email processing
        console.log("Processing email...");

        return {
            success: true,
            processedAt: new Date().toISOString()
        };
    },

    {
        connection: createRedisConnection(),
        concurrency: 5
    }
);

worker.on("completed", (job, result) => {
    console.log("Job completed:", job.id);
    console.log("Result:", result);
});

worker.on("failed", (job, error) => {
    console.error("Job failed:", job?.id, error.message);
});

worker.on("error", (error) => {
    console.error("Worker error:", error);
});

console.log("Email worker is listening...");
