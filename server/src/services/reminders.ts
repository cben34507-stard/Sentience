/**
 * Reminders for supplements, medication and habits. Ticking a dose off writes
 * an ordinary timeline event (data.reminder_id / data.reminder_time), so it
 * syncs, exports and feeds the explorer like anything else you log.
 */
import type { DB } from "../lib/db.js";
import { newId } from "../lib/ids.js";
import { addDays, type Event, type Reminder, type ReminderDose, type ReminderInput, type ReminderStatus, ReminderInputSchema } from "@sentience/shared";
import { dayRange, zonedStartOfDay } from "../lib/time.js";
import { createEvent, deleteEvent, getEvent, listEvents } from "./events.js";

interface Row {
  id: string;
  title: string;
  kind: string;
  supplement_key: string | null;
  dose: string;
  times: string;
  days: string;
  notes: string;
  active: number;
  started_on: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const toReminder = (r: Row): Reminder => ({
  id: r.id,
  title: r.title,
  kind: r.kind as Reminder["kind"],
  supplementKey: r.supplement_key,
  dose: r.dose,
  times: JSON.parse(r.times),
  days: JSON.parse(r.days),
  notes: r.notes,
  active: !!r.active,
  startedOn: r.started_on,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});

export function listReminders(db: DB, includeInactive = true): Reminder[] {
  return (db.prepare(`SELECT * FROM reminders WHERE deleted_at IS NULL ${includeInactive ? "" : "AND active = 1"} ORDER BY created_at`).all() as Row[]).map(toReminder);
}
export function getReminder(db: DB, id: string): Reminder | null {
  const r = db.prepare(`SELECT * FROM reminders WHERE id = ? AND deleted_at IS NULL`).get(id) as Row | undefined;
  return r ? toReminder(r) : null;
}

function save(db: DB, r: Reminder): void {
  db.prepare(
    `INSERT INTO reminders (id, title, kind, supplement_key, dose, times, days, notes, active, started_on, created_at, updated_at, deleted_at)
     VALUES (@id, @title, @kind, @supplementKey, @dose, @times, @days, @notes, @active, @startedOn, @createdAt, @updatedAt, @deletedAt)
     ON CONFLICT(id) DO UPDATE SET title=excluded.title, kind=excluded.kind, supplement_key=excluded.supplement_key, dose=excluded.dose,
       times=excluded.times, days=excluded.days, notes=excluded.notes, active=excluded.active, started_on=excluded.started_on,
       updated_at=excluded.updated_at, deleted_at=excluded.deleted_at`,
  ).run({ ...r, times: JSON.stringify([...r.times].sort()), days: JSON.stringify([...new Set(r.days)].sort()), active: r.active ? 1 : 0, deletedAt: r.deletedAt ?? null });
}

export function createReminder(db: DB, input: ReminderInput): Reminder {
  const v = ReminderInputSchema.parse(input);
  const now = new Date().toISOString();
  const r: Reminder = { ...v, times: [...v.times].sort(), id: newId(), createdAt: now, updatedAt: now, deletedAt: null };
  save(db, r);
  return r;
}
export function updateReminder(db: DB, id: string, input: Partial<ReminderInput>): Reminder | null {
  const cur = getReminder(db, id);
  if (!cur) return null;
  const next = ReminderInputSchema.parse({ ...cur, ...input });
  const r: Reminder = { ...cur, ...next, times: [...next.times].sort(), updatedAt: new Date().toISOString() };
  save(db, r);
  return r;
}
export function deleteReminder(db: DB, id: string): boolean {
  return db.prepare(`UPDATE reminders SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL`).run(new Date().toISOString(), new Date().toISOString(), id).changes > 0;
}

/** ISO instant of HH:MM local time on `date`. DST-safe via the zone's midnight. */
function at(date: string, time: string, tz: string): string {
  const [h, m] = time.split(":").map(Number);
  const midnight = Date.parse(zonedStartOfDay(date, tz));
  // Add wall-clock hours, then correct if a DST change happened since midnight.
  const guess = new Date(midnight + (h * 60 + m) * 60_000);
  const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(guess);
  const [gh, gm] = fmt.split(":").map(Number);
  const drift = (h * 60 + m - (gh * 60 + gm)) * 60_000;
  return new Date(guess.getTime() + (Math.abs(drift) <= 2 * 3600_000 ? drift : 0)).toISOString();
}
const weekday = (date: string) => new Date(`${date}T12:00:00Z`).getUTCDay();
const appliesOn = (r: Reminder, date: string) => r.active && date >= r.startedOn && r.days.includes(weekday(date));

function takenEvents(db: DB, from: string, to: string, tz: string): Map<string, Event> {
  const m = new Map<string, Event>();
  for (const e of listEvents(db, dayRange(from, tz).start, dayRange(to, tz).end)) {
    const id = e.data?.reminder_id;
    if (typeof id === "string") m.set(`${id}|${e.data?.reminder_date}|${e.data?.reminder_time}`, e);
  }
  return m;
}

/** Every dose due on `date`, oldest first, with whether it's been taken. */
export function dosesForDay(db: DB, date: string, tz: string, now = Date.now()): ReminderDose[] {
  const taken = takenEvents(db, date, date, tz);
  const out: ReminderDose[] = [];
  for (const r of listReminders(db, false)) {
    if (!appliesOn(r, date)) continue;
    for (const time of r.times) {
      const dueAt = at(date, time, tz);
      const ev = taken.get(`${r.id}|${date}|${time}`);
      const due = Date.parse(dueAt);
      const status: ReminderDose["status"] = ev ? "taken" : now < due ? "upcoming" : now - due < 3 * 3600_000 ? "due" : "missed";
      out.push({ reminderId: r.id, title: r.title, dose: r.dose, kind: r.kind, time, dueAt, status, eventId: ev?.id ?? null, takenAt: ev?.startAt ?? null });
    }
  }
  return out.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.title.localeCompare(b.title));
}

