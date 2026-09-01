import { useRef, useState, type ChangeEvent } from 'react'
import type { Visit } from '../domain/types'
import { useApp } from './AppProvider'
import {
  downloadVisitsBackup,
  getLastBackupAt,
  parseBackupFile,
  previewRestore,
  restoreVisits,
  setLastBackupAt,
} from '../data/backup'

interface SettingsViewProps {
  onBackedUp?: (timestamp: number) => void
  /** Starts the shell-level Excel import flow. */
  onStartImport?: () => void
  isImporting?: boolean
}

interface RestorePlan {
  visits: Visit[]
  added: number
  skipped: number
}

export function SettingsView({
  onBackedUp,
  onStartImport,
  isImporting = false,
}: SettingsViewProps) {
  const { state, refreshOverviews } = useApp()
  const restoreInputRef = useRef<HTMLInputElement | null>(null)

  const [backupAt, setBackupAt] = useState<number | null>(() => getLastBackupAt())
  const [backupMessage, setBackupMessage] = useState<string | null>(null)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const [plan, setPlan] = useState<RestorePlan | null>(null)
  const [restoreDone, setRestoreDone] = useState<string | null>(null)

  async function handleBackup() {
    setBackupMessage(null)
    try {
      await downloadVisitsBackup()
      const timestamp = Date.now()
      setLastBackupAt(timestamp)
      setBackupAt(timestamp)
      onBackedUp?.(timestamp)
      setBackupMessage(
        'Backup downloaded. Keep the file somewhere safe (e.g. Google Drive or iCloud).',
      )
    } catch {
      setBackupMessage('Could not create the backup file.')
    }
  }

  async function handleRestoreFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setRestoreError(null)
    setPlan(null)
    setRestoreDone(null)
    try {
      const visits = parseBackupFile(await file.text())
      const preview = await previewRestore(visits)
      setPlan({ visits, added: preview.added, skipped: preview.skipped })
    } catch (error) {
      setRestoreError(
        error instanceof Error ? error.message : 'Could not read the backup file.',
      )
    }
  }

  async function confirmRestore() {
    if (!plan) return
    setRestoreError(null)
    try {
      const result = await restoreVisits(plan.visits)
      setPlan(null)
      setRestoreDone(
        `${result.added} visit${result.added === 1 ? '' : 's'} restored. ` +
          `${result.skipped} already existed and were left untouched.`,
      )
      await refreshOverviews()
    } catch (error) {
      setRestoreError(error instanceof Error ? error.message : 'Restore failed.')
    }
  }

  const lastBackupLabel =
    backupAt === null ? 'Never' : new Date(backupAt).toLocaleString()

  return (
    <section className="space-y-5">
      <h2 className="text-lg font-medium">Settings</h2>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="font-medium">Import Excel</h3>
        <p className="mt-1 text-sm text-slate-400">
          Load your monthly Excel workbook to refresh doctors, regions, and
          purchase history. Visit records are never touched (ADR-003).
        </p>
        {onStartImport && (
          <button
            type="button"
            onClick={onStartImport}
            disabled={isImporting}
            className="mt-4 rounded-lg border border-teal-600 bg-teal-600/10 px-3 py-2 text-sm font-medium text-teal-200 transition hover:bg-teal-600/20 disabled:opacity-50"
          >
            {isImporting ? 'Importing…' : 'Import Excel'}
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="font-medium">Back up visit records</h3>
        <p className="mt-1 text-sm text-slate-400">
          Visit records are the only data that can't be rebuilt from the Excel
          file. Download a backup JSON file and keep it somewhere durable.
        </p>
        <dl className="mt-3 text-sm text-slate-300">
          <div className="flex justify-between">
            <dt className="text-slate-500">Visits stored</dt>
            <dd className="font-medium text-teal-300">{state.visits.length}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-500">Last backup</dt>
            <dd className="font-medium">{lastBackupLabel}</dd>
          </div>
        </dl>
        <button
          type="button"
          onClick={handleBackup}
          className="mt-4 rounded-lg border border-teal-600 bg-teal-600/10 px-3 py-2 text-sm font-medium text-teal-200 transition hover:bg-teal-600/20"
        >
          Download backup
        </button>
        {backupMessage && (
          <p className="mt-3 text-sm text-teal-300">{backupMessage}</p>
        )}
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5">
        <h3 className="font-medium">Restore from backup</h3>
        <p className="mt-1 text-sm text-slate-400">
          Load a backup file. Existing visits are never overwritten — only new
          ones are added.
        </p>
        <button
          type="button"
          onClick={() => restoreInputRef.current?.click()}
          className="mt-4 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-sm font-medium text-slate-200 transition hover:bg-slate-700/60"
        >
          Choose backup file…
        </button>
        <input
          ref={restoreInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={handleRestoreFile}
        />

        {restoreError && (
          <p className="mt-3 text-sm text-red-300">{restoreError}</p>
        )}

        {plan && (
          <div className="mt-4 rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-200">
            <p className="font-medium text-teal-300">Ready to restore</p>
            <ul className="mt-2 space-y-1">
              <li>
                {plan.added} new visit{plan.added === 1 ? '' : 's'} will be added
              </li>
              <li>
                {plan.skipped} already exist{plan.skipped === 1 ? 's' : ''} and
                will be skipped
              </li>
            </ul>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={confirmRestore}
                className="rounded-lg border border-teal-600 bg-teal-600/10 px-3 py-2 text-sm font-medium text-teal-200 transition hover:bg-teal-600/20"
              >
                Restore
              </button>
              <button
                type="button"
                onClick={() => setPlan(null)}
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-300 transition hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {restoreDone && (
          <p className="mt-3 text-sm text-teal-300">{restoreDone}</p>
        )}
      </div>
    </section>
  )
}