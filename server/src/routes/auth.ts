import { Router, type Request } from "express";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import type { DB } from "../lib/db.js";
import { isFileEncrypted } from "../lib/db.js";
import { HttpError, parse, wrap } from "../lib/http.js";
import * as auth from "../lib/auth.js";
import { aiStatus } from "../services/ai.js";

export interface SecurityContext {
  dbFile: string;
  dbKeyConfigured: boolean;
  host: string;
  tls: boolean;
}

const ip = (req: Request) => req.ip ?? req.socket.remoteAddress ?? "unknown";

export function buildAuthRouter(db: DB, sec: SecurityContext): Router {
  const r = Router();

  r.get("/auth/status", (req, res) => {
    const bearer = /^Bearer\s+(.+)$/i.exec(req.headers.authorization ?? "")?.[1];
    const token = bearer ?? auth.readCookie(req, auth.COOKIE);
    const s = token ? auth.lookup(db, token) : null;
    res.json({ configured: auth.isConfigured(db), authenticated: !!s, kind: s?.kind ?? null, https: req.secure });
  });

  r.post("/auth/setup", wrap((req, res) => {
    if (auth.isConfigured(db)) throw new HttpError(409, "Already set up. Sign in instead.");
    const { code, password } = parse(z.object({ code: z.string().min(3).max(20), password: z.string().min(10).max(200) }), req.body);
    if (!auth.checkSetupCode(code)) throw new HttpError(403, "That setup code doesn't match the one in the server console.");
    auth.setPassword(db, password);
    auth.clearSetupCode();
    const { token } = auth.createSession(db, "browser", { name: "Browser", ip: ip(req), userAgent: req.headers["user-agent"] });
    auth.setSessionCookie(req, res, token);
    return { ok: true };
  }));

  r.post("/auth/login", wrap((req, res) => {
    const who = ip(req);
    const gate = auth.loginAllowed(who);
    if (!gate.ok) {
      res.setHeader("Retry-After", String(gate.retryAfterS));
      throw new HttpError(429, `Too many attempts. Try again in ${Math.ceil(gate.retryAfterS / 60)} minutes.`);
    }
    const { password } = parse(z.object({ password: z.string().min(1).max(200) }), req.body);
    if (!auth.isConfigured(db) || !auth.checkPassword(db, password)) {
      auth.recordFailure(who);
      throw new HttpError(401, "Wrong password.");
    }
    auth.clearFailures(who);
    const { token } = auth.createSession(db, "browser", { name: "Browser", ip: who, userAgent: req.headers["user-agent"] });
    auth.setSessionCookie(req, res, token);
    return { ok: true };
  }));

  // Everything below is mounted after requireAuth.
  return r;
}

export function buildAccountRouter(db: DB, sec: SecurityContext): Router {
  const r = Router();

  r.post("/auth/logout", wrap((req, res) => {
    if (req.session) auth.revokeSession(db, req.session.id);
    auth.clearSessionCookie(res);
    return { ok: true };
  }));

  r.get("/auth/sessions", wrap((req) => auth.listSessions(db).map((s) => ({ ...s, current: s.id === req.session?.id }))));

  r.delete("/auth/sessions/:id", wrap((req, res) => {
    if (!auth.revokeSession(db, req.params.id)) throw new HttpError(404, "Not found");
    if (req.params.id === req.session?.id) auth.clearSessionCookie(res);
    res.status(204).end();
  }));

  r.post("/auth/devices", wrap((req, res) => {
    const { name } = parse(z.object({ name: z.string().trim().min(1).max(60) }), req.body);
    const { token, id } = auth.createSession(db, "device", { name, ip: ip(req) });
    res.status(201);
    return { id, name, token };
  }));

  r.put("/auth/password", wrap((req) => {
    const { current, next } = parse(z.object({ current: z.string().min(1), next: z.string().min(10).max(200) }), req.body);
    if (!auth.checkPassword(db, current)) throw new HttpError(401, "Current password is wrong.");
    auth.setPassword(db, next);
    // A new password signs out every other browser and device.
    auth.revokeAllExcept(db, req.session?.id ?? null);
    return { ok: true };
  }));

  r.get("/security/checkup", wrap((req) => {
    const encrypted = isFileEncrypted(sec.dbFile);
    const sessions = auth.listSessions(db);
    const dataDir = path.dirname(sec.dbFile);
    let dirPrivate: boolean | null = null;
    try {
      dirPrivate = (fs.statSync(dataDir).mode & 0o077) === 0;
    } catch {
      /* ignore */
    }
    const ai = aiStatus(db);
    type Item = { id: string; ok: boolean | null; title: string; detail: string; fix?: string };
    const items: Item[] = [
      { id: "password", ok: auth.isConfigured(db), title: "Sign-in required", detail: "Every API call needs your password session or a device token. Passwords are stored as scrypt hashes; tokens only as SHA-256 hashes." },
      {
        id: "https",
        ok: req.secure,
        title: req.secure ? "Connection is encrypted (HTTPS)" : "Connection is not encrypted (HTTP)",
        detail: req.secure ? "Traffic between this device and the server can't be read on the network." : "Anyone on the same Wi-Fi could read traffic, including your session cookie.",
        fix: "Install Tailscale on the mini PC and phone, then run `tailscale serve --bg 4477`. Or set SENTIENCE_TLS_CERT and SENTIENCE_TLS_KEY.",
      },
      {
        id: "db",
        ok: encrypted,
        title: encrypted ? "Database is encrypted at rest" : encrypted === false ? "Database file is not encrypted" : "Database location unknown",
        detail: encrypted ? "The SQLite file is unreadable without your key, including backups and copies." : "Someone with the disk or a copy of the file could read everything in it.",
        fix: "Stop the server, run `npm run db:encrypt --workspace=server`, keep the printed key safe, and start with SENTIENCE_DB_KEY_FILE pointing to it.",
      },
      { id: "dir", ok: dirPrivate, title: dirPrivate ? "Data folder is private to the server user" : "Data folder is readable by other users", detail: dataDir, fix: `chmod 700 ${dataDir}` },
      { id: "cors", ok: true, title: "Other websites can't read your data", detail: "No cross-origin access is allowed, and cookie writes need a custom header that only this app sends." },
      { id: "headers", ok: true, title: "Browser hardening headers", detail: "Content Security Policy, no framing, no sniffing, no referrer." },
      {
        id: "host",
        ok: sec.host === "127.0.0.1" || sec.host === "localhost" ? true : null,
        title: sec.host === "0.0.0.0" ? "Listening on your whole network" : `Listening on ${sec.host}`,
        detail: sec.host === "0.0.0.0" ? "Needed for the phone on Wi-Fi. Sign-in still protects it; don't port-forward it to the internet." : "Only reachable from this machine.",
        fix: "With Tailscale, set HOST=127.0.0.1 so the server is only reachable through the tailnet.",
      },
      { id: "sessions", ok: null, title: `${sessions.filter((s) => s.kind === "browser").length} browser sessions, ${sessions.filter((s) => s.kind === "device").length} device tokens`, detail: "Review and revoke anything you don't recognise below." },
      { id: "ai", ok: null, title: ai.enabled ? "AI features are on" : "AI features are off", detail: ai.enabled ? "Only the meal description/photo or the export you assess is sent to Anthropic, per request." : "Nothing is sent to any outside service." },
    ];
    return { items, dbKeyConfigured: sec.dbKeyConfigured, tls: sec.tls };
  }));

  return r;
}
