# Sentience — notes for working on this repo

- npm workspaces: `packages/shared` (zod schemas), `server` (Express + better-sqlite3), `web` (Vite + React + Tailwind v4). `ios/` is a SwiftUI app generated with XcodeGen; it is not part of the npm build.
- Build order matters: `npm run build` builds shared → web → server. The server serves `web/dist` when it exists.
- Tests: `npm test` runs `server/src/__tests__/*.test.ts` with `tsx --test` (no DB file needed; uses `:memory:`).
- All record shapes live in `packages/shared/src/index.ts`. Change them there first; the server's upserts and the iOS DTOs mirror them.
- Days are bucketed by the profile's timezone at query time (`server/src/lib/time.ts`). Never store a "local date" column.
- Health sample inserts must go through `makeSampleInserter` so units get normalised and the dedupe index applies.
- Web styling: tokens are CSS variables in `web/src/index.css` (`--paper`, `--ink`, …) exposed to Tailwind as `bg-paper`, `text-ink`, etc. Dark mode is the `.dark` class on `<html>`; keep both palettes in sync.
- Charts are hand-rolled SVG in `web/src/components/Charts.tsx`; single-series blue, measured width via ResizeObserver (do not stretch with preserveAspectRatio).
- No emoji anywhere in UI or exports. Web icons are lucide-react (category map in `web/src/components/icons.tsx`); iOS uses SF Symbols (`EventCategory.symbol`).
- No native `<select>`: use `web/src/components/Select.tsx`. Modals and dropdowns portal to `document.body` because the page-transition wrapper creates a containing block.
- The strands intro/ribbon is a canvas in `web/src/components/WaveField.tsx`, driven by `phase` from `App.tsx`; the iOS equivalent is `StrandsCanvas` in `SplashView.swift`.
- Health range queries use `start_s`/`end_s` (epoch seconds), never string comparison of ISO timestamps. Additive health totals go through `cumulativeSum` (busiest source per hour).
- Lab presets live in `LAB_TESTS` (shared). After changing them run `npm run build --workspace=packages/shared && node scripts/gen-ios-presets.mjs`.
- Never commit personal data: DB files, genome raw files, Health exports and analysis bundles are gitignored. Keep it that way.
