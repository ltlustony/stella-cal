# 06: Priority list + follow-up reminders

**What to build:** A computed priority list of doctors to visit next, ranked by days-since-last-visit and purchase trend, with doctors whose purchases are declining emphasised so the specialist can intervene before they stop ordering. Follow-up reminders surface when a visit's follow-up date arrives.

**Blocked by:** 03 — Doctor list — search, region filter, trend & last-visit indicators; 05 — Calendar + visit logging — monthly grid, tap-to-log, edit/delete.

**Status:** ready-for-agent

- [ ] Priority list ranks doctors by a computed score blending visit gap and purchase trend.
- [ ] Declining-purchase doctors are emphasised in the ranking.
- [ ] The visit-gap computation (days since most recent visit) is a pure, reusable function.
- [ ] A follow-up reminder appears when a visit's follow-up date arrives.