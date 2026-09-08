import { mkdtempSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { AppData } from '../../../shared/types'
import { CATEGORY_PALETTE } from '../../../shared/palette'
import { BudgetStore } from '../budgetStore'
import { JsonDatabase } from '../jsonDatabase'

function freshStore(): { store: BudgetStore; db: JsonDatabase } {
  const db = JsonDatabase.in(mkdtempSync(join(tmpdir(), 'budget-test-')))
  return { store: new BudgetStore(db), db }
}

describe('BudgetStore', () => {
  let store: BudgetStore
  let db: JsonDatabase

  beforeEach(() => {
    ;({ store, db } = freshStore())
  })

  it('creates a default file on first read', () => {
    const data = store.read()
    expect(data.categories.length).toBeGreaterThan(0)
    expect(data.transactions).toEqual([])
    const onDisk = JSON.parse(readFileSync(db.path, 'utf-8')) as AppData
    expect(onDisk.version).toBe(2)
  })

  it('persists a transaction to disk', () => {
    store.addTransaction({
      date: '2026-01-04',
      description: 'Coffee',
      amount: 4.5,
      kind: 'expense',
      categoryId: null
    })
    const reopened = new BudgetStore(new JsonDatabase(db.path)).read()
    expect(reopened.transactions[0]).toMatchObject({ description: 'Coffee', amount: 4.5 })
  })

  it('stores amounts positive regardless of the sign passed in', () => {
    const data = store.addTransaction({
      date: '2026-01-04',
      description: 'Refund',
      amount: -20,
      kind: 'income',
      categoryId: null
    })
    expect(data.transactions[0].amount).toBe(20)
  })

  it('drops a category id that does not exist', () => {
    const data = store.addTransaction({
      date: '2026-01-04',
      description: 'Mystery',
      amount: 10,
      kind: 'expense',
      categoryId: 'nope'
    })
    expect(data.transactions[0].categoryId).toBe(null)
  })

  it('keeps transactions when their category is deleted', () => {
    const categoryId = store.read().categories[0].id
    store.addTransaction({
      date: '2026-01-04',
      description: 'Rent',
      amount: 1800,
      kind: 'expense',
      categoryId
    })
    const after = store.deleteCategory(categoryId)
    expect(after.categories.find((c) => c.id === categoryId)).toBeUndefined()
    expect(after.transactions).toHaveLength(1)
    expect(after.transactions[0].categoryId).toBe(null)
  })

  it('updates an existing goal instead of duplicating it', () => {
    const created = store.upsertGoal({
      name: 'Car',
      horizon: 'year',
      targetAmount: 50000,
      savedAmount: 0,
      targetDate: '2026-12-31'
    })
    const id = created.goals[0].id
    const updated = store.upsertGoal({
      id,
      name: 'Car',
      horizon: 'year',
      targetAmount: 50000,
      savedAmount: 5000,
      targetDate: '2026-12-31'
    })
    expect(updated.goals).toHaveLength(1)
    expect(updated.goals[0].savedAmount).toBe(5000)
  })

  it('clamps withholding to a sane range', () => {
    const data = store.saveProfile({ ...store.read().profile, withholdingPct: 320 })
    expect(data.profile.withholdingPct).toBe(100)
  })

  it('marks imported rows as csv', () => {
    const data = store.importTransactions([
      { date: '2026-01-04', description: 'Coffee', amount: 4.5, kind: 'expense', categoryId: null }
    ])
    expect(data.transactions[0].source).toBe('csv')
  })

  it('marks lump-sum bills as fixed by default', () => {
    const categories = store.read().categories
    expect(categories.find((c) => c.name === 'Rent & Housing')?.fixed).toBe(true)
    expect(categories.find((c) => c.name === 'Utilities')?.fixed).toBe(true)
    expect(categories.find((c) => c.name === 'Groceries')?.fixed).toBe(false)
  })

  it('creates new categories as variable unless told otherwise', () => {
    const data = store.upsertCategory({ name: 'Pets', monthlyLimit: 80, color: '' })
    expect(data.categories.find((c) => c.name === 'Pets')?.fixed).toBe(false)
  })

  it('toggles fixed without clobbering the rest of the category', () => {
    const rent = store.read().categories.find((c) => c.name === 'Rent & Housing')!
    const data = store.upsertCategory({ ...rent, fixed: false })
    const after = data.categories.find((c) => c.id === rent.id)!
    expect(after.fixed).toBe(false)
    expect(after.monthlyLimit).toBe(rent.monthlyLimit)
    expect(after.color).toBe(rent.color)
  })

  it('backfills `fixed` on a file written before the field existed', () => {
    const legacy = {
      version: 1,
      profile: store.read().profile,
      categories: [{ id: 'rent', name: 'Rent', monthlyLimit: 1800, color: '#7c9cff' }],
      goals: [],
      transactions: []
    }
    writeFileSync(db.path, JSON.stringify(legacy), 'utf-8')
    const migrated = new BudgetStore(new JsonDatabase(db.path)).read()
    expect(migrated.categories[0].fixed).toBe(false)
  })

  it('keeps a known built-in category marked as a bill when migrating', () => {
    const legacy = {
      version: 1,
      profile: store.read().profile,
      categories: [{ id: 'rent-housing', name: 'Rent & Housing', monthlyLimit: 1800, color: '#7c9cff' }],
      goals: [],
      transactions: []
    }
    writeFileSync(db.path, JSON.stringify(legacy), 'utf-8')
    const migrated = new BudgetStore(new JsonDatabase(db.path)).read()
    expect(migrated.categories[0].fixed).toBe(true)
  })

  it('repaints legacy category colours on load', () => {
    const legacy = {
      version: 1,
      profile: store.read().profile,
      categories: [
        { id: 'rent-housing', name: 'Rent & Housing', monthlyLimit: 1800, color: '#7c9cff', fixed: true },
        { id: 'mine', name: 'Mine', monthlyLimit: 50, color: '#123456', fixed: false }
      ],
      goals: [],
      transactions: []
    }
    writeFileSync(db.path, JSON.stringify(legacy), 'utf-8')
    const migrated = new BudgetStore(new JsonDatabase(db.path)).read()
    expect(migrated.categories[0].color).toBe(CATEGORY_PALETTE[0])
    expect(migrated.categories[1].color).toBe('#123456')
  })

  it('recovers from a corrupt data file instead of throwing', () => {
    store.addTransaction({
      date: '2026-01-04',
      description: 'Coffee',
      amount: 4.5,
      kind: 'expense',
      categoryId: null
    })
    writeFileSync(db.path, '{ not json', 'utf-8')
    const recovered = new BudgetStore(new JsonDatabase(db.path)).read()
    expect(recovered.transactions).toEqual([])
  })
})
