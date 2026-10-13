import { pool } from "@workspace/db";
import { logger } from "./logger";

export async function runAuthMigrations() {
  const client = await pool.connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE booths ADD COLUMN user_id UUID;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);
    await client.query(`
      DO $$ BEGIN
        ALTER TABLE booths ADD COLUMN photos_per_person INTEGER NOT NULL DEFAULT 1;
      EXCEPTION WHEN duplicate_column THEN NULL;
      END $$
    `);
    logger.info("Auth migrations applied");
  } catch (err) {
    logger.error({ err }, "Auth migration failed (non-fatal)");
  } finally {
    client.release();
  }
}
