import { test } from "node:test";
import assert from "node:assert/strict";
import { openDatabase } from "../lib/db.js";
import { createEvent } from "../services/events.js";
import { nutritionForDay, frequentMeals } from "../services/nutrition.js";
import { createGoal, goalStatus } from "../services/goals.js";
import { insertSamplesBulk } from "../services/health.js";
import { computeInsights } from "../services/insights.js";
import { updateProfile } from "../services/profile.js";
import { aiStatus } from "../services/ai.js";

const TZ = "Europe/London";

test("food and water totals, Apple Health shown separately, water goal from data", () => {
  const db = openDatabase(":memory:");
  updateProfile(db, { timezone: TZ, calorieTarget: 2200, waterTargetMl: 2500 });
  createEvent(db, { category: "meal", title: "Lasagne x2", startAt: "2026-10-13T19:30:00+01:00", data: { slot: "dinner", kcal: 1450, protein_g: 70, carbs_g: 110, fat_g: 75 } });
  createEvent(db, { category: "meal", title: "Garlic bread", startAt: "2026-10-13T19:31:00+01:00", data: { slot: "dinner", kcal: 420, protein_g: 10, carbs_g: 48, fat_g: 20 } });
  createEvent(db, { category: "drink", title: "Water 500 ml", startAt: "2026-10-13T10:00:00+01:00", data: { water_ml: 500 } });
  createEvent(db, { category: "drink", title: "Water 250 ml", startAt: "2026-10-13T15:00:00+01:00", data: { water_ml: 250 } });
  insertSamplesBulk(db, [{ type: "HKQuantityTypeIdentifierDietaryEnergyConsumed", startAt: "2026-10-13T12:00:00+01:00", endAt: "2026-10-13T12:00:00+01:00", value: 600, unit: "kcal", sourceName: "MyFitnessPal" }]);
  const n = nutritionForDay(db, "2026-10-13", TZ);
  assert.equal(n.totals.kcal, 1870);
  assert.equal(n.totals.protein_g, 80);
  assert.equal(n.totals.water_ml, 750);
  assert.equal(n.meals.length, 2);
  assert.equal(n.water.length, 2);
  assert.equal(n.appleHealth.kcal, 600);
  assert.equal(n.targets.kcal, 2200);
  assert.equal(frequentMeals(db).length, 2);

  const g = createGoal(db, { title: "Water", cadence: "daily", target: 2000, unit: "ml", metric: "data:water_ml", startsOn: "2026-10-01" });
  assert.equal(goalStatus(db, g, "2026-10-13", TZ).current, 750);
});

test("insights speak up only with enough data; AI is off without a key", () => {
  const db = openDatabase(":memory:");
  updateProfile(db, { timezone: TZ });
  const thin = computeInsights(db, TZ, "2026-10-14");
  assert.equal(thin[0].id, "thin");

  // Resting HR 52 for four weeks, then 58 for a week → flagged.
  const samples = [];
  for (let i = 35; i >= 1; i--) {
    const d = new Date(Date.UTC(2026, 9, 14 - i, 6));
    samples.push({ type: "HKQuantityTypeIdentifierRestingHeartRate", startAt: d.toISOString(), endAt: d.toISOString(), value: i <= 7 ? 58 : 52, unit: "count/min", sourceName: "Watch" });
  }
  insertSamplesBulk(db, samples);
  const out = computeInsights(db, TZ, "2026-10-14");
  const rhr = out.find((x) => x.id === "rhr-up");
  assert.ok(rhr, JSON.stringify(out));
  assert.match(rhr!.title, /up 6 bpm/);

  const prev = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  assert.equal(aiStatus(db).enabled, false);
  if (prev) process.env.ANTHROPIC_API_KEY = prev;
});
