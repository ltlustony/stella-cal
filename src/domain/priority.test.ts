import { describe, expect, it } from 'vitest'
import type { DoctorOverview } from './derived'
import type { Doctor, Visit } from './types'
import {
  PRIORITY_WEIGHTS,
  buildPriorityList,
  daysSinceLastVisit,
  dueFollowUps,
  priorityScore,
} from './priority'

const NOW = new Date(2026, 7, 31) // 2026-08-31, local time

function overview(overrides: Partial<DoctorOverview> & { doctorId: number }): DoctorOverview {
  return {
    name: 'Doctor',
    regionId: 1,
    regionName: 'Region',
    lastVisitDate: null,
    trend: null,
    ...overrides,
  }
}

describe('daysSinceLastVisit', () => {
  it('counts whole days between the last visit and now', () => {
    expect(daysSinceLastVisit('2026-08-30', NOW)).toBe(1)
    expect(daysSinceLastVisit('2026-08-01', NOW)).toBe(30)
  })

  it('returns 0 when the visit is today', () => {
    expect(daysSinceLastVisit('2026-08-31', NOW)).toBe(0)
  })

  it('clamps future dates to 0', () => {
    expect(daysSinceLastVisit('2026-09-10', NOW)).toBe(0)
  })

  it('returns null when never visited', () => {
    expect(daysSinceLastVisit(null, NOW)).toBeNull()
  })
})

describe('priorityScore', () => {
  it('is a pure function of visit gap and trend', () => {
    expect(priorityScore(null, null)).toBe(0)
    expect(priorityScore(10, 'flat')).toBe(10)
  })

  it('boosts declining doctors', () => {
    expect(priorityScore(10, 'down')).toBe(10 + PRIORITY_WEIGHTS.decliningTrend)
  })

  it('demotes rising doctors', () => {
    expect(priorityScore(10, 'up')).toBe(10 + PRIORITY_WEIGHTS.risingTrend)
  })
})

describe('buildPriorityList', () => {
  it('ranks doctors by score, declining emphasised', () => {
    const overviews: DoctorOverview[] = [
      overview({ doctorId: 1, name: 'Long gap', lastVisitDate: '2026-07-03', trend: 'flat' }),
      overview({ doctorId: 2, name: 'Declining', lastVisitDate: '2026-08-01', trend: 'down' }),
      overview({ doctorId: 3, name: 'Rising', lastVisitDate: '2026-07-03', trend: 'up' }),
    ]

    const list = buildPriorityList(overviews, NOW)

    // Declining (30 days + 30 boost = 60) outranks long gap flat (59) and rising (44).
    expect(list.map((e) => e.doctorId)).toEqual([2, 1, 3])
    expect(list[0].emphasis).toBe('declining')
    expect(list[0].daysSinceLastVisit).toBe(30)
    expect(list[0].score).toBe(60)
  })

  it('ties break by name for a stable order', () => {
    const overviews = [
      overview({ doctorId: 1, name: 'Zed', lastVisitDate: '2026-08-31', trend: 'flat' }),
      overview({ doctorId: 2, name: 'Ann', lastVisitDate: '2026-08-31', trend: 'flat' }),
    ]
    const list = buildPriorityList(overviews, NOW)
    expect(list.map((e) => e.doctorId)).toEqual([2, 1])
  })

  it('never-visited doctors rank by trend among zero gaps', () => {
    const overviews = [
      overview({ doctorId: 1, name: 'Never down', lastVisitDate: null, trend: 'down' }),
      overview({ doctorId: 2, name: 'Never flat', lastVisitDate: null, trend: 'flat' }),
    ]
    const list = buildPriorityList(overviews, NOW)
    expect(list.map((e) => e.doctorId)).toEqual([1, 2])
  })
})

describe('dueFollowUps', () => {
  const doctor: Doctor = { id: 1, name: '陳醫生診所', regionId: 1 }

  const visit = (overrides: Partial<Visit>): Visit => ({
    doctorId: 1,
    date: '2026-08-01',
    notes: '',
    outcome: '',
    orderPlaced: false,
    ...overrides,
  })

  it('surfaces follow-ups due today or earlier, soonest first', () => {
    const visits = [
      visit({ id: 1, followUpDate: '2026-08-30' }),
      visit({ id: 2, followUpDate: '2026-08-31' }),
      visit({ id: 3, followUpDate: '2026-09-05' }), // future → dropped
    ]
    const reminders = dueFollowUps(visits, [doctor], NOW)

    expect(reminders.map((r) => r.visitId)).toEqual([1, 2])
    expect(reminders[0].daysOverdue).toBe(1)
    expect(reminders[1].daysOverdue).toBe(0)
  })

  it('ignores visits without a follow-up date', () => {
    const reminders = dueFollowUps([visit({}), visit({ followUpDate: '2026-09-01' })], [doctor], NOW)
    expect(reminders).toHaveLength(0)
  })

  it('skips follow-ups whose doctor no longer exists', () => {
    const reminders = dueFollowUps([visit({ followUpDate: '2026-08-01', doctorId: 999 })], [doctor], NOW)
    expect(reminders).toHaveLength(0)
  })
})