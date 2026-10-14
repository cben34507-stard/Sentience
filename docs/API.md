# API

Base URL: `http://<server>:4477/api`. JSON in, JSON out. Dates are ISO 8601 with offset; `date` query params are `YYYY-MM-DD` in the profile's timezone. Validation errors come back as `400 {"error": "..."}`.

## Meta
| | |
|---|---|
| `GET /health-check` | `{ ok, time }` |
| `GET /stats` | counts, logging streak, health coverage |

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
| `GET /day?date=` | everything the timeline page needs: events, health summary, HR series, steps by hour, goal statuses |
| `GET /overview?from=&to=` | per-day rollup for calendars/review + streak |

## Health
| | |
|---|---|
| `POST /health/import` | multipart field `file` = `export.zip` or `export.xml`; returns `202` + job |
| `GET /health/import` · `GET /health/import/:id` | job list / progress |
| `POST /health/samples` | direct ingestion `{ samples[], workouts[] }` |
| `GET /health/samples?type=&date=` or `&from=&to=` | series (downsampled for a single day) |
| `GET /health/summary?date=` | daily summary |
| `GET /health/types` · `GET /health/coverage` | what's on record |

## Goals & achievements
| | |
|---|---|
| `GET /goals?date=&archived=1` | statuses for the period containing `date` |
| `POST /goals` · `PUT /goals/:id` · `DELETE /goals/:id` | `metric`: `manual` \| `events:<category>` \| `health:<HKType>` |
| `POST /goals/:id/progress` `{ amount, date?, note? }` · `GET /goals/:id/progress?from=&to=` | manual progress |
| `GET /achievements` | computes and unlocks |

## Export & sync
| | |
|---|---|
| `GET /export?date=` or `?from=&to=` `&format=json\|md` `&download=1` | bundle; max 92 days |
| `POST /sync` | see ARCHITECTURE.md |
