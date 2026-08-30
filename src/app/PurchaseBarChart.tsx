import type { PurchaseChartPoint } from '../domain/chart'
import { productKey, type ProductKey } from '../domain/chart'

/**
 * A deterministic color per product name so the same product is always the same
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

interface Segment {
  product: string
  dosage: string
  quantity: number
  color: string
}

interface PurchaseBarChartProps {
  points: PurchaseChartPoint[]
  productFilter: ProductKey
}

const WIDTH = 720
const HEIGHT = 300
const MARGIN = { top: 16, right: 16, bottom: 44, left: 52 }
const INNER_WIDTH = WIDTH - MARGIN.left - MARGIN.right
const INNER_HEIGHT = HEIGHT - MARGIN.top - MARGIN.bottom

function niceTicks(min: number, max: number, count: number): number[] {
  if (min === max) return [min]
  const ticks: number[] = []
  for (let i = 0; i <= count; i += 1) {
    ticks.push(min + ((max - min) * i) / count)
  }
  return ticks
}

export function PurchaseBarChart({ points, productFilter }: PurchaseBarChartProps) {
  if (points.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-slate-800 bg-slate-950/40 text-sm text-slate-500">
        No purchase data for this selection.
      </div>
    )
  }

  const visibleSegments: Segment[][] = points.map((point) => {
    const products =
      productFilter === 'all'
        ? point.products
        : point.products.filter((p) => productKey(p.product, p.dosage) === productFilter)
    return products.map((p) => ({
      product: p.product,
      dosage: p.dosage,
      quantity: p.quantity,
      color: colorFor(p.product),
    }))
  })

  let maxVal = 0
  let minVal = 0
  for (const segments of visibleSegments) {
    const pos = segments.filter((s) => s.quantity > 0).reduce((sum, s) => sum + s.quantity, 0)
    const neg = segments.filter((s) => s.quantity < 0).reduce((sum, s) => sum + s.quantity, 0)
    if (pos > maxVal) maxVal = pos
    if (neg < minVal) minVal = neg
  }
  if (maxVal === 0 && minVal === 0) {
    maxVal = 1
    minVal = -1
  }

  const yPx = (value: number) => MARGIN.top + ((maxVal - value) / (maxVal - minVal)) * INNER_HEIGHT
  const zeroY = yPx(0)

  const slotWidth = INNER_WIDTH / points.length
  const barWidth = Math.max(4, slotWidth * 0.66)
  const many = points.length > 24

  const ticks = niceTicks(minVal, maxVal, 4)

  /** Renders a stacked run of segments outward from the zero baseline. */
  const renderRun = (segments: Segment[], label: string, x: number, sign: 'pos' | 'neg'): React.ReactElement[] => {
    const rects: React.ReactElement[] = []
    let cumulative = 0
    for (const seg of segments) {
      const y1 = yPx(cumulative)
      cumulative += seg.quantity
      const y2 = yPx(cumulative)
      const rectsTop = Math.min(y1, y2)
      const h = Math.abs(y2 - y1)
      rects.push(
        <rect
          key={`${label}-${seg.product}-${seg.dosage}-${sign}`}
          x={x}
          y={rectsTop}
          width={barWidth}
          height={Math.max(0.5, h)}
          fill={seg.color}
          fillOpacity={sign === 'neg' ? 0.85 : 1}
        >
          <title>
            {label} · {seg.product} {seg.dosage}: {seg.quantity}
          </title>
        </rect>,
      )
    }
    return rects
  }

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      role="img"
      aria-label="Purchase history chart"
      className="w-full"
    >
      {/* y gridlines + labels */}
      {ticks.map((tick) => {
        const y = yPx(tick)
        return (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={WIDTH - MARGIN.right}
              y1={y}
              y2={y}
              className="stroke-slate-800"
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 8}
              y={y + 4}
              textAnchor="end"
              className="fill-slate-500"
              fontSize={10}
            >
              {Math.round(tick)}
            </text>
          </g>
        )
      })}

      {/* zero baseline */}
      <line
        x1={MARGIN.left}
        x2={WIDTH - MARGIN.right}
        y1={zeroY}
        y2={zeroY}
        className="stroke-slate-500"
        strokeWidth={1.5}
      />

      {/* bars */}
      {points.map((point, i) => {
        const cx = MARGIN.left + slotWidth * (i + 0.5)
        const x = cx - barWidth / 2

        const positive = visibleSegments[i]
          .filter((s) => s.quantity > 0)
          .sort((a, b) => a.product.localeCompare(b.product))
        const negative = visibleSegments[i]
          .filter((s) => s.quantity < 0)
          .sort((a, b) => b.quantity - a.quantity)

        // Annual-only years (month === 0) get a distinct treatment so they are
        // never mistaken for monthly bars.
        const isAnnual = point.month === 0

        return (
          <g key={point.label}>
            {renderRun(positive, point.label, x, 'pos')}
            {renderRun(negative, point.label, x, 'neg')}
            {isAnnual && (
              <rect
                x={x}
                y={MARGIN.top}
                width={barWidth}
                height={INNER_HEIGHT}
                fill="none"
                stroke="#2dd4bf"
                strokeWidth={1.5}
                strokeDasharray="4 3"
                rx={2}
              >
                <title>{point.label}: yearly total</title>
              </rect>
            )}
            {/* x label */}
            <text
              x={cx}
              y={HEIGHT - MARGIN.bottom + 30}
              textAnchor="end"
              transform={`rotate(-${many ? 90 : 45} ${cx} ${HEIGHT - MARGIN.bottom + 30})`}
              className={isAnnual ? 'fill-teal-300' : 'fill-slate-400'}
              fontSize={isAnnual ? 11 : many ? 9 : 10}
              fontWeight={isAnnual ? 600 : 400}
            >
              {point.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}