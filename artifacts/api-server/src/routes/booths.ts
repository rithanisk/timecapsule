import { and, asc, eq, gte, inArray, lt } from "drizzle-orm";
import { Router, type IRouter, type Request } from "express";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import sharp from "sharp";
import {
  ClaimBoothSlotBody,
  ClaimBoothSlotParams,
  ClaimBoothSlotResponse,
  ConfirmBoothFrameBody,
  ConfirmBoothFrameHeader,
  ConfirmBoothFrameParams,
  ConfirmBoothFrameResponse,
  CreateBoothBody,
  CreateBoothResponse,
  DeleteBoothHeader,
  DeleteBoothParams,
  GetBoothParams,
  GetBoothResponse,
  RequestFrameUploadBody,
  RequestFrameUploadHeader,
  RequestFrameUploadParams,
  RequestFrameUploadResponse,
  SaveBoothCustomizationBody,
  SaveBoothCustomizationHeader,
  SaveBoothCustomizationParams,
  SaveBoothCustomizationResponse,
  SubscribeToBoothReadyBody,
  SubscribeToBoothReadyHeader,
  SubscribeToBoothReadyParams,
  SubscribeToBoothReadyResponse,
} from "@workspace/api-zod";
import {
  boothSlotsTable,
  boothsTable,
  userBoothAccessTable,
  db,
} from "@workspace/db";
import { ObjectStorageService } from "../lib/objectStorage";
import {
  pushIsConfigured,
  sendBoothReadyNotifications,
  storePushSubscription,
} from "../lib/pushNotifications";

const router: IRouter = Router();
const storage = new ObjectStorageService();
const MAX_IMAGE_BYTES = 12_000_000;
const ALLOWED_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Private links grant viewing and identify a participant or creator, but a
// signed-in account is required before any booth data is changed.
router.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD" && !req.session.userId) {
    res.status(401).json({ error: "Sign in to save changes to a timecapsule." });
    return;
  }
  next();
});

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function createToken(): string {
  return randomBytes(32).toString("base64url");
}

function tokenMatches(candidate: string | undefined, expectedHash: string | null): boolean {
  if (!candidate || !expectedHash) return false;
  const candidateHash = Buffer.from(tokenHash(candidate), "hex");
  const storedHash = Buffer.from(expectedHash, "hex");
  return candidateHash.length === storedHash.length && timingSafeEqual(candidateHash, storedHash);
}

function getHeader(req: Request, name: string): string | undefined {
  return req.get(name) ?? undefined;
}

async function findBooth(privateToken: string) {
  const [booth] = await db
    .select()
    .from(boothsTable)
    .where(eq(boothsTable.privateTokenHash, tokenHash(privateToken)))
    .limit(1);
  return booth;
}

export async function buildBoothState(booth: NonNullable<Awaited<ReturnType<typeof findBooth>>>, privateToken: string, photoUrlForSlot?: (slotId: string) => string) {
  const slots = await db
    .select()
    .from(boothSlotsTable)
    .where(eq(boothSlotsTable.boothId, booth.id))
    .orderBy(asc(boothSlotsTable.position));
  const allSubmitted =
    slots.length === booth.participantCount &&
    slots.every((slot) => slot.claimStatus === "submitted" && Boolean(slot.mediaPath));
  const revealAvailable =
    allSubmitted &&
    (!booth.scheduledRevealAt || new Date() >= booth.scheduledRevealAt);
  const state = {
    name: booth.name,
    subtitle: booth.subtitle,
    occasion: booth.occasion,
    participantCount: booth.participantCount,
    mode: booth.mode,
    layout: booth.layout,
    prompt: booth.prompt,
    countdownSeconds: booth.countdownSeconds,
    photosPerPerson: booth.photosPerPerson ?? 1,
    revealMode: booth.revealMode,
    scheduledRevealAt: booth.scheduledRevealAt?.toISOString() ?? null,
    status: revealAvailable ? "revealed" : allSubmitted ? "complete" : "collecting",
    completedCount: slots.filter((slot) => slot.claimStatus === "submitted").length,
    revealAvailable,
    slots: slots.map((slot) => ({
      id: slot.id,
      position: slot.position,
      displayName: slot.displayName || `Open slot ${slot.position + 1}`,
      claimStatus: slot.claimStatus,
      photoUrl:
        revealAvailable && slot.mediaPath
          ? photoUrlForSlot?.(slot.id) ?? `/api/booths/${privateToken}/slots/${slot.id}/photo`
          : null,
    })),
    customization: booth.customization,
  };
  return GetBoothResponse.parse(state);
}

