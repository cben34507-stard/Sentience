import type { DB } from "../lib/db.js";
import { nextRev, toEpochS } from "../lib/db.js";
import { newId } from "../lib/ids.js";
import type { LabResult, LabResultInput } from "@sentience/shared";

interface Row {
  id: string;
  test_key: string;
  name: string;
  panel: string;
  value: number | null;
  value_text: string | null;
  unit: string;
  ref_low: number | null;
  ref_high: number | null;
  taken_at: string;
  lab: string;
  notes: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

const toLab = (r: Row): LabResult => ({
  id: r.id,
  testKey: r.test_key,
  name: r.name,
  panel: r.panel,
  value: r.value,
  valueText: r.value_text,
  unit: r.unit,
  refLow: r.ref_low,
  refHigh: r.ref_high,
  takenAt: r.taken_at,
  lab: r.lab,
  notes: r.notes,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
  deletedAt: r.deleted_at,
});

export function listLabs(db: DB, from?: string, to?: string): LabResult[] {
  const rows = (
    from && to
      ? db.prepare(`SELECT * FROM lab_results WHERE deleted_at IS NULL AND taken_s >= ? AND taken_s < ? ORDER BY taken_s`).all(toEpochS(from), toEpochS(to))
      : db.prepare(`SELECT * FROM lab_results WHERE deleted_at IS NULL ORDER BY taken_s`).all()
  ) as Row[];
  return rows.map(toLab);
}

export function getLab(db: DB, id: string): LabResult | null {
  const r = db.prepare(`SELECT * FROM lab_results WHERE id = ? AND deleted_at IS NULL`).get(id) as Row | undefined;
  return r ? toLab(r) : null;
}

/**
 * Same test, same moment, same value → it's the same result entered twice
 * (or re-entered from another device). Returns the existing row instead.
 */
export function findDuplicate(db: DB, input: LabResultInput): LabResult | null {
  const r = db
    .prepare(
      `SELECT * FROM lab_results WHERE deleted_at IS NULL AND test_key = ? AND name = ? AND taken_s = ?
       AND ((value IS NULL AND ? IS NULL) OR ABS(value - ?) < 1e-9)`,
    )
    .get(input.testKey, input.name, toEpochS(input.takenAt), input.value, input.value ?? 0) as Row | undefined;
  return r ? toLab(r) : null;
}

export function createLab(db: DB, input: LabResultInput): { result: LabResult; duplicate: boolean } {
  const dupe = findDuplicate(db, input);
  if (dupe) return { result: dupe, duplicate: true };
  const now = new Date().toISOString();
  const lab: LabResult = {
    id: newId(),
    testKey: input.testKey,
    name: input.name,
    panel: input.panel ?? "",
    value: input.value,
    valueText: input.valueText ?? null,
    unit: input.unit ?? "",
    refLow: input.refLow ?? null,
    refHigh: input.refHigh ?? null,
    takenAt: input.takenAt,
    lab: input.lab ?? "",
    notes: input.notes ?? "",
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
  };
  upsertLab(db, lab);
  return { result: lab, duplicate: false };
}

export function updateLab(db: DB, id: string, input: Partial<LabResultInput>): LabResult | null {
  const existing = getLab(db, id);
  if (!existing) return null;
  const clean = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  const merged: LabResult = { ...existing, ...clean, updatedAt: new Date().toISOString() };
  upsertLab(db, merged);
  return merged;
}

export function deleteLab(db: DB, id: string): boolean {
  const now = new Date().toISOString();
  return (
    db.prepare(`UPDATE lab_results SET deleted_at=?, updated_at=?, rev=? WHERE id=? AND deleted_at IS NULL`).run(now, now, nextRev(db), id)
      .changes > 0
  );
}

export function upsertLab(db: DB, l: LabResult): void {
  db.prepare(
    `INSERT INTO lab_results (id, test_key, name, panel, value, value_text, unit, ref_low, ref_high, taken_at, taken_s, lab, notes, created_at, updated_at, deleted_at, rev)
     VALUES (@id, @testKey, @name, @panel, @value, @valueText, @unit, @refLow, @refHigh, @takenAt, @takenS, @lab, @notes, @createdAt, @updatedAt, @deletedAt, @rev)
     ON CONFLICT(id) DO UPDATE SET
       test_key=excluded.test_key, name=excluded.name, panel=excluded.panel, value=excluded.value, value_text=excluded.value_text,
       unit=excluded.unit, ref_low=excluded.ref_low, ref_high=excluded.ref_high, taken_at=excluded.taken_at, taken_s=excluded.taken_s,
       lab=excluded.lab, notes=excluded.notes, updated_at=excluded.updated_at, deleted_at=excluded.deleted_at, rev=excluded.rev
     WHERE excluded.updated_at >= lab_results.updated_at`,
  ).run({
    ...l,
    panel: l.panel ?? "",
    valueText: l.valueText ?? null,
    unit: l.unit ?? "",
    refLow: l.refLow ?? null,
    refHigh: l.refHigh ?? null,
    takenS: toEpochS(l.takenAt),
    lab: l.lab ?? "",
    notes: l.notes ?? "",
    deletedAt: l.deletedAt ?? null,
    rev: nextRev(db),
  });
}

export function labsSince(db: DB, rev: number): LabResult[] {
  return (db.prepare(`SELECT * FROM lab_results WHERE rev > ? ORDER BY rev`).all(rev) as Row[]).map(toLab);
}
