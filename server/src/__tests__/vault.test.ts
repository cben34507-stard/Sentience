import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { openDatabase, isFileEncrypted } from "../lib/db.js";
import { issueSetupCode, setPassword } from "../lib/auth.js";
import { Locker } from "../lib/locker.js";
import { createRootApp } from "../root.js";
import { newDataKey, newRecoveryKey, newVault, unwrap, wrap, setWrap } from "../lib/vault.js";

const PW = "correct horse battery";
const json = (body: unknown, cookie?: string) => ({
  method: "POST",
  headers: { "content-type": "application/json", "x-sentience": "1", ...(cookie ? { cookie } : {}) },
  body: JSON.stringify(body),
});

function boot(dir: string, envKey: string | null = null) {
  const dbFile = path.join(dir, "s.sqlite");
  const locker = new Locker(dbFile, envKey);
  const server: Server = createRootApp({ locker, uploadDir: path.join(dir, "up"), security: { dbFile, dbKeyConfigured: false, host: "127.0.0.1", tls: false } }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return { locker, dbFile, base, close: () => new Promise<void>((r) => { server.close(() => r()); locker.close(); }) };
}
const cookieOf = (res: Response) => res.headers.get("set-cookie")!.split(";")[0];

test("vault wraps: right secret opens, wrong secret and wrong kind don't", () => {
  const key = newDataKey();
  const rk = newRecoveryKey();
  let v = newVault();
  v = setWrap(v, wrap(key, "password", PW, "password", "Password", { N: 1 << 10, r: 8, p: 1 }));
  v = { ...v, scrypt: { N: 1 << 10, r: 8, p: 1 } };
  v = setWrap(v, wrap(key, "recovery", rk, "recovery", "Recovery"));
  assert.equal(unwrap(v, "password", PW), key);
  assert.equal(unwrap(v, "password", PW + "x"), null);
  assert.equal(unwrap(v, "recovery", rk.toLowerCase().replace(/-/g, " ")), key, "recovery key is forgiving about case and separators");
  assert.equal(unwrap(v, "recovery", PW), null);
  assert.match(rk, /^[A-Z2-9]{4}(-[A-Z2-9]{4}){5}$/);
});

test("fresh install: locked vault end to end", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentience-vault-"));
  let s = boot(dir);
  try {
    let st = await (await fetch(`${s.base}/auth/status`)).json();
    assert.deepEqual([st.configured, st.locked, st.vault], [false, false, true]);
    assert.equal(s.locker.state, "setup");

    const setup = await fetch(`${s.base}/auth/setup`, json({ code: issueSetupCode(), password: PW }));
    assert.equal(setup.status, 200);
    const { recoveryKey } = await setup.json();
    assert.match(recoveryKey, /-/);
    let cookie = cookieOf(setup);

    // Use it, pair a phone.
    assert.equal((await fetch(`${s.base}/events`, json({ category: "note", title: "secret diary line", startAt: "2026-10-15T09:00:00Z" }, cookie))).status, 201);
    const dev = await (await fetch(`${s.base}/auth/devices`, json({ name: "iPhone" }, cookie))).json();

    // Nothing readable on disk: the database is ciphertext and the vault holds only wrapped keys.
    assert.equal(isFileEncrypted(s.dbFile), true);
    const vaultText = fs.readFileSync(`${s.dbFile}.vault.json`, "utf8");
    assert.ok(!vaultText.includes(PW) && !vaultText.includes(recoveryKey) && !vaultText.includes(dev.token));
    for (const f of fs.readdirSync(dir)) {
      const p = path.join(dir, f);
      if (fs.statSync(p).isFile()) assert.ok(!fs.readFileSync(p).includes("secret diary line"), `${f} leaks plaintext`);
    }

    // Lock now: the API stops answering.
    assert.equal((await fetch(`${s.base}/security/lock`, json({}, cookie))).status, 200);
    await new Promise((r) => setTimeout(r, 20));
    assert.equal(s.locker.state, "locked");
    assert.equal((await fetch(`${s.base}/events`, { headers: { cookie } })).status, 423);
    st = await (await fetch(`${s.base}/auth/status`)).json();
    assert.deepEqual([st.configured, st.locked], [true, true]);
    assert.equal((await fetch(`${s.base}/auth/login`, json({ password: "nope nope nope" }))).status, 401);

    // The phone's token unlocks transparently and sees the data.
    const fromPhone = await fetch(`${s.base}/events?date=2026-10-15`, { headers: { authorization: `Bearer ${dev.token}` } });
    assert.equal(fromPhone.status, 200);
    assert.equal((await fromPhone.json())[0].title, "secret diary line");

    // Restart: a new process knows nothing until the password is given.
    await s.close();
    s = boot(dir);
    assert.equal(s.locker.state, "locked");
    const login = await fetch(`${s.base}/auth/login`, json({ password: PW }));
    assert.equal(login.status, 200);
    cookie = cookieOf(login);
    assert.equal((await fetch(`${s.base}/events?date=2026-10-15`, { headers: { cookie } })).status, 200);

    // Revoking the phone also removes its ability to unlock.
    const sessions = await (await fetch(`${s.base}/auth/sessions`, { headers: { cookie } })).json();
    const phone = sessions.find((x: { kind: string }) => x.kind === "device");
    assert.equal((await fetch(`${s.base}/auth/sessions/${phone.id}`, { method: "DELETE", headers: { cookie, "x-sentience": "1" } })).status, 204);
    await s.close();
    s = boot(dir);
    assert.equal((await fetch(`${s.base}/events`, { headers: { authorization: `Bearer ${dev.token}` } })).status, 423);

    // Forgot the password: the recovery key sets a new one.
    assert.equal((await fetch(`${s.base}/auth/recover`, json({ recoveryKey: "AAAA-AAAA-AAAA-AAAA-AAAA-AAAA", password: "brand new password" }))).status, 401);
    const rec = await fetch(`${s.base}/auth/recover`, json({ recoveryKey, password: "brand new password" }));
    assert.equal(rec.status, 200);
    await s.close();
    s = boot(dir);
    assert.equal((await fetch(`${s.base}/auth/login`, json({ password: PW }))).status, 401);
    assert.equal((await fetch(`${s.base}/auth/login`, json({ password: "brand new password" }))).status, 200);
  } finally {
    await s.close();
  }
});

test("older plain install moves to the vault in place", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentience-vault-"));
  const dbFile = path.join(dir, "s.sqlite");
  const db = openDatabase(dbFile);
  setPassword(db, PW);
  db.prepare(`INSERT INTO meta (key, value) VALUES ('marker', 'kept')`).run();
  db.close();

  let s = boot(dir);
  try {
    assert.equal(s.locker.mode, "plain");
    const login = await fetch(`${s.base}/auth/login`, json({ password: PW }));
    const cookie = cookieOf(login);
    assert.equal((await fetch(`${s.base}/security/vault`, json({ password: "wrong password!" }, cookie))).status, 401);
    const res = await fetch(`${s.base}/security/vault`, json({ password: PW }, cookie));
    assert.equal(res.status, 200);
    assert.match((await res.json()).recoveryKey, /-/);
    assert.equal(isFileEncrypted(dbFile), true);
    await s.close();

    s = boot(dir);
    assert.equal(s.locker.state, "locked");
    assert.ok(s.locker.unlockWithPassword(PW));
    assert.equal((s.locker.db!.prepare(`SELECT value FROM meta WHERE key = 'marker'`).get() as { value: string }).value, "kept");
  } finally {
    await s.close();
  }
});
