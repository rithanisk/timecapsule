import { and, eq, lte } from "drizzle-orm";
import { boothSlotsTable, boothsTable, db } from "@workspace/db";
import { logger } from "./logger";
import { ObjectStorageService } from "./objectStorage";

const storage = new ObjectStorageService();

export async function purgeExpiredBooths(): Promise<void> {
  const expired = await db
    .select({ id: boothsTable.id })
    .from(boothsTable)
    .where(lte(boothsTable.expiresAt, new Date()))
    .limit(100);

  for (const booth of expired) {
    const slots = await db
      .select()
      .from(boothSlotsTable)
      .where(eq(boothSlotsTable.boothId, booth.id));
    const objectPaths = new Set(
      slots.flatMap((slot) => [slot.mediaPath, slot.pendingObjectPath].filter(Boolean) as string[]),
    );
    let mediaRemoved = true;
    for (const path of objectPaths) {
      try {
        const file = await storage.getObjectEntityFile(path);
        await file.delete({ ignoreNotFound: true });
      } catch (error) {
        mediaRemoved = false;
        logger.error({ err: error, boothId: booth.id }, "Could not purge expired booth media");
      }
    }
    if (!mediaRemoved) continue;
    await db
      .delete(boothsTable)
      .where(and(eq(boothsTable.id, booth.id), lte(boothsTable.expiresAt, new Date())));
  }
}
