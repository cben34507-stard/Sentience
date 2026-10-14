import type { DB } from "../lib/db.js";
import { nextRev, toEpochS } from "../lib/db.js";
import { cumulativeSum, isRateType } from "./health.js";
import { newId } from "../lib/ids.js";
import { dayRange } from "../lib/time.js";
import { addDays, daysBetween, type Goal, type GoalInput, type GoalProgress, type GoalStatus } from "@sentience/shared";

interface GoalRow {
  id: string;
  title: string;
  description: string;
  cadence: Goal["cadence"];
  target: number;
  unit: string;
  metric: string;
  color: string;
  starts_on: string;
  ends_on: string | null;
  archived: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}
interface ProgressRow {
  id: string;
  goal_id: string;
  date: string;
  amount: number;
  note: string | null;
  created_at: string;
}

const rowToGoal = (r: GoalRow): Goal => ({
  id: r.id,
  title: r.title,
  description: r.description,
  cadence: r.cadence,
  target: r.target,
  unit: r.unit,
  metric: r.metric,
  color: r.color,
  startsOn: r.starts_on,
  endsOn: r.ends_on,
  archived: r.archived === 1,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});
const rowToProgress = (r: ProgressRow): GoalProgress => ({
  id: r.id,
  goalId: r.goal_id,
  date: r.date,
  amount: r.amount,
  note: r.note,
  createdAt: r.created_at,
});

export function listGoals(db: DB, includeArchived = false): Goal[] {
  const rows = db
    .prepare(
      `SELECT * FROM goals WHERE deleted_at IS NULL ${includeArchived ? "" : "AND archived = 0"} ORDER BY created_at`,
    )
    .all() as GoalRow[];
  return rows.map(rowToGoal);
}

export function getGoal(db: DB, id: string): Goal | null {
  const row = db.prepare(`SELECT * FROM goals WHERE id = ? AND deleted_at IS NULL`).get(id) as GoalRow | undefined;
  return row ? rowToGoal(row) : null;
}

