import { test } from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { AddressInfo } from "node:net";
import { openDatabase } from "../lib/db.js";
import { appleDateToIso, dayRange } from "../lib/time.js";
import { parseExport } from "../services/healthImport.js";
import { dailySummary, hourlySeries, T } from "../services/health.js";
import { createApp } from "../app.js";
import { bundleToMarkdown, buildBundle } from "../services/exportBundle.js";
import { periodFor } from "../services/goals.js";
import type { Goal } from "@sentience/shared";

const SAMPLE_XML = `<?xml version="1.0" encoding="UTF-8"?>
<HealthData locale="en_GB">
 <ExportDate value="2026-10-14 10:00:00 +0100"/>
 <Me HKCharacteristicTypeIdentifierDateOfBirth="1996-03-02"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" creationDate="2026-10-13 08:01:00 +0100" startDate="2026-10-13 08:00:00 +0100" endDate="2026-10-13 08:00:00 +0100" value="61"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" creationDate="2026-10-13 09:01:00 +0100" startDate="2026-10-13 09:00:00 +0100" endDate="2026-10-13 09:00:00 +0100" value="95"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" creationDate="2026-10-13 09:31:00 +0100" startDate="2026-10-13 09:30:00 +0100" endDate="2026-10-13 09:30:00 +0100" value="105"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" creationDate="2026-10-13 09:10:00 +0100" startDate="2026-10-13 09:00:00 +0100" endDate="2026-10-13 09:10:00 +0100" value="820"/>
 <Record type="HKQuantityTypeIdentifierStepCount" sourceName="iPhone" unit="count" creationDate="2026-10-13 17:10:00 +0100" startDate="2026-10-13 17:00:00 +0100" endDate="2026-10-13 17:10:00 +0100" value="1180"/>
 <Record type="HKQuantityTypeIdentifierDistanceWalkingRunning" sourceName="iPhone" unit="mi" startDate="2026-10-13 09:00:00 +0100" endDate="2026-10-13 09:10:00 +0100" value="1"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-10-12 23:30:00 +0100" endDate="2026-10-13 03:30:00 +0100" value="HKCategoryValueSleepAnalysisAsleepCore"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-10-13 03:30:00 +0100" endDate="2026-10-13 07:00:00 +0100" value="HKCategoryValueSleepAnalysisAsleepDeep"/>
 <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="Apple Watch" startDate="2026-10-12 23:00:00 +0100" endDate="2026-10-13 07:10:00 +0100" value="HKCategoryValueSleepAnalysisInBed"/>
 <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="2026-10-13 08:00:00 +0100" endDate="2026-10-13 08:00:00 +0100" value="61"/>
 <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="31.5" durationUnit="min" sourceName="Apple Watch" startDate="2026-10-13 18:00:00 +0100" endDate="2026-10-13 18:31:30 +0100">
   <WorkoutStatistics type="HKQuantityTypeIdentifierActiveEnergyBurned" sum="312" unit="kcal"/>
   <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" sum="5.1" unit="km"/>
 </Workout>
</HealthData>`;

test("appleDateToIso converts Apple's format", () => {
  assert.equal(appleDateToIso("2026-10-13 08:00:00 +0100"), "2026-10-13T08:00:00+01:00");
  assert.equal(appleDateToIso("2026-10-13 08:00:00 -0500"), "2026-10-13T08:00:00-05:00");
});

test("dayRange respects the timezone", () => {
  const r = dayRange("2026-07-01", "Europe/London");
  assert.equal(r.start, "2026-06-30T23:00:00.000Z");
  assert.equal(r.end, "2026-07-01T23:00:00.000Z");
});

