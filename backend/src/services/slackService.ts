import pool from "../config/db.js";
import { decryptSlackToken } from "../utils/slackCrypto.js";

interface SlackApiResponse {
  ok: boolean;
  error?: string;
  channel?: {
    id: string;
  };
}

const slackApi = async (
  method: string,
  token: string,
  body: Record<string, unknown>
): Promise<SlackApiResponse> => {
  const response = await fetch(
    `https://slack.com/api/${method}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=utf-8"
      },
      body: JSON.stringify(body)
    }
  );

  if (!response.ok) {
    throw new Error(`Slack API HTTP error: ${response.status}`);
  }

  return response.json() as Promise<SlackApiResponse>;
};

export const sendHourlyLimitNotification = async (
  campaignId: string,
  waitMs: number
): Promise<void> => {
  const connectionResult = await pool.query(
    `SELECT
       c.user_id,
       c.name AS campaign_name,
       s.access_token_encrypted,
       s.slack_user_id
     FROM campaigns c
     JOIN slack_connections s ON s.user_id = c.user_id
     WHERE c.id = $1`,
    [campaignId]
  );

  // No Slack connection: don't mark the event as sent.
  // A later limit event can notify after the user reconnects.
  if (connectionResult.rows.length === 0) {
    return;
  }

  const connection = connectionResult.rows[0];

  const eventResult = await pool.query(
    `INSERT INTO slack_notification_events (
       user_id,
       campaign_id,
       event_type
     )
     VALUES ($1, $2, 'hourly_limit_reached')
     ON CONFLICT (user_id, campaign_id, event_type)
     DO NOTHING
     RETURNING id`,
    [connection.user_id, campaignId]
  );

  // One notification per campaign limit event.
  if (eventResult.rowCount === 0) {
    return;
  }

  try {
    const token = decryptSlackToken(
      connection.access_token_encrypted
    );

    const conversation = await slackApi(
      "conversations.open",
      token,
      { users: connection.slack_user_id }
    );

    if (!conversation.ok || !conversation.channel?.id) {
      throw new Error(
        conversation.error || "Could not open Slack DM."
      );
    }

    const minutes = Math.max(1, Math.ceil(waitMs / 60000));

    const message = await slackApi(
      "chat.postMessage",
      token,
      {
        channel: conversation.channel.id,
        text:
          `:warning: *Outbox Scheduler: hourly sending limit reached*\n` +
          `Campaign: ${connection.campaign_name || campaignId}\n` +
          `Sending will resume after approximately ${minutes} minute(s).`
      }
    );

    if (!message.ok) {
      throw new Error(
        message.error || "Could not send Slack notification."
      );
    }
  } catch (error) {
    // Allow a later retry if Slack is temporarily unavailable.
    await pool.query(
      `DELETE FROM slack_notification_events
       WHERE user_id = $1
         AND campaign_id = $2
         AND event_type = 'hourly_limit_reached'`,
      [connection.user_id, campaignId]
    );

    throw error;
  }
};