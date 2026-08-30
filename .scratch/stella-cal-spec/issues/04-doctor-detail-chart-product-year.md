# 04: Doctor detail — month-over-month chart, product breakdown, year filter

**What to build:** A doctor detail page charting that doctor's purchase history month over month, broken down by product, with a year filter to compare years. The chart is honest about the data: annual-only years (2018–2021) render as yearly totals, never bogus monthly bars, and negative quantities (returns/adjustments) are handled without breaking totals.

**Blocked by:** 02 — Excel import — parse → validate → unpivot → full replacement.

**Status:** done

**Resolution notes (what actually shipped):**
- Pure domain seam `buildPurchaseSeries()` (`src/domain/chart.ts`) aggregates purchases into per-product series over a shared, chronological slot axis; missing months are `null` (never fabricated zeros), negatives preserved as-is, and `month === 0` years marked `isAnnual`.
- Visualization iterated with the user from stacked bars → multi-line → grouped columns, landing on a **single-timeline grouped column chart** (`src/app/PurchaseChart.tsx`) with a **Brush zoom slider** (no two-panel split), a clickable per-product legend, and Recharts for plotting.
- Sparse months render as real gaps — no interpolation across months with no purchases.
- Annual-only years (2018–2021) render as single teal-labelled yearly columns, distinct from monthly columns.
- Negatives render below a zero reference line; totals are not corrupted.
- Detail view is **lazy-loaded** so Recharts stays out of the initial bundle (~597KB initial / ~115KB gzip chart chunk).

- [x] Opening a doctor shows their purchase history charted month over month.
- [x] Purchase history can be broken down by product.
- [x] Purchase history can be filtered to a specific year.
- [x] Years 2018–2021 are shown as yearly totals (month = 0) rather than fabricated monthly bars.
- [x] Charts handle negative quantities without breaking or corrupting totals.