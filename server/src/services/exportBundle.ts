import type { DB } from "../lib/db.js";
import {
  addDays,
  daysBetween,
  EVENT_CATEGORY_META,
  labFlag,
  localHour,
  type DailyHealthSummary,
  type Event,
  type ExportBundle,
} from "@sentience/shared";
import { getProfile, listFacts } from "./profile.js";
import { listEventsForDay } from "./events.js";
import { dailySummary, hourlySeries, T } from "./health.js";
import { allGoalStatuses } from "./goals.js";
import { listLabs } from "./labs.js";
import { dayRange } from "../lib/time.js";

export function buildBundle(db: DB, from: string, to: string): ExportBundle {
  const profile = getProfile(db);
  const tz = profile.timezone;
  const days: ExportBundle["days"] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) {
    days.push({
      date: d,
      events: listEventsForDay(db, d, tz),
      health: dailySummary(db, d, tz),
      heartRateByHour: hourlySeries(db, T.hr, d, tz, "avg"),
      stepsByHour: hourlySeries(db, T.steps, d, tz, "sum"),
    });
  }
  return {
    app: "sentience",
    version: 1,
    generatedAt: new Date().toISOString(),
    range: { from, to, days: daysBetween(from, to) + 1 },
    profile,
    facts: listFacts(db),
    goals: allGoalStatuses(db, to, tz),
    // All test results up to the end of the range: trends matter more than the window.
    labResults: listLabs(db, "1970-01-01T00:00:00Z", dayRange(to, tz).end),
    days,
  };
}

/* ------------------------------------------------------------------ */
/* Markdown — a prompt-ready narrative of the same data                */
/* ------------------------------------------------------------------ */

const fmtTime = (iso: string, tz: string) =>
  new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));

const n = (v: number | null | undefined, unit = "", digits = 0) =>
  v == null ? "—" : `${Number(v).toFixed(digits)}${unit}`;

function age(dob: string | null | undefined): string {
  if (!dob) return "—";
  const years = (Date.now() - Date.parse(dob)) / (365.25 * 86_400_000);
  return `${Math.floor(years)}`;
}

