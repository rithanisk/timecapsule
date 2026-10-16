import { and, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import { createHash } from "node:crypto";
import {
  RegisterBody,
  RegisterResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  GetMeResponse,
  GetMyBoothsResponse,
} from "@workspace/api-zod";
import { boothSlotsTable, db, userBoothAccessTable, usersTable, boothsTable } from "@workspace/db";
import { buildBoothState } from "./booths";
import { ObjectStorageService } from "../lib/objectStorage";

const router: IRouter = Router();
const BCRYPT_ROUNDS = 12;
const storage = new ObjectStorageService();
const hashToken = (value: string) => createHash("sha256").update(value).digest("hex");
const routeParam = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value ?? "";
async function accessibleBoothIds(userId: string): Promise<string[]> {
  const access = await db.select({ boothId: userBoothAccessTable.boothId }).from(userBoothAccessTable).where(eq(userBoothAccessTable.userId, userId));
  return access.map((row) => row.boothId);
}
async function canAccessBooth(userId: string, boothId: string, ownerId: string | null): Promise<boolean> {
  if (ownerId === userId) return true;
  const [access] = await db.select({ boothId: userBoothAccessTable.boothId }).from(userBoothAccessTable).where(and(eq(userBoothAccessTable.userId, userId), eq(userBoothAccessTable.boothId, boothId))).limit(1);
  return Boolean(access);
}

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password, displayName } = parsed.data;

  const existing = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()))
    .limit(1);
  if (existing.length > 0) {
    res.status(409).json({ error: "An account with this email already exists." });
    return;
  }

  try {
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const [user] = await db
      .insert(usersTable)
      .values({
        email: email.toLowerCase(),
        passwordHash,
        displayName: displayName.trim(),
      })
      .returning();

    req.session.userId = user.id;
    res.status(201).json(
      RegisterResponse.parse({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to register user");
    res.status(500).json({ error: "Registration failed. Please try again." });
  }
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.toLowerCase()))
      .limit(1);
    if (!user) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password." });
      return;
    }

    req.session.userId = user.id;
    res.json(
      LoginResponse.parse({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to log in");
    res.status(500).json({ error: "Login failed. Please try again." });
  }
});

router.post("/auth/logout", (req, res): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: "Logout failed." });
      return;
    }
    res.clearCookie("connect.sid");
    res.json(LogoutResponse.parse({ ok: true }));
  });
});

router.get("/auth/me", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, req.session.userId))
      .limit(1);
    if (!user) {
      res.status(401).json({ error: "Not authenticated." });
      return;
    }
    res.json(
      GetMeResponse.parse({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
      }),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to get current user");
    res.status(500).json({ error: "Could not fetch user." });
  }
});

router.get("/auth/booths", async (req, res): Promise<void> => {
  if (!req.session.userId) {
    res.status(401).json({ error: "Not authenticated." });
    return;
  }
  try {
    const booths = await db
      .select({
        id: boothsTable.id,
        name: boothsTable.name,
        status: boothsTable.status,
        participantCount: boothsTable.participantCount,
        createdAt: boothsTable.createdAt,
      })
      .from(boothsTable)
      .where(eq(boothsTable.userId, req.session.userId));
    res.json(
      GetMyBoothsResponse.parse(
        booths.map((b) => ({
          ...b,
          createdAt: b.createdAt.toISOString(),
        })),
      ),
    );
  } catch (error) {
    req.log.error({ err: error }, "Failed to list user booths");
    res.status(500).json({ error: "Could not fetch booths." });
  }
});

router.post("/auth/archive/link", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated." }); return; }
  const { privateToken, creatorToken } = req.body ?? {};
  if (typeof privateToken !== "string" || typeof creatorToken !== "string" || privateToken.length > 128 || creatorToken.length > 128) {
    res.status(400).json({ error: "A valid booth link is required." }); return;
  }
  try {
    const [booth] = await db.select().from(boothsTable).where(and(eq(boothsTable.privateTokenHash, hashToken(privateToken)), eq(boothsTable.creatorTokenHash, hashToken(creatorToken)))).limit(1);
    if (!booth || (booth.userId && booth.userId !== req.session.userId)) { res.status(403).json({ error: "This booth belongs to another account." }); return; }
    if (!booth.userId) {
      const [linked] = await db.update(boothsTable).set({ userId: req.session.userId }).where(and(eq(boothsTable.id, booth.id), isNull(boothsTable.userId))).returning({ id: boothsTable.id });
      if (!linked) { res.status(409).json({ error: "This booth was linked elsewhere. Try again." }); return; }
    }
    res.json({ id: booth.id });
  } catch (error) {
    req.log.error({ err: error }, "Failed to link booth to account");
    res.status(500).json({ error: "Could not add this booth to your account." });
  }
});

