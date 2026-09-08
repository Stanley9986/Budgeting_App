import { randomUUID } from 'crypto'
import { round2 } from '../../shared/domain/money'
import { getTheme } from '../../shared/themes'
import type {
  AppData,
  NewCategory,
  NewGoal,
  NewTransaction,
  Profile,
  Transaction
} from '../../shared/types'
import type { Database } from './database'
import { CATEGORY_PALETTE } from '../../shared/palette'
import { defaultAppData, demoAppData } from './defaults'

/**
 * All writes funnel through here, so validation lives in exactly one place and
 * the renderer can never persist a malformed record over IPC.
 */
export class BudgetStore {
  constructor(private readonly db: Database) {}

  read(): AppData {
    return this.db.load()
  }

  private commit(next: AppData): AppData {
    this.db.save(next)
    return next
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
            ? { ...c, name, monthlyLimit, color: input.color || c.color, fixed: input.fixed ?? c.fixed }
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
    return this.commit({
      ...data,
      categories: data.categories.filter((c) => c.id !== id),
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
      goals: [...data.goals, { ...goal, id: input.id ?? randomUUID(), createdAt: new Date().toISOString() }]
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

  importTransactions(inputs: NewTransaction[]): AppData {
    const data = this.read()
    const imported = inputs.map((t) => normalize({ ...t, source: 'csv' }, data))
    return this.commit({ ...data, transactions: [...imported, ...data.transactions] })
  }

  loadDemoData(): AppData {
    return this.commit(demoAppData())
  }

  resetData(): AppData {
    return this.commit(defaultAppData())
  }
}

function normalize(input: NewTransaction | Transaction, data: AppData): Transaction {
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
    createdAt: 'createdAt' in input && input.createdAt ? input.createdAt : new Date().toISOString()
  }
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}
