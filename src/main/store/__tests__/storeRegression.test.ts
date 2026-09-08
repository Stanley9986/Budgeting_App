import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NewTransaction } from '../../../shared/types'
import type { BulkTransactionAction } from '../../../shared/api'
import { BudgetStore } from '../budgetStore'
import { JsonDatabase } from '../jsonDatabase'

const expense: NewTransaction = {
  date: '2026-01-04', description: 'Coffee shop', amount: 4.5, kind: 'expense', categoryId: null
}

describe('store regression scenarios', () => {
  let directory: string
  let db: JsonDatabase
  let store: BudgetStore
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'budget-regression-'))
    db = JsonDatabase.in(directory)
    store = new BudgetStore(db)
  })
  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  it('does not let returned snapshots change persisted state or undo history', () => {
    const initial = store.read()
    const saved = store.addTransaction(expense)
    saved.profile.name = 'External mutation'
    initial.categories.splice(0)
    expect(store.read().profile.name).toBe('')
    const undone = store.undo()
    expect(undone.categories.length).toBeGreaterThan(0)
    undone.profile.name = 'Undo result mutation'
    expect(store.read().profile.name).toBe('')
    expect(new JsonDatabase(db.path).load().profile.name).toBe('')
  })

  it('keeps the meaningful undo step after no-op actions and duplicate-only imports', () => {
    store.importTransactions([expense])
    store.deleteTransaction('missing')
    store.bulkTransactions([], { delete: true })
    store.importTransactions([expense])
    store.saveProfile(store.read().profile)
    expect(store.undo().transactions).toHaveLength(0)
    expect(store.canUndo()).toBe(false)
  })

  it('keeps undo available after a failed undo write, so retry restores the same snapshot', () => {
    store.addTransaction(expense)
    vi.spyOn(db, 'save').mockImplementationOnce(() => { throw new Error('Disk full') })
    expect(() => store.undo()).toThrow('Disk full')
    expect(store.canUndo()).toBe(true)
    expect(store.read().transactions).toHaveLength(1)
    expect(store.undo().transactions).toHaveLength(0)
    expect(store.canUndo()).toBe(false)
  })

  it('preserves rule precedence when editing a rule tied with another match', () => {
    const [firstCategory, secondCategory] = store.read().categories
    const firstRule = store.upsertRule({ contains: 'Coffee', categoryId: firstCategory.id }).rules[0]
    store.upsertRule({ contains: 'coffee', categoryId: secondCategory.id })
    store.upsertRule({ ...firstRule, contains: 'COFFEE' })
    expect(store.importTransactions([expense]).transactions[0].categoryId).toBe(firstCategory.id)
  })

  it('rejects stale edits instead of reporting a save that changed nothing', () => {
    const tx = store.addTransaction(expense).transactions[0]
    store.deleteTransaction(tx.id)
    expect(() => store.updateTransaction(tx)).toThrow('no longer exists')
    expect(store.read().transactions).toHaveLength(0)
  })

  it.each([NaN, Infinity, '12', true, null])('rejects malformed numeric input %s without silently saving zero', (value) => {
    const initial = store.read()
    const invalid = value as unknown as number
    expect(() => store.saveProfile({ ...initial.profile, annualSalary: invalid })).toThrow('valid annual salary')
    expect(() => store.upsertCategory({ ...initial.categories[0], monthlyLimit: invalid })).toThrow('valid monthly limit')
    expect(() => store.upsertGoal({ name: 'Car', horizon: 'year', targetDate: '2026-12-31', targetAmount: invalid, savedAmount: 0 })).toThrow('valid target amount')
    expect(() => store.addTransaction({ ...expense, amount: invalid })).toThrow('valid transaction amount')
    expect(store.read()).toEqual(initial)
    expect(store.canUndo()).toBe(false)
  })

  it('rejects a malformed transaction kind or import duplicate option', () => {
    expect(() => store.addTransaction({ ...expense, kind: 'refund' as NewTransaction['kind'] })).toThrow('expense or income')
    expect(() => store.importTransactions([expense], 'false' as unknown as boolean)).toThrow('import options')
    expect(store.read().transactions).toEqual([])
  })

  it.each([{ delete: 'false' }, { reviewed: 1 }, { applyRules: 'yes' }])(
    'rejects malformed bulk actions atomically: %j', (action) => {
      const original = store.addTransaction(expense)
      expect(() => store.bulkTransactions([original.transactions[0].id], action as unknown as BulkTransactionAction)).toThrow('Invalid bulk')
      expect(store.read()).toEqual(original)
    }
  )

  function paidBill() {
    const bill = store.upsertBill({
      name: 'Rent', amount: 1800, startDate: '2026-01-01', frequency: 'monthly', categoryId: store.read().categories[0].id
    }).bills[0]
    return store.recordBill(bill.id, '2026-01-01').transactions[0]
  }

  it.each(['income', 'category', 'bulk-category'])('unlinks a bill when editing the payment %s', (edit) => {
    const tx = paidBill()
    const categoryId = store.read().categories[1].id
    const updated = edit === 'bulk-category'
      ? store.bulkTransactions([tx.id], { categoryId })
      : store.updateTransaction({ ...tx, ...(edit === 'income' ? { kind: 'income' as const } : { categoryId }) })
    expect(updated.transactions[0].billId).toBeUndefined()
    expect(updated.transactions[0].billDueDate).toBeUndefined()
    expect(store.undo().transactions[0].billId).toBe(tx.billId)
  })

  it('keeps the bill link when correcting a late payment date or amount', () => {
    const tx = paidBill()
    const updated = store.updateTransaction({ ...tx, date: '2026-02-02', amount: 1900 })
    expect(updated.transactions[0]).toMatchObject({ billId: tx.billId, billDueDate: '2026-01-01', amount: 1900 })
  })
})
