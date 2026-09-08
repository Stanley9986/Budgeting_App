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
npm test          # 50 unit tests over the pacing, goal and CSV logic
npm run typecheck # tsc over both the Node and the browser sides
npm run build     # typecheck + production bundle into out/
npm run dist:mac  # a signed-less .dmg in release/ (needs macOS)
```

First launch is empty. **Settings → Load demo data** fills a believable month so you
can see every screen working, and `resources/sample-statement.csv` is a fake bank
export for trying the CSV importer.

## What's in the MVP

- **Dashboard** — the red/yellow/green verdict, spend so far vs. plan, projected
  month-end, the gap between what you're on pace to save and what the goals need, and
  a per-category breakdown of spend against each limit.
- **Fixed vs. variable categories** — rent, utilities and subscriptions are lump-sum
  bills, so they're marked *recurring* in Settings: they skip pace projection entirely
  (a bill paid on the 1st is not "30x over pace"), show no pace marker, and are
  committed at their full limit in the month-end projection whether or not they've been
  charged yet. Only day-to-day spending gets extrapolated from the daily rate.
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
  estimate, and editable per-category monthly budgets.
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

Three deliberate choices:

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

Security posture: `contextIsolation: true`, `nodeIntegration: false`, a CSP meta tag,
an explicit channel allow-list, and external links handed to the system browser.

## Why this stack

Electron + React + TypeScript, with the reasoning and the rejected alternatives
(Tauri, SwiftUI, Flutter, Qt) written up in
**[docs/adr-001-tech-stack.md](docs/adr-001-tech-stack.md)**.

The short version: the domain logic is plain TypeScript that a React Native app can
reuse verbatim, the same source builds for macOS/Windows/Linux, and the UI iterates
fast — which matters most for a product whose value is a glanceable colour.

## Roadmap

- [ ] Mobile client (React Native) reusing `src/shared/`
- [ ] Real accounts + sync (this is where the email/phone signup, verification code and
      Face ID unlock from the product notes belong)
- [ ] Bank connections via Plaid instead of CSV
- [ ] Automatic recurring-bill *detection* (the `fixed` flag is set by hand today)
- [ ] SQLite storage adapter
- [ ] Spending trends across months