test("Apple Health export parses, dedupes, normalises and summarises", async () => {
  const db = openDatabase(":memory:");
  db.prepare(`UPDATE profile SET timezone = 'Europe/London'`).run();
  const counters = await parseExport(db, Readable.from([SAMPLE_XML]));
  assert.equal(counters.seen, 10);
  assert.equal(counters.skipped, 1);
  assert.equal(counters.added, 9, "duplicate heart-rate row is ignored");
  assert.equal(counters.workouts, 1);

  const s = dailySummary(db, "2026-10-13", "Europe/London");
  assert.ok(s);
  assert.equal(s.steps, 2000);
  assert.equal(s.hrMin, 61);
  assert.equal(s.hrMax, 105);
  assert.equal(s.distanceKm, 1.6, "miles converted to km");
  assert.equal(s.sleepMin, 450, "sleep counts staged asleep rows, ignores InBed");
  assert.equal(s.workouts.length, 1);
  assert.equal(s.workouts[0].energyKcal, 312);
  assert.equal(s.workouts[0].distanceKm, 5.1);
  assert.equal(s.workouts[0].activityType, "Running");

  const hr = hourlySeries(db, T.hr, "2026-10-13", "Europe/London", "avg");
  assert.equal(hr[8], 61);
  assert.equal(hr[9], 100);
  assert.equal(hr[10], null);
});

test("goal periods", () => {
  const g = { cadence: "weekly", startsOn: "2026-01-01", endsOn: null } as Goal;
  assert.deepEqual(periodFor(g, "2026-10-14"), { start: "2026-10-12", end: "2026-10-18" });
  assert.deepEqual(periodFor({ ...g, cadence: "monthly" }, "2026-02-10"), { start: "2026-02-01", end: "2026-02-28" });
});

