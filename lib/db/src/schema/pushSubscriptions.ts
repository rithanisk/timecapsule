import { relations } from "drizzle-orm";
import {
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { boothSlotsTable, boothsTable } from "./booths";

// Legacy table retained in the schema so Replit does not propose dropping
// existing production data. The application no longer uses push notifications.
export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boothId: uuid("booth_id")
      .notNull()
      .references(() => boothsTable.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id").references(() => boothSlotsTable.id, {
      onDelete: "set null",
    }),
    scopeTokenHash: text("scope_token_hash").notNull(),
    endpointHash: text("endpoint_hash"),
    encryptedPayload: text("encrypted_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("push_subscriptions_booth_endpoint_idx").on(
      table.boothId,
      table.endpointHash,
    ),
  ],
);

export const pushSubscriptionsRelations = relations(
  pushSubscriptionsTable,
  ({ one }) => ({
    booth: one(boothsTable, {
      fields: [pushSubscriptionsTable.boothId],
      references: [boothsTable.id],
    }),
  }),
);
