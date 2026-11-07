
import { emailQueue } from "./queues/emailQueue.js";

const scheduleTestJob = async () => {
    try {
        const job = await emailQueue.add(
            "test-email",
            {
                to: "test@example.com",
                subject: "My first BullMQ job",
                body: "Testing delayed job scheduling"
            },
            {
                delay: 10000
            }
        );

        console.log("Job added successfully!");
        console.log("Job ID:", job.id);
        console.log("Scheduled with a 10-second delay.");
    } catch (error) {
        console.error("Failed to add job:", error);
    } finally {
        await emailQueue.close();
    }
};

scheduleTestJob();
