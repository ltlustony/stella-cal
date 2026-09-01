import { useMemo, useState } from 'react'
import type { Trend } from '../domain/derived'
import { useApp } from './AppProvider'

/** Display metadata per trend, so each row renders from one place of truth. */
const TREND_META: Record<Trend, { label: string; icon: string; className: string }> = {
  up: { label: 'Rising', icon: '▲', className: 'text-emerald-300' },
  flat: { label: 'Flat', icon: '—', className: 'text-slate-400' },
  down: { label: 'Falling', icon: '▼', className: 'text-amber-300' },
}

function formatDate(iso: string | null): string {
  if (!iso) return 'Never'
  const date = new Date(`${iso}T00:00:00`)
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function DoctorListView({ onSelect }: { onSelect: (doctorId: number) => void }) {
  const { state } = useApp()
  const [query, setQuery] = useState('')
  const [regionId, setRegionId] = useState<number | 'all'>('all')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return state.overviews
      .filter((overview) => (regionId === 'all' ? true : overview.regionId === regionId))
      .filter((overview) => (q === '' ? true : overview.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [state.overviews, query, regionId])

  const regions = useMemo(
    () => [...state.regions].sort((a, b) => a.name.localeCompare(b.name)),
    [state.regions],
  )

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 p-4">
        <h2 className="text-lg font-medium">Doctors</h2>
        <p className="mt-1 text-sm text-slate-400">
          {state.overviews.length} doctors · last visit and purchase trend at a glance.
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none transition focus:border-teal-600"
          />
          <select
            value={regionId}
            onChange={(event) =>
              setRegionId(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-600"
          >
            <option value="all">All regions</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="p-6 text-sm text-slate-500">
          {state.overviews.length === 0
            ? 'No doctors yet — import an Excel file to get started.'
            : 'No doctors match your search.'}
        </div>
      ) : (
        <ul className="divide-y divide-slate-800">
          {filtered.map((overview) => (
            <li
              key={overview.doctorId}
              className="relative flex cursor-pointer items-center justify-between gap-3 px-4 py-3 transition hover:bg-slate-800/40"
            >
              <button
                type="button"
                onClick={() => onSelect(overview.doctorId)}
                className="absolute inset-0"
                aria-label={`Open ${overview.name}`}
              />
              <div className="min-w-0">
                <p className="truncate font-medium text-slate-100">{overview.name}</p>
                <p className="text-xs text-slate-500">{overview.regionName}</p>
              </div>
              <div className="flex shrink-0 items-center gap-4 text-right">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-500">Last visit</p>
                  <p className="text-sm text-slate-300">{formatDate(overview.lastVisitDate)}</p>
                </div>
                <div className="w-20">
                  <p className="text-xs uppercase tracking-wide text-slate-500">Trend</p>
                  {overview.trend ? (
                    <p className={`text-sm font-medium ${TREND_META[overview.trend].className}`}>
                      <span aria-hidden="true">{TREND_META[overview.trend].icon}</span>{' '}
                      {TREND_META[overview.trend].label}
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
  )
}