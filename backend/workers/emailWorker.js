
import { Worker } from "bullmq";
import pool from "../config/db.js";
import { createRedisConnection } from "../config/redis.js";
import {
  initializeEmailService,
  sendEmail
} from "../services/emailService.js";

const startWorker = async () => {
  // Initialize Ethereal SMTP before accepting jobs
  await initializeEmailService();

  const worker = new Worker(
    "email-queue",
    async (job) => {
      const { emailId } = job.data;

      console.log("Processing scheduled email:", emailId);

      // Fetch email details from PostgreSQL
      const result = await pool.query(
        "SELECT * FROM emails WHERE id = $1",
        [emailId]
      );

      if (result.rows.length === 0) {
        throw new Error("Email record not found");
      }

      const email = result.rows[0];

      if (email.status === "cancelled") {
        console.log("Email was cancelled. Skipping:", emailId);
        return { skipped: true };
      }

      // Mark email as processing
      await pool.query(
        `UPDATE emails
         SET status = 'processing', updated_at = NOW()
         WHERE id = $1`,
        [emailId]
      );

      // Send email through Ethereal SMTP
      const emailResult = await sendEmail({
        recipient: email.recipient,
        subject: email.subject,
        body: email.body
      });

      // Update database after successful send
      await pool.query(
        `UPDATE emails
         SET status = 'sent',
             sent_at = NOW(),
             error_message = NULL,
             updated_at = NOW()
         WHERE id = $1`,
        [emailId]
      );

      console.log("Email sent successfully:", emailId);
      console.log("Preview URL:", emailResult.previewUrl);

      return {
        success: true,
        messageId: emailResult.messageId,
        previewUrl: emailResult.previewUrl
      };
    },
    {
      connection: createRedisConnection(),
      concurrency: 5
    }
  );

  worker.on("completed", (job) => {
    console.log("Job completed:", job.id);
  });

  worker.on("failed", async (job, error) => {
    console.error("Job failed:", job?.id, error.message);

    if (job && job.attemptsMade >= job.opts.attempts) {
      try {
        await pool.query(
          `UPDATE emails
           SET status = 'failed',
               error_message = $1,
               updated_at = NOW()
           WHERE id = $2 AND status != 'sent'`,
          [error.message, job.data.emailId]
        );
      } catch (dbError) {
        console.error("Failed to update email status:", dbError);
      }
    }
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  console.log("Email worker started and listening...");
};

startWorker().catch((error) => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});
