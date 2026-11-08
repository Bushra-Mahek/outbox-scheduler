import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
  };
}

export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Authentication required."
    });
  }

  const secret = process.env.JWT_SECRET;

  if (!secret) {
    return res.status(500).json({
      success: false,
      message: "Authentication is not configured."
    });
  }

  try {
    const decoded = jwt.verify(token, secret) as {
      userId: string;
      email: string;
    };

    if (!decoded.userId || !decoded.email) {
      return res.status(401).json({
        success: false,
        message: "Invalid authentication token."
      });
    }

    req.user = {
      userId: decoded.userId,
      email: decoded.email
    };

    next();
  } catch {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token."
    });
  }
};