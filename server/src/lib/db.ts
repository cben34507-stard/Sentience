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
  rev        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS events_start ON events(start_at);
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
  device         TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS health_samples_dedupe
  ON health_samples(type, start_at, end_at, value, source_name);
CREATE INDEX IF NOT EXISTS health_samples_type_start ON health_samples(type, start_at);

CREATE TABLE IF NOT EXISTS health_workouts (
  id            TEXT PRIMARY KEY,
  activity_type TEXT NOT NULL,
  start_at      TEXT NOT NULL,
  end_at        TEXT NOT NULL,
  duration_min  REAL NOT NULL,
  energy_kcal   REAL,
  distance_km   REAL,
  source_name   TEXT NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX IF NOT EXISTS health_workouts_dedupe
  ON health_workouts(activity_type, start_at, end_at, source_name);
CREATE INDEX IF NOT EXISTS health_workouts_start ON health_workouts(start_at);

CREATE TABLE IF NOT EXISTS health_imports (
  id            TEXT PRIMARY KEY,
  filename      TEXT NOT NULL,
  status        TEXT NOT NULL,
  records_seen  INTEGER NOT NULL DEFAULT 0,
  records_added INTEGER NOT NULL DEFAULT 0,
  workouts_seen INTEGER NOT NULL DEFAULT 0,
  error         TEXT,
  started_at    TEXT NOT NULL,
  finished_at   TEXT
);

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

export function openDatabase(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.exec(SCHEMA);
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
