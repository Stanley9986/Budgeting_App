import { describe, expect, it } from 'vitest'
import { importCsv, isDuplicate, parseCsv, parseDate, withoutDuplicates } from '../csv'

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

  it('accepts a BOM before quoted headers and embedded newlines', () => {
    expect(parseCsv('\uFEFF"Date",Description,Amount\r\n2026-01-01,"First\r\nsecond",-5')).toEqual([
      ['Date', 'Description', 'Amount'],
      ['2026-01-01', 'First\r\nsecond', '-5']
    ])
  })

  it.each([
    'Date,Description,Amount\n2026-01-01,"Unclosed,-5',
    'Date,Description,Amount\n2026-01-01,Unquoted"quote,-5',
    'Date,Description,Amount\n2026-01-01,"Closed"junk,-5'
  ])('rejects malformed quoting without returning shifted transaction columns', (csv) => {
    expect(() => parseCsv(csv)).toThrow(/CSV line 2/)
    expect(importCsv(csv)).toMatchObject({ transactions: [], errors: [expect.stringMatching(/CSV line 2/)] })
  })

  it('allows whitespace after a closing quote without altering the field', () => {
    expect(parseCsv('a,b\n"value" \t,"next"')[1]).toEqual(['value', 'next'])
  })
})

describe('parseDate', () => {
  it('accepts ISO', () => expect(parseDate('2026-03-04')).toBe('2026-03-04'))
  it('accepts US slashes', () => expect(parseDate('3/4/2026')).toBe('2026-03-04'))
  it('accepts two-digit years', () => expect(parseDate('03/04/26')).toBe('2026-03-04'))
  it('rejects nonsense', () => expect(parseDate('not a date')).toBe(null))

  it.each(['1', '2026-2-30', 'February 30, 2026', '2026-03-04T00:00:00Z', '01/01/0999'])(
    'rejects unsupported or impossible calendar input %s',
    (input) => expect(parseDate(input)).toBeNull()
  )

  it('parses an ambiguous slash date consistently with the saved convention', () => {
    expect(parseDate(' 04/03/2026 ')).toBe('2026-04-03')
    expect(parseDate('04/03/2026', true)).toBe('2026-03-04')
  })
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

  it.each(['0.001', '0', '1e3', '0xFF', 'NaN', 'Infinity', '9007199254740991', '12 34', '1,00', '$1$2'])(
    'skips unusable or unsafe amount %s in the preview',
    (amount) => {
      const result = importCsv(`Date,Description,Amount\n2026-01-01,Test,"${amount}"`)
      expect(result.transactions).toEqual([])
      expect(result.skipped).toBe(1)
      expect(result.errors[0]).toContain('amount')
    }
  )

  it('rounds decimal amounts before import and accepts leading-decimal cents', () => {
    const result = importCsv('Date,Description,Amount\n2026-01-01,Coffee,-10.075\n2026-01-02,Fee,-.50')
    expect(result.transactions.map((t) => t.amount)).toEqual([10.08, 0.5])
  })

  it.each([
    ['5', '10'],
    ['oops', '10'],
    ['5', 'oops']
  ])('rejects ambiguous or invalid debit/credit pair %s/%s', (debit, credit) => {
    const result = importCsv(`Date,Debit,Credit\n2026-01-01,${debit},${credit}`)
    expect(result.transactions).toEqual([])
    expect(result.skipped).toBe(1)
    expect(result.errors[0]).toMatch(/debit.*credit/)
  })

  it('accepts zero and dash placeholders in separate debit and credit columns', () => {
    const result = importCsv('Date,Debit,Credit\n2026-01-01,0,10\n2026-01-02,5,0\n2026-01-03,-,20')
    expect(result.transactions.map(({ amount, kind }) => ({ amount, kind }))).toEqual([
      { amount: 10, kind: 'income' },
      { amount: 5, kind: 'expense' },
      { amount: 20, kind: 'income' }
    ])
  })

  it('rejects rows whose fields were shifted by an unquoted amount comma', () => {
    const result = importCsv('Date,Description,Amount,Category\n2026-01-01,Rent,1,000,Home\n2026-01-02,Food,-5,Food')
    expect(result.transactions).toHaveLength(1)
    expect(result.transactions[0].description).toBe('Food')
    expect(result.errors[0]).toContain('expected 4 columns, found 5')
  })

  it('caps displayed row errors while reporting every skipped row', () => {
    const result = importCsv(['Date,Amount', ...Array(10).fill('invalid,-5')].join('\n'))
    expect(result.skipped).toBe(10)
    expect(result.errors).toHaveLength(5)
  })

  it('rejects duplicate column labels instead of silently selecting the first amount', () => {
    const csv = 'Date,Amount,Amount\n2026-01-01,-5,-100'
    for (const options of [{}, { columns: { amount: 'Amount' } }]) {
      const result = importCsv(csv, options)
      expect(result.transactions).toEqual([])
      expect(result.errors.join(' ')).toContain('appears more than once')
    }
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

  it('keeps a refund and purchase with otherwise identical details', () => {
    const expense = { date: '2026-01-04', description: 'Coffee', amount: 4.5, kind: 'expense' as const, categoryId: null }
    const refund = { ...expense, kind: 'income' as const }
    expect(isDuplicate(refund, [expense])).toBe(false)
    expect(withoutDuplicates([expense, refund], [])).toEqual([expense, refund])
  })

  it('deduplicates normalized descriptions against history and within a statement', () => {
    const tx = { date: '2026-01-04', description: 'Coffee', amount: 4.5, kind: 'expense' as const, categoryId: null }
    const repeated = { ...tx, description: ' COFFEE ' }
    expect(withoutDuplicates([repeated], [tx])).toEqual([])
    expect(withoutDuplicates([tx, repeated], [])).toEqual([tx])
  })
})
