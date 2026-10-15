/**
 * "Does X affect Y?" — compares days with and without something you logged
 * (or high and low days of a number) against a health outcome on the same
 * day, that night, or the next day.
 *
 * Significance comes from a permutation test: shuffle which days had X many
 * times and see how often chance alone produces a gap as big as the real one.
 * No distribution assumptions, works for small samples, easy to explain.
 */
import type { DB } from "../lib/db.js";
import { EVENT_CATEGORY_META, addDays, localHour, type DailyHealthSummary, type Event } from "@sentience/shared";
import { dailySummary } from "./health.js";
import { listEventsForDay } from "./events.js";

export const Y_METRICS = {
  sleepMin: { label: "Sleep", unit: "min", defaultLag: 1, lagLabel: "that night" },
  restingHr: { label: "Resting heart rate", unit: "bpm", defaultLag: 1, lagLabel: "next day" },
  hrvAvg: { label: "HRV", unit: "ms", defaultLag: 1, lagLabel: "next day" },
  hrAvg: { label: "Average heart rate", unit: "bpm", defaultLag: 0, lagLabel: "same day" },
  steps: { label: "Steps", unit: "steps", defaultLag: 0, lagLabel: "same day" },
  activeKcal: { label: "Active energy", unit: "kcal", defaultLag: 0, lagLabel: "same day" },
  exerciseMin: { label: "Exercise", unit: "min", defaultLag: 0, lagLabel: "same day" },
  weightKg: { label: "Weight", unit: "kg", defaultLag: 1, lagLabel: "next day" },
} as const;
export type YMetric = keyof typeof Y_METRICS;

export interface Day {
  date: string;
  events: Event[];
  summary: DailyHealthSummary | null;
}

export interface Spec {
  /** cat:<category> | text:<words> | tag:<tag> | data:<field> | health:<metric> | rating:<category> */
  x: string;
  /** health metric key or rating:<category> */
  y: string;
  /** Days between X and Y: 0 same day, 1 next day/that night. */
  lag: number;
  /** Only count events at or after this local hour (e.g. 14 for "after 2pm"). */
  afterHour?: number | null;
}

export interface Point {
  date: string;
  x: number;
  y: number;
}
export interface Result {
  x: string;
  y: string;
  xLabel: string;
  yLabel: string;
  yUnit: string;
  lag: number;
  kind: "binary" | "numeric";
  points: Point[];
  n: number;
  /** binary: days with X / without X. numeric: top and bottom half by X. */
  groups: { label: string; n: number; mean: number | null }[];
  diff: number | null;
  diffPct: number | null;
  r: number | null;
  /** Share of shuffles at least as extreme as the real data (two-sided). */
  p: number | null;
  verdict: "likely" | "possible" | "none" | "not-enough";
  summary: string;
}

const STOP = new Set(["with", "and", "the", "from", "into", "back", "home", "house", "left", "went", "woke", "made", "some", "half", "large", "small", "check", "block"]);
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
/** "Water 500 ml" and "Water 250 ml" are the same thing. */
const titleKey = (s: string) => norm(s).replace(/\s+\d.*$/, "");
/** Lower-case for mid-sentence use, but leave acronyms like HRV alone. */
export const lc = (s: string) => (/^[A-Z]{2,}/.test(s) ? s : s.charAt(0).toLowerCase() + s.slice(1));

export function loadDays(db: DB, tz: string, from: string, to: string): Day[] {
  const out: Day[] = [];
  // One extra day so "next day" outcomes exist for the last X day.
  for (let d = from; d <= addDays(to, 2); d = addDays(d, 1)) out.push({ date: d, events: listEventsForDay(db, d, tz), summary: dailySummary(db, d, tz) });
  return out;
}

