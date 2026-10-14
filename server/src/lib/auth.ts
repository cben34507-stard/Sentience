import { createHash, randomBytes, randomInt, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { DB } from "./db.js";
import { HttpError } from "./http.js";

/**
 * Authentication.
 *
 * - One owner password (scrypt-hashed). First run needs a one-time setup
 *   code printed in the server console, so nobody else on the Wi-Fi can
 *   claim the server before you do.
 * - Browsers get an httpOnly, SameSite=Strict session cookie (30 days,
 *   sliding). Phones and Shortcuts get long-lived device tokens.
 * - Only token hashes are stored; a stolen database can't be replayed.
 * - Login is rate limited per address.
 */

export const COOKIE = "sentience_session";
const BROWSER_DAYS = 30;
const SCRYPT = { N: 1 << 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

export type SessionKind = "browser" | "device";
export interface SessionInfo {
  id: string;
  kind: SessionKind;
  name: string;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string | null;
  ip: string | null;
  userAgent: string | null;
}

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export function hashPassword(pw: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(pw, salt, 64, SCRYPT);
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export function verifyPassword(pw: string, stored: string): boolean {
  const [alg, n, r, p, salt, hash] = stored.split("$");
  if (alg !== "scrypt") return false;
  const expected = Buffer.from(hash, "base64");
  const got = scryptSync(pw, Buffer.from(salt, "base64"), expected.length, { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

export function isConfigured(db: DB): boolean {
  return !!db.prepare(`SELECT 1 FROM auth_config WHERE id = 1`).get();
}

export function setPassword(db: DB, pw: string): void {
  if (pw.length < 10) throw new HttpError(400, "Use at least 10 characters.");
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO auth_config (id, password_hash, created_at, updated_at) VALUES (1, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`,
  ).run(hashPassword(pw), now, now);
}

export function checkPassword(db: DB, pw: string): boolean {
  const row = db.prepare(`SELECT password_hash FROM auth_config WHERE id = 1`).get() as { password_hash: string } | undefined;
  return !!row && verifyPassword(pw, row.password_hash);
}

export function createSession(db: DB, kind: SessionKind, meta: { name?: string; ip?: string | null; userAgent?: string | null }): { token: string; id: string } {
  const token = (kind === "device" ? "snt_" : "") + randomBytes(32).toString("base64url");
  const id = sha(token);
  const now = new Date();
  const expires = kind === "browser" ? new Date(now.getTime() + BROWSER_DAYS * 86400_000).toISOString() : null;
  db.prepare(
    `INSERT INTO sessions (id, kind, name, created_at, last_used_at, expires_at, ip, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, kind, meta.name ?? "", now.toISOString(), now.toISOString(), expires, meta.ip ?? null, meta.userAgent?.slice(0, 200) ?? null);
  return { token, id };
}

export function listSessions(db: DB): SessionInfo[] {
  const rows = db.prepare(`SELECT * FROM sessions ORDER BY last_used_at DESC`).all() as Record<string, string | null>[];
  return rows.map((r) => ({
    id: r.id!,
    kind: r.kind as SessionKind,
    name: r.name ?? "",
    createdAt: r.created_at!,
    lastUsedAt: r.last_used_at!,
    expiresAt: r.expires_at,
    ip: r.ip,
    userAgent: r.user_agent,
  }));
}

export function revokeSession(db: DB, id: string): boolean {
  return db.prepare(`DELETE FROM sessions WHERE id = ?`).run(id).changes > 0;
}

export function revokeAllExcept(db: DB, keepId: string | null): void {
  db.prepare(`DELETE FROM sessions WHERE id != ?`).run(keepId ?? "");
}

/** Resolves a raw token to its session, sliding browser expiry. */
export function lookup(db: DB, token: string): SessionInfo | null {
  const id = sha(token);
  const row = db.prepare(`SELECT * FROM sessions WHERE id = ?`).get(id) as Record<string, string | null> | undefined;
  if (!row) return null;
  const now = Date.now();
  if (row.expires_at && Date.parse(row.expires_at) < now) {
    revokeSession(db, id);
    return null;
  }
  // Touch at most every 5 minutes to avoid a write per request.
  if (now - Date.parse(row.last_used_at!) > 5 * 60_000) {
    const exp = row.kind === "browser" ? new Date(now + BROWSER_DAYS * 86400_000).toISOString() : row.expires_at;
    db.prepare(`UPDATE sessions SET last_used_at = ?, expires_at = ? WHERE id = ?`).run(new Date(now).toISOString(), exp, id);
  }
  return {
    id,
    kind: row.kind as SessionKind,
    name: row.name ?? "",
    createdAt: row.created_at!,
    lastUsedAt: row.last_used_at!,
    expiresAt: row.expires_at,
    ip: row.ip,
    userAgent: row.user_agent,
  };
}

/* ---------------- setup code (first run only) ---------------- */

let setupCode: string | null = null;
let setupAttempts = 0;
export function issueSetupCode(): string {
  setupCode = `${randomInt(100, 1000)}-${randomInt(100, 1000)}`;
  setupAttempts = 0;
  return setupCode;
}
export function checkSetupCode(code: string): boolean {
  if (!setupCode) return false;
  if (++setupAttempts > 10) {
    setupCode = null; // too many guesses: restart the server for a new code
    return false;
  }
  const a = Buffer.from(code.replace(/\s/g, ""));
  const b = Buffer.from(setupCode);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function clearSetupCode(): void {
  setupCode = null;
}

/* ---------------- login rate limiting ---------------- */

const failures = new Map<string, number[]>();
const WINDOW = 15 * 60_000;
export function loginAllowed(ip: string): { ok: boolean; retryAfterS: number } {
  const now = Date.now();
  const list = (failures.get(ip) ?? []).filter((t) => now - t < WINDOW);
  failures.set(ip, list);
  if (list.length >= 5) return { ok: false, retryAfterS: Math.ceil((WINDOW - (now - list[0])) / 1000) };
  return { ok: true, retryAfterS: 0 };
}
export function recordFailure(ip: string): void {
  failures.set(ip, [...(failures.get(ip) ?? []), Date.now()]);
}
export function clearFailures(ip: string): void {
  failures.delete(ip);
}

/* ---------------- cookies & middleware ---------------- */

export function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return null;
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const parts = [`${COOKIE}=${encodeURIComponent(token)}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${BROWSER_DAYS * 86400}`];
  if (req.secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

export function clearSessionCookie(res: Response): void {
  res.setHeader("Set-Cookie", `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0`);
}

declare module "express-serve-static-core" {
  interface Request {
    session?: SessionInfo;
  }
}

/** Requires a valid session for everything except the public endpoints. */
export function requireAuth(db: DB, publicPaths: string[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (publicPaths.includes(req.path)) return next();
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1];
    const cookie = readCookie(req, COOKIE);
    const token = bearer ?? cookie;
    const session = token ? lookup(db, token) : null;
    if (!session) return next(new HttpError(401, "Sign in required"));
    // Cookie-authenticated writes must carry our header: a cross-site form
    // can't add it, and a cross-site script would need a CORS preflight we
    // never approve.
    if (!bearer && req.method !== "GET" && req.method !== "HEAD" && req.headers["x-sentience"] !== "1") {
      return next(new HttpError(403, "Missing X-Sentience header"));
    }
    req.session = session;
    next();
  };
}
