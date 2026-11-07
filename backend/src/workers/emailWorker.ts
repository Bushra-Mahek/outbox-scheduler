
import {
  Worker,
  DelayedError,
  type Job
} from "bullmq";

import pool from "../config/db.js";
import { createRedisConnection } from "../config/redis.js";

import {
  initializeEmailService,
  sendEmail
} from "../services/emailService.js";

import {
  updateIndexedEmailStatus
} from "../services/searchService.js";

import {
  reserveEmailSendSlot
} from "../utils/emailRateLimiter.js";

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
  delay_seconds: number;
  hourly_limit: number | null;
}

const concurrency = Math.max(
  1,
  Number(process.env.WORKER_CONCURRENCY) || 5
);

// Mark an email as sent and update its campaign atomically.
const markEmailAsSent = async (
  emailId: string
): Promise<void> => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const result = await client.query(
      `UPDATE emails
       SET status = 'sent',
           sent_at = NOW(),
           error_message = NULL,
           updated_at = NOW()
       WHERE id = $1
         AND status = 'processing'
       RETURNING campaign_id`,
      [emailId]
    );

    if ((result.rowCount ?? 0) > 0) {
      const campaignId = result.rows[0].campaign_id;

      if (campaignId) {
        await client.query(
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
      }
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const startWorker = async (): Promise<void> => {
  await initializeEmailService();

  const redis = createRedisConnection();

  const worker = new Worker<EmailJobData>(
    "email-queue",
    async (job: Job<EmailJobData>) => {
      const { emailId } = job.data;

      console.log("Processing scheduled email:", emailId);

      const result = await pool.query<EmailRecord>(
        `SELECT
           e.id,
           e.recipient,
           e.subject,
           e.body,
           e.status,
           e.campaign_id,
           COALESCE(c.delay_seconds, 0) AS delay_seconds,
           c.hourly_limit
         FROM emails e
         LEFT JOIN campaigns c ON c.id = e.campaign_id
         WHERE e.id = $1`,
        [emailId]
      );

      const email = result.rows[0];

      if (!email) {
        throw new Error(`Email record not found: ${emailId}`);
      }

      // Skip emails that are already completed or cancelled.
      if (
        email.status === "cancelled" ||
        email.status === "sent" ||
        email.status === "failed"
      ) {
        return {
          skipped: true,
          reason: email.status
        };
      }

      // Claim the email before reserving a Redis sending slot.
      if (email.status === "scheduled") {
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

        if ((claimResult.rowCount ?? 0) === 0) {
          const latest = await pool.query(
            `SELECT status FROM emails WHERE id = $1`,
            [emailId]
          );

          const latestStatus = latest.rows[0]?.status;

          if (
            latestStatus === "sent" ||
            latestStatus === "cancelled" ||
            latestStatus === "failed"
          ) {
            return {
              skipped: true,
              reason: latestStatus
            };
          }

          if (latestStatus !== "processing") {
            throw new Error(
              `Unable to claim email. Current status: ${latestStatus}`
            );
          }
        }
      } else if (email.status !== "processing") {
        return {
          skipped: true,
          reason: email.status
        };
      }

      // Check campaign hourly limit and sending delay.
      if (email.campaign_id) {
        const waitMs = await reserveEmailSendSlot(
          redis,
          email.campaign_id,
          email.hourly_limit,
          email.delay_seconds
        );

        if (waitMs > 0) {
          if (!job.token) {
            throw new Error(
              "BullMQ job lock token is unavailable"
            );
          }

          // Restore database state before deferring the job.
          await pool.query(
            `UPDATE emails
             SET status = 'scheduled',
                 updated_at = NOW()
             WHERE id = $1
               AND status = 'processing'`,
            [emailId]
          );

          const deferredUntil = Date.now() + waitMs;

          console.log(
            `Rate limit/delay reached for campaign ${email.campaign_id}. ` +
            `Deferring ${emailId} by ${Math.ceil(waitMs / 1000)} seconds.`
          );

          await job.moveToDelayed(
            deferredUntil,
            job.token
          );

          throw new DelayedError();
        }
      }

      // Send the email after passing the rate limiter.
      const emailResult = await sendEmail({
        recipient: email.recipient,
        subject: email.subject,
        body: email.body
      });

      // Commit PostgreSQL status first.
      await markEmailAsSent(emailId);

      // Synchronize Elasticsearch after successful database commit.
      try {
        await updateIndexedEmailStatus(
          emailId,
          "sent",
          new Date().toISOString()
        );
      } catch (error) {
        console.error(
          "Elasticsearch sent status update failed:",
          error
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
      connection: redis,
      concurrency
    }
  );

  worker.on("completed", (job) => {
    console.log("Job completed:", job.id);
  });

  // Handle permanent job failures after all retries are exhausted.
  worker.on("failed", async (job, error) => {
    console.error(
      "Job failed:",
      job?.id,
      error.message
    );

    if (!job) return;

    const maxAttempts = job.opts.attempts ?? 1;

    // Allow BullMQ retries before marking the email permanently failed.
    if (job.attemptsMade < maxAttempts) {
      return;
    }

    let emailMarkedFailed = false;

    try {
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const updateResult = await client.query(
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
          emailMarkedFailed = true;

          const campaignId = updateResult.rows[0].campaign_id;

          if (campaignId) {
            await client.query(
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

        await client.query("COMMIT");
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }

      // Update Elasticsearch only after PostgreSQL commits.
      if (emailMarkedFailed) {
        try {
          await updateIndexedEmailStatus(
            job.data.emailId,
            "failed"
          );
        } catch (error) {
          console.error(
            "Elasticsearch failure status update failed:",
            error
          );
        }
      }
    } catch (dbError) {
      console.error(
        "Failed to update email status:",
        dbError
      );
    }
  });

  worker.on("error", (error) => {
    console.error("Worker error:", error);
  });

  // Graceful shutdown.
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`${signal} received. Closing worker...`);

    await worker.close();
    await redis.quit();
    await pool.end();

    process.exit(0);
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));

  console.log(
    `Email worker started. Concurrency: ${concurrency}`
  );
};

startWorker().catch((error: unknown) => {
  console.error("Worker startup failed:", error);
  process.exit(1);
});
