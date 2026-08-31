# ADR-006: Visit Backup — Client-Side JSON File Export

Visit records are user-entered and cannot be rebuilt from the Excel (the source of truth for purchases only). To protect them against site-data clearing, private windows, and device loss, we export visits to a downloadable JSON file and restore by merging new visits into the local store — never overwriting existing records — rather than adding a backend.

## Considered options

- **Backend sync (Supabase/Firebase).** Survives everything automatically with zero memory from the user, but costs an 4–6 days, requires auth and ongoing ops, and reverses ADR-002 (client-only, no backend).
- **JSON file export (chosen).** ~half a day auth/ops, keeps ADR-002. The only cost is that the user must remember to download and keep the file; a 7-day reminder banner mitigates that.

## Consequences

- Restore is idempotent: the backup's visits carry their `id`, and re-importing the same file reports "0 added, N skipped". Existing visits are never overwritten.
- The backup is scoped to visits only; purchases are always re-importable from the monthly Excel (ADR-003).
- We also request `navigator.storage.persist()` on boot to reduce silent eviction under disk pressure.
- `lastBackupAt` is held in `localStorage` (a reminder timestamp, not precious data, so it is not worth an IndexedDB migration).