function evMatches(e: Event, spec: string, tz: string, afterHour?: number | null): boolean {
  if (afterHour != null && localHour(e.startAt, tz) < afterHour) return false;
  const [kind, ...rest] = spec.split(":");
  const arg = rest.join(":");
  if (kind === "cat") return e.category === arg;
  if (kind === "tag") return e.tags.some((t) => norm(t) === norm(arg));
  if (kind === "title") return titleKey(e.title) === arg;
  if (kind === "text") {
    const hay = norm(`${e.title} ${e.tags.join(" ")} ${e.notes ?? ""}`);
    return norm(arg)
      .split(/\s*,\s*|\s+or\s+/)
      .filter(Boolean)
      .some((w) => new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(hay));
  }
  return false;
}

/** Value of X on a day; null means "don't count this day". */
function xValue(day: Day, spec: string, tz: string, afterHour?: number | null): number | null {
  const [kind, ...rest] = spec.split(":");
  const arg = rest.join(":");
  if (kind === "health") {
    const v = day.summary?.[arg as YMetric];
    return typeof v === "number" ? v : null;
  }
  // Event-based X only means something on days you were logging at all.
  if (day.events.length === 0) return null;
  if (kind === "data") {
    let sum = 0;
    let any = false;
    for (const e of day.events) {
      if (afterHour != null && localHour(e.startAt, tz) < afterHour) continue;
      const v = Number(e.data?.[arg]);
      if (Number.isFinite(v)) {
        sum += v;
        any = true;
      }
    }
    return any ? sum : 0;
  }
  if (kind === "rating") {
    const rs = day.events.filter((e) => e.category === arg && e.rating != null).map((e) => e.rating!);
    return avg(rs);
  }
  return day.events.some((e) => evMatches(e, spec, tz, afterHour)) ? 1 : 0;
}

function yValue(day: Day | undefined, spec: string): number | null {
  if (!day) return null;
  if (spec.startsWith("rating:")) {
    const cat = spec.slice(7);
    return avg(day.events.filter((e) => e.category === cat && e.rating != null).map((e) => e.rating!));
  }
  const v = day.summary?.[spec as YMetric];
  return typeof v === "number" ? v : null;
}

export function labelFor(spec: string): string {
  const [kind, ...rest] = spec.split(":");
  const arg = rest.join(":");
  if (kind === "cat") return EVENT_CATEGORY_META[arg as keyof typeof EVENT_CATEGORY_META]?.label ?? arg;
  if (kind === "text") return arg.charAt(0).toUpperCase() + arg.slice(1);
  if (kind === "title") return arg.charAt(0).toUpperCase() + arg.slice(1);
  if (kind === "tag") return `#${arg}`;
  if (kind === "data") return { kcal: "Calories eaten", water_ml: "Water", protein_g: "Protein", caffeine_mg: "Caffeine", alcohol_units: "Alcohol units" }[arg] ?? arg;
  if (kind === "health") return Y_METRICS[arg as YMetric]?.label ?? arg;
  if (kind === "rating") return `${EVENT_CATEGORY_META[arg as keyof typeof EVENT_CATEGORY_META]?.label ?? arg} rating`;
  return Y_METRICS[spec as YMetric]?.label ?? spec;
}
const unitFor = (y: string) => (y.startsWith("rating:") ? "points" : Y_METRICS[y as YMetric]?.unit ?? "");

/** Deterministic PRNG so the same data always gives the same p. */
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}
function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function pearson(xs: number[], ys: number[]): number | null {
  const mx = avg(xs)!;
  const my = avg(ys)!;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i] - mx) * (ys[i] - my);
    sxx += (xs[i] - mx) ** 2;
    syy += (ys[i] - my) ** 2;
  }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}

const ITER = 2000;

