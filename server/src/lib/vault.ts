/**
 * The vault: the database key is never stored anywhere usable.
 *
 * A random 256-bit data key encrypts the whole database. That key is only kept
 * on disk "wrapped" (AES-256-GCM) under keys derived from things you hold:
 *
 *   - your password            (scrypt, deliberately slow)
 *   - a recovery key            (shown once at setup; for a forgotten password)
 *   - each device token         (so the iPhone can unlock after a restart)
 *
 * The vault file next to the database holds only those wrapped copies, so the
 * disk on its own (a stolen mini PC, a copied backup) can't be read. After a
 * restart the server starts locked and knows nothing until one of the above is
 * presented. While unlocked, the key lives in this process's memory only.
 */
import { createCipheriv, createDecipheriv, createHash, hkdfSync, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export type WrapKind = "password" | "recovery" | "device";
export interface Wrap {
  /** password/recovery: fixed; device: the session id (sha256 of the token). */
  id: string;
  kind: WrapKind;
  label: string;
  salt: string;
  iv: string;
  ct: string;
  tag: string;
  createdAt: string;
}
export interface VaultFile {
  v: 1;
  /** KDF settings for the password wrap. */
  scrypt: { N: number; r: number; p: number };
  wraps: Wrap[];
}

// ~0.3 s per guess on a mini PC; memory-hard so GPUs don't help much.
const SCRYPT = { N: 1 << 17, r: 8, p: 1 };
const MAXMEM = 512 * 1024 * 1024;
const b64 = (b: Buffer) => b.toString("base64");
const unb64 = (s: string) => Buffer.from(s, "base64");

export const vaultPathFor = (dbFile: string) => `${dbFile}.vault.json`;
export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export function readVault(file: string): VaultFile | null {
  if (!fs.existsSync(file)) return null;
  const v = JSON.parse(fs.readFileSync(file, "utf8")) as VaultFile;
  if (v.v !== 1 || !Array.isArray(v.wraps)) throw new Error(`Unrecognised vault file: ${file}`);
  return v;
}

/** Atomic write, owner-only. */
export function writeVault(file: string, v: VaultFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(v, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, file);
}

export function newVault(): VaultFile {
  return { v: 1, scrypt: SCRYPT, wraps: [] };
}

/** A fresh database key, as the passphrase handed to SQLite3 Multiple Ciphers. */
export function newDataKey(): string {
  return randomBytes(32).toString("base64url");
}

/** 120 random bits as 6 groups of 4 (Crockford-ish base32, no 0/O/1/I confusion). */
export function newRecoveryKey(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(24);
  let out = "";
  for (let i = 0; i < 24; i++) out += alphabet[bytes[i] % 32];
  return out.match(/.{4}/g)!.join("-");
}
const normRecovery = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, "");

function kek(kind: WrapKind, secret: string, salt: Buffer, params = SCRYPT): Buffer {
  if (kind === "password") return scryptSync(secret.normalize("NFKC"), salt, 32, { ...params, maxmem: MAXMEM });
  // Recovery keys and device tokens are already high-entropy; HKDF is enough.
  const ikm = kind === "recovery" ? normRecovery(secret) : secret;
  return Buffer.from(hkdfSync("sha256", ikm, salt, `sentience-vault-${kind}`, 32));
}

export function wrap(dataKey: string, kind: WrapKind, secret: string, id: string, label: string, params = SCRYPT): Wrap {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", kek(kind, secret, salt, params), iv);
  c.setAAD(Buffer.from(`${kind}:${id}`));
  const ct = Buffer.concat([c.update(dataKey, "utf8"), c.final()]);
  return { id, kind, label, salt: b64(salt), iv: b64(iv), ct: b64(ct), tag: b64(c.getAuthTag()), createdAt: new Date().toISOString() };
}

function tryUnwrap(w: Wrap, secret: string, params: VaultFile["scrypt"]): string | null {
  try {
    const d = createDecipheriv("aes-256-gcm", kek(w.kind, secret, unb64(w.salt), params), unb64(w.iv));
    d.setAAD(Buffer.from(`${w.kind}:${w.id}`));
    d.setAuthTag(unb64(w.tag));
    return Buffer.concat([d.update(unb64(w.ct)), d.final()]).toString("utf8");
  } catch {
    return null; // wrong secret: GCM authentication fails
  }
}

/** The data key, or null if the secret doesn't open any wrap of that kind. */
export function unwrap(v: VaultFile, kind: WrapKind, secret: string): string | null {
  const candidates = kind === "device" ? v.wraps.filter((w) => w.kind === "device" && w.id === sha256(secret)) : v.wraps.filter((w) => w.kind === kind);
  for (const w of candidates) {
    const k = tryUnwrap(w, secret, v.scrypt);
    if (k) return k;
  }
  return null;
}

export function setWrap(v: VaultFile, w: Wrap): VaultFile {
  return { ...v, wraps: [...v.wraps.filter((x) => !(x.kind === w.kind && x.id === w.id)), w] };
}
export function removeWraps(v: VaultFile, keep: (w: Wrap) => boolean): VaultFile {
  return { ...v, wraps: v.wraps.filter(keep) };
}
