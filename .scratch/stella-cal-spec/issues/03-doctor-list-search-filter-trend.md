# 03: Doctor list — search, region filter, trend & last-visit indicators

**What to build:** A browsable list of all doctors, filterable by region and searchable by name, where each row shows the doctor's last visit date and an up/flat/down purchase-trend indicator so the specialist can spot who needs attention at a glance.

**Blocked by:** 02 — Excel import — parse → validate → unpivot → full replacement.

**Status:** resolved

- [x] All doctors are listed, filterable by region.
- [x] Doctor list is searchable by name.
- [x] Each doctor row shows the last visit date and a trend indicator (up/flat/down).
- [x] The purchase-trend computation (recent N complete months vs prior N months) is implemented as a pure, reusable function — this becomes the shared seam used by the priority list too.