router.post("/auth/archive/link-participation", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated." }); return; }
  const { privateToken, participantToken, slotId } = req.body ?? {};
  if (typeof privateToken !== "string" || typeof participantToken !== "string" || typeof slotId !== "string" || privateToken.length > 128 || participantToken.length > 128) {
    res.status(400).json({ error: "A valid participant link is required." }); return;
  }
  try {
    const [booth] = await db.select().from(boothsTable).where(eq(boothsTable.privateTokenHash, hashToken(privateToken))).limit(1);
    if (!booth) { res.status(404).json({ error: "This booth could not be found." }); return; }
    const [slot] = await db.select({ id: boothSlotsTable.id }).from(boothSlotsTable).where(and(eq(boothSlotsTable.id, slotId), eq(boothSlotsTable.boothId, booth.id), eq(boothSlotsTable.claimTokenHash, hashToken(participantToken)))).limit(1);
    if (!slot) { res.status(403).json({ error: "This participant link is invalid." }); return; }
    await db.insert(userBoothAccessTable).values({ userId: req.session.userId, boothId: booth.id }).onConflictDoNothing();
    res.json({ id: booth.id });
  } catch (error) {
    req.log.error({ err: error }, "Failed to link participant booth to account");
    res.status(500).json({ error: "Could not add this booth to your account." });
  }
});

router.get("/auth/archive", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated." }); return; }
  try {
    const [user] = await db.select({ homeStripBoothIds: usersTable.homeStripBoothIds }).from(usersTable).where(eq(usersTable.id, req.session.userId)).limit(1);
    const accessIds = await accessibleBoothIds(req.session.userId);
    const booths = await db.select().from(boothsTable).where(and(accessIds.length ? or(eq(boothsTable.userId, req.session.userId), inArray(boothsTable.id, accessIds)) : eq(boothsTable.userId, req.session.userId), ne(boothsTable.status, "deleted"))).orderBy(desc(boothsTable.createdAt));
    const entries = (await Promise.all(booths.map(async (booth) => ({
      id: booth.id,
      booth: await buildBoothState(booth, "", (slotId) => `/api/auth/archive/${booth.id}/slots/${slotId}/photo`),
    })))).filter((entry) => entry.booth.revealAvailable);
    const visibleIds = new Set(entries.map((entry) => entry.id));
    res.json({ entries, selectedIds: (user?.homeStripBoothIds ?? []).filter((id) => visibleIds.has(id)) });
  } catch (error) {
    req.log.error({ err: error }, "Failed to list account archive");
    res.status(500).json({ error: "Could not load your archive." });
  }
});

router.put("/auth/archive/home-selection", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated." }); return; }
  const ids: unknown = req.body?.selectedIds;
  if (!Array.isArray(ids) || ids.length > 12 || ids.some((id) => typeof id !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) || new Set(ids).size !== ids.length) {
    res.status(400).json({ error: "Choose up to 12 unique photostrips." }); return;
  }
  try {
    const accessIds = await accessibleBoothIds(req.session.userId);
    const accessible = ids.length ? await db.select().from(boothsTable).where(and(inArray(boothsTable.id, ids as string[]), accessIds.length ? or(eq(boothsTable.userId, req.session.userId), inArray(boothsTable.id, accessIds)) : eq(boothsTable.userId, req.session.userId))) : [];
    if (accessible.length !== ids.length || accessible.some((booth) => booth.status === "deleted")) { res.status(403).json({ error: "A selected booth is not in your archive." }); return; }
    const states = await Promise.all(accessible.map((booth) => buildBoothState(booth, "")));
    if (states.some((state) => !state.revealAvailable)) { res.status(400).json({ error: "Choose finished photostrips only." }); return; }
    const [user] = await db.update(usersTable).set({ homeStripBoothIds: ids as string[] }).where(eq(usersTable.id, req.session.userId)).returning({ selectedIds: usersTable.homeStripBoothIds });
    res.json({ selectedIds: user?.selectedIds ?? [] });
  } catch (error) {
    req.log.error({ err: error }, "Failed to save home photostrips");
    res.status(500).json({ error: "Could not save your home page selection." });
  }
});

router.get("/auth/archive/:boothId/slots/:slotId/photo", async (req, res): Promise<void> => {
  if (!req.session.userId) { res.status(401).json({ error: "Not authenticated." }); return; }
  const boothId = routeParam(req.params.boothId);
  const slotId = routeParam(req.params.slotId);
  try {
    const [booth] = await db.select().from(boothsTable).where(eq(boothsTable.id, boothId)).limit(1);
    if (!booth || booth.status === "deleted" || !await canAccessBooth(req.session.userId, booth.id, booth.userId)) { res.status(404).json({ error: "This booth is unavailable." }); return; }
    const state = await buildBoothState(booth, "");
    if (!state.revealAvailable) { res.status(404).json({ error: "This frame is still hidden." }); return; }
    const [slot] = await db.select().from(boothSlotsTable).where(and(eq(boothSlotsTable.boothId, booth.id), eq(boothSlotsTable.id, slotId), eq(boothSlotsTable.claimStatus, "submitted"))).limit(1);
    if (!slot?.mediaPath) { res.status(404).json({ error: "This frame could not be found." }); return; }
    const objectFile = await storage.getObjectEntityFile(slot.mediaPath);
    const response = await storage.downloadObject(objectFile, 0);
    res.status(response.status);
    response.headers.forEach((value, key) => res.setHeader(key, value));
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Referrer-Policy", "no-referrer");
    if (response.body) {
      const { Readable } = await import("node:stream");
      Readable.fromWeb(response.body as ReadableStream<Uint8Array>).pipe(res);
    } else res.end();
  } catch (error) {
    req.log.error({ err: error }, "Failed to serve account archive frame");
    res.status(404).json({ error: "This frame could not be loaded." });
  }
});

export default router;
