import type { DB } from "../lib/db.js";
import { dayRange } from "../lib/time.js";
import type { Event, NutritionDay } from "@sentience/shared";
import { listEventsForDay } from "./events.js";
import { cumulativeSum } from "./health.js";
import { getProfile } from "./profile.js";

const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
const r1 = (n: number) => Math.round(n * 10) / 10;

export function isWater(e: Event): boolean {
  return e.category === "drink" && num(e.data?.water_ml) > 0;
}

export function nutritionForDay(db: DB, date: string, tz: string): NutritionDay {
  const events = listEventsForDay(db, date, tz);
  const meals = events.filter((e) => e.category === "meal");
  const water = events.filter(isWater);
  const totals = { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, fibre_g: 0, water_ml: 0 };
  for (const m of meals) {
    totals.kcal += num(m.data?.kcal);
    totals.protein_g += num(m.data?.protein_g);
    totals.carbs_g += num(m.data?.carbs_g);
    totals.fat_g += num(m.data?.fat_g);
    totals.fibre_g += num(m.data?.fibre_g);
  }
  for (const w of events) totals.water_ml += num(w.data?.water_ml);
  (Object.keys(totals) as (keyof typeof totals)[]).forEach((k) => (totals[k] = r1(totals[k])));

  const { start, end } = dayRange(date, tz);
  const p = getProfile(db);
  return {
    date,
    meals,
    water,
    totals,
    appleHealth: {
      kcal: cumulativeSum(db, "HKQuantityTypeIdentifierDietaryEnergyConsumed", start, end),
      protein_g: cumulativeSum(db, "HKQuantityTypeIdentifierDietaryProtein", start, end),
      carbs_g: cumulativeSum(db, "HKQuantityTypeIdentifierDietaryCarbohydrates", start, end),
      fat_g: cumulativeSum(db, "HKQuantityTypeIdentifierDietaryFatTotal", start, end),
      water_ml: cumulativeSum(db, "HKQuantityTypeIdentifierDietaryWater", start, end),
    },
    targets: { kcal: p.calorieTarget ?? null, protein_g: p.proteinTargetG ?? null, water_ml: p.waterTargetMl ?? null },
  };
}

/** Most-logged meals of the last 60 days, for one-tap re-adding. */
export function frequentMeals(db: DB, limit = 12): { title: string; data: Record<string, unknown>; count: number }[] {
  const since = Math.floor(Date.now() / 1000) - 60 * 86400;
  const rows = db
    .prepare(
      `SELECT title, data, COUNT(*) c, MAX(start_s) last FROM events
       WHERE deleted_at IS NULL AND category = 'meal' AND start_s >= ? AND json_extract(data, '$.kcal') IS NOT NULL
       GROUP BY lower(title) ORDER BY c DESC, last DESC LIMIT ?`,
    )
    .all(since, limit) as { title: string; data: string; c: number }[];
  return rows.map((r) => ({ title: r.title, data: JSON.parse(r.data), count: r.c }));
}
