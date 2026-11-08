import express from "express";
import {
  connectSlack,
  slackCallback,
  getSlackStatus,
  disconnectSlack
} from "../controllers/slackController.js";
import { authenticateToken } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/connect", authenticateToken, connectSlack);
router.get("/callback", slackCallback);
router.get("/status", authenticateToken, getSlackStatus);
router.delete("/disconnect", authenticateToken, disconnectSlack);

export default router;