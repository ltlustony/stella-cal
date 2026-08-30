import { useEffect, useMemo, useState } from 'react'
import type { Purchase } from '../domain/types'
import { purchases } from '../data/repositories'
import { buildPurchaseSeries, productKey, type ProductKey } from '../domain/chart'
import { useApp } from './AppProvider'
import { PurchaseColumnChart } from './PurchaseColumnChart'

interface DoctorDetailViewProps {
  doctorId: number
  onBack: () => void
}

export function DoctorDetailView({ doctorId, onBack }: DoctorDetailViewProps) {
  const { state } = useApp()
  const [rows, setRows] = useState<Purchase[]>([])
  const [year, setYear] = useState<number | 'all'>('all')
  const [productFilter, setProductFilter] = useState<ProductKey>('all')

  useEffect(() => {
    let cancelled = false
    void purchases.byDoctor(doctorId).then((result) => {
      if (!cancelled) setRows(result)
    })
    return () => {
      cancelled = true
    }
  }, [doctorId])

  const doctor = state.overviews.find((o) => o.doctorId === doctorId)

  const years = useMemo(() => {
    const set = new Set<number>()
    for (const row of rows) set.add(row.year)
    return [...set].sort((a, b) => a - b)
  }, [rows])

  const products = useMemo(() => {
    const map = new Map<string, { product: string; dosage: string }>()
    for (const row of rows) {
      map.set(productKey(row.product, row.dosage), { product: row.product, dosage: row.dosage })
    }
    return [...map.values()].sort(
      (a, b) => a.product.localeCompare(b.product) || a.dosage.localeCompare(b.dosage),
    )
  }, [rows])

  const chartData = useMemo(
    () => buildPurchaseSeries(rows, year === 'all' ? undefined : year),
    [rows, year],
  )

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 p-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
          >
            ← Back
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-medium">{doctor?.name ?? 'Doctor'}</h2>
            <p className="text-xs text-slate-500">
              {doctor?.regionName ?? 'Unknown region'} · {rows.length} purchase records
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <select
            value={year}
            onChange={(event) =>
              setYear(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-600"
          >
            <option value="all">All years</option>
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <select
            value={productFilter}
            onChange={(event) => setProductFilter(event.target.value as ProductKey)}
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-600"
          >
            <option value="all">All products</option>
            {products.map((p) => (
              <option key={productKey(p.product, p.dosage)} value={productKey(p.product, p.dosage)}>
                {p.product} {p.dosage}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="p-4">
        <PurchaseColumnChart data={chartData} productFilter={productFilter} />
        <p className="mt-2 text-xs text-slate-500">
          Annual-only years (2018–2021) are one yearly total in the Annual panel.
          A column below zero is a return/adjustment; a month with no column had no purchase.
        </p>
      </div>
    </section>
  )
}