export function markTaken(db: DB, id: string, date: string, time: string, tz: string, takenAt?: string): Event {
  const r = getReminder(db, id);
  if (!r) throw new Error("reminder not found");
  const existing = takenEvents(db, date, date, tz).get(`${id}|${date}|${time}`);
  if (existing) return existing;
  const category = r.kind === "supplement" ? "supplement" : r.kind === "medication" ? "medication" : "note";
  const nowIso = new Date().toISOString();
  // Ticked off late (e.g. the next morning)? Record it at the due time, not now.
  const dueAt = at(date, time, tz);
  const startAt = takenAt ?? (dayRange(date, tz).end > nowIso ? nowIso : dueAt);
  return createEvent(db, {
    category,
    title: r.dose ? `${r.title} (${r.dose})` : r.title,
    startAt,
    tags: ["reminder"],
    data: { reminder_id: r.id, reminder_date: date, reminder_time: time, ...(r.supplementKey ? { supplement: r.supplementKey } : {}) },
  });
}
export function undoTaken(db: DB, id: string, date: string, time: string, tz: string): boolean {
  const ev = takenEvents(db, date, date, tz).get(`${id}|${date}|${time}`);
  return ev ? deleteEvent(db, ev.id) : false;
}

export function reminderStatuses(db: DB, tz: string, today: string, now = Date.now()): ReminderStatus[] {
  const from = addDays(today, -30);
  const taken = takenEvents(db, from, today, tz);
  return listReminders(db).map((r) => {
    let scheduled = 0;
    let got = 0;
    for (let d = r.startedOn > from ? r.startedOn : from; d <= today; d = addDays(d, 1)) {
      if (!appliesOn(r, d)) continue;
      for (const t of r.times) {
        // Today's doses only count once they're due.
        if (d === today && Date.parse(at(d, t, tz)) > now) continue;
        scheduled++;
        if (taken.has(`${r.id}|${d}|${t}`)) got++;
      }
    }
    let streak = 0;
    for (let d = today; d >= from && d >= r.startedOn; d = addDays(d, -1)) {
      if (!appliesOn(r, d)) continue;
      const due = r.times.filter((t) => d !== today || Date.parse(at(d, t, tz)) <= now);
      if (due.length === 0) continue;
      if (due.every((t) => taken.has(`${r.id}|${d}|${t}`))) streak++;
      else break;
    }
    const daysSinceStart = Math.max(0, Math.round((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${r.startedOn}T12:00:00Z`)) / 86400_000));
    return { ...r, adherence: scheduled ? got / scheduled : null, scheduled30: scheduled, taken30: got, streak, daysSinceStart };
  });
}

/* ---------------- calendar export ---------------- */

const ICS_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** RFC 5545 lines are folded at 75 octets. */
const fold = (line: string) => line.match(/.{1,73}/gu)?.join("\r\n ") ?? line;

/**
 * An .ics file of repeating events with alarms. Opening it on an iPhone adds
 * them to Calendar, which then reminds you even with no app installed.
 */
export function remindersIcs(db: DB, tz: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Sentience//Reminders//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Sentience reminders", `X-WR-TIMEZONE:${tz}`];
  for (const r of listReminders(db, false)) {
    for (const t of r.times) {
      const [h, m] = t.split(":");
      const day = r.startedOn.replace(/-/g, "");
      lines.push(
        "BEGIN:VEVENT",
        `UID:${r.id}-${h}${m}@sentience`,
        `DTSTAMP:${stamp}`,
        `DTSTART;TZID=${tz}:${day}T${h}${m}00`,
        `DURATION:PT5M`,
        `RRULE:FREQ=WEEKLY;BYDAY=${r.days.map((d) => ICS_DAYS[d]).join(",")}`,
        fold(`SUMMARY:${esc(r.dose ? `${r.title} (${r.dose})` : r.title)}`),
        ...(r.notes ? [fold(`DESCRIPTION:${esc(r.notes)}`)] : []),
        "TRANSP:TRANSPARENT",
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        fold(`DESCRIPTION:${esc(r.title)}`),
        "TRIGGER:PT0M",
        "END:VALARM",
        "END:VEVENT",
      );
    }
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}
