import { randomUUID } from 'crypto'
import { round2 } from '../../shared/domain/money'
import { getTheme } from '../../shared/themes'
import type {
  AppData,
  ImportPreset,
  NewBill,
  NewCategoryRule,
  NewCategory,
  NewGoal,
  NewTransaction,
  Profile,
  Transaction
} from '../../shared/types'
import type { Database } from './database'
import { CATEGORY_PALETTE } from '../../shared/palette'
import { defaultAppData, demoAppData } from './defaults'
import { validateData } from './validation'
import { applyCategoryRules } from '../../shared/domain/rules'
import { billDate } from '../../shared/domain/bills'
import { isISODate, toISODate } from '../../shared/domain/dates'
import { withoutDuplicates } from '../../shared/domain/csv'
import type { BulkTransactionAction } from '../../shared/api'

/**
 * All writes funnel through here, so validation lives in exactly one place and
 * the renderer can never persist a malformed record over IPC.
 */
export class BudgetStore {
  private history: AppData[] = []
  constructor(private readonly db: Database) {}

  read(): AppData {
    return this.db.load()
  }

  private commit(next: AppData): AppData {
    validateData(next)
    const previous = this.read()
    this.db.save(next)
    this.history.push(structuredClone(previous))
    if (this.history.length > 20) this.history.shift()
    return next
  }

  canUndo(): boolean {
    return this.history.length > 0
  }

  undo(): AppData {
    const previous = this.history.at(-1)
    if (!previous) return this.read()
    this.db.save(previous)
    this.history.pop()
    return previous
  }

  restore(data: AppData): AppData {
    return this.commit(data)
  }

  saveImportPreset(input: Omit<ImportPreset, 'id'> & { id?: string }): AppData {
    const data = this.read()
    const preset = { ...input, id: input.id ?? randomUUID(), name: input.name.trim() }
    return this.commit({
      ...data,
      importPresets: [...data.importPresets.filter((p) => p.id !== preset.id), preset]
    })
  }

  deleteImportPreset(id: string): AppData {
    const data = this.read()
    return this.commit({ ...data, importPresets: data.importPresets.filter((p) => p.id !== id) })
  }

  upsertRule(input: NewCategoryRule): AppData {
    const data = this.read()
    const rule = {
      id: input.id ?? randomUUID(),
      contains: input.contains.trim(),
      categoryId: input.categoryId
    }
    return this.commit({ ...data, rules: [...data.rules.filter((r) => r.id !== rule.id), rule] })
  }

  deleteRule(id: string): AppData {
    const data = this.read()
    return this.commit({ ...data, rules: data.rules.filter((r) => r.id !== id) })
  }

  bulkTransactions(ids: string[], action: BulkTransactionAction): AppData {
    const data = this.read()
    const selected = new Set(ids)
    if (action.categoryId && !data.categories.some((c) => c.id === action.categoryId))
      throw new Error('Choose an existing category.')
    return this.commit({
      ...data,
      transactions: data.transactions
        .filter((t) => !(selected.has(t.id) && action.delete))
        .map((t) => {
          if (!selected.has(t.id)) return t
          let next = action.applyRules ? applyCategoryRules(t, data.rules) : { ...t }
          if (action.categoryId !== undefined) next = { ...next, categoryId: action.categoryId }
          if (action.reviewed !== undefined) next = { ...next, reviewed: action.reviewed }
          return next
        })
    })
  }

  upsertBill(input: NewBill): AppData {
    const data = this.read()
    const bill = {
      ...input,
      id: input.id ?? randomUUID(),
      name: input.name.trim(),
      amount: round2(input.amount)
    }
    return this.commit({ ...data, bills: [...data.bills.filter((b) => b.id !== bill.id), bill] })
  }

  deleteBill(id: string): AppData {
    const data = this.read()
    return this.commit({
      ...data,
      bills: data.bills.filter((b) => b.id !== id),
      transactions: data.transactions.map((t) =>
        t.billId === id ? { ...t, billId: undefined, billDueDate: undefined } : t
      )
    })
  }

  recordBill(id: string, dueDate: string, transactionId?: string): AppData {
    const data = this.read()
    const bill = data.bills.find((b) => b.id === id)
    if (!bill || !isISODate(dueDate) || billDate(bill, dueDate.slice(0, 7)) !== dueDate)
      throw new Error('Invalid bill occurrence.')
    if (!transactionId && dueDate > toISODate(new Date()))
      throw new Error('Record this bill when it is due, or link an existing payment.')
    if (
      data.transactions.some(
        (t) => t.billId === id && t.billDueDate?.slice(0, 7) === dueDate.slice(0, 7)
      )
    )
      return data
    const existing = transactionId
      ? data.transactions.find((t) => t.id === transactionId)
      : undefined
    if (transactionId && (!existing || existing.kind !== 'expense' || existing.billId))
      throw new Error('Choose an unlinked expense.')
    const payment =
      existing ??
      normalize(
        {
          date: dueDate,
          description: bill.name,
          amount: bill.amount,
          kind: 'expense',
          categoryId: bill.categoryId
        },
        data
      )
    const linked = {
      ...payment,
      categoryId: bill.categoryId,
      billId: id,
      billDueDate: dueDate,
      reviewed: true
    }
    return this.commit({
      ...data,
      transactions: existing
        ? data.transactions.map((t) => (t.id === existing.id ? linked : t))
        : [linked, ...data.transactions]
    })
  }

