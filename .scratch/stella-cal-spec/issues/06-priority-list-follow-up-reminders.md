# 06: Priority list + follow-up reminders

**What to build:** A computed priority list of doctors to visit next, ranked by days-since-last-visit and purchase trend, with doctors whose purchases are declining emphasised so the specialist can intervene before they stop ordering. Follow-up reminders surface when a visit's follow-up date arrives.

**Blocked by:** 03 — Doctor list — search, region filter, trend & last-visit indicators; 05 — Calendar + visit logging — monthly grid, tap-to-log, edit/delete.

**Status:** done

- [x] Priority list ranks doctors by a computed score blending visit gap and purchase trend.
- [x] Declining-purchase doctors are emphasised in the ranking.
- [x] The visit-gap computation (days since most recent visit) is a pure, reusable function.
- [x] A follow-up reminder appears when a visit's follow-up date arrives.

**Resolution notes (what actually shipped):**
- New pure domain seam `src/domain/priority.ts` — `daysSinceLastVisit(lastVisitDate, now)` computes whole days since the most recent visit (null when never visited, clamps future dates to 0); `priorityScore(days, trend)` blends visit gap with a declining-trend boost and a rising-trend demotion (weights in `PRIORITY_WEIGHTS`); `buildPriorityList(overviews, now)` ranks doctors by that score, flags declining doctors with `emphasis: 'declining'`, breaks ties by name. It consumes `DoctorOverview` from `derived.ts` rather than raw records, so trend/last-visit logic stays in the one existing seam.
- `dueFollowUps(visits, doctors, now)` surfaces follow-ups whose `followUpDate` is today or earlier, ordered soonest-first, with `daysOverdue`; future follow-ups, ones without a date, and ones whose doctor was removed are dropped.
- `src/app/state.ts` / `AppProvider` now carry `visits` in app state (loaded alongside overviews) so reminders and the priority list refresh together after add/edit/delete.
- New `src/app/PriorityListView.tsx`: a "Priority" tab showing due follow-up reminders (amber banner, due-today vs N-days-overdue) above a ranked priority list (rank number, declining badge, last-visit + days, trend chip). Selecting a doctor opens the detail view.
- `src/App.tsx` gained the "Priority" tab wired between Overview and Doctors.
- Tests: `src/domain/priority.test.ts` covers visit-gap arithmetic (whole days, clamps, null), the score blend, ranking order + declining emphasis, tie-breaking, and reminder due/overdue/filtering rules.

**Superseded 2026-09-01 (ADR-007):** Follow-up reminders were folded into stored Planned Visits. `dueFollowUps` and the Priority tab's reminders section were deleted; due and overdue plans are rendered on the calendar (teal-dashed when due today, amber once past). See `docs/adr/007-planned-visits-unify-followups.md`.