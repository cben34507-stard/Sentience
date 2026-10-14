import type { DB } from "../lib/db.js";
import { newId } from "../lib/ids.js";
import { dayRange } from "../lib/time.js";
import { localHour, type DailyHealthSummary, type HealthSample, type HealthWorkout } from "@sentience/shared";

interface SampleRow {
  id: string;
  type: string;
  start_at: string;
  end_at: string;
  value: number;
  unit: string;
  category_value: string | null;
  source_name: string;
  device: string | null;
}
interface WorkoutRow {
  id: string;
  activity_type: string;
  start_at: string;
  end_at: string;
  duration_min: number;
  energy_kcal: number | null;
  distance_km: number | null;
  source_name: string;
}

const rowToSample = (r: SampleRow): HealthSample => ({
  id: r.id,
  type: r.type,
  startAt: r.start_at,
  endAt: r.end_at,
  value: r.value,
  unit: r.unit,
  sourceName: r.source_name,
  device: r.device,
});
const rowToWorkout = (r: WorkoutRow): HealthWorkout => ({
  id: r.id,
  activityType: r.activity_type,
  startAt: r.start_at,
  endAt: r.end_at,
  durationMin: r.duration_min,
  energyKcal: r.energy_kcal,
  distanceKm: r.distance_km,
  sourceName: r.source_name,
});

export const T = {
  hr: "HKQuantityTypeIdentifierHeartRate",
  rhr: "HKQuantityTypeIdentifierRestingHeartRate",
  hrv: "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
  steps: "HKQuantityTypeIdentifierStepCount",
  distance: "HKQuantityTypeIdentifierDistanceWalkingRunning",
  active: "HKQuantityTypeIdentifierActiveEnergyBurned",
  exercise: "HKQuantityTypeIdentifierAppleExerciseTime",
  spo2: "HKQuantityTypeIdentifierOxygenSaturation",
  weight: "HKQuantityTypeIdentifierBodyMass",
  sleep: "HKCategoryTypeIdentifierSleepAnalysis",
} as const;

/* ---------------- normalisation ---------------- */

/** Normalises common Apple units so summaries can add things up. */
export function normalise(type: string, value: number, unit: string): { value: number; unit: string } {
  switch (unit) {
    case "count/min":
      return { value, unit: "bpm" };
    case "mi":
      return { value: value * 1.609344, unit: "km" };
    case "m":
      return type === T.distance ? { value: value / 1000, unit: "km" } : { value, unit };
    case "lb":
      return { value: value * 0.45359237, unit: "kg" };
    case "Cal":
    case "kcal":
      return { value, unit: "kcal" };
    case "%":
      // Apple stores SpO2 as a fraction in some exports (0.97) and a percent in others.
      return { value: value <= 1 ? value * 100 : value, unit: "%" };
    default:
      return { value, unit };
  }
}

/* ---------------- write ---------------- */

export interface SampleInsert {
  type: string;
  startAt: string;
  endAt: string;
  value: number;
  unit: string;
  categoryValue?: string | null;
  sourceName?: string;
  device?: string | null;
}

export function makeSampleInserter(db: DB) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO health_samples (id, type, start_at, end_at, value, unit, category_value, source_name, device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  return (s: SampleInsert): boolean => {
    const n = normalise(s.type, s.value, s.unit);
    const res = stmt.run(newId(), s.type, s.startAt, s.endAt, n.value, n.unit, s.categoryValue ?? null, s.sourceName ?? "", s.device ?? null);
    return res.changes > 0;
  };
}

export function makeWorkoutInserter(db: DB) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO health_workouts (id, activity_type, start_at, end_at, duration_min, energy_kcal, distance_km, source_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  return (w: Omit<HealthWorkout, "id">): boolean => {
    const res = stmt.run(newId(), w.activityType, w.startAt, w.endAt, w.durationMin, w.energyKcal ?? null, w.distanceKm ?? null, w.sourceName ?? "");
    return res.changes > 0;
  };
}

export function insertSamplesBulk(db: DB, samples: SampleInsert[]): number {
  const insert = makeSampleInserter(db);
  let added = 0;
  db.transaction(() => {
    for (const s of samples) if (insert(s)) added++;
  })();
  return added;
}

export function insertWorkoutsBulk(db: DB, workouts: Omit<HealthWorkout, "id">[]): number {
  const insert = makeWorkoutInserter(db);
  let added = 0;
  db.transaction(() => {
    for (const w of workouts) if (insert(w)) added++;
  })();
  return added;
}

/* ---------------- read ---------------- */

export function listSamples(db: DB, type: string, from: string, to: string, limit = 50_000): HealthSample[] {
  const rows = db
    .prepare(
      `SELECT * FROM health_samples WHERE type = ? AND start_at >= ? AND start_at < ? ORDER BY start_at LIMIT ?`,
    )
    .all(type, from, to, limit) as SampleRow[];
  return rows.map(rowToSample);
}

export function listWorkouts(db: DB, from: string, to: string): HealthWorkout[] {
  const rows = db
    .prepare(`SELECT * FROM health_workouts WHERE start_at >= ? AND start_at < ? ORDER BY start_at`)
    .all(from, to) as WorkoutRow[];
  return rows.map(rowToWorkout);
}

export interface TypeStat {
  type: string;
  count: number;
  first: string;
  last: string;
  unit: string;
}

