import type { Visit } from '../domain/types'
import { planVisitMerge, visits } from './repositories'

const BACKUP_VERSION = 1
const BACKUP_KIND = 'stella-cal-visits'
const LAST_BACKUP_KEY = 'stella-cal:lastBackupAt'
const REMINDER_MS = 7 * 24 * 60 * 60 * 1000

/**
 * The on-disk shape of a visit backup file. Visit records are the only
 * irreplaceable data in the app (purchases can always be re-imported from the
 * monthly Excel, see ADR-003), so backups carry visits only.
 */
export interface BackupFile {
  version: number
  kind: string
  exportedAt: string
  visits: Visit[]
}

export interface RestorePreview {
  added: number
  skipped: number
  total: number
}

export function buildBackupFile(
  visits: Visit[],
  exportedAt = new Date().toISOString(),
): BackupFile {
  return { version: BACKUP_VERSION, kind: BACKUP_KIND, exportedAt, visits }
}

export async function exportVisitsToJson(): Promise<string> {
  const rows = await visits.all()
  return JSON.stringify(buildBackupFile(rows), null, 2)
}

export function backupFilename(now = new Date()): string {
  const date = now.toISOString().slice(0, 10)
  return `stella-cal-visits-${date}.json`
}

export function downloadText(
  filename: string,
  text: string,
  mime = 'application/json',
): void {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export async function downloadVisitsBackup(): Promise<void> {
  const json = await exportVisitsToJson()
  downloadText(backupFilename(), json)
}

function isVisit(value: unknown): value is Visit {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.doctorId === 'number' &&
    typeof v.date === 'string' &&
    typeof v.notes === 'string' &&
    typeof v.outcome === 'string' &&
    typeof v.orderPlaced === 'boolean'
  )
}

export function parseBackupFile(text: string): Visit[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('This file is not valid JSON.')
  }

  if (typeof parsed !== 'object' || parsed === null) {
    throw new Error('This file is not a Stella-Cal backup.')
  }

  const file = parsed as Partial<BackupFile>
  if (file.version !== BACKUP_VERSION || file.kind !== BACKUP_KIND) {
    throw new Error('This file is not a Stella-Cal visit backup.')
  }

  if (!Array.isArray(file.visits) || !file.visits.every(isVisit)) {
    throw new Error('This backup contains no valid visit records.')
  }

  return file.visits
}

export async function previewRestore(incoming: Visit[]): Promise<RestorePreview> {
  const existing = await visits.all()
  const { toAdd, skipped } = planVisitMerge(existing, incoming)
  return { added: toAdd.length, skipped, total: incoming.length }
}

export async function restoreVisits(incoming: Visit[]): Promise<RestorePreview> {
  const { added, skipped } = await visits.restore(incoming)
  return { added, skipped, total: incoming.length }
}

export function getLastBackupAt(): number | null {
  if (typeof localStorage === 'undefined') return null
  const raw = localStorage.getItem(LAST_BACKUP_KEY)
  const value = raw === null ? NaN : Number(raw)
  return Number.isFinite(value) ? value : null
}

export function setLastBackupAt(timestamp = Date.now()): void {
  if (typeof localStorage === 'undefined') return
  localStorage.setItem(LAST_BACKUP_KEY, String(timestamp))
}

export function isBackupOverdue(
  lastBackupAt: number | null,
  now = Date.now(),
): boolean {
  if (lastBackupAt === null) return true
  return now - lastBackupAt > REMINDER_MS
}