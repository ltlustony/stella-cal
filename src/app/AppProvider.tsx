import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from 'react'
import { getDb } from '../data/db'
import { doctors, regions } from '../data/repositories'
import {
  appReducer,
  initialState,
  type AppAction,
  type AppState,
} from './state'

interface AppContextValue {
  state: AppState
  dispatch: (action: AppAction) => void
}

const AppContext = createContext<AppContextValue | null>(null)

/**
 * Boots the app: opens the database, loads reference data (regions, doctors),
 * and transitions the shell from `loading` to `ready`. A failed open lands in
 * `error`, which the shell renders instead of a blank screen.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)

  useEffect(() => {
    let cancelled = false

    async function boot() {
      try {
        await getDb().open()
        if (cancelled) return
        const [regionRows, doctorRows] = await Promise.all([
          regions.all(),
          doctors.all(),
        ])
        if (cancelled) return
        dispatch({ type: 'booted', regions: regionRows, doctors: doctorRows })
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

  const value = useMemo(() => ({ state, dispatch }), [state])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within AppProvider')
  }
  return ctx
}