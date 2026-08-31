import { lazy, Suspense, useRef, useState } from 'react'
import { AppProvider, useApp } from './app/AppProvider'
import { CalendarView } from './app/CalendarView'
import { DoctorListView } from './app/DoctorListView'
import { PriorityListView } from './app/PriorityListView'
import { SettingsView } from './app/SettingsView'
import { getLastBackupAt, isBackupOverdue } from './data/backup'
import { importWorkbookFromFile } from './data/excelImport'

// Lazy-loaded so the detail chart (and its Recharts dependency) stays out of the
// initial bundle and only downloads when a doctor is opened.
const DoctorDetailView = lazy(() =>
  import('./app/DoctorDetailView').then((m) => ({ default: m.DoctorDetailView })),
)

type Tab = 'calendar' | 'overview' | 'priority' | 'doctors' | 'settings'

function Shell() {
  const { state, refreshOverviews } = useApp()
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [tab, setTab] = useState<Tab>('calendar')
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [lastBackupAt, setLastBackupAt] = useState<number | null>(() =>
    getLastBackupAt(),
  )
  const [importSummary, setImportSummary] = useState<
    | { regions: number; doctors: number; purchases: number }
    | null
  >(null)
  const [importError, setImportError] = useState<string | null>(null)

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportError(null)

    try {
      const result = await importWorkbookFromFile(file)
      setImportSummary(result.summary)
      setTab('doctors')
      await refreshOverviews()
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  if (state.status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-600 border-t-transparent" />
          <p className="text-sm">Opening your data…</p>
        </div>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-slate-950 p-6 text-slate-300">
        <div className="max-w-sm rounded-xl border border-red-800 bg-red-950/40 p-5">
          <h1 className="text-lg font-semibold text-red-300">Could not open the app</h1>
          <p className="mt-2 text-sm text-red-200/80">{state.error}</p>
        </div>
      </div>
    )
  }

  const doctorCount = state.doctors.length
  const regionCount = state.regions.length

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900/70 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <h1 className="text-xl font-semibold tracking-tight text-teal-400">
            Stella-Cal
          </h1>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="rounded-lg border border-teal-600 bg-teal-600/10 px-3 py-2 text-sm font-medium text-teal-200 transition hover:bg-teal-600/20"
          >
            {isImporting ? 'Importing…' : 'Import Excel'}
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
        <nav className="mb-5 flex gap-1 rounded-xl border border-slate-800 bg-slate-900/60 p-1">
          <button
            type="button"
            onClick={() => setTab('calendar')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === 'calendar'
                ? 'bg-teal-600/20 text-teal-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Calendar
          </button>
          <button
            type="button"
            onClick={() => setTab('overview')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === 'overview'
                ? 'bg-teal-600/20 text-teal-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setTab('priority')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === 'priority'
                ? 'bg-teal-600/20 text-teal-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Priority
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('doctors')
              setSelectedDoctorId(null)
            }}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === 'doctors'
                ? 'bg-teal-600/20 text-teal-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Doctors
          </button>
          <button
            type="button"
            onClick={() => setTab('settings')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${
              tab === 'settings'
                ? 'bg-teal-600/20 text-teal-200'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Settings
          </button>
        </nav>

        {isBackupOverdue(lastBackupAt) && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-amber-700 bg-amber-950/20 px-4 py-3 text-sm text-amber-200">
            <span>
              No visit backup in the last 7 days. Back up to keep your visit
              records safe.
            </span>
            <button
              type="button"
              onClick={() => setTab('settings')}
              className="shrink-0 rounded-lg border border-amber-600 px-3 py-1.5 font-medium transition hover:bg-amber-600/20"
            >
              Back up
            </button>
          </div>
        )}

        {tab === 'calendar' ? (
          <CalendarView />
        ) : tab === 'settings' ? (
          <SettingsView onBackedUp={setLastBackupAt} />
        ) : tab === 'priority' ? (
          <PriorityListView
            onSelect={(doctorId) => {
              setSelectedDoctorId(doctorId)
              setTab('doctors')
            }}
          />
        ) : tab === 'overview' ? (
          <section className="rounded-2xl border border-slate-800 bg-slate-900/60 p-6">
            <h2 className="text-lg font-medium">Welcome</h2>
            <p className="mt-1 text-sm text-slate-400">
              Your data is stored privately on this device and works offline.
            </p>

            <dl className="mt-5 grid grid-cols-2 gap-4 text-center">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Doctors
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-teal-400">
                  {doctorCount}
                </dd>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4">
                <dt className="text-xs uppercase tracking-wide text-slate-500">
                  Regions
                </dt>
                <dd className="mt-1 text-2xl font-semibold text-teal-400">
                  {regionCount}
                </dd>
              </div>
            </dl>

            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />

            {isImporting && (
              <div className="mt-5 rounded-xl border border-teal-700 bg-teal-950/20 p-3 text-sm text-teal-200">
                Parsing and validating the Excel workbook…
              </div>
            )}

            {importError && (
              <div className="mt-5 rounded-xl border border-red-800 bg-red-950/30 p-3 text-sm text-red-200">
                {importError}
              </div>
            )}

            {importSummary && (
              <div className="mt-5 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200">
                <p className="font-medium text-teal-300">Import complete</p>
                <ul className="mt-2 space-y-1 text-slate-300">
                  <li>Regions: {importSummary.regions}</li>
                  <li>Doctors: {importSummary.doctors}</li>
                  <li>Purchases: {importSummary.purchases}</li>
                </ul>
              </div>
            )}
          </section>
        ) : selectedDoctorId !== null ? (
          <Suspense
            fallback={
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center text-sm text-slate-400">
                Loading chart…
              </div>
            }
          >
            <DoctorDetailView
              doctorId={selectedDoctorId}
              onBack={() => setSelectedDoctorId(null)}
            />
          </Suspense>
        ) : (
          <DoctorListView onSelect={setSelectedDoctorId} />
        )}
      </main>
    </div>
  )
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}