import type { Doctor, Purchase, Region, Visit } from './types'

/**
 * Derived computations — pure functions that turn stored records into the
 * signals the UI and priority list need: a doctor's last-visit date and their
 * purchase trend (up / flat / down). Everything here is a pure function of its
 * inputs; nothing reads storage, which is what keeps this seam reusable across
 * the doctor list (issue 03) and the priority list (issue 06).
 */

/** A point in the purchase timeline, used to define "recent" vs "prior" months. */
export interface AsOf {
  year: number
  month: number
}

export type Trend = 'up' | 'flat' | 'down'

export interface DoctorOverview {
  doctorId: number
  name: string
  regionId: number
  regionName: string
  lastVisitDate: string | null
  trend: Trend | null
}

/** Months are `year * 12 + month` so contiguous months have contiguous keys. */
function monthKey(year: number, month: number): number {
  return year * 12 + month
}

/** The current wall-clock month as an {@link AsOf}, for "recent" comparisons. */
export function todayAsOf(now: Date = new Date()): AsOf {
  return { year: now.getFullYear(), month: now.getMonth() + 1 }
}

/**
 * Compares total purchase quantity over the most recent `n` complete months
 * against the prior `n` months, returning `up` / `flat` / `down`.
 *
 * - Only complete months count: the `asOf` month (the current, partial month)
 *   and everything after it are excluded.
 * - Annual-only records (`month === 0`) carry no month detail and never
 *   participate in a month-over-month comparison.
 *
 * Returns `null` when there is no data in the comparison window, so callers can
 * distinguish "no signal" from a legitimately flat zero.
 */
export function purchaseTrend(
  purchases: Purchase[],
  asOf: AsOf,
  n: number,
): Trend | null {
  const endKey = monthKey(asOf.year, asOf.month) // the first incomplete month

  let recentTotal = 0
  let priorTotal = 0
  let recentSeen = false
  let priorSeen = false

  for (const purchase of purchases) {
    if (purchase.month === 0) continue // annual-only, no month breakdown

    const key = monthKey(purchase.year, purchase.month)
    if (key >= endKey) continue // asOf month or later: not yet complete

    const offset = endKey - 1 - key // 0 = most recent complete month
    if (offset < n) {
      recentTotal += purchase.quantity
      recentSeen = true
    } else if (offset < n + n) {
      priorTotal += purchase.quantity
      priorSeen = true
    }
  }

  if (!recentSeen && !priorSeen) return null

  if (recentTotal > priorTotal) return 'up'
  if (recentTotal < priorTotal) return 'down'
  return 'flat'
}

/** The most recent visit date for a doctor, or `null` if none. */
export function latestVisitDate(visits: Visit[]): string | null {
  if (visits.length === 0) return null
  return visits.reduce<string | null>((latest, visit) => {
    if (latest === null || visit.date > latest) return visit.date
    return latest
  }, null)
}

export interface BuildDoctorOverviewsInput {
  doctors: Doctor[]
  regions: Region[]
  visits: Visit[]
  purchases: Purchase[]
  asOf: AsOf
  trendMonths: number
}

/**
 * Composes the list row from its inputs, attaching each doctor's last-visit
 * date and purchase trend. Pure — callers feed it fresh data from the
 * repositories; it never touches storage itself.
 */
export function buildDoctorOverviews(
  input: BuildDoctorOverviewsInput,
): DoctorOverview[] {
  const regionName = new Map<number, string>()
  for (const region of input.regions) {
    if (region.id !== undefined) regionName.set(region.id, region.name)
  }

  const visitsByDoctor = new Map<number, Visit[]>()
  for (const visit of input.visits) {
    const list = visitsByDoctor.get(visit.doctorId) ?? []
    list.push(visit)
    visitsByDoctor.set(visit.doctorId, list)
  }

  const purchasesByDoctor = new Map<number, Purchase[]>()
  for (const purchase of input.purchases) {
    const list = purchasesByDoctor.get(purchase.doctorId) ?? []
    list.push(purchase)
    purchasesByDoctor.set(purchase.doctorId, list)
  }

  return input.doctors.map((doctor) => {
    if (doctor.id === undefined) {
      throw new Error('buildDoctorOverviews requires persisted doctors with ids')
    }
    const doctorVisits = visitsByDoctor.get(doctor.id) ?? []
    const doctorPurchases = purchasesByDoctor.get(doctor.id) ?? []

    return {
      doctorId: doctor.id,
      name: doctor.name,
      regionId: doctor.regionId,
      regionName: regionName.get(doctor.regionId) ?? 'Unknown',
      lastVisitDate: latestVisitDate(doctorVisits),
      trend: purchaseTrend(doctorPurchases, input.asOf, input.trendMonths),
    }
  })
}