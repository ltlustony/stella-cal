import { AppProvider, useApp } from './app/AppProvider'

function Shell() {
  const { state } = useApp()

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
        <h1 className="text-xl font-semibold tracking-tight text-teal-400">
          Stella-Cal
        </h1>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6">
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
        </section>
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