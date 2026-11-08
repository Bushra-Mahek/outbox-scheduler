import type { Request, Response } from "express";
import { z } from "zod";
import { randomUUID } from "node:crypto";

import {
  bulkIndexEmails,
  updateIndexedEmailStatus,
  searchEmails,
  type EmailSearchDocument
} from "../services/searchService.js";

import pool from "../config/db.js";
import { emailQueue } from "../queues/emailQueue.js";

const emailSchema = z.object({
  recipient: z.string().email().optional(),
  recipients: z.array(z.string().email()).min(1).max(1000).optional(),
  campaignName: z.string().trim().max(255).optional(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().min(1),
  scheduledAt: z.string().datetime({ offset: true }),
  delaySeconds: z.number().int().min(0).max(86400).default(0),
  hourlyLimit: z.number().int().positive().max(10000).optional(),
  senderAccountId: z.string().uuid().optional()
}).refine(
  (data) => Boolean(data.recipient || data.recipients?.length),
  { message: "At least one recipient is required" }
);

export const scheduleEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const client = await pool.connect();

  let transactionStarted = false;

  try {
    const validation = emailSchema.safeParse(req.body);

    if (!validation.success) {
      return res.status(400).json({
        success: false,
        message: "Invalid email details",
        errors: validation.error.issues
      });
    }

    const {
      recipient,
      recipients,
      campaignName,
      subject,
      body,
      scheduledAt,
      delaySeconds,
      hourlyLimit,
      senderAccountId
    } = validation.data;

    // Support both the legacy single-recipient request
    // and the new multiple-recipient request.
    const normalizedRecipients = [
      ...new Set(
        (recipients ?? (recipient ? [recipient] : []))
          .map((email) => email.trim().toLowerCase())
      )
    ];

    if (normalizedRecipients.length === 0) {
      return res.status(400).json({
        success: false,
        message: "At least one valid recipient is required"
      });
    }

    if (normalizedRecipients.length > 1000) {
      return res.status(400).json({
        success: false,
        message: "Maximum 1000 recipients per campaign"
      });
    }

    const scheduledTime = new Date(scheduledAt);
    const baseDelay = scheduledTime.getTime() - Date.now();

    if (baseDelay <= 0) {
      return res.status(400).json({
        success: false,
        message: "Scheduled time must be in the future"
      });
    }

    if (senderAccountId) {
      const senderResult = await client.query(
        `SELECT id
         FROM sender_accounts
         WHERE id = $1 AND is_active = TRUE`,
        [senderAccountId]
      );

      if (senderResult.rowCount === 0) {
        return res.status(400).json({
          success: false,
          message: "Selected sender account does not exist or is inactive"
        });
      }
    }

    const campaignId = randomUUID();

    // Create campaign and all email records in one PostgreSQL transaction.
    await client.query("BEGIN");
    transactionStarted = true;

    const campaignResult = await client.query(
      `INSERT INTO campaigns (
        id,
        name,
        subject,
        body,
        scheduled_at,
        sender_account_id,
        status,
        delay_seconds,
        hourly_limit,
        total_recipients
      )
      VALUES ($1, $2, $3, $4, $5, $6, 'scheduled', $7, $8, $9)
      RETURNING *`,
      [
        campaignId,
        campaignName ?? null,
        subject,
        body,
        scheduledTime,
        senderAccountId ?? null,
        delaySeconds,
        hourlyLimit ?? null,
        normalizedRecipients.length
      ]
    );

    const emails = [];

    for (const emailRecipient of normalizedRecipients) {
      const emailResult = await client.query(
        `INSERT INTO emails (
          recipient,
          subject,
          body,
          scheduled_at,
          status,
          campaign_id,
          sender_account_id
        )
        VALUES ($1, $2, $3, $4, 'scheduled', $5, $6)
        RETURNING *`,
        [
          emailRecipient,
          subject,
          body,
          scheduledTime,
          campaignId,
          senderAccountId ?? null
        ]
      );

      emails.push(emailResult.rows[0]);
    }

    await client.query("COMMIT");
    transactionStarted = false;
    
try {
  const documents: EmailSearchDocument[] = emails.map((email) => ({
    emailId: email.id,
    campaignId,
    campaignName: campaignName ?? null,
    recipient: email.recipient,
    subject: email.subject,
    body: email.body,
    status: email.status,
    scheduledAt: scheduledTime.toISOString(),
    sentAt: null,
    createdAt: new Date(email.created_at).toISOString()
  }));

  await bulkIndexEmails(documents);

  console.log(
    `Indexed ${documents.length} campaign emails in Elasticsearch.`
  );
} catch (indexError) {
  console.error(
    "Campaign created, but Elasticsearch indexing failed:",
    indexError
  );
}


    console.log(
      `Campaign ${campaignId} created with ${emails.length} recipients`
    );

    // Each recipient receives an independent BullMQ job.
    // Jobs are staggered according to delaySeconds.
    const queueResults = await Promise.allSettled(
      emails.map(async (email, index) => {
  const totalDelay =
    baseDelay + index * delaySeconds * 1000;

        const job = await emailQueue.add(
          "send-email",
          {
            emailId: email.id
          },
          {
            jobId: email.id,
            delay: totalDelay
          }
        );

        

        return {
          emailId: email.id,
          recipient: email.recipient,
          jobId: job.id,
          delayMs: totalDelay
        };
      })
    );

    const queuedEmails = [];
    const failedEmails = [];

    for (let i = 0; i < queueResults.length; i++) {
      const result = queueResults[i];

      if (result.status === "fulfilled") {
        queuedEmails.push(result.value);
      } else {
        const failedEmail = emails[i];
        const errorMessage =
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason);

        failedEmails.push({
          emailId: failedEmail.id,
          recipient: failedEmail.recipient,
          error: errorMessage
        });

        await pool.query(
          `UPDATE emails
           SET status = 'failed',
               error_message = $1,
               updated_at = NOW()
           WHERE id = $2 AND status = 'scheduled'`,
          [errorMessage, failedEmail.id]
        );
        try {
  await updateIndexedEmailStatus(failedEmail.id, "failed");
} catch (error) {
  console.error("Elasticsearch failure status update failed:", error);
}
        
      }
    }

    if (failedEmails.length > 0) {
      await pool.query(
        `UPDATE campaigns
         SET failed_count = $1,
             status = CASE
               WHEN $1 = total_recipients THEN 'failed'
               ELSE 'processing'
             END,
             updated_at = NOW()
         WHERE id = $2`,
        [failedEmails.length, campaignId]
      );
    }

    return res.status(queuedEmails.length > 0 ? 201 : 503).json({
      success: queuedEmails.length > 0,
      message:
        failedEmails.length === 0
          ? "Campaign scheduled successfully"
          : "Campaign created with some scheduling failures",
      campaign: campaignResult.rows[0],
      totalRecipients: normalizedRecipients.length,
      queuedCount: queuedEmails.length,
      failedCount: failedEmails.length,
      queuedEmails,
      failedEmails
    });
  } catch (error: unknown) {
    if (transactionStarted) {
      await client.query("ROLLBACK").catch(console.error);
    }

    console.error("SCHEDULE CAMPAIGN ERROR:", error);

    return res.status(500).json({
      success: false,
      message: "Could not schedule campaign"
    });
  } finally {
    client.release();
  }
};

