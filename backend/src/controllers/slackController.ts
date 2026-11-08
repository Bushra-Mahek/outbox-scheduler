import type { Request, Response } from "express";
import { randomBytes } from "node:crypto";
import pool from "../config/db.js";
import type { AuthenticatedRequest } from "../middleware/authMiddleware.js";
import { encryptSlackToken } from "../utils/slackCrypto.js";

const getSlackConfig = () => {
  const clientId = process.env.SLACK_CLIENT_ID;
  const clientSecret = process.env.SLACK_CLIENT_SECRET;
  const redirectUri = process.env.SLACK_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error("Slack OAuth environment variables are missing.");
  }

  return { clientId, clientSecret, redirectUri };
};

export const connectSlack = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response | void> => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({
        success: false,
        message: "Authentication required."
      });
    }

    const { clientId, redirectUri } = getSlackConfig();
    const state = randomBytes(32).toString("hex");

    await pool.query(
      `DELETE FROM slack_oauth_states WHERE expires_at < NOW()`
    );

    await pool.query(
      `INSERT INTO slack_oauth_states (state, user_id, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '10 minutes')`,
      [state, req.user.userId]
    );

    const params = new URLSearchParams({
      client_id: clientId,
      scope: "chat:write,im:write",
      redirect_uri: redirectUri,
      state
    });

    return res.status(200).json({
  success: true,
  authorizationUrl:
    `https://slack.com/oauth/v2/authorize?${params.toString()}`
});
  } catch (error) {
    console.error("Slack connect error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not start Slack authorization."
    });
  }
};

export const slackCallback = async (
  req: Request,
  res: Response
): Promise<void> => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";

  try {
    const code = typeof req.query.code === "string"
      ? req.query.code
      : null;

    const state = typeof req.query.state === "string"
      ? req.query.state
      : null;

    if (!code || !state || req.query.error) {
      res.redirect(`${frontendUrl}/?slack=error`);
      return;
    }

    // Consume state exactly once and recover the authenticated user.
    const stateResult = await pool.query(
      `DELETE FROM slack_oauth_states
       WHERE state = $1
         AND expires_at > NOW()
       RETURNING user_id`,
      [state]
    );

    if (stateResult.rows.length === 0) {
      res.redirect(`${frontendUrl}/?slack=invalid_state`);
      return;
    }

    const userId = stateResult.rows[0].user_id;
    const { clientId, clientSecret, redirectUri } = getSlackConfig();

    const tokenResponse = await fetch(
      "https://slack.com/api/oauth.v2.access",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri
        })
      }
    );

    const slackData = await tokenResponse.json() as {
      ok: boolean;
      error?: string;
      access_token?: string;
      team?: { id?: string; name?: string };
      authed_user?: { id?: string };
      bot_user_id?: string;
    };

    if (
      !tokenResponse.ok ||
      !slackData.ok ||
      !slackData.access_token ||
      !slackData.team?.id ||
      !slackData.authed_user?.id
    ) {
      throw new Error(
        slackData.error || "Slack OAuth token exchange failed."
      );
    }

    const encryptedToken = encryptSlackToken(slackData.access_token);

    await pool.query(
      `INSERT INTO slack_connections (
         user_id,
         team_id,
         team_name,
         slack_user_id,
         bot_user_id,
         access_token_encrypted
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id)
       DO UPDATE SET
         team_id = EXCLUDED.team_id,
         team_name = EXCLUDED.team_name,
         slack_user_id = EXCLUDED.slack_user_id,
         bot_user_id = EXCLUDED.bot_user_id,
         access_token_encrypted = EXCLUDED.access_token_encrypted,
         updated_at = NOW()`,
      [
        userId,
        slackData.team.id,
        slackData.team.name || null,
        slackData.authed_user.id,
        slackData.bot_user_id || null,
        encryptedToken
      ]
    );

    res.redirect(`${frontendUrl}/?slack=connected`);
  } catch (error) {
    console.error("Slack OAuth callback error:", error);
    res.redirect(`${frontendUrl}/?slack=error`);
  }
};

export const getSlackStatus = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    const result = await pool.query(
      `SELECT team_id, team_name, created_at, updated_at
       FROM slack_connections
       WHERE user_id = $1`,
      [req.user!.userId]
    );

    return res.json({
      success: true,
      connected: result.rows.length > 0,
      connection: result.rows[0] || null
    });
  } catch (error) {
    console.error("Slack status error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not retrieve Slack connection status."
    });
  }
};

export const disconnectSlack = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<Response> => {
  try {
    await pool.query(
      `DELETE FROM slack_connections WHERE user_id = $1`,
      [req.user!.userId]
    );

    return res.json({
      success: true,
      message: "Slack disconnected successfully."
    });
  } catch (error) {
    console.error("Slack disconnect error:", error);

    return res.status(500).json({
      success: false,
      message: "Could not disconnect Slack."
    });
  }
};