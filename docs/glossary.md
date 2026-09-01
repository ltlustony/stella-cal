# Domain Glossary — Stella-Cal

> Shared vocabulary for doctors, visits, purchases, and regions in the pharmaceutical sales domain.
> Updated: 2026-08-28 with real Excel structure.

## Core Entities

### Region
A geographic grouping of doctors. Each doctor belongs to exactly one region.

**Attributes:**
- Name (unique, e.g., "荔枝角", "九龍塘", "北角", "太古城")

**From Excel:** Col 1 (地區說明). 33 regions total.

### Doctor
A general practitioner (GP) or clinic. The sales specialist visits doctors to promote pharmaceutical products.

**Attributes:**
- Name (format: "診所名-醫生名" or "醫生名", e.g., "栢健家庭醫療中心-麥錦麟醫生")
- Region (FK → Region)

**From Excel:** Col 2 (客戶簡稱). 595 doctors total.

### Product
A pharmaceutical product (medicine/supplement).

**Attributes:**
- Name (e.g., "Actein", "Musolax", "Azetin", "護眼素")
- Dosage (e.g., "600mg", "200mg", "N/A")

**From Excel:** Col 4 (Product) and Col 5 (Dosage). 58 products, 21 dosage variants.

### Purchase Record
A single product purchase by a doctor in a specific month.

**Attributes:**
- Doctor (FK → Doctor)
- Region (FK → Region, denormalized from doctor for query speed)
- Product (string)
- Dosage (string)
- Basic Quantity (number, the base order size)
- Year (integer, 2018–2026)
- Month (integer, 1–12; 0 = annual total only for 2018–2021)
- Quantity (integer, number of units ordered)

**From Excel:** Each row × month column combination with a non-zero quantity becomes one Purchase Record.

### Visit Record
A user-entered log of a sales visit to a doctor. Marked on the calendar.

**Attributes:**
- Doctor (FK → Doctor)
- Date (the day of the visit)
- Time (optional, `HH:mm` — a booked appointment time, carried over when a Planned Visit is completed)
- Notes (free-text, what was discussed)
- Outcome (e.g., "Order placed", "Follow-up needed", "No interest")
- Order Placed (boolean, whether an order resulted from this visit)

### Planned Visit
A stored visit that hasn't happened yet — created by tapping a future calendar day, or nominated from a completed visit's "Next visit date" field (ADR-007). Follow-ups on completed visits *are* Planned Visits; the two concepts are one record type.

**Attributes:**
- Doctor (FK → Doctor)
- Date (the planned day; if it passes uncompleted, the plan becomes an Overdue Plan)
- Time (optional, `HH:mm` booked time)
- Notes (free-text, what to discuss)

**Rules:**
- Excluded from all derived analytics: last-visit date, purchase trend, and priority ranking only count completed visits.
- Rendered as a dashed teal label on the calendar (amber once overdue).
- Managed purely from the calendar: complete, reschedule, or delete (including overdue plans).

### Overdue Plan
A Planned Visit whose date has passed while still in `planned` status. Shown amber on the calendar from the day after its date; a plan due today stays actionable (teal-dashed). There is no separate follow-up reminder list — the calendar is the single home for due and overdue plans.

## Excel Structure

| Row | Purpose |
|---|---|
| Row 1 | Title: "Sum of Quantity" (merged) |
| Row 2 | Year labels: 2018, 2019, …, 2026, 總計 |
| Row 3 | Column headers: 地區說明, 客戶簡稱, Basic Quantity, Product, Dosage, then month numbers (1-12) for each year |
| Rows 4–2605 | Data rows (2,602 records) |
| Row 2606 | Grand total row |

**Time coverage:** 2018–2026 (2026: Jan–Jul only). Years 2018–2021 have annual totals only (no month breakdown).

## Views

| View | Purpose |
|---|---|
| **Calendar View** | Month grid showing completed visits (solid teal labels) and Planned Visits (dashed labels; amber when overdue, 🕐 when a booked time is set). Filterable by region. Tapping a day logs or plans a visit. |
| **Doctor List View** | All doctors, sorted/filtered by region and purchase volume. Shows last visit date and trend indicators. |
| **Doctor Detail** | Single doctor: purchase history chart (month-over-month), all visit records, priority score. |
| **Priority View** | Doctors to visit next, ranked by days-since-last-visit blended with purchase trend. Counts completed visits only. |
| **Settings View** | Excel import, backup (download visits as JSON) and restore (merge a backup file back in), plus a reminder when no backup has been taken in 7 days. |

## Data Flow

```
Excel file (monthly) → Upload via app → Parse (SheetJS) → Unpivot → IndexedDB
                                                                    ↓
User marks visits → Calendar → Visit Records → IndexedDB
                                                                    ↓
Query: Visit Records + Purchase Records → Trend Analysis → Visit Prioritization
```

## Key Terms

| Term | Definition |
|---|---|
| **Purchase source of truth** | The Excel file. Always contains the complete purchase history and is re-imported on demand (ADR-003). |
| **Visit source of truth** | The local IndexedDB store, backed up to a user-managed JSON file (ADR-006). Unlike purchases, visits cannot be rebuilt from the Excel. |
| **Follow-up** | A completed visit's nominated next visit date. Saving it creates a Planned Visit for the same doctor on that date (ADR-007); the plan then lives independently and is managed from the calendar. |
| **Unpivoting** | Converting the pivot-table layout (one row per doctor×product with 60 month columns) into flat records (one row per doctor×product×month). |
| **Full Replacement** | On import, all purchase records are cleared and re-inserted. Visit records are untouched. |
| **Backup (Visit)** | A user-downloaded JSON file of all visit records, used to restore visits after site-data clearing or device loss. Restore merges by id and never overwrites existing visits. |
| **Visit Gap** | Days since the last recorded visit to a doctor. Used in prioritization. |
| **Purchase Trend** | Direction of purchase volume over recent months (up, flat, down). |
| **Basic Quantity** | The base order size for a product (e.g., 30, 100, 200). Used for reference. |

## Data Scale

| Metric | Value |
|---|---|
| Regions | 33 |
| Doctors | 595 |
| Products | 58 |
| Dosage variants | 21 |
| Data rows | ~2,600 |
| Time range | 2018–2026 (9 years) |
| Grand total orders | 229,542 units |
| Estimated purchase records | ~30,000–50,000 (after unpivoting, sparse) |