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

/** A user-entered log of a sales visit to a doctor, marked on the calendar. */
export interface Visit {
  id?: number
  doctorId: number
  /** ISO date string, `YYYY-MM-DD`. */
  date: string
  notes: string
  outcome: string
  /** Optional ISO date string, `YYYY-MM-DD`. */
  followUpDate?: string
  orderPlaced: boolean
}