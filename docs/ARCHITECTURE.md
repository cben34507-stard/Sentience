# Architecture

## Pieces

- **`packages/shared`** — zod schemas for every record type (`Event`, `Profile`, `Fact`, `HealthSample`, `HealthWorkout`, `Goal`, `GoalProgress`, `Achievement`, `ExportBundle`, `SyncPush`/`SyncPull`) and the category/health-type metadata. The server validates against these and the web app types against them. The iOS DTOs in `ios/Sentience/Models/Models.swift` mirror the same shapes field for field.
- **`server`** — Express + better-sqlite3. One process serves the API under `/api` and the built web app for everything else. SQLite in WAL mode; the whole database is one file.
- **`web`** — Vite + React. Talks only to `/api`. In dev, Vite proxies `/api` to `:4477`.
- **`ios`** — SwiftUI + SwiftData. Offline store, HealthKit reads, one sync endpoint.

## Data model

| Table | Notes |
|---|---|
| `profile` | single row (id = 1): name, DOB, sex, height, weight, **timezone**, bio |
| `facts` | open-ended record: `kind` (condition, medication, allergy, genetic, lab, measurement, preference, history, other), `key`, `value`, `source`, `recorded_on` |
| `events` | the timeline: `category`, `title`, `start_at`, optional `end_at`, `tags` (JSON), `rating`, `data` (JSON bag), `source` (web/ios/import/api) |
| `health_samples` | Apple Health quantity + category samples; unique on (type, start, end, value, source) so re-imports are idempotent; units normalised (mi→km, lb→kg, count/min→bpm) |
| `health_workouts` | one row per workout with duration, energy, distance |
| `health_imports` | background import jobs with progress counters |
| `goals`, `goal_progress` | goals with a `metric` string: `manual`, `events:<category>`, `health:<HKType>` |
| `achievements` | unlock timestamps keyed by code |
| `devices`, `meta` | sync bookkeeping (`meta.rev` is the global revision counter) |

All synced tables (`events`, `facts`, `goals`, `goal_progress`, `profile`) carry `updated_at`, `deleted_at` (tombstone) and `rev`.

## Days and timezones

Health samples and events are stored as absolute instants (ISO 8601 with offset). "A day" is computed at query time from the profile's IANA timezone (`server/src/lib/time.ts: dayRange`), so changing timezone re-buckets everything correctly without rewriting rows. Sleep belongs to the morning it ended on (window 18:00 previous day → 18:00).

## Apple Health import

`POST /api/health/import` accepts `export.zip` or `export.xml` (multipart). The server:

1. finds `export.xml` inside the zip with a streaming unzipper (`yauzl`),
2. pipes it through a SAX parser (`sax`) — no DOM, constant memory,
3. inserts in batched transactions of 5,000 with `INSERT OR IGNORE`,
4. writes progress to `health_imports` so the UI can poll.

Category samples (sleep) store the stage name in `category_value` and the duration in minutes as `value`. Workouts read totals from attributes and, on newer exports, from `<WorkoutStatistics>` children.

## Sync protocol

Single endpoint, `POST /api/sync`:

```
push:  { deviceId, since, events[], goals[], goalProgress[], facts[], healthSamples[], healthWorkouts[] }
pull:  { cursor, serverTime, events[], goals[], goalProgress[], facts[], profile, applied{} }
```

- Every upsert is last-write-wins on `updatedAt` (`WHERE excluded.updated_at >= table.updated_at`), and bumps the row's `rev` from the global counter.
- The pull returns rows with `rev > since` — including the device's own writes, which doubles as the ack.
- Deletes are tombstones (`deletedAt`), so they propagate.
- Health samples go through the same dedupe index as the importer, so HealthKit and `export.zip` can overlap safely.

## Goals

`goalStatus()` computes the current cadence period (ISO weeks, calendar months), measures it with the goal's metric, and walks backwards period by period for the streak. Health metrics use AVG for rate-like types (HR, HRV, SpO₂, weight) and SUM for everything else.

## Export

`buildBundle(from, to)` assembles profile, record, goal statuses and per-day blocks (events, health summary, hourly HR averages, hourly step sums). `bundleToMarkdown()` renders the same bundle as prose with a per-event heart-rate context line and ends with a short analyst brief. Max range 92 days.
