import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import { openDatabase, encryptDatabaseFile, isFileEncrypted } from "../lib/db.js";
import { createApp } from "../app.js";
import { issueSetupCode, hashPassword, verifyPassword } from "../lib/auth.js";

async function boot() {
  const db = openDatabase(":memory:");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentience-sec-"));
  const server = createApp({ db, uploadDir: dir }).listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  return { db, base, close: () => server.close() };
}

test("passwords are hashed and verified", () => {
  const h = hashPassword("a long passphrase");
  assert.match(h, /^scrypt\$/);
  assert.ok(verifyPassword("a long passphrase", h));
  assert.ok(!verifyPassword("a long passphrasf", h));
});

test("API is closed until set up and signed in; setup needs the console code", async () => {
  const { base, close } = await boot();
  try {
    assert.equal((await fetch(`${base}/events`)).status, 401);
    assert.equal((await fetch(`${base}/health-check`)).status, 200);
    const status = await (await fetch(`${base}/auth/status`)).json();
    assert.deepEqual([status.configured, status.authenticated], [false, false]);

    const code = issueSetupCode();
    const bad = await fetch(`${base}/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code: "000-000", password: "long enough pw" }) });
    assert.equal(bad.status, 403);
    const ok = await fetch(`${base}/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, password: "long enough pw" }) });
    assert.equal(ok.status, 200);
    const cookie = ok.headers.get("set-cookie")!;
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    const c = cookie.split(";")[0];

    // Cookie session works for reads...
    assert.equal((await fetch(`${base}/events`, { headers: { cookie: c } })).status, 200);
    // ...but a cookie write without our header is refused (cross-site form protection).
    const csrf = await fetch(`${base}/events`, { method: "POST", headers: { cookie: c, "content-type": "application/json" }, body: JSON.stringify({ category: "note", title: "x", startAt: new Date().toISOString() }) });
    assert.equal(csrf.status, 403);
    const write = await fetch(`${base}/events`, { method: "POST", headers: { cookie: c, "content-type": "application/json", "x-sentience": "1" }, body: JSON.stringify({ category: "note", title: "x", startAt: new Date().toISOString() }) });
    assert.equal(write.status, 201);

    // Setup can't be repeated.
    const again = await fetch(`${base}/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, password: "another long pw" }) });
    assert.equal(again.status, 409);

    // Device tokens are shown once and work as Bearer tokens; revoking kills them.
    const dev = await (await fetch(`${base}/auth/devices`, { method: "POST", headers: { cookie: c, "content-type": "application/json", "x-sentience": "1" }, body: JSON.stringify({ name: "iPhone" }) })).json();
    assert.match(dev.token, /^snt_/);
    assert.equal((await fetch(`${base}/events`, { headers: { authorization: `Bearer ${dev.token}` } })).status, 200);
    await fetch(`${base}/auth/sessions/${dev.id}`, { method: "DELETE", headers: { cookie: c, "x-sentience": "1" } });
    assert.equal((await fetch(`${base}/events`, { headers: { authorization: `Bearer ${dev.token}` } })).status, 401);

    // Security headers and no CORS.
    const res = await fetch(`${base}/auth/status`, { headers: { origin: "https://evil.example" } });
    assert.equal(res.headers.get("access-control-allow-origin"), null);
    assert.match(res.headers.get("content-security-policy") ?? "", /frame-ancestors 'none'/);
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("cache-control"), "no-store");
  } finally {
    close();
  }
});

test("login is rate limited after five wrong passwords", async () => {
  const { base, close } = await boot();
  try {
    const code = issueSetupCode();
    await fetch(`${base}/auth/setup`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ code, password: "the right password" }) });
    const attempt = (pw: string) => fetch(`${base}/auth/login`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: pw }) });
    for (let i = 0; i < 5; i++) assert.equal((await attempt("nope")).status, 401);
    const locked = await attempt("the right password");
    assert.equal(locked.status, 429);
    assert.ok(Number(locked.headers.get("retry-after")) > 0);
  } finally {
    close();
  }
});

test("database encryption: unreadable without the key, opens with it", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentience-enc-"));
  const file = path.join(dir, "s.sqlite");
  const plain = openDatabase(file);
  plain.prepare(`UPDATE profile SET name = 'Secret Name'`).run();
  plain.close();
  assert.equal(isFileEncrypted(file), false);
  assert.ok(fs.readFileSync(file).includes("Secret Name"));

  encryptDatabaseFile(file, "k3y'with quote");
  assert.equal(isFileEncrypted(file), true);
  assert.ok(!fs.readFileSync(file).includes("Secret Name"));
  assert.throws(() => openDatabase(file), /encrypted/);
  assert.throws(() => openDatabase(file, "wrong"), /key is wrong/);
  const db = openDatabase(file, "k3y'with quote");
  assert.equal((db.prepare(`SELECT name FROM profile`).get() as { name: string }).name, "Secret Name");
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
