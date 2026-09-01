import { useMemo } from 'react'
import type { Trend } from '../domain/derived'
import { buildPriorityList } from '../domain/priority'
import { useApp } from './AppProvider'

const TREND_META: Record<Trend, { label: string; icon: string; className: string }> = {
  up: { label: 'Rising', icon: '▲', className: 'text-emerald-300' },
  flat: { label: 'Flat', icon: '—', className: 'text-slate-400' },
  down: { label: 'Falling', icon: '▼', className: 'text-amber-300' },
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function PriorityListView({ onSelect }: { onSelect: (doctorId: number) => void }) {
  const { state } = useApp()

  const list = useMemo(() => buildPriorityList(state.overviews), [state.overviews])

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
        <div className="border-b border-slate-800 p-4">
          <h2 className="text-lg font-medium">Priority list</h2>
          <p className="mt-1 text-sm text-slate-400">
            Doctors to visit next, ranked by days since last visit and purchase trend.
            Due and overdue plans show on the calendar instead.
          </p>
        </div>

        {list.length === 0 ? (
          <div className="p-6 text-sm text-slate-500">
            No doctors yet — import an Excel file to get started.
          </div>
        ) : (
          <ul className="divide-y divide-slate-800">
            {list.map((entry, index) => (
              <li
                key={entry.doctorId}
                className={`relative flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-800/40 ${
                  entry.emphasis === 'declining' ? 'bg-red-950/20' : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelect(entry.doctorId)}
                  className="absolute inset-0"
                  aria-label={`Open ${entry.name}`}
                />
                <div className="flex w-8 shrink-0 items-center justify-center text-sm font-semibold text-slate-500">
                  {index + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-slate-100">{entry.name}</p>
                    {entry.emphasis === 'declining' && (
                      <span className="shrink-0 rounded-full bg-red-600/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-300">
                        Declining
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-500">{entry.regionName}</p>
                </div>
                <div className="flex shrink-0 items-center gap-4 text-right">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-slate-500">Last visit</p>
                    <p className="text-sm text-slate-300">
                      {entry.lastVisitDate
                        ? `${formatDate(entry.lastVisitDate)} (${entry.daysSinceLastVisit}d)`
                        : 'Never'}
                    </p>
                  </div>
                  <div className="w-20">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Trend</p>
                    {entry.trend ? (
                      <p className={`text-sm font-medium ${TREND_META[entry.trend].className}`}>
                        <span aria-hidden="true">{TREND_META[entry.trend].icon}</span>{' '}
                        {TREND_META[entry.trend].label}
                      </p>
                    ) : (
                      <p className="text-sm font-medium text-slate-600">
                        <span aria-hidden="true">·</span> No data
                      </p>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}