export function createGoal(db: DB, input: GoalInput): Goal {
  const now = new Date().toISOString();
  const goal: Goal = {
    id: newId(),
    title: input.title,
    description: input.description ?? "",
    cadence: input.cadence,
    target: input.target,
    unit: input.unit ?? "",
    metric: input.metric ?? "manual",
    color: input.color ?? "blue",
    startsOn: input.startsOn,
    endsOn: input.endsOn ?? null,
    archived: input.archived ?? false,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  upsertGoal(db, goal);
  return goal;
}

export function updateGoal(db: DB, id: string, input: Partial<GoalInput>): Goal | null {
  const existing = getGoal(db, id);
  if (!existing) return null;
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const merged: Goal = { ...existing, ...clean, updatedAt: new Date().toISOString() };
  upsertGoal(db, merged);
  return merged;
}

export function deleteGoal(db: DB, id: string): boolean {
  const now = new Date().toISOString();
  return (
    db
      .prepare(`UPDATE goals SET deleted_at=?, updated_at=?, rev=? WHERE id=? AND deleted_at IS NULL`)
      .run(now, now, nextRev(db), id).changes > 0
  );
}

export function upsertGoal(db: DB, g: Goal): void {
  db.prepare(
    `INSERT INTO goals (id, title, description, cadence, target, unit, metric, color, starts_on, ends_on, archived, created_at, updated_at, deleted_at, rev)
     VALUES (@id, @title, @description, @cadence, @target, @unit, @metric, @color, @startsOn, @endsOn, @archived, @createdAt, @updatedAt, @deletedAt, @rev)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, description=excluded.description, cadence=excluded.cadence, target=excluded.target,
       unit=excluded.unit, metric=excluded.metric, color=excluded.color, starts_on=excluded.starts_on, ends_on=excluded.ends_on,
       archived=excluded.archived, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, rev=excluded.rev
     WHERE excluded.updated_at >= goals.updated_at`,
  ).run({
    ...g,
    endsOn: g.endsOn ?? null,
    archived: g.archived ? 1 : 0,
    deletedAt: g.deletedAt ?? null,
    rev: nextRev(db),
  });
}

export function addProgress(db: DB, goalId: string, date: string, amount: number, note?: string | null): GoalProgress {
  const p: GoalProgress = { id: newId(), goalId, date, amount, note: note ?? null, createdAt: new Date().toISOString() };
  upsertProgress(db, p);
  return p;
}

export function upsertProgress(db: DB, p: GoalProgress): void {
  db.prepare(
    `INSERT INTO goal_progress (id, goal_id, date, amount, note, created_at, rev)
     VALUES (@id, @goalId, @date, @amount, @note, @createdAt, @rev)
     ON CONFLICT(id) DO UPDATE SET amount=excluded.amount, note=excluded.note, date=excluded.date, rev=excluded.rev`,
  ).run({ ...p, note: p.note ?? null, rev: nextRev(db) });
}

export function listProgress(db: DB, goalId: string, from: string, to: string): GoalProgress[] {
  return (
    db
      .prepare(`SELECT * FROM goal_progress WHERE goal_id = ? AND date >= ? AND date <= ? ORDER BY date`)
      .all(goalId, from, to) as ProgressRow[]
  ).map(rowToProgress);
}

export function goalsSince(db: DB, rev: number): Goal[] {
  return (db.prepare(`SELECT * FROM goals WHERE rev > ? ORDER BY rev`).all(rev) as GoalRow[]).map(rowToGoal);
}
export function progressSince(db: DB, rev: number): GoalProgress[] {
  return (db.prepare(`SELECT * FROM goal_progress WHERE rev > ? ORDER BY rev`).all(rev) as ProgressRow[]).map(rowToProgress);
}

/* ---------------- status computation ---------------- */

/** Start/end (inclusive) of the cadence period containing `date`. */
export function periodFor(goal: Goal, date: string): { start: string; end: string } {
  switch (goal.cadence) {
    case "daily":
      return { start: date, end: date };
    case "weekly": {
      // ISO week: Monday–Sunday.
      const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
      const start = addDays(date, -dow);
      return { start, end: addDays(start, 6) };
    }
    case "monthly": {
      const start = `${date.slice(0, 7)}-01`;
      const [y, m] = start.split("-").map(Number);
      const end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
      return { start, end };
    }
    case "once":
      return { start: goal.startsOn, end: goal.endsOn ?? date };
  }
}

/** Measures how much of the goal is done inside [start, end] (local dates). */
export function measure(db: DB, goal: Goal, start: string, end: string, tz: string): number {
  const metric = goal.metric || "manual";
  if (metric === "manual") {
    const row = db
      .prepare(`SELECT COALESCE(SUM(amount), 0) s FROM goal_progress WHERE goal_id = ? AND date >= ? AND date <= ?`)
      .get(goal.id, start, end) as { s: number };
    return row.s;
  }
  const from = dayRange(start, tz).start;
  const to = dayRange(end, tz).end;
  if (metric.startsWith("events:")) {
    const category = metric.slice("events:".length);
    const row = db
      .prepare(
        `SELECT COUNT(*) c FROM events WHERE deleted_at IS NULL AND category = ? AND start_s >= ? AND start_s < ?`,
      )
      .get(category, toEpochS(from), toEpochS(to)) as { c: number };
    return row.c;
  }
  if (metric.startsWith("health:")) {
    const type = metric.slice("health:".length);
    if (isRateType(type)) {
      const row = db
        .prepare(`SELECT AVG(value) v FROM health_samples WHERE type = ? AND start_s >= ? AND start_s < ?`)
        .get(type, toEpochS(from), toEpochS(to)) as { v: number | null };
      return row.v ?? 0;
    }
    return cumulativeSum(db, type, from, to) ?? 0;
  }
  return 0;
}

export function goalStatus(db: DB, goal: Goal, date: string, tz: string): GoalStatus {
  const { start, end } = periodFor(goal, date);
  const current = measure(db, goal, start, end, tz);
  const complete = current >= goal.target;

  // Streak: consecutive completed periods ending with the current/previous one.
  let streak = 0;
  if (goal.cadence !== "once") {
    let cursor = complete ? start : addDays(start, -1);
    for (let i = 0; i < 365; i++) {
      const p = periodFor(goal, cursor);
      if (p.end < goal.startsOn) break;
      if (measure(db, goal, p.start, p.end, tz) >= goal.target) {
        streak++;
        cursor = addDays(p.start, -1);
      } else break;
    }
  } else if (complete) streak = 1;

  return {
    goal,
    periodStart: start,
    periodEnd: end,
    current: Math.round(current * 100) / 100,
    target: goal.target,
    percent: Math.min(1, goal.target === 0 ? 1 : current / goal.target),
    streak,
    complete,
  };
}

export function allGoalStatuses(db: DB, date: string, tz: string, includeArchived = false): GoalStatus[] {
  return listGoals(db, includeArchived)
    .filter((g) => g.startsOn <= date || g.cadence === "once")
    .map((g) => goalStatus(db, g, date, tz));
}

export { daysBetween };
