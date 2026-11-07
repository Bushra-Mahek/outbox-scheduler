import "dotenv/config";
import app from "./app.js";
import pool from "./config/db.js";
import { createRedisConnection } from "./config/redis.js";

const PORT = Number(process.env.PORT) || 5000;

const redis = createRedisConnection();

const startServer = async (): Promise<void> => {
  try {
    // Verify PostgreSQL connection
    await pool.query("SELECT 1");
    console.log("PostgreSQL connected successfully.");

    // Verify Redis connection
    await redis.ping();
    console.log("Redis connected successfully.");

    const server = app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });

    const shutdown = async (signal: string): Promise<void> => {
      console.log(`${signal} received. Shutting down server...`);

      server.close(async () => {
        try {
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

    process.on("SIGINT", () => void shutdown("SIGINT"));
    process.on("SIGTERM", () => void shutdown("SIGTERM"));

  } catch (error) {
    console.error("Server startup failed:", error);

    await pool.end().catch(() => undefined);
    await redis.quit().catch(() => undefined);

    process.exit(1);
  }
};

void startServer();