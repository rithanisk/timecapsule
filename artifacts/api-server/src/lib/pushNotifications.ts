import { and, eq, gt, isNull, lte, or } from "drizzle-orm";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import webpush from "web-push";
import { db, boothsTable, pushSubscriptionsTable } from "@workspace/db";
import { logger } from "./logger";

type StoredSubscription = {
  privateToken: string;
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
};

export function pushIsConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function encryptionKey(): Buffer {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is required to protect push subscription data.");
  return createHash("sha256").update(`timecapsule-push-v1:${secret}`).digest();
}

function encrypt(value: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value: string): string {
  const [iv, tag, ciphertext] = value.split(".");
  if (!iv || !tag || !ciphertext) throw new Error("Invalid encrypted push subscription.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function initializeWebPush(): void {
  if (!pushIsConfigured()) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

export async function storePushSubscription(
  boothId: string,
  slotId: string | null,
  accessTokenHash: string,
  privateToken: string,
  subscription: Omit<StoredSubscription, "privateToken">,
): Promise<void> {
  const stored: StoredSubscription = { ...subscription, privateToken };
  const encryptedPayload = encrypt(JSON.stringify(stored));
  const endpointHash = createHash("sha256").update(subscription.endpoint).digest("hex");
  const now = Date.now();
  const requestedExpiration =
    typeof subscription.expirationTime === "number" &&
    subscription.expirationTime > now
      ? subscription.expirationTime
      : now + 90 * 24 * 60 * 60 * 1000;
  const expiresAt = new Date(Math.min(requestedExpiration, now + 90 * 24 * 60 * 60 * 1000));

  await db
    .insert(pushSubscriptionsTable)
    .values({
      boothId,
      slotId,
      scopeTokenHash: accessTokenHash,
      endpointHash,
      encryptedPayload,
      expiresAt,
    })
    .onConflictDoUpdate({
      target: [pushSubscriptionsTable.boothId, pushSubscriptionsTable.endpointHash],
      set: {
        slotId,
        scopeTokenHash: accessTokenHash,
        encryptedPayload,
        expiresAt,
        deliveredAt: null,
      },
    });
}

export async function sendBoothReadyNotifications(
  boothId: string,
  boothName: string,
): Promise<void> {
  if (!pushIsConfigured()) return;
  initializeWebPush();
  const subscriptions = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(
      and(
        eq(pushSubscriptionsTable.boothId, boothId),
        isNull(pushSubscriptionsTable.deliveredAt),
        gt(pushSubscriptionsTable.expiresAt, new Date()),
      ),
    );

  for (const row of subscriptions) {
    if (!row.encryptedPayload || !row.endpointHash) continue;
    try {
      const claimed = await db.transaction(async (tx) => {
        const [current] = await tx
          .select()
          .from(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.id, row.id))
          .for("update");
        if (!current || current.deliveredAt || !current.encryptedPayload) return null;
        await tx
          .update(pushSubscriptionsTable)
          .set({ deliveredAt: new Date() })
          .where(eq(pushSubscriptionsTable.id, current.id));
        return current;
      });
      if (!claimed?.encryptedPayload) continue;
      const subscription = JSON.parse(decrypt(claimed.encryptedPayload)) as StoredSubscription;
      await webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          expirationTime: subscription.expirationTime ?? null,
          keys: subscription.keys,
        },
        JSON.stringify({
          title: "Your booth is ready ✦",
          body: `${boothName} is complete. Tap to watch the photostrip print.`,
          url: `/booth/${subscription.privateToken}/reveal`,
          tag: `timecapsule-ready-${boothId}`,
        }),
        { TTL: 60 * 60 * 24 * 7 },
      );
      await db
        .update(pushSubscriptionsTable)
        .set({
          endpointHash: null,
          encryptedPayload: null,
        })
        .where(eq(pushSubscriptionsTable.id, claimed.id));
    } catch (error) {
      const statusCode =
        typeof error === "object" &&
        error !== null &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
          ? error.statusCode
          : undefined;
      if (statusCode === 404 || statusCode === 410) {
        await db
          .delete(pushSubscriptionsTable)
          .where(eq(pushSubscriptionsTable.id, row.id));
      } else {
        await db
          .update(pushSubscriptionsTable)
          .set({ deliveredAt: null })
          .where(eq(pushSubscriptionsTable.id, row.id));
        logger.warn({ err: error }, "Could not deliver booth-ready notification");
      }
    }
  }
}

export async function processReadyBoothNotifications(): Promise<void> {
  if (!pushIsConfigured()) return;
  const now = new Date();
  const readyBooths = await db
    .select({ id: boothsTable.id, name: boothsTable.name })
    .from(boothsTable)
    .where(
      and(
        eq(boothsTable.status, "complete"),
        or(isNull(boothsTable.scheduledRevealAt), lte(boothsTable.scheduledRevealAt, now)),
      ),
    );
  for (const booth of readyBooths) {
    await sendBoothReadyNotifications(booth.id, booth.name);
  }
}
