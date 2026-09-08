# Budgeting App

A desktop budgeting app that answers one question at a glance: **am I on track for
what I'm saving toward?** Not "how much did you spend" — whether this month's pace
still gets you the car, or the house.

Everything runs and stores locally. No account, no server, no bank connection.

![status](https://img.shields.io/badge/stage-MVP-blue)

## The idea

Most budgeting apps colour a category red when you go over its line. This one anchors
the colour to your **goals**:

| Colour | Meaning |
| --- | --- |
| 🟢 Green | Projected spend is inside the plan **and** the goals stay reachable. |
| 🟡 Yellow | Over budget a little, but at this pace the goals are still funded. |
| 🔴 Red | At this pace the month falls short of what the goals need. |

Being over budget only matters if it costs you the goal — that rule lives in
[`src/shared/domain/pacing.ts`](src/shared/domain/pacing.ts) and is the heart of the app.

## Running it

Requires Node 18+ (Node 22 recommended).

```bash
npm install     # first time only; downloads the Electron runtime
npm run dev     # launches the app with hot reload
```

> **If `npm run dev` says `Error: Electron uninstall`:** npm's allow-scripts policy
> blocked Electron's postinstall, so the ~100 MB runtime was never downloaded. Look for
> `npm warn allow-scripts electron@... (postinstall: node install.js)` in the install
> output. Fix it once with:
>
> ```bash
> npm approve-scripts electron      # records the approval for future installs
> node node_modules/electron/install.js   # downloads the runtime now
> ```
>
> The same warning for `esbuild` can be ignored — Vite resolves its native binary
> through the `@esbuild/<platform>` optional dependency, not the postinstall script.

Other scripts:

```bash
npm test          # regression tests for calculations, storage, IPC and form state
npm run typecheck # tsc over both the Node and the browser sides
npm run build     # typecheck + production bundle into out/
npm run dist:mac  # a signed-less .dmg in release/ (needs macOS)
```

First launch is empty. **Settings → Load demo data** fills a believable month so you
can see every screen working, and `resources/sample-statement.csv` is a fake bank
export for trying the CSV importer.

## What's in the MVP

- **Statement imports with saved bank formats** — choose or drop a CSV, adjust column
  mappings and date/amount conventions, and save a named preset for next time. Preview
  automatic categories, skipped rows and duplicates before importing. Imported rows go
  into a review queue. Duplicate checking also catches repeated lines within one file.
- **Automatic category rules** — match description text to categories; the longest
  matching phrase wins. Apply rules to incoming uncategorized expenses or review a count
  before applying them to existing ones. Explicit categories are preserved.
- **Bulk cleanup and undo** — categorize, mark reviewed or delete selected transactions;
  search, sort and filter by type/category/review status; display 100 rows per page.
  Undo up to 20 successful changes during the current app session.
- **Bills** — monthly and yearly schedules with due dates, including month-end/leap-year
  handling. Record an expense or link an existing imported payment. Bills reserve money
  in their fixed category; linked payments are not added a second time.
- **Reports** — 6- and 12-month recorded income, expenses and net cash flow, plus spending
  by category. Estimates are kept separate from recorded activity.
- **Data portability** — export all matching transactions as CSV, save a complete JSON
  backup, and restore a validated backup. Restore first creates a local recovery copy.
  Failed saves preserve the editor and show a dismissible error.

- **Dashboard** — the red/yellow/green verdict, spend so far vs. plan, projected
  month-end, the gap between what you're on pace to save and what the goals need, and
  a per-category breakdown of spend against each limit.
- **Fixed vs. variable categories** — rent, utilities and subscriptions are lump-sum
  bills, so they're marked *recurring* in Settings: they skip pace projection entirely
  (a bill paid on the 1st is not "30x over pace"), show no pace marker, and are
  committed at their full limit in the month-end projection whether or not they've been
  charged yet. Only day-to-day spending gets extrapolated from the daily rate during
  the current month. Past months show recorded spending; future months show known
  commitments. Income settings, category limits and goal balances always reflect the
  current setup, because per-month snapshots are not implemented yet.
- **Month picker** — the month label in the header is a button: it opens a grid of all
  twelve months with ‹ › to step through years. The month being viewed is filled, the
  real current month is outlined, and a dot marks every month that actually holds
  transactions, so empty stretches are obvious at a glance.
- **Transactions** — add, edit, delete, search, filter by category, move between
  months, and import a bank CSV (with column auto-detection, a preview, and duplicate
  skipping).
- **Goals** — a *goal of the year* and *long-term* goals, each showing progress and the
  monthly saving it demands.
- **Settings** — name and avatar, theme, salary or hourly income with a withholding
  estimate, editable per-category monthly budgets, and an explicit dashboard income basis.
  Choose estimate-only, recorded-income-only, or estimate plus extra income. Existing
  budgets keep their prior additive behavior; imports containing income prompt for the
  intended basis so a paycheck need not be counted twice.
- **Themes** — nine of them, seven light and two dark, defaulting to *Sand* (warm light
  brown). Four of the light options are warm-toned: Sand, Clay, Parchment and Olive. They're plain data in `src/shared/themes.ts`: a token map applied to
  `<html>` as CSS custom properties at runtime, so the stylesheet never names a colour
  and adding a theme means adding one object. Every theme's contrast ratios are
  unit-tested against WCAG AA.

## Architecture

```
src/
  main/       Electron main process — the only code with filesystem access
    store/    Database interface, JSON implementation, validation layer
    ipc.ts    One handler per allow-listed channel
  preload/    contextBridge: exposes exactly the typed BudgetApi, nothing else
  renderer/   React UI (pages, components, one store context)
  shared/     Types, the IPC contract, and dependency-free domain logic
    domain/   pacing · goals · csv · dates · money  (+ unit tests)
```

Four deliberate choices:

1. **The domain logic is pure and shared.** `src/shared/domain/` has no Electron, no
   React and no Node dependencies, so it is unit-testable in isolation and can be
   imported unchanged by a future React Native client.
2. **The IPC boundary is typed.** `BudgetApi` in `src/shared/api.ts` is implemented by
   the preload script and consumed by React, so UI and storage can't drift apart
   without a compile error.
3. **Persistence is an interface.** Swapping the JSON file for SQLite means writing one
   class — see [ADR 002](docs/adr-002-local-json-storage.md).
4. **Colour is data, not CSS.** Themes live in `src/shared/themes.ts` and category
   colours in `src/shared/palette.ts`, applied as custom properties, so a React Native
   client can consume the same maps. Both are contrast-tested.

Security posture: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`,
a CSP meta tag, and a typed channel allow-list with trusted-document and main-frame
checks. Navigation stays inside the app; only HTTP(S) links open in the system browser.
A single-instance lock prevents separate processes from overwriting the same JSON budget.

See the [code review](docs/code-review.md) for findings and fixes, and
[testing and maintainability notes](docs/testing.md) for the feature matrix, failure
scenarios, desktop runner, and persistence/form-state invariants.

## Why this stack

Electron + React + TypeScript, with the reasoning and the rejected alternatives
(Tauri, SwiftUI, Flutter, Qt) written up in
**[docs/adr-001-tech-stack.md](docs/adr-001-tech-stack.md)**.

The short version: the domain logic is plain TypeScript that a React Native app can
reuse verbatim, the same source builds for macOS/Windows/Linux, and the UI iterates
fast — which matters most for a product whose value is a glanceable colour.

## Roadmap

The [market comparison and prioritized roadmap](docs/market-research.md) records
competitor strengths, tradeoffs, user-feedback sources and the decisions for this app.
This iteration follows the product preference: local desktop first, with less manual
transaction entry through reusable bank CSV imports.

- [x] Saved CSV formats, categorization rules, bulk review and undo
- [x] Monthly/yearly bills, reports, backup/restore and CSV export
- [ ] Account balances, transfers, reconciliation and split transactions
- [ ] Per-month budget history, rollover and sinking funds

- [ ] Mobile client (React Native) reusing `src/shared/`
- [ ] Real accounts + sync (this is where the email/phone signup, verification code and
      Face ID unlock from the product notes belong)
- [ ] Bank connections via Plaid instead of CSV
- [ ] Automatic recurring-bill *detection* (the `fixed` flag is set by hand today)
- [ ] SQLite storage adapter
- [x] Spending trends across months

## Using a bank CSV

1. Open **Settings → Automatic categories** and add rules for recurring merchants.
2. Open **Transactions → Import CSV**, select a saved bank format or start with auto-detect,
   then choose or drop your statement.
3. If necessary, expand **Adjust columns & save bank format**. Set the header mappings,
   date convention and amount direction, then save a named format for later statements.
4. Review the preview and income basis, then import. Select **Needs review** to categorize
   and approve rows in batches. Re-imports skip matching transactions by default.
5. In **Bills**, link any imported bill payments to their schedules. In **Settings → Data
   & backups**, save a full backup periodically.

CSV files must have a header row and be at most 25 MB. Dates support ISO (`YYYY-MM-DD`)
and numeric slash/dash formats with the selected day-first convention. Malformed files
stay in the preview with an explanation; no transactions are written until import. Duplicate matching uses the date,
amount, description and income/expense type. Turn off duplicate skipping for legitimate
identical purchases. Transfers, credit-card payments and refunds need careful review:
the app does not yet have an account/transfer model. Reports reflect the records present,
including future-dated entries, rather than a reconciled bank balance.
