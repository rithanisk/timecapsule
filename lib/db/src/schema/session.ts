import { index, json, pgTable, timestamp, varchar } from "drizzle-orm/pg-core";

// Matches the table used by connect-pg-simple for express-session.
export const sessionTable = pgTable("session", {
  sid: varchar("sid").primaryKey(),
  sess: json("sess").notNull(),
  expire: timestamp("expire", { precision: 6 }).notNull(),
}, (table) => [index("IDX_session_expire").on(table.expire)]);
