import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";
import { openDatabase } from "./lib/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const PORT = Number(process.env.PORT ?? 4477);
const HOST = process.env.HOST ?? "0.0.0.0";
const DATA_DIR = process.env.SENTIENCE_DATA_DIR ?? path.join(root, "data");
const DB_FILE = process.env.SENTIENCE_DB ?? path.join(DATA_DIR, "sentience.sqlite");
const STATIC_DIR = process.env.SENTIENCE_STATIC_DIR ?? path.resolve(root, "..", "web", "dist");

const db = openDatabase(DB_FILE);
const app = createApp({ db, uploadDir: path.join(DATA_DIR, "uploads"), staticDir: STATIC_DIR });

app.listen(PORT, HOST, () => {
  const addrs = Object.values(os.networkInterfaces())
    .flat()
    .filter((i): i is os.NetworkInterfaceInfo => !!i && i.family === "IPv4" && !i.internal)
    .map((i) => `http://${i.address}:${PORT}`);
  console.log(`\n  Sentience server\n  database  ${DB_FILE}\n  local     http://localhost:${PORT}`);
  for (const a of addrs) console.log(`  network   ${a}   ← use this in the iOS app`);
  console.log("");
});

process.on("SIGINT", () => {
  db.close();
  process.exit(0);
});
