# How this is tested

`npm test` runs 156 tests. They cover the parts where a bug would be silent and
expensive — the maths and the parsing — rather than chasing coverage of React markup.

**`src/shared/domain/__tests__/pacing.test.ts`** — income from salary vs. hourly,
withholding, the "day 1 is one day, not zero days" edge in the elapsed-time fraction,
month-end projection from the current daily rate, month bucketing, `activeMonths` (one key per month regardless of transaction count,
spanning year boundaries) which drives the month picker's dots, uncategorized spend,
the four colour transitions, and the tolerance that stops a lumpy purchase from reading
as an overspend.

Also the fixed-bill rules: a category flagged *recurring* is green the day it's paid
rather than projected to 30x its limit, still owes its full limit before it's charged, goes red only when the bill exceeds the limit, and is
committed at full value in the month-end projection while only variable spending
(including uncategorized spend) is extrapolated from the daily rate.

**`src/shared/domain/__tests__/goals.test.ts`** — remaining amount, progress clamping,
whole-months-remaining, the divide-by-zero guard when a goal is due this month, overdue
detection, and the sum across goals that drives the dashboard colour.

**`src/shared/domain/__tests__/csv.test.ts`** — a quoted-field/escaped-quote CSV parser,
CRLF, three date formats, single signed `Amount` columns vs. separate `Debit`/`Credit`
columns, currency symbols and parenthesised negatives, category mapping, duplicate
detection, and — importantly — that a malformed row is skipped with an explanation
instead of failing the whole import.

**`src/main/store/__tests__/budgetStore.test.ts`** — round-trips through a real
temporary file: defaults on first run, persistence across a reopen, normalisation
(amounts stored positive, unknown category ids dropped, withholding clamped),
transactions surviving the deletion of their category, upsert-not-duplicate on goals,
recovery from a corrupt data file, and the migration that backfills `fixed` on budgets
written before that field existed — recognising the built-in categories by id or name so
an upgrade doesn't silently demote rent to variable spending.

**`src/shared/__tests__/themes.test.ts`** — every theme defines every token, ids are
unique, an unknown id falls back to the default rather than rendering a half-styled app,
the camelCase-to-custom-property conversion, that a *retired* theme id (Espresso) still
falls back cleanly so an old profile renders, and that the catalogue actually leans warm
— at least four light themes whose background has more red in it than blue. The interesting ones compute WCAG 2.1
contrast ratios and assert, for all seven themes, that body text clears 4.5:1 on both
surfaces, that secondary text and the red/yellow/green status colours clear 3:1, and
that primary-button text clears 4.5:1 on the accent. This caught the original Sand
accent at 4.46:1 and forced it a shade darker.

**`src/shared/__tests__/palette.test.ts`** — the category colours are unique, stay far
enough apart in RGB space to be told apart as 9px dots, and keep at least 2:1 contrast
against both the lightest and darkest surfaces any theme defines (computed from the
theme list, so a new theme with an extreme background fails this test rather than
quietly making dots invisible). Plus the remap across *both* retired palettes — the
original cool one and the first warm pass — each mapping to a current colour,
case-insensitively, while a colour the user picked is left alone. A test also asserts the
current palette never reuses a retired value, so a repaint can't silently no-op.

Beyond the unit tests, the built app was launched headless (Electron driven by
Playwright) to confirm it boots with no console errors, that the preload bridge and
every IPC channel round-trip, and that adding a transaction through the UI reaches the
store and comes back into the list. That pass also drives the month picker — opening it from the label,
stepping a year back, picking a month and confirming the header follows and the popover
closes, then confirming it also closes on an outside click and on Escape — switches
themes and reads the resulting custom properties back off `<html>`, and asserts the theme
preview strip has real width — it caught a collapsed flex layout that unit tests never could, since
`button` carries `align-items: center` from the UA stylesheet.

## Local desktop workflow checks (September 2026)

`src/main/store/__tests__/workflows.test.ts` adds real-file checks for rule application,
atomic imports, duplicate skipping, bulk edits, bounded undo, write failures, bill linking,
schedule commitments, backup validation, schema migration and paycheck income treatment.
`src/shared/domain/__tests__/workflows.test.ts` covers month-end and leap-year schedules,
rule precedence, custom CSV mappings, date conventions, recorded reports and CSV export.

`scripts/smoke.cjs` exercises the built Electron app against a disposable temporary data
directory. It drives rule creation, custom bank formats, statement import, duplicate
preview, review/undo, CSV export, bill linking, reports, backup/restore and failed-save
recovery. It also takes screenshots at normal size and at the minimum 940×640 window
size with the Midnight theme. Native file-dialog choices are supplied by the test;
the IPC handlers, parser, filesystem writes and renderer are real.

```sh
npm test
npm run build
# Optional UI check; install Playwright if it is not already provided by your environment.
npm install --no-save --package-lock=false playwright
node scripts/smoke.cjs
```

Alternatively, point `NODE_PATH` at an existing installation containing `playwright`.
Set `BUDGET_SCREENSHOTS` to a directory to retain screenshots outside the disposable
data directory. `BUDGET_DATA_DIR` is a development-only override used by the test; normal
launches continue to use the app's normal data directory. The smoke test never loads or
changes the user's personal budget.

Not covered: live bank connections (not implemented), institution-specific CSV samples,
Windows/Linux UI behavior, signed installers, or large-scale account reconciliation.
