import { randomUUID } from 'crypto'
import { toISODate } from '../../shared/domain/dates'
import { CATEGORY_PALETTE } from '../../shared/palette'
import { DEFAULT_THEME_ID } from '../../shared/themes'
import type { AppData, Category, Goal, Transaction } from '../../shared/types'

export function defaultCategories(): Category[] {
  // [name, monthly limit, is it a fixed recurring bill?]
  const names: [string, number, boolean][] = [
    ['Rent & Housing', 1800, true],
    ['Groceries', 500, false],
    ['Dining Out', 250, false],
    ['Transport', 150, false],
    ['Utilities', 180, true],
    ['Subscriptions', 60, true],
    ['Shopping', 200, false],
    ['Fun', 150, false]
  ]
  return names.map(([name, monthlyLimit, fixed], i) => ({
    id: slug(name),
    name,
    monthlyLimit,
    fixed,
    color: CATEGORY_PALETTE[i % CATEGORY_PALETTE.length]
  }))
}

export function slug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || randomUUID()
}

export function defaultAppData(): AppData {
  return {
    version: 2,
    profile: {
      incomeBasis: 'estimate',
      name: '',
      avatarEmoji: '🙂',
      currency: 'USD',
      incomeMethod: 'salary',
      annualSalary: 0,
      hourlyRate: 0,
      hoursPerWeek: 40,
      withholdingPct: 25,
      themeId: DEFAULT_THEME_ID
    },
    categories: defaultCategories(),
    goals: [],
    transactions: [],
    rules: [],
    bills: [],
    importPresets: []
  }
}

/** Populates a believable month so the app can be demoed without data entry. */
export function demoAppData(today = new Date()): AppData {
  const base = defaultAppData()
  const categories = base.categories
  const year = today.getFullYear()

  const goals: Goal[] = [
    {
      id: randomUUID(),
      name: 'Car fund',
      horizon: 'year',
      targetAmount: 18_000,
      savedAmount: 12_400,
      targetDate: `${year}-12-31`,
      createdAt: new Date().toISOString()
    },
    {
      id: randomUUID(),
      name: 'House down payment',
      horizon: 'long-term',
      targetAmount: 90_000,
      savedAmount: 21_000,
      targetDate: `${year + 4}-06-30`,
      createdAt: new Date().toISOString()
    }
  ]

  const plan: [string, string, number, number][] = [
    // category name, description, amount, days ago
    ['Rent & Housing', 'Monthly rent', 1800, 26],
    ['Groceries', 'Trader Joes', 96.4, 24],
    ['Dining Out', 'Ramen with Kevin', 38.5, 22],
    ['Transport', 'Metro card', 45, 21],
    ['Groceries', 'Costco run', 142.15, 18],
    ['Utilities', 'Electric bill', 88.2, 16],
    ['Subscriptions', 'Spotify + iCloud', 21.98, 15],
    ['Dining Out', 'Coffee, twice', 11.4, 13],
    ['Shopping', 'Running shoes', 129, 11],
    ['Groceries', 'Whole Foods', 71.35, 9],
    ['Fun', 'Concert tickets', 96, 7],
    ['Dining Out', 'Birthday dinner', 84.7, 5],
    ['Transport', 'Rideshare home', 23.4, 3],
    ['Groceries', 'Corner store', 34.1, 1]
  ]

  const transactions: Transaction[] = plan.map(([categoryName, description, amount, daysAgo]) => {
    const date = new Date(today)
    date.setDate(date.getDate() - daysAgo)
    return {
      id: randomUUID(),
      date: toISODate(date),
      description,
      amount,
      kind: 'expense' as const,
      categoryId: categories.find((c) => c.name === categoryName)?.id ?? null,
      source: 'manual' as const,
      createdAt: new Date().toISOString()
    }
  })

  return {
    ...base,
    profile: {
      ...base.profile,
      name: 'Stanley',
      annualSalary: 96_000,
      withholdingPct: 25
    },
    goals,
    transactions
  }
}
