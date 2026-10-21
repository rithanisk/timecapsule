import { pool } from "@workspace/db";
import { logger } from "./logger";

// Bootstrap an empty database, repair known legacy columns, and remove the
// obsolete push subscription table. Booth and user rows are preserved.
export async function runMigrations() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        display_name TEXT NOT NULL,
        home_strip_booth_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);

    // connect-pg-simple normally creates this table on its first session
    // query. Create it during startup so an unused development session store
    // still has the schema needed by the publish comparison.
    await client.query(`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    await client.query(`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS booths (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        private_token_hash TEXT NOT NULL,
        creator_token_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        subtitle TEXT NOT NULL DEFAULT '',
        occasion TEXT NOT NULL DEFAULT '',
        participant_count INTEGER NOT NULL,
        mode TEXT NOT NULL,
        layout TEXT NOT NULL,
        prompt TEXT NOT NULL,
        countdown_seconds INTEGER NOT NULL,
        photos_per_person INTEGER NOT NULL DEFAULT 1,
        reveal_mode TEXT NOT NULL,
        scheduled_reveal_at TIMESTAMPTZ,
        status TEXT NOT NULL DEFAULT 'collecting',
        user_id UUID,
        customization JSONB NOT NULL DEFAULT '{"mode":"classic","filter":"original","layout":"vertical","caption":"","objects":[],"showDate":true,"frameType":"clean","frameColor":"#FFFDF8"}'::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        completed_at TIMESTAMPTZ,
        expires_at TIMESTAMPTZ,
        CONSTRAINT booths_private_token_hash_unique UNIQUE (private_token_hash)
      )
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS booth_slots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        booth_id UUID NOT NULL,
        position INTEGER NOT NULL,
        display_name TEXT NOT NULL,
        claim_status TEXT NOT NULL DEFAULT 'open',
        claim_token_hash TEXT,
        pending_object_path TEXT,
        media_path TEXT,
        width INTEGER,
        height INTEGER,
        capture_source TEXT,
        claimed_at TIMESTAMPTZ,
        submitted_at TIMESTAMPTZ,
        CONSTRAINT booth_slots_booth_id_booths_id_fk
          FOREIGN KEY (booth_id) REFERENCES booths (id) ON DELETE CASCADE
      )
    `);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS booth_slots_booth_position_idx
      ON booth_slots (booth_id, position)
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS user_booth_access (
        user_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        booth_id UUID NOT NULL REFERENCES booths (id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        PRIMARY KEY (user_id, booth_id)
      )
    `);

    await client.query(`
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS home_strip_booth_ids JSONB NOT NULL DEFAULT '[]'::jsonb
    `);
    await client.query(`
      ALTER TABLE booths ADD COLUMN IF NOT EXISTS user_id UUID
    `);
    await client.query(`
      ALTER TABLE booths
      ADD COLUMN IF NOT EXISTS photos_per_person INTEGER NOT NULL DEFAULT 1
    `);
    await client.query(`
      ALTER TABLE booths ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ
    `);
    await client.query(`
      ALTER TABLE booths ALTER COLUMN expires_at DROP NOT NULL
    `);

    // Push delivery was removed. The old table contains only obsolete
    // subscription credentials and has no remaining application references.
    await client.query("DROP TABLE IF EXISTS push_subscriptions");

    await client.query("COMMIT");
    logger.info("Database bootstrap applied");
  } catch (err) {
    await client.query("ROLLBACK");
    logger.error({ err }, "Database bootstrap failed");
    throw err;
  } finally {
    client.release();
  }
}
