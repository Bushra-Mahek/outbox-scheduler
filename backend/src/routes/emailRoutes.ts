
import express from "express";

import {
  scheduleEmail,
  getAllEmails,
  getScheduledEmails,
  getSentEmails,
  cancelEmail,
  searchEmailRecords
} from "../controllers/emailController.js";

const router = express.Router();

// Create campaign
router.post("/", scheduleEmail);

// Search emails - keep this before any dynamic ID routes
router.get("/search", searchEmailRecords);

// Fetch emails
router.get("/", getAllEmails);
router.get("/scheduled", getScheduledEmails);
router.get("/sent", getSentEmails);

// Cancel scheduled email
router.delete("/:id", cancelEmail);

export default router;
