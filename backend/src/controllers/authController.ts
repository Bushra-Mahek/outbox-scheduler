
import type { Request, Response } from "express";
import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import pool from "../config/db.js";

const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID
);

export const googleLogin = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { credential } = req.body;

    if (!credential) {
      res.status(400).json({ message: "Google credential is required" });
      return;
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();

    if (!payload || !payload.sub || !payload.email) {
      res.status(401).json({ message: "Invalid Google account" });
      return;
    }

    if (!payload.email_verified) {
      res.status(401).json({ message: "Google email is not verified" });
      return;
    }

    const result = await pool.query(
      `INSERT INTO users (google_id, name, email, picture)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (google_id)
       DO UPDATE SET
         name = EXCLUDED.name,
         email = EXCLUDED.email,
         picture = EXCLUDED.picture,
         updated_at = NOW()
       RETURNING id, google_id, name, email, picture`,
      [
        payload.sub,
        payload.name || payload.email,
        payload.email,
        payload.picture || null
      ]
    );

    const user = result.rows[0];

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "7d" }
    );

    res.json({
      success: true,
      token,
      user
    });
  } catch (error) {
    console.error("Google login failed:", error);
    res.status(401).json({
      message: "Google authentication failed"
    });
  }
};
