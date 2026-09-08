import { describe, expect, it } from 'vitest'
import type { Bill, NewTransaction, Transaction } from '../../types'
import { billDate } from '../bills'
import { applyCategoryRules } from '../rules'
import { monthlyReport } from '../reports'
import { exportTransactions } from '../export'
import { importCsv, parseCsv, parseDate } from '../csv'

describe('statement import and recurring dates', () => {
  const bill: Bill = {
    id: 'b',
    name: 'Bill',
    amount: 20,
    categoryId: 'fixed',
    startDate: '2024-01-31',
    frequency: 'monthly'
  }
  it('keeps month-end anchors across leap years and short months', () => {
    expect(billDate(bill, '2024-02')).toBe('2024-02-29')
    expect(billDate(bill, '2025-02')).toBe('2025-02-28')
    expect(billDate(bill, '2025-03')).toBe('2025-03-31')
    expect(billDate(bill, '2023-12')).toBeNull()
  })
  it('schedules annual bills only in the anniversary month and clamps February 29', () => {
    const annual = { ...bill, startDate: '2024-02-29', frequency: 'yearly' as const }
    expect(billDate(annual, '2025-02')).toBe('2025-02-28')
    expect(billDate(annual, '2025-03')).toBeNull()
    expect(billDate(annual, '2028-02')).toBe('2028-02-29')
  })
  it('matches the most specific rule without changing an explicit category or income', () => {
    const rules = [
      { id: 'a', contains: 'coffee', categoryId: 'food' },
      { id: 'b', contains: 'coffee beans', categoryId: 'grocery' }
    ]
    const tx: NewTransaction = {
      date: '2026-01-01',
      description: 'COFFEE BEANS store',
      amount: 20,
      kind: 'expense',
      categoryId: null
    }
    expect(applyCategoryRules(tx, rules).categoryId).toBe('grocery')
    expect(applyCategoryRules({ ...tx, categoryId: 'gift' }, rules).categoryId).toBe('gift')
    expect(applyCategoryRules({ ...tx, kind: 'income' }, rules).categoryId).toBeNull()
  })
  it('uses custom headers and day-first dates from a saved bank format', () => {
    const result = importCsv('Booked,Narrative,Value\n04/02/2026,Shop,20', {
      columns: { date: 'Booked', description: 'Narrative', amount: 'Value' },
      positiveIsExpense: true,
      dayFirst: true
    })
    expect(result.transactions[0]).toMatchObject({
      date: '2026-02-04',
      description: 'Shop',
      amount: 20,
      kind: 'expense'
    })
  })
  it('supports overriding a misleading Amount column to use debit and credit', () => {
    const result = importCsv('Date,Description,Amount,Out,In\n2026-01-01,Store,999,12,', {
      columns: { amount: '', debit: 'Out', credit: 'In' }
    })
    expect(result.transactions[0]).toMatchObject({ amount: 12, kind: 'expense' })
  })
  it('shows a missing-preset-column error instead of importing the wrong values', () => {
    const result = importCsv('Date,Amount\n2026-01-01,10', { columns: { amount: 'Other amount' } })
    expect(result.transactions).toEqual([])
    expect(result.errors.join(' ')).toContain('missing')
  })
  it('rejects impossible dates instead of rolling them into another month', () => {
    expect(parseDate('2026-02-29')).toBeNull()
    expect(parseDate('02/30/2026')).toBeNull()
    expect(parseDate('31/04/2026', true)).toBeNull()
    expect(parseDate('29/02/2024', true)).toBe('2024-02-29')
  })
})

describe('reports and exports', () => {
  const tx = (partial: Partial<Transaction> = {}): Transaction => ({
    id: '1',
    date: '2026-01-01',
    amount: 50,
    description: 'Coffee, "beans"',
    categoryId: null,
    kind: 'expense',
    source: 'manual',
    createdAt: '',
    ...partial
  })
  it('includes empty months across year boundaries and separates income from expenses', () => {
    const report = monthlyReport(
      [tx(), tx({ kind: 'income', amount: 100 }), tx({ date: '2025-11-01', amount: 20 })],
      '2026-02',
      3
    )
    expect(report.map((r) => r.month)).toEqual(['2025-12', '2026-01', '2026-02'])
    expect(report[1]).toMatchObject({ income: 100, expense: 50, net: 50, count: 2 })
    expect(report[0]).toMatchObject({ income: 0, expense: 0, net: 0, count: 0 })
  })
  it('exports parseable CSV with signed amounts and protects formula-like text', () => {
    const csv = exportTransactions(
      [tx(), tx({ id: '2', description: '=HYPERLINK("bad")', kind: 'income', amount: 100 })],
      []
    )
    const rows = parseCsv(csv)
    expect(rows[1][1]).toBe('Coffee, "beans"')
    expect(rows[1][2]).toBe('-50.00')
    expect(rows[2][1]).toBe('\'=HYPERLINK("bad")')
    expect(rows[2][2]).toBe('100.00')
    expect(importCsv(csv).transactions[0].kind).toBe('expense')
  })
})
