import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { PurchaseChartData, PurchaseChartSeries } from '../domain/chart'

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
 * The number of slots to show in the default (initial) brush window. Monthly
 * slots outnumber the four annual-only years, so the default view focuses on the
 * most recent months; dragging the brush left reveals earlier months and the
 * annual-only years.
 */
const DEFAULT_WINDOW = 16

interface PurchaseChartProps {
  data: PurchaseChartData
  /** `'all'` or a specific product+dosage key to narrow the columns shown. */
  productFilter?: 'all' | string
}

/** Renders x-axis label, coloring annual-only years distinctly from months. */
function renderTick(props: { x?: number | string; y?: number | string; payload?: { value?: string | number } }) {
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const label = String(props.payload?.value ?? '')
  const isAnnual = label.length === 4 // bare year, e.g. "2018", vs "2022-01"
  return (
    <text
      x={x}
      y={y + 12}
      textAnchor="middle"
      fill={isAnnual ? '#2dd4bf' : '#94a3b8'}
      fontSize={11}
      fontWeight={isAnnual ? 600 : 400}
    >
      {label}
    </text>
  )
}

export function PurchaseChart({ data, productFilter = 'all' }: PurchaseChartProps) {
  const series =
    productFilter === 'all'
      ? data.series
      : data.series.filter((s) => s.key === productFilter)

  const [hidden, setHidden] = useState<Record<string, boolean>>({})

  /** Shared Y domain from every visible series, so quantity is comparable. */
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

  const rows = useMemo(
    () =>
      data.slots.map((slot, i) => {
        const row: Record<string, number | string | null> = { label: slot.label }
        for (const s of series) {
          row[s.key] = s.values[i]
        }
        return row
      }),
    [data.slots, series],
  )

  const visibleSeries = series.filter((s) => !hidden[s.key])

  // Force a clean remount whenever the underlying window changes (year or
  // product filter), so the brush re-applies its default zoom window.
  const dataKey = data.slots.map((s) => s.key).join(',') + '|' + productFilter

  const defaultEndIndex = Math.max(0, data.slots.length - 1)
  const defaultStartIndex = Math.max(0, data.slots.length - DEFAULT_WINDOW)

  if (data.slots.length === 0 || series.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 text-sm text-slate-500">
        No purchase data for this selection.
      </div>
    )
  }

  const axisTick = { fill: '#94a3b8', fontSize: 11 } as const
  const grid = { stroke: '#1e293b', strokeDasharray: '3 3' } as const
  const many = rows.length > 24

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

      <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2">
        <ResponsiveContainer width="100%" height={340}>
          <BarChart
            key={dataKey}
            data={rows}
            margin={{ top: 8, right: 12, bottom: 8, left: 0 }}
            barCategoryGap={many ? '10%' : '20%'}
          >
            <CartesianGrid stroke={grid.stroke} strokeDasharray={grid.strokeDasharray} vertical={false} />
            <XAxis
              dataKey="label"
              tick={renderTick}
              interval="preserveStartEnd"
              angle={many ? -45 : 0}
              textAnchor={many ? 'end' : 'middle'}
              height={40}
            />
            <YAxis domain={yDomain} tick={axisTick} width={44} />
            <Tooltip
              cursor={{ fill: '#1e293b', fillOpacity: 0.4 }}
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
              <Bar
                key={s.key}
                dataKey={s.key}
                name={seriesLabel(s)}
                fill={colorFor(s.product)}
                isAnimationActive={false}
                maxBarSize={24}
              />
            ))}
            <Brush
              dataKey="label"
              height={28}
              travellerWidth={8}
              stroke="#2dd4bf"
              fill="#0f172a"
              startIndex={defaultStartIndex}
              endIndex={defaultEndIndex}
            />
          </BarChart>
        </ResponsiveContainer>
        <p className="px-2 pb-1 text-[11px] text-slate-500">
          Teal labels (2018–2021) are yearly totals — drag the zoom slider to see
          more. A column below zero is a return/adjustment; a month with no
          column had no purchase.
        </p>
      </div>
    </div>
  )
}