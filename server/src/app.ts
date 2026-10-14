import express from "express";
import fs from "node:fs";
import path from "node:path";
import type { DB } from "./lib/db.js";
import { errorMiddleware } from "./lib/http.js";
import { requireAuth } from "./lib/auth.js";
import { buildRouter } from "./routes/index.js";
import { buildAccountRouter, buildAuthRouter, type SecurityContext } from "./routes/auth.js";

export interface AppOptions {
  db: DB;
  uploadDir: string;
  /** Built web app (web/dist). Served when present so the mini PC runs one process. */
  staticDir?: string;
  security?: Partial<SecurityContext>;
}

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
].join("; ");

export function createApp({ db, uploadDir, staticDir, security }: AppOptions): express.Express {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o700 });
  const sec: SecurityContext = { dbFile: ":memory:", dbKeyConfigured: false, host: "0.0.0.0", tls: false, ...security };
  const app = express();
  app.disable("x-powered-by");
  // Trust X-Forwarded-* only from a proxy on this machine (Tailscale serve, Caddy).
  app.set("trust proxy", "loopback");

  app.use((req, res, next) => {
    res.setHeader("Content-Security-Policy", CSP);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()");
    if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    if (req.path.startsWith("/api")) res.setHeader("Cache-Control", "no-store");
    next();
  });
  app.use(express.json({ limit: "20mb" }));

  // Public: sign-in endpoints and a liveness check. Everything else needs a session.
  app.use("/api", buildAuthRouter(db, sec));
  app.use("/api", requireAuth(db, ["/health-check", "/auth/status", "/auth/setup", "/auth/login"]));
  app.use("/api", buildAccountRouter(db, sec));
  app.use("/api", buildRouter(db, uploadDir));

  if (staticDir && fs.existsSync(path.join(staticDir, "index.html"))) {
    app.use(express.static(staticDir, { maxAge: "1h", index: false }));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api")) return next();
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  app.use(errorMiddleware);
  return app;
}
