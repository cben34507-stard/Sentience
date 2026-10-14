# Sentience

A personal life tracker you run yourself. Log what you did through the day on a timeline, lay your Apple Health data over it, keep a record of who you are (conditions, meds, bloods, 23andMe markers), set goals, and export any day or fortnight as a prompt-ready file you can hand to an analyst — human or AI — and ask what to improve.

```
  ┌─────────────┐       sync        ┌───────────────────────────────┐
  │  iPhone app │ ◄───────────────► │  mini PC                      │
  │  (SwiftUI)  │   /api/sync       │  server  (Node + SQLite)      │
  │  HealthKit  │                   │  web UI  (React, white/dark)  │ ◄── you, in a browser
  └─────────────┘                   │  Apple Health export importer │
                                    └───────────────────────────────┘
```

## What's in the box

| Part | Folder | Stack |
|---|---|---|
| Server + API | `server/` | Node 20+, Express, SQLite (better-sqlite3 with SQLite3 Multiple Ciphers for encryption), zod. Serves the built web app too. |
| Web app | `web/` | React 18, Vite, Tailwind v4, Framer Motion. White by default, dark mode built in. |
| Shared schemas | `packages/shared/` | zod schemas + types used by server and web; the iOS DTOs mirror them. |
| iOS app | `ios/` | SwiftUI + SwiftData + HealthKit. Offline-first, syncs over Wi-Fi. |
| Deploy | `deploy/`, `Dockerfile` | systemd unit for the mini PC, or a one-container Docker build. |

### Features

- **Timeline** — one day at a time. Quick chips for the routine stuff (woke up, teeth, left house, vitamins, meals, workout, bed), a full editor for everything else: category, time range, tags, 0–10 rating, notes, and free-form `key: value` details like `kcal: 620`.
- **Home timeline** — the day drawn as a thread across the middle of Today: it swells with your heart rate, quietens through sleep, and every event and test result branches off it at the time it happened. The future part of the day stays faded.
- **Health overlay** — heart rate through the day with event ticks on the baseline, steps per hour, and a strip of the day's numbers (sleep, resting HR, HRV, active energy, workouts).
- **Apple Health import** — drop `export.zip` straight from the Health app. It streams the XML, so multi-gigabyte exports are fine, and re-imports only add what's new.
- **Review** — 7/14/30-day or custom range: days stacked as timelines (sleep, events and heart rate per row), bar charts, averages, per-day table, logging streak.
- **Food** — calories ring with protein, carbs and fat against your targets, meals by slot, one-tap re-add of frequent meals, and a water tracker (250/330/500/750 ml glasses). Describe a homemade meal ("two portions of lasagne with garlic bread"), optionally with a photo, and AI estimates each item; you can edit every number before saving. Food logged in MyFitnessPal reaches Sentience through Apple Health and is shown alongside, never added on top.
- **Insights** — after an Apple Health upload the Health and Review pages compare your last week with the four before (resting HR, HRV, sleep length and timing, steps) and link it to what you logged (late caffeine, late meals, mood, water, flagged results). Computed on the server, no AI needed. *Assess with AI* writes a longer review of any range up to 31 days.
- **Test results** — three tabs. **Bloods**: bloods and clinic measurements entered a whole report at a time, with trend lines against the reference range. The iPhone app writes the ones Apple Health has a home for (glucose, blood pressure, SpO₂, temperature, pulse, weight, BMI, body fat, waist, lung function) into Health. Apple keeps lab panels like cholesterol read-only, so those stay in Sentience. **Body**: tape-measure check-ins (neck, shoulders, chest, arms, waist, hips, thighs, calves) in cm or inches, with change since last time and waist-to-height / waist-to-hip ratios. **Genetics**: 23andMe markers, strongest evidence first.
- **No duplicates** — re-uploading the same export is detected by fingerprint; overlapping exports and iPhone sync store each reading once; iPhone + Watch steps and multi-app sleep aren't double counted; results Sentience writes into Health aren't read back in.
- **Profile & record** — name, DOB, height, weight, timezone, bio, plus an open-ended record: conditions, medications, allergies, history. Genetic markers are imported from a 23andMe raw file under Tests → Genetics (parsed in the browser; ~60 well-studied SNPs are picked out for you to tick).
- **Goals** — daily/weekly/monthly/once. Measured by hand, by counting timeline events (3 workouts a week), or straight from Apple Health (8,000 steps a day). Streaks included.
- **Achievements** — a dozen to unlock, computed from your data.
- **Export** — JSON or Markdown for any range. The Markdown is written for pasting into a chat: profile, record, goals, each day's health rollup, the timeline with heart rate context per event, and hourly HR/steps tables.
- **Security** — password login, per-device tokens for the iPhone, encrypted database, HTTPS, and a checkup page that tells you what's still open. See [`docs/SECURITY.md`](docs/SECURITY.md).
- **Strands** — the intro: braided timeline strands around the wordmark that stretch out to both edges and settle as a moving ribbon along the top of the app (click the logo to replay). The threads drift between purple and blue over time. Icons throughout, no emoji.

