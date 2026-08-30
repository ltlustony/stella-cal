import { beforeEach, describe, expect, it } from 'vitest'
import Dexie from 'dexie'
import { resetDbForTests } from '../data/db'
import { doctors, purchases, regions, visits } from '../data/repositories'

/**
 * Repository tests run against a real Dexie instance backed by
 * fake-indexeddb (the system-boundary test double for IndexedDB).
 */
beforeEach(async () => {
  resetDbForTests()
  await Dexie.delete('stella-cal')
})

describe('regions repository', () => {
  it('upsert merges duplicate names into a single region', async () => {
    const a = await regions.upsert('九龍塘')
    const b = await regions.upsert('九龍塘')

    expect(a.id).toBe(b.id)
    expect(await regions.all()).toHaveLength(1)
  })
})

describe('doctors repository', () => {
  it('upsert dedupes doctors by name', async () => {
    const region = await regions.upsert('九龍塘')

    const d1 = await doctors.upsert('陳醫生診所', region.id!)
    const d2 = await doctors.upsert('陳醫生診所', region.id!)

    expect(d1.id).toBe(d2.id)
    expect(await doctors.all()).toHaveLength(1)
  })

  it('byRegion returns only that region\'s doctors', async () => {
    const r1 = await regions.upsert('九龍塘')
    const r2 = await regions.upsert('北角')

    await doctors.upsert('陳醫生診所', r1.id!)
    await doctors.upsert('李醫生', r1.id!)
    await doctors.upsert('王醫生', r2.id!)

    const klnDoctors = await doctors.byRegion(r1.id!)
    expect(klnDoctors.map((d) => d.name).sort()).toEqual(['李醫生', '陳醫生診所'])
    expect(await doctors.byRegion(r2.id!)).toHaveLength(1)
  })
})

describe('purchases repository', () => {
  it('replaceAll clears old purchases and inserts the new set', async () => {
    const region = await regions.upsert('九龍塘')
    const doctor = await doctors.upsert('陳醫生診所', region.id!)

    await purchases.replaceAll([
      { doctorId: doctor.id!, regionId: region.id!, product: 'Actein', dosage: '600mg', basicQty: 30, year: 2024, month: 3, quantity: 30 },
    ])

    const count = await purchases.replaceAll([
      { doctorId: doctor.id!, regionId: region.id!, product: 'Musolax', dosage: '200mg', basicQty: 100, year: 2024, month: 4, quantity: 100 },
    ])

    expect(count).toBe(1)
    const all = await purchases.all()
    expect(all).toHaveLength(1)
    expect(all[0].product).toBe('Musolax')
  })

  it('full replacement preserves visits', async () => {
    const region = await regions.upsert('九龍塘')
    const doctor = await doctors.upsert('陳醫生診所', region.id!)

    await visits.add({
      doctorId: doctor.id!,
      date: '2024-03-05',
      notes: 'first visit',
      outcome: 'Order placed',
      orderPlaced: true,
    })
    await purchases.replaceAll([
      { doctorId: doctor.id!, regionId: region.id!, product: 'Actein', dosage: '600mg', basicQty: 30, year: 2024, month: 3, quantity: 30 },
    ])

    await purchases.replaceAll([
      { doctorId: doctor.id!, regionId: region.id!, product: 'Azetin', dosage: 'N/A', basicQty: 60, year: 2025, month: 1, quantity: 120 },
    ])

    const keptVisits = await visits.all()
    expect(keptVisits).toHaveLength(1)
    expect(keptVisits[0].notes).toBe('first visit')

    const keptPurchases = await purchases.all()
    expect(keptPurchases).toHaveLength(1)
    expect(keptPurchases[0].product).toBe('Azetin')
  })

  it('byDoctor and byDoctorYearMonth query via the composite index', async () => {
    const region = await regions.upsert('九龍塘')
    const d1 = await doctors.upsert('陳醫生診所', region.id!)
    const d2 = await doctors.upsert('李醫生', region.id!)

    await purchases.replaceAll([
      { doctorId: d1.id!, regionId: region.id!, product: 'Actein', dosage: '600mg', basicQty: 30, year: 2024, month: 3, quantity: 30 },
      { doctorId: d1.id!, regionId: region.id!, product: 'Actein', dosage: '600mg', basicQty: 30, year: 2024, month: 4, quantity: 40 },
      { doctorId: d2.id!, regionId: region.id!, product: 'Actein', dosage: '600mg', basicQty: 30, year: 2024, month: 3, quantity: 5 },
    ])

    expect(await purchases.byDoctor(d1.id!)).toHaveLength(2)

    const march = await purchases.byDoctorYearMonth(d1.id!, 2024, 3)
    expect(march).toHaveLength(1)
    expect(march[0].quantity).toBe(30)
  })
})

describe('visits repository', () => {
  it('byDateRange returns visits within an inclusive window', async () => {
    const region = await regions.upsert('九龍塘')
    const doctor = await doctors.upsert('陳醫生診所', region.id!)

    await visits.add({ doctorId: doctor.id!, date: '2024-03-05', notes: 'a', outcome: '', orderPlaced: false })
    await visits.add({ doctorId: doctor.id!, date: '2024-03-20', notes: 'b', outcome: '', orderPlaced: false })
    await visits.add({ doctorId: doctor.id!, date: '2024-04-02', notes: 'c', outcome: '', orderPlaced: true })

    const march = await visits.byDateRange('2024-03-01', '2024-03-31')
    expect(march).toHaveLength(2)
  })

  it('update replaces an existing visit in place, keeping its id', async () => {
    const region = await regions.upsert('九龍塘')
    const doctor = await doctors.upsert('陳醫生診所', region.id!)

    const before = await visits.add({ doctorId: doctor.id!, date: '2024-03-05', notes: 'a', outcome: 'No interest', orderPlaced: false })

    await visits.update(before.id!, {
      ...before,
      outcome: 'Order placed',
      orderPlaced: true,
      followUpDate: '2024-04-01',
    })

    const all = await visits.all()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(before.id)
    expect(all[0].outcome).toBe('Order placed')
    expect(all[0].orderPlaced).toBe(true)
    expect(all[0].followUpDate).toBe('2024-04-01')
  })

  it('remove deletes a visit by id, leaving other visits intact', async () => {
    const region = await regions.upsert('九龍塘')
    const doctor = await doctors.upsert('陳醫生診所', region.id!)

    const keep = await visits.add({ doctorId: doctor.id!, date: '2024-03-05', notes: 'keep', outcome: '', orderPlaced: false })
    const drop = await visits.add({ doctorId: doctor.id!, date: '2024-03-20', notes: 'drop', outcome: '', orderPlaced: false })

    await visits.remove(drop.id!)

    const all = await visits.all()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(keep.id)
  })

  it('byDate returns all visits on a single day', async () => {
    const region = await regions.upsert('九龍塘')
    const doctor = await doctors.upsert('陳醫生診所', region.id!)

    await visits.add({ doctorId: doctor.id!, date: '2024-03-05', notes: 'a', outcome: '', orderPlaced: false })
    await visits.add({ doctorId: doctor.id!, date: '2024-03-05', notes: 'b', outcome: '', orderPlaced: false })
    await visits.add({ doctorId: doctor.id!, date: '2024-03-06', notes: 'c', outcome: '', orderPlaced: false })

    const onFifth = await visits.byDate('2024-03-05')
    expect(onFifth).toHaveLength(2)
  })
})