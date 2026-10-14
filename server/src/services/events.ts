import type { DB } from "../lib/db.js";
import { nextRev, toEpochS } from "../lib/db.js";
import { newId } from "../lib/ids.js";
import { dayRange } from "../lib/time.js";
import type { Event, EventInput } from "@sentience/shared";

interface EventRow {
  id: string;
  category: Event["category"];
  title: string;
  notes: string | null;
  start_at: string;
  end_at: string | null;
  tags: string;
  rating: number | null;
  data: string;
  source: Event["source"];
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const rowToEvent = (r: EventRow): Event => ({
  id: r.id,
  category: r.category,
  title: r.title,
  notes: r.notes,
  startAt: r.start_at,
  endAt: r.end_at,
  tags: safeJson(r.tags, []),
  rating: r.rating,
  data: safeJson(r.data, {}),
  source: r.source,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});

function safeJson<T>(s: string, fallback: T): T {
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

export function listEvents(db: DB, from: string, to: string): Event[] {
  const rows = db
    .prepare(
      `SELECT * FROM events WHERE deleted_at IS NULL AND start_s >= ? AND start_s < ? ORDER BY start_s ASC`,
    )
    .all(toEpochS(from), toEpochS(to)) as EventRow[];
  return rows.map(rowToEvent);
}

export function listEventsForDay(db: DB, date: string, tz: string): Event[] {
  const { start, end } = dayRange(date, tz);
  return listEvents(db, start, end);
}

export function getEvent(db: DB, id: string): Event | null {
  const row = db.prepare(`SELECT * FROM events WHERE id = ? AND deleted_at IS NULL`).get(id) as EventRow | undefined;
  return row ? rowToEvent(row) : null;
}

export function createEvent(db: DB, input: EventInput): Event {
  const now = new Date().toISOString();
  const ev: Event = {
    id: newId(),
    category: input.category,
    title: input.title,
    notes: input.notes ?? null,
    startAt: input.startAt,
    endAt: input.endAt ?? null,
    tags: input.tags ?? [],
    rating: input.rating ?? null,
    data: input.data ?? {},
    source: input.source ?? "web",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  upsertEvent(db, ev);
  return ev;
}

export function updateEvent(db: DB, id: string, input: Partial<EventInput>): Event | null {
  const existing = getEvent(db, id);
  if (!existing) return null;
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const merged: Event = { ...existing, ...clean, updatedAt: new Date().toISOString() };
  upsertEvent(db, merged);
  return merged;
}

export function deleteEvent(db: DB, id: string): boolean {
  const now = new Date().toISOString();
  const res = db
    .prepare(`UPDATE events SET deleted_at = ?, updated_at = ?, rev = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(now, now, nextRev(db), id);
  return res.changes > 0;
}

/** Last-write-wins upsert shared by the REST API and the sync endpoint. */
export function upsertEvent(db: DB, e: Event): void {
  db.prepare(
    `INSERT INTO events (id, category, title, notes, start_at, end_at, start_s, end_s, tags, rating, data, source, created_at, updated_at, deleted_at, rev)
     VALUES (@id, @category, @title, @notes, @startAt, @endAt, @startS, @endS, @tags, @rating, @data, @source, @createdAt, @updatedAt, @deletedAt, @rev)
     ON CONFLICT(id) DO UPDATE SET
       category=excluded.category, title=excluded.title, notes=excluded.notes, start_at=excluded.start_at,
       end_at=excluded.end_at, start_s=excluded.start_s, end_s=excluded.end_s, tags=excluded.tags, rating=excluded.rating, data=excluded.data, source=excluded.source,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, rev=excluded.rev
     WHERE excluded.updated_at >= events.updated_at`,
  ).run({
    id: e.id,
    category: e.category,
    title: e.title,
    notes: e.notes ?? null,
    startAt: e.startAt,
    endAt: e.endAt ?? null,
    startS: toEpochS(e.startAt),
    endS: e.endAt ? toEpochS(e.endAt) : null,
    tags: JSON.stringify(e.tags ?? []),
    rating: e.rating ?? null,
    data: JSON.stringify(e.data ?? {}),
    source: e.source ?? "web",
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
    deletedAt: e.deletedAt ?? null,
    rev: nextRev(db),
  });
}

export function eventsSince(db: DB, rev: number): Event[] {
  return (db.prepare(`SELECT * FROM events WHERE rev > ? ORDER BY rev`).all(rev) as EventRow[]).map(rowToEvent);
}

export function countEvents(db: DB): number {
  return (db.prepare(`SELECT COUNT(*) c FROM events WHERE deleted_at IS NULL`).get() as { c: number }).c;
}

export function distinctEventDays(db: DB, tz: string): string[] {
  // Local-date bucketing is done in JS so the timezone is honoured.
  const rows = db.prepare(`SELECT start_at FROM events WHERE deleted_at IS NULL`).all() as { start_at: string }[];
  const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" });
  const set = new Set<string>();
  for (const r of rows) set.add(fmt.format(new Date(r.start_at)));
  return [...set].sort();
}
