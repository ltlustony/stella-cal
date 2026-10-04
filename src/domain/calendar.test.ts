import { describe, expect, it } from 'vitest'
import { buildMonthGrid, groupPlannedVisitsByDate, groupVisitsByDate, planBulkCreation } from './calendar'
import type { Doctor, Visit } from './types'

describe('buildMonthGrid', () => {
  it('starts the first week on Monday and pads leading days from the previous month', () => {
    // August 2026: Aug 1 is a Saturday, so a Monday-start week needs 5 leading
    // placeholder days (Mon 27 Jul … Fri 31 Jul).
    const grid = buildMonthGrid(2026, 8)

    expect(grid).toHaveLength(42)

    const lead = grid.slice(0, 5)
    expect(lead.every((cell) => !cell.inCurrentMonth)).toBe(true)
    expect(lead.map((cell) => cell.date)).toEqual([
      '2026-07-27',
      '2026-07-28',
      '2026-07-29',
      '2026-07-30',
      '2026-07-31',
    ])

    expect(grid[5]).toEqual({ date: '2026-08-01', day: 1, inCurrentMonth: true })
    expect(grid[5 + 30].date).toBe('2026-08-31') // 31 days in August
  })

  it('produces no leading blanks when the month starts on a Monday', () => {
    // January 2024 starts on a Monday → only 5 rows (35 cells) needed.
    const grid = buildMonthGrid(2024, 1)

    expect(grid).toHaveLength(35)
    expect(grid[0]).toEqual({ date: '2024-01-01', day: 1, inCurrentMonth: true })
    expect(grid[0].date).toBe('2024-01-01')
  })

  it('handles a leap February (29 days)', () => {
    const grid = buildMonthGrid(2024, 2) // Feb 2024 is a leap year

    const current = grid.filter((cell) => cell.inCurrentMonth)
    expect(current).toHaveLength(29)
    expect(current[28]).toEqual({ date: '2024-02-29', day: 29, inCurrentMonth: true })
  })

  it('orders cells Monday → Sunday within each row', () => {
    // June 2026: Jun 1 is a Monday, so the first 7 cells are the 1st–7th and
    // cell 7 (the first Sunday) must be day 7, not day 1.
    const grid = buildMonthGrid(2026, 6)

    expect(grid[0].day).toBe(1) // Monday
    expect(grid[6].day).toBe(7) // Sunday
    expect(grid[7].day).toBe(8) // next Monday
  })
})

describe('groupVisitsByDate', () => {
  const doctors: Doctor[] = [
    { id: 1, name: '陳醫生診所', regionId: 1 },
    { id: 2, name: '李醫生', regionId: 2 },
  ]

  const visit = (overrides: Partial<Visit>): Visit => ({
    doctorId: 1,
    date: '2026-08-15',
    notes: '',
    outcome: '',
    orderPlaced: false,
    ...overrides,
  })

  it('groups multiple visits on the same day, resolving doctor name and region', () => {
    const visits = [
      visit({ date: '2026-08-15' }),
      visit({ doctorId: 2, date: '2026-08-15' }),
      visit({ date: '2026-08-20' }),
    ]

    const byDate = groupVisitsByDate(visits, doctors)

    expect(byDate.get('2026-08-15')).toEqual([
      { doctorId: 1, doctorName: '陳醫生診所' },
      { doctorId: 2, doctorName: '李醫生' },
    ])
    expect(byDate.get('2026-08-20')).toEqual([
      { doctorId: 1, doctorName: '陳醫生診所' },
    ])
    expect(byDate.has('2026-08-01')).toBe(false)
  })

  it('skips visits whose doctor no longer exists', () => {
    const byDate = groupVisitsByDate([visit({ doctorId: 999 })], doctors)
    expect(byDate.has('2026-08-15')).toBe(false)
  })

  it('excludes planned visits (they surface via groupPlannedVisitsByDate)', () => {
    const byDate = groupVisitsByDate([visit({ status: 'planned' })], doctors)
    expect(byDate.has('2026-08-15')).toBe(false)
  })

  it('returns an empty map when there are no visits', () => {
    expect(groupVisitsByDate([], doctors).size).toBe(0)
  })
})

