# ADR 001 — Desktop stack: Electron + React + TypeScript + Vite

**Status:** accepted · **Date:** 2026-08-29

## Context

The goal is a *desktop* budgeting app (explicitly not a web page), starting on macOS,
with iOS/Android clients planned later. This is an MVP: it has to be demo-able quickly,
run offline, and store a small amount of personal financial data locally. There is no
backend and no bank integration yet.

Constraints that actually drove the decision:

1. **Desktop first, mobile soon.** Whatever is written now should not be thrown away
   when the phone app starts.
2. **One developer, MVP timeline.** Ecosystem maturity and familiarity beat raw
   runtime efficiency.
3. **Rich, chart-and-colour-heavy UI.** The whole product idea is a red/yellow/green
   read on your month, so layout and styling iteration speed matters.
4. **Local, private data.** No cloud, no accounts, in this phase.

## Decision

**Electron 33** for the desktop shell, **React 18 + TypeScript** for the UI,
**Vite** (via `electron-vite`) for the build, **Vitest** for tests, and
**electron-builder** for packaging.

## Alternatives considered

| Option | Why not (for this project, now) |
| --- | --- |
| **Tauri (Rust core + web UI)** | Genuinely better on binary size (~5 MB vs ~100 MB) and memory, and I would revisit it if distribution size became a real constraint. But the backend is Rust, so the domain logic could not be shared with a React Native mobile client, and the smaller plugin ecosystem means more time spent on plumbing during exactly the phase where time is scarcest. |
| **Native SwiftUI (macOS)** | The best-feeling macOS app, and the natural pair with a future SwiftUI iOS app. Rejected because it locks the project to Apple platforms — Windows was an explicit later goal — and none of the UI or business logic would transfer to Android. |
| **Flutter desktop** | One codebase for desktop *and* mobile, which is the strongest argument against my choice. Rejected on ecosystem fit: Dart means a separate language from the rest of my work, desktop support is the least mature of Flutter's targets, and the financial-charting library ecosystem is thinner than the web's. |
| **Python + Qt (PySide)** | Fastest to hack together for a data-modelling person, but nothing carries over to mobile, packaging and code-signing a Python app for macOS distribution is painful, and the UI would be much harder to make look modern. |
| **A web app in a browser** | Ruled out by the requirement: this is a desktop app. It also cannot use the native file dialog for CSV import or keep data on-device without browser storage caveats. |
| **.NET MAUI / Avalonia** | Credible cross-platform C# option, but a smaller talent and library pool around it, and no code sharing with a React Native client. |

## Consequences

**What this buys**

- **Code reuse into mobile.** Everything in `src/shared/` — the domain types, the
  pacing engine, the goal maths, the CSV parser — is dependency-free TypeScript.
  A React Native client imports those files unchanged; only the view layer and the
  storage adapter get rewritten. That was the single biggest factor in the decision.
- **Cross-platform for free.** The same source produces macOS, Windows and Linux
  builds via electron-builder. Windows support becomes a config line, not a rewrite.
- **UI iteration speed.** CSS and React let the colour system, progress bars and
  layout be tuned in seconds with hot reload, which matters for a product whose value
  is "tell me at a glance how I'm doing".
- **Real native capabilities.** The native file-open dialog for CSV import, a real
  application menu, and a real on-disk data file in the OS's application-support
  directory — none of which a web page gets.
- **A typed IPC boundary.** `BudgetApi` in `src/shared/api.ts` is implemented by the
  preload bridge and consumed by React, so a mismatch between the UI and the storage
  layer is a compile error rather than a runtime one.

**What it costs, and how it is mitigated**

- **Bundle size (~100 MB) and memory.** Accepted: this is a personal-finance app run
  on a laptop, not an embedded device. If distribution size becomes a real complaint,
  the shell is the *only* part that has to change — the shared domain code is
  shell-agnostic, so a Tauri migration would be a rewrite of `src/main`, not of the app.
- **Electron's security model needs deliberate handling.** Addressed rather than
  ignored: `contextIsolation: true`, `nodeIntegration: false`, a Content-Security-Policy
  meta tag, an explicit allow-list of IPC channels in the preload script, and
  `setWindowOpenHandler` sending external links to the system browser. The renderer
  has no access to Node, the filesystem, or arbitrary IPC.
- **Not a "native-feeling" Mac app.** Partly mitigated with `titleBarStyle:
  'hiddenInset'` and system fonts. A trade knowingly made in exchange for the
  cross-platform and code-reuse wins above.

## If this were a real product

The next decisions in line: move persistence to SQLite behind the existing `Database`
interface (see ADR 002), add a sync service so desktop and mobile share state, and
integrate Plaid for real transaction data — at which point the pacing engine in
`src/shared/domain/` still does not change.
