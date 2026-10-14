import type { DB } from "../lib/db.js";
import { addDays, labFlag, localHour, type Event, type Insight } from "@sentience/shared";
import { dailySummary, sleepIntervalsForNight } from "./health.js";
import { listEventsForDay } from "./events.js";
import { listLabs } from "./labs.js";
import { getProfile } from "./profile.js";

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const sd = (xs: number[]) => {
  const m = avg(xs);
  return m == null || xs.length < 2 ? null : Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
};
const hm = (min: number) => `${Math.floor(min / 60)}h ${String(Math.round(min % 60)).padStart(2, "0")}m`;
const CAFFEINE = /coffee|espresso|latte|cappuccino|americano|flat white|tea|energy drink|red bull|monster|cola|coke|pre-?workout|caffeine/i;

/**
 * Plain-language findings from the last few weeks, computed on the server.
 * Each rule needs enough data to say something; otherwise it stays quiet.
 * Compares the last 7 complete days with the 4 weeks before them.
 */
export function computeInsights(db: DB, tz: string, today: string): Insight[] {
  const out: Insight[] = [];
  const dates = Array.from({ length: 35 }, (_, i) => addDays(today, i - 35)); // 35 complete days, oldest first
  const recentD = dates.slice(-7);
  const baseD = dates.slice(0, -7);
  const sum = new Map(dates.map((d) => [d, dailySummary(db, d, tz)]));
  const pick = (ds: string[], f: (s: NonNullable<ReturnType<typeof dailySummary>>) => number | null) =>
    ds.map((d) => sum.get(d)).filter(Boolean).map((s) => f(s!)).filter((v): v is number => v != null);

  // Resting heart rate trend
  const rhrR = pick(recentD, (s) => s.restingHr);
  const rhrB = pick(baseD, (s) => s.restingHr);
  if (rhrR.length >= 4 && rhrB.length >= 7) {
    const d = avg(rhrR)! - avg(rhrB)!;
    if (d >= 3)
      out.push({ id: "rhr-up", tone: "watch", area: "heart", title: `Resting heart rate is up ${d.toFixed(0)} bpm`, detail: `Last 7 days averaged ${avg(rhrR)!.toFixed(0)} bpm against ${avg(rhrB)!.toFixed(0)} the 4 weeks before. Short sleep, alcohol, stress, a hard training block or a bug coming on are the usual causes.` });
    else if (d <= -2)
      out.push({ id: "rhr-down", tone: "good", area: "heart", title: `Resting heart rate is down ${Math.abs(d).toFixed(0)} bpm`, detail: `Last 7 days averaged ${avg(rhrR)!.toFixed(0)} bpm against ${avg(rhrB)!.toFixed(0)} before. That usually tracks better fitness or recovery.` });
  }

  // HRV trend
  const hrvR = pick(recentD, (s) => s.hrvAvg);
  const hrvB = pick(baseD, (s) => s.hrvAvg);
  if (hrvR.length >= 4 && hrvB.length >= 7) {
    const pct = (avg(hrvR)! - avg(hrvB)!) / avg(hrvB)!;
    if (pct <= -0.1)
      out.push({ id: "hrv-down", tone: "watch", area: "heart", title: `HRV is down ${Math.round(-pct * 100)}%`, detail: `${avg(hrvR)!.toFixed(0)} ms this week against ${avg(hrvB)!.toFixed(0)} ms before. Lower HRV usually means your body is under more load; prioritise sleep and easier sessions for a few days.` });
    else if (pct >= 0.1)
      out.push({ id: "hrv-up", tone: "good", area: "heart", title: `HRV is up ${Math.round(pct * 100)}%`, detail: `${avg(hrvR)!.toFixed(0)} ms this week against ${avg(hrvB)!.toFixed(0)} ms before: a sign of good recovery.` });
  }

  // Sleep length and regularity
  const sleepR = pick(recentD, (s) => s.sleepMin);
  if (sleepR.length >= 4) {
    const a = avg(sleepR)!;
    if (a < 420) out.push({ id: "sleep-short", tone: "watch", area: "sleep", title: `Averaging ${hm(a)} of sleep`, detail: "That's under the 7 hours most adults need. Moving bedtime earlier by 20 to 30 minutes is the easiest lever." });
    else out.push({ id: "sleep-ok", tone: "good", area: "sleep", title: `Averaging ${hm(a)} of sleep`, detail: "Within the 7 to 9 hour range." });
  }
  const onsets = recentD
    .map((d) => sleepIntervalsForNight(db, d, tz)[0]?.[0])
    .filter((x): x is number => x != null)
    .map((s) => {
      // Minutes after 18:00 local, so midnight-crossing bedtimes stay comparable.
      const h = localHour(new Date(s * 1000), tz);
      const m = new Date(s * 1000).getUTCMinutes();
      return ((h - 18 + 24) % 24) * 60 + m;
    });
  const spread = sd(onsets);
  if (onsets.length >= 5 && spread != null && spread > 60)
    out.push({ id: "sleep-irregular", tone: "watch", area: "sleep", title: "Bedtime moves around a lot", detail: `Your sleep start varied by about ${Math.round(spread)} minutes night to night this week. A steadier bedtime usually improves sleep quality more than extra hours do.` });

  // Steps trend
  const stR = pick(recentD, (s) => s.steps);
  const stB = pick(baseD, (s) => s.steps);
  if (stR.length >= 4 && stB.length >= 7) {
    const pct = (avg(stR)! - avg(stB)!) / avg(stB)!;
    if (Math.abs(pct) >= 0.15)
      out.push({ id: "steps-trend", tone: pct > 0 ? "good" : "watch", area: "activity", title: `Steps ${pct > 0 ? "up" : "down"} ${Math.round(Math.abs(pct) * 100)}%`, detail: `${Math.round(avg(stR)!).toLocaleString()} a day this week against ${Math.round(avg(stB)!).toLocaleString()} before.` });
  }

  // Events-driven rules over the whole window
  const evByDay = new Map(dates.map((d) => [d, listEventsForDay(db, d, tz)]));
  const sleepAfter = (d: string) => sum.get(addDays(d, 1))?.sleepMin ?? dailySummary(db, addDays(d, 1), tz)?.sleepMin ?? null;

  // Afternoon caffeine vs that night's sleep
  const late: number[] = [];
  const clean: number[] = [];
  for (const d of dates.slice(0, -1)) {
    const evs = evByDay.get(d) ?? [];
    const lateCaf = evs.some((e: Event) => e.category === "drink" && (CAFFEINE.test(`${e.title} ${e.tags.join(" ")}`) || Number(e.data?.caffeine_mg) > 0) && localHour(e.startAt, tz) >= 14);
    const s = sleepAfter(d);
    if (s == null) continue;
    (lateCaf ? late : clean).push(s);
  }
  if (late.length >= 3 && clean.length >= 3) {
    const diff = avg(clean)! - avg(late)!;
    if (diff >= 15)
      out.push({ id: "caffeine-late", tone: "watch", area: "sleep", title: `About ${Math.round(diff)} minutes less sleep after afternoon caffeine`, detail: `Nights after caffeine from 2pm onwards averaged ${hm(avg(late)!)}, other nights ${hm(avg(clean)!)} (${late.length} vs ${clean.length} nights).` });
  }

  // Late dinners vs sleep
  const lateMeal: number[] = [];
  const earlyMeal: number[] = [];
  for (const d of dates.slice(0, -1)) {
    const meals = (evByDay.get(d) ?? []).filter((e) => e.category === "meal");
    const onset = sleepIntervalsForNight(db, addDays(d, 1), tz)[0]?.[0];
    const s = sleepAfter(d);
    if (!meals.length || onset == null || s == null) continue;
    const lastMeal = Math.max(...meals.map((m) => Date.parse(m.startAt) / 1000));
    (onset - lastMeal < 2.5 * 3600 ? lateMeal : earlyMeal).push(s);
  }
  if (lateMeal.length >= 3 && earlyMeal.length >= 3 && avg(earlyMeal)! - avg(lateMeal)! >= 15)
    out.push({ id: "meal-late", tone: "watch", area: "nutrition", title: "Eating late cuts into sleep", detail: `When your last meal was within 2½ hours of bed you slept ${hm(avg(lateMeal)!)} on average, against ${hm(avg(earlyMeal)!)} otherwise.` });

  // Mood vs sleep
  const moodShort: number[] = [];
  const moodLong: number[] = [];
  for (const d of dates) {
    const ratings = (evByDay.get(d) ?? []).filter((e) => e.category === "mood" && e.rating != null).map((e) => e.rating!);
    const s = sum.get(d)?.sleepMin;
    if (!ratings.length || s == null) continue;
    (s < 420 ? moodShort : moodLong).push(avg(ratings)!);
  }
  if (moodShort.length >= 3 && moodLong.length >= 3 && avg(moodLong)! - avg(moodShort)! >= 0.8)
    out.push({ id: "mood-sleep", tone: "info", area: "mood", title: "Your mood follows your sleep", detail: `Mood averaged ${avg(moodShort)!.toFixed(1)}/10 after nights under 7 hours and ${avg(moodLong)!.toFixed(1)}/10 after longer nights.` });

  // Nutrition targets
  const p = getProfile(db);
  const waterDays = recentD.map((d) => (evByDay.get(d) ?? []).reduce((a, e) => a + (Number(e.data?.water_ml) || 0), 0)).filter((v) => v > 0);
  if (p.waterTargetMl && waterDays.length >= 3) {
    const a = avg(waterDays)!;
    out.push({ id: "water", tone: a >= p.waterTargetMl * 0.9 ? "good" : "watch", area: "nutrition", title: `Water: ${(a / 1000).toFixed(1)} L a day`, detail: `Target ${(p.waterTargetMl / 1000).toFixed(1)} L, averaged over the ${waterDays.length} days you logged water this week.` });
  }
  const kcalDays = recentD.map((d) => (evByDay.get(d) ?? []).filter((e) => e.category === "meal").reduce((a, e) => a + (Number(e.data?.kcal) || 0), 0)).filter((v) => v > 0);
  if (p.calorieTarget && kcalDays.length >= 3) {
    const a = avg(kcalDays)!;
    const pct = (a - p.calorieTarget) / p.calorieTarget;
    out.push({ id: "kcal", tone: Math.abs(pct) <= 0.1 ? "good" : "info", area: "nutrition", title: `Calories: ${Math.round(a).toLocaleString()} a day`, detail: `${pct >= 0 ? "+" : ""}${Math.round(pct * 100)}% against your ${p.calorieTarget.toLocaleString()} kcal target on the ${kcalDays.length} days you logged food.` });
  }

  // Test results outside their range
  const labs = listLabs(db);
  const latest = new Map<string, (typeof labs)[number]>();
  for (const l of labs) latest.set(l.testKey === "custom" ? l.name : l.testKey, l);
  const flagged = [...latest.values()].filter((l) => ["low", "high"].includes(labFlag(l)));
  if (flagged.length)
    out.push({ id: "labs-flagged", tone: "watch", area: "tests", title: `${flagged.length} test result${flagged.length === 1 ? "" : "s"} outside range`, detail: flagged.map((l) => `${l.name} ${l.value} ${l.unit} (${labFlag(l)})`).join(", ") + ". Worth raising at your next appointment." });

  if (out.length === 0)
    out.push({ id: "thin", tone: "info", area: "activity", title: "Not enough data yet", detail: "Insights appear once there are about a week of health data and some logged days. Import Apple Health or sync the iPhone app to get started." });
  return out;
}
