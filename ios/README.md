# Sentience for iOS

A SwiftUI companion that logs your day offline and syncs to the home server when you're back on Wi-Fi. It also reads HealthKit directly, so day-to-day heart rate, steps, sleep and workouts land on the server without re-exporting.

## Build

Xcode doesn't live in git well, so the project is described by `project.yml` and generated with [XcodeGen](https://github.com/yonaskolb/XcodeGen):

```bash
brew install xcodegen
cd ios
xcodegen generate
open Sentience.xcodeproj
```

Then in Xcode: pick your team under *Signing & Capabilities*, plug in your iPhone, run. iOS 17+.

## First run

1. Start the server on the mini PC — it prints a `network http://192.168.x.x:4477` line.
2. In the app: **Sync** tab → paste that URL → *Test connection*.
3. Toggle **Send Apple Health data** and allow the HealthKit prompts.
4. Tap *Sync now*. From then on it syncs whenever the app comes to the foreground.

## How sync works

Every local row (events, goals, manual progress) carries `id`, `updatedAt` and a `dirty` flag. A sync is one `POST /api/sync` call:

- the phone sends all dirty rows plus new HealthKit samples (anchored queries, so only what's new) and the last server cursor it saw;
- the server upserts with last-write-wins on `updatedAt`, then returns everything that changed since that cursor;
- the phone applies those, clears `dirty`, stores the new cursor and commits the HealthKit anchors.

Nothing is deleted outright — rows get a `deletedAt` tombstone so deletions propagate in both directions.

## Files

| Path | What |
|---|---|
| `Sentience/Models/Models.swift` | SwiftData models + wire DTOs matching `packages/shared` |
| `Sentience/Services/APIClient.swift` | tiny JSON client |
| `Sentience/Services/HealthKitService.swift` | anchored HealthKit reads → DTOs |
| `Sentience/Services/SyncService.swift` | push/pull/apply |
| `Sentience/Views/*` | Splash, Today timeline + quick chips, event editor, goals, sync settings |
