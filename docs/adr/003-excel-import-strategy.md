# ADR-003: Excel Import Strategy — Full Replacement on Upload

**Status:** Accepted  
**Date:** 2026-08-27  
**Updated:** 2026-08-28 (added Excel structure from sample)

## Context

The colleague updates the Excel file monthly. Each file contains the **full accumulated history** of purchase records (all months, all years). The user uploads the file manually.

### Sample Excel Structure (confirmed 2026-08-28)

The Excel is a **pivot-table style report** (not flat CSV). Key characteristics:

| Property | Value |
|---|---|
| Rows | 2,606 (2 header rows + 2,603 data rows + 1 grand total row) |
| Columns | 65 |
| Regions | 33 unique |
| Doctors | 595 unique |
| Products | 58 unique |
| Dosages | 21 unique |
| Grand Total | 229,542 units |
| Time Range | 2018–2026 (partial 2026: Jan–Jul) |

**Column Layout:**

| Col | Header (Row 3) | Content |
|---|---|---|
| 1 | 地區說明 | Region name (e.g., 荔枝角, 九龍塘, 北角) |
| 2 | 客戶簡稱 | Doctor/clinic name (e.g., 栢健家庭醫療中心-麥錦麟醫生) |
| 3 | Basic Quantity | Base order quantity |
| 4 | Product | Product name (e.g., Actein, Musolax, Azetin) |
| 5 | Dosage | Dosage (e.g., 600mg, 200mg, N/A) |
| 6–9 | (2018–2021) | Annual totals (single column per year) |
| 10–21 | (2022) | Monthly quantities (cols 10–21 = months 1–12) |
| 22–33 | (2023) | Monthly quantities |
| 34–45 | (2024) | Monthly quantities |
| 46–57 | (2025) | Monthly quantities |
| 58–64 | (2026) | Monthly quantities (partial year, months 1–7) |
| 65 | 總計 | Row total (sum of all months) |

**Row 1** is a merged title "Sum of Quantity". **Row 2** contains year labels (2018, 2019, …, 2026, 總計) as merged cells. **Row 3** contains the actual column headers. **Row 2606** is the grand total row.

## Decision

On each upload, **clear all existing purchase records and re-import from the Excel file**.

Rationale:
- The Excel is the source of truth — always contains the complete dataset
- No need to detect diffs, merge records, or handle partial updates
- Simpler: no de-duplication logic, no conflict resolution
- Visit records (user-entered) are separate and NOT cleared on import
- The "full replacement" pattern is deterministic and predictable

## Import Flow

1. User taps "Import Excel" button
2. File picker opens, user selects `.xlsx`/`.xls`
3. SheetJS/xlsx parses the file in the browser
4. App validates expected structure (rows 1-3 match expected headers)
5. **Unpivot**: Each data row is exploded into individual monthly purchase records (see ADR-005)
6. Grand total row (Row 2606) is skipped
7. All existing purchase records are deleted from IndexedDB
8. New records are bulk-inserted
9. Doctor and Region tables are upserted (merged, not cleared)

## Consequences

- ~2,600 rows × ~60 month columns = up to ~150,000 individual purchase records after unpivoting
- Large files may take a few seconds to parse; show a progress indicator
- Doctor metadata (names, regions) should be upserted, not cleared, to preserve any user-added notes
- Visit records are completely independent of the Excel import
- Must validate column structure before clearing data
- The 2018–2021 annual totals need special handling — they are already aggregated (no month-level detail)