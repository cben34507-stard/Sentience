# Sentience — notes for working on this repo

- npm workspaces: `packages/shared` (zod schemas), `server` (Express + better-sqlite3), `web` (Vite + React + Tailwind v4). `ios/` is a SwiftUI app generated with XcodeGen; it is not part of the npm build.
- Build order matters: `npm run build` builds shared → web → server. The server serves `web/dist` when it exists.
- Tests: `npm test` runs `server/src/__tests__/*.test.ts` with `tsx --test` (no DB file needed; uses `:memory:`).
- All record shapes live in `packages/shared/src/index.ts`. Change them there first; the server's upserts and the iOS DTOs mirror them.
- Days are bucketed by the profile's timezone at query time (`server/src/lib/time.ts`). Never store a "local date" column.
- Health sample inserts must go through `makeSampleInserter` so units get normalised and the dedupe index applies.
- Web styling: tokens are CSS variables in `web/src/index.css` (`--paper`, `--ink`, …) exposed to Tailwind as `bg-paper`, `text-ink`, etc. Dark mode is the `.dark` class on `<html>`; keep both palettes in sync.
- Charts are hand-rolled SVG in `web/src/components/Charts.tsx`; single-series blue, measured width via ResizeObserver (do not stretch with preserveAspectRatio).
