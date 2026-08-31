import type { DoctorOverview } from '../domain/derived'
import type { Doctor, Region, Visit } from '../domain/types'

/**
 * App state, held in a single reducer. `status` drives the boot/empty/ready
 * shell transitions described in issue 01.
 */
export interface AppState {
  status: 'loading' | 'ready' | 'error'
  error?: string
  regions: Region[]
  doctors: Doctor[]
  overviews: DoctorOverview[]
  visits: Visit[]
}

export type AppAction =
  | {
      type: 'booted'
      regions: Region[]
      doctors: Doctor[]
      overviews: DoctorOverview[]
      visits: Visit[]
    }
  | { type: 'failed'; message: string }

export const initialState: AppState = {
  status: 'loading',
  regions: [],
  doctors: [],
  overviews: [],
  visits: [],
}

/**
 * UI-only reducer. It does not read or write storage directly — data changes
 * flow through the repositories, and the reducer simply reflects boot status,
 * reference data, and the doctor-list overviews.
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'booted':
      return {
        status: 'ready',
        regions: action.regions,
        doctors: action.doctors,
        overviews: action.overviews,
        visits: action.visits,
      }
    case 'failed':
      return { ...state, status: 'error', error: action.message }
  }
}