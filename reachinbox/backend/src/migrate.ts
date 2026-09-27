// Simple one-file migration runner. Run with: npm run migrate
import fs from "fs";
import path from "path";
import { pool } from "./db";

async function migrate() {
  const sql = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  await pool.query("CREATE EXTENSION IF NOT EXISTS pgcrypto;"); // needed for gen_random_uuid()
  await pool.query(sql);
  console.log("✅ Migration complete. Tables are ready.");
  process.exit(0);
}

migrate().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