function getPrivateToken(req: Request): string {
  const value = req.params.privateToken;
  return Array.isArray(value) ? value[0] : value;
}

function getSlotId(req: Request): string {
  const value = req.params.slotId;
  return Array.isArray(value) ? value[0] : value;
}

router.post("/booths", async (req, res): Promise<void> => {
  const parsed = CreateBoothBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const input = parsed.data;
  const photosPerPerson = input.photosPerPerson ?? 1;
  if (input.slots.length !== input.participantCount) {
    res.status(400).json({ error: "Add one slot name for each participant." });
    return;
  }
  if (input.revealMode === "scheduled" && !input.scheduledRevealAt) {
    res.status(400).json({ error: "Choose a reveal time for a scheduled booth." });
    return;
  }

  const privateToken = createToken();
  const creatorToken = createToken();
  const customization = {
    mode: input.mode,
    layout: input.layout,
    frameType: "clean",
    frameColor: "#FFFDF8",
    filter: "original",
    showDate: true,
    caption: "",
    objects: [],
  };

  try {
    const booth = await db.transaction(async (tx) => {
      const boothValues: Record<string, unknown> = {
        privateTokenHash: tokenHash(privateToken),
        creatorTokenHash: tokenHash(creatorToken),
        name: input.name.trim(),
        subtitle: input.subtitle?.trim() ?? "",
        occasion: input.occasion?.trim() ?? "",
        participantCount: input.participantCount * photosPerPerson,
        mode: input.mode,
        layout: input.layout,
        prompt: input.prompt,
        countdownSeconds: input.countdownSeconds,
        revealMode: input.revealMode,
        scheduledRevealAt: input.scheduledRevealAt ? new Date(input.scheduledRevealAt) : null,
        status: "collecting",
        customization,
        userId: req.session.userId,
      };
      // Only include photosPerPerson if > 1 to avoid errors on DBs without the column
      if (photosPerPerson > 1) boothValues.photosPerPerson = photosPerPerson;
      const [createdBooth] = await tx
        .insert(boothsTable)
        .values(boothValues as typeof boothsTable.$inferInsert)
        .returning();
      const slotValues: Array<{ boothId: string; position: number; displayName: string; claimStatus: string }> = [];
      let pos = 0;
      for (const displayName of input.slots) {
        for (let p = 0; p < photosPerPerson; p++) {
          slotValues.push({ boothId: createdBooth.id, position: pos++, displayName: displayName.trim(), claimStatus: "open" });
        }
      }
      await tx.insert(boothSlotsTable).values(slotValues);
      return createdBooth;
    });

    const response = CreateBoothResponse.parse({
      privateToken,
      creatorToken,
      state: await buildBoothState(booth, privateToken),
    });
    res.status(201).json(response);
  } catch (error) {
    req.log.error({ err: error }, "Failed to create booth");
    res.status(500).json({ error: "The booth could not be created. Try again." });
  }
});

router.get("/booths/:privateToken", async (req, res): Promise<void> => {
  const params = GetBoothParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid invitation link." });
    return;
  }
  try {
    const booth = await findBooth(params.data.privateToken);
    if (!booth || booth.status === "deleted") {
      res.status(404).json({ error: "This booth could not be found." });
      return;
    }
    res.json(await buildBoothState(booth, params.data.privateToken));
  } catch (error) {
    req.log.error({ err: error }, "Failed to load booth");
    res.status(500).json({ error: "The booth could not be loaded. Try again." });
  }
});

