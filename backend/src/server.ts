
import "dotenv/config";

import app from "./app.js";
import pool from "./config/db.js";
import { initializeElasticsearch } from "./config/elasticsearch.js";
import { createRedisConnection } from "./config/redis.js";
import { emailQueue } from "./queues/emailQueue.js";
import { synchronizeEmailIndex } from "./services/emailIndexSync.js";

const PORT = Number(process.env.PORT) || 5000;

const redis = createRedisConnection();

const startServer = async (): Promise<void> => {
  try {
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected successfully.");

    await redis.ping();
    console.log("Redis connected successfully.");

    await initializeElasticsearch();
    await synchronizeEmailIndex();
    
    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(
        `Bull Board dashboard: http://localhost:${PORT}/admin/queues`
      );
    });

    let shuttingDown = false;

    const shutdown = async (signal: string): Promise<void> => {
      if (shuttingDown) return;
      shuttingDown = true;

      console.log(`${signal} received. Shutting down server...`);

      server.close(async () => {
        try {
          await emailQueue.close();
          await pool.end();
          await redis.quit();

          console.log("Server shut down successfully.");
          process.exit(0);
        } catch (error) {
          console.error("Error during shutdown:", error);
          process.exit(1);
        }
      });
    };

    process.once("SIGINT", () => void shutdown("SIGINT"));
    process.once("SIGTERM", () => void shutdown("SIGTERM"));

  } catch (error) {
    console.error("Server startup failed:", error);

    await emailQueue.close().catch(() => undefined);
    await pool.end().catch(() => undefined);
    await redis.quit().catch(() => undefined);

    process.exit(1);
  }
};

void startServer();
