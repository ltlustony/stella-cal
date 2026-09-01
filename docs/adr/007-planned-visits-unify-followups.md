# ADR-007: Planned Visits — Unifying Follow-Ups into Stored Visit Records

A follow-up on a completed visit and a future "plan to visit" are the same concept, so both are stored as **Planned Visits**: real visit records with `status: 'planned'` instead of a derived marker or a `followUpDate` field on a completed visit. Saving a completed visit with a "Next visit date" creates the planned record directly; the calendar is the single home for planned and overdue plans (amber once past their date, teal-dashed while future/today).

## Considered options

- **Keep `followUpDate` on completed visits, derive the calendar markers (status quo).** Zero migration cost, but plans were then coupled to their parent visit: you couldn't edit, reschedule, or delete a plan without editing the visit that created it, and "overdue" was only a reminder-list concern — easy to lose.
- **Two record types (visit + plan).** Duplicates doctor/date fields and splits calendar rendering across two entities for one user concept.
- **Stored Planned Visit records (chosen).** One record type, first-class lifecycle (plan → complete/reschedule/delete, including overdue plans), and analytics stay honest because planned visits are excluded from last-visit/trend/priority. Cost: a `status` field added to the Visit schema and a backup format bump (v2). Accepted because there were no active users, so no data migration was needed.

## Consequences

- `Visit` gains `status?: 'planned' | 'completed'` (`undefined` = completed, so old-shaped reads stay valid) and `time?: string` (`HH:mm`) for a booked appointment time.
- `followUpDate` is removed from `Visit`. Existing data was not backfilled — no active users existed at the time.
- Planned visits are excluded from every derived signal: last-visit date, purchase trend, and the priority list count completed visits only.
- The Priority tab's follow-up-reminder section was deleted; the calendar renders due/overdue plans directly (teal-dashed due today, amber from the day after).
- Backup format version bumped to 2; restore validation rejects unknown statuses.
