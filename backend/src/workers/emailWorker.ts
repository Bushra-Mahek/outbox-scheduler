
import { Worker, type Job } from "bullmq";

import pool from "../config/db.js";
import { createRedisConnection } from "../config/redis.js";

import {
  initializeEmailService,
  sendEmail
} from "../services/emailService.js";

interface EmailJobData {
  emailId: string;
}

interface EmailRecord {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  campaign_id: string | null;
}

const concurrency = Math.max(
  1,
  Number(process.env.WORKER_CONCURRENCY) || 5
);

const updateCampaignAfterSuccess = async (
  campaignId: string | null
): Promise<void> => {
  if (!campaignId) return;

  await pool.query(
    `UPDATE campaigns
     SET sent_count = sent_count + 1,
         status = CASE
           WHEN sent_count + failed_count + 1 >= total_recipients
             THEN CASE
               WHEN failed_count > 0 THEN 'partially_failed'
               ELSE 'completed'
             END
           ELSE 'processing'
         END,
         updated_at = NOW()
     WHERE id = $1`,
    [campaignId]
  );
};

const startWorker = async (): Promise<void> => {
  await initializeEmailService();

  const worker = new Worker<EmailJobData>(
    "email-queue",
    async (job: Job<EmailJobData>) => {
      const { emailId } = job.data;

      console.log("Processing scheduled email:", emailId);

      const result = await pool.query<EmailRecord>(
        `SELECT id, recipient, subject, body, status, campaign_id
         FROM emails
         WHERE id = $1`,
        [emailId]
      );

      const email = result.rows[0];

      if (!email) {
        throw new Error(`Email record not found: ${emailId}`);
      }

      if (email.status === "cancelled") {
        console.log("Email cancelled. Skipping:", emailId);
        return { skipped: true, reason: "cancelled" };
      }

      if (email.status === "sent") {
        console.log("Email already sent. Skipping:", emailId);
        return { skipped: true, reason: "already_sent" };
      }

      // Claim the email only if it is still scheduled.
      // This reduces the chance of two workers processing it.
      const claimResult = await pool.query(
        `UPDATE emails
         SET status = 'processing',
             attempt_count = attempt_count + 1,
             last_attempt_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
           AND status = 'scheduled'
         RETURNING id`,
        [emailId]
      );

      if (claimResult.rowCount === 0) {
        const latest = await pool.query(
          `SELECT status FROM emails WHERE id = $1`,
          [emailId]
        );

        const latestStatus = latest.rows[0]?.status;

        if (latestStatus === "sent" || latestStatus === "cancelled") {
          return { skipped: true, reason: latestStatus };
        }

        // A processing record may be a retry after a previous attempt.
        // Continue retrying only when BullMQ invokes this job again.
        if (latestStatus !== "processing") {
          throw new Error(`Unexpected email status: ${latestStatus}`);
        }
      }

      // Send through the existing Ethereal SMTP service.
      const emailResult = await sendEmail({
        recipient: email.recipient,
        subject: email.subject,
        body: email.body
      });

      // Persist successful SMTP acceptance.
      const updateResult = await pool.query(
        `UPDATE emails
         SET status = 'sent',
             sent_at = NOW(),
             error_message = NULL,
             updated_at = NOW()
         WHERE id = $1
           AND status != 'sent'
         RETURNING campaign_id`,
        [emailId]
      );

      if (updateResult.rowCount === 0) {
        console.warn("Email status was already updated:", emailId);
      } else {
        await updateCampaignAfterSuccess(
          updateResult.rows[0].campaign_id
        );
      }

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
      concurrency
    }
  );

  worker.on("completed", (job) => {
    console.log("Job completed:", job.id);
  });

  worker.on("failed", async (job, error) => {
    console.error("Job failed:", job?.id, error.message);

    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;

    if (job.attemptsMade < maxAttempts) {
      return;
    }

    try {
      const updateResult = await pool.query(
        `UPDATE emails
         SET status = 'failed',
             error_message = $1,
             updated_at = NOW()
         WHERE id = $2
           AND status NOT IN ('sent', 'failed', 'cancelled')
         RETURNING campaign_id`,
        [error.message, job.data.emailId]
      );

     if ((updateResult.rowCount ?? 0) > 0) {
        const campaignId = updateResult.rows[0].campaign_id;

        if (campaignId) {
          await pool.query(
            `UPDATE campaigns
             SET failed_count = failed_count + 1,
                 status = CASE
                   WHEN sent_count + failed_count + 1 >= total_recipients
                     THEN CASE
                       WHEN sent_count > 0 THEN 'partially_failed'
                       ELSE 'failed'
                     END
                   ELSE 'processing'
                 END,
                 updated_at = NOW()
             WHERE id = $1`,
            [campaignId]
          );
        }
      }

      console.log("Final failure recorded:", job.data.emailId);
    } catch (dbError: unknown) {
      console.error("Failed to record final email failure:", dbError);
    }
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received. Closing worker...`);

    await worker.close();
    await pool.end();

    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  console.log(`Email worker started. Concurrency: ${concurrency}`);
};

startWorker().catch((error: unknown) => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});
