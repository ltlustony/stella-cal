import { lazy, Suspense, useEffect, useRef, useState } from 'react'
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

type Tab = 'calendar' | 'priority' | 'doctors' | 'settings'

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

  const hasData = state.doctors.length > 0
  const startImport = () => inputRef.current?.click()

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsImporting(true)
    setImportError(null)
    setImportSummary(null)

    try {
      const result = await importWorkbookFromFile(file)
      setImportSummary(result.summary)
      setTab('doctors')
      setSelectedDoctorId(null)
      await refreshOverviews()
    } catch (error) {
      setImportError(error instanceof Error ? error.message : 'Import failed.')
    } finally {
      setIsImporting(false)
      event.target.value = ''
    }
  }

  // Success feedback auto-dismisses; errors persist until dismissed.
  useEffect(() => {
    if (!importSummary) return
    const timer = window.setTimeout(() => setImportSummary(null), 8000)
    return () => window.clearTimeout(timer)
  }, [importSummary])

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

  return (
    <div className="min-h-dvh bg-slate-950 text-slate-100">
      {/* Shared Excel import input: mounted once at shell level so the import
          flow works from every tab (the file input is never unmounted). */}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleImport}
      />

      <header
        className="sticky top-0 z-30 border-b border-slate-800 bg-slate-900/80 backdrop-blur"
        style={{ paddingTop: 'env(safe-area-inset-top)' }}
      >
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <h1 className="text-xl font-semibold tracking-tight text-teal-400">
            Stella-Cal
          </h1>
        </div>
      </header>

      <main
        className="mx-auto max-w-3xl px-4 py-6"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* First-run banner: shown until an Excel file has been imported. */}
        {!hasData && (
          <div className="mb-5 flex items-center justify-between gap-3 rounded-xl border border-teal-700 bg-teal-950/30 px-4 py-3 text-sm text-teal-200">
            <span>
              No doctors or regions yet. Import your Excel file to get started.
            </span>
            <button
              type="button"
              onClick={startImport}
              disabled={isImporting}
              className="shrink-0 rounded-lg border border-teal-600 px-3 py-1.5 font-medium transition hover:bg-teal-600/20 disabled:opacity-50"
            >
              {isImporting ? 'Importing…' : 'Import Excel'}
            </button>
          </div>
        )}

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

        {isBackupOverdue(lastBackupAt) && hasData && (
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

        {/* Global import feedback: same banner regardless of which button
            started the import. Success auto-dismisses; errors persist. */}
        {isImporting && (
          <div className="mb-5 rounded-xl border border-teal-700 bg-teal-950/20 px-4 py-3 text-sm text-teal-200">
            Parsing and validating the Excel workbook…
          </div>
        )}
        {importError && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-red-800 bg-red-950/30 px-4 py-3 text-sm text-red-200">
            <span>{importError}</span>
            <button
              type="button"
              onClick={() => setImportError(null)}
              className="shrink-0 rounded-md border border-red-800 px-2 py-0.5 text-xs transition hover:bg-red-900/40"
            >
              Dismiss
            </button>
          </div>
        )}
        {importSummary && (
          <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/60 px-4 py-3 text-sm text-slate-200">
            <div>
              <p className="font-medium text-teal-300">Import complete</p>
              <ul className="mt-1 space-y-0.5 text-slate-300">
                <li>Regions: {importSummary.regions}</li>
                <li>Doctors: {importSummary.doctors}</li>
                <li>Purchases: {importSummary.purchases}</li>
              </ul>
            </div>
            <button
              type="button"
              onClick={() => setImportSummary(null)}
              className="shrink-0 rounded-md border border-slate-700 px-2 py-0.5 text-xs transition hover:bg-slate-800"
            >
              Dismiss
            </button>
          </div>
        )}

        {tab === 'calendar' ? (
          <CalendarView />
        ) : tab === 'settings' ? (
          <SettingsView
            onBackedUp={setLastBackupAt}
            onStartImport={startImport}
            isImporting={isImporting}
          />
        ) : tab === 'priority' ? (
          <PriorityListView
            onSelect={(doctorId) => {
              setSelectedDoctorId(doctorId)
              setTab('doctors')
            }}
          />
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