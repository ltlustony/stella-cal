# 05: Calendar + visit logging — monthly grid, tap-to-log, edit/delete

**What to build:** A monthly calendar showing doctor name(s) on each visited day, filterable by region. Tapping a day opens a visit form to log — choose a doctor, add notes, an outcome, an optional follow-up date, and whether an order was placed — in a couple of taps. Visits can be edited or deleted to correct mistakes.

**Blocked by:** 02 — Excel import — parse → validate → unpivot → full replacement.

**Status:** done

- [x] Calendar shows a monthly grid, and each visited day shows the doctor name(s) visited.
- [x] Calendar can be filtered by region.
- [x] Tapping a day logs a visit: choose doctor, note, outcome, optional follow-up date, and mark whether an order was placed.
- [x] A visit record can be edited.
- [x] A visit record can be deleted.

**Resolution notes (what actually shipped):**
- New pure domain seam `src/domain/calendar.ts` — `buildMonthGrid(year, month)` builds a Monday-start monthly grid trimmed to the minimal number of full weeks (4/5/6 rows), padded with adjacent-month days; `groupVisitsByDate(visits, doctors)` resolves doctor name + region per day for the grid labels and region filter.
- `src/data/repositories.ts` visits repo gained `update`, `remove`, and `byDate` to back edit/delete and the per-day visit list.
- New `src/app/CalendarView.tsx`: month navigation, region filter, day cells with doctor-name chips ("+N more" overflow), and a bottom-sheet form for logging a visit (doctor, preset + free-text outcome, notes, optional follow-up date, order-placed checkbox). Existing visits for a day are listed with Edit / Delete actions (Delete confirms first).
- Calendar is now the **first tab** in `src/App.tsx`; visits are loaded and refreshed from the repository, and doctor-list overviews (last visit date) refresh after every add/edit/delete via `refreshOverviews`.
- Tests: `src/domain/calendar.test.ts` (grid layout + visit grouping) and extended visits-repository tests (update/remove/byDate).