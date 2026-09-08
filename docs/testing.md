# Testing and review

The September 2026 review expanded the existing domain and storage tests with failure
cases and complete Electron workflows. Tests use synthetic transactions and temporary
files. The desktop runner checks its isolated data directory before making any change.
The final pass completed 285 tests across 13 files, all eight Electron workflows, both
TypeScript projects, and the production build. Reviewed screenshots include normal and
minimum window sizes.

## Run the checks

```sh
npm test
npm run build
# Requires Playwright available to Node; uses the installed Electron runtime.
node scripts/smoke.cjs
```

If Playwright is already bundled with your development environment, set `NODE_PATH` to
that installation's `node_modules` directory. Otherwise install it locally with
`npm install --no-save --package-lock=false playwright`. No browser download is needed.
Set `BUDGET_SCREENSHOTS` to an absolute directory to keep screenshots, or
`BUDGET_KEEP_SMOKE_DATA=1` to retain the disposable test budget after a failure.
See [the runner guide](../scripts/README.md) for helpers and scenario organization.

`npm run build` includes both TypeScript projects and produces main, preload, and renderer
bundles. Run the desktop tests against a fresh build whenever production code changes.

## Coverage

| Area | Regression and workflow checks |
| --- | --- |
| Dashboard and income | Salary/hourly calculations, withholding, all three income bases, monthly totals, fixed commitments, variable projections, savings gaps, status thresholds, empty and zero-limit budgets, past/current/future periods. |
| Goals and dates | Create/edit/delete/undo both goal horizons, cent amounts, progress and funding, due-today versus overdue, leap years, short months, local-date display, month navigation and picker dismissal. |
| Transactions | Add/edit/delete, date/type/category edits, search, sorting, category/type/review filters, all months, 100-row pagination, totals, empty states, bulk category/review/delete, selection reset and undo. |
| CSV imports | File selection and drag/drop, cancellation, custom headers, signed amounts and debit/credit columns, day-first dates, category mapping, presets create/edit/delete/reuse, rules, duplicate preview and opt-out, atomic imports, malformed quoting/headers/rows/dates/amounts, invalid-row explanations and recovery. |
| Categories and rules | Category add/rename/limit/recurring/delete, dependent references, rapid autosaves and latest-record patches, normalized inputs and undo, rule create/edit/delete/apply, longest-match priority and stable ties, explicit category preservation. |
| Bills | Monthly/yearly schedules, edit/pause/delete, month-end/leap-year dates, new expenses and existing-payment links, future-date protection, duplicate links, unlink/undo, recategorizing or converting a payment, reserved commitments without double counting. |
| Reports and exports | Six/twelve-month recorded income, expenses and net cash flow, category summaries, selected-month ranges, export of every matching row across pagination, CSV escaping, cancellation and write failure. |
| Profile and themes | Name/avatar/income saves, normalization, unsaved-name isolation when changing themes, all nine themes, token completeness and contrast, preview sizes, persistence, minimum-window dark theme screenshots. |
| Storage and backup | Real-file roundtrips and reopening, schema migration and future-version rejection, independent snapshots, corruption preservation, unreadable files, failed writes and undo retries, no-op history, bounded undo, full backup/restore/recovery copies, cancellation, atomic export failure, demo/reset/undo, restart persistence. |
| Desktop boundary | Every IPC channel, validation of malformed payloads, rejection of untrusted documents and subframes, actual sandboxed preload availability and absence of renderer Node globals, startup and restart. |
| Forms and keyboard | Queued mutation ordering/rejection recovery, unsaved field acknowledgement, normalized saves, edits while earlier writes are pending, keyboard focus trapping/restoration, inert background, dismissible errors inside dialogs and failed-save draft retention. |

Domain calculations and store invariants are tested directly; desktop scenarios verify
that real UI actions reach the preload, IPC handlers, and filesystem. Native dialog
answers are supplied by the harness. Fault scenarios deliberately reject writes or hold
an IPC request until the test releases it; these substitutions are restored afterwards.
The corruption test intentionally logs the preserved invalid file and parser error.

The draft tests include reverting A → B → A during a save, and queuing B then C before
typing B again. Those cases explain why a draft cannot infer unsaved work solely by
comparing its current value to an old stored value.

## Maintainability rules

- Keep calculations and parsing in `src/shared/domain`, without Electron or React imports.
- Validate every mutation at the main-process boundary. A typed preload does not make
  arbitrary renderer payloads trustworthy.
- Resolve autosave patches against the latest queued snapshot; a complete stale record
  can undo a different field's recent edit.
- Acknowledge only the submitted fields after successful persistence. Adopt normalized
  saved values, preserve newer typing, and clear no-op blur drafts so undo remains visible.
- Publish a new cached snapshot and update undo history only after persistence succeeds.
  A cancelled dialog or no-op mutation must not consume meaningful history.
- Preserve the original budget before recovery or replacement. Permission errors are
  not evidence of corrupt data. Never turn post-save metadata/cleanup failures into an
  apparent failed write that invites a duplicate retry.
- Wait for observable UI or saved state in desktop tests. Keep fixture data synthetic;
  never point the runner at a personal budget.

## Practical limits

The desktop pass runs the built app on macOS. Windows/Linux UI behavior, signed installers,
notarization, physical power-loss behavior, exhaustive screen-reader testing, and every
bank's statement format are not covered. Calendar tests also exercise Los Angeles and
Tokyo timezones. Bank connections, transfers, reconciliation, split transactions, and
historical budget snapshots remain roadmap work, not existing features covered here.
