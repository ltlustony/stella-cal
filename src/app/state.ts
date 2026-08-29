import type { Doctor, Region } from '../domain/types'

/**
 * App state, held in a single reducer. `status` drives the boot/empty/ready
 * shell transitions described in issue 01.
 */
export interface AppState {
  status: 'loading' | 'ready' | 'error'
  error?: string
  regions: Region[]
  doctors: Doctor[]
}

export type AppAction =
  | { type: 'booted'; regions: Region[]; doctors: Doctor[] }
  | { type: 'failed'; message: string }

export const initialState: AppState = {
  status: 'loading',
  regions: [],
  doctors: [],
}

/**
 * UI-only reducer. It does not read or write storage directly — data changes
 * flow through the repositories, and the reducer simply reflects boot status
 * and reference data.
 */
export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'booted':
      return {
        status: 'ready',
        regions: action.regions,
        doctors: action.doctors,
      }
    case 'failed':
      return { ...state, status: 'error', error: action.message }
  }
}