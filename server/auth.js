import argon2 from "argon2";
import fs from "node:fs/promises";
import { randomUUID, timingSafeEqual } from "node:crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { q, tx, root } from "./db.js";
import { token, hash, fail, requireOwner } from "./core.js";
export const credentials = z.object({
  email: z
    .email()
    .max(254)
    .transform((s) => s.toLowerCase()),
  password: z.string().min(12).max(128),
});
const registration = credentials.extend({
  name: z.string().trim().min(1).max(80),
  token: z.string().min(32).max(128),
});
const cookie = {
  httpOnly: true,
  sameSite: "strict",
  secure: process.env.COOKIE_SECURE === "true",
  path: "/",
};
export async function passwordHash(value) {
  return argon2.hash(value, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
}
export async function initToken() {
  try {
    await fs.writeFile(`${root}/config/setup-token`, token(), {
      flag: "wx",
      mode: 0o600,
    });
  } catch (e) {
    if (e.code !== "EEXIST") throw e;
  }
}
export async function auth(req, res, next) {
  try {
    const raw = req.cookies?.ours;
    if (raw) {
      const result = await q(
        "SELECT u.id,u.name,u.email,u.owner,s.csrf FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token=$1 AND s.expires_at>now()",
        [hash(raw)],
      );
      req.user = result.rows[0];
    }
    next();
  } catch (e) {
    next(e);
  }
}
export function protect(req, res, next) {
  if (!req.user)
    return res.status(401).json({ error: "Please sign in to continue" });
  next();
}
export function csrf(req, res, next) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
  const origin = req.get("origin");
  const expected = process.env.APP_URL;
  if (origin && expected && origin !== expected)
    return res.status(403).json({ error: "Request origin is not allowed" });
  if (origin && !expected) {
    try {
      if (new URL(origin).host !== req.get("host"))
        return res.status(403).json({ error: "Request origin is not allowed" });
    } catch {
      return res.status(403).json({ error: "Invalid origin" });
    }
  }
  if (req.user && req.get("x-csrf-token") !== req.user.csrf)
    return res
      .status(403)
      .json({ error: "Refresh the page before trying again" });
  next();
}
async function session(user, res) {
  const raw = token(),
    csrfToken = token();
  await q(
    "INSERT INTO sessions(token,user_id,csrf,expires_at) VALUES($1,$2,$3,now()+($4||' hours')::interval)",
    [hash(raw), user.id, csrfToken, Number(process.env.SESSION_HOURS || 168)],
  );
  res.cookie("ours", raw, {
    ...cookie,
    maxAge: Number(process.env.SESSION_HOURS || 168) * 3600000,
  });
  return { ...user, csrf: csrfToken };
}
export function authRoutes(app) {
  const limiter = rateLimit({
    windowMs: 15 * 60000,
    limit: 20,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many attempts. Try again in 15 minutes." },
  });
  app.get("/api/auth/state", async (req, res) =>
    res.json({
      setup: !(await q("SELECT 1 FROM users LIMIT 1")).rowCount,
      user: req.user || null,
      name:
        (await q("SELECT value FROM application_settings WHERE key='name'"))
          .rows[0]?.value ||
        process.env.APP_NAME ||
        "Ours",
      carouselLimit: Number(process.env.CAROUSEL_LIMIT || 20),
    }),
  );
  app.post("/api/auth/setup", limiter, async (req, res) => {
    if ((await q("SELECT 1 FROM users LIMIT 1")).rowCount)
      fail(409, "This home has already been claimed");
    const body = registration.parse(req.body);
    const secret = (
      await fs.readFile(`${root}/config/setup-token`, "utf8")
    ).trim();
    if (hash(body.token) !== hash(secret))
      fail(403, "The setup token is invalid");
    const password = await passwordHash(body.password);
    const user = await tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(101)");
      if ((await c.query("SELECT 1 FROM users LIMIT 1")).rowCount)
        fail(409, "This home has already been claimed");
      return (
        await c.query(
          "INSERT INTO users(id,name,email,password,owner) VALUES($1,$2,$3,$4,true) RETURNING id,name,email,owner",
          [randomUUID(), body.name, body.email, password],
        )
      ).rows[0];
    });
    await fs.unlink(`${root}/config/setup-token`).catch(() => {});
    res.status(201).json(await session(user, res));
  });
  app.post("/api/auth/login", limiter, async (req, res) => {
    const body = credentials.parse(req.body);
    const user = (await q("SELECT * FROM users WHERE email=$1", [body.email]))
      .rows[0];
    if (!user || !(await argon2.verify(user.password, body.password)))
      fail(401, "Email or password is incorrect");
    delete user.password;
    res.json(await session(user, res));
  });
  app.post("/api/auth/logout", protect, async (req, res) => {
    await q("DELETE FROM sessions WHERE token=$1", [hash(req.cookies.ours)]);
    res.clearCookie("ours", cookie).json({ ok: true });
  });
  app.post("/api/invitations", protect, async (req, res) => {
    requireOwner(req.user);
    if ((await q("SELECT 1 FROM users")).rowCount >= 2)
      fail(409, "Both accounts are already here");
    const raw = token();
    await tx(async (c) => {
      await c.query("DELETE FROM invitations");
      await c.query(
        "INSERT INTO invitations(token,expires_at) VALUES($1,now()+interval '48 hours')",
        [hash(raw)],
      );
    });
    res.status(201).json({ token: raw, expiresInHours: 48 });
  });
  app.post("/api/auth/join", limiter, async (req, res) => {
    const body = registration.parse(req.body);
    const password = await passwordHash(body.password);
    const user = await tx(async (c) => {
      await c.query("SELECT pg_advisory_xact_lock(101)");
      if ((await c.query("SELECT 1 FROM users")).rowCount !== 1)
        fail(409, "Invitation registration is unavailable");
      const invite = (
        await c.query(
          "SELECT * FROM invitations WHERE token=$1 AND used_at IS NULL AND expires_at>now() FOR UPDATE",
          [hash(body.token)],
        )
      ).rows[0];
      if (!invite) fail(403, "This invitation has expired or was already used");
      await c.query("UPDATE invitations SET used_at=now() WHERE token=$1", [
        hash(body.token),
      ]);
      return (
        await c.query(
          "INSERT INTO users(id,name,email,password) VALUES($1,$2,$3,$4) RETURNING id,name,email,owner",
          [randomUUID(), body.name, body.email, password],
        )
      ).rows[0];
    });
    res.status(201).json(await session(user, res));
  });
  app.post("/api/auth/password", protect, limiter, async (req, res) => {
    const body = z
      .object({ current: z.string(), password: credentials.shape.password })
      .parse(req.body);
    const user = (
      await q("SELECT password FROM users WHERE id=$1", [req.user.id])
    ).rows[0];
    if (!(await argon2.verify(user.password, body.current)))
      fail(403, "Current password is incorrect");
    await tx(async (c) => {
      await c.query("UPDATE users SET password=$2 WHERE id=$1", [
        req.user.id,
        await passwordHash(body.password),
      ]);
      await c.query("DELETE FROM sessions WHERE user_id=$1", [req.user.id]);
    });
    res.clearCookie("ours", cookie).json({ ok: true });
  });
  app.get("/api/users", protect, async (req, res) =>
    res.json(
      (await q("SELECT id,name,owner FROM users ORDER BY created_at")).rows,
    ),
  );
}
