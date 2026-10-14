import fs from "node:fs";
import http from "node:http";
import https from "node:https";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { isFileEncrypted, openDatabase } from "./lib/db.js";
import { isConfigured, issueSetupCode } from "./lib/auth.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const PORT = Number(process.env.PORT ?? 4477);
const HOST = process.env.HOST ?? "0.0.0.0";
const DATA_DIR = process.env.SENTIENCE_DATA_DIR ?? path.join(root, "data");
const DB_FILE = process.env.SENTIENCE_DB ?? path.join(DATA_DIR, "sentience.sqlite");
const STATIC_DIR = process.env.SENTIENCE_STATIC_DIR ?? path.resolve(root, "..", "web", "dist");
const TLS_CERT = process.env.SENTIENCE_TLS_CERT;
const TLS_KEY = process.env.SENTIENCE_TLS_KEY;

function readKey(): string | null {
  if (process.env.SENTIENCE_DB_KEY) return process.env.SENTIENCE_DB_KEY;
  const f = process.env.SENTIENCE_DB_KEY_FILE;
  if (f) return fs.readFileSync(f, "utf8").trim();
  return null;
}

const key = readKey();
const db = openDatabase(DB_FILE, key);
const tls = !!(TLS_CERT && TLS_KEY);
const app = createApp({
  db,
  uploadDir: path.join(DATA_DIR, "uploads"),
  staticDir: STATIC_DIR,
  security: { dbFile: DB_FILE, dbKeyConfigured: !!key, host: HOST, tls },
});

const server = tls ? https.createServer({ cert: fs.readFileSync(TLS_CERT!), key: fs.readFileSync(TLS_KEY!) }, app) : http.createServer(app);

server.listen(PORT, HOST, () => {
  const scheme = tls ? "https" : "http";
  const addrs = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => `${scheme}://${i.address}:${PORT}`);
  console.log(`\n  Sentience server\n  database  ${DB_FILE} (${isFileEncrypted(DB_FILE) ? "encrypted" : "NOT encrypted"})\n  local     ${scheme}://localhost:${PORT}`);
  if (HOST === "0.0.0.0") for (const a of addrs) console.log(`  network   ${a}   <- use this in the iOS app`);
  if (!tls) console.log("  warning   plain HTTP: see docs/SECURITY.md to add HTTPS (Tailscale serve is easiest)");
  if (!isConfigured(db)) {
    console.log(`\n  First run: open the app and enter this setup code to choose your password:\n\n      ${issueSetupCode()}\n`);
  }
  console.log("");
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