export function listTypes(db: DB): TypeStat[] {
  return db
    .prepare(
      `SELECT type, COUNT(*) count, MIN(start_at) first, MAX(start_at) last, MAX(unit) unit
       FROM health_samples GROUP BY type ORDER BY count DESC`,
    )
    .all() as TypeStat[];
}

export function healthCoverage(db: DB): { first: string | null; last: string | null; samples: number; workouts: number } {
  const s = db.prepare(`SELECT MIN(start_at) first, MAX(start_at) last, COUNT(*) n FROM health_samples`).get() as {
    first: string | null;
    last: string | null;
    n: number;
  };
  const w = db.prepare(`SELECT COUNT(*) n FROM health_workouts`).get() as { n: number };
  return { first: s.first, last: s.last, samples: s.n, workouts: w.n };
}

function agg(db: DB, type: string, from: string, to: string, fn: "SUM" | "AVG" | "MIN" | "MAX"): number | null {
  const row = db
    .prepare(`SELECT ${fn}(value) v FROM health_samples WHERE type = ? AND start_at >= ? AND start_at < ?`)
    .get(type, from, to) as { v: number | null };
  return row.v == null ? null : round(row.v);
}

const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p;

/**
 * Sleep in Apple exports: category samples whose value names the stage.
 * "InBed" is excluded so the total reflects time actually asleep where staged
 * data exists; older exports only have "Asleep" and we count that.
 */
export function sleepMinutesForNight(db: DB, date: string, tz: string): number | null {
  // Sleep "belonging" to a date = session that ended on that date's morning:
  // window from 18:00 the day before to 18:00 on the date.
  const { start } = dayRange(date, tz);
  const windowStart = new Date(Date.parse(start) - 6 * 3600_000).toISOString();
  const windowEnd = new Date(Date.parse(start) + 18 * 3600_000).toISOString();
  const rows = db
    .prepare(
      `SELECT start_at, end_at, category_value FROM health_samples
       WHERE type = ? AND end_at > ? AND start_at < ?`,
    )
    .all(T.sleep, windowStart, windowEnd) as { start_at: string; end_at: string; category_value: string | null }[];
  if (rows.length === 0) return null;
  const staged = rows.some((r) => r.category_value && /Asleep(Core|Deep|REM)/.test(r.category_value));
  let total = 0;
  for (const r of rows) {
    const v = r.category_value ?? "";
    if (/InBed|Awake/.test(v)) continue;
    if (staged && /AsleepUnspecified$/.test(v)) continue;
    total += (Date.parse(r.end_at) - Date.parse(r.start_at)) / 60_000;
  }
  return round(total, 0);
}

export function dailySummary(db: DB, date: string, tz: string): DailyHealthSummary | null {
  const { start, end } = dayRange(date, tz);
  const summary: DailyHealthSummary = {
    date,
    steps: agg(db, T.steps, start, end, "SUM"),
    distanceKm: agg(db, T.distance, start, end, "SUM"),
    activeKcal: agg(db, T.active, start, end, "SUM"),
    exerciseMin: agg(db, T.exercise, start, end, "SUM"),
    restingHr: agg(db, T.rhr, start, end, "AVG"),
    hrMin: agg(db, T.hr, start, end, "MIN"),
    hrMax: agg(db, T.hr, start, end, "MAX"),
    hrAvg: agg(db, T.hr, start, end, "AVG"),
    hrvAvg: agg(db, T.hrv, start, end, "AVG"),
    sleepMin: sleepMinutesForNight(db, date, tz),
    spo2Avg: agg(db, T.spo2, start, end, "AVG"),
    weightKg: agg(db, T.weight, start, end, "AVG"),
    workouts: listWorkouts(db, start, end),
  };
  const hasAny = Object.entries(summary).some(([k, v]) => k !== "date" && k !== "workouts" && v != null);
  return hasAny || summary.workouts.length > 0 ? summary : null;
}

/** Hourly buckets (0–23). HR → average, everything else → sum. */
export function hourlySeries(db: DB, type: string, date: string, tz: string, mode: "avg" | "sum"): (number | null)[] {
  const { start, end } = dayRange(date, tz);
  const rows = db
    .prepare(`SELECT start_at, value FROM health_samples WHERE type = ? AND start_at >= ? AND start_at < ?`)
    .all(type, start, end) as { start_at: string; value: number }[];
  const sums = new Array<number>(24).fill(0);
  const counts = new Array<number>(24).fill(0);
  for (const r of rows) {
    const h = localHour(r.start_at, tz);
    sums[h] += r.value;
    counts[h] += 1;
  }
  return sums.map((s, i) => (counts[i] === 0 ? null : mode === "avg" ? round(s / counts[i]) : round(s, 0)));
}

/** Compact minute-level series for the timeline chart. */
export function seriesForDay(db: DB, type: string, date: string, tz: string, maxPoints = 600): { t: string; v: number }[] {
  const { start, end } = dayRange(date, tz);
  const rows = db
    .prepare(`SELECT start_at t, value v FROM health_samples WHERE type = ? AND start_at >= ? AND start_at < ? ORDER BY start_at`)
    .all(type, start, end) as { t: string; v: number }[];
  if (rows.length <= maxPoints) return rows;
  // Downsample by averaging into equal-sized buckets so the chart stays light.
  const bucket = Math.ceil(rows.length / maxPoints);
  const out: { t: string; v: number }[] = [];
  for (let i = 0; i < rows.length; i += bucket) {
    const slice = rows.slice(i, i + bucket);
    out.push({ t: slice[0].t, v: round(slice.reduce((a, r) => a + r.v, 0) / slice.length) });
  }
  return out;
}
