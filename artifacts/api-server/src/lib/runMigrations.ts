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
    await client.query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS home_strip_booth_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await client.query(`
      CREATE TABLE IF NOT EXISTS user_booth_access (
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        booth_id UUID NOT NULL REFERENCES booths(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, booth_id)
      )
    `);
    await client.query(`
      ALTER TABLE booths ALTER COLUMN expires_at DROP NOT NULL
    `);
    logger.info("Auth migrations applied");
  } catch (err) {
    logger.error({ err }, "Database migration failed");
    throw err;
  } finally {
    client.release();
  }
}
