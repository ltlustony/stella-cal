import { describe, expect, it } from 'vitest'
import { buildDoctorOverviews, latestVisitDate, purchaseTrend } from './derived'
import type { Doctor, Purchase, Region, Visit } from './types'

const AS_OF = { year: 2026, month: 8 } // first not-yet-complete month

function p(year: number, month: number, quantity: number): Purchase {
  return {
    doctorId: 1,
    regionId: 1,
    product: 'Actein',
    dosage: '600mg',
    basicQty: 30,
    year,
    month,
    quantity,
  }
}

describe('purchaseTrend', () => {
  it('returns "up" when recent months exceed the prior months', () => {
    const purchases = [
      p(2026, 2, 5), p(2026, 3, 5), p(2026, 4, 5), // prior = 15
      p(2026, 5, 10), p(2026, 6, 10), p(2026, 7, 10), // recent = 30
    ]
    expect(purchaseTrend(purchases, AS_OF, 3)).toBe('up')
  })

  it('returns "down" when recent months fall below the prior months', () => {
    const purchases = [
      p(2026, 2, 10), p(2026, 3, 10), p(2026, 4, 10), // prior = 30
      p(2026, 5, 5), p(2026, 6, 5), p(2026, 7, 5), // recent = 15
    ]
    expect(purchaseTrend(purchases, AS_OF, 3)).toBe('down')
  })

  it('returns "flat" when recent and prior totals are equal', () => {
    const purchases = [
      p(2026, 2, 8), p(2026, 3, 8), p(2026, 4, 8),
      p(2026, 5, 8), p(2026, 6, 8), p(2026, 7, 8),
    ]
    expect(purchaseTrend(purchases, AS_OF, 3)).toBe('flat')
  })

  it('returns null when there is no data in the comparison window', () => {
    expect(purchaseTrend([], AS_OF, 3)).toBeNull()
  })

  it('excludes annual-only records (month 0) from month-over-month comparison', () => {
    const purchases = [p(2021, 0, 500000)] // huge annual total must not move the trend
    expect(purchaseTrend(purchases, AS_OF, 3)).toBeNull()
  })

  it('excludes the current, incomplete month (asOf)', () => {
    const purchases = [p(2026, 8, 1000)] // asOf month itself is not complete
    expect(purchaseTrend(purchases, AS_OF, 3)).toBeNull()
  })

  it('preserves negative quantities (returns) when summing', () => {
    const purchases = [
      p(2026, 2, 20), p(2026, 3, 0), p(2026, 4, 0), // prior = 20
      p(2026, 5, 10), p(2026, 6, -5), p(2026, 7, 5), // recent = 10
    ]
    expect(purchaseTrend(purchases, AS_OF, 3)).toBe('down')
  })
})

describe('latestVisitDate', () => {
  it('returns the most recent visit date', () => {
    const visits: Visit[] = [
      { doctorId: 1, date: '2026-03-01', notes: '', outcome: '', orderPlaced: false },
      { doctorId: 1, date: '2026-04-15', notes: '', outcome: '', orderPlaced: false },
      { doctorId: 1, date: '2026-02-20', notes: '', outcome: '', orderPlaced: false },
    ]
    expect(latestVisitDate(visits)).toBe('2026-04-15')
  })

  it('returns null when there are no visits', () => {
    expect(latestVisitDate([])).toBeNull()
  })

  it('excludes planned visits (a visit not yet done is not a last visit)', () => {
    const visits: Visit[] = [
      { doctorId: 1, date: '2026-04-15', notes: '', outcome: '', orderPlaced: false },
      { doctorId: 1, date: '2026-09-01', notes: '', outcome: '', orderPlaced: false, status: 'planned' },
    ]
    expect(latestVisitDate(visits)).toBe('2026-04-15')
  })

  it('returns null when only planned visits exist', () => {
    const visits: Visit[] = [
      { doctorId: 1, date: '2026-09-01', notes: '', outcome: '', orderPlaced: false, status: 'planned' },
    ]
    expect(latestVisitDate(visits)).toBeNull()
  })
})

describe('buildDoctorOverviews', () => {
  const doctors: Doctor[] = [
    { id: 1, name: '陳醫生診所', regionId: 1 },
    { id: 2, name: '李醫生', regionId: 2 },
  ]
  const regions: Region[] = [
    { id: 1, name: '九龍塘' },
    { id: 2, name: '北角' },
  ]
  const visits: Visit[] = [
    { doctorId: 1, date: '2026-03-01', notes: '', outcome: '', orderPlaced: false },
    { doctorId: 1, date: '2026-04-15', notes: '', outcome: '', orderPlaced: false },
  ]
  const purchases: Purchase[] = [
    { ...p(2026, 2, 5), doctorId: 1 },
    { ...p(2026, 3, 5), doctorId: 1 },
    { ...p(2026, 4, 5), doctorId: 1 },
    { ...p(2026, 5, 10), doctorId: 1 },
    { ...p(2026, 6, 10), doctorId: 1 },
    { ...p(2026, 7, 10), doctorId: 1 },
  ]

  it('builds one overview per doctor with region, last visit and trend', () => {
    const overviews = buildDoctorOverviews({
      doctors,
      regions,
      visits,
      purchases,
      asOf: AS_OF,
      trendMonths: 3,
    })

    expect(overviews).toHaveLength(2)

    const first = overviews.find((o) => o.doctorId === 1)!
    expect(first.name).toBe('陳醫生診所')
    expect(first.regionName).toBe('九龍塘')
    expect(first.lastVisitDate).toBe('2026-04-15')
    expect(first.trend).toBe('up')

    const second = overviews.find((o) => o.doctorId === 2)!
    expect(second.regionName).toBe('北角')
    expect(second.lastVisitDate).toBeNull()
    expect(second.trend).toBeNull()
  })
})