# 02: Excel import — parse → validate → unpivot → full replacement

**What to build:** From a file picker, the specialist imports the monthly Excel dump and it fully replaces purchase history in a safe, trustworthy way. The file parses in-browser (SheetJS), the expected structure is validated *before* any existing data is touched, the pivot table is unpivoted into flat purchase records, and purchases are cleared-and-rebuilt while visits stay untouched. Progress is visible during a large parse, and a summary of imported counts builds trust.

**Blocked by:** 01 — Foundation — PWA shell, domain model, and IndexedDB schema & repositories.

**Status:** ready-for-agent

- [ ] User picks an `.xlsx`/`.xls` file from a file picker and sees import progress while a large file parses (never a frozen/blank screen).
- [ ] Excel structure is validated (expected header rows/columns) before existing purchase data is wiped — a malformed file leaves existing data intact with a clear error.
- [ ] Pivot rows are unpivoted into flat `Purchase` records following ADR-005 mappings: cols 6–9 → years 2018–2021 with `month = 0`; cols 10–64 → 2022–2026 with correct month assignment (2026 partial, months 1–7).
- [ ] Header rows and the grand-total row are skipped; empty/blank/zero cells are skipped; negative quantities are preserved as-is.
- [ ] Import replaces all purchase records while region/doctor rows are upserted (merged, not cleared) and visit records are never touched.
- [ ] A summary shows how many records were imported (doctors, purchases, regions) so the specialist can trust it succeeded.