## Quick start (laptop or mini PC)

```bash
git clone <this repo> sentience && cd sentience
npm install
npm run build          # shared → web → server
npm start              # http://localhost:4477
```

The server prints a `network http://192.168.x.x:4477` line — that's the address for your phone and for other devices on the Wi-Fi. On first run it also prints a **setup code**: open the app, enter it, and choose a password. For the iPhone, create a device token under Settings → Devices and paste it into the app.

Then read [`docs/SECURITY.md`](docs/SECURITY.md) and do the three steps there (password, database encryption, HTTPS).

Want something to look at first?

```bash
npm run seed --workspace=server   # 14 demo days, health samples, goals, a profile
```

### Development

```bash
npm run dev            # server on :4477 with reload, Vite on :5173 proxying /api
npm test               # server tests (health parser, API, export, sync)
npm run typecheck
```

### Running it permanently on the mini PC

**systemd**

```bash
sudo useradd -r -s /usr/sbin/nologin sentience
sudo git clone <this repo> /opt/sentience && cd /opt/sentience
sudo npm install && sudo npm run build
sudo chown -R sentience:sentience /opt/sentience
sudo cp deploy/sentience.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now sentience
```

**Docker**

```bash
docker build -t sentience .
docker run -d --name sentience --restart unless-stopped -p 4477:4477 -v sentience-data:/app/server/data sentience
```

Data lives in one SQLite file (`server/data/sentience.sqlite`). Back that file up (and its key, separately, if encrypted) and you've backed up everything.

Environment (see `.env.example`): `PORT` (4477), `HOST` (0.0.0.0), `SENTIENCE_DATA_DIR`, `SENTIENCE_DB`, `SENTIENCE_STATIC_DIR`, `SENTIENCE_DB_KEY_FILE` / `SENTIENCE_DB_KEY`, `SENTIENCE_TLS_CERT` / `SENTIENCE_TLS_KEY`, `ANTHROPIC_API_KEY` (optional).

## The daily loop

1. Through the day, log on the phone (or the web). Health comes along from HealthKit on the next sync, or from an export.
2. In the evening, open **Today** → *Copy for analysis* (or **Review** for the week) and paste it into your chat.
3. Ask for patterns and 2–3 small changes. The export ends with a short brief for the analyst on what to look for.
4. Put the changes in as goals so they measure themselves.

## Docs

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — how the pieces fit, data model, sync protocol
- [`docs/API.md`](docs/API.md) — every endpoint
- [`docs/EXPORT.md`](docs/EXPORT.md) — the export bundle and how to prompt with it
- [`docs/SECURITY.md`](docs/SECURITY.md) — login, encryption, HTTPS, and how to check it
- [`docs/INSTALL-IPHONE.md`](docs/INSTALL-IPHONE.md) — how to get the app onto your phone
- [`ios/README.md`](ios/README.md) — building and using the iPhone app

## Privacy

Everything stays on hardware you own. The only network traffic is between your phone and your server, unless you turn on the AI features: then only what you send for that request (a meal description or photo, or the export of the range you asked to assess) goes to Anthropic's API, using your own key. The 23andMe import runs entirely in the browser and only the markers you tick are saved.

`.gitignore` blocks the things that must never reach GitHub: the SQLite database, database keys and certificates, `.env`, 23andMe/Ancestry raw files, Apple Health exports, and exported analysis bundles (`sentience_*.md/json`). Keep personal files in a `private/` folder if you want them next to the code.
