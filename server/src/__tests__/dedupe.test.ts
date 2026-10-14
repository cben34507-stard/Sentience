import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { openDatabase } from "../lib/db.js";
import { parseExport } from "../services/healthImport.js";
import { dailySummary, hourlySeries, insertSamplesBulk, T } from "../services/health.js";
import { sync } from "../services/sync.js";
import { createLab } from "../services/labs.js";

const TZ = "Europe/London";
const rec = (type: string, start: string, end: string, value: string | number, source: string, unit = "count", extra = "") =>
  `<Record type="${type}" sourceName="${source}" unit="${unit}" startDate="${start}" endDate="${end}" value="${value}"${extra ? `>${extra}</Record>` : "/>"}`;
const wrap = (rows: string[]) => `<?xml version="1.0"?><HealthData><ExportDate value="2026-10-14 10:00:00 +0100"/>${rows.join("")}</HealthData>`;

function db() {
  const d = openDatabase(":memory:");
  d.prepare(`UPDATE profile SET timezone = ?`).run(TZ);
  return d;
}
const count = (d: ReturnType<typeof db>) => (d.prepare(`SELECT COUNT(*) c FROM health_samples`).get() as { c: number }).c;

test("re-importing the same export adds nothing", async () => {
  const d = db();
  const xml = wrap([
    rec(T.hr, "2026-10-13 08:00:00 +0100", "2026-10-13 08:00:00 +0100", 61, "Watch", "count/min"),
    rec(T.steps, "2026-10-13 09:00:00 +0100", "2026-10-13 09:10:00 +0100", 800, "Watch"),
  ]);
  const a = await parseExport(d, Readable.from([xml]));
  const b = await parseExport(d, Readable.from([xml]));
  assert.equal(a.added, 2);
  assert.equal(b.added, 0);
  assert.equal(b.skipped, 2);
  assert.equal(a.exportDate, "2026-10-14T10:00:00+01:00");
  assert.equal(count(d), 2);
});

test("HealthKit sync after an export does not duplicate (different offset + fractional seconds)", async () => {
  const d = db();
  await parseExport(d, Readable.from([wrap([rec(T.hr, "2026-10-13 08:00:00 +0100", "2026-10-13 08:00:00 +0100", 61, "Alex’s Apple Watch", "count/min")])]));
  const res = sync(d, {
    deviceId: "phone",
    since: 0,
    events: [],
    goals: [],
    goalProgress: [],
    facts: [],
    labResults: [],
    healthWorkouts: [],
    healthSamples: [
      // Same reading as HealthKit reports it: UTC, milliseconds, straight apostrophe.
      { id: "x", type: T.hr, startAt: "2026-10-13T07:00:00.412Z", endAt: "2026-10-13T07:00:00.412Z", value: 61, unit: "count/min", sourceName: "Alex's Apple Watch" },
      // Genuinely new reading.
      { id: "y", type: T.hr, startAt: "2026-10-13T07:05:00.000Z", endAt: "2026-10-13T07:05:00.000Z", value: 64, unit: "count/min", sourceName: "Alex's Apple Watch" },
    ],
  });
  assert.equal(res.applied.healthSamples, 1);
  assert.equal(res.applied.healthSkipped, 1);
  assert.equal(count(d), 2);
});

test("iPhone and Watch counting the same steps are not added together", () => {
  const d = db();
  insertSamplesBulk(d, [
    { type: T.steps, startAt: "2026-10-13T09:00:00+01:00", endAt: "2026-10-13T09:30:00+01:00", value: 1000, unit: "count", sourceName: "iPhone" },
    { type: T.steps, startAt: "2026-10-13T09:00:00+01:00", endAt: "2026-10-13T09:20:00+01:00", value: 700, unit: "count", sourceName: "Watch" },
    { type: T.steps, startAt: "2026-10-13T09:20:00+01:00", endAt: "2026-10-13T09:40:00+01:00", value: 500, unit: "count", sourceName: "Watch" },
    { type: T.steps, startAt: "2026-10-13T15:00:00+01:00", endAt: "2026-10-13T15:10:00+01:00", value: 300, unit: "count", sourceName: "iPhone" },
  ]);
  const s = dailySummary(d, "2026-10-13", TZ)!;
  // 09:00 hour: max(iPhone 1000, Watch 1200) = 1200; 15:00 hour: 300.
  assert.equal(s.steps, 1500);
  const hourly = hourlySeries(d, T.steps, "2026-10-13", TZ, "sum");
  assert.equal(hourly[9], 1200);
  assert.equal(hourly[15], 300);
});