// GET /api/emails
export const getAllEmails = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await pool.query(
      `SELECT * FROM emails ORDER BY created_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      emails: result.rows
    });
  } catch (error: unknown) {
    console.error("Get all emails error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch emails"
    });
  }
};

// GET /api/emails/scheduled
export const getScheduledEmails = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await pool.query(
      `SELECT * FROM emails
       WHERE status IN ('scheduled', 'processing')
       ORDER BY scheduled_at ASC`
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      emails: result.rows
    });
  } catch (error: unknown) {
    console.error("Get scheduled emails error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch scheduled emails"
    });
  }
};

// GET /api/emails/sent
export const getSentEmails = async (
  _req: Request,
  res: Response
): Promise<Response> => {
  try {
    const result = await pool.query(
      `SELECT * FROM emails
       WHERE status = 'sent'
       ORDER BY sent_at DESC`
    );

    return res.status(200).json({
      success: true,
      count: result.rowCount,
      emails: result.rows
    });
  } catch (error: unknown) {
    console.error("Get sent emails error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not fetch sent emails"
    });
  }
};

// DELETE /api/emails/:id
export const cancelEmail = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const id = Array.isArray(req.params.id)
  ? req.params.id[0]
  : req.params.id;

    if (!id) {
      return res.status(400).json({
        success: false,
        message: "Email ID is required"
      });
    }

    const result = await pool.query(
      `SELECT * FROM emails WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Email not found"
      });
    }

    const email = result.rows[0];

    if (email.status !== "scheduled") {
      return res.status(409).json({
        success: false,
        message: "Only scheduled emails can be cancelled"
      });
    }

    const jobId = email.queue_job_id || email.id;
    const job = await emailQueue.getJob(jobId);

    if (job) {
      const state = await job.getState();

      if (!["delayed", "waiting", "waiting-children"].includes(state)) {
        return res.status(409).json({
          success: false,
          message: "Email is already being processed"
        });
      }

      await job.remove();
    }

    const updateResult = await pool.query(
      `UPDATE emails
       SET status = 'cancelled',
           updated_at = NOW()
       WHERE id = $1 AND status = 'scheduled'
       RETURNING id`,
      [id]
    );

    if (updateResult.rowCount === 0) {
      return res.status(409).json({
        success: false,
        message: "Email status changed before cancellation completed"
      });
    }

    try {
  await updateIndexedEmailStatus(id, "cancelled");
} catch (error) {
  console.error("Elasticsearch cancellation update failed:", error);
}

    return res.status(200).json({
      success: true,
      message: "Email cancelled successfully"
    });
  } catch (error: unknown) {
    console.error("Cancel email error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not cancel email"
    });
  }
};


// GET /api/emails/search
export const searchEmailRecords = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const query = String(req.query.q ?? "").trim();
    const status = String(req.query.status ?? "").trim();
    const from = String(req.query.from ?? "").trim();
    const to = String(req.query.to ?? "").trim();

    const page = Math.max(
      1,
      Number.parseInt(String(req.query.page ?? "1"), 10) || 1
    );

    const limit = Math.min(
      100,
      Math.max(
        1,
        Number.parseInt(String(req.query.limit ?? "10"), 10) || 10
      )
    );

    const allowedStatuses = [
      "scheduled",
      "processing",
      "sent",
      "failed",
      "cancelled"
    ];

    if (status && !allowedStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email status"
      });
    }

    if (
      (from && Number.isNaN(Date.parse(from))) ||
      (to && Number.isNaN(Date.parse(to)))
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid date filter"
      });
    }

    if (from && to && new Date(from) > new Date(to)) {
      return res.status(400).json({
        success: false,
        message: "'from' date must be before 'to' date"
      });
    }

    const result = await searchEmails({
      query: query || undefined,
      status: status || undefined,
      from: from || undefined,
      to: to || undefined,
      page,
      limit
    });

    return res.status(200).json({
      success: true,
      ...result
    });

  } catch (error) {
    console.error("Email search error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not search emails"
    });
  }
};

