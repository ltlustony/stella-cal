import { describe, expect, it } from 'vitest'
import * as XLSX from 'xlsx'
import { parseExcelWorkbook, validateWorkbookStructure } from './excelImport'

function makeSheet(rows: unknown[][]) {
  const sheet = XLSX.utils.aoa_to_sheet(rows)
  return sheet
}

describe('Excel import parsing', () => {
  it('validates the workbook structure before import', () => {
    const sheet = makeSheet([
      ['Sum of Quantity'],
      [2018, 2019, 2020, 2021, 2022],
      ['地區說明', '客戶簡稱', 'Basic Quantity', 'Product', 'Dosage', null, null, null, null, 1, 2],
      ['九龍塘', '陳醫生診所', 30, 'Actein', '600mg', null, null, null, null, 10, null],
    ])

    expect(() => validateWorkbookStructure(sheet)).not.toThrow()
  })

  it('un-pivots a workbook and carries forward blank region/doctor names', async () => {
    const sheet = makeSheet([
      ['Sum of Quantity'],
      [2018, 2019, 2020, 2021, 2022, null, null, null, null, null, null, null],
      ['地區說明', '客戶簡稱', 'Basic Quantity', 'Product', 'Dosage', null, null, null, null, 1, 2, 3],
      ['九龍塘', '陳醫生診所', 30, 'Actein', '600mg', null, null, null, null, 10, null, 8],
      [null, null, 100, 'Musolax', '200mg', null, null, null, null, null, 5, null],
      ['總計', null, null, null, null, 18, 0, 0, 0, 0, 0, 0],
    ])

    const result = await parseExcelWorkbook(sheet)

    expect(result.summary.regions).toBe(1)
    expect(result.summary.doctors).toBe(1)
    expect(result.summary.purchases).toBe(3)
    expect(result.purchases).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ product: 'Actein', year: 2022, month: 1, quantity: 10 }),
        expect.objectContaining({ product: 'Actein', year: 2022, month: 3, quantity: 8 }),
        expect.objectContaining({ product: 'Musolax', year: 2022, month: 2, quantity: 5 }),
      ]),
    )
  })
})
