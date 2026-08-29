import Dexie, { type EntityTable } from 'dexie'
import type { Doctor, Purchase, Region, Visit } from '../domain/types'

/**
 * The IndexedDB schema. This is the storage boundary for the whole app: no
 * module outside `src/data` touches Dexie directly.
 *
 * Index design (per spec ADR-002 / issue 01):
 * - regions   — `name` unique
 * - doctors   — indexed by `regionId`
 * - purchases — indexed by `[doctorId+year+month]`
 * - visits    — indexed by `date`
 */
export class StellaCalDB extends Dexie {
  regions!: EntityTable<Region, 'id'>
  doctors!: EntityTable<Doctor, 'id'>
  purchases!: EntityTable<Purchase, 'id'>
  visits!: EntityTable<Visit, 'id'>

  constructor(name = 'stella-cal') {
    super(name)
    this.version(1).stores({
      regions: '++id, &name',
      doctors: '++id, name, regionId',
      purchases: '++id, doctorId, [doctorId+year+month]',
      visits: '++id, date',
    })
  }
}

let db: StellaCalDB | undefined

/**
 * Singleton access to the app database, lazily opened on first use.
 */
export function getDb(): StellaCalDB {
  if (!db) {
    db = new StellaCalDB()
  }
  return db
}

/**
 * Test-only helper: close and drop the cached instance so the next `getDb()`
 * builds a fresh database against a clean fake-indexeddb store.
 */
export function resetDbForTests(): void {
  if (db) {
    db.close()
    db = undefined
  }
}