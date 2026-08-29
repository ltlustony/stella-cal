# 04: Doctor detail — month-over-month chart, product breakdown, year filter

**What to build:** A doctor detail page charting that doctor's purchase history month over month, broken down by product, with a year filter to compare years. The chart is honest about the data: annual-only years (2018–2021) render as yearly totals, never bogus monthly bars, and negative quantities (returns/adjustments) are handled without breaking totals.

**Blocked by:** 02 — Excel import — parse → validate → unpivot → full replacement.

**Status:** ready-for-agent

- [ ] Opening a doctor shows their purchase history charted month over month.
- [ ] Purchase history can be broken down by product.
- [ ] Purchase history can be filtered to a specific year.
- [ ] Years 2018–2021 are shown as yearly totals (month = 0) rather than fabricated monthly bars.
- [ ] Charts handle negative quantities without breaking or corrupting totals.