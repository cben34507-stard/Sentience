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
| `health_samples` | Apple Health quantity + category samples; `start_s`/`end_s` epoch seconds and a normalised `source_key`; unique on (type, start_s, end_s, source_key); units normalised (mi→km, lb→kg, count/min→bpm) |
| `health_workouts` | one row per workout; unique on (start_s, end_s, source_key) |
| `health_imports` | background import jobs with progress counters, SHA-256 of the uploaded file and the export's own date |
| `lab_results` | test results: `test_key` (preset or `custom`), value or `value_text`, unit, reference range, `taken_at`/`taken_s`, lab, notes |
| `goals`, `goal_progress` | goals with a `metric` string: `manual`, `events:<category>`, `health:<HKType>` |
| `achievements` | unlock timestamps keyed by code |
| `devices`, `meta` | sync bookkeeping (`meta.rev` is the global revision counter) |

All synced tables (`events`, `facts`, `goals`, `goal_progress`, `profile`) carry `updated_at`, `deleted_at` (tombstone) and `rev`.

## Duplicate protection

| Situation | Guard |
|---|---|
| Same `export.zip` uploaded twice | SHA-256 of the file; the second job finishes as `duplicate` and changes nothing (`?force=1` to override) |
| Newer export overlapping an older one | Unique index on (type, start second, end second, source). Instants are compared as epoch seconds, so `08:00+01:00` and `07:00:00.412Z` are the same reading |
| Export and iPhone HealthKit sync overlapping | Same index; source names are normalised (curly vs straight apostrophes, case, spacing) |
| iPhone and Watch both counting steps / distance / energy | Daily and hourly totals take the busiest source per hour instead of summing sources (`cumulativeSum`) |
| Several apps recording the same night | Asleep intervals are unioned; InBed/Awake ignored |
| Two apps logging the same workout | Overlapping sessions (>60% overlap) collapse to the longest |
| Test results Sentience writes into Apple Health | Written with `HKMetadataKeySyncIdentifier = sentience-…`; the iOS reader skips its own bundle and that prefix, and the export importer skips records carrying it |
| Same test result entered twice | Same test, same instant, same value → existing row returned |

Schema v2 (`migrate()` in `server/src/lib/db.ts`) backfills the epoch columns on older databases and deletes duplicates the old key let through.

## Days and timezones

Health samples and events are stored as absolute instants (ISO 8601 with offset) plus epoch-second columns used for every range query. "A day" is computed at query time from the profile's IANA timezone (`server/src/lib/time.ts: dayRange`), so changing timezone re-buckets everything correctly without rewriting rows. Sleep belongs to the morning it ended on (window 18:00 previous day → 18:00).

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
push:  { deviceId, since, events[], goals[], goalProgress[], facts[], labResults[], healthSamples[], healthWorkouts[] }
pull:  { cursor, serverTime, events[], goals[], goalProgress[], facts[], labResults[], profile, applied{} }
```

- Every upsert is last-write-wins on `updatedAt` (`WHERE excluded.updated_at >= table.updated_at`), and bumps the row's `rev` from the global counter.
- The pull returns rows with `rev > since` — including the device's own writes, which doubles as the ack.
- Deletes are tombstones (`deletedAt`), so they propagate.
- Health samples go through the same dedupe index as the importer, so HealthKit and `export.zip` can overlap safely.

## Goals

`goalStatus()` computes the current cadence period (ISO weeks, calendar months), measures it with the goal's metric, and walks backwards period by period for the streak. Health metrics use AVG for rate-like types (HR, HRV, SpO₂, weight) and SUM for everything else.

## Export

`buildBundle(from, to)` assembles profile, record, goal statuses and per-day blocks (events, health summary, hourly HR averages, hourly step sums). `bundleToMarkdown()` renders the same bundle as prose with a per-event heart-rate context line and ends with a short analyst brief. Max range 92 days.

## Test results and Apple Health

Apple Health stores lab panels as `HKClinicalRecord`s, which only healthcare providers can add (through Health Records); apps can read them but not write them. Sentience therefore writes each result whose preset carries a `healthKit` mapping in `LAB_TESTS` as an ordinary quantity sample (glucose, BP as a correlation, SpO₂, temperature, resting HR, weight, BMI, body fat, waist, FEV1, FVC, peak flow), tagged with a sync identifier and a version so edits replace the old sample. Deleting a result in Sentience deletes it from Health. Everything else lives only in Sentience and its exports.

The iOS preset list is generated from the shared one: `node scripts/gen-ios-presets.mjs`.

## Auth

`server/src/lib/auth.ts`. One password per install (scrypt, stored in `auth_config`). Browsers get a 30-day sliding session cookie; the iPhone uses a device token sent as `Authorization: Bearer snt_…`. Both live in `sessions`, keyed by the SHA-256 of the token, so a copy of the database can't be used to log in. `requireAuth` runs in front of every `/api` route except the health check and the login routes. Cookie-authenticated writes must also send `X-Sentience: 1`, which the web client adds and a cross-site form cannot. There is no CORS middleware on purpose. Details and the deployment checklist: [SECURITY.md](SECURITY.md).

## Encryption at rest and the lock

The server opens the database through `better-sqlite3-multiple-ciphers` (SQLite3 Multiple Ciphers compiled in). `lib/locker.ts` owns the connection:

- **vault mode** (default for new installs): `lib/vault.ts` keeps the random data key only as AES-256-GCM wraps under keys derived from the password (scrypt), the recovery key and each device token (HKDF). The process starts locked; `root.ts` answers only sign-in, recovery and the health check until a wrap is opened. A request carrying a paired device's Bearer token unlocks transparently. `POST /security/lock` closes the database and drops the key.
- **key mode**: `SENTIENCE_DB_KEY(_FILE)`; **plain mode**: no key. Both can be converted in place with `POST /security/vault` (`PRAGMA rekey` on the open connection).

`createApp(db)` is the unlocked app on its own (used by tests); `createRootApp(locker)` wraps it with the lock.

## Food

Meals and water are ordinary events, so they sync, export and appear on the timeline with no extra tables: `meal` events carry `data.kcal/protein_g/carbs_g/fat_g/fibre_g/slot/items`, and water is a `drink` event with `data.water_ml`. Goals can sum any numeric detail with the `data:<field>` metric. Apple Health dietary samples (from MyFitnessPal and similar apps) are summed with `cumulativeSum` and reported separately from what was logged in Sentience, because the same meal is often in both.

## Insights and AI

`services/insights.ts` is a set of plain rules over the last 7 complete days against the 28 before: resting HR, HRV, sleep duration and onset spread, steps, and pairings of what was logged with how the night went (caffeine after 2pm, meals within 2½ hours of bed, mood). No network involved.

`services/ai.ts` is opt-in (`ANTHROPIC_API_KEY` or a key saved under Settings). Meal estimates ask for structured JSON output against a schema; range assessments send the same Markdown export the user can copy themselves. Requests enable server-side model fallback so a temporarily unavailable model doesn't fail the call. Refusals and API errors come back as readable messages.
