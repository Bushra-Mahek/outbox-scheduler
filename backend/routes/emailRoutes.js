
import express from "express";
import { scheduleEmail } from "../controllers/emailController.js";

const router = express.Router();

router.post("/", scheduleEmail);

export default router;
