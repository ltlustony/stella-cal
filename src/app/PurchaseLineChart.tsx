import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PurchaseChartData, PurchaseChartSeries, PurchaseChartSlot } from '../domain/chart'

/**
 * A deterministic color per product so the same product is always the same
 * color across filters and months.
 */
const PALETTE = [
  '#2dd4bf', '#60a5fa', '#f472b6', '#fbbf24', '#a78bfa', '#34d399',
  '#f87171', '#22d3ee', '#e879f9', '#facc15', '#4ade80', '#c084fc',
  '#fda4af', '#93c5fd', '#86efac', '#fb923c',
]

function colorFor(product: string): string {
  let hash = 0
  for (let i = 0; i < product.length; i += 1) {
    hash = (hash * 31 + product.charCodeAt(i)) | 0
  }
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

/** The product/dosage label used on the legend and tooltip. */
function seriesLabel(series: PurchaseChartSeries): string {
  return series.dosage && series.dosage !== 'N/A'
    ? `${series.product} ${series.dosage}`
    : series.product
}

/**
 * A multi-series line chart of a doctor's purchase history.
 *
 * Annual-only years (2018–2021, `month === 0`) are rendered in a separate left
 * panel on their own axis, so they are never mistaken for monthly bars. Monthly
 * data renders in the right panel. Both panels share one Y scale so quantity is
 * directly comparable, and negative values (returns) dip below the zero line.
 */
interface PurchaseLineChartProps {
  data: PurchaseChartData
  /** `'all'` or a specific product+dosage key to narrow the lines shown. */
  productFilter?: 'all' | string
}

export function PurchaseLineChart({ data, productFilter = 'all' }: PurchaseLineChartProps) {
  const series =
    productFilter === 'all'
      ? data.series
      : data.series.filter((s) => s.key === productFilter)

  const [hidden, setHidden] = useState<Record<string, boolean>>({})

  const annualSlots = data.slots.filter((s) => s.isAnnual)
  const monthlySlots = data.slots.filter((s) => !s.isAnnual)

  /** Compute a shared Y domain from every visible series so both panels align. */
  const yDomain = useMemo((): [number, number] => {
    let min = 0
    let max = 0
    for (const s of series) {
      if (hidden[s.key]) continue
      for (const v of s.values) {
        if (v === null) continue
        if (v < min) min = v
        if (v > max) max = v
      }
    }
    if (min === 0 && max === 0) return [0, 1]
    const padding = Math.max(1, (max - min) * 0.1)
    return [min - padding, max + padding]
  }, [series, hidden])

  const slotIndex = useMemo(() => {
    const map = new Map<string, number>()
    data.slots.forEach((slot, i) => map.set(slot.key, i))
    return map
  }, [data.slots])

  const buildRows = (slots: PurchaseChartSlot[]) =>
    slots.map((slot) => {
      const row: Record<string, number | string | null> = { label: slot.label }
      const idx = slotIndex.get(slot.key)
      for (const s of series) {
        row[s.key] = idx === undefined ? null : s.values[idx]
      }
      return row
    })

  const annualRows = buildRows(annualSlots)
  const monthlyRows = buildRows(monthlySlots)

  const visibleSeries = series.filter((s) => !hidden[s.key])

  if (data.slots.length === 0 || series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 text-sm text-slate-500">
        No purchase data for this selection.
      </div>
    )
  }

  const axisTick = { fill: '#94a3b8', fontSize: 11 } as const
  const grid = { stroke: '#1e293b', strokeDasharray: '3 3' } as const

  const renderChart = (rows: Array<Record<string, unknown>>, many: boolean) => (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 8, left: 0 }}>
        <CartesianGrid stroke={grid.stroke} strokeDasharray={grid.strokeDasharray} vertical={false} />
        <XAxis
          dataKey="label"
          tick={axisTick}
          interval={many ? 'preserveStartEnd' : 0}
          angle={many ? -45 : 0}
          textAnchor={many ? 'end' : 'middle'}
          height={40}
        />
        <YAxis domain={yDomain} tick={axisTick} width={44} />
        <Tooltip
          contentStyle={{
            backgroundColor: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 8,
            color: '#e2e8f0',
          }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <ReferenceLine y={0} stroke="#64748b" strokeWidth={1} />
        {visibleSeries.map((s) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={seriesLabel(s)}
            stroke={colorFor(s.product)}
            strokeWidth={2}
            dot={rows.length <= 24 ? { r: 3 } : false}
            connectNulls={false}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legend">
        {series.map((s) => {
          const isHidden = hidden[s.key] ?? false
          return (
            <button
              key={s.key}
              type="button"
              onClick={() => setHidden((prev) => ({ ...prev, [s.key]: !prev[s.key] }))}
              className={`flex items-center gap-1.5 text-xs transition ${
                isHidden ? 'text-slate-600 line-through' : 'text-slate-300'
              }`}
            >
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: colorFor(s.product) }}
                aria-hidden="true"
              />
              {seriesLabel(s)}
            </button>
          )
        })}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]">
        {annualSlots.length > 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
            <p className="px-2 pt-1 text-[11px] uppercase tracking-wide text-slate-500">
              Annual totals
            </p>
            {renderChart(annualRows, annualRows.length > 6)}
          </div>
        )}
        <div className={`rounded-xl border border-slate-800 bg-slate-950/40 p-2 ${annualSlots.length === 0 ? 'md:col-span-2' : ''}`}>
          {annualSlots.length > 0 && (
            <p className="px-2 pt-1 text-[11px] uppercase tracking-wide text-slate-500">
              Monthly
            </p>
          )}
          {renderChart(monthlyRows, monthlyRows.length > 24)}
        </div>
      </div>
    </div>
  )
}