  saveProfile(profile: Profile): AppData {
    const data = this.read()
    return this.commit({
      ...data,
      profile: {
        ...data.profile,
        ...profile,
        annualSalary: Math.max(0, Number(profile.annualSalary) || 0),
        hourlyRate: Math.max(0, Number(profile.hourlyRate) || 0),
        hoursPerWeek: clamp(Number(profile.hoursPerWeek) || 0, 0, 168),
        withholdingPct: clamp(Number(profile.withholdingPct) || 0, 0, 100),
        // Never persist a theme id the app can't render.
        themeId: getTheme(profile.themeId).id
      }
    })
  }

  upsertCategory(input: NewCategory): AppData {
    const data = this.read()
    const monthlyLimit = Math.max(0, round2(Number(input.monthlyLimit) || 0))
    const name = input.name.trim() || 'Untitled'
    if (input.id && data.categories.some((c) => c.id === input.id)) {
      return this.commit({
        ...data,
        categories: data.categories.map((c) =>
          c.id === input.id
            ? {
                ...c,
                name,
                monthlyLimit,
                color: input.color || c.color,
                fixed: input.fixed ?? c.fixed
              }
            : c
        )
      })
    }
    const category = {
      id: input.id ?? randomUUID(),
      name,
      monthlyLimit,
      fixed: input.fixed ?? false,
      color: input.color || CATEGORY_PALETTE[data.categories.length % CATEGORY_PALETTE.length]
    }
    return this.commit({ ...data, categories: [...data.categories, category] })
  }

  /** Transactions keep their history; they just lose the category reference. */
  deleteCategory(id: string): AppData {
    const data = this.read()
    if (data.bills.some((b) => b.categoryId === id))
      throw new Error('Move or remove this category’s bills first.')
    return this.commit({
      ...data,
      categories: data.categories.filter((c) => c.id !== id),
      rules: data.rules.filter((r) => r.categoryId !== id),
      transactions: data.transactions.map((t) =>
        t.categoryId === id ? { ...t, categoryId: null } : t
      )
    })
  }

  upsertGoal(input: NewGoal): AppData {
    const data = this.read()
    const goal = {
      name: input.name.trim() || 'Untitled goal',
      horizon: input.horizon,
      targetAmount: Math.max(0, round2(Number(input.targetAmount) || 0)),
      savedAmount: Math.max(0, round2(Number(input.savedAmount) || 0)),
      targetDate: input.targetDate
    }
    if (input.id && data.goals.some((g) => g.id === input.id)) {
      return this.commit({
        ...data,
        goals: data.goals.map((g) => (g.id === input.id ? { ...g, ...goal } : g))
      })
    }
    return this.commit({
      ...data,
      goals: [
        ...data.goals,
        { ...goal, id: input.id ?? randomUUID(), createdAt: new Date().toISOString() }
      ]
    })
  }

  deleteGoal(id: string): AppData {
    const data = this.read()
    return this.commit({ ...data, goals: data.goals.filter((g) => g.id !== id) })
  }

  addTransaction(input: NewTransaction): AppData {
    const data = this.read()
    return this.commit({ ...data, transactions: [normalize(input, data), ...data.transactions] })
  }

  updateTransaction(tx: Transaction): AppData {
    const data = this.read()
    return this.commit({
      ...data,
      transactions: data.transactions.map((t) =>
        t.id === tx.id ? { ...normalize(tx, data), id: t.id, createdAt: t.createdAt } : t
      )
    })
  }

  deleteTransaction(id: string): AppData {
    const data = this.read()
    return this.commit({ ...data, transactions: data.transactions.filter((t) => t.id !== id) })
  }

  importTransactions(
    inputs: NewTransaction[],
    skipDuplicates = true,
    incomeBasis?: Profile['incomeBasis']
  ): AppData {
    const data = this.read()
    const normalized = inputs.map((input) =>
      normalize(applyCategoryRules({ ...input, source: 'csv', reviewed: false }, data.rules), data)
    )
    const imported = skipDuplicates ? withoutDuplicates(normalized, data.transactions) : normalized
    return this.commit({
      ...data,
      profile: { ...data.profile, incomeBasis: incomeBasis ?? data.profile.incomeBasis },
      transactions: [...imported, ...data.transactions]
    })
  }

  loadDemoData(): AppData {
    return this.commit(demoAppData())
  }

  resetData(): AppData {
    return this.commit(defaultAppData())
  }
}

function normalize(input: NewTransaction | Transaction, data: AppData): Transaction {
  if (!isISODate(input.date)) throw new Error('Enter a valid transaction date.')
  if (!Number.isFinite(Number(input.amount)) || Math.abs(round2(Number(input.amount))) <= 0)
    throw new Error('Enter an amount greater than zero.')
  const categoryId =
    input.categoryId && data.categories.some((c) => c.id === input.categoryId)
      ? input.categoryId
      : null
  return {
    id: 'id' in input && input.id ? input.id : randomUUID(),
    date: input.date,
    description: input.description.trim() || 'Untitled',
    amount: Math.abs(round2(Number(input.amount) || 0)),
    kind: input.kind === 'income' ? 'income' : 'expense',
    categoryId,
    source: input.source ?? 'manual',
    createdAt: 'createdAt' in input && input.createdAt ? input.createdAt : new Date().toISOString(),
    reviewed: input.reviewed ?? true,
    billId: input.billId,
    billDueDate: input.billDueDate
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
