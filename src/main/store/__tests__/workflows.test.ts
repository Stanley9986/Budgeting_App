import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { AppData, NewTransaction } from '../../../shared/types'
import { billsForMonth } from '../../../shared/domain/bills'
import { computeMonthPace } from '../../../shared/domain/pacing'
import { BudgetStore } from '../budgetStore'
import { JsonDatabase, parseBudgetFile } from '../jsonDatabase'

const expense: NewTransaction = {
  date: '2026-01-04',
  description: 'Coffee shop',
  amount: 4.5,
  kind: 'expense',
  categoryId: null
}

describe('local desktop workflows', () => {
  let directory: string
  let db: JsonDatabase
  let store: BudgetStore
  beforeEach(() => {
    directory = mkdtempSync(join(tmpdir(), 'budget-workflows-'))
    db = JsonDatabase.in(directory)
    store = new BudgetStore(db)
  })
  afterEach(() => rmSync(directory, { recursive: true, force: true }))

  it('deduplicates reimports and duplicate lines, but keeps income with the same amount and description', () => {
    store.importTransactions([expense, expense, { ...expense, kind: 'income' }])
    expect(store.importTransactions([expense]).transactions).toHaveLength(2)
    expect(store.importTransactions([expense], false).transactions).toHaveLength(3)
  })

  it('applies saved rules during import, preserves explicit categories, and requires review', () => {
    const [a, b] = store.read().categories
    store.upsertRule({ contains: 'Coffee', categoryId: a.id })
    const data = store.importTransactions([
      expense,
      { ...expense, description: 'Coffee large', categoryId: b.id }
    ])
    expect(data.transactions.map((t) => t.categoryId)).toEqual([a.id, b.id])
    expect(data.transactions.every((t) => t.reviewed === false)).toBe(true)
    const after = store.bulkTransactions([data.transactions[0].id], {
      reviewed: true,
      categoryId: b.id
    })
    expect(after.transactions[0]).toMatchObject({ categoryId: b.id, reviewed: true })
    expect(after.transactions[1].reviewed).toBe(false)
  })

  it('removes rules when their category is deleted, without deleting transactions', () => {
    const categoryId = store.read().categories[0].id
    store.upsertRule({ contains: 'Coffee', categoryId })
    store.importTransactions([expense])
    expect(store.deleteCategory(categoryId)).toMatchObject({
      rules: [],
      transactions: [{ categoryId: null }]
    })
  })

  it('undoes a bulk delete in one step and persists the restored history', () => {
    const data = store.importTransactions([expense, { ...expense, date: '2026-01-05' }])
    store.bulkTransactions(
      data.transactions.map((t) => t.id),
      { delete: true }
    )
    expect(store.read().transactions).toHaveLength(0)
    store.undo()
    expect(new JsonDatabase(db.path).load().transactions).toEqual(data.transactions)
  })

  it('does not create an undo entry or change data on a failed write', () => {
    const initial = store.read()
    const failed = new BudgetStore({
      load: () => initial,
      save: () => {
        throw new Error('disk full')
      }
    })
    expect(() => failed.addTransaction(expense)).toThrow('disk full')
    expect(failed.canUndo()).toBe(false)
    expect(failed.read()).toEqual(initial)
  })

  it('limits undo to 20 successful changes and starts fresh after reopening', () => {
    for (let i = 0; i < 22; i++) store.addTransaction({ ...expense, description: String(i) })
    for (let i = 0; i < 20; i++) store.undo()
    expect(store.read().transactions).toHaveLength(2)
    expect(store.canUndo()).toBe(false)
    expect(new BudgetStore(new JsonDatabase(db.path)).canUndo()).toBe(false)
  })

  function addBill() {
    return store.upsertBill({
      name: 'Rent',
      amount: 1800,
      startDate: '2026-01-01',
      frequency: 'monthly',
      categoryId: store.read().categories[0].id
    }).bills[0]
  }

  it('records a bill once even if the same action is retried', () => {
    const bill = addBill()
    store.recordBill(bill.id, '2026-01-01')
    const data = store.recordBill(bill.id, '2026-01-01')
    expect(data.transactions).toHaveLength(1)
    expect(billsForMonth(data, '2026-01')[0].transaction?.amount).toBe(1800)
  })

  it('links an imported payment without creating another expense; deleting and undoing update bill status', () => {
    const bill = addBill()
    const payment = store.importTransactions([{ ...expense, amount: 1800 }]).transactions[0]
    const linked = store.recordBill(bill.id, '2026-01-01', payment.id)
    expect(linked.transactions).toHaveLength(1)
    expect(linked.transactions[0]).toMatchObject({
      id: payment.id,
      categoryId: bill.categoryId,
      billId: bill.id
    })
    store.deleteTransaction(payment.id)
    expect(billsForMonth(store.read(), '2026-01')[0].transaction).toBeUndefined()
    expect(billsForMonth(store.undo(), '2026-01')[0].transaction?.id).toBe(payment.id)
  })

  it('rejects invalid occurrences, future expense creation, and reusing a linked payment', () => {
    const bill = addBill()
    expect(() => store.recordBill(bill.id, '2026-01-02')).toThrow('Invalid bill occurrence')
    expect(() => store.recordBill(bill.id, '2099-01-01')).toThrow('when it is due')
    const payment = store.recordBill(bill.id, '2026-01-01').transactions[0]
    expect(() => store.recordBill(bill.id, '2026-02-01', payment.id)).toThrow('unlinked expense')
  })

  it('keeps recorded expenses when deleting a bill schedule', () => {
    const bill = addBill()
    store.recordBill(bill.id, '2026-01-01')
    const after = store.deleteBill(bill.id)
    expect(after.bills).toHaveLength(0)
    expect(after.transactions).toHaveLength(1)
    expect(after.transactions[0].billId).toBeUndefined()
  })

  it('keeps a recorded month paid when its scheduled day is edited', () => {
    const bill = addBill()
    store.recordBill(bill.id, '2026-01-01')
    store.upsertBill({ ...bill, startDate: '2026-01-02' })
    expect(billsForMonth(store.read(), '2026-01')[0].transaction).toBeDefined()
    expect(store.recordBill(bill.id, '2026-01-02').transactions).toHaveLength(1)
  })

  it('reserves multiple bills above a category limit without adding a linked payment twice', () => {
    const first = addBill()
    store.upsertBill({
      name: 'Insurance',
      amount: 200,
      startDate: '2026-01-01',
      frequency: 'monthly',
      categoryId: first.categoryId
    })
    let pace = computeMonthPace(store.read(), '2026-01', new Date(2026, 0, 15))
    expect(pace.categories[0].projected).toBe(2000)
    store.recordBill(first.id, '2026-01-01')
    pace = computeMonthPace(store.read(), '2026-01', new Date(2026, 0, 15))
    expect(pace.categories[0].projected).toBe(2000)
  })

  it('requires fixed categories for bills and stops deleting a category still used by a bill', () => {
    const bill = addBill()
    expect(() => store.deleteCategory(bill.categoryId)).toThrow('bills first')
    expect(() => store.upsertCategory({ ...store.read().categories[0], fixed: false })).toThrow(
      'fixed category'
    )
  })

  it('round-trips a full backup with bills, rules and import presets, then undoes restoration', () => {
    addBill()
    store.upsertRule({ contains: 'Coffee', categoryId: store.read().categories[1].id })
    store.saveImportPreset({
      name: 'Checking',
      columns: { date: 'Booked', amount: 'Value' },
      positiveIsExpense: false,
      dayFirst: true
    })
    const original = store.importTransactions([expense])
    const candidate = parseBudgetFile(JSON.stringify(original))
    store.resetData()
    expect(store.restore(candidate)).toEqual(original)
    expect(store.undo().transactions).toHaveLength(0)
  })

  it('migrates the original schema without losing existing history or the legacy income basis', () => {
    const legacy = { ...store.addTransaction(expense), version: 1 } as Partial<AppData>
    delete legacy.rules
    delete legacy.bills
    delete legacy.importPresets
    delete legacy.profile!.incomeBasis
    const after = parseBudgetFile(JSON.stringify(legacy))
    expect(after.transactions).toEqual(legacy.transactions)
    expect(after).toMatchObject({
      version: 2,
      rules: [],
      bills: [],
      importPresets: [],
      profile: { incomeBasis: 'estimate-plus-extra' }
    })
  })

  it('rejects malformed and newer backups without replacing the current budget', () => {
    const original = store.addTransaction(expense)
    for (const value of [
      {},
      { ...original, rules: undefined },
      { ...original, version: 99 },
      { ...original, transactions: [{ ...original.transactions[0], date: '2026-02-30' }] },
      { ...original, transactions: [original.transactions[0], original.transactions[0]] }
    ]) {
      expect(() => store.restore(parseBudgetFile(JSON.stringify(value)))).toThrow()
      expect(store.read()).toEqual(original)
    }
  })

  it('does not rename or overwrite a local file from a newer app version', () => {
    const content = JSON.stringify({ ...store.read(), version: 99 })
    writeFileSync(db.path, content)
    expect(() => new JsonDatabase(db.path).load()).toThrow('newer version')
    expect(readFileSync(db.path, 'utf-8')).toBe(content)
  })

  it('rejects bad transaction amounts and dates atomically', () => {
    const initial = store.read()
    expect(() => store.importTransactions([expense, { ...expense, date: '2026-02-30' }])).toThrow(
      'valid transaction date'
    )
    expect(() => store.addTransaction({ ...expense, amount: Infinity })).toThrow('amount')
    expect(store.read()).toEqual(initial)
  })

  it('prevents paycheck double-counting with the chosen import income basis', () => {
    store.saveProfile({ ...store.read().profile, annualSalary: 120_000, withholdingPct: 0 })
    const paycheck = { ...expense, kind: 'income' as const, amount: 5000 }
    const estimated = store.importTransactions([paycheck], true, 'estimate')
    expect(computeMonthPace(estimated, '2026-01').income).toBe(10_000)
    const recorded = store.importTransactions([], true, 'recorded')
    expect(computeMonthPace(recorded, '2026-01').income).toBe(5000)
  })
})