router.post("/booths/:privateToken/slots/claim", async (req, res): Promise<void> => {
  const params = ClaimBoothSlotParams.safeParse(req.params);
  const body = ClaimBoothSlotBody.safeParse(req.body);
  if (!params.success || !body.success) {
    res.status(400).json({ error: "Choose a valid participant slot." });
    return;
  }
  const booth = await findBooth(params.data.privateToken);
  if (!booth) {
    res.status(404).json({ error: "This booth is no longer available." });
    return;
  }

  const participantToken = createToken();
  try {
    const slot = await db.transaction(async (tx) => {
      const [lockedBooth] = await tx
        .select({ id: boothsTable.id })
        .from(boothsTable)
        .where(eq(boothsTable.id, booth.id))
        .for("update");
      if (!lockedBooth) return null;

      const filters = [
        eq(boothSlotsTable.boothId, booth.id),
        eq(boothSlotsTable.claimStatus, "open"),
      ];
      if (body.data.slotId) {
        filters.push(eq(boothSlotsTable.id, body.data.slotId));
      }
      const [available] = await tx
        .select()
        .from(boothSlotsTable)
        .where(and(...filters))
        .orderBy(asc(boothSlotsTable.position))
        .limit(1)
        .for("update");
      if (!available) return null;

      const assignedName = available.displayName.trim();
      if (assignedName && assignedName.toLowerCase() !== body.data.displayName.trim().toLowerCase()) {
        return "named-slot-mismatch" as const;
      }
      const finalName = assignedName || body.data.displayName.trim();
      const hash = tokenHash(participantToken);

      // Each participant owns one contiguous group, even when names repeat.
      const groupStart = Math.floor(available.position / booth.photosPerPerson) * booth.photosPerPerson;
      const groupSlots = await tx
        .select()
        .from(boothSlotsTable)
        .where(and(
          eq(boothSlotsTable.boothId, booth.id),
          eq(boothSlotsTable.claimStatus, "open"),
        ))
        .orderBy(asc(boothSlotsTable.position))
        .for("update");

      const slotIds = groupSlots
        .filter((s) => s.position >= groupStart && s.position < groupStart + booth.photosPerPerson)
        .map((s) => s.id);
      if (slotIds.length !== booth.photosPerPerson) return null;
      for (const sid of slotIds) {
        await tx
          .update(boothSlotsTable)
          .set({ displayName: finalName, claimStatus: "claimed", claimTokenHash: hash, claimedAt: new Date() })
          .where(eq(boothSlotsTable.id, sid));
      }
      if (req.session.userId) {
        await tx.insert(userBoothAccessTable).values({ userId: req.session.userId, boothId: booth.id }).onConflictDoNothing();
      }
      return { ...available, id: available.id, displayName: finalName };
    });

    if (slot === "named-slot-mismatch") {
      res.status(403).json({ error: "Choose the slot with your name." });
      return;
    }
    if (!slot) {
      res.status(409).json({ error: "That slot is taken. Choose another available slot." });
      return;
    }

    res.json(
      ClaimBoothSlotResponse.parse({
        slotId: slot.id,
        displayName: slot.displayName,
        participantToken,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to claim participant slot");
    res.status(500).json({ error: "The slot could not be claimed. Try again." });
  }
});

router.post(
  "/booths/:privateToken/slots/:slotId/upload-url",
  async (req, res): Promise<void> => {
    const params = RequestFrameUploadParams.safeParse(req.params);
    const headers = RequestFrameUploadHeader.safeParse({
      "X-Participant-Token": getHeader(req, "X-Participant-Token"),
    });
    const body = RequestFrameUploadBody.safeParse(req.body);
    if (!params.success || !headers.success || !body.success) {
      res.status(400).json({ error: "Invalid upload request." });
      return;
    }
    if (body.data.size > MAX_IMAGE_BYTES || !ALLOWED_IMAGE_TYPES.has(body.data.contentType)) {
      res.status(413).json({ error: "Choose a JPEG, PNG, or WebP image under 12 MB." });
      return;
    }

    const booth = await findBooth(params.data.privateToken);
    if (!booth) {
      res.status(404).json({ error: "This booth is no longer available." });
      return;
    }
    const [slot] = await db
      .select()
      .from(boothSlotsTable)
      .where(
        and(
          eq(boothSlotsTable.boothId, booth.id),
          eq(boothSlotsTable.id, params.data.slotId),
        ),
      )
      .limit(1);
    if (!slot || !tokenMatches(headers.data["X-Participant-Token"], slot.claimTokenHash)) {
      res.status(403).json({ error: "This participant link does not have access to that slot." });
      return;
    }
    if (slot.claimStatus !== "claimed") {
      res.status(409).json({ error: "This slot has already been submitted." });
      return;
    }

    try {
      const uploadURL = await storage.getObjectEntityUploadURL();
      const objectPath = storage.normalizeObjectEntityPath(uploadURL);
      await db
        .update(boothSlotsTable)
        .set({ pendingObjectPath: objectPath })
        .where(eq(boothSlotsTable.id, slot.id));
      res.json(RequestFrameUploadResponse.parse({ uploadURL, objectPath }));
    } catch (error) {
      req.log.error({ err: error }, "Failed to create private upload URL");
      res.status(503).json({ error: "Photo upload is temporarily unavailable. Try again." });
    }
  },
);

router.post(
  "/booths/:privateToken/slots/:slotId/confirm",
  async (req, res): Promise<void> => {
    const params = ConfirmBoothFrameParams.safeParse(req.params);
    const headers = ConfirmBoothFrameHeader.safeParse({
      "X-Participant-Token": getHeader(req, "X-Participant-Token"),
    });
    const body = ConfirmBoothFrameBody.safeParse(req.body);
    if (!params.success || !headers.success || !body.success) {
      res.status(400).json({ error: "The photo details are not valid." });
      return;
    }
    const booth = await findBooth(params.data.privateToken);
    if (!booth) {
      res.status(404).json({ error: "This booth is no longer available." });
      return;
    }
    const [slot] = await db
      .select()
      .from(boothSlotsTable)
      .where(
        and(
          eq(boothSlotsTable.boothId, booth.id),
          eq(boothSlotsTable.id, params.data.slotId),
        ),
      )
      .limit(1);
    const participantToken = headers.data["X-Participant-Token"];
    if (!slot || !tokenMatches(participantToken, slot.claimTokenHash)) {
      res.status(403).json({ error: "This participant link does not have access to that slot." });
      return;
    }
    if ((slot.claimStatus === "staged" || slot.claimStatus === "submitted") && slot.mediaPath === body.data.objectPath) {
      res.json(ConfirmBoothFrameResponse.parse(await buildBoothState(booth, params.data.privateToken)));
      return;
    }
    if (
      slot.claimStatus !== "claimed" ||
      slot.pendingObjectPath !== body.data.objectPath ||
      !body.data.objectPath.startsWith("/objects/")
    ) {
      res.status(409).json({ error: "This upload cannot be confirmed. Please retry the upload." });
      return;
    }

    try {
      const objectFile = await storage.getObjectEntityFile(body.data.objectPath);
      const [metadata] = await objectFile.getMetadata();
      const actualSize = Number(metadata.size ?? 0);
      if (
        actualSize <= 0 ||
        actualSize > MAX_IMAGE_BYTES ||
        !ALLOWED_IMAGE_TYPES.has(String(metadata.contentType ?? ""))
      ) {
        res.status(400).json({ error: "The uploaded file is not a supported image." });
        return;
      }
      const [rawImage] = await objectFile.download();
      const normalized = await sharp(rawImage, {
        limitInputPixels: 40_000_000,
        failOn: "warning",
      })
        .rotate()
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      if (
        !normalized.info.width ||
        !normalized.info.height ||
        normalized.info.width > 10_000 ||
        normalized.info.height > 10_000
      ) {
        res.status(400).json({ error: "The image dimensions are not supported." });
        return;
      }

      await objectFile.save(normalized.data, {
        resumable: false,
        metadata: {
          contentType: "image/jpeg",
          cacheControl: "private, no-store",
          metadata: {},
        },
      });

      await db.transaction(async (tx) => {
        await tx
          .select({ id: boothsTable.id })
          .from(boothsTable)
          .where(eq(boothsTable.id, booth.id))
          .for("update");
        const [currentSlot] = await tx
          .select()
          .from(boothSlotsTable)
          .where(eq(boothSlotsTable.id, slot.id))
          .for("update");
        if (
          !currentSlot ||
          currentSlot.claimStatus !== "claimed" ||
          !tokenMatches(participantToken, currentSlot.claimTokenHash) ||
          currentSlot.pendingObjectPath !== body.data.objectPath
        ) {
          throw new Error("Slot changed while confirming the frame.");
        }
        await tx
          .update(boothSlotsTable)
          .set({
            claimStatus: booth.photosPerPerson > 1 ? "staged" : "submitted",
            mediaPath: body.data.objectPath,
            pendingObjectPath: null,
            width: normalized.info.width,
            height: normalized.info.height,
            captureSource: body.data.captureSource,
            submittedAt: booth.photosPerPerson > 1 ? null : new Date(),
          })
          .where(eq(boothSlotsTable.id, currentSlot.id));

        const completeSlots = await tx
          .select({ id: boothSlotsTable.id })
          .from(boothSlotsTable)
          .where(
            and(
              eq(boothSlotsTable.boothId, booth.id),
              eq(boothSlotsTable.claimStatus, "submitted"),
            ),
          );
        if (completeSlots.length === booth.participantCount) {
          await tx
            .update(boothsTable)
            .set({ status: "complete", completedAt: new Date() })
            .where(eq(boothsTable.id, booth.id));
        }
      });

      const updatedBooth = await findBooth(params.data.privateToken);
      if (!updatedBooth) {
        res.status(404).json({ error: "This booth could not be found." });
        return;
      }
      const updatedState = await buildBoothState(updatedBooth, params.data.privateToken);
      if (updatedState.revealAvailable) {
        void sendBoothReadyNotifications(updatedBooth.id, updatedBooth.name).catch((error) =>
          req.log.warn({ err: error }, "Could not send booth-ready notification"),
        );
      }
      res.json(
        ConfirmBoothFrameResponse.parse(updatedState),
      );
    } catch (error) {
      req.log.error({ err: error }, "Failed to confirm uploaded frame");
      res.status(500).json({ error: "The photo could not be confirmed. Retry without retaking it." });
    }
  },
);

router.get("/booths/:privateToken/slots/:slotId/draft-photo", async (req, res): Promise<void> => {
  const params = ConfirmBoothFrameParams.safeParse(req.params);
  const headers = ConfirmBoothFrameHeader.safeParse({
    "X-Participant-Token": getHeader(req, "X-Participant-Token"),
  });
  if (!params.success || !headers.success) {
    res.status(400).json({ error: "Invalid saved photo link." });
    return;
  }
  try {
    const booth = await findBooth(params.data.privateToken);
    if (!booth) {
      res.status(404).json({ error: "This booth could not be found." });
      return;
    }
    const [slot] = await db.select().from(boothSlotsTable).where(and(
      eq(boothSlotsTable.boothId, booth.id),
      eq(boothSlotsTable.id, params.data.slotId),
    )).limit(1);
    if (!slot || !tokenMatches(headers.data["X-Participant-Token"], slot.claimTokenHash)) {
      res.status(403).json({ error: "This participant link cannot view that photo." });
      return;
    }
    if ((slot.claimStatus !== "staged" && slot.claimStatus !== "submitted") || !slot.mediaPath) {
      res.status(404).json({ error: "This saved photo is unavailable." });
      return;
    }
    const file = await storage.getObjectEntityFile(slot.mediaPath);
    const response = await storage.downloadObject(file, 0);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (response.body) {
      const { Readable } = await import("node:stream");
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else res.end();
  } catch (error) {
    req.log.error({ err: error }, "Failed to serve saved photo");
    res.status(404).json({ error: "This saved photo could not be loaded." });
  }
});

router.delete("/booths/:privateToken/slots/:slotId/draft-photo", async (req, res): Promise<void> => {
  const params = ConfirmBoothFrameParams.safeParse(req.params);
  const headers = ConfirmBoothFrameHeader.safeParse({
    "X-Participant-Token": getHeader(req, "X-Participant-Token"),
  });
  if (!params.success || !headers.success) {
    res.status(400).json({ error: "Invalid saved photo request." });
    return;
  }
  try {
    const booth = await findBooth(params.data.privateToken);
    if (!booth) {
      res.status(404).json({ error: "This booth could not be found." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      const [slot] = await tx.select().from(boothSlotsTable).where(and(
        eq(boothSlotsTable.boothId, booth.id),
        eq(boothSlotsTable.id, params.data.slotId),
      )).for("update");
      if (!slot || !tokenMatches(headers.data["X-Participant-Token"], slot.claimTokenHash)) return "forbidden" as const;
      if (slot.claimStatus !== "staged" || !slot.mediaPath) return "unavailable" as const;
      const file = await storage.getObjectEntityFile(slot.mediaPath);
      await file.delete({ ignoreNotFound: true });
      await tx.update(boothSlotsTable).set({
        claimStatus: "claimed",
        mediaPath: null,
        pendingObjectPath: null,
        width: null,
        height: null,
        captureSource: null,
        submittedAt: null,
      }).where(eq(boothSlotsTable.id, slot.id));
      return "deleted" as const;
    });
    if (result === "forbidden") res.status(403).json({ error: "This participant link cannot delete that photo." });
    else if (result === "unavailable") res.status(409).json({ error: "This photo has already been finalized or removed." });
    else res.sendStatus(204);
  } catch (error) {
    req.log.error({ err: error }, "Failed to delete saved photo");
    res.status(503).json({ error: "The photo could not be deleted. Please try again." });
  }
});

router.post("/booths/:privateToken/slots/:slotId/finalize", async (req, res): Promise<void> => {
  const params = ConfirmBoothFrameParams.safeParse(req.params);
  const headers = ConfirmBoothFrameHeader.safeParse({
    "X-Participant-Token": getHeader(req, "X-Participant-Token"),
  });
  if (!params.success || !headers.success) {
    res.status(400).json({ error: "Invalid finalization request." });
    return;
  }
  try {
    const booth = await findBooth(params.data.privateToken);
    if (!booth) {
      res.status(404).json({ error: "This booth could not be found." });
      return;
    }
    const result = await db.transaction(async (tx) => {
      await tx.select({ id: boothsTable.id }).from(boothsTable).where(eq(boothsTable.id, booth.id)).for("update");
      const [selected] = await tx.select().from(boothSlotsTable).where(and(
        eq(boothSlotsTable.boothId, booth.id),
        eq(boothSlotsTable.id, params.data.slotId),
      )).limit(1);
      if (!selected || !tokenMatches(headers.data["X-Participant-Token"], selected.claimTokenHash)) return "forbidden" as const;
      const groupStart = Math.floor(selected.position / booth.photosPerPerson) * booth.photosPerPerson;
      const group = await tx.select().from(boothSlotsTable).where(and(
        eq(boothSlotsTable.boothId, booth.id),
        gte(boothSlotsTable.position, groupStart),
        lt(boothSlotsTable.position, groupStart + booth.photosPerPerson),
      )).orderBy(asc(boothSlotsTable.position)).for("update");
      if (group.length !== booth.photosPerPerson || !group.every((slot) => tokenMatches(headers.data["X-Participant-Token"], slot.claimTokenHash))) return "forbidden" as const;
      if (!group.every((slot) => (slot.claimStatus === "staged" || slot.claimStatus === "submitted") && slot.mediaPath)) return "incomplete" as const;
      const stagedIds = group.filter((slot) => slot.claimStatus === "staged").map((slot) => slot.id);
      if (stagedIds.length) {
        await tx.update(boothSlotsTable).set({ claimStatus: "submitted", submittedAt: new Date() }).where(inArray(boothSlotsTable.id, stagedIds));
      }
      const submitted = await tx.select({ id: boothSlotsTable.id }).from(boothSlotsTable).where(and(
        eq(boothSlotsTable.boothId, booth.id),
        eq(boothSlotsTable.claimStatus, "submitted"),
      ));
      if (submitted.length === booth.participantCount) {
        await tx.update(boothsTable).set({ status: "complete", completedAt: new Date() }).where(eq(boothsTable.id, booth.id));
      }
      return "finalized" as const;
    });
    if (result === "forbidden") {
      res.status(403).json({ error: "This participant link cannot finalize those photos." });
      return;
    }
    if (result === "incomplete") {
      res.status(409).json({ error: "Save every photo before finalizing." });
      return;
    }
    const updated = await findBooth(params.data.privateToken);
    if (!updated) {
      res.status(404).json({ error: "This booth could not be found." });
      return;
    }
    const state = await buildBoothState(updated, params.data.privateToken);
    if (state.revealAvailable) {
      void sendBoothReadyNotifications(updated.id, updated.name).catch((error) =>
        req.log.warn({ err: error }, "Could not send booth-ready notification"),
      );
    }
    res.json(state);
  } catch (error) {
    req.log.error({ err: error }, "Failed to finalize participant photos");
    res.status(500).json({ error: "Your photos could not be finalized. Please try again." });
  }
});

router.get(
  "/booths/:privateToken/slots/:slotId/photo",
  async (req, res): Promise<void> => {
    const params = GetBoothParams.safeParse({ privateToken: req.params.privateToken });
    const slotId = getSlotId(req);
    if (!params.success || !slotId) {
      res.status(400).json({ error: "Invalid photo link." });
      return;
    }
    try {
      const booth = await findBooth(params.data.privateToken);
      if (!booth) {
        res.status(404).json({ error: "This booth is no longer available." });
        return;
      }
      const state = await buildBoothState(booth, params.data.privateToken);
      if (!state.revealAvailable) {
        res.status(404).json({ error: "This frame is still hidden." });
        return;
      }
      const [slot] = await db
        .select()
        .from(boothSlotsTable)
        .where(
          and(
            eq(boothSlotsTable.boothId, booth.id),
            eq(boothSlotsTable.id, slotId),
            eq(boothSlotsTable.claimStatus, "submitted"),
          ),
        )
        .limit(1);
      if (!slot?.mediaPath) {
        res.status(404).json({ error: "This frame could not be found." });
        return;
      }
      const objectFile = await storage.getObjectEntityFile(slot.mediaPath);
      const response = await storage.downloadObject(objectFile, 0);
      res.status(response.status);
      response.headers.forEach((value, key) => res.setHeader(key, value));
      res.setHeader("Cache-Control", "private, no-store");
      res.setHeader("Referrer-Policy", "no-referrer");
      if (response.body) {
        const { Readable } = await import("node:stream");
        Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
      } else {
        res.end();
      }
    } catch (error) {
      req.log.error({ err: error }, "Failed to serve revealed frame");
      res.status(404).json({ error: "This frame could not be loaded." });
    }
  },
);

router.post(
  "/booths/:privateToken/push-subscriptions",
  async (req, res): Promise<void> => {
    const params = SubscribeToBoothReadyParams.safeParse(req.params);
    const headers = SubscribeToBoothReadyHeader.safeParse({
      "X-Access-Token": getHeader(req, "X-Access-Token"),
    });
    const body = SubscribeToBoothReadyBody.safeParse(req.body);
    if (!params.success || !headers.success || !body.success) {
      res.status(400).json({ error: "Notification subscription details are not valid." });
      return;
    }
    if (!pushIsConfigured()) {
      res.status(201).json(
        SubscribeToBoothReadyResponse.parse({
          enabled: false,
          message: "Push delivery is not configured. Keep your private booth link to return.",
        }),
      );
      return;
    }

    const booth = await findBooth(params.data.privateToken);
    if (!booth) {
      res.status(404).json({ error: "This booth is no longer available." });
      return;
    }
    const accessToken = headers.data["X-Access-Token"];
    let slotId: string | null = null;
    let accessTokenHash: string | null = null;
    if (tokenMatches(accessToken, booth.creatorTokenHash)) {
      accessTokenHash = tokenHash(accessToken);
    } else {
      const boothSlots = await db
        .select()
        .from(boothSlotsTable)
        .where(
          and(
            eq(boothSlotsTable.boothId, booth.id),
            eq(boothSlotsTable.claimStatus, "submitted"),
          ),
        );
      const participantSlot = boothSlots.find((candidate) =>
        tokenMatches(accessToken, candidate.claimTokenHash),
      );
      if (participantSlot) {
        slotId = participantSlot.id;
        accessTokenHash = tokenHash(accessToken);
      }
    }
    if (!accessTokenHash) {
      res.status(403).json({ error: "This link cannot manage notifications for the booth." });
      return;
    }

    try {
      await storePushSubscription(
        booth.id,
        slotId,
        accessTokenHash,
        params.data.privateToken,
        body.data,
      );
      const state = await buildBoothState(booth, params.data.privateToken);
      if (state.revealAvailable) {
        void sendBoothReadyNotifications(booth.id, booth.name).catch((error) =>
          req.log.warn({ err: error }, "Could not send booth-ready notification"),
        );
      }
      res.status(201).json(
        SubscribeToBoothReadyResponse.parse({
          enabled: true,
          message: "You’ll get one notification when the booth is ready.",
        }),
      );
    } catch (error) {
      req.log.error({ err: error }, "Could not save push subscription");
      res.status(500).json({ error: "Notifications could not be enabled. Keep your private link." });
    }
  },
);

router.put("/booths/:privateToken/customization", async (req, res): Promise<void> => {
  const params = SaveBoothCustomizationParams.safeParse(req.params);
  const headers = SaveBoothCustomizationHeader.safeParse({
    "X-Creator-Token": getHeader(req, "X-Creator-Token"),
  });
  const body = SaveBoothCustomizationBody.safeParse(req.body);
  if (!params.success || !headers.success || !body.success) {
    const fields = body.success ? [] : [...new Set(body.error.issues.map((issue) => issue.path.join(".") || "design"))];
    res.status(400).json({ error: fields.length ? `Customization details are not valid: ${fields.join(", ")}.` : "Customization details are not valid." });
    return;
  }
  const booth = await findBooth(params.data.privateToken);
  if (!booth || (booth.userId && booth.userId !== req.session.userId) || !tokenMatches(headers.data["X-Creator-Token"], booth.creatorTokenHash)) {
    res.status(403).json({ error: "Only the booth creator can change its design." });
    return;
  }
  try {
    await db
      .update(boothsTable)
      .set({
        mode: body.data.mode,
        layout: body.data.layout,
        customization: body.data,
      })
      .where(eq(boothsTable.id, booth.id));
    res.json(SaveBoothCustomizationResponse.parse(body.data));
  } catch (error) {
    req.log.error({ err: error }, "Failed to save booth customization");
    res.status(500).json({ error: "Your changes could not be saved. Try again." });
  }
});

router.delete("/booths/:privateToken", async (req, res): Promise<void> => {
  const params = DeleteBoothParams.safeParse(req.params);
  const headers = DeleteBoothHeader.safeParse({
    "X-Creator-Token": getHeader(req, "X-Creator-Token"),
  });
  if (!params.success || !headers.success) {
    res.status(400).json({ error: "Invalid booth deletion request." });
    return;
  }
  const booth = await findBooth(params.data.privateToken);
  if (!booth || (booth.userId && booth.userId !== req.session.userId) || !tokenMatches(headers.data["X-Creator-Token"], booth.creatorTokenHash)) {
    res.status(403).json({ error: "Only the booth creator can delete it." });
    return;
  }
  try {
    const slots = await db
      .select()
      .from(boothSlotsTable)
      .where(eq(boothSlotsTable.boothId, booth.id));
    const paths = new Set(
      slots.flatMap((slot) => [slot.mediaPath, slot.pendingObjectPath].filter(Boolean) as string[]),
    );
    for (const path of paths) {
      try {
        const file = await storage.getObjectEntityFile(path);
        await file.delete({ ignoreNotFound: true });
      } catch (error) {
        req.log.error({ err: error }, "Could not remove booth media during deletion");
        res.status(503).json({
          error: "The booth is still private, but a photo could not be deleted yet. Try again.",
        });
        return;
      }
    }
    await db.delete(boothsTable).where(eq(boothsTable.id, booth.id));
    res.sendStatus(204);
  } catch (error) {
    req.log.error({ err: error }, "Failed to delete booth");
    res.status(500).json({ error: "The booth could not be deleted. Try again." });
  }
});

export default router;