test("REST API: events, day view, goals, export, sync", async () => {
  const db = openDatabase(":memory:");
  db.prepare(`UPDATE profile SET timezone = 'Europe/London', name = 'Test' `).run();
  await parseExport(db, Readable.from([SAMPLE_XML]));
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), "sentience-test-"));
  const app = createApp({ db, uploadDir });
  const server = app.listen(0);
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
  const j = async (p: string, init?: RequestInit) => {
    const res = await fetch(base + p, { headers: { "content-type": "application/json" }, ...init });
    return { status: res.status, body: res.status === 204 ? null : await res.json() };
  };

  try {
    const created = await j("/events", {
      method: "POST",
      body: JSON.stringify({ category: "meal", title: "Eggs and toast", startAt: "2026-10-13T08:30:00+01:00", tags: ["protein"], data: { kcal: 520 } }),
    });
    assert.equal(created.status, 201);
    assert.equal(created.body.title, "Eggs and toast");

    const bad = await j("/events", { method: "POST", body: JSON.stringify({ category: "nope", title: "x", startAt: "bad" }) });
    assert.equal(bad.status, 400);

    await j("/events", { method: "POST", body: JSON.stringify({ category: "movement", title: "Left the house", startAt: "2026-10-13T09:05:00+01:00" }) });
    await j("/events", { method: "POST", body: JSON.stringify({ category: "mood", title: "Decent", rating: 7, startAt: "2026-10-13T21:00:00+01:00" }) });

    const day = await j("/day?date=2026-10-13");
    assert.equal(day.status, 200);
    assert.equal(day.body.events.length, 3);
    assert.equal(day.body.health.steps, 2000);
    assert.equal(day.body.heartRate.length, 3);

    const goal = await j("/goals", {
      method: "POST",
      body: JSON.stringify({ title: "Walk", cadence: "daily", target: 1500, unit: "steps", metric: "health:HKQuantityTypeIdentifierStepCount", startsOn: "2026-10-01" }),
    });
    assert.equal(goal.status, 201);
    const goalsOnDay = await j("/goals?date=2026-10-13");
    assert.equal(goalsOnDay.body[0].complete, true);
    assert.equal(goalsOnDay.body[0].current, 2000);

    const md = await fetch(`${base}/export?date=2026-10-13&format=md`).then((r) => r.text());
    assert.match(md, /Eggs and toast/);
    assert.match(md, /Steps 2000/);
    assert.match(md, /HR that hour/);

    const bundle = buildBundle(db, "2026-10-12", "2026-10-13");
    assert.equal(bundle.days.length, 2);
    assert.equal(bundle.days[1].events.length, 3);
    assert.ok(bundleToMarkdown(bundle).includes("## Days"));

    // Sync: device pushes a new event and pulls everything since 0.
    const now = new Date().toISOString();
    const pushed = await j("/sync", {
      method: "POST",
      body: JSON.stringify({
        deviceId: "iphone-test",
        since: 0,
        events: [
          { id: "dev-1", category: "hygiene", title: "Brushed teeth", startAt: "2026-10-13T07:20:00+01:00", tags: [], data: {}, source: "ios", createdAt: now, updatedAt: now },
        ],
      }),
    });
    assert.equal(pushed.status, 200);
    assert.equal(pushed.body.applied.events, 1);
    assert.equal(pushed.body.events.length, 4, "pull includes server events plus the device's own");
    assert.ok(pushed.body.cursor > 0);

    // Second sync with the cursor returns nothing new.
    const again = await j("/sync", { method: "POST", body: JSON.stringify({ deviceId: "iphone-test", since: pushed.body.cursor }) });
    assert.equal(again.body.events.length, 0);

    const ach = await j("/achievements");
    assert.ok(ach.body.find((a: { code: string }) => a.code === "first_event").unlockedAt);
    assert.ok(ach.body.find((a: { code: string }) => a.code === "health_import").unlockedAt);

    // Test results
    const lab = await j("/labs", { method: "POST", body: JSON.stringify({ testKey: "vitd", name: "Vitamin D (25-OH)", value: 48, unit: "nmol/L", refLow: 50, refHigh: 125, takenAt: "2026-10-13T09:00:00+01:00", lab: "GP" }) });
    assert.equal(lab.status, 201);
    const again2 = await j("/labs", { method: "POST", body: JSON.stringify({ testKey: "vitd", name: "Vitamin D (25-OH)", value: 48, unit: "nmol/L", takenAt: "2026-10-13T08:00:00Z" }) });
    assert.equal(again2.body.duplicate, true);
    const labsList = await j("/labs");
    assert.equal(labsList.body.length, 1);
    const md2 = await fetch(`${base}/export?date=2026-10-13&format=md`).then((r) => r.text());
    assert.match(md2, /## Test results/);
    assert.match(md2, /LOW/);
    assert.doesNotMatch(md2, /\p{Extended_Pictographic}/u);

    const tl = await j("/timeline?from=2026-10-12&to=2026-10-13");
    assert.equal(tl.body.days.length, 2);
    assert.equal(tl.body.days[1].sleep.length, 1);
    assert.ok(tl.body.days[1].events.length >= 3);

    // Uploading the identical export twice: the second job is marked duplicate.
    const upload = async () => {
      const fd = new FormData();
      fd.append("file", new Blob([SAMPLE_XML], { type: "text/xml" }), "export.xml");
      const res = await fetch(`${base}/health/import`, { method: "POST", body: fd });
      return (await res.json()) as { id: string };
    };
    const waitJob = async (id: string) => {
      for (let i = 0; i < 100; i++) {
        const jb = (await j(`/health/import/${id}`)).body;
        if (!["queued", "hashing", "running"].includes(jb.status)) return jb;
        await new Promise((r) => setTimeout(r, 20));
      }
      throw new Error("import did not finish");
    };
    const first = await waitJob((await upload()).id);
    assert.equal(first.status, "done");
    assert.equal(first.recordsAdded, 0, "everything was already on record from the earlier parse");
    const second = await waitJob((await upload()).id);
    assert.equal(second.status, "duplicate");

    const del = await j(`/events/${created.body.id}`, { method: "DELETE" });
    assert.equal(del.status, 204);
    const after = await j("/day?date=2026-10-13");
    assert.equal(after.body.events.length, 3);
  } finally {
    server.close();
    fs.rmSync(uploadDir, { recursive: true, force: true });
  }
});
