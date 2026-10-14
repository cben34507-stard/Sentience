import type { DB } from "../lib/db.js";
import { currentRev } from "../lib/db.js";
import type { SyncPull, SyncPush } from "@sentience/shared";
import { eventsSince, upsertEvent } from "./events.js";
import { factsSince, getProfile, upsertFact } from "./profile.js";
import { goalsSince, progressSince, upsertGoal, upsertProgress } from "./goals.js";
import { insertSamplesBulk, insertWorkoutsBulk } from "./health.js";

export interface SyncResult extends SyncPull {
  applied: { events: number; goals: number; goalProgress: number; facts: number; healthSamples: number; healthWorkouts: number };
}

/**
 * Two-way sync. The device sends everything it changed since its last cursor;
 * we apply with last-write-wins on updatedAt, then return everything that
 * changed server-side since the cursor it sent (including its own writes,
 * which lets it confirm them).
 */
export function sync(db: DB, push: SyncPush): SyncResult {
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO devices (id, last_seen, last_cursor) VALUES (?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen, last_cursor = excluded.last_cursor`,
  ).run(push.deviceId, now, push.since);

  const applied = db.transaction(() => {
    for (const e of push.events) upsertEvent(db, e);
    for (const g of push.goals) upsertGoal(db, g);
    for (const p of push.goalProgress) upsertProgress(db, p);
    for (const f of push.facts) upsertFact(db, f);
    const healthSamples = insertSamplesBulk(
      db,
      push.healthSamples.map((s) => ({ ...s, sourceName: s.sourceName || "iOS", device: s.device ?? "sentience-ios" })),
    );
    const healthWorkouts = insertWorkoutsBulk(db, push.healthWorkouts);
    return {
      events: push.events.length,
      goals: push.goals.length,
      goalProgress: push.goalProgress.length,
      facts: push.facts.length,
      healthSamples,
      healthWorkouts,
    };
  })();

  return {
    cursor: currentRev(db),
    serverTime: now,
    events: eventsSince(db, push.since),
    goals: goalsSince(db, push.since),
    goalProgress: progressSince(db, push.since),
    facts: factsSince(db, push.since),
    profile: getProfile(db),
    applied,
  };
}
