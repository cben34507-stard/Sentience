/**
 * Seeds a demo fortnight so the UI has something to show.
 *   npm run seed --workspace=server            (writes to the default DB)
 *   SENTIENCE_DB=/tmp/x.sqlite npm run seed --workspace=server
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openDatabase } from "../src/lib/db.js";
import { createEvent } from "../src/services/events.js";
import { insertSamplesBulk, insertWorkoutsBulk, T, type SampleInsert } from "../src/services/health.js";
import { createGoal } from "../src/services/goals.js";
import { createFact, updateProfile } from "../src/services/profile.js";
import { createLab } from "../src/services/labs.js";
import { addDays } from "@sentience/shared";

const here = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.SENTIENCE_DB ?? path.join(here, "..", "data", "sentience.sqlite");
const db = openDatabase(DB_FILE);
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

updateProfile(db, {
  name: "Demo Person",
  dateOfBirth: "1995-06-14",
  sex: "male",
  heightCm: 180,
  weightKg: 78,
  timezone: tz,
  bio: "Works from home three days a week. Trying to get a steadier morning and sleep before midnight.",
});
// Fictional demo record. Nothing here describes a real person.
createFact(db, { kind: "condition", key: "Hay fever (demo)", value: "Seasonal, spring and early summer.", source: "Demo data", recordedOn: "2020-04-01" });
createFact(db, { kind: "medication", key: "Cetirizine (demo)", value: "10 mg in the morning during pollen season.", source: "Demo data", recordedOn: null });
createFact(db, { kind: "preference", key: "Chronotype (demo)", value: "Prefers mornings; sleepy by 22:30.", source: "Demo data", recordedOn: null });

const today = new Date();
const iso = (d: string, h: number, m = 0) => {
  const dt = new Date(`${d}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`);
  return dt.toISOString();
};
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

const samples: SampleInsert[] = [];
const workouts = [];
for (let i = 13; i >= 0; i--) {
  const d = addDays(today.toISOString().slice(0, 10), -i);
  const workoutDay = i % 3 === 0;
  const lateNight = i % 4 === 1;

  // Events
  createEvent(db, { category: "wake", title: "Woke up", startAt: iso(d, lateNight ? 8 : 7, 10 + Math.round(rnd(0, 30))), source: "import" });
  createEvent(db, { category: "hygiene", title: "Brushed teeth", startAt: iso(d, lateNight ? 8 : 7, 45), source: "import" });
  createEvent(db, { category: "meal", title: i % 2 ? "Porridge, banana, coffee" : "Eggs on toast, coffee", startAt: iso(d, 8, 20), tags: ["breakfast"], data: { kcal: 480 + Math.round(rnd(-60, 90)) }, source: "import" });
  createEvent(db, { category: "supplement", title: "Vitamin D + omega-3", startAt: iso(d, 8, 25), source: "import" });
  createEvent(db, { category: "medication", title: "Cetirizine 10 mg", startAt: iso(d, 8, 30), source: "import" });
  if (i % 7 < 5) {
    createEvent(db, { category: "movement", title: "Left the house", startAt: iso(d, 9, 5), source: "import" });
    createEvent(db, { category: "work", title: "Deep work block", startAt: iso(d, 9, 45), endAt: iso(d, 12, 30), rating: Math.round(rnd(5, 9)), source: "import" });
    createEvent(db, { category: "meal", title: "Chicken wrap and salad", startAt: iso(d, 13, 0), tags: ["lunch"], data: { kcal: 620 }, source: "import" });
    createEvent(db, { category: "movement", title: "Got back home", startAt: iso(d, 17, 50), source: "import" });
  } else {
    createEvent(db, { category: "meal", title: "Leftovers", startAt: iso(d, 13, 30), tags: ["lunch"], source: "import" });
    createEvent(db, { category: "leisure", title: "Long walk and podcast", startAt: iso(d, 15, 0), endAt: iso(d, 16, 10), source: "import" });
  }
  if (workoutDay) {
    createEvent(db, { category: "workout", title: "Gym — push day", startAt: iso(d, 18, 15), endAt: iso(d, 19, 10), rating: 8, source: "import" });
    workouts.push({ activityType: "TraditionalStrengthTraining", startAt: iso(d, 18, 15), endAt: iso(d, 19, 10), durationMin: 55, energyKcal: 410, distanceKm: null, sourceName: "Apple Watch" });
  }
  createEvent(db, { category: "meal", title: "Salmon, rice, greens", startAt: iso(d, 19, 45), tags: ["dinner"], data: { kcal: 740 }, source: "import" });
  createEvent(db, { category: "mood", title: lateNight ? "Flat and foggy" : "Steady", rating: lateNight ? 4 : Math.round(rnd(6, 8)), startAt: iso(d, 21, 0), source: "import" });
  createEvent(db, { category: "sleep", title: "Went to bed", startAt: iso(d, lateNight ? 23 : 22, lateNight ? 55 : 40), source: "import" });

  // Health samples: HR every 10 minutes, steps hourly, sleep, RHR, HRV.
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 10) {
      const asleep = h < 7 || h >= 23;
      let hr = asleep ? rnd(50, 60) : rnd(66, 82);
      if (workoutDay && h === 18) hr = rnd(120, 160);
      if (h === 9 && i % 7 < 5) hr = rnd(85, 100); // commute
      samples.push({ type: T.hr, startAt: iso(d, h, m), endAt: iso(d, h, m), value: Math.round(hr), unit: "count/min", sourceName: "Apple Watch" });
    }
    const steps = h < 7 || h >= 23 ? 0 : h === 9 || h === 17 ? rnd(1200, 1800) : rnd(100, 600);
    if (steps > 0) {
      samples.push({ type: T.steps, startAt: iso(d, h, 0), endAt: iso(d, h, 59), value: Math.round(steps), unit: "count", sourceName: "iPhone" });
      // The Watch counts the same walking; totals must not double.
      samples.push({ type: T.steps, startAt: iso(d, h, 2), endAt: iso(d, h, 58), value: Math.round(steps * 0.93), unit: "count", sourceName: "Apple Watch" });
    }
  }
  samples.push({ type: T.rhr, startAt: iso(d, 6, 0), endAt: iso(d, 6, 0), value: Math.round(rnd(52, 58) + (lateNight ? 4 : 0)), unit: "count/min", sourceName: "Apple Watch" });
  samples.push({ type: T.hrv, startAt: iso(d, 6, 0), endAt: iso(d, 6, 0), value: Math.round(rnd(35, 60) - (lateNight ? 10 : 0)), unit: "ms", sourceName: "Apple Watch" });
  const bed = lateNight ? 0 : 23;
  const prev = addDays(d, -1);
  samples.push({ type: T.sleep, startAt: iso(bed === 0 ? d : prev, bed, 10), endAt: iso(d, 3, 0), value: 0, unit: "min", categoryValue: "HKCategoryValueSleepAnalysisAsleepCore", sourceName: "Apple Watch" });
  samples.push({ type: T.sleep, startAt: iso(d, 3, 0), endAt: iso(d, lateNight ? 7 : 6, 50), value: 0, unit: "min", categoryValue: "HKCategoryValueSleepAnalysisAsleepDeep", sourceName: "Apple Watch" });
}
// category samples carry duration as value
for (const s of samples) if (s.type === T.sleep) s.value = (Date.parse(s.endAt) - Date.parse(s.startAt)) / 60_000;

const added = insertSamplesBulk(db, samples);
const addedW = insertWorkoutsBulk(db, workouts);

createGoal(db, { title: "8,000 steps", cadence: "daily", target: 8000, unit: "steps", metric: `health:${T.steps}`, startsOn: addDays(today.toISOString().slice(0, 10), -13) });
createGoal(db, { title: "3 workouts a week", cadence: "weekly", target: 3, unit: "sessions", metric: "events:workout", startsOn: addDays(today.toISOString().slice(0, 10), -13) });
createGoal(db, { title: "Read 20 pages", cadence: "daily", target: 20, unit: "pages", metric: "manual", startsOn: addDays(today.toISOString().slice(0, 10), -13) });

const labs: [string, string, string, number, string, number | null, number | null, string][] = [
  ["vitd", "Vitamin D (25-OH)", "Vitamins & iron", 38, "nmol/L", 50, 125, "-150"],
  ["vitd", "Vitamin D (25-OH)", "Vitamins & iron", 48, "nmol/L", 50, 125, "-60"],
  ["vitd", "Vitamin D (25-OH)", "Vitamins & iron", 71, "nmol/L", 50, 125, "-5"],
  ["hba1c", "HbA1c", "Diabetes", 36, "mmol/mol", null, 41, "-150"],
  ["hba1c", "HbA1c", "Diabetes", 38, "mmol/mol", null, 41, "-5"],
  ["chol_total", "Total cholesterol", "Lipids", 5.4, "mmol/L", null, 5.0, "-150"],
  ["chol_total", "Total cholesterol", "Lipids", 4.9, "mmol/L", null, 5.0, "-5"],
  ["ldl", "LDL cholesterol", "Lipids", 3.3, "mmol/L", null, 3.0, "-5"],
  ["hdl", "HDL cholesterol", "Lipids", 1.4, "mmol/L", 1.0, null, "-5"],
  ["ferritin", "Ferritin", "Vitamins & iron", 96, "µg/L", 30, 400, "-5"],
  ["bp_sys", "Blood pressure (systolic)", "Clinic measurements", 124, "mmHg", null, 140, "-5"],
  ["bp_dia", "Blood pressure (diastolic)", "Clinic measurements", 79, "mmHg", null, 90, "-5"],
];
const todayStr = today.toISOString().slice(0, 10);
for (const [testKey, name, panel, value, unit, refLow, refHigh, offset] of labs) {
  createLab(db, { testKey, name, panel, value, unit, refLow, refHigh, takenAt: iso(addDays(todayStr, Number(offset)), 9, 10), lab: "GP surgery" });
}

console.log(`seeded ${DB_FILE}: ${added} health samples, ${addedW} workouts, 14 days of events, 3 goals`);
