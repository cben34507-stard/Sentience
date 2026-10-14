import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type DB = Database.Database;

const SCHEMA = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profile (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  name          TEXT NOT NULL DEFAULT '',
  date_of_birth TEXT,
  sex           TEXT NOT NULL DEFAULT 'unspecified',
  height_cm     REAL,
  weight_kg     REAL,
  timezone      TEXT NOT NULL DEFAULT 'UTC',
  bio           TEXT NOT NULL DEFAULT '',
  updated_at    TEXT NOT NULL,
  rev           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS facts (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,
  key         TEXT NOT NULL,
  value       TEXT NOT NULL,
  source      TEXT,
  recorded_on TEXT,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  rev         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS facts_kind ON facts(kind);
CREATE INDEX IF NOT EXISTS facts_rev ON facts(rev);

CREATE TABLE IF NOT EXISTS events (
  id         TEXT PRIMARY KEY,
  category   TEXT NOT NULL,
  title      TEXT NOT NULL,
  notes      TEXT,
  start_at   TEXT NOT NULL,
  end_at     TEXT,
  tags       TEXT NOT NULL DEFAULT '[]',
  rating     REAL,
  data       TEXT NOT NULL DEFAULT '{}',
  source     TEXT NOT NULL DEFAULT 'web',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  rev        INTEGER NOT NULL DEFAULT 0,
  start_s    INTEGER,
  end_s      INTEGER
);
CREATE INDEX IF NOT EXISTS events_rev ON events(rev);

CREATE TABLE IF NOT EXISTS health_samples (
  id             TEXT PRIMARY KEY,
  type           TEXT NOT NULL,
  start_at       TEXT NOT NULL,
  end_at         TEXT NOT NULL,
  value          REAL NOT NULL,
  unit           TEXT NOT NULL DEFAULT '',
  category_value TEXT,
  source_name    TEXT NOT NULL DEFAULT '',
  device         TEXT,
  start_s        INTEGER,
  end_s          INTEGER,
  source_key     TEXT
);

CREATE TABLE IF NOT EXISTS health_workouts (
  id            TEXT PRIMARY KEY,
  activity_type TEXT NOT NULL,
  start_at      TEXT NOT NULL,
  end_at        TEXT NOT NULL,
  duration_min  REAL NOT NULL,
  energy_kcal   REAL,
  distance_km   REAL,
  source_name   TEXT NOT NULL DEFAULT '',
  start_s       INTEGER,
  end_s         INTEGER,
  source_key    TEXT
);

CREATE TABLE IF NOT EXISTS health_imports (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  status        TEXT NOT NULL,
  records_seen  INTEGER NOT NULL DEFAULT 0,
  records_added INTEGER NOT NULL DEFAULT 0,
  workouts_seen INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  started_at    TEXT NOT NULL,
  finished_at   TEXT,
  sha256        TEXT,
  export_date   TEXT,
  records_skipped INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lab_results (
  id          TEXT PRIMARY KEY,
  test_key    TEXT NOT NULL,
  name        TEXT NOT NULL,
  panel       TEXT NOT NULL DEFAULT '',
  value       REAL,
  value_text  TEXT,
  unit        TEXT NOT NULL DEFAULT '',
  ref_low     REAL,
  ref_high    REAL,
  taken_at    TEXT NOT NULL,
  taken_s     INTEGER NOT NULL,
  lab         TEXT NOT NULL DEFAULT '',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  rev         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS lab_results_rev ON lab_results(rev);
CREATE INDEX IF NOT EXISTS lab_results_key_taken ON lab_results(test_key, taken_s);

CREATE TABLE IF NOT EXISTS goals (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  cadence     TEXT NOT NULL,
  target      REAL NOT NULL,
  unit        TEXT NOT NULL DEFAULT '',
  metric      TEXT NOT NULL DEFAULT 'manual',
  color       TEXT NOT NULL DEFAULT 'blue',
  starts_on   TEXT NOT NULL,
  ends_on     TEXT,
  archived    INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  deleted_at  TEXT,
  rev         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS goals_rev ON goals(rev);

CREATE TABLE IF NOT EXISTS goal_progress (
  id         TEXT PRIMARY KEY,
  goal_id    TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  date       TEXT NOT NULL,
  amount     REAL NOT NULL,
  note       TEXT,
  created_at TEXT NOT NULL,
  rev        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS goal_progress_goal_date ON goal_progress(goal_id, date);
CREATE INDEX IF NOT EXISTS goal_progress_rev ON goal_progress(rev);

CREATE TABLE IF NOT EXISTS achievements (
  code        TEXT PRIMARY KEY,
  unlocked_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id          TEXT PRIMARY KEY,
  name        TEXT,
  last_seen   TEXT NOT NULL,
  last_cursor INTEGER NOT NULL DEFAULT 0
);
`;

/** Seconds since epoch for any ISO 8601 string, whatever its offset. */
export function toEpochS(iso: string): number {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) throw new Error(`bad date: ${iso}`);
  return Math.floor(t / 1000);
}

/** Normalised source name so "Alex’s Apple Watch" and "Alex's Apple Watch " collide. */
export function sourceKey(name: string | null | undefined): string {
  return (name ?? "").normalize("NFKC").replace(/[\u2018\u2019\u02bc]/g, "'").trim().toLowerCase();
}

function columns(db: DB, table: string): Set<string> {
  return new Set((db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name));
}

/**
 * Brings older databases up to date. v2 replaces string timestamp comparison
 * (which broke when offsets differed) with epoch seconds, and replaces the
 * health dedupe key so the same sample from export.zip and from HealthKit
 * collapses to one row.
 */
function migrate(db: DB): void {
  const version = Number((db.prepare(`SELECT value FROM meta WHERE key = 'schema'`).get() as { value: string } | undefined)?.value ?? 1);

  const addCol = (table: string, col: string, type: string) => {
    if (!columns(db, table).has(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`);
  };
  addCol("events", "start_s", "INTEGER");
  addCol("events", "end_s", "INTEGER");
  addCol("health_samples", "start_s", "INTEGER");
  addCol("health_samples", "end_s", "INTEGER");
  addCol("health_samples", "source_key", "TEXT");
  addCol("health_workouts", "start_s", "INTEGER");
  addCol("health_workouts", "end_s", "INTEGER");
  addCol("health_workouts", "source_key", "TEXT");
  addCol("health_imports", "sha256", "TEXT");
  addCol("health_imports", "export_date", "TEXT");
  addCol("health_imports", "records_skipped", "INTEGER NOT NULL DEFAULT 0");

  if (version < 2) {
    db.transaction(() => {
      const ev = db.prepare(`SELECT id, start_at, end_at FROM events WHERE start_s IS NULL`).all() as { id: string; start_at: string; end_at: string | null }[];
      const upE = db.prepare(`UPDATE events SET start_s = ?, end_s = ? WHERE id = ?`);
      for (const r of ev) upE.run(toEpochS(r.start_at), r.end_at ? toEpochS(r.end_at) : null, r.id);

      const hs = db.prepare(`SELECT rowid, start_at, end_at, source_name FROM health_samples WHERE start_s IS NULL`).all() as {
        rowid: number; start_at: string; end_at: string; source_name: string;
      }[];
      const upS = db.prepare(`UPDATE health_samples SET start_s = ?, end_s = ?, source_key = ? WHERE rowid = ?`);
      for (const r of hs) upS.run(toEpochS(r.start_at), toEpochS(r.end_at), sourceKey(r.source_name), r.rowid);

      const hw = db.prepare(`SELECT rowid, start_at, end_at, source_name FROM health_workouts WHERE start_s IS NULL`).all() as {
        rowid: number; start_at: string; end_at: string; source_name: string;
      }[];
      const upW = db.prepare(`UPDATE health_workouts SET start_s = ?, end_s = ?, source_key = ? WHERE rowid = ?`);
      for (const r of hw) upW.run(toEpochS(r.start_at), toEpochS(r.end_at), sourceKey(r.source_name), r.rowid);

      db.exec(`DROP INDEX IF EXISTS health_samples_dedupe`);
      db.exec(`DROP INDEX IF EXISTS health_workouts_dedupe`);
      db.exec(`DROP INDEX IF EXISTS health_samples_type_start`);
      db.exec(`DROP INDEX IF EXISTS health_workouts_start`);
      db.exec(`DROP INDEX IF EXISTS events_start`);
      // Collapse duplicates that the old key let through.
      db.exec(`DELETE FROM health_samples WHERE rowid NOT IN (SELECT MIN(rowid) FROM health_samples GROUP BY type, start_s, end_s, source_key)`);
      db.exec(`DELETE FROM health_workouts WHERE rowid NOT IN (SELECT MIN(rowid) FROM health_workouts GROUP BY start_s, end_s, source_key)`);
    })();
  }

  db.exec(`
    CREATE UNIQUE INDEX IF NOT EXISTS health_samples_uniq ON health_samples(type, start_s, end_s, source_key);
    CREATE INDEX IF NOT EXISTS health_samples_type_start_s ON health_samples(type, start_s);
    CREATE UNIQUE INDEX IF NOT EXISTS health_workouts_uniq ON health_workouts(start_s, end_s, source_key);
    CREATE INDEX IF NOT EXISTS health_workouts_start_s ON health_workouts(start_s);
    CREATE INDEX IF NOT EXISTS events_start_s ON events(start_s);
    CREATE INDEX IF NOT EXISTS health_imports_sha ON health_imports(sha256);
  `);
  db.prepare(`INSERT INTO meta (key, value) VALUES ('schema', '2') ON CONFLICT(key) DO UPDATE SET value = excluded.value`).run();
}

export function openDatabase(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.exec(SCHEMA);
  migrate(db);
  const now = new Date().toISOString();
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  db.prepare(
    `INSERT OR IGNORE INTO profile (id, timezone, updated_at) VALUES (1, ?, ?)`,
  ).run(tz, now);
  db.prepare(`INSERT OR IGNORE INTO meta (key, value) VALUES ('rev', '0')`).run();
  return db;
}

/** Monotonic revision counter used by the sync protocol. */
export function nextRev(db: DB): number {
  const row = db
    .prepare(`UPDATE meta SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT) WHERE key = 'rev' RETURNING value`)
    .get() as { value: string };
  return Number(row.value);
}

export function currentRev(db: DB): number {
  const row = db.prepare(`SELECT value FROM meta WHERE key = 'rev'`).get() as { value: string };
  return Number(row.value);
}
