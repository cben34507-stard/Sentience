import type { DB } from "../lib/db.js";
import { nextRev } from "../lib/db.js";
import { newId } from "../lib/ids.js";
import type { Fact, FactInput, Profile, ProfileInput } from "@sentience/shared";

interface ProfileRow {
  name: string;
  date_of_birth: string | null;
  sex: Profile["sex"];
  height_cm: number | null;
  weight_kg: number | null;
  timezone: string;
  bio: string;
  updated_at: string;
}

export function getProfile(db: DB): Profile {
  const r = db.prepare(`SELECT * FROM profile WHERE id = 1`).get() as ProfileRow;
  return {
    name: r.name,
    dateOfBirth: r.date_of_birth,
    sex: r.sex,
    heightCm: r.height_cm,
    weightKg: r.weight_kg,
    timezone: r.timezone,
    bio: r.bio,
    updatedAt: r.updated_at,
  };
}

export function updateProfile(db: DB, input: ProfileInput): Profile {
  const current = getProfile(db);
  const merged = { ...current, ...stripUndefined(input) };
  db.prepare(
    `UPDATE profile SET name=?, date_of_birth=?, sex=?, height_cm=?, weight_kg=?, timezone=?, bio=?, updated_at=?, rev=? WHERE id = 1`,
  ).run(
    merged.name,
    merged.dateOfBirth ?? null,
    merged.sex,
    merged.heightCm ?? null,
    merged.weightKg ?? null,
    merged.timezone,
    merged.bio,
    new Date().toISOString(),
    nextRev(db),
  );
  return getProfile(db);
}

function stripUndefined<T extends object>(o: T): Partial<T> {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export function getTimezone(db: DB): string {
  return (db.prepare(`SELECT timezone FROM profile WHERE id = 1`).get() as { timezone: string }).timezone;
}

/* ---------------- facts ---------------- */

interface FactRow {
  id: string;
  kind: Fact["kind"];
  key: string;
  value: string;
  source: string | null;
  recorded_on: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const rowToFact = (r: FactRow): Fact => ({
  id: r.id,
  kind: r.kind,
  key: r.key,
  value: r.value,
  source: r.source,
  recordedOn: r.recorded_on,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});

export function listFacts(db: DB, kind?: string): Fact[] {
  const rows = (
    kind
      ? db.prepare(`SELECT * FROM facts WHERE deleted_at IS NULL AND kind = ? ORDER BY kind, key`).all(kind)
      : db.prepare(`SELECT * FROM facts WHERE deleted_at IS NULL ORDER BY kind, key`).all()
  ) as FactRow[];
  return rows.map(rowToFact);
}

export function createFact(db: DB, input: FactInput): Fact {
  const now = new Date().toISOString();
  const fact: Fact = {
    id: newId(),
    ...input,
    source: input.source ?? null,
    recordedOn: input.recordedOn ?? null,
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  upsertFact(db, fact);
  return fact;
}

export function updateFact(db: DB, id: string, input: Partial<FactInput>): Fact | null {
  const row = db.prepare(`SELECT * FROM facts WHERE id = ? AND deleted_at IS NULL`).get(id) as FactRow | undefined;
  if (!row) return null;
  const merged: Fact = { ...rowToFact(row), ...stripUndefined(input), updatedAt: new Date().toISOString() };
  upsertFact(db, merged);
  return merged;
}

export function deleteFact(db: DB, id: string): boolean {
  const res = db
    .prepare(`UPDATE facts SET deleted_at = ?, updated_at = ?, rev = ? WHERE id = ? AND deleted_at IS NULL`)
    .run(new Date().toISOString(), new Date().toISOString(), nextRev(db), id);
  return res.changes > 0;
}

export function upsertFact(db: DB, f: Fact): void {
  db.prepare(
    `INSERT INTO facts (id, kind, key, value, source, recorded_on, created_at, updated_at, deleted_at, rev)
     VALUES (@id, @kind, @key, @value, @source, @recordedOn, @createdAt, @updatedAt, @deletedAt, @rev)
     ON CONFLICT(id) DO UPDATE SET
       kind=excluded.kind, key=excluded.key, value=excluded.value, source=excluded.source,
       recorded_on=excluded.recorded_on, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, rev=excluded.rev
     WHERE excluded.updated_at >= facts.updated_at`,
  ).run({ ...f, source: f.source ?? null, recordedOn: f.recordedOn ?? null, deletedAt: f.deletedAt ?? null, rev: nextRev(db) });
}

export function factsSince(db: DB, rev: number): Fact[] {
  return (db.prepare(`SELECT * FROM facts WHERE rev > ? ORDER BY rev`).all(rev) as FactRow[]).map(rowToFact);
}
