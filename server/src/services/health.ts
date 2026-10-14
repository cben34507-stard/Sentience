import type { DB } from "../lib/db.js";
import { sourceKey, toEpochS } from "../lib/db.js";
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

/** The display name the iPhone app writes under; its own samples are never re-imported. */
export const OWN_SOURCE = "Sentience";

/** Types where several readings average rather than add up. */
export function isRateType(type: string): boolean {
  return /HeartRate|Variability|OxygenSaturation|BodyMass|BodyFat|VO2Max|RespiratoryRate|Temperature|BloodPressure|BloodGlucose|WalkingSpeed|Audio/.test(type);
}

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

/**
 * Every health write goes through here. The unique index is
 * (type, start second, end second, normalised source), so the same reading
 * arriving from export.zip, from HealthKit sync, or from a second import of
 * the same export lands once. Timestamps are compared as instants, so
 * "08:00+01:00" from the export and "07:00:00.123Z" from HealthKit match.
 */
export function makeSampleInserter(db: DB) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO health_samples (id, type, start_at, end_at, start_s, end_s, value, unit, category_value, source_name, source_key, device)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  return (s: SampleInsert): boolean => {
    if (s.sourceName === OWN_SOURCE) return false;
    const n = normalise(s.type, s.value, s.unit);
    const res = stmt.run(
      newId(),
      s.type,
      s.startAt,
      s.endAt,
      toEpochS(s.startAt),
      toEpochS(s.endAt),
      n.value,
      n.unit,
      s.categoryValue ?? null,
      s.sourceName ?? "",
      sourceKey(s.sourceName),
      s.device ?? null,
    );
    return res.changes > 0;
  };
}

