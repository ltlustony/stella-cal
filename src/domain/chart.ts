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
export function splitProductKey(key: `${string}::${string}`): {
  product: string
  dosage: string
} {
  const [product, dosage] = key.split(PRODUCT_KEY_SEPARATOR)
  return { product, dosage }
}

/**
 * A single point on the purchase-history chart. `month === 0` marks an
 * annual-only year (2018–2021), which has no month-level breakdown and renders
 * as one yearly-total bar instead of twelve fabricated monthly bars.
 */
export interface PurchaseChartPoint {
  year: number
  month: number
  /** Human label: "2019" for annual-only, "2024-01" for monthly. */
  label: string
  /** Sum of all product quantities at this point (may be negative). */
  total: number
  /** Product/dosage breakdown, sorted deterministically by product then dosage. */
  products: Array<{ product: string; dosage: string; quantity: number }>
}

/**
 * Aggregates a doctor's purchases into chart points, optionally filtered to a
 * single `year`.
 *
 * - Annual-only years (`month === 0`) are one point each, labelled by year.
 * - Monthly data is one point per (year, month).
 * - Negative quantities (returns/adjustments) are summed as-is so totals stay
 *   honest.
 *
 * Pure — a function of its inputs, nothing reads storage. This is the seam the
 * doctor-detail chart and any other purchase visualization share.
 */
export function buildPurchaseChart(
  purchases: Purchase[],
  year?: number,
): PurchaseChartPoint[] {
  const filtered = year === undefined ? purchases : purchases.filter((p) => p.year === year)

  type Bucket = Map<string, number> // "product::dosage" -> quantity
  const byPoint = new Map<string, { year: number; month: number; label: string; products: Bucket }>()

  for (const purchase of filtered) {
    const label = purchase.month === 0 ? String(purchase.year) : `${purchase.year}-${String(purchase.month).padStart(2, '0')}`
    let point = byPoint.get(label)
    if (!point) {
      point = { year: purchase.year, month: purchase.month, label, products: new Map() }
      byPoint.set(label, point)
    }

    const key = productKey(purchase.product, purchase.dosage)
    point.products.set(key, (point.products.get(key) ?? 0) + purchase.quantity)
  }

  const points: PurchaseChartPoint[] = []
  for (const { year: y, month, label, products } of byPoint.values()) {
    const breakdown: Array<{ product: string; dosage: string; quantity: number }> = []
    let total = 0
    for (const [key, quantity] of products) {
      const { product, dosage } = splitProductKey(key as `${string}::${string}`)
      breakdown.push({ product, dosage, quantity })
      total += quantity
    }
    breakdown.sort(
      (a, b) => a.product.localeCompare(b.product) || a.dosage.localeCompare(b.dosage),
    )
    points.push({ year: y, month, label, total, products: breakdown })
  }

  points.sort((a, b) => a.year - b.year || a.month - b.month)
  return points
}