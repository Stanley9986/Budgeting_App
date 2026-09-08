# September 2026 code review

This pass reviewed the existing local desktop feature set and fixed issues found in
calculation, persistence, IPC, forms, and workflow testing. It does not add bank sync or
expand the product scope.

## Findings addressed

| Priority | Problem | Change and regression evidence |
| --- | --- | --- |
| High | A read failure could be treated as corrupt JSON and trigger replacement; failed recovery could put the original budget at risk. | Separate missing files, unreadable files, invalid data and newer schemas. Preserve the original before recovery. Real-file and fault-injection tests cover these paths. |
| High | Failed writes, mutable cached objects and failed undo could make memory/history disagree with disk. | Clone owned snapshots, publish only after atomic writes succeed, preserve failed undo for retry, and omit no-op history entries. Storage tests reopen files and verify failure behavior. |
| Medium | Rapid autosaves could be dropped or apply stale whole records over newer edits. | Serialize mutations and resolve category patches against the latest snapshot. Unit and desktop regressions cover overlapping edits and reversions. |
| Medium | Undo, normalized values and older save responses could leave stale or overwritten form fields. | Track dirty fields explicitly and acknowledge submitted fields, including no-op blurs. Preserve newer typing, adopt normalized saved values, reset replacement drafts, and isolate theme changes from unsaved profile edits. |
| Medium | Malformed CSV quoting could crash the preview; permissive parsing could accept impossible dates, shifted columns, ambiguous debit/credit rows or unusable amounts. | Fail with explicit preview errors, guard header extraction, require deterministic date/amount parsing, and retain a usable import dialog. Tests cover parsing and UI recovery. |
| Medium | Past/future months used current-month projection assumptions; goal due dates and calendar navigation had timezone/short-month errors. | Distinguish historical actual spending, current daily pacing and future commitments. Use local calendar dates and clamped month arithmetic. Add goal/date/money regressions and accurate dashboard labels. |
| Medium | Editing a bill payment's type or category could leave a false paid link. | Unlink invalidated payments during individual or bulk edits and explain the effect in the editor. Storage tests verify detachment and undo. |
| Medium | IPC trusted arbitrary renderer frames, and separate app processes could write independent caches to one JSON file. | Require the configured document and its main frame, sandbox the renderer, limit external links/navigation, and use a single-instance lock. IPC tests and Electron startup checks verify the boundary. |
| Medium | Dialog focus restoration captured an autofocused input instead of the launching control; errors were outside the keyboard trap and Cancel could discard a pending failed-save draft. | Capture focus before commit, portal dialogs above an inert app, show errors inside the dialog, and disable editing/cancellation during saves. Desktop tests exercise focus and failed-save recovery. |
| Low | Long-page scroll offsets followed the user to a different screen; fixed-category labels implied every bill was paid after any expense. | Reset the scroll container on navigation and use recorded-expense labels. Desktop navigation and screenshots verify the result. |

## Refactoring choices

- Extracted `CategoryEditor` and `ThemePicker` from Settings so profile, appearance and
  category editing have clear ownership.
- Added a small ordered mutation queue and pure draft-state helpers with regression tests.
- Reused indexed totals/matching in reports, rules, bills and pacing instead of repeated
  scans. Kept domain functions free of UI and Electron dependencies.
- Split the desktop runner into a harness and named scenarios, with state-based waits,
  isolated data and restorable fault hooks.
- Added comments where correctness depends on ordering, ownership, date boundaries,
  no-op behavior or recovery. Kept ordinary rendering code self-explanatory.

## Verification

The full unit/integration suite contains 285 passing tests across 13 files. Production
build and both TypeScript projects pass. The domain date regressions were also checked
in Los Angeles and Tokyo timezones. All eight Electron workflow scenarios pass against
the final built app, including a full process restart. Sandboxed preload isolation was
verified at both launches. Seven screenshots were reviewed, including the import modal,
reports, and the minimum 940×640 window in Midnight.

See [testing.md](testing.md) for the feature matrix, desktop commands, invariants and
coverage limits. Desktop scenarios cover all existing feature areas on macOS; this is
not a claim of exhaustive platform, institution-format, accessibility or crash coverage.
