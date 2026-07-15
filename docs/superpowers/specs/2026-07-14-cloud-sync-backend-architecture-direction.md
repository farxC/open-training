# Backend & Cloud Sync — Architecture Direction

**Date:** 2026-07-14
**Status:** Direction / reference only — not an implementation-ready spec

## Purpose

This document is not a spec for something to build now. It's a captured direction from a brainstorming conversation about how open-training could eventually gain a backend — for cloud sync across devices/users and for background operations (notifications, heavier analytics recompute). It exists so that future work (schema decisions, feature scoping) can stay compatible with this direction instead of painting the project into a corner. When implementation actually becomes imminent, this document should be revisited, tightened into a real spec, and only then handed to the writing-plans flow.

## Relationship to current constraints

`CLAUDE.md` currently states the project is self-hosted, offline-first, has **no auth**, is **single-user by design**, and makes **no network calls to external services**. This direction assumes at least two of those will eventually change:

- **No auth / single-user** — the direction below is explicitly multi-user per instance (see below), which requires real authentication and per-account data isolation.
- **No network calls to external services** — a backend implies a client↔server network call by definition. Additionally, if push notifications (see Background Operations) are ever built, they inherently route through a platform relay (FCM for Android, APNs for iOS, or the browser's push service for web) — this is unavoidable infrastructure outside the self-hosted server itself, not an optional dependency.

These constraint changes are not authorized by this document — they're flagged so that whoever picks this up later knows the project's foundational rules will need a deliberate, explicit update alongside the implementation work, not an implicit one.

## Existing groundwork

The export/import feature (`docs/superpowers/specs/2026-07-10-export-import-backup-design.md`, schema v9) already added stable `uuid` columns to `exercises`, `sessions`, `routine_splits`, and `training_programs`, explicitly to give the data model "a stable identity for any future sync/backup work." The merge-by-uuid logic in `src/db/importExportApply.ts` is the direct ancestor of the sync protocol sketched below — it's a one-shot version of the same idea.

## Direction established in this conversation

1. **Scope of this conversation:** exploratory/direction, not an implementation-ready spec — confirmed with the user up front.
2. **Multi-user per instance:** a single self-hosted deployment should support multiple distinct user accounts (not just one person's own multiple devices). This is the biggest deviation from current constraints — see above.
3. **Hosting:** self-hosted, built from zero — no existing infra (VPS/home server/NAS) to build on today. Chosen for development/hacking; managed/BaaS options (Supabase, PocketBase, etc.) were discussed but intentionally left open as a future alternative, not the primary direction.
4. **Backend language:** Go — user preference, stated directly (not inferred).
5. **Edit pattern:** workout data is majority append-only — a session is logged once and rarely edited afterward. This means cross-device edit conflicts will be rare, so a simple **last-write-wins per record** (via a timestamp column) is sufficient conflict resolution — no CRDT or complex merge logic needed.
6. **Background operations in scope (conceptually, not designed in detail):**
   - The offline→online sync process itself (queue of local changes, reconciled when connectivity returns)
   - Notifications/reminders (e.g., scheduled workout reminder, streak-at-risk)
   - Heavier analytical reprocessing (recomputing PRs/aggregates) — could move server-side instead of running only on-device

## High-level architecture

```
┌─────────────────────┐         HTTP/JSON          ┌──────────────────────┐
│  App (Expo/RN)       │ ◄─────────────────────────► │  Backend (Go)         │
│  SQLite local         │   pull/push of "changes"   │  Embedded SQLite      │
│  (source of truth      │                             │  (single .db file)    │
│   for all UI reads/   │                             │                       │
│   writes, always)     │                             │  - Auth API           │
└─────────────────────┘                             │  - Sync API           │
                                                       │  - Background jobs   │
                                                       │    (in-process        │
                                                       │     goroutines)       │
                                                       └──────────────────────┘
```

**Core principle:** the client's local SQLite remains the source of truth for the UI — the app never blocks reads or writes on a network round-trip. This is already true today and this direction preserves it; the backend is a sync *destination*, not a mediator in the critical path.

The backend runs as a **single Go binary** with no external service dependencies (no separate database server, no Redis, no external queue) — matching a "self-hosted, built from zero" deployment story: one binary plus one data file, runnable on a VPS, home server, or something as small as a Raspberry Pi.

## Backend datastore: embedded SQLite

Chosen over PostgreSQL, given the actual workload of a self-hosted instance with few users and sparse writes:

- **Concurrency model:** SQLite allows unlimited concurrent readers but serializes writers (one write transaction at a time). In **WAL mode**, readers never block on writers or vice versa (readers see a snapshot, writers append to the WAL file) — this is the mode to run in. Write serialization is a non-issue here: workout logging is bursty and infrequent, nowhere near SQLite's write-throughput ceiling even with several concurrent users.
- **Go driver:** recommend `modernc.org/sqlite` (a pure-Go transpiled port, no cgo) over `mattn/go-sqlite3` (cgo-based). The pure-Go driver means a normal `go build` with trivial cross-compilation (`GOOS=linux GOARCH=arm64 go build`) — this is what actually delivers on the "one binary, deploy anywhere" goal, since cgo requires a C toolchain per target architecture.
- **Multi-user isolation:** enforced at the application layer (`WHERE user_id = ?` on every query) rather than via database roles/RLS — safe because only the Go backend process ever touches the file.
- **Backup:** a single file (plus `-wal`/`-shm` in WAL mode) is trivial to snapshot via SQLite's own `.backup`/`VACUUM INTO`, unlike the multi-tool backup story Postgres requires.
- **Ceiling:** this stops being the right choice if the product ever pivots to a public, heavily-concurrent multi-tenant SaaS with continuous writes from many simultaneous users. That's a different product shape than a personal/small-group self-hosted instance, and isn't the direction being planned for here.

## Sync protocol (sketched, not detailed)

Extends the existing uuid-based merge logic from export/import into a continuous protocol:

- Add `updated_at` (and a soft-delete `deleted_at` tombstone) to entities that currently carry a `uuid`.
- `GET /changes?since=<cursor>` — server returns rows changed after the given point, scoped to the authenticated user.
- `POST /changes` — client pushes its local pending changes; server upserts by `uuid`.
- Conflict resolution: last-write-wins per record, using `updated_at`. Acceptable specifically because edits are rare (see append-only pattern above) — this would need revisiting if concurrent multi-device editing became common.

This is a sketch to establish shape and feasibility, not a finished protocol design — cursor/pagination semantics, batching, and retry behavior are unresolved (see Open Questions).

## Open questions (not decided — flagged for when this is picked up again)

- Auth flow: self-registration vs. admin/invite-only account creation for a self-hosted multi-user instance.
- Full sync protocol details: pagination/cursor design, batching, retry/backoff semantics.
- Notification delivery mechanism, and how to reconcile it with the "no external network calls" principle (see Relationship to current constraints above).
- Background job scheduling implementation (simple in-process ticker vs. something more structured) — not designed here, only the conceptual scope was agreed.
- How this multi-user backend relates to the existing single-device export/import feature — does one replace the other, or do they coexist (e.g., export/import stays as a manual one-shot fallback even after sync exists)?
- Whether/when to formally amend `CLAUDE.md`'s constraints — this document does not authorize that change, only anticipates it.

## Explicitly out of scope for this document

- Any implementation code.
- Detailed client-side migration plan for the new `updated_at`/`deleted_at` columns.
- A finished, implementation-ready sync protocol.
- Choice between self-hosted and managed/BaaS hosting — left open, self-hosted was explored as the primary direction only.
