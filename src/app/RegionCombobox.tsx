import { useEffect, useMemo, useRef, useState } from 'react'
import type { Region } from '../domain/types'

/**
 * A searchable region picker for the log-visit modal. Replaces the old 33-item
 * native dropdown: type to filter, tap a suggestion to choose. "All regions"
 * stays available as the first option.
 *
 * Controlled: `value` mirrors the modal's region filter; picking a suggestion
 * (or choosing "All regions") calls `onChange` and closes the list.
 */
export function RegionCombobox({
  regions,
  value,
  onChange,
}: {
  regions: Region[]
  value: number | 'all'
  onChange: (value: number | 'all') => void
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const rootRef = useRef<HTMLDivElement | null>(null)

  const sorted = useMemo(
    () => [...regions].sort((a, b) => a.name.localeCompare(b.name)),
    [regions],
  )

  const selectedName =
    value === 'all'
      ? 'All regions'
      : sorted.find((region) => region.id === value)?.name ?? ''

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (q === '') return sorted
    return sorted.filter((region) => region.name.toLowerCase().includes(q))
  }, [sorted, query])

  // Close when tapping outside the combobox.
  useEffect(() => {
    if (!open) return
    function onPointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function choose(next: number | 'all') {
    onChange(next)
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') {
      setOpen(false)
      return
    }
    if (event.key === 'Enter') {
      // Enter picks the first match (or "all" when the query is empty).
      event.preventDefault()
      if (matches.length > 0) choose(matches[0].id ?? 'all')
      else choose('all')
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-label="Region"
        value={open ? query : selectedName}
        placeholder="Search region…"
        onFocus={() => {
          setOpen(true)
          setQuery('')
        }}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onKeyDown={handleKeyDown}
        className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-600"
      />

      {open && (
        <ul
          role="listbox"
          className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-slate-700 bg-slate-900 py-1 shadow-xl shadow-slate-950/50"
        >
          <li>
            <button
              type="button"
              role="option"
              aria-selected={value === 'all'}
              onClick={() => choose('all')}
              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-800 ${
                value === 'all' ? 'text-teal-300' : 'text-slate-200'
              }`}
            >
              All regions
              {value === 'all' && <span aria-hidden="true">✓</span>}
            </button>
          </li>
          {matches.map((region) => (
            <li key={region.id}>
              <button
                type="button"
                role="option"
                aria-selected={value === region.id}
                onClick={() => choose(region.id ?? 'all')}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-slate-800 ${
                  value === region.id ? 'text-teal-300' : 'text-slate-200'
                }`}
              >
                {region.name}
                {value === region.id && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          ))}
          {matches.length === 0 && (
            <li className="px-3 py-2 text-sm text-slate-500">No matching regions</li>
          )}
        </ul>
      )}
    </div>
  )
}
