import { pgTable, primaryKey, timestamp, uuid } from "drizzle-orm/pg-core";
import { boothsTable } from "./booths";
import { usersTable } from "./users";

export const userBoothAccessTable = pgTable("user_booth_access", {
  userId: uuid("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  boothId: uuid("booth_id").notNull().references(() => boothsTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [primaryKey({ columns: [table.userId, table.boothId] })]);
