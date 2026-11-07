
import pool from "../config/db.js";
import { bulkIndexEmails, type EmailSearchDocument } from "./searchService.js";

export const synchronizeEmailIndex = async (): Promise<void> => {
  const result = await pool.query(`
    SELECT
      e.id,
      e.campaign_id,
      c.name AS campaign_name,
      e.recipient,
      e.subject,
      e.body,
      e.status,
      e.scheduled_at,
      e.sent_at,
      e.created_at
    FROM emails e
    LEFT JOIN campaigns c ON c.id = e.campaign_id
    ORDER BY e.created_at ASC
  `);

  const emails: EmailSearchDocument[] = result.rows.map((row) => ({
    emailId: row.id,
    campaignId: row.campaign_id,
    campaignName: row.campaign_name,
    recipient: row.recipient,
    subject: row.subject,
    body: row.body,
    status: row.status,
    scheduledAt: new Date(row.scheduled_at).toISOString(),
    sentAt: row.sent_at
      ? new Date(row.sent_at).toISOString()
      : null,
    createdAt: new Date(row.created_at).toISOString()
  }));

  await bulkIndexEmails(emails);

  console.log(
    `Elasticsearch synchronized: ${emails.length} email records indexed.`
  );
};
