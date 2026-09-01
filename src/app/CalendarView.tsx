import { useEffect, useMemo, useState } from 'react'
import { buildMonthGrid, groupPlannedVisitsByDate, groupVisitsByDate, toISODate } from '../domain/calendar'
import type { Visit, VisitStatus } from '../domain/types'
import { visits as visitsRepo } from '../data/repositories'
import { useApp } from './AppProvider'
import { RegionCombobox } from './RegionCombobox'

/** Preset outcomes offered as quick choices; a custom choice is also possible. */
const OUTCOMES = ['Order placed', 'Follow-up needed', 'No interest']
const CUSTOM_OUTCOME = '__custom'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function formatFullDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function CalendarView() {
  const { state, refreshOverviews } = useApp()

  const now = new Date()
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [regionFilter, setRegionFilter] = useState<number | 'all'>('all')

  const [visits, setVisits] = useState<Visit[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)

  // Form fields
  const [formRegionFilter, setFormRegionFilter] = useState<number | 'all'>('all')
  const [doctorId, setDoctorId] = useState('')
  const [notes, setNotes] = useState('')
  const [outcome, setOutcome] = useState('')
  const [customOutcome, setCustomOutcome] = useState(false)
  const [formStatus, setFormStatus] = useState<VisitStatus>('completed')
  const [visitTime, setVisitTime] = useState('')
  const [nextVisitDate, setNextVisitDate] = useState('')
  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderProduct, setOrderProduct] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void visitsRepo.all().then((rows) => {
      if (!cancelled) setVisits(rows)
    })
    return () => {
      cancelled = true
    }
  }, [])

  async function reloadVisits() {
    setVisits(await visitsRepo.all())
  }

  const doctorsByName = useMemo(
    () => [...state.doctors].sort((a, b) => a.name.localeCompare(b.name)),
    [state.doctors],
  )

  const doctorById = useMemo(() => {
    const map = new Map<number, string>()
    for (const doctor of state.doctors) {
      if (doctor.id !== undefined) map.set(doctor.id, doctor.name)
    }
    return map
  }, [state.doctors])

  const visibleDoctors = useMemo(
    () =>
      regionFilter === 'all'
        ? state.doctors
        : state.doctors.filter((d) => d.regionId === regionFilter),
    [state.doctors, regionFilter],
  )

  const doctorOptions = useMemo(
    () =>
      formRegionFilter === 'all'
        ? doctorsByName
        : doctorsByName.filter((d) => d.regionId === formRegionFilter),
    [doctorsByName, formRegionFilter],
  )

  const byDate = useMemo(
    () => groupVisitsByDate(visits, visibleDoctors),
    [visits, visibleDoctors],
  )

  const plannedByDate = useMemo(
    () => groupPlannedVisitsByDate(visits, visibleDoctors),
    [visits, visibleDoctors],
  )

  const grid = useMemo(() => buildMonthGrid(year, month), [year, month])

  const visibleDoctorIds = useMemo(() => {
    const set = new Set<number>()
    for (const doctor of visibleDoctors) if (doctor.id !== undefined) set.add(doctor.id)
    return set
  }, [visibleDoctors])

  const dayVisits = useMemo(() => {
    if (!selectedDate) return []
    return visits.filter(
      (v) => v.date === selectedDate && (regionFilter === 'all' || visibleDoctorIds.has(v.doctorId)),
    )
  }, [visits, selectedDate, regionFilter, visibleDoctorIds])

  const todayIso = toISODate(new Date())

  const monthLabel = new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  })

  function shiftMonth(delta: number) {
    const d = new Date(year, month - 1 + delta, 1)
    setYear(d.getFullYear())
    setMonth(d.getMonth() + 1)
  }

  function resetForm(date: string | null = selectedDate) {
    setEditingId(null)
    setFormRegionFilter('all')
    setDoctorId('')
    setNotes('')
    setOutcome('')
    setCustomOutcome(false)
    setFormStatus(defaultStatusFor(date))
    setVisitTime('')
    setNextVisitDate('')
    setOrderPlaced(false)
    setOrderProduct('')
    setFormError(null)
  }

  /** Future calendar cells default to a planned visit; past/today to completed. */
  function defaultStatusFor(date: string | null): VisitStatus {
    if (date && date > todayIso) return 'planned'
    return 'completed'
  }

  function openDay(date: string) {
    setSelectedDate(date)
    resetForm(date)
  }

  function closePanel() {
    setSelectedDate(null)
    resetForm()
  }

  function beginEdit(visit: Visit) {
    setEditingId(visit.id ?? null)
    const doctor = state.doctors.find((d) => d.id === visit.doctorId)
    setFormRegionFilter(doctor ? doctor.regionId : 'all')
    setDoctorId(String(visit.doctorId))
    setNotes(visit.notes)
    if (OUTCOMES.includes(visit.outcome)) {
      setOutcome(visit.outcome)
      setCustomOutcome(false)
    } else {
      setOutcome(visit.outcome)
      setCustomOutcome(true)
    }
    setFormStatus(visit.status ?? 'completed')
    setVisitTime(visit.time ?? '')
    setOrderPlaced(visit.orderPlaced)
    setOrderProduct(visit.orderProduct ?? '')
    setFormError(null)
  }

  async function submitVisit() {
    if (!doctorId) {
      setFormError(
        formStatus === 'planned'
          ? 'Choose a doctor to plan this visit.'
          : 'Choose a doctor to log the visit.',
      )
      return
    }

    // Planned visits carry only what is known ahead of time: doctor, notes,
    // and an optional booked time. Completed visits carry the full outcome.
    const payload: Omit<Visit, 'id'> =
      formStatus === 'planned'
        ? {
            doctorId: Number(doctorId),
            date: selectedDate!,
            notes,
            outcome: '',
            orderPlaced: false,
            status: 'planned',
            time: visitTime.trim() || undefined,
          }
        : {
            doctorId: Number(doctorId),
            date: selectedDate!,
            notes,
            outcome,
            orderPlaced,
            orderProduct:
              orderPlaced && orderProduct.trim() ? orderProduct.trim() : undefined,
            status: 'completed',
            time: visitTime.trim() || undefined,
          }

    if (editingId !== null) {
      await visitsRepo.update(editingId, payload)
    } else {
      await visitsRepo.add(payload)
    }

    // Q21-b2: a completed visit may nominate its next visit date. That creates
    // a real planned-visit record — idempotently (one plan per doctor+date).
    if (
      formStatus === 'completed' &&
      nextVisitDate &&
      nextVisitDate > (selectedDate ?? '')
    ) {
      const alreadyPlanned = visits.some(
        (visit) =>
          visit.status === 'planned' &&
          visit.doctorId === Number(doctorId) &&
          visit.date === nextVisitDate,
      )
      if (!alreadyPlanned) {
        await visitsRepo.add({
          doctorId: Number(doctorId),
          date: nextVisitDate,
          notes: '',
          outcome: '',
          orderPlaced: false,
          status: 'planned',
        })
      }
    }

    resetForm()
    await reloadVisits()
    await refreshOverviews()
  }

  async function removeVisit(id: number) {
    if (!window.confirm('Delete this visit?')) return
    await visitsRepo.remove(id)
    if (editingId === id) resetForm()
    await reloadVisits()
    await refreshOverviews()
  }

  const panelShown = selectedDate !== null

  return (
    <section className="rounded-2xl border border-slate-800 bg-slate-900/60">
      <div className="border-b border-slate-800 p-4">
        <h2 className="text-lg font-medium">Calendar</h2>
        <p className="mt-1 text-sm text-slate-400">
          Visited days show the doctor(s) seen. Tap a day to log a visit.
        </p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => shiftMonth(-1)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
              aria-label="Previous month"
            >
              ←
            </button>
            <span className="min-w-32 text-center text-sm font-semibold">{monthLabel}</span>
            <button
              type="button"
              onClick={() => shiftMonth(1)}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
              aria-label="Next month"
            >
              →
            </button>
          </div>

          <select
            value={regionFilter}
            onChange={(event) =>
              setRegionFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))
            }
            className="rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-600"
          >
            <option value="all">All regions</option>
            {[...state.regions]
              .sort((a, b) => a.name.localeCompare(b.name))
              .map((region) => (
                <option key={region.id} value={region.id}>
                  {region.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="p-4">
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase tracking-wide text-slate-500">
          {WEEKDAYS.map((day) => (
            <div key={day} className="py-1">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {grid.map((cell) => {
            const labels = byDate.get(cell.date) ?? []
            const planned = plannedByDate.get(cell.date) ?? []
            const isToday = cell.date === todayIso
            // Q19: a plan is "overdue" (amber) from the day after its date;
            // a plan due today stays teal-dashed and actionable.
            const plannedOverdue = cell.date < todayIso
            return (
              <button
                key={cell.date}
                type="button"
                disabled={!cell.inCurrentMonth}
                onClick={() => openDay(cell.date)}
                className={`relative flex min-h-16 flex-col items-start rounded-lg border p-1 text-left transition ${
                  !cell.inCurrentMonth
                    ? 'cursor-default border-transparent text-slate-700'
                    : 'border-slate-800 text-slate-200 hover:border-teal-600 hover:bg-slate-800/40'
                }`}
              >
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-sm ${
                    isToday ? 'bg-teal-600 font-semibold text-white' : ''
                  }`}
                >
                  {cell.day}
                </span>
                {labels.length > 0 && (
                  <div className="mt-1 w-full space-y-0.5">
                    {labels.slice(0, 2).map((label) => (
                      <div
                        key={label.doctorId}
                        className="w-full truncate rounded bg-teal-600/20 px-1 text-[10px] leading-4 text-teal-200"
                      >
                        {label.doctorName}
                      </div>
                    ))}
                    {labels.length > 2 && (
                      <div className="px-1 text-[10px] leading-4 text-slate-400">
                        +{labels.length - 2} more
                      </div>
                    )}
                  </div>
                )}
                {planned.length > 0 && (
                  <div className="mt-0.5 w-full space-y-0.5">
                    {planned.slice(0, 2).map((label) => (
                      <div
                        key={`planned-${label.visitId ?? `${label.doctorId}-${cell.date}`}`}
                        className={`w-full truncate rounded border border-dashed px-1 text-[10px] leading-4 ${
                          plannedOverdue
                            ? 'border-amber-600/60 bg-amber-600/10 text-amber-200'
                            : 'border-teal-600/60 bg-teal-600/5 text-teal-200'
                        }`}
                      >
                        {label.time ? `🕐 ${label.time} ` : ''}
                        {label.doctorName}
                      </div>
                    ))}
                    {planned.length > 2 && (
                      <div className="px-1 text-[10px] leading-4 text-slate-400">
                        +{planned.length - 2} more
                      </div>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {panelShown && (
        <div className="fixed inset-0 z-20 flex items-end justify-center bg-slate-950/70 sm:items-center">
          <div
            className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-slate-700 bg-slate-900 p-5 sm:rounded-2xl"
            style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-100">
                  {formatFullDate(selectedDate!)}
                </h3>
                <p className="text-xs text-slate-500">
                  {editingId !== null
                    ? 'Editing visit'
                    : formStatus === 'planned'
                      ? 'Plan a visit'
                      : 'Log a visit'}
                </p>
              </div>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:bg-slate-800"
              >
                Close
              </button>
            </div>

            {dayVisits.length > 0 && editingId === null && (
              <ul className="mt-4 space-y-2 border-b border-slate-800 pb-4">
                {dayVisits.map((visit) => {
                  const doctorName = doctorById.get(visit.doctorId)
                  return (
                    <li
                      key={visit.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/50 p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-100">
                          {doctorName ?? 'Unknown doctor'}
                          {visit.status === 'planned' && (
                            <span
                              className={`ml-2 rounded-full border border-dashed px-2 py-0.5 text-[10px] font-medium ${
                                visit.date < todayIso
                                  ? 'border-amber-600/60 text-amber-300'
                                  : 'border-teal-600/60 text-teal-300'
                              }`}
                            >
                              {visit.date < todayIso ? 'Overdue plan' : 'Planned'}
                            </span>
                          )}
                        </p>
                        {visit.outcome && (
                          <p className="mt-0.5 text-xs text-teal-300">{visit.outcome}</p>
                        )}
                        {visit.orderPlaced && visit.orderProduct && (
                          <p className="mt-0.5 text-xs text-slate-300">
                            Product: {visit.orderProduct}
                          </p>
                        )}
                        {visit.notes && (
                          <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">
                            {visit.notes}
                          </p>
                        )}
                        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-500">
                          {visit.time && <span>🕐 {visit.time}</span>}
                          {visit.status === 'planned' ? (
                            <span>Planned visit</span>
                          ) : (
                            <span>{visit.orderPlaced ? 'Order placed' : 'No order'}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => beginEdit(visit)}
                          className="rounded-md border border-slate-700 px-2 py-1 text-xs text-slate-300 transition hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void removeVisit(visit.id!)}
                          className="rounded-md border border-red-900 px-2 py-1 text-xs text-red-300 transition hover:bg-red-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {editingId === null && dayVisits.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null)
                  resetForm()
                }}
                className="mt-4 text-sm font-medium text-teal-300 transition hover:text-teal-200"
              >
                + Log another visit
              </button>
            )}

            <div className="mt-4 space-y-3">
              {/* Mode toggle: default is date-driven (future day → planned),
                  with a visible override (Q5). */}
              <div className="flex gap-1 rounded-xl border border-slate-800 bg-slate-950/60 p-1">
                <button
                  type="button"
                  onClick={() => setFormStatus('completed')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    formStatus === 'completed'
                      ? 'bg-teal-600/20 text-teal-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Log visit
                </button>
                <button
                  type="button"
                  onClick={() => setFormStatus('planned')}
                  className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    formStatus === 'planned'
                      ? 'bg-teal-600/20 text-teal-200'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Planning
                </button>
              </div>

              <label className="block">
                <span className="text-xs font-medium text-slate-400">Doctor</span>
                <RegionCombobox
                  regions={state.regions}
                  value={formRegionFilter}
                  onChange={(next) => {
                    setFormRegionFilter(next)
                    if (next !== 'all') {
                      const selectedDoctor = state.doctors.find((d) => d.id === Number(doctorId))
                      if (doctorId && selectedDoctor && selectedDoctor.regionId !== next) {
                        setDoctorId('')
                      }
                    }
                  }}
                />
                <select
                  value={doctorId}
                  onChange={(event) => setDoctorId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-600"
                >
                  <option value="">Choose a doctor…</option>
                  {doctorOptions.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      {doctor.name}
                    </option>
                  ))}
                </select>
              </label>

              {/* Booked time: native time input, planned visits only (Q13). */}
              {formStatus === 'planned' && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">
                    Booked time (optional)
                  </span>
                  <input
                    type="time"
                    value={visitTime}
                    onChange={(event) => setVisitTime(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-600"
                  />
                </label>
              )}

              {formStatus === 'completed' && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Outcome</span>
                  <select
                  value={customOutcome ? CUSTOM_OUTCOME : outcome}
                  onChange={(event) => {
                    const value = event.target.value
                    if (value === CUSTOM_OUTCOME) {
                      setCustomOutcome(true)
                      setOutcome('')
                    } else {
                      setCustomOutcome(false)
                      setOutcome(value)
                    }
                  }}
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-600"
                >
                  <option value="">— Select outcome —</option>
                  {OUTCOMES.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                  <option value={CUSTOM_OUTCOME}>Other…</option>
                </select>
                  {customOutcome && (
                    <input
                      type="text"
                      value={outcome}
                      onChange={(event) => setOutcome(event.target.value)}
                      placeholder="Describe the outcome…"
                      className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-600"
                    />
                  )}
                </label>
              )}

              <label className="block">
                <span className="text-xs font-medium text-slate-400">Notes</span>
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder={
                    formStatus === 'planned'
                      ? 'What to discuss…'
                      : 'What was discussed…'
                  }
                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-600"
                />
              </label>

              {/* Q21-b2: a completed visit can nominate its next visit date,
                  which creates a real planned-visit record. */}
              {formStatus === 'completed' && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">
                    Next visit date (optional)
                  </span>
                  <input
                    type="date"
                    value={nextVisitDate}
                    onChange={(event) => setNextVisitDate(event.target.value)}
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-teal-600"
                  />
                  <span className="mt-1 block text-[11px] text-slate-500">
                    Creates a planned visit for this doctor on that date.
                  </span>
                </label>
              )}

              {formStatus === 'completed' && (
                <label className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={orderPlaced}
                    onChange={(event) => setOrderPlaced(event.target.checked)}
                    className="h-4 w-4 rounded border-slate-600 bg-slate-950 accent-teal-600"
                  />
                  An order was placed on this visit
                </label>
              )}

              {formStatus === 'completed' && orderPlaced && (
                <label className="block">
                  <span className="text-xs font-medium text-slate-400">Product ordered</span>
                  <input
                    type="text"
                    value={orderProduct}
                    onChange={(event) => setOrderProduct(event.target.value)}
                    placeholder="e.g. Actein 600mg"
                    className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-teal-600"
                  />
                </label>
              )}

              {formError && <p className="text-sm text-red-300">{formError}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                {editingId !== null && (
                  <button
                    type="button"
                    onClick={() => resetForm()}
                    className="rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-300 transition hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void submitVisit()}
                  className="rounded-lg border border-teal-600 bg-teal-600/10 px-4 py-2 text-sm font-medium text-teal-200 transition hover:bg-teal-600/20"
                >
                  {editingId !== null
                    ? 'Save changes'
                    : formStatus === 'planned'
                      ? 'Save plan'
                      : 'Save visit'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}