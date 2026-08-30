import { describe, expect, it } from 'vitest'
import { buildPurchaseChart } from './chart'
import type { Purchase } from './types'

function purchase(
  overrides: Partial<Purchase> & { year: number; month: number; quantity: number },
): Purchase {
  return {
    doctorId: 1,
    regionId: 1,
    product: 'Actein',
    dosage: '600mg',
    basicQty: 30,
    ...overrides,
  }
}

describe('buildPurchaseChart', () => {
  it('returns an empty series when there are no purchases', () => {
    expect(buildPurchaseChart([])).toEqual([])
  })

  it('renders monthly bars for years with month-level detail', () => {
    const points = buildPurchaseChart([
      purchase({ year: 2024, month: 1, quantity: 10 }),
      purchase({ year: 2024, month: 1, quantity: 7, product: 'Musolax', dosage: '200mg' }),
      purchase({ year: 2024, month: 2, quantity: 3 }),
    ])

    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ year: 2024, month: 1, label: '2024-01', total: 17 })
    expect(points[1]).toMatchObject({ year: 2024, month: 2, label: '2024-02', total: 3 })
  })

  it('renders annual-only years (2018–2021) as a single month=0 point', () => {
    const points = buildPurchaseChart([
      purchase({ year: 2019, month: 0, quantity: 500 }),
      purchase({ year: 2020, month: 0, quantity: 40, product: 'Musolax', dosage: '200mg' }),
    ])

    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({ year: 2019, month: 0, label: '2019', total: 500 })
    expect(points[1]).toMatchObject({ year: 2020, month: 0, label: '2020', total: 40 })
  })

  it('sorts points by year then month across mixed annual and monthly data', () => {
    const points = buildPurchaseChart([
      purchase({ year: 2022, month: 3, quantity: 1 }),
      purchase({ year: 2019, month: 0, quantity: 1 }),
      purchase({ year: 2022, month: 1, quantity: 1 }),
      purchase({ year: 2018, month: 0, quantity: 1 }),
    ])

    expect(points.map((p) => p.label)).toEqual(['2018', '2019', '2022-01', '2022-03'])
  })

  it('breaks each point down by product and dosage', () => {
    const points = buildPurchaseChart([
      purchase({ year: 2024, month: 1, quantity: 10, product: 'Actein', dosage: '600mg' }),
      purchase({ year: 2024, month: 1, quantity: 5, product: 'Actein', dosage: '200mg' }),
      purchase({ year: 2024, month: 1, quantity: 7, product: 'Musolax', dosage: '200mg' }),
    ])

    expect(points[0].total).toBe(22)
    expect(points[0].products).toEqual([
      { product: 'Actein', dosage: '200mg', quantity: 5 },
      { product: 'Actein', dosage: '600mg', quantity: 10 },
      { product: 'Musolax', dosage: '200mg', quantity: 7 },
    ])
  })

  it('preserves negative quantities (returns) without corrupting totals', () => {
    const points = buildPurchaseChart([
      purchase({ year: 2024, month: 1, quantity: 10 }),
      purchase({ year: 2024, month: 1, quantity: -4, product: 'Actein', dosage: '200mg' }),
      purchase({ year: 2024, month: 2, quantity: -3 }),
    ])

    expect(points[0].total).toBe(6)
    expect(points[0].products).toEqual([
      { product: 'Actein', dosage: '200mg', quantity: -4 },
      { product: 'Actein', dosage: '600mg', quantity: 10 },
    ])
    expect(points[1].total).toBe(-3)
  })

  it('filters to a single year when a year is provided', () => {
    const points = buildPurchaseChart(
      [
        purchase({ year: 2019, month: 0, quantity: 500 }),
        purchase({ year: 2024, month: 1, quantity: 10 }),
        purchase({ year: 2024, month: 2, quantity: 3 }),
      ],
      2024,
    )

    expect(points.map((p) => p.label)).toEqual(['2024-01', '2024-02'])
  })

  it('filters an annual-only year to just its yearly total', () => {
    const points = buildPurchaseChart(
      [
        purchase({ year: 2019, month: 0, quantity: 500 }),
        purchase({ year: 2020, month: 0, quantity: 40 }),
      ],
      2019,
    )

    expect(points).toHaveLength(1)
    expect(points[0]).toMatchObject({ year: 2019, month: 0, label: '2019', total: 500 })
  })
})