function eventLine(e: Event, tz: string): string {
  const meta = EVENT_CATEGORY_META[e.category];
  const time = fmtTime(e.startAt, tz) + (e.endAt ? `–${fmtTime(e.endAt, tz)}` : "");
  const parts = [`- **${time}** ${meta.label}: ${e.title}`];
  if (e.rating != null) parts.push(`(rating ${e.rating}/10)`);
  if (e.tags.length) parts.push(`[${e.tags.join(", ")}]`);
  const extras = Object.entries(e.data ?? {})
    .map(([k, v]) => `${k}=${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
    .join(", ");
  if (extras) parts.push(`{${extras}}`);
  let line = parts.join(" ");
  if (e.notes) line += `\n  > ${e.notes.replace(/\n/g, "\n  > ")}`;
  return line;
}

function healthLine(h: DailyHealthSummary | null): string {
  if (!h) return "_No health data for this day._";
  const bits = [
    `Steps ${n(h.steps)}`,
    `Distance ${n(h.distanceKm, " km", 1)}`,
    `Active ${n(h.activeKcal, " kcal")}`,
    `Exercise ${n(h.exerciseMin, " min")}`,
    `Sleep ${h.sleepMin == null ? "—" : `${Math.floor(h.sleepMin / 60)}h ${Math.round(h.sleepMin % 60)}m`}`,
    `Resting HR ${n(h.restingHr, " bpm")}`,
    `HR min/avg/max ${n(h.hrMin)}/${n(h.hrAvg)}/${n(h.hrMax)} bpm`,
    `HRV ${n(h.hrvAvg, " ms")}`,
    `SpO₂ ${n(h.spo2Avg, "%", 1)}`,
  ];
  if (h.weightKg != null) bits.push(`Weight ${n(h.weightKg, " kg", 1)}`);
  let out = bits.join(" · ");
  if (h.workouts.length) {
    out += "\n  Workouts: " + h.workouts.map((w) => `${w.activityType} ${n(w.durationMin, " min")}${w.energyKcal ? `, ${n(w.energyKcal, " kcal")}` : ""}${w.distanceKm ? `, ${n(w.distanceKm, " km", 1)}` : ""}`).join("; ");
  }
  return out;
}

function hourlyRow(label: string, series: (number | null)[]): string {
  const cells = series.map((v) => (v == null ? "·" : String(Math.round(v))));
  return `| ${label} | ${cells.join(" | ")} |`;
}

/** Heart-rate around each event: average HR in the hour of the event vs the daily average. */
function eventHrContext(e: Event, hrByHour: (number | null)[], tz: string, dayAvg: number | null): string {
  const h = localHour(e.startAt, tz);
  const v = hrByHour[h];
  if (v == null || dayAvg == null) return "";
  const delta = v - dayAvg;
  return ` — HR that hour ≈${Math.round(v)} bpm (${delta >= 0 ? "+" : ""}${Math.round(delta)} vs day avg)`;
}

export function bundleToMarkdown(b: ExportBundle): string {
  const tz = b.profile.timezone;
  const p = b.profile;
  const out: string[] = [];
  out.push(`# Sentience export: ${b.range.from} → ${b.range.to} (${b.range.days} day${b.range.days === 1 ? "" : "s"})`);
  out.push(`Generated ${b.generatedAt}. Times are local to ${tz}.`);
  out.push("");
  out.push(`## About me`);
  out.push(`- Name: ${p.name || "—"}`);
  out.push(`- Age: ${age(p.dateOfBirth)} · Sex: ${p.sex}`);
  out.push(`- Height: ${n(p.heightCm, " cm")} · Weight: ${n(p.weightKg, " kg", 1)}`);
  if (p.bio) out.push(`- Notes: ${p.bio}`);
  if (b.facts.length) {
    out.push("");
    out.push(`### Record`);
    const byKind = new Map<string, typeof b.facts>();
    for (const f of b.facts) byKind.set(f.kind, [...(byKind.get(f.kind) ?? []), f]);
    for (const [kind, facts] of byKind) {
      out.push(`**${kind}**`);
      for (const f of facts) out.push(`- ${f.key}: ${f.value}${f.source ? ` _(source: ${f.source})_` : ""}${f.recordedOn ? ` _(${f.recordedOn})_` : ""}`);
    }
  }
  if (b.goals.length) {
    out.push("");
    out.push(`## Goals (status at ${b.range.to})`);
    for (const g of b.goals) {
      out.push(
        `- [${g.complete ? "x" : " "}] **${g.goal.title}** — ${g.current}/${g.target}${g.goal.unit ? ` ${g.goal.unit}` : ""} this ${g.goal.cadence} period (${Math.round(g.percent * 100)}%), streak ${g.streak}`,
      );
    }
  }
  if (b.labResults.length) {
    out.push("");
    out.push(`## Test results`);
    out.push(`| taken | test | result | range | flag | lab |`);
    out.push(`|---|---|---|---|---|---|`);
    for (const r of [...b.labResults].reverse()) {
      const flag = labFlag(r);
      const range = r.refLow != null || r.refHigh != null ? `${r.refLow ?? ""}–${r.refHigh ?? ""}` : "—";
      const val = r.value != null ? `${r.value} ${r.unit}` : r.valueText ?? "—";
      out.push(`| ${r.takenAt.slice(0, 10)} | ${r.name} | ${val} | ${range} | ${flag === "unknown" ? "" : flag.toUpperCase()} | ${r.lab} |`);
    }
  }
  out.push("");
  out.push(`## Days`);
  for (const d of b.days) {
    const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(new Date(`${d.date}T12:00:00Z`));
    out.push("");
    out.push(`### ${d.date} (${weekday})`);
    out.push(`**Health:** ${healthLine(d.health)}`);
    out.push("");
    if (d.events.length === 0) out.push("_No events logged._");
    else {
      out.push(`**Timeline:**`);
      for (const e of d.events) out.push(eventLine(e, tz) + eventHrContext(e, d.heartRateByHour, tz, d.health?.hrAvg ?? null));
    }
    const hasHr = d.heartRateByHour.some((v) => v != null);
    const hasSteps = d.stepsByHour.some((v) => v != null);
    if (hasHr || hasSteps) {
      out.push("");
      out.push(`| hour | ${Array.from({ length: 24 }, (_, i) => i).join(" | ")} |`);
      out.push(`|---|${"---|".repeat(24)}`);
      if (hasHr) out.push(hourlyRow("HR avg", d.heartRateByHour));
      if (hasSteps) out.push(hourlyRow("steps", d.stepsByHour));
    }
  }
  out.push("");
  out.push(`## How to analyse this`);
  out.push(
    `Look for: timing of meals vs energy/mood ratings; sleep duration vs next-day resting HR and HRV; whether workouts land on high-stress days; gaps between waking and first meal; caffeine timing vs sleep; and whether goals are being hit on the days with the most structure. Call out patterns across days, not single-day noise, and suggest 2–3 concrete, small changes.`,
  );
  return out.join("\n");
}
