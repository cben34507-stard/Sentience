# API

Base URL: `http://<server>:4477/api`. JSON in, JSON out. Everything except `/health-check` and `/auth/status|setup|login` needs either the session cookie (browser; writes must also send `X-Sentience: 1`) or `Authorization: Bearer snt_…` (device token). Unauthenticated calls get `401`. Dates are ISO 8601 with offset; `date` query params are `YYYY-MM-DD` in the profile's timezone. Validation errors come back as `400 {"error": "..."}`.

## Meta
| | |
|---|---|
| `GET /health-check` | `{ ok, time }` |
| `GET /stats` | counts, logging streak, health coverage |

## Auth & security
| | |
|---|---|
| `GET /auth/status` | `{ configured, authenticated, kind, https }` (public) |
| `POST /auth/setup` | `{ code, password }` first run only, using the code the server printed (public) |
| `POST /auth/login` · `POST /auth/logout` | `{ password }`; 5 failures per 15 min then `429` |
| `GET /auth/sessions` · `DELETE /auth/sessions/:id` | browsers and devices |
| `POST /auth/devices` | `{ name }` → `{ token }` shown once |
| `PUT /auth/password` | `{ current, next }`; signs out every other session |
| `GET /security/checkup` | password, HTTPS, database encryption, folder permissions, headers, listening address, sessions, AI |

## Profile & record
| | |
|---|---|
| `GET /profile` · `PUT /profile` | partial update accepted |
| `GET /facts?kind=` · `POST /facts` · `POST /facts/bulk` · `PUT /facts/:id` · `DELETE /facts/:id` | `kind` ∈ condition, medication, allergy, genetic, lab, measurement, preference, history, other |

## Events
| | |
|---|---|
| `GET /events?date=` or `?from=&to=` | default: today |
| `POST /events` | `{ category, title, startAt, endAt?, notes?, tags?, rating?, data?, source? }` |
| `GET /events/:id` · `PUT /events/:id` · `DELETE /events/:id` | delete is a tombstone |

## Day & overview
| | |
|---|---|
| `GET /day?date=` | everything the timeline page needs: events, health summary, HR series, steps by hour, goal statuses, sleep intervals |
| `GET /overview?from=&to=` | per-day rollup for calendars/review + streak |
| `GET /timeline?from=&to=` | per-day events, merged sleep spans and hourly HR for the swimlane (max 62 days) |

## Health
| | |
|---|---|
| `POST /health/import[?force=1]` | multipart field `file` = `export.zip` or `export.xml`; returns `202` + job. A file already imported finishes as `duplicate` unless `force=1` |
| `GET /health/import` · `GET /health/import/:id` | job list / progress |
| `POST /health/samples` | direct ingestion `{ samples[], workouts[] }` |
| `GET /health/samples?type=&date=` or `&from=&to=` | series (downsampled for a single day) |
| `GET /health/summary?date=` | daily summary |
| `GET /health/types` · `GET /health/coverage` | what's on record |

## Test results
| | |
|---|---|
| `GET /labs` or `?from=&to=` | all results, oldest first |
| `POST /labs` | `{ testKey, name, value, unit, takenAt, panel?, valueText?, refLow?, refHigh?, lab?, notes? }`; returns `duplicate: true` if the same result exists |
| `POST /labs/bulk` | array of the above (one report) → `{ created, duplicates }` |
| `PUT /labs/:id` · `DELETE /labs/:id` | delete is a tombstone (and removes it from Apple Health on next phone sync) |

## Food & insights
| | |
|---|---|
| `GET /nutrition?date=` | meals, water, totals, targets, and Apple Health dietary totals (kept separate) |
| `GET /nutrition/frequent` | most-logged meals of the last 60 days |
| `GET /insights?from=&to=` | rule-based findings: last 7 days vs the 4 weeks before |
| `GET /ai/status` · `PUT /settings/ai` `{ apiKey }` | AI on/off; key stored on the server, never returned |
| `POST /ai/meal-estimate` | `{ description, image?: { mediaType, data } }` → items with kcal and macros |
| `POST /ai/assess` | `{ from, to }` (≤ 31 days) → `{ markdown }` |

Meals are `meal` events with `data.kcal`, `protein_g`, `carbs_g`, `fat_g`, `fibre_g`, `slot`, `items`. Water is a `drink` event with `data.water_ml`.

## Goals & achievements
| | |
|---|---|
| `GET /goals?date=&archived=1` | statuses for the period containing `date` |
| `POST /goals` · `PUT /goals/:id` · `DELETE /goals/:id` | `metric`: `manual` \| `events:<category>` \| `health:<HKType>` \| `data:<field>` (sum of an event detail, e.g. `data:water_ml`) |
| `POST /goals/:id/progress` `{ amount, date?, note? }` · `GET /goals/:id/progress?from=&to=` | manual progress |
| `GET /achievements` | computes and unlocks |

## Export & sync
| | |
|---|---|
| `GET /export?date=` or `?from=&to=` `&format=json\|md` `&download=1` | bundle; max 92 days |
| `POST /sync` | see ARCHITECTURE.md |
