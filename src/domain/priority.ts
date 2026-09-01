import type { DoctorOverview, Trend } from './derived'

/**
 * Priority list (issue 06). Pure functions that turn the doctor-list
 * overviews into "who to visit next" signals: a ranked priority list blending
 * visit gap and purchase trend.
 *
 * Follow-up reminders used to live here too; they were folded into stored
 * planned visits, which the calendar surfaces directly (ADR-007).
 *
 * Everything here is a pure function of its inputs — nothing reads storage.
 * The priority list deliberately consumes {@link DoctorOverview} (already
 * built by {@link import('./derived').buildDoctorOverviews}) rather than raw
 * records, so the trend and last-visit logic stays in one seam (derived.ts)
 * and this module only adds ranking on top.
 */

const MS_PER_DAY = 86_400_000

/**
 * How strongly each signal moves the priority score. Kept as named constants
 * so the blend is documented and testable.
 */
export const PRIORITY_WEIGHTS = {
  /** Each day since the last visit adds one point of urgency. */
  visitGapPerDay: 1,
  /** A declining purchase trend is a strong bail-out signal and is boosted so
   *  declining doctors surface above merely-overdue ones. */
  decliningTrend: 30,
  /** A rising trend demotes a doctor — they're reordering on their own. */
  risingTrend: -15,
} as const

/**
 * Whole days between `lastVisitDate` (ISO `YYYY-MM-DD`) and `now`, on the
 * doctor's local calendar. `null` means "never visited" and propagates as
 * `null` so callers can distinguish it from a zero-day gap. Future dates clamp
 * to `0` — a visit can't be negative days ago.
 */
export function daysSinceLastVisit(
  lastVisitDate: string | null,
  now: Date = new Date(),
): number | null {
  if (!lastVisitDate) return null
  const last = new Date(`${lastVisitDate}T00:00:00`)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.max(0, Math.round((today.getTime() - last.getTime()) / MS_PER_DAY))
}

/**
 * Blends visit gap and purchase trend into a single comparable score. Higher =
 * higher priority. See {@link PRIORITY_WEIGHTS} for the exact weights.
 */
export function priorityScore(days: number | null, trend: Trend | null): number {
  let score = 0
  if (days !== null) score += days * PRIORITY_WEIGHTS.visitGapPerDay
  if (trend === 'down') score += PRIORITY_WEIGHTS.decliningTrend
  else if (trend === 'up') score += PRIORITY_WEIGHTS.risingTrend
  return score
}

/** Why a doctor is emphasised in the ranking. */
export type PriorityEmphasis = 'declining' | 'none'

export interface PriorityEntry {
  doctorId: number
  name: string
  regionName: string
  lastVisitDate: string | null
  daysSinceLastVisit: number | null
  trend: Trend | null
  score: number
  emphasis: PriorityEmphasis
}

/**
 * Ranks doctors by priority: visit gap blended with purchase trend. Declining
 * doctors are emphasised (flagged `emphasis: 'declining'`) and boosted by the
 * declining weight. Ties break by name for a stable, deterministic order.
 */
export function buildPriorityList(
  overviews: DoctorOverview[],
  now: Date = new Date(),
): PriorityEntry[] {
  return overviews
    .map((overview) => {
      const days = daysSinceLastVisit(overview.lastVisitDate, now)
      return {
        doctorId: overview.doctorId,
        name: overview.name,
        regionName: overview.regionName,
        lastVisitDate: overview.lastVisitDate,
        daysSinceLastVisit: days,
        trend: overview.trend,
        score: priorityScore(days, overview.trend),
        emphasis: overview.trend === 'down' ? 'declining' : 'none',
      } satisfies PriorityEntry
    })
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name))
}