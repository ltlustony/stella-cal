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

export const visits = {
  async add(visit: Omit<Visit, 'id'>): Promise<Visit> {
    const id = await getDb().visits.add(visit)
    return { ...visit, id }
  },

  async all(): Promise<Visit[]> {
    return getDb().visits.toArray()
  },

  async byDateRange(start: string, end: string): Promise<Visit[]> {
    return getDb().visits.where('date').between(start, end, true, true).toArray()
  },
}