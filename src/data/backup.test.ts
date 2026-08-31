import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import type { Visit } from '../domain/types'
import { resetDbForTests } from './db'
import { doctors, regions, visits } from './repositories'
import {
  buildBackupFile,
  isBackupOverdue,
  parseBackupFile,
  previewRestore,
  restoreVisits,
} from './backup'

beforeEach(async () => {
  resetDbForTests()
  await Dexie.delete('stella-cal')
})

describe('backup file format', () => {
  it('round-trips visits via buildBackupFile and parseBackupFile', async () => {
    const region = await regions.upsert('九龍塘')
    const doctor = await doctors.upsert('陳醫生診所', region.id!)
    const visit = await visits.add({
      doctorId: doctor.id!,
      date: '2024-03-05',
      notes: 'discussed new product',
      outcome: 'Order placed',
      followUpDate: '2024-04-01',
      orderPlaced: true,
      orderProduct: 'Actein',
    })

    const json = JSON.stringify(
      buildBackupFile(await visits.all(), '2024-03-06T00:00:00.000Z'),
    )
    const parsed = parseBackupFile(json)

    expect(parsed).toHaveLength(1)
    expect(parsed[0].id).toBe(visit.id)
    expect(parsed[0].notes).toBe('discussed new product')
  })

  it('rejects JSON that is not a backup file', () => {
    expect(() => parseBackupFile('{"foo": 1}')).toThrow(/not a Stella-Cal/)
  })

  it('rejects malformed JSON', () => {
    expect(() => parseBackupFile('not json')).toThrow(/valid JSON/)
  })

  it('rejects a backup containing invalid visit records', () => {
    const bad = {
      version: 1,
      kind: 'stella-cal-visits',
      exportedAt: 'x',
      visits: [{ doctorId: 'not-a-number' }],
    }
    expect(() => parseBackupFile(JSON.stringify(bad))).toThrow(
      /no valid visit records/,
    )
  })
})

describe('restore merge', () => {
  it('adds new visits and never overwrites existing ones by id', async () => {
    const region = await regions.upsert('九龍塘')
    const doctor = await doctors.upsert('陳醫生診所', region.id!)
    const original = await visits.add({
      doctorId: doctor.id!,
      date: '2024-03-05',
      notes: 'original',
      outcome: 'Order placed',
      orderPlaced: true,
    })

    const incoming: Visit[] = [
      { ...original, notes: 'changed in backup' },
      {
        id: 999,
        doctorId: doctor.id!,
        date: '2024-03-06',
        notes: 'new',
        outcome: 'No interest',
        orderPlaced: false,
      },
    ]

    const preview = await previewRestore(incoming)
    expect(preview).toEqual({ added: 1, skipped: 1, total: 2 })

    const result = await restoreVisits(incoming)
    expect(result).toEqual({ added: 1, skipped: 1, total: 2 })

    const all = await visits.all()
    expect(all).toHaveLength(2)
    expect(all.find((v) => v.id === original.id)?.notes).toBe('original')
    expect(all.find((v) => v.notes === 'new')).toBeDefined()
  })

  it('is idempotent: restoring the same backup twice changes nothing', async () => {
    const incoming: Visit[] = [
      {
        id: 10,
        doctorId: 1,
        date: '2024-03-05',
        notes: 'a',
        outcome: '',
        orderPlaced: false,
      },
    ]

    const first = await restoreVisits(incoming)
    expect(first).toEqual({ added: 1, skipped: 0, total: 1 })

    const second = await restoreVisits(incoming)
    expect(second).toEqual({ added: 0, skipped: 1, total: 1 })

    expect(await visits.all()).toHaveLength(1)
  })
})

describe('backup reminder', () => {
  it('flags overdue when never backed up or older than 7 days', () => {
    expect(isBackupOverdue(null)).toBe(true)

    const now = Date.now()
    const dayMs = 24 * 60 * 60 * 1000
    expect(isBackupOverdue(now - 8 * dayMs, now)).toBe(true)
    expect(isBackupOverdue(now - 6 * dayMs, now)).toBe(false)
  })
})