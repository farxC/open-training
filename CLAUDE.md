# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

**open-training** is a self-hosted personal workout logbook — a React Native app that runs on Android, iOS, and in the browser. Users host it on their own machines. They log gym sessions, record exercise metrics (sets, reps, load, RPE), and browse their training history.

## Tech Stack

- **Expo 52** (managed workflow) + **Expo Router 4** for file-based navigation on all platforms
- **React Native Web** for browser support (built into Expo)
- **Expo SQLite 15** — synchronous API (`openDatabaseSync`, `getAllSync`, `runSync`); WASM driver on web
- **NativeWind v4** + **Tailwind CSS v3** for styling (Tailwind v4 is incompatible with NativeWind 4.x)
- **Victory Native 41** + **@shopify/react-native-skia 1.5** for analytics charts
- **TypeScript** throughout

## Commands

```bash
# Install dependencies
npm install

# Start dev server (press w for web, a for Android, i for iOS)
npx expo start

# Web only
npx expo start --web

# Run on Android emulator
npx expo run:android

# Run on iOS simulator
npx expo run:ios

# Build production web bundle
npx expo export --platform web

# Type checking
npx tsc --noEmit

# Lint
npx eslint .

# Run tests
npx jest

# Run a single test file
npx jest path/to/file.test.ts
```

## Architecture

### Directory layout

```
app/                       # Expo Router file-based routes
  (tabs)/                  # Bottom-tab navigator group
    index.tsx              # Feed tab — session list + FAB
    analytics.tsx          # Analytics tab — charts, PRs, streak
    routine.tsx            # Routine tab — weekly training split
  session/
    record.tsx             # Live session recording (modal)
    [id].tsx               # Session detail (view-only)
  exercises/
    [id].tsx               # Exercise history + PR
  _layout.tsx              # Root layout — mounts providers, runs migrations in useEffect

src/
  db/                      # SQLite singleton, schema DDL, migrations, typed query helpers
  context/                 # SessionRecorderContext (useReducer for live recording state)
  hooks/                   # useSessions, useExercises, useSessionRecorder, useRoutine, useAnalytics
  components/              # Shared UI (SessionCard, SetLogger, VolumeChart, …)
  types/                   # Shared TypeScript types (Session, WorkoutSet, Exercise, RoutineDay, …)
  data/                    # SEED_EXERCISES — ~70 preset exercises inserted on first launch
```

### Data layer

All persistence goes through `src/db/`. The singleton (`src/db/client.ts`) opens the DB with `openDatabaseSync`. Schema DDL is in `src/db/schema.ts`; `runMigrations()` creates tables and seeds exercises on first run (version tracked in `user_meta`). All typed query helpers live in `src/db/queries.ts` — raw SQL is never written elsewhere. On web, Expo SQLite uses a WASM driver transparently.

### Migration timing

`runMigrations()` is called inside a `useEffect` in `app/_layout.tsx`, not at module load time. This avoids Expo Router's SSR pre-render pass from trying to open SQLite in a Node.js context. The app shows a brief `ActivityIndicator` while the DB initializes (migrations are fast — typically <20ms).

### Navigation

Expo Router maps `app/` to routes. The live session recording screen (`app/session/record.tsx`) is a modal stack above the tabs — its state (sessionId, selected exercises) persists across navigation via `SessionRecorderContext`. Tab switching changes the browser URL automatically.

### Web output mode

`app.json` uses `"web.output": "single"` (SPA, no SSR pre-render). This is intentional — the app is self-hosted with no SEO requirement, and single-page mode avoids all SQLite/SSR incompatibilities.

### NativeWind v4 wiring (all three required)

1. `babel.config.js` — `jsxImportSource: "nativewind"` inside `babel-preset-expo` options
2. `metro.config.js` — `withNativeWind(config, { input: "./global.css" })`
3. `app/_layout.tsx` — `import "../global.css"` at the top of the file

### Platform differences

Avoid `Platform.OS` checks in business logic. Keep them in leaf components or style utilities. Web-specific adjustments go in `*.web.ts(x)` files resolved automatically by Metro. Example: `PhotoAttachment.web.tsx` uses `<input type="file">` while `PhotoAttachment.tsx` uses `expo-image-picker`.

## Key constraints

- **Self-hosted, offline-first.** No network calls to external services. Everything runs locally.
- **No auth.** Single-user by design — the person who hosts the app owns all data.
- **Web parity.** Every feature must work in the browser, not just on native.
- **`"order"` in SQL is a reserved word** — always quote it: `re."order"` in queries and DDL.
