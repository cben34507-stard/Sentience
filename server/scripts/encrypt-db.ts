/**
 * Encrypts the Sentience database in place.
 *
 *   Stop the server first, then:
 *   npm run db:encrypt --workspace=server
 *
 * Writes a random key to data/db.key (mode 600) unless SENTIENCE_DB_KEY is
 * set. Start the server afterwards with SENTIENCE_DB_KEY_FILE pointing to it.
 * For real protection keep that key somewhere other than the data folder
 * (a password manager, or a separate disk) and point the variable there.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { encryptDatabaseFile, isFileEncrypted, openDatabase } from "../src/lib/db.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.SENTIENCE_DATA_DIR ?? path.join(here, "..", "data");
const DB_FILE = process.env.SENTIENCE_DB ?? path.join(DATA_DIR, "sentience.sqlite");

if (!fs.existsSync(DB_FILE)) {
  console.error(`No database at ${DB_FILE}`);
  process.exit(1);
}
if (isFileEncrypted(DB_FILE)) {
  console.log(`${DB_FILE} is already encrypted.`);
  process.exit(0);
}
const backup = `${DB_FILE}.plain-backup`;
fs.copyFileSync(DB_FILE, backup);
const key = process.env.SENTIENCE_DB_KEY ?? randomBytes(32).toString("base64url");
encryptDatabaseFile(DB_FILE, key);
// Prove it opens with the key before telling anyone it worked.
openDatabase(DB_FILE, key).close();
if (!process.env.SENTIENCE_DB_KEY) {
  const keyFile = path.join(DATA_DIR, "db.key");
  fs.writeFileSync(keyFile, key + "\n", { mode: 0o600 });
  console.log(`Encrypted ${DB_FILE}.\nKey written to ${keyFile} (move it somewhere safer and keep a copy in your password manager).`);
  console.log(`Start the server with: SENTIENCE_DB_KEY_FILE=${keyFile} npm start`);
} else {
  console.log(`Encrypted ${DB_FILE} with the key from SENTIENCE_DB_KEY.`);
}
fs.rmSync(backup);
for (const ext of ["-wal", "-shm"]) fs.rmSync(DB_FILE + ext, { force: true });
