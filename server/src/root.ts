/**
 * The real server: same app as createApp, but the database can be locked.
 * While locked only sign-in, recovery and the health check answer; a paired
 * device's token unlocks it transparently so the iPhone keeps syncing.
 */
import express, { Router, type Request } from "express";
import fs from "node:fs";
import { z } from "zod";
import type { DB } from "./lib/db.js";
import { errorMiddleware, HttpError, parse, wrap } from "./lib/http.js";
import * as auth from "./lib/auth.js";
import type { Locker } from "./lib/locker.js";
import { applyBase, applyStatic, buildApi } from "./app.js";
import type { SecurityContext } from "./routes/auth.js";

const ip = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "unknown";
const bearerOf = (req: Request) => /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1] ?? null;

function lockedRouter(locker: Locker): Router {
  const r = Router();
  r.get("/health-check", (_req, res) => res.json({ ok: true, time: new Date().toISOString(), locked: true }));
  r.get("/auth/status", (req, res) =>
    res.json({ configured: locker.state !== "setup", authenticated: false, kind: null, https: req.secure, locked: locker.state === "locked", vault: true }),
  );

  const signIn = (req: Request, res: express.Response, db: DB) => {
    const { token } = auth.createSession(db, "browser", { name: "Browser", ip: ip(req), userAgent: req.headers["user-agent"] });
    auth.setSessionCookie(req, res, token);
  };
  const gate = (req: Request, res: express.Response) => {
    const g = auth.loginAllowed(ip(req));
    if (!g.ok) {
      res.setHeader("Retry-After", String(g.retryAfterS));
      throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(g.retryAfterS / 60)} minutes.`);
    }
  };

  r.post("/auth/setup", wrap((req, res) => {
    if (locker.state !== "setup") throw new HttpError(409, "Already set up. Sign in instead.");
    const { code, password } = parse(z.object({ code: z.string().min(3).max(20), password: z.string().min(10).max(200) }), req.body);
    if (!auth.checkSetupCode(code)) throw new HttpError(403, "That setup code doesn't match the one in the server console.");
    const { db, recoveryKey } = locker.setup(password);
    auth.clearSetupCode();
    signIn(req, res, db);
    return { ok: true, recoveryKey };
  }));

  r.post("/auth/login", wrap((req, res) => {
    gate(req, res);
    const { password } = parse(z.object({ password: z.string().min(1).max(200) }), req.body);
    if (!locker.unlockWithPassword(password)) {
      auth.recordFailure(ip(req));
      throw new HttpError(401, "Wrong password.");
    }
    auth.clearFailures(ip(req));
    signIn(req, res, locker.db!);
    return { ok: true };
  }));

  r.post("/auth/recover", wrap((req, res) => {
    gate(req, res);
    const { recoveryKey, password } = parse(z.object({ recoveryKey: z.string().min(10).max(100), password: z.string().min(10).max(200) }), req.body);
    if (!locker.recover(recoveryKey, password)) {
      auth.recordFailure(ip(req));
      throw new HttpError(401, "That recovery key doesn't match.");
    }
    auth.clearFailures(ip(req));
    signIn(req, res, locker.db!);
    return { ok: true };
  }));

  r.use(() => {
    throw new HttpError(423, "Sentience is locked. Sign in to unlock it.");
  });
  return r;
}

export function createRootApp({ locker, uploadDir, staticDir, security }: { locker: Locker; uploadDir: string; staticDir?: string; security: Omit<SecurityContext, "locker"> }): express.Express {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
  const sec: SecurityContext = { ...security, locker };
  const app = express();
  applyBase(app);
  const locked = lockedRouter(locker);
  let current: { db: DB; router: Router } | null = null;

  app.use("/api", (req, res, next) => {
    // Recovery works locked or unlocked (signed in elsewhere but forgot the password here).
    if (req.method === "POST" && req.path === "/auth/recover") return locked(req, res, next);
    const bearer = bearerOf(req);
    if (locker.state === "locked" && bearer) {
      const g = auth.loginAllowed(ip(req));
      if (g.ok && !locker.unlockWithDevice(bearer)) auth.recordFailure(ip(req));
    }
    if (locker.state !== "unlocked" || !locker.db) return locked(req, res, next);
    if (bearer) locker.ensureDevice(bearer);
    if (current?.db !== locker.db) current = { db: locker.db, router: buildApi(locker.db, uploadDir, sec) };
    current.router(req, res, next);
  });

  applyStatic(app, staticDir);
  app.use(errorMiddleware);
  return app;
}