describe('groupPlannedVisitsByDate', () => {
  const doctors: Doctor[] = [
    { id: 1, name: '陳醫生診所', regionId: 1 },
  ]

  it('maps planned visits onto their visit date with id and booked time', () => {
    const visits: Visit[] = [
      {
        id: 10,
        doctorId: 1,
        date: '2026-09-05',
        notes: '',
        outcome: '',
        orderPlaced: false,
        status: 'planned',
        time: '14:30',
      },
    ]

    const byDate = groupPlannedVisitsByDate(visits, doctors)

    expect(byDate.get('2026-09-05')).toEqual([
      { visitId: 10, doctorId: 1, doctorName: '陳醫生診所', time: '14:30' },
    ])
  })

  it('excludes completed visits and visits without a status', () => {
    const visits: Visit[] = [
      { doctorId: 1, date: '2026-09-05', notes: '', outcome: '', orderPlaced: false, status: 'completed' },
      { doctorId: 1, date: '2026-09-06', notes: '', outcome: '', orderPlaced: false },
    ]
    expect(groupPlannedVisitsByDate(visits, doctors).size).toBe(0)
  })

  it('skips planned visits whose doctor no longer exists', () => {
    const visits: Visit[] = [
      {
        doctorId: 999,
        date: '2026-09-05',
        notes: '',
        outcome: '',
        orderPlaced: false,
        status: 'planned',
      },
    ]
    expect(groupPlannedVisitsByDate(visits, doctors).has('2026-09-05')).toBe(false)
  })
})

describe('planBulkCreation', () => {
  const DATE = '2026-08-15'

  const completedVisit = (doctorId: number, date = DATE, id?: number): Visit => ({
    ...(id !== undefined ? { id } : {}),
    doctorId,
    date,
    notes: '',
    outcome: '',
    orderPlaced: false,
    status: 'completed',
  })

  const plannedVisit = (doctorId: number, date = DATE, id?: number): Visit => ({
    ...(id !== undefined ? { id } : {}),
    doctorId,
    date,
    notes: '',
    outcome: '',
    orderPlaced: false,
    status: 'planned',
  })

  // (a) empty store → creates all
  it('creates bare records for every doctor when store is empty', () => {
    const { toCreate, skipped } = planBulkCreation([1, 2, 3], [], DATE, 'completed')
    expect(skipped).toBe(0)
    expect(toCreate).toHaveLength(3)
    expect(toCreate[0]).toEqual({
      doctorId: 1, date: DATE, notes: '', outcome: '', orderPlaced: false, status: 'completed',
    })
  })

  // (b) status-specific skip
  it('skips same-day same-status only — a completed visit does not block a planned record', () => {
    const existing = [completedVisit(1)]
    const { toCreate, skipped } = planBulkCreation([1], existing, DATE, 'planned')
    expect(skipped).toBe(0)
    expect(toCreate).toHaveLength(1)
  })

  it('skips a doctor who already has a same-day record of the same status', () => {
    const existing = [plannedVisit(1)]
    const { skipped, toCreate } = planBulkCreation([1], existing, DATE, 'planned')
    expect(skipped).toBe(1)
    expect(toCreate).toHaveLength(0)
  })

  // (c) status: undefined treated as completed
  it('treats a record with status: undefined as completed', () => {
    const legacyVisit: Visit = { doctorId: 1, date: DATE, notes: '', outcome: '', orderPlaced: false }
    const { skipped } = planBulkCreation([1], [legacyVisit], DATE, 'completed')
    expect(skipped).toBe(1)
  })

  // (d) other dates don't affect skipping
  it('does not skip a doctor whose visit is on a different date', () => {
    const existing = [completedVisit(1, '2026-08-14')]
    const { skipped, toCreate } = planBulkCreation([1], existing, DATE, 'completed')
    expect(skipped).toBe(0)
    expect(toCreate).toHaveLength(1)
  })

  // (e) skipped count and order preserved
  it('counts skipped correctly and preserves input order', () => {
    const existing = [completedVisit(2)]
    const { toCreate, skipped } = planBulkCreation([1, 2, 3], existing, DATE, 'completed')
    expect(skipped).toBe(1)
    expect(toCreate.map((r) => r.doctorId)).toEqual([1, 3])
  })
})