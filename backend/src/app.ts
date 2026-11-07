
import express from "express";
import cors from "cors";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import emailRoutes from "./routes/emailRoutes.js";
import { emailQueue } from "./queues/emailQueue.js";

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173"
  })
);

app.use(express.json());

// Bull Board configuration
const serverAdapter = new ExpressAdapter();

serverAdapter.setBasePath("/admin/queues");

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter
});

// Queue monitoring dashboard
app.use("/admin/queues", serverAdapter.getRouter());

app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "Server is running"
  });
});

app.use("/api/emails", emailRoutes);

export default app;
