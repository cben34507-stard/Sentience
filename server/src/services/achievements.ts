import type { DB } from "../lib/db.js";
import type { Achievement } from "@sentience/shared";
import { countEvents, distinctEventDays } from "./events.js";
import { healthCoverage } from "./health.js";
import { allGoalStatuses } from "./goals.js";
import { addDays } from "@sentience/shared";

interface Def {
  code: string;
  title: string;
  description: string;
  icon: string;
  /** Returns 0..1 progress. */
  progress: (ctx: Ctx) => number;
}

interface Ctx {
  db: DB;
  tz: string;
  today: string;
  eventCount: number;
  days: string[];
  longestStreak: number;
  currentStreak: number;
  health: ReturnType<typeof healthCoverage>;
  goalsDone: number;
  bestGoalStreak: number;
  factCount: number;
  categoriesUsed: number;
  labCount: number;
}

const clamp = (n: number) => Math.max(0, Math.min(1, n));

const DEFS: Def[] = [
  { code: "first_event", title: "First light", description: "Log your first event.", icon: "sparkles", progress: (c) => clamp(c.eventCount / 1) },
  { code: "events_50", title: "Getting into it", description: "Log 50 events.", icon: "notebook", progress: (c) => clamp(c.eventCount / 50) },
  { code: "events_500", title: "Chronicler", description: "Log 500 events.", icon: "library", progress: (c) => clamp(c.eventCount / 500) },
  { code: "streak_3", title: "Three in a row", description: "Log something on 3 consecutive days.", icon: "flame", progress: (c) => clamp(c.longestStreak / 3) },
  { code: "streak_7", title: "A full week", description: "Log something every day for a week.", icon: "calendar", progress: (c) => clamp(c.longestStreak / 7) },
  { code: "streak_30", title: "Habit formed", description: "30 consecutive logged days.", icon: "landmark", progress: (c) => clamp(c.longestStreak / 30) },
  { code: "profile_facts_5", title: "Know thyself", description: "Add 5 facts to your record.", icon: "dna", progress: (c) => clamp(c.factCount / 5) },
  { code: "health_import", title: "Pulse connected", description: "Import Apple Health data.", icon: "heart", progress: (c) => clamp(c.health.samples > 0 ? 1 : 0) },
  { code: "health_100k", title: "Big data", description: "100,000 health samples on record.", icon: "trending-up", progress: (c) => clamp(c.health.samples / 100_000) },
  { code: "goal_first", title: "Goal getter", description: "Complete a goal period.", icon: "target", progress: (c) => clamp(c.goalsDone / 1) },
  { code: "goal_streak_4", title: "Consistent", description: "Hit a goal 4 periods in a row.", icon: "medal", progress: (c) => clamp(c.bestGoalStreak / 4) },
  { code: "labs_first", title: "Under the microscope", description: "Record a test result.", icon: "flask", progress: (c) => clamp(c.labCount / 1) },
  { code: "categories_10", title: "Full spectrum", description: "Use 10 different event categories.", icon: "palette", progress: (c) => clamp(c.categoriesUsed / 10) },
];

function streaks(days: string[], today: string): { longest: number; current: number } {
  let longest = 0;
  let run = 0;
  let prev: string | null = null;
  for (const d of days) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = d;
  }
  const last = days[days.length - 1];
  const current = last && (last === today || addDays(last, 1) === today) ? run : 0;
  return { longest, current };
}

export function computeAchievements(db: DB, tz: string, today: string): Achievement[] {
  const days = distinctEventDays(db, tz);
  const s = streaks(days, today);
  const statuses = allGoalStatuses(db, today, tz, true);
  const ctx: Ctx = {
    db,
    tz,
    today,
    eventCount: countEvents(db),
    days,
    longestStreak: s.longest,
    currentStreak: s.current,
    health: healthCoverage(db),
    goalsDone: statuses.filter((g) => g.complete || g.streak > 0).length,
    bestGoalStreak: Math.max(0, ...statuses.map((g) => g.streak)),
    factCount: (db.prepare(`SELECT COUNT(*) c FROM facts WHERE deleted_at IS NULL`).get() as { c: number }).c,
    labCount: (db.prepare(`SELECT COUNT(*) c FROM lab_results WHERE deleted_at IS NULL`).get() as { c: number }).c,
    categoriesUsed: (db.prepare(`SELECT COUNT(DISTINCT category) c FROM events WHERE deleted_at IS NULL`).get() as { c: number }).c,
  };

  const unlocked = new Map(
    (db.prepare(`SELECT code, unlocked_at FROM achievements`).all() as { code: string; unlocked_at: string }[]).map((r) => [
      r.code,
      r.unlocked_at,
    ]),
  );
  const insert = db.prepare(`INSERT OR IGNORE INTO achievements (code, unlocked_at) VALUES (?, ?)`);

  return DEFS.map((d) => {
    const progress = d.progress(ctx);
    let unlockedAt = unlocked.get(d.code) ?? null;
    if (progress >= 1 && !unlockedAt) {
      unlockedAt = new Date().toISOString();
      insert.run(d.code, unlockedAt);
    }
    return { id: d.code, code: d.code, title: d.title, description: d.description, icon: d.icon, unlockedAt, progress };
  });
}

export function loggingStreak(db: DB, tz: string, today: string): { longest: number; current: number } {
  return streaks(distinctEventDays(db, tz), today);
}
