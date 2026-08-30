import type { Doctor, Visit } from './types'

/** One cell of a month grid. `inCurrentMonth === false` marks a padding day. */
export interface CalendarCell {
  /** ISO date string, `YYYY-MM-DD`. */
  date: string
  /** Day of month (1–31) — always the cell's real calendar day. */
  day: number
  /** Whether this cell belongs to the requested month (vs a padding day). */
  inCurrentMonth: boolean
}

/** A doctor shown on a visited day. */
export interface DoctorLabel {
  doctorId: number
  doctorName: string
}

/** The day-of-week column to start the grid on. 1 = Monday (ISO-style). */
const WEEK_START = 1

/** Formats a Date as a local `YYYY-MM-DD` string (no UTC drift). */
export function toISODate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const DAYS_IN_WEEK = 7

/**
 * Builds a monthly grid padded with leading/trailing days from adjacent months
 * so every row is full. Weeks start on Monday. The grid is trimmed to the
 * minimal number of full rows (weeks) the month spans — 4, 5 or 6 rows — so a
 * month that starts on Monday and needs no trailing fill renders no blank rows.
 * Pure — a function of `(year, month)` only.
 */
export function buildMonthGrid(year: number, month: number): CalendarCell[] {
  const first = new Date(year, month - 1, 1)
  const daysInMonth = new Date(year, month, 0).getDate()

  const offsetFromMonday = (first.getDay() - WEEK_START + DAYS_IN_WEEK) % DAYS_IN_WEEK
  const firstCell = new Date(year, month - 1, 1 - offsetFromMonday)
  const cellCount = Math.ceil((offsetFromMonday + daysInMonth) / DAYS_IN_WEEK) * DAYS_IN_WEEK

  const cells: CalendarCell[] = []
  const cursor = new Date(firstCell)

  for (let i = 0; i < cellCount; i += 1) {
    cells.push({
      date: toISODate(cursor),
      day: cursor.getDate(),
      inCurrentMonth: cursor.getMonth() === month - 1 && cursor.getFullYear() === year,
    })
    cursor.setDate(cursor.getDate() + 1)
  }

  return cells
}

/**
 * Groups visits by date, resolving each visit's doctor name and region so the
 * calendar can render doctor labels. Visits whose doctor is no longer present
 * are dropped. Stable ordering follows the input visits array.
 */
export function groupVisitsByDate(
  visits: Visit[],
  doctors: Doctor[],
): Map<string, DoctorLabel[]> {
  const doctorById = new Map<number, Doctor>()
  for (const doctor of doctors) {
    if (doctor.id !== undefined) doctorById.set(doctor.id, doctor)
  }

  const byDate = new Map<string, DoctorLabel[]>()
  for (const visit of visits) {
    const doctor = doctorById.get(visit.doctorId)
    if (!doctor || doctor.id === undefined) continue

    const list = byDate.get(visit.date) ?? []
    list.push({
      doctorId: doctor.id,
      doctorName: doctor.name,
    })
    byDate.set(visit.date, list)
  }
  return byDate
}