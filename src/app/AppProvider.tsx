import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { getDb } from '../data/db'
import { doctors, purchases, regions, visits } from '../data/repositories'
import { buildDoctorOverviews, todayAsOf } from '../domain/derived'
import {
  appReducer,
  initialState,
  type AppAction,
  type AppState,
} from './state'

interface AppContextValue {
  state: AppState
  dispatch: (action: AppAction) => void
  refreshOverviews: () => Promise<void>
}

const AppContext = createContext<AppContextValue | null>(null)

/**
 * Loads reference data (regions, doctors) and the derived doctor-list overviews
 * (last visit date + purchase trend per doctor) in a single pass, then
 * dispatches them into state. Called on boot and again after an import so the
 * list reflects freshly added doctors/regions and rebuilt purchases.
 */
async function loadAll(dispatch: (action: AppAction) => void): Promise<void> {
  const [regionRows, doctorRows, visitRows, purchaseRows] = await Promise.all([
    regions.all(),
    doctors.all(),
    visits.all(),
    purchases.all(),
  ])
  const overviews = buildDoctorOverviews({
    doctors: doctorRows,
    regions: regionRows,
    visits: visitRows,
    purchases: purchaseRows,
    asOf: todayAsOf(),
    trendMonths: 3,
  })
  dispatch({ type: 'booted', regions: regionRows, doctors: doctorRows, overviews, visits: visitRows })
}

/**
 * Boots the app: opens the database, loads reference data and doctor-list
 * overviews, and transitions the shell from `loading` to `ready`. A failed open
 * lands in `error`, which the shell renders instead of a blank screen.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        await getDb().open()
        // Ask the browser not to evict IndexedDB under disk pressure (best
        // effort; may be denied). See ADR-006.
        if (navigator.storage?.persist) {
          try {
            await navigator.storage.persist()
          } catch {
            // Persistence is best-effort; continue regardless.
          }
        }
        if (cancelled) return
        await loadAll(dispatch)
      } catch (err) {
        if (!cancelled) {
          dispatch({
            type: 'failed',
            message: err instanceof Error ? err.message : 'Failed to open database',
          })
        }
      }
    }

    void boot()
    return () => {
      cancelled = true
    }
  }, [])

  const refreshOverviews = useCallback(async () => {
    await loadAll(dispatch)
  }, [])

  const value = useMemo(
    () => ({ state, dispatch, refreshOverviews }),
    [state, refreshOverviews],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider')
  }
  return ctx
}