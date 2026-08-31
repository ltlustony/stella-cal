import { toISODate } from './calendar'
import type { DoctorOverview, Trend } from './derived'
import type { Doctor, Visit } from './types'

/**
 * Priority list + follow-up reminders (issue 06). Pure functions that turn the
 * doctor-list overviews and visit records into "who to visit next" signals:
 * a ranked priority list blending visit gap and purchase trend, plus the
 * follow-up reminders that surface when a visit's follow-up date arrives.
 *
 * Everything here is a pure function of its inputs — nothing reads storage.
 * The priority list deliberately consumes {@link DoctorOverview} (already
 * built by {@link import('./derived').buildDoctorOverviews}) rather than raw
 * records, so the trend and last-visit logic stays in one seam (derived.ts)
 * and this module only adds ranking + reminders on top.
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

/** A follow-up whose date has arrived (today or earlier). */
export interface FollowUpReminder {
  visitId: number | null
  doctorId: number
  doctorName: string
  /** The follow-up's due date (`YYYY-MM-DD`). */
  dueDate: string
  /** Whole days overdue, `0` when due today. */
  daysOverdue: number
}

/**
 * Surfaces follow-up reminders whose date has arrived: every visit with a
 * `followUpDate` on or before today. Visits without a follow-up date, future
 * follow-ups, and follow-ups whose doctor no longer exists are dropped.
 * Ordered by due date (soonest first), then doctor name.
 */
export function dueFollowUps(
  visits: Visit[],
  doctors: Doctor[],
  now: Date = new Date(),
): FollowUpReminder[] {
  const doctorById = new Map<number, Doctor>()
  for (const doctor of doctors) {
    if (doctor.id !== undefined) doctorById.set(doctor.id, doctor)
  }

  const today = toISODate(now)
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const reminders: FollowUpReminder[] = []

  for (const visit of visits) {
    if (!visit.followUpDate) continue
    if (visit.followUpDate > today) continue // not due yet

    const doctor = doctorById.get(visit.doctorId)
    if (!doctor || doctor.id === undefined) continue

    const due = new Date(`${visit.followUpDate}T00:00:00`)
    const daysOverdue = Math.max(
      0,
      Math.round((todayMidnight.getTime() - due.getTime()) / MS_PER_DAY),
    )

    reminders.push({
      visitId: visit.id ?? null,
      doctorId: doctor.id,
      doctorName: doctor.name,
      dueDate: visit.followUpDate,
      daysOverdue,
    })
  }

  reminders.sort(
    (a, b) => a.dueDate.localeCompare(b.dueDate) || a.doctorName.localeCompare(b.doctorName),
  )
  return reminders
}