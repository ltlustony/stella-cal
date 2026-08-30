import { describe, expect, it } from 'vitest'
import { buildPurchaseSeries, productKey } from './chart'
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

describe('buildPurchaseSeries', () => {
  it('returns empty slots and series when there are no purchases', () => {
    expect(buildPurchaseSeries([])).toEqual({ slots: [], series: [] })
  })

  it('creates one slot per distinct month and aligns series values to slots', () => {
    const data = buildPurchaseSeries([
      purchase({ year: 2024, month: 1, quantity: 10 }),
      purchase({ year: 2024, month: 1, quantity: 7, product: 'Musolax', dosage: '200mg' }),
      purchase({ year: 2024, month: 2, quantity: 3 }),
    ])

    expect(data.slots.map((s) => s.label)).toEqual(['2024-01', '2024-02'])

    const actein = data.series.find((s) => s.key === productKey('Actein', '600mg'))!
    expect(actein.values).toEqual([10, 3])

    const musolax = data.series.find((s) => s.key === productKey('Musolax', '200mg'))!
    expect(musolax.values).toEqual([7, null])
  })

  it('marks annual-only years (month 0) as yearly slots ahead of monthly slots', () => {
    const data = buildPurchaseSeries([
      purchase({ year: 2019, month: 0, quantity: 500 }),
      purchase({ year: 2024, month: 1, quantity: 10 }),
      purchase({ year: 2020, month: 0, quantity: 40, product: 'Musolax', dosage: '200mg' }),
    ])

    expect(data.slots.map((s) => s.label)).toEqual(['2019', '2020', '2024-01'])
    expect(data.slots.map((s) => s.isAnnual)).toEqual([true, true, false])
  })

  it('sorts slots chronologically across mixed annual and monthly data', () => {
    const data = buildPurchaseSeries([
      purchase({ year: 2022, month: 3, quantity: 1 }),
      purchase({ year: 2019, month: 0, quantity: 1 }),
      purchase({ year: 2022, month: 1, quantity: 1 }),
      purchase({ year: 2018, month: 0, quantity: 1 }),
    ])

    expect(data.slots.map((s) => s.label)).toEqual(['2018', '2019', '2022-01', '2022-03'])
  })

  it('produces a deterministic series order by product then dosage', () => {
    const data = buildPurchaseSeries([
      purchase({ year: 2024, month: 1, quantity: 10, product: 'Actein', dosage: '600mg' }),
      purchase({ year: 2024, month: 1, quantity: 5, product: 'Actein', dosage: '200mg' }),
      purchase({ year: 2024, month: 1, quantity: 7, product: 'Musolax', dosage: '200mg' }),
    ])

    expect(data.series.map((s) => s.key)).toEqual([
      productKey('Actein', '200mg'),
      productKey('Actein', '600mg'),
      productKey('Musolax', '200mg'),
    ])
  })

  it('leaves null gaps for missing months rather than fabricating zeros', () => {
    const data = buildPurchaseSeries([
      purchase({ year: 2024, month: 1, quantity: 10 }),
      purchase({ year: 2024, month: 3, quantity: 30 }),
    ])

    expect(data.slots.map((s) => s.label)).toEqual(['2024-01', '2024-03'])
    expect(data.series[0].values).toEqual([10, 30])
  })

  it('preserves negative quantities (returns) so lines dip below zero', () => {
    const data = buildPurchaseSeries([
      purchase({ year: 2024, month: 1, quantity: 10 }),
      purchase({ year: 2024, month: 1, quantity: -4, product: 'Actein', dosage: '200mg' }),
      purchase({ year: 2024, month: 2, quantity: -3 }),
    ])

    expect(data.slots.map((s) => s.label)).toEqual(['2024-01', '2024-02'])

    const actein600 = data.series.find((s) => s.key === productKey('Actein', '600mg'))!
    expect(actein600.values).toEqual([10, -3])

    const actein200 = data.series.find((s) => s.key === productKey('Actein', '200mg'))!
    expect(actein200.values).toEqual([-4, null])
  })

  it('filters to a single year when a year is provided', () => {
    const data = buildPurchaseSeries(
      [
        purchase({ year: 2019, month: 0, quantity: 500 }),
        purchase({ year: 2024, month: 1, quantity: 10 }),
        purchase({ year: 2024, month: 2, quantity: 3 }),
      ],
      2024,
    )

    expect(data.slots.map((s) => s.label)).toEqual(['2024-01', '2024-02'])
  })

  it('filters an annual-only year to just its yearly slot', () => {
    const data = buildPurchaseSeries(
      [
        purchase({ year: 2019, month: 0, quantity: 500 }),
        purchase({ year: 2020, month: 0, quantity: 40 }),
      ],
      2019,
    )

    expect(data.slots).toHaveLength(1)
    expect(data.slots[0]).toMatchObject({ year: 2019, month: 0, label: '2019', isAnnual: true })
    expect(data.series[0].values).toEqual([500])
  })
})