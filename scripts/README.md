# Electron workflow checks

Build the application, then run:

```sh
npm run build
node scripts/smoke.cjs
```

The runner needs `playwright` available to Node. When using a bundled installation, set `NODE_PATH` to its `node_modules` directory. No browser download is needed: Playwright launches the app's installed Electron binary.

The runner creates its own temporary `BUDGET_DATA_DIR` and verifies Electron uses it before any mutation. It removes that directory on exit. It never reads or changes the normal application budget. Native file dialogs and application confirmations receive test choices; forms, drag/drop, IPC, and filesystem persistence run through the actual app.

Useful environment variables:

- `BUDGET_SCREENSHOTS=/absolute/path`: preserve screenshots outside the temporary directory.
- `BUDGET_KEEP_SMOKE_DATA=1`: retain the disposable data and failure screenshot for investigation.

`smoke-harness.cjs` contains navigation, dialog, isolation, and state-based waiting helpers. `smoke-scenarios.cjs` contains ordered, named workflows. Scenarios intentionally build on their predecessors; each full run starts clean. Read-only calls to the preload inspect committed state, while all fixture mutations go through user-facing controls or CSV import. Do not add sleeps to fix races: wait for the expected UI or committed data instead.

Coverage includes profile/income modes, every theme, category autosaves/undo, goals, month navigation, modal focus, transaction CRUD/filtering/sorting/pagination, rules, bank formats, duplicate handling, separate debit/credit columns, drag/drop, bulk actions, bills and payment links, reports, filtered CSV export, backups/recovery, cancellations/failures, demo/reset/undo, and a full Electron restart. Domain and store tests separately verify calculations and validation; this suite verifies those behaviors are reachable through the desktop UI.
