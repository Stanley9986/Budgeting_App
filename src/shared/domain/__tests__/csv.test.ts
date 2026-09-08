import { describe, expect, it } from 'vitest'
import { importCsv, isDuplicate, parseCsv, parseDate } from '../csv'

describe('parseCsv', () => {
  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseCsv('a,b\n"Diner, Deli","said ""hi"""')
    expect(rows[1]).toEqual(['Diner, Deli', 'said "hi"'])
  })

  it('handles CRLF and skips blank lines', () => {
    expect(parseCsv('a,b\r\n1,2\r\n\r\n3,4\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
      ['3', '4']
    ])
  })
})

describe('parseDate', () => {
  it('accepts ISO', () => expect(parseDate('2026-03-04')).toBe('2026-03-04'))
  it('accepts US slashes', () => expect(parseDate('3/4/2026')).toBe('2026-03-04'))
  it('accepts two-digit years', () => expect(parseDate('03/04/26')).toBe('2026-03-04'))
  it('rejects nonsense', () => expect(parseDate('not a date')).toBe(null))
})

describe('importCsv', () => {
  it('reads a single signed amount column', () => {
    const csv = ['Date,Description,Amount', '2026-01-04,Coffee,-4.50', '2026-01-05,Paycheck,2000'].join('\n')
    const result = importCsv(csv)
    expect(result.transactions).toHaveLength(2)
    expect(result.transactions[0]).toMatchObject({ amount: 4.5, kind: 'expense', description: 'Coffee' })
    expect(result.transactions[1]).toMatchObject({ amount: 2000, kind: 'income' })
  })

  it('reads separate debit and credit columns', () => {
    const csv = ['Posted Date,Payee,Debit,Credit', '01/06/2026,Rent,1800,', '01/07/2026,Refund,,25'].join('\n')
    const result = importCsv(csv)
    expect(result.transactions[0]).toMatchObject({ amount: 1800, kind: 'expense', date: '2026-01-06' })
    expect(result.transactions[1]).toMatchObject({ amount: 25, kind: 'income' })
  })

  it('strips currency symbols and reads parenthesised negatives', () => {
    const csv = ['Date,Description,Amount', '2026-01-04,Books,"($1,234.56)"'].join('\n')
    expect(importCsv(csv).transactions[0]).toMatchObject({ amount: 1234.56, kind: 'expense' })
  })

  it('honours positiveIsExpense for exports that list spend as positive', () => {
    const csv = ['Date,Description,Amount', '2026-01-04,Coffee,4.50'].join('\n')
    expect(importCsv(csv, { positiveIsExpense: true }).transactions[0].kind).toBe('expense')
  })

  it('maps a category label to an existing category', () => {
    const csv = ['Date,Description,Amount,Category', '2026-01-04,Coffee,-4.50,Food'].join('\n')
    const result = importCsv(csv, { resolveCategoryId: (l) => (l === 'Food' ? 'food' : null) })
    expect(result.transactions[0].categoryId).toBe('food')
  })

  it('skips bad rows and reports why, without failing the import', () => {
    const csv = ['Date,Description,Amount', 'garbage,Coffee,-4.50', '2026-01-05,Rent,-1800'].join('\n')
    const result = importCsv(csv)
    expect(result.transactions).toHaveLength(1)
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toContain('Row 2')
  })

  it('explains an unusable file instead of throwing', () => {
    const result = importCsv('Foo,Bar\n1,2')
    expect(result.transactions).toHaveLength(0)
    expect(result.errors.join(' ')).toContain('date column')
  })
})

describe('isDuplicate', () => {
  const existing = [{ date: '2026-01-04', amount: 4.5, description: 'Coffee' }]
  it('matches on date, amount and description', () => {
    expect(
      isDuplicate(
        { date: '2026-01-04', description: 'coffee', amount: 4.5, kind: 'expense', categoryId: null },
        existing
      )
    ).toBe(true)
  })
  it('lets a different amount through', () => {
    expect(
      isDuplicate(
        { date: '2026-01-04', description: 'Coffee', amount: 5, kind: 'expense', categoryId: null },
        existing
      )
    ).toBe(false)
  })
})
