/**
 * Domain types shared by the main process, the preload bridge and the renderer.
 * Keeping them in one place means the IPC boundary is type-checked end to end.
 */

export type IncomeMethod = 'salary' | 'hourly'

export interface Profile {
  incomeBasis?: 'estimate' | 'recorded' | 'estimate-plus-extra'
  name: string
  avatarEmoji: string
  currency: string
  incomeMethod: IncomeMethod
  /** Gross annual salary, used when incomeMethod === 'salary'. */
  annualSalary: number
  /** Used when incomeMethod === 'hourly'. */
  hourlyRate: number
  hoursPerWeek: number
  /** Percentage withheld for taxes/benefits, applied to gross income. 0-100. */
  withholdingPct: number
  /** Id of a theme in `shared/themes.ts`. Unknown ids fall back to the default. */
  themeId: string
}

export interface Category {
  id: string
  name: string
  /** Planned spend for this category, per month. */
  monthlyLimit: number
  color: string
  /**
   * A recurring bill charged as one lump (rent, utilities, subscriptions) rather
   * than spending spread across the month. Pace projection is meaningless for
   * these — see `computeMonthPace` — so they are measured as paid vs. not paid.
   */
  fixed: boolean
}

export type GoalHorizon = 'year' | 'long-term'

export interface Goal {
  id: string
  name: string
  horizon: GoalHorizon
  targetAmount: number
  savedAmount: number
  /** ISO yyyy-mm-dd. */
  targetDate: string
  createdAt: string
}

export type TransactionKind = 'expense' | 'income'

export interface Transaction {
  id: string
  /** ISO yyyy-mm-dd. */
  date: string
  description: string
  /** Always stored positive; `kind` carries the direction. */
  amount: number
  kind: TransactionKind
  categoryId: string | null
  source: 'manual' | 'csv'
  createdAt: string
  /** Old transactions are treated as already reviewed. */
  reviewed?: boolean
  /** Explicit link to a scheduled bill occurrence; used to prevent double entry. */
  billId?: string
  billDueDate?: string
}

export interface CategoryRule {
  id: string
  contains: string
  categoryId: string
}

export interface Bill {
  id: string
  name: string
  amount: number
  categoryId: string
  startDate: string
  frequency: 'monthly' | 'yearly'
}

export type NewBill = Omit<Bill, 'id'> & { id?: string }
export type NewCategoryRule = Omit<CategoryRule, 'id'> & { id?: string }

export type CsvColumns = Partial<Record<'date' | 'description' | 'amount' | 'debit' | 'credit' | 'category', string>>
export interface ImportPreset {
  id: string
  name: string
  columns: CsvColumns
  positiveIsExpense: boolean
  dayFirst: boolean
}

export interface AppData {
  /** Schema version, so a future release can migrate an older file. */
  version: number
  profile: Profile
  categories: Category[]
  goals: Goal[]
  transactions: Transaction[]
  rules: CategoryRule[]
  bills: Bill[]
  importPresets: ImportPreset[]
}

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'source'> & {
  source?: Transaction['source']
}
export type NewCategory = Omit<Category, 'id' | 'fixed'> & { id?: string; fixed?: boolean }
export type NewGoal = Omit<Goal, 'id' | 'createdAt'> & { id?: string }
