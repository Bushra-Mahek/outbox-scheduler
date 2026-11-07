
import express from "express";

import {
  scheduleEmail,
  getAllEmails,
  getScheduledEmails,
  getSentEmails,
  cancelEmail
} from "../controllers/emailController.js";

const router = express.Router();

router.post("/", scheduleEmail);

router.get("/", getAllEmails);
router.get("/scheduled", getScheduledEmails);
router.get("/sent", getSentEmails);

router.delete("/:id", cancelEmail);

export default router;
