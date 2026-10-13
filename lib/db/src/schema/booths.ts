import { relations } from "drizzle-orm";
import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boothsTable = pgTable(
  "booths",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    privateTokenHash: text("private_token_hash").notNull().unique(),
    creatorTokenHash: text("creator_token_hash").notNull(),
    name: text("name").notNull(),
    subtitle: text("subtitle").notNull().default(""),
    occasion: text("occasion").notNull().default(""),
    participantCount: integer("participant_count").notNull(),
    mode: text("mode").notNull(),
    layout: text("layout").notNull(),
    prompt: text("prompt").notNull(),
    countdownSeconds: integer("countdown_seconds").notNull(),
    photosPerPerson: integer("photos_per_person").notNull().default(1),
    revealMode: text("reveal_mode").notNull(),
    scheduledRevealAt: timestamp("scheduled_reveal_at", {
      withTimezone: true,
    }),
    status: text("status").notNull().default("collecting"),
    customization: jsonb("customization")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({
        mode: "classic",
        layout: "vertical",
        frameType: "clean",
        frameColor: "#FFFDF8",
        filter: "original",
        showDate: true,
        caption: "",
        objects: [],
      }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
);

export const boothSlotsTable = pgTable(
  "booth_slots",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    boothId: uuid("booth_id")
      .notNull()
      .references(() => boothsTable.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    displayName: text("display_name").notNull(),
    claimStatus: text("claim_status").notNull().default("open"),
    claimTokenHash: text("claim_token_hash"),
    pendingObjectPath: text("pending_object_path"),
    mediaPath: text("media_path"),
    width: integer("width"),
    height: integer("height"),
    captureSource: text("capture_source"),
    claimedAt: timestamp("claimed_at", { withTimezone: true }),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("booth_slots_booth_position_idx").on(table.boothId, table.position),
  ],
);

export const boothsRelations = relations(boothsTable, ({ many }) => ({
  slots: many(boothSlotsTable),
}));

export const boothSlotsRelations = relations(boothSlotsTable, ({ one }) => ({
  booth: one(boothsTable, {
    fields: [boothSlotsTable.boothId],
    references: [boothsTable.id],
  }),
}));

export const insertBoothSchema = createInsertSchema(boothsTable).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertBoothSlotSchema = createInsertSchema(boothSlotsTable).omit({
  id: true,
  claimedAt: true,
  submittedAt: true,
});

export type InsertBooth = z.infer<typeof insertBoothSchema>;
export type Booth = typeof boothsTable.$inferSelect;
export type InsertBoothSlot = z.infer<typeof insertBoothSlotSchema>;
export type BoothSlot = typeof boothSlotsTable.$inferSelect;
