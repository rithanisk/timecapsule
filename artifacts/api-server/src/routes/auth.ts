import { eq } from "drizzle-orm";
import { Router, type IRouter } from "express";
import bcrypt from "bcrypt";
import {
  RegisterBody,
  RegisterResponse,
  LoginBody,
  LoginResponse,
  LogoutResponse,
  GetMeResponse,
  GetMyBoothsResponse,
} from "@workspace/api-zod";
import { db, usersTable, boothsTable } from "@workspace/db";

const router: IRouter = Router();
const BCRYPT_ROUNDS = 12;

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

export default router;
