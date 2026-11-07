
import pool from "./db.js";

try {
    const result = await pool.query("SELECT NOW()");
    console.log("PostgreSQL connected successfully!");
    console.log(result.rows[0]);
} catch (error) {
    console.error("Database connection failed:", error);
} finally {
    await pool.end();
}