export function analyse(days: Day[], spec: Spec, tz: string): Result {
  const byDate = new Map(days.map((d, i) => [d.date, i]));
  const points: Point[] = [];
  for (const d of days.slice(0, -2)) {
    const x = xValue(d, spec.x, tz, spec.afterHour);
    const y = yValue(days[byDate.get(d.date)! + spec.lag], spec.y);
    if (x != null && y != null) points.push({ date: d.date, x, y });
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const binary = xs.every((v) => v === 0 || v === 1);
  const base = {
    x: spec.x,
    y: spec.y,
    xLabel: labelFor(spec.x) + (spec.afterHour != null ? ` after ${spec.afterHour}:00` : ""),
    yLabel: labelFor(spec.y),
    yUnit: unitFor(spec.y),
    lag: spec.lag,
    points,
    n: points.length,
  };
  const rand = rng(points.length * 7919 + Math.round((avg(ys) ?? 0) * 100));

  if (binary) {
    const yes = points.filter((p) => p.x === 1).map((p) => p.y);
    const no = points.filter((p) => p.x === 0).map((p) => p.y);
    const groups = [
      { label: `With ${base.xLabel}`, n: yes.length, mean: avg(yes) },
      { label: `Without`, n: no.length, mean: avg(no) },
    ];
    if (yes.length < 3 || no.length < 3) return { ...base, kind: "binary", groups, diff: null, diffPct: null, r: null, p: null, verdict: "not-enough", summary: notEnough(yes.length, no.length) };
    const diff = avg(yes)! - avg(no)!;
    let extreme = 0;
    for (let i = 0; i < ITER; i++) {
      const s = shuffle(ys, rand);
      const a = avg(s.slice(0, yes.length))!;
      const b = avg(s.slice(yes.length))!;
      if (Math.abs(a - b) >= Math.abs(diff) - 1e-9) extreme++;
    }
    const p = (extreme + 1) / (ITER + 1);
    const diffPct = avg(no) ? diff / avg(no)! : null;
    const verdict = verdictFor(p, Math.min(yes.length, no.length));
    return { ...base, kind: "binary", groups, diff, diffPct, r: null, p, verdict, summary: describeBinary(base.xLabel, base.yLabel, base.yUnit, spec, diff, yes.length, no.length, verdict) };
  }

  // Numeric X: correlation, plus a median split so the answer reads like the binary one.
  const sorted = [...xs].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)] ?? 0;
  const hi = points.filter((p) => p.x > med).map((p) => p.y);
  const lo = points.filter((p) => p.x <= med).map((p) => p.y);
  const groups = [
    { label: `Higher ${base.xLabel} (over ${fmt(med)})`, n: hi.length, mean: avg(hi) },
    { label: `Lower`, n: lo.length, mean: avg(lo) },
  ];
  if (points.length < 8 || hi.length < 3 || lo.length < 3) return { ...base, kind: "numeric", groups, diff: null, diffPct: null, r: null, p: null, verdict: "not-enough", summary: `Only ${points.length} days have both numbers. Keep logging; around 10 to 14 days makes a first look worthwhile.` };
  const r = pearson(xs, ys);
  let extreme = 0;
  if (r != null)
    for (let i = 0; i < ITER; i++) {
      const rr = pearson(xs, shuffle(ys, rand));
      if (rr != null && Math.abs(rr) >= Math.abs(r) - 1e-9) extreme++;
    }
  const p = r == null ? null : (extreme + 1) / (ITER + 1);
  const diff = avg(hi)! - avg(lo)!;
  const verdict = p == null ? "none" : verdictFor(p, points.length / 2);
  return { ...base, kind: "numeric", groups, diff, diffPct: avg(lo) ? diff / avg(lo)! : null, r, p, verdict, summary: describeNumeric(base.xLabel, base.yLabel, base.yUnit, spec, diff, r ?? 0, verdict) };
}

