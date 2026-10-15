/**
 * Owns the database connection and its lock state.
 *
 *   vault mode  the database key exists only inside the vault's wrapped copies;
 *               the server starts locked and opens the database when your
 *               password, recovery key or a device token unwraps it.
 *   key mode    the key comes from SENTIENCE_DB_KEY(_FILE) (older setup).
 *   plain mode  no encryption (older setup).
 *
 * Fresh installs use vault mode unless SENTIENCE_VAULT=off.
 */
import fs from "node:fs";
import type { DB } from "./db.js";
import { isFileEncrypted, openDatabase, rekeyOpenDatabase } from "./db.js";
import * as auth from "./auth.js";
import { newDataKey, newRecoveryKey, newVault, readVault, removeWraps, setWrap, sha256, unwrap, vaultPathFor, wrap, writeVault, type VaultFile } from "./vault.js";

export type LockMode = "vault" | "key" | "plain";
export type LockState = "setup" | "locked" | "unlocked";

export class Locker {
  db: DB | null = null;
  private dataKey: string | null = null;
  readonly vaultFile: string;
  private fresh: boolean;

  constructor(
    readonly dbFile: string,
    private readonly envKey: string | null = null,
    opts: { vaultForNewInstalls?: boolean } = {},
  ) {
    this.vaultFile = vaultPathFor(dbFile);
    const exists = dbFile !== ":memory:" && fs.existsSync(dbFile);
    this.fresh = !exists && !fs.existsSync(this.vaultFile) && !envKey && opts.vaultForNewInstalls !== false;
    if (this.mode !== "vault") this.db = openDatabase(dbFile, envKey);
    if (this.mode === "vault" && envKey && fs.existsSync(this.vaultFile))
      console.warn("  note      SENTIENCE_DB_KEY(_FILE) is ignored: the database is locked with your password now. Delete the old key file.");
  }

  get mode(): LockMode {
    if (this.fresh || fs.existsSync(this.vaultFile)) return "vault";
    return this.envKey ? "key" : "plain";
  }
  get state(): LockState {
    if (this.db) return "unlocked";
    return this.fresh ? "setup" : "locked";
  }
  get encryptedOnDisk(): boolean | null {
    return isFileEncrypted(this.dbFile);
  }

  private vault(): VaultFile {
    const v = readVault(this.vaultFile);
    if (!v) throw new Error("vault file missing");
    return v;
  }
  private open(key: string): DB {
    this.db = openDatabase(this.dbFile, key);
    this.dataKey = key;
    return this.db;
  }

  /** First run in vault mode: creates the database and the vault. Returns the recovery key. */
  setup(password: string): { db: DB; recoveryKey: string } {
    if (this.state !== "setup") throw new Error("already set up");
    const key = newDataKey();
    const recoveryKey = newRecoveryKey();
    let v = newVault();
    v = setWrap(v, wrap(key, "password", password, "password", "Password"));
    v = setWrap(v, wrap(key, "recovery", recoveryKey, "recovery", "Recovery key"));
    const db = this.open(key);
    auth.setPassword(db, password);
    writeVault(this.vaultFile, v);
    this.fresh = false;
    return { db, recoveryKey };
  }

  unlockWithPassword(password: string): boolean {
    if (this.state !== "locked") return this.state === "unlocked" && !!this.db && auth.checkPassword(this.db, password);
    const key = unwrap(this.vault(), "password", password);
    if (!key) return false;
    this.open(key);
    return true;
  }

  /** The iPhone (or any paired device) can unlock after a restart with its own token. */
  unlockWithDevice(token: string): boolean {
    if (this.state !== "locked") return false;
    const key = unwrap(this.vault(), "device", token);
    if (!key) return false;
    const db = this.open(key);
    if (auth.lookup(db, token)?.kind !== "device") {
      // Wrap outlived its session (revoked elsewhere): drop it and stay locked.
      this.lock();
      writeVault(this.vaultFile, removeWraps(this.vault(), (w) => !(w.kind === "device" && w.id === sha256(token))));
      return false;
    }
    return true;
  }

  /** Forgotten password: the recovery key opens the vault and sets a new password. */
  recover(recoveryKey: string, newPassword: string): boolean {
    if (this.mode !== "vault" || this.state === "setup") return false;
    const key = unwrap(this.vault(), "recovery", recoveryKey);
    if (!key) return false;
    const db = this.state === "unlocked" ? this.db! : this.open(key);
    auth.setPassword(db, newPassword);
    // Browsers signed in with the old password are signed out; paired devices stay.
    db.prepare(`DELETE FROM sessions WHERE kind = 'browser'`).run();
    writeVault(this.vaultFile, setWrap(this.vault(), wrap(key, "password", newPassword, "password", "Password")));
    return true;
  }

  lock(): void {
    if (this.mode !== "vault" || !this.db) return;
    this.db.close();
    this.db = null;
    this.dataKey = null;
  }

  /* ---------------- while unlocked ---------------- */

  passwordChanged(password: string): void {
    if (this.mode !== "vault" || !this.dataKey) return;
    writeVault(this.vaultFile, setWrap(this.vault(), wrap(this.dataKey, "password", password, "password", "Password")));
  }

  deviceAdded(token: string, name: string): void {
    if (this.mode !== "vault" || !this.dataKey) return;
    writeVault(this.vaultFile, setWrap(this.vault(), wrap(this.dataKey, "device", token, sha256(token), name)));
  }

  /** Devices paired before the vault existed get their wrap the next time they connect. */
  ensureDevice(token: string): void {
    if (this.mode !== "vault" || !this.db || !this.dataKey) return;
    const id = sha256(token);
    if (this.vault().wraps.some((w) => w.kind === "device" && w.id === id)) return;
    const s = auth.lookup(this.db, token);
    if (s?.kind === "device") this.deviceAdded(token, s.name);
  }

  /** Call after sessions are revoked: a revoked device can no longer unlock. */
  sessionsChanged(): void {
    if (this.mode !== "vault" || !this.db || !fs.existsSync(this.vaultFile)) return;
    const live = new Set((this.db.prepare(`SELECT id FROM sessions WHERE kind = 'device'`).all() as { id: string }[]).map((r) => r.id));
    const v = this.vault();
    const next = removeWraps(v, (w) => w.kind !== "device" || live.has(w.id));
    if (next.wraps.length !== v.wraps.length) writeVault(this.vaultFile, next);
  }

  /** Replaces the recovery key. */
  newRecoveryKey(password: string): string | null {
    if (this.mode !== "vault" || !this.dataKey || !unwrap(this.vault(), "password", password)) return null;
    const recoveryKey = newRecoveryKey();
    writeVault(this.vaultFile, setWrap(this.vault(), wrap(this.dataKey, "recovery", recoveryKey, "recovery", "Recovery key")));
    return recoveryKey;
  }

  /**
   * Moves an older plain or key-file install into vault mode: re-encrypts the
   * database under a fresh key and wraps that key with the password.
   */
  enableVault(password: string): string | null {
    if (this.mode === "vault" || !this.db || !auth.checkPassword(this.db, password)) return null;
    const key = newDataKey();
    const recoveryKey = newRecoveryKey();
    rekeyOpenDatabase(this.db, key);
    let v = newVault();
    v = setWrap(v, wrap(key, "password", password, "password", "Password"));
    v = setWrap(v, wrap(key, "recovery", recoveryKey, "recovery", "Recovery key"));
    writeVault(this.vaultFile, v);
    this.dataKey = key;
    return recoveryKey;
  }

  close(): void {
    this.db?.close();
    this.db = null;
    this.dataKey = null;
  }
}
