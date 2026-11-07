
import { z } from "zod";
import pool from "../config/db.js";
import { emailQueue } from "../queues/emailQueue.js";

// Email request validation
const emailSchema = z.object({
    recipient: z.string().email(),
    subject: z.string().trim().min(1).max(500),
    body: z.string().min(1),
    scheduledAt: z.string().datetime({ offset: true })
});

// POST /api/emails
export const scheduleEmail = async (req, res) => {

    // DEBUG 1: Confirm controller is reached
    console.log("\n========== SCHEDULE EMAIL REQUEST ==========");
    console.log("Controller HIT!");
    console.log("Request body:", req.body);

    try {
        // STEP 1: Validate incoming request
        const validation = emailSchema.safeParse(req.body);

        console.log("Validation successful:", validation.success);

        if (!validation.success) {
            console.log("Validation errors:", validation.error.issues);

            return res.status(400).json({
                success: false,
                message: "Invalid email details",
                errors: validation.error.issues
            });
        }

        const { recipient, subject, body, scheduledAt } =
            validation.data;

        // STEP 2: Calculate scheduling delay
        const scheduledTime = new Date(scheduledAt);
        const delay = scheduledTime.getTime() - Date.now();

        console.log("Server time:", new Date().toString());
        console.log("Scheduled time:", scheduledTime.toString());
        console.log("Delay in milliseconds:", delay);

        if (delay <= 0) {
            console.log("ERROR: Scheduled time is in the past.");

            return res.status(400).json({
                success: false,
                message: "Scheduled time must be in the future"
            });
        }

        // STEP 3: Save email record in PostgreSQL
        console.log("Inserting email into PostgreSQL...");

        const result = await pool.query(
            `INSERT INTO emails
                (recipient, subject, body, scheduled_at, status)
             VALUES ($1, $2, $3, $4, 'scheduled')
             RETURNING *`,
            [recipient, subject, body, scheduledTime]
        );

        const email = result.rows[0];

        console.log("PostgreSQL insertion successful!");
        console.log("Email ID:", email.id);

        // STEP 4: Create delayed job in BullMQ
        let job;

        try {
            console.log("Adding job to BullMQ...");

            job = await emailQueue.add(
                "send-email",
                {
                    emailId: email.id
                },
                {
                    jobId: email.id,
                    delay
                }
            );

            console.log("BullMQ job created successfully!");
            console.log("Job ID:", job.id);

        } catch (queueError) {
            console.error("BullMQ insertion failed:", queueError);

            await pool.query(
                `UPDATE emails
                 SET status = 'failed',
                     error_message = $1,
                     updated_at = NOW()
                 WHERE id = $2`,
                [
                    `Queue insertion failed: ${queueError.message}`,
                    email.id
                ]
            );

            return res.status(503).json({
                success: false,
                message: "Email saved, but scheduling failed",
                emailId: email.id
            });
        }

        // STEP 5: Save BullMQ job ID in PostgreSQL
        try {
            const updated = await pool.query(
                `UPDATE emails
                 SET queue_job_id = $1,
                     updated_at = NOW()
                 WHERE id = $2
                 RETURNING *`,
                [job.id, email.id]
            );

            console.log("Job ID saved in PostgreSQL!");
            console.log("========== SCHEDULING COMPLETE ==========\n");

            return res.status(201).json({
                success: true,
                message: "Email scheduled successfully",
                email: updated.rows[0]
            });

        } catch (dbError) {
            console.error("Job queued but metadata update failed:", dbError);

            return res.status(202).json({
                success: true,
                message: "Job queued; database metadata needs reconciliation",
                emailId: email.id,
                jobId: job.id
            });
        }

    } catch (error) {
        console.error("SCHEDULE EMAIL ERROR:", error);

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });
    }
};

// GET /api/emails
export const getAllEmails = async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM emails ORDER BY created_at DESC`
        );

        return res.status(200).json({
            success: true,
            count: result.rowCount,
            emails: result.rows
        });

    } catch (error) {
        console.error("Get all emails error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not fetch emails"
        });
    }
};

// GET /api/emails/scheduled
export const getScheduledEmails = async (req, res) => {
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

    } catch (error) {
        console.error("Get scheduled emails error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not fetch scheduled emails"
        });
    }
};

// GET /api/emails/sent
export const getSentEmails = async (req, res) => {
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

    } catch (error) {
        console.error("Get sent emails error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not fetch sent emails"
        });
    }
};

// DELETE /api/emails/:id
export const cancelEmail = async (req, res) => {
    try {
        const { id } = req.params;

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

        const job = await emailQueue.getJob(email.queue_job_id);

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

        await pool.query(
            `UPDATE emails
             SET status = 'cancelled',
                 updated_at = NOW()
             WHERE id = $1 AND status = 'scheduled'`,
            [id]
        );

        return res.status(200).json({
            success: true,
            message: "Email cancelled successfully"
        });

    } catch (error) {
        console.error("Cancel email error:", error);

        return res.status(500).json({
            success: false,
            message: "Could not cancel email"
        });
    }
};
