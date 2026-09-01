/**
 * Domain types — the single source of truth for the shapes stored in
 * IndexedDB. These mirror the glossary and the schema in the product spec.
 *
 * `id` is optional on every entity because it is assigned by Dexie's
 * auto-incrementing primary key on insert. When an entity is read from the
 * database, `id` is always a number.
 */

/** A geographic grouping of doctors. `name` is unique. */
export interface Region {
  id?: number
  name: string
}

/** A GP or clinic the specialist visits. Belongs to exactly one region. */
export interface Doctor {
  id?: number
  name: string
  regionId: number
}

/**
 * A pharmaceutical product. This is a value object: products are persisted
 * denormalized within `Purchase` (as `product` + `dosage`), not in their own
 * table.
 */
export interface Product {
  name: string
  dosage: string
}

/**
 * A single product purchase by a doctor in a specific month.
 *
 * `month` is `0` for the annual-only years (2018–2021), which have no
 * month-level breakdown. `quantity` may be negative (returns/adjustments).
 */
export interface Purchase {
  id?: number
  doctorId: number
  regionId: number
  product: string
  dosage: string
  basicQty: number
  year: number
  month: number
  quantity: number
}

/** The lifecycle status of a visit. See glossary: Planned Visit / Visit Record. */
export type VisitStatus = 'planned' | 'completed'

/** A user-entered log of a sales visit to a doctor, marked on the calendar. */
export interface Visit {
  id?: number
  doctorId: number
  /** ISO date string, `YYYY-MM-DD`. */
  date: string
  notes: string
  outcome: string
  orderPlaced: boolean
  /** Optional free-text product name, recorded only when an order was placed. */
  orderProduct?: string
  /**
   * Whether the visit is a forward plan or a done event. `undefined` means
   * completed, so records written before this field existed stay valid.
   * Planned visits are excluded from last-visit / trend / priority analytics.
   */
  status?: VisitStatus
  /**
   * Optional booked time of day, `HH:mm`. Recorded for planned visits that
   * have a booked appointment; carried through when the visit is completed.
   */
  time?: string
}