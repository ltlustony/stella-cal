import type { Purchase } from './types'

/**
 * Filter key identifying a single product + dosage combination. `'all'` means
 * "show every product". The `::` separator is a single source of truth here so
 * both the chart and the detail view agree on how a product is keyed.
 */
export type ProductKey = 'all' | `${string}::${string}`

export const PRODUCT_KEY_SEPARATOR = '::'

export function productKey(product: string, dosage: string): `${string}::${string}` {
  return `${product}${PRODUCT_KEY_SEPARATOR}${dosage}`
}

/** Splits a product key produced by {@link productKey} back into its parts. */
export function splitProductKey(key: string): {
  product: string
  dosage: string
} {
  const [product, dosage] = key.split(PRODUCT_KEY_SEPARATOR)
  return { product, dosage }
}

/**
 * A single x-axis position on the purchase chart. `month === 0` marks an
 * annual-only year (2018–2021) with no month-level breakdown; it renders as one
 * yearly-total point (`isAnnual`) instead of twelve fabricated monthly points.
 */
export interface PurchaseChartSlot {
  key: string
  /** Human label: "2018" for annual-only, "2022-01" for monthly. */
  label: string
  year: number
  month: number
  isAnnual: boolean
}

/**
 * One product + dosage line across all {@link PurchaseChartSlot}s. `values` is
 * aligned to the slots array; `null` means "no purchase that slot" and renders
 * as a gap in the line rather than a zero, so a missing month is never drawn as
 * a bogus zero.
 */
export interface PurchaseChartSeries {
  key: string
  product: string
  dosage: string
  values: Array<number | null>
}

export interface PurchaseChartData {
  slots: PurchaseChartSlot[]
  series: PurchaseChartSeries[]
}

function slotKey(year: number, month: number): string {
  return month === 0 ? String(year) : `${year}-${String(month).padStart(2, '0')}`
}

/**
 * Aggregates a doctor's purchases into per-product series over a shared time
 * axis, optionally filtered to a single `year`.
 *
 * - Slots are sorted chronologically (`month === 0` annual slots naturally sit
 *   before the monthly slots).
 * - Each product + dosage becomes its own series; missing months are `null`.
 * - Negative quantities (returns/adjustments) are summed as-is so lines dip
 *   below zero honestly without corrupting totals.
 *
 * Pure — a function of its inputs, nothing reads storage. This is the seam the
 * doctor-detail chart and any other purchase visualization share.
 */
export function buildPurchaseSeries(
  purchases: Purchase[],
  year?: number,
): PurchaseChartData {
  const filtered = year === undefined ? purchases : purchases.filter((p) => p.year === year)

  const slotMap = new Map<string, PurchaseChartSlot>()
  for (const purchase of filtered) {
    const key = slotKey(purchase.year, purchase.month)
    if (!slotMap.has(key)) {
      slotMap.set(key, {
        key,
        label: key,
        year: purchase.year,
        month: purchase.month,
        isAnnual: purchase.month === 0,
      })
    }
  }
  const slots = [...slotMap.values()].sort((a, b) => a.year - b.year || a.month - b.month)

  // seriesKey -> slotKey -> summed quantity
  const valuesBySeries = new Map<string, Map<string, number>>()

  for (const purchase of filtered) {
    const key = productKey(purchase.product, purchase.dosage)
    let slotValues = valuesBySeries.get(key)
    if (!slotValues) {
      slotValues = new Map()
      valuesBySeries.set(key, slotValues)
    }
    const skey = slotKey(purchase.year, purchase.month)
    slotValues.set(skey, (slotValues.get(skey) ?? 0) + purchase.quantity)
  }

  const series: PurchaseChartSeries[] = [...valuesBySeries.entries()].map(([key, slotValues]) => {
    const { product, dosage } = splitProductKey(key)
    return {
      key,
      product,
      dosage,
      values: slots.map((slot) => slotValues.get(slot.key) ?? null),
    }
  })
  series.sort((a, b) => a.product.localeCompare(b.product) || a.dosage.localeCompare(b.dosage))

  return { slots, series }
}