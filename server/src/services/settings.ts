import type { DB } from "../lib/db.js";

export function getSetting(db: DB, key: string): string | null {
  const r = db.prepare(`SELECT value FROM settings WHERE key = ?`).get(key) as { value: string } | undefined;
  return r?.value ?? null;
}

export function setSetting(db: DB, key: string, value: string | null): void {
  if (value == null) db.prepare(`DELETE FROM settings WHERE key = ?`).run(key);
  else
    db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`).run(
      key,
      value,
      new Date().toISOString(),
    );
}
