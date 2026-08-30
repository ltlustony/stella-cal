import * as XLSX from 'xlsx'
import type { Purchase } from '../domain/types'
import { doctors, purchases, regions } from './repositories'

export interface ParsedPurchaseRow {
  region: string
  doctor: string
  product: string
  dosage: string
  basicQty: number
  year: number
  month: number
  quantity: number
}

export interface ExcelImportSummary {
  regions: number
  doctors: number
  purchases: number
}

export interface ParsedWorkbookResult {
  purchases: ParsedPurchaseRow[]
  summary: ExcelImportSummary
}

function toText(value: unknown): string {
  return String(value ?? '').trim()
}

function toNumber(value: unknown): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function isGrandTotalRow(row: unknown[] | undefined): boolean {
  if (!row) return false
  const first = toText(row[0])
  return first === '總計' || first.toLowerCase().includes('total')
}

function resolveYearMonthForExcelColumn(columnNumber: number): { year: number; month: number } {
  if (columnNumber >= 6 && columnNumber <= 9) {
    return { year: 2018 + (columnNumber - 6), month: 0 }
  }

  if (columnNumber >= 10 && columnNumber <= 21) {
    return { year: 2022, month: columnNumber - 9 }
  }

  if (columnNumber >= 22 && columnNumber <= 33) {
    return { year: 2023, month: columnNumber - 21 }
  }

  if (columnNumber >= 34 && columnNumber <= 45) {
    return { year: 2024, month: columnNumber - 33 }
  }

  if (columnNumber >= 46 && columnNumber <= 57) {
    return { year: 2025, month: columnNumber - 45 }
  }

  if (columnNumber >= 58 && columnNumber <= 64) {
    return { year: 2026, month: columnNumber - 57 }
  }

  return { year: 0, month: 0 }
}

export function validateWorkbookStructure(sheet: XLSX.WorkSheet): void {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
  }) as unknown[][]

  if (rows.length < 3) {
    throw new Error('The workbook is missing the required header rows.')
  }

  const titleRow = rows[0] ?? []
  if (toText(titleRow[0]).toLowerCase() !== 'sum of quantity') {
    throw new Error('Expected the first row to start with "Sum of Quantity".')
  }

  const headerRow = rows[2] ?? []
  const required = ['地區說明', '客戶簡稱', 'Basic Quantity', 'Product', 'Dosage']

  for (let index = 0; index < required.length; index += 1) {
    if (toText(headerRow[index]) !== required[index]) {
      throw new Error(`Expected column ${index + 1} to be "${required[index]}".`)
    }
  }

  const hasYearColumns = headerRow.some((cell, index) => index >= 5 && Number.isFinite(Number(cell)))
  if (!hasYearColumns) {
    throw new Error('The workbook does not contain the expected year/month columns.')
  }
}

export async function parseExcelWorkbook(sheet: XLSX.WorkSheet): Promise<ParsedWorkbookResult> {
  const rows = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    raw: false,
    blankrows: false,
  }) as unknown[][]

  const dataset = [...rows.slice(3)]
  const lastRow = dataset[dataset.length - 1]
  if (lastRow && isGrandTotalRow(lastRow)) {
    dataset.pop()
  }

  let currentRegion = ''
  let currentDoctor = ''
  const purchases: ParsedPurchaseRow[] = []

  for (const row of dataset) {
    if (!Array.isArray(row) || row.length === 0) continue

    const rawRegion = toText(row[0])
    const rawDoctor = toText(row[1])
    const product = toText(row[3])
    const dosage = toText(row[4])

    const nextRegion = rawRegion || currentRegion
    const nextDoctor = rawDoctor || currentDoctor

    if (!nextRegion || !nextDoctor || !product) {
      continue
    }

    currentRegion = nextRegion
    currentDoctor = nextDoctor

    const basicQty = toNumber(row[2])

    for (let columnIndex = 5; columnIndex < row.length; columnIndex += 1) {
      const cellValue = row[columnIndex]
      if (cellValue === null || cellValue === undefined || cellValue === '') {
        continue
      }

      const quantity = Number(cellValue)
      if (!Number.isFinite(quantity) || quantity === 0) {
        continue
      }

      const excelColumn = columnIndex + 1
      const { year, month } = resolveYearMonthForExcelColumn(excelColumn)
      if (year === 0 || month === 0 && excelColumn < 6) {
        continue
      }

      purchases.push({
        region: nextRegion,
        doctor: nextDoctor,
        product,
        dosage,
        basicQty,
        year,
        month,
        quantity,
      })
    }
  }

  const uniqueRegions = new Set(purchases.map((item) => item.region))
  const uniqueDoctors = new Set(
    purchases.map((item) => `${item.region}::${item.doctor}`),
  )

  return {
    purchases,
    summary: {
      regions: uniqueRegions.size,
      doctors: uniqueDoctors.size,
      purchases: purchases.length,
    },
  }
}

export async function importWorkbookFromArrayBuffer(buffer: ArrayBuffer): Promise<{ summary: ExcelImportSummary }> {
  const workbook = XLSX.read(buffer, { type: 'array', raw: false })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]

  if (!sheet) {
    throw new Error('The uploaded file does not contain a readable worksheet.')
  }

  validateWorkbookStructure(sheet)
  const parsed = await parseExcelWorkbook(sheet)

  const regionMap = new Map<string, number>()
  for (const name of [...new Set(parsed.purchases.map((row) => row.region))]) {
    const region = await regions.upsert(name)
    regionMap.set(name, region.id!)
  }

  const doctorMap = new Map<string, number>()
  for (const doctorName of [...new Set(parsed.purchases.map((row) => `${row.region}::${row.doctor}`))]) {
    const [regionName, name] = doctorName.split('::')
    const regionId = regionMap.get(regionName)
    if (!regionId) continue

    const doctor = await doctors.upsert(name, regionId)
    doctorMap.set(doctorName, doctor.id!)
  }

  const replacementRecords: Omit<Purchase, 'id'>[] = parsed.purchases.map((entry) => ({
    doctorId: doctorMap.get(`${entry.region}::${entry.doctor}`) ?? 0,
    regionId: regionMap.get(entry.region) ?? 0,
    product: entry.product,
    dosage: entry.dosage,
    basicQty: entry.basicQty,
    year: entry.year,
    month: entry.month,
    quantity: entry.quantity,
  }))

  await purchases.replaceAll(replacementRecords)

  return { summary: parsed.summary }
}

export async function importWorkbookFromFile(file: File): Promise<{ summary: ExcelImportSummary }> {
  if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
    throw new Error('Please select an Excel file (.xlsx or .xls).')
  }

  const buffer = await file.arrayBuffer()
  return importWorkbookFromArrayBuffer(buffer)
}