function verdictFor(p: number, smallest: number): Result["verdict"] {
  if (p < 0.05 && smallest >= 5) return "likely";
  if (p < 0.2) return "possible";
  return "none";
}
function notEnough(yes: number, no: number): string {
  const need = (k: number) => Math.max(0, 5 - k);
  return `Not enough days yet: ${yes} with and ${no} without. ${need(yes) ? `Log ${need(yes)} more day${need(yes) === 1 ? "" : "s"} with it` : ""}${need(yes) && need(no) ? " and " : ""}${need(no) ? `${need(no)} more without` : ""} for a first answer.`;
}
const fmt = (v: number) => (Math.abs(v) >= 100 ? Math.round(v).toLocaleString("en-GB") : (Math.round(v * 10) / 10).toString());
function amount(v: number, unit: string, y: string): string {
  if (y === "sleepMin" || unit === "min") {
    const m = Math.round(Math.abs(v));
    return m >= 60 ? `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m` : `${m} min`;
  }
  return `${fmt(Math.abs(v))} ${unit}`.trim();
}
const when = (spec: Spec) => (spec.lag === 0 ? "the same day" : spec.y === "sleepMin" && spec.lag === 1 ? "that night" : spec.lag === 1 ? "the next day" : `${spec.lag} days later`);
const hedge = (v: Result["verdict"]) => (v === "likely" ? "This is unlikely to be chance." : v === "possible" ? "It could still be chance; keep logging to firm it up." : "The gap is small enough to be chance.");

function describeBinary(xl: string, yl: string, unit: string, spec: Spec, diff: number, ny: number, nn: number, v: Result["verdict"]): string {
  // Below what anyone would notice: 5 minutes of sleep, 50 steps, a twentieth of anything else.
  const tiny = Math.abs(diff) < (spec.y === "sleepMin" ? 5 : unit === "steps" ? 50 : 0.05);
  if (tiny) return `${spec.y === "sleepMin" ? "You slept about the same" : `Your ${lc(yl)} was about the same`} ${when(spec)} with or without ${lc(xl)} (${ny} days with, ${nn} without).`;
  const dir = diff >= 0 ? "higher" : "lower";
  const word = spec.y === "sleepMin" ? (diff >= 0 ? "more" : "less") : dir;
  const what = spec.y === "sleepMin" ? `you slept ${amount(diff, unit, spec.y)} ${word}` : `your ${lc(yl)} was ${amount(diff, unit, spec.y)} ${dir}`;
  return `On days with ${lc(xl)}, ${what} ${when(spec)} on average (${ny} days with, ${nn} without). ${hedge(v)}`;
}
function describeNumeric(xl: string, yl: string, unit: string, spec: Spec, diff: number, r: number, v: Result["verdict"]): string {
  const strength = Math.abs(r) >= 0.5 ? "strongly" : Math.abs(r) >= 0.3 ? "moderately" : "weakly";
  return `${yl} ${when(spec)} ${r >= 0 ? "rises" : "falls"} ${strength} as ${lc(xl)} goes up: higher days averaged ${amount(diff, unit, spec.y)} ${diff >= 0 ? "more" : "less"} than lower days. ${hedge(v)}`;
}

