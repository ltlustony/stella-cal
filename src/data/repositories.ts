import type { Doctor, Purchase, Region, Visit } from '../domain/types'
import { getDb } from './db'

/**
 * Data-access layer — the single boundary between app logic and storage.
 * Every read/write goes through a repository function here; no other module
 * touches Dexie.
 */

export const regions = {
  async upsert(name: string): Promise<Region> {
    return getDb().transaction('rw', getDb().regions, async () => {
      const existing = await getDb().regions.where('name').equals(name).first()
      if (existing) return { ...existing }
      const id = await getDb().regions.add({ name })
      return { id, name }
    })
  },

  async all(): Promise<Region[]> {
    return getDb().regions.toArray()
  },
}

export const doctors = {
  async upsert(name: string, regionId: number): Promise<Doctor> {
    return getDb().transaction('rw', getDb().doctors, async () => {
      const existing = await getDb().doctors.where('name').equals(name).first()
      if (existing) {
        if (existing.regionId !== regionId) {
          await getDb().doctors.update(existing.id!, { regionId })
          existing.regionId = regionId
        }
        return { ...existing, id: existing.id, name: existing.name }
      }
      const id = await getDb().doctors.add({ name, regionId })
      return { id, name, regionId }
    })
  },

  async all(): Promise<Doctor[]> {
    return getDb().doctors.toArray()
  },

  async byRegion(regionId: number): Promise<Doctor[]> {
    return getDb().doctors.where('regionId').equals(regionId).toArray()
  },
}

export const purchases = {
  /**
   * Full replacement: clears all purchase records and bulk-inserts the new
   * set. Returns the number of inserted records. Visits are untouched.
   */
  async replaceAll(records: Omit<Purchase, 'id'>[]): Promise<number> {
    await getDb().transaction('rw', getDb().purchases, async () => {
      await getDb().purchases.clear()
      await getDb().purchases.bulkAdd(records)
    })
    return records.length
  },

  async all(): Promise<Purchase[]> {
    return getDb().purchases.toArray()
  },

  async byDoctor(doctorId: number): Promise<Purchase[]> {
    return getDb().purchases.where('doctorId').equals(doctorId).toArray()
  },

  async byDoctorYearMonth(
    doctorId: number,
    year: number,
    month: number,
  ): Promise<Purchase[]> {
    return getDb().purchases
      .where('[doctorId+year+month]')
      .equals([doctorId, year, month])
      .toArray()
  },
}

export function planVisitMerge(
  existing: Visit[],
  incoming: Visit[],
): { toAdd: Visit[]; skipped: number } {
  const existingIds = new Set<number>()
  for (const v of existing) {
    if (v.id !== undefined) existingIds.add(v.id)
  }
  const toAdd: Visit[] = []
  let skipped = 0
  for (const v of incoming) {
    if (v.id !== undefined && existingIds.has(v.id)) {
      skipped += 1
    } else {
      // Preserve the record id so a re-import of the same backup is
      // idempotent. The browser's key generator advances past explicit ids,
      // so later auto-increment inserts won't collide.
      toAdd.push(v)
    }
  }
  return { toAdd, skipped }
}

export const visits = {
  async add(visit: Omit<Visit, 'id'>): Promise<Visit> {
    const id = await getDb().visits.add(visit)
    return { ...visit, id }
  },

  /**
   * Merge a backup set into the store: add only records whose `id` isn't
   * already present (idempotent, never overwrites). Returns added/skipped
   * counts.
   */
  async restore(incoming: Visit[]): Promise<{ added: number; skipped: number }> {
    const existing = await getDb().visits.toArray()
    const { toAdd, skipped } = planVisitMerge(existing, incoming)
    if (toAdd.length > 0) {
      await getDb().visits.bulkPut(toAdd)
    }
    return { added: toAdd.length, skipped }
  },

  async update(id: number, changes: Omit<Visit, 'id'>): Promise<void> {
    await getDb().visits.update(id, changes)
  },

  async remove(id: number): Promise<void> {
    await getDb().visits.delete(id)
  },

  async all(): Promise<Visit[]> {
    return getDb().visits.toArray()
  },

  async byDate(date: string): Promise<Visit[]> {
    return getDb().visits.where('date').equals(date).toArray()
  },

  async byDateRange(start: string, end: string): Promise<Visit[]> {
    return getDb().visits.where('date').between(start, end, true, true).toArray()
  },
}