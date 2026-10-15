import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, findSupplement } from "@sentience/shared";
import { openDatabase } from "../lib/db.js";
import { updateProfile } from "../services/profile.js";
import { createEvent, listEventsForDay } from "../services/events.js";
import { insertSamplesBulk } from "../services/health.js";
import { createReminder, dosesForDay, markTaken, reminderStatuses, remindersIcs, undoTaken } from "../services/reminders.js";
import { analyse, discover, loadDays, options } from "../services/explore.js";

const TZ = "Europe/London";

test("reminders: doses, ticking off writes a timeline event, adherence and streak", () => {
  const db = openDatabase(":memory:");
  updateProfile(db, { timezone: TZ });
  const r = createReminder(db, { title: "Vitamin D3", kind: "supplement", supplementKey: "vitamin_d3", dose: "1000 IU", times: ["08:00", "20:00"], startedOn: "2026-10-10" });
  // 13 Oct 2026 at 12:00 London (BST, UTC+1)
  const noon = Date.parse("2026-10-13T11:00:00Z");
  const doses = dosesForDay(db, "2026-10-13", TZ, noon);
  assert.deepEqual(doses.map((d) => [d.time, d.status]), [["08:00", "missed"], ["20:00", "upcoming"]]);
  assert.equal(doses[0].dueAt, "2026-10-13T07:00:00.000Z");

  for (const d of ["2026-10-10", "2026-10-11", "2026-10-12"]) {
    markTaken(db, r.id, d, "08:00", TZ);
    markTaken(db, r.id, d, "20:00", TZ);
  }
  markTaken(db, r.id, "2026-10-13", "08:00", TZ);
  markTaken(db, r.id, "2026-10-13", "08:00", TZ); // double tap: still one event
  const ev = listEventsForDay(db, "2026-10-13", TZ);
  assert.equal(ev.length, 1);
  assert.equal(ev[0].category, "supplement");
  assert.equal(ev[0].data.reminder_id, r.id);
  assert.equal(dosesForDay(db, "2026-10-13", TZ, noon)[0].status, "taken");

  const [s] = reminderStatuses(db, TZ, "2026-10-13", noon);
  assert.equal(s.scheduled30, 7); // 3 full days + this morning; tonight isn't due yet
  assert.equal(s.taken30, 7);
  assert.equal(s.adherence, 1);
  assert.equal(s.streak, 4);
  assert.equal(s.daysSinceStart, 3);

  assert.equal(undoTaken(db, r.id, "2026-10-13", "08:00", TZ), true);
  assert.equal(reminderStatuses(db, TZ, "2026-10-13", noon)[0].streak, 0);

  const ics = remindersIcs(db, TZ);
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.equal((ics.match(/BEGIN:VEVENT/g) ?? []).length, 2);
  assert.match(ics, /DTSTART;TZID=Europe\/London:20261010T080000/);
  assert.match(ics, /RRULE:FREQ=WEEKLY;BYDAY=SU,MO,TU,WE,TH,FR,SA/);
  assert.match(ics, /BEGIN:VALARM/);
  assert.match(ics, /SUMMARY:Vitamin D3 \(1000 IU\)/);
});

test("weekday-only reminders and DST", () => {
  const db = openDatabase(":memory:");
  createReminder(db, { title: "Creatine", kind: "supplement", times: ["09:00"], days: [1, 2, 3, 4, 5], startedOn: "2026-10-01" });
  assert.equal(dosesForDay(db, "2026-10-17", TZ).length, 0); // Saturday
  // Clocks go back on 25 Oct 2026: 09:00 is then UTC+0.
  assert.equal(dosesForDay(db, "2026-10-26", TZ)[0].dueAt, "2026-10-26T09:00:00.000Z");
});

test("supplement lookup from reminder titles", () => {
  assert.equal(findSupplement("Vitamin D 4000iu")?.key, findSupplement("vit d3")?.key);
  assert.ok(findSupplement("fish oil 1000mg"));
  assert.ok(findSupplement("Creatine"));
});

test("explorer: late coffee vs that night's sleep", () => {
  const db = openDatabase(":memory:");
  updateProfile(db, { timezone: TZ });
  const start = "2026-08-01";
  for (let i = 0; i < 40; i++) {
    const d = addDays(start, i);
    const late = i % 3 === 0;
    createEvent(db, { category: "drink", title: "Coffee", startAt: `${d}T${late ? "16" : "08"}:30:00+01:00` });
    createEvent(db, { category: "meal", title: "Lunch", startAt: `${d}T12:30:00+01:00` });
    // That night's sleep, ending the next morning: short after late coffee.
    const next = addDays(d, 1);
    const mins = (late ? 380 : 450) + ((i * 7) % 20);
    const end = Date.parse(`${next}T07:00:00+01:00`);
    insertSamplesBulk(db, [
      { type: "HKCategoryTypeIdentifierSleepAnalysis", startAt: new Date(end - mins * 60_000).toISOString(), endAt: new Date(end).toISOString(), value: mins, unit: "min", sourceName: "Watch", categoryValue: "HKCategoryValueSleepAnalysisAsleepCore" },
    ]);
  }
  const days = loadDays(db, TZ, start, addDays(start, 38));
  const r = analyse(days, { x: "text:coffee", y: "sleepMin", lag: 1, afterHour: 14 }, TZ);
  assert.equal(r.kind, "binary");
  assert.equal(r.verdict, "likely");
  assert.ok(r.diff! < -50, `diff ${r.diff}`);
  assert.ok(r.p! < 0.01);
  assert.match(r.summary, /less/);

  // Lunch happens every day, so there is nothing to compare against.
  assert.equal(analyse(days, { x: "text:lunch", y: "sleepMin", lag: 1 }, TZ).verdict, "not-enough");
  assert.ok(options(days).x.some((o) => o.value === "title:coffee"));
  assert.ok(Array.isArray(discover(days, TZ)));
});
