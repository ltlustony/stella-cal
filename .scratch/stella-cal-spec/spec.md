# Stella-Cal — Product Spec

**Status:** ready-for-agent
**Date:** 2026-08-28
**Source:** Conversation + ADRs 001–005 + domain glossary + parsed `sample.xlsx`

---

## Problem Statement

A pharmaceutical sales specialist visits GPs in clinics across Hong Kong to promote products. Each month a colleague sends them an Excel file containing the **full accumulated purchase history** — every doctor × every product × every month going back to 2018. The file is a dense pivot table (65 columns, ~2,600 rows) that is impossible to read usefully on a phone: you cannot answer "who has this doctor been buying and when?", "who have I not visited recently?", or "whose purchases are declining?" without manually cross-referencing a spreadsheet.

Today the specialist has no way to mark which doctors were visited on which days, no way to see a doctor's purchase history at a glance, and no way to know who to prioritize for the next visit. All of this lives in the specialist's head and in an unwieldy monthly Excel dump.

## Solution

A **Progressive Web App** (installed to the phone's home screen, works offline) that:

1. **Imports the monthly Excel file** in the browser, unpivots the pivot table into flat purchase records, and stores them locally on the device.
2. **Shows a calendar** where each visited day shows the doctor(s) visited, filterable by region.
3. **Lets the user log visits** — tap a day, record the doctor, notes, outcome, and follow-up date.
4. **Shows purchase history per doctor** — a month-over-month trend chart and a signal for whether purchases are rising, flat, or falling.
5. **Prioritizes who to visit next** — computed from days since last visit and purchase trend.

The Excel file remains the single source of truth for purchases. Visit records are user-entered and independent: importing a new Excel file clears and rebuilds purchase data but never touches visits.

---

## User Stories

1. As a sales specialist, I want to install the app to my phone's home screen, so that it feels like a native app and opens in full screen.
2. As a sales specialist, I want the app to open and work without an internet connection, so that I can use it inside clinics with poor reception.
3. As a sales specialist, I want to import a monthly Excel file from a file picker, so that my purchase data is always up to date.
4. As a sales specialist, I want to see import progress while a large file parses, so that I know it is still working and not frozen.
5. As a sales specialist, I want the app to validate the Excel structure before wiping existing data, so that I never lose data to a malformed file.
6. As a sales specialist, I want importing a new Excel file to fully replace the purchase history while leaving my visit records untouched, so that re-importing is safe and predictable.
7. As a sales specialist, I want to see a monthly calendar view, so that I know which days I have appointments.
8. As a sales specialist, I want each visited day on the calendar to show the doctor name(s) I visited, so that I can review my schedule at a glance.
9. As a sales specialist, I want to filter the calendar by region, so that I can focus on one geographic area at a time.
10. As a sales specialist, I want to tap a day and log a visit — choosing a doctor, adding notes, an outcome, and an optional follow-up date, so that the visit is captured in a couple of taps.
11. As a sales specialist, I want to mark whether an order was placed during a visit, so that I can later see which visits converted.
12. As a sales specialist, I want to edit or delete a visit record, so that I can correct mistakes.
13. As a sales specialist, I want to see a list of all doctors, filterable by region, so that I can navigate to any doctor quickly.
14. As a sales specialist, I want to search the doctor list by name, so that I can find a specific doctor without scrolling.
15. As a sales specialist, I want to see each doctor's last visit date and a trend indicator in the list, so that I can spot who needs attention.
16. As a sales specialist, I want to open a doctor's detail page and see their purchase history charted month over month, so that I can understand their buying behaviour.
17. As a sales specialist, I want to see the doctor's purchase history broken down by product, so that I know which products this doctor buys.
18. As a sales specialist, I want to see the doctor's purchase history filtered to a specific year, so that I can compare this year against prior years.
19. As a sales specialist, I want to see all past visits with a doctor on their detail page, so that I can recall what we discussed.
20. As a sales specialist, I want to see a computed priority list of doctors to visit next, ranked by days-since-last-visit and purchase trend, so that I spend my day most effectively.
21. As a sales specialist, I want the priority list to emphasise doctors whose purchases are declining, so that I can intervene before they stop ordering.
22. As a sales specialist, I want to see a follow-up reminder when a visit's follow-up date arrives, so that I don't drop the ball.
23. As a sales specialist, I want the annual-only years (2018–2021) shown as yearly totals rather than bogus monthly bars, so that charts are honest about the data.
24. As a sales specialist, I want charts to handle negative quantities (returns/adjustments) without breaking, so that data integrity is preserved.
25. As a sales specialist, I want the app to remember my data across app restarts, so that I don't have to re-import every time I open it.
26. As a sales specialist, I want a clear signal of how many records were imported (doctors, purchases, regions), so that I trust the import succeeded.

---

## Implementation Decisions

### Modules

- **Domain layer** — type definitions for `Region`, `Doctor`, `Product`, `Purchase`, and `Visit`, matching the glossary.
- **Import/unpivot module** — a pure function that turns parsed sheet rows into flat `Purchase[]`.
- **Data-access layer** — Dexie repositories wrapping the schema below; the single boundary between app logic and storage.
- **Derived/computation module** — pure functions for visit gap, purchase trend (up/flat/down), and visit-priority score.
- **UI layer** — thin React components (calendar, doctor list, doctor detail, import, priority) backed by React Context + useReducer.

### Schema (Dexie/IndexedDB)

- `regions` — `id`, `name` (unique).
- `doctors` — `id`, `name`, `regionId` (indexed).
- `purchases` — `id`, `doctorId`, `regionId` (denormalized), `product`, `dosage`, `basicQty`, `year`, `month` (0 = annual-only), `quantity` (can be negative). Indexed by `[doctorId, year, month]`.
- `visits` — `id`, `doctorId`, `date`, `notes`, `outcome`, `followUpDate?`, `orderPlaced` (boolean). Indexed by `date`.

### Unpivot rules

- Skip header rows and the grand-total row.
- Map columns 6–9 to years 2018–2021 with `month = 0` (annual totals), columns 10–64 to 2022–2026 with months 1–12 (2026 partial to month 7).
- Emit a `Purchase` only when the cell has a value and is non-zero; preserve negative values as-is.
- Region and doctor are upserted (merged); purchase records are fully replaced on each import.

### Derived computations (contracts)

- **Visit gap** = days from today to the doctor's most recent visit date.
- **Purchase trend** = compare total quantity of the most recent N complete months against the prior N months → `up` / `flat` / `down`.
- **Priority score** = weighted blend of visit gap (higher = more urgent) and a declining-trend penalty.

### Interactions

- Import flow: pick file → parse (SheetJS) → validate headers → unpivot → clear purchases → bulk-insert → upsert doctor/region → show summary counts.
- Calendar: tap day → visit form → save → calendar refreshes.
- Doctor detail: chart driven by the purchases index for that doctor, with a year filter.

---

## Testing Decisions

**What makes a good test:** assert observable external behaviour and outputs, never internal implementation. For pure functions, assert input→output; for the data layer, assert persisted-query results; never assert React internals or DOM structure for UI.

**Modules to test (seams):**

1. **Import/unpivot (pure) — primary seam, tested exhaustively.** Fixed Excel-like fixtures covering: normal monthly cells, 2018–2021 annual mapping to `month=0`, 2026 partial-year columns, negative values, zero/empty/blank cells skipped, header and grand-total rows skipped, and column-to-year/month boundary correctness.
2. **Derived computations (pure).** Visit gap, purchase trend (up/flat/down across counts), and priority ranking ordering — pure fixtures, table-driven.
3. **Data-access layer.** Repository happy path against an in-memory or resettable IndexedDB: full-replacement import clears old purchases but preserves visits; doctor/region upsert dedupes correctly; the per-doctor purchase query and date-ranged visit query return correct results.

**Prior art:** none (greenfield). The test seams above define the project's only seams — the ideal of a minimal seam count is preserved by keeping the UI untested-by-unit and verified manually.

**UI:** verified manually for now — component/wireframe smoke checks, no unit tests on React internals.

---

## Out of Scope

- Backend, server, authentication, or multi-user accounts.
- Multi-device sync or cloud storage.
- Native push notifications.
- Reading/writing the native OS calendar.
- App-store distribution (it's a PWA).
- Editing purchase records inside the app (the Excel file is authoritative; the app is read-only for purchases).
- Historical import of multiple separate Excel files (a single file always contains the full history).

---

## Further Notes

- The Excel is the **source of truth** for purchases; the app treats purchase data as read-only and rebuildable.
- Visit records are the only user-authored data and must survive every import.
- The 2018–2021 annual-only data is a data-quality constraint, not a defect; the UI must not fabricate monthly detail for those years.
- Negatives must be preserved — treating them as zero would corrupt totals.
- Data scale after unpivoting is estimated in the tens of thousands of records; Dexie/IndexedDB handles this comfortably, but import should show progress.