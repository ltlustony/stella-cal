# ADR-005: Excel Unpivoting — Pivot Table to Flat Records

**Status:** Accepted  
**Date:** 2026-08-28

## Context

The Excel file is in **pivot-table format**: each row represents a Region + Doctor + Product + Dosage combination, with 60+ columns for monthly quantities across 2018–2026. The app needs individual purchase records per doctor per product per month.

## Decision

**Unpivot (melt) the pivot table during import** into flat `Purchase` records.

### Algorithm

```
For each data row (skipping rows 1-3 = headers, and the last grand total row):
  region = Col 1
  doctor = Col 2
  basicQty = Col 3
  product = Col 4
  dosage = Col 5
  
  For each month column (Col 6 through Col 64):
    if cell value is not None and value > 0:
      year = determineYear(columnIndex)
      month = determineMonth(columnIndex)
      create Purchase({ doctor, product, dosage, year, month, quantity, region })
```

### Year/Month Mapping

| Col Range | Year | Month Detail |
|---|---|---|
| 6 | 2018 | Annual total (no month breakdown) |
| 7 | 2019 | Annual total (no month breakdown) |
| 8 | 2020 | Annual total (no month breakdown) |
| 9 | 2021 | Annual total (no month breakdown) |
| 10–21 | 2022 | Months 1–12 |
| 22–33 | 2023 | Months 1–12 |
| 34–45 | 2024 | Months 1–12 |
| 46–57 | 2025 | Months 1–12 |
| 58–64 | 2026 | Months 1–7 (partial year) |

### Handling Annual Totals (2018–2021)

For years 2018–2021, only an annual total is available (no month-by-month breakdown). The import will store these as `month=0` to indicate "annual only" — the UI will show them as yearly totals in charts but won't participate in month-over-month comparisons.

### Handling Negative Values

Some cells contain negative values (adjustments, returns). These are imported as-is (negative quantities) to preserve the data's integrity.

## Data Volume

- ~2,600 rows × ~60 month columns → up to ~150,000 individual purchase records
- Most cells are empty (sparse matrix) — actual record count will be much lower
- IndexedDB via Dexie.js handles this volume well

## Alternatives Considered

- **Store pivot as-is:** Would require complex query logic for every view. Rejected — unpivoting once at import is simpler than unpivoting on every query.
- **Server-side unpivot:** Would require a backend. Rejected — everything is client-side per ADR-001 and ADR-002.