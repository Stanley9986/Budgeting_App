# ADR 002 — Local JSON file for persistence (for now)

**Status:** accepted · **Date:** 2026-08-29

## Context

The MVP is single-user, offline, and holds at most a few thousand transactions. It
needs to survive app restarts and must not lose data if the app is killed mid-write.

## Decision

Persist the whole application state as one JSON document in Electron's `userData`
directory, behind a `Database` interface (`src/main/store/database.ts`).

## Why not SQLite immediately

`better-sqlite3` is a native module: it has to be rebuilt against Electron's ABI on
every platform, which adds a compilation step to `npm install` and a common class of
"works on my machine" failure. At MVP scale it buys nothing — there are no queries that
a `filter()` over a few thousand objects cannot answer in under a millisecond.

The cost of deferring is deliberately near zero because storage is an interface. Moving
to SQLite means writing one new class that implements `load()`/`save()` (or a wider
interface with real queries) and changing one line in `src/main/index.ts`. No feature
code, no React code, and none of the domain logic in `src/shared/` is aware of how data
is stored.

## Safeguards in the current implementation

- **Atomic writes.** Data is written to `budget-data.json.tmp` and `rename()`d into
  place, so a crash mid-write cannot truncate the real file.
- **Corruption recovery.** An unparseable file is moved aside as
  `budget-data.json.corrupt-<timestamp>` and the app starts from defaults instead of
  refusing to launch. Covered by a test.
- **A schema `version` field** and a `migrate()` seam, so a future release can upgrade
  an older file rather than discarding it.
- **All writes go through `BudgetStore`,** which validates and normalises every record
  (amounts stored positive, unknown category ids dropped, withholding clamped to
  0–100). The renderer cannot persist a malformed record over IPC.

## When to revisit

Move to SQLite when any of these become true: transaction counts reach tens of
thousands, multi-month analytical queries get slow, more than one process needs to
write, or sync arrives and per-row change tracking is needed.