test("overlapping sleep from two sources is counted once", () => {
  const d = db();
  const sleep = (s: string, e: string, src: string, v: string) => ({
    type: T.sleep, startAt: s, endAt: e, value: (Date.parse(e) - Date.parse(s)) / 60000, unit: "min", categoryValue: v, sourceName: src,
  });
  insertSamplesBulk(d, [
    sleep("2026-10-12T23:00:00+01:00", "2026-10-13T07:00:00+01:00", "Watch", "HKCategoryValueSleepAnalysisAsleepCore"),
    sleep("2026-10-12T23:30:00+01:00", "2026-10-13T07:30:00+01:00", "AutoSleep", "HKCategoryValueSleepAnalysisAsleepUnspecified"),
    sleep("2026-10-12T22:30:00+01:00", "2026-10-13T08:00:00+01:00", "iPhone", "HKCategoryValueSleepAnalysisInBed"),
  ]);
  assert.equal(dailySummary(d, "2026-10-13", TZ)!.sleepMin, 510); // 23:00 → 07:30
});

test("samples Sentience wrote to Apple Health are not imported back", async () => {
  const d = db();
  const meta = `<MetadataEntry key="HKMetadataKeySyncIdentifier" value="sentience-lab-123"/>`;
  const r = await parseExport(d, Readable.from([wrap([
    rec("HKQuantityTypeIdentifierBloodGlucose", "2026-10-13 08:00:00 +0100", "2026-10-13 08:00:00 +0100", 5.1, "Health", "mmol<180.1558800000541>/L", meta),
    rec(T.weight, "2026-10-13 08:00:00 +0100", "2026-10-13 08:00:00 +0100", 78, "Sentience", "kg"),
    rec(T.weight, "2026-10-14 08:00:00 +0100", "2026-10-14 08:00:00 +0100", 78.2, "Scale", "kg"),
  ])]));
  assert.equal(r.added, 1);
  assert.equal(r.skipped, 2);
});

test("the same test result entered twice is kept once", () => {
  const d = db();
  const input = { testKey: "vitd", name: "Vitamin D (25-OH)", value: 48, unit: "nmol/L", takenAt: "2026-09-10T09:00:00+01:00" };
  assert.equal(createLab(d, input).duplicate, false);
  assert.equal(createLab(d, { ...input, takenAt: "2026-09-10T08:00:00Z" }).duplicate, true);
  assert.equal(createLab(d, { ...input, value: 52 }).duplicate, false);
});

test("migration collapses duplicates left by the old dedupe key", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sentience-mig-"));
  const file = path.join(dir, "old.sqlite");
  const old = new Database(file);
  old.exec(`
    CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO meta VALUES ('rev','0');
    CREATE TABLE health_samples (id TEXT PRIMARY KEY, type TEXT NOT NULL, start_at TEXT NOT NULL, end_at TEXT NOT NULL,
      value REAL NOT NULL, unit TEXT NOT NULL DEFAULT '', category_value TEXT, source_name TEXT NOT NULL DEFAULT '', device TEXT);
    CREATE UNIQUE INDEX health_samples_dedupe ON health_samples(type, start_at, end_at, value, source_name);
    CREATE TABLE events (id TEXT PRIMARY KEY, category TEXT NOT NULL, title TEXT NOT NULL, notes TEXT, start_at TEXT NOT NULL, end_at TEXT,
      tags TEXT NOT NULL DEFAULT '[]', rating REAL, data TEXT NOT NULL DEFAULT '{}', source TEXT NOT NULL DEFAULT 'web',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL, deleted_at TEXT, rev INTEGER NOT NULL DEFAULT 0);
    INSERT INTO health_samples VALUES ('a','${T.hr}','2026-10-13T08:00:00+01:00','2026-10-13T08:00:00+01:00',61,'bpm',NULL,'Watch',NULL);
    INSERT INTO health_samples VALUES ('b','${T.hr}','2026-10-13T07:00:00.000Z','2026-10-13T07:00:00.000Z',61,'bpm',NULL,'Watch',NULL);
    INSERT INTO events VALUES ('e','meal','Late snack',NULL,'2026-10-13T23:30:00+01:00',NULL,'[]',NULL,'{}','web','2026-10-13T22:30:00Z','2026-10-13T22:30:00Z',NULL,0);
  `);
  old.close();
  const d = openDatabase(file);
  d.prepare(`UPDATE profile SET timezone = ?`).run(TZ);
  assert.equal(count(d), 1);
  // 23:30 London on the 13th must land on the 13th (the old string compare dropped it).
  const evs = d.prepare(`SELECT start_s FROM events`).all() as { start_s: number }[];
  assert.equal(evs[0].start_s, Date.parse("2026-10-13T22:30:00Z") / 1000);
  d.close();
  fs.rmSync(dir, { recursive: true, force: true });
});