export function makeWorkoutInserter(db: DB) {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO health_workouts (id, activity_type, start_at, end_at, start_s, end_s, duration_min, energy_kcal, distance_km, source_name, source_key)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  return (w: Omit<HealthWorkout, "id">): boolean => {
    if (w.sourceName === OWN_SOURCE) return false;
    const res = stmt.run(
      newId(),
      w.activityType,
      w.startAt,
      w.endAt,
      toEpochS(w.startAt),
      toEpochS(w.endAt),
      w.durationMin,
      w.energyKcal ?? null,
      w.distanceKm ?? null,
      w.sourceName ?? "",
      sourceKey(w.sourceName),
    );
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

const round = (n: number, p = 1) => Math.round(n * 10 ** p) / 10 ** p;

export function listSamples(db: DB, type: string, from: string, to: string, limit = 50_000): HealthSample[] {
  const rows = db
    .prepare(`SELECT * FROM health_samples WHERE type = ? AND start_s >= ? AND start_s < ? ORDER BY start_s LIMIT ?`)
    .all(type, toEpochS(from), toEpochS(to), limit) as SampleRow[];
  return rows.map(rowToSample);
}

/**
 * Workouts in range. When two sources logged the same session (Watch and a
 * gym app), keep one: overlapping sessions collapse to the longest.
 */
export function listWorkouts(db: DB, from: string, to: string): HealthWorkout[] {
  const rows = db
    .prepare(`SELECT *, start_s, end_s FROM health_workouts WHERE start_s >= ? AND start_s < ? ORDER BY start_s`)
    .all(toEpochS(from), toEpochS(to)) as (WorkoutRow & { start_s: number; end_s: number })[];
  const kept: (WorkoutRow & { start_s: number; end_s: number })[] = [];
  for (const r of rows) {
    const clash = kept.find((k) => r.start_s < k.end_s && k.start_s < r.end_s && overlapRatio(k, r) > 0.6);
    if (!clash) kept.push(r);
    else if (r.end_s - r.start_s > clash.end_s - clash.start_s) kept[kept.indexOf(clash)] = r;
  }
  return kept.map(rowToWorkout);
}

function overlapRatio(a: { start_s: number; end_s: number }, b: { start_s: number; end_s: number }): number {
  const inter = Math.min(a.end_s, b.end_s) - Math.max(a.start_s, b.start_s);
  const shorter = Math.min(a.end_s - a.start_s, b.end_s - b.start_s) || 1;
  return inter / shorter;
}

export interface TypeStat {
  type: string;
  count: number;
  first: string;
  last: string;
  unit: string;
  sources: number;
}

export function listTypes(db: DB): TypeStat[] {
  return db
    .prepare(
      `SELECT type, COUNT(*) count, MIN(start_at) first, MAX(start_at) last, MAX(unit) unit, COUNT(DISTINCT source_key) sources
       FROM health_samples GROUP BY type ORDER BY count DESC`,
    )
    .all() as TypeStat[];
}

export function healthCoverage(db: DB): { first: string | null; last: string | null; samples: number; workouts: number; sources: string[] } {
  const s = db.prepare(`SELECT MIN(start_s) first, MAX(start_s) last, COUNT(*) n FROM health_samples`).get() as {
    first: number | null;
    last: number | null;
    n: number;
  };
  const w = db.prepare(`SELECT COUNT(*) n FROM health_workouts`).get() as { n: number };
  const sources = (db.prepare(`SELECT DISTINCT source_name s FROM health_samples ORDER BY s`).all() as { s: string }[]).map((r) => r.s);
  const iso = (n: number | null) => (n == null ? null : new Date(n * 1000).toISOString());
  return { first: iso(s.first), last: iso(s.last), samples: s.n, workouts: w.n, sources };
}

function agg(db: DB, type: string, from: string, to: string, fn: "AVG" | "MIN" | "MAX"): number | null {
  const row = db
    .prepare(`SELECT ${fn}(value) v FROM health_samples WHERE type = ? AND start_s >= ? AND start_s < ?`)
    .get(type, toEpochS(from), toEpochS(to)) as { v: number | null };
  return row.v == null ? null : round(row.v);
}

/**
 * Totals for additive types (steps, distance, energy, exercise minutes)
 * without double counting. An iPhone in your pocket and a Watch on your
 * wrist both count the same steps, so per hour we take the busiest source
 * rather than adding them together — close to what the Health app shows.
 */
export function cumulativeSum(db: DB, type: string, from: string, to: string): number | null {
  const row = db
    .prepare(
      `SELECT SUM(m) v, COUNT(*) n FROM (
         SELECT bucket, MAX(s) m FROM (
           SELECT start_s / 3600 bucket, source_key, SUM(value) s
           FROM health_samples WHERE type = ? AND start_s >= ? AND start_s < ?
           GROUP BY bucket, source_key
         ) GROUP BY bucket
       )`,
    )
    .get(type, toEpochS(from), toEpochS(to)) as { v: number | null; n: number };
  return row.n === 0 || row.v == null ? null : round(row.v);
}

/** Merges overlapping [start, end) intervals and returns total seconds. */
export function unionSeconds(intervals: [number, number][]): number {
  if (intervals.length === 0) return 0;
  const sorted = [...intervals].sort((a, b) => a[0] - b[0]);
  let total = 0;
  let [cs, ce] = sorted[0];
  for (const [s, e] of sorted.slice(1)) {
    if (s <= ce) ce = Math.max(ce, e);
    else {
      total += ce - cs;
      cs = s;
      ce = e;
    }
  }
  return total + (ce - cs);
}

/** Merged asleep intervals for the night that ended on `date`'s morning. */
export function sleepIntervalsForNight(db: DB, date: string, tz: string): [number, number][] {
  const { start } = dayRange(date, tz);
  const s0 = toEpochS(start);
  const windowStart = s0 - 6 * 3600;
  const windowEnd = s0 + 18 * 3600;
  const rows = db
    .prepare(
      `SELECT start_s, end_s, category_value FROM health_samples
       WHERE type = ? AND end_s > ? AND start_s < ?`,
    )
    .all(T.sleep, windowStart, windowEnd) as { start_s: number; end_s: number; category_value: string | null }[];
  // Watch, iPhone and third-party sleep apps overlap; union the asleep spans so
  // the night is counted once whichever devices recorded it.
  const asleep = rows.filter((r) => !/InBed|Awake/.test(r.category_value ?? "")).map((r) => [r.start_s, r.end_s] as [number, number]);
  if (asleep.length === 0) return [];
  const sorted = asleep.sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [sorted[0].slice() as [number, number]];
  for (const [s, e] of sorted.slice(1)) {
    const last = merged[merged.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  return merged;
}

export function sleepMinutesForNight(db: DB, date: string, tz: string): number | null {
  const merged = sleepIntervalsForNight(db, date, tz);
  if (merged.length === 0) return null;
  return round(unionSeconds(merged) / 60, 0);
}

export function dailySummary(db: DB, date: string, tz: string): DailyHealthSummary | null {
  const { start, end } = dayRange(date, tz);
  const summary: DailyHealthSummary = {
    date,
    steps: cumulativeSum(db, T.steps, start, end),
    distanceKm: cumulativeSum(db, T.distance, start, end),
    activeKcal: cumulativeSum(db, T.active, start, end),
    exerciseMin: cumulativeSum(db, T.exercise, start, end),
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

/** Hourly buckets (0–23). Rates → average; additive types → busiest source per hour. */
export function hourlySeries(db: DB, type: string, date: string, tz: string, mode: "avg" | "sum"): (number | null)[] {
  const { start, end } = dayRange(date, tz);
  const rows = db
    .prepare(`SELECT start_at, value, source_key FROM health_samples WHERE type = ? AND start_s >= ? AND start_s < ?`)
    .all(type, toEpochS(start), toEpochS(end)) as { start_at: string; value: number; source_key: string }[];
  if (mode === "avg") {
    const sums = new Array<number>(24).fill(0);
    const counts = new Array<number>(24).fill(0);
    for (const r of rows) {
      const h = localHour(r.start_at, tz);
      sums[h] += r.value;
      counts[h] += 1;
    }
    return sums.map((s, i) => (counts[i] === 0 ? null : round(s / counts[i])));
  }
  const perHour: Map<string, number>[] = Array.from({ length: 24 }, () => new Map());
  for (const r of rows) {
    const h = localHour(r.start_at, tz);
    perHour[h].set(r.source_key, (perHour[h].get(r.source_key) ?? 0) + r.value);
  }
  return perHour.map((m) => (m.size === 0 ? null : round(Math.max(...m.values()), 0)));
}

/** Compact series for the timeline chart. */
export function seriesForDay(db: DB, type: string, date: string, tz: string, maxPoints = 600): { t: string; v: number }[] {
  const { start, end } = dayRange(date, tz);
  const rows = db
    .prepare(`SELECT start_s s, value v FROM health_samples WHERE type = ? AND start_s >= ? AND start_s < ? ORDER BY start_s`)
    .all(type, toEpochS(start), toEpochS(end)) as { s: number; v: number }[];
  const pts = rows.map((r) => ({ t: new Date(r.s * 1000).toISOString(), v: r.v }));
  if (pts.length <= maxPoints) return pts;
  const bucket = Math.ceil(pts.length / maxPoints);
  const out: { t: string; v: number }[] = [];
  for (let i = 0; i < pts.length; i += bucket) {
    const slice = pts.slice(i, i + bucket);
    out.push({ t: slice[0].t, v: round(slice.reduce((a, r) => a + r.v, 0) / slice.length) });
  }
  return out;
}