/** What X and Y can be, given the data in range. */
export function options(days: Day[]): { x: { value: string; label: string; group: string; count: number }[]; y: { value: string; label: string; count: number; defaultLag: number }[] } {
  const cats = new Map<string, number>();
  const titles = new Map<string, { label: string; count: number }>();
  const tags = new Map<string, number>();
  const data = new Map<string, number>();
  const ratings = new Map<string, number>();
  for (const d of days) {
    const seenCat = new Set<string>();
    const seenTitle = new Set<string>();
    for (const e of d.events) {
      if (!seenCat.has(e.category)) cats.set(e.category, (cats.get(e.category) ?? 0) + 1);
      seenCat.add(e.category);
      const t = titleKey(e.title);
      if (t && !seenTitle.has(t)) titles.set(t, { label: e.title.replace(/\s+\d.*$/, ""), count: (titles.get(t)?.count ?? 0) + 1 });
      seenTitle.add(t);
      for (const tag of e.tags) tags.set(norm(tag), (tags.get(norm(tag)) ?? 0) + 1);
      for (const [k, v] of Object.entries(e.data ?? {})) if (typeof v === "number" && !["slot"].includes(k)) data.set(k, (data.get(k) ?? 0) + 1);
      if (e.rating != null) ratings.set(e.category, (ratings.get(e.category) ?? 0) + 1);
    }
  }
  const x: { value: string; label: string; group: string; count: number }[] = [];
  // Single words across titles ("coffee" inside "Porridge, banana, coffee"), when they don't happen every day.
  const loggedDays = days.filter((d) => d.events.length).length;
  const words = new Map<string, number>();
  for (const d of days) {
    const seen = new Set<string>();
    for (const e of d.events) for (const w of norm(e.title).split(/[^a-z]+/)) if (w.length >= 4 && !STOP.has(w)) seen.add(w);
    for (const w of seen) words.set(w, (words.get(w) ?? 0) + 1);
  }
  for (const [w, n] of [...words].sort((a, b) => b[1] - a[1]).slice(0, 30))
    if (n >= 2 && n <= loggedDays * 0.85 && !titles.has(w)) x.push({ value: `text:${w}`, label: w.charAt(0).toUpperCase() + w.slice(1), group: "Words", count: n });
  for (const [t, v] of [...titles].sort((a, b) => b[1].count - a[1].count).slice(0, 25)) if (v.count >= 2) x.push({ value: `title:${t}`, label: v.label, group: "Things you logged", count: v.count });
  for (const [c, n] of cats) x.push({ value: `cat:${c}`, label: `Any ${labelFor(`cat:${c}`).toLowerCase()}`, group: "Categories", count: n });
  for (const [t, n] of tags) if (n >= 2) x.push({ value: `tag:${t}`, label: `#${t}`, group: "Tags", count: n });
  for (const [k, n] of data) if (n >= 3) x.push({ value: `data:${k}`, label: labelFor(`data:${k}`), group: "Amounts", count: n });
  for (const [c, n] of ratings) if (n >= 3) x.push({ value: `rating:${c}`, label: labelFor(`rating:${c}`), group: "Ratings", count: n });
  for (const m of Object.keys(Y_METRICS) as YMetric[]) {
    const n = days.filter((d) => typeof d.summary?.[m] === "number").length;
    if (n >= 5) x.push({ value: `health:${m}`, label: Y_METRICS[m].label, group: "Health", count: n });
  }
  const y = (Object.keys(Y_METRICS) as YMetric[])
    .map((m) => ({ value: m as string, label: Y_METRICS[m].label as string, count: days.filter((d) => typeof d.summary?.[m] === "number").length, defaultLag: Y_METRICS[m].defaultLag as number }))
    .filter((o) => o.count >= 5);
  for (const [c, n] of ratings) if (n >= 3) y.push({ value: `rating:${c}`, label: labelFor(`rating:${c}`), count: n, defaultLag: 0 });
  return { x, y };
}

/**
 * Tries the common pairs and returns the clearest ones. Many comparisons means
 * some will look real by luck, so this uses a stricter cut-off than a single
 * question would.
 */
export function discover(days: Day[], tz: string, limit = 8): Result[] {
  const opts = options(days);
  const xs = opts.x.filter((o) => o.group !== "Health" && o.group !== "Ratings").slice(0, 30);
  const out: Result[] = [];
  for (const xo of xs)
    for (const yo of opts.y) {
      if (xo.value === `rating:${yo.value.slice(7)}`) continue;
      const r = analyse(days, { x: xo.value, y: yo.value, lag: yo.defaultLag }, tz);
      if (r.p != null && r.p < 0.01 && r.verdict === "likely" && Math.min(...r.groups.map((g) => g.n)) >= 6) out.push(r);
    }
  // The same days often match several ways ("Gym" and "Any workout"); keep one of each.
  const seen = new Set<string>();
  return out
    .sort((a, b) => (a.p ?? 1) - (b.p ?? 1) || Math.abs(b.diffPct ?? 0) - Math.abs(a.diffPct ?? 0))
    .filter((r) => {
      // Also catches mirror images: "eggs" days are exactly the "not porridge" days.
      const k = `${r.y}|${r.groups.map((g) => `${g.n}:${g.mean?.toFixed(3)}`).sort().join("|")}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .slice(0, limit)
    .map((r) => ({ ...r, points: [] }));
}
