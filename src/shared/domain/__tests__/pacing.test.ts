import { describe, expect, it } from 'vitest'
import type { AppData } from '../../types'
import { activeMonths, computeMonthPace, elapsedFraction, monthlyIncome, overallStatus } from '../pacing'

const profile: AppData['profile'] = {
  name: 'Test',
  avatarEmoji: '🙂',
  currency: 'USD',
  incomeMethod: 'salary',
  annualSalary: 120_000,
  hourlyRate: 0,
  hoursPerWeek: 0,
  withholdingPct: 0,
  themeId: 'sand'
}

function makeData(partial: Partial<AppData> = {}): AppData {
  return {
    version: 1,
    profile,
    categories: [
      { id: 'rent', name: 'Rent', monthlyLimit: 2000, color: '#7c9cff', fixed: false },
      { id: 'food', name: 'Food', monthlyLimit: 600, color: '#5fd0a4', fixed: false }
    ],
    goals: [],
    transactions: [],
    rules: [],
    bills: [],
    importPresets: [],
    ...partial
  }
}

describe('monthlyIncome', () => {
  it('divides an annual salary by twelve', () => {
    expect(monthlyIncome(profile)).toBe(10_000)
  })

  it('annualises an hourly rate', () => {
    expect(
      monthlyIncome({ ...profile, incomeMethod: 'hourly', hourlyRate: 30, hoursPerWeek: 40 })
    ).toBeCloseTo((30 * 40 * 52) / 12, 2)
  })

  it('applies withholding', () => {
    expect(monthlyIncome({ ...profile, withholdingPct: 25 })).toBe(7500)
  })

  it('keeps withholding inside 0–100% and prevents negative take-home income', () => {
    expect(monthlyIncome({ ...profile, withholdingPct: -5 })).toBe(10_000)
    expect(monthlyIncome({ ...profile, withholdingPct: 110 })).toBe(0)
    expect(monthlyIncome({ ...profile, annualSalary: -100 })).toBe(0)
  })
})

describe('elapsedFraction', () => {
  it('treats day one as one day, never zero', () => {
    expect(elapsedFraction(new Date(2026, 0, 1), '2026-01')).toBeCloseTo(1 / 31, 5)
  })

  it('is one on the last day', () => {
    expect(elapsedFraction(new Date(2026, 0, 31), '2026-01')).toBe(1)
  })

  it('counts a past month as fully elapsed', () => {
    expect(elapsedFraction(new Date(2026, 5, 10), '2026-01')).toBe(1)
  })

  it('does not count a future month as started', () => {
    expect(elapsedFraction(new Date(2026, 0, 10), '2026-06')).toBe(0)
  })
})

describe('overallStatus', () => {
  it('is green inside budget with goals funded', () => {
    expect(overallStatus(2000, 2600, 8000, 1000)).toBe('green')
  })

  it('is yellow when over budget but the goals still clear', () => {
    expect(overallStatus(3000, 2600, 7000, 1000)).toBe('yellow')
  })

  it('is red when the projected saving misses what the goals need', () => {
    expect(overallStatus(9500, 2600, 500, 1000)).toBe('red')
  })

  it('is red even inside budget if the goals are unreachable', () => {
    expect(overallStatus(2000, 2600, 8000, 9000)).toBe('red')
  })
})

describe('activeMonths', () => {
  const tx = (id: string, date: string) => ({
    id,
    date,
    description: 'x',
    amount: 1,
    kind: 'expense' as const,
    categoryId: null,
    source: 'manual' as const,
    createdAt: ''
  })

  it('is empty with no transactions', () => {
    expect(activeMonths([]).size).toBe(0)
  })

  it('collects one key per month, not per transaction', () => {
    const months = activeMonths([tx('1', '2026-01-04'), tx('2', '2026-01-19'), tx('3', '2026-03-02')])
    expect([...months].sort()).toEqual(['2026-01', '2026-03'])
  })

  it('spans years', () => {
    const months = activeMonths([tx('1', '2025-12-31'), tx('2', '2026-01-01')])
    expect(months.has('2025-12')).toBe(true)
    expect(months.has('2026-01')).toBe(true)
  })
})

describe('fixed recurring bills', () => {
  const rentFixed = { id: 'rent', name: 'Rent', monthlyLimit: 1800, color: '#7c9cff', fixed: true }

  function withRent(spent: number, day: number): AppData {
    return makeData({
      categories: [rentFixed],
      transactions: spent
        ? [
            {
              id: '1',
              date: `2026-01-0${day}`,
              description: 'Rent',
              amount: spent,
              kind: 'expense' as const,
              categoryId: 'rent',
              source: 'manual' as const,
              createdAt: ''
            }
          ]
        : []
    })
  }

  it('is green the day rent is paid, not "20x over pace"', () => {
    // The bug this replaces: 1800 spent in 2/31 of the month projected to 27,900.
    const rent = computeMonthPace(withRent(1800, 1), '2026-01', new Date(2026, 0, 2)).categories[0]
    expect(rent.status).toBe('green')
    expect(rent.projected).toBe(1800)
  })

  it('still owes the full limit before the bill is charged', () => {
    const rent = computeMonthPace(withRent(0, 1), '2026-01', new Date(2026, 0, 10)).categories[0]
    expect(rent.spent).toBe(0)
    expect(rent.projected).toBe(1800)
    expect(rent.status).toBe('green')
  })

  it('goes red when the bill comes in above its limit', () => {
    const rent = computeMonthPace(withRent(1900, 1), '2026-01', new Date(2026, 0, 2)).categories[0]
    expect(rent.status).toBe('red')
  })

  it('commits fixed bills in full and extrapolates only variable spend', () => {
    const data = makeData({
      categories: [
        { id: 'rent', name: 'Rent', monthlyLimit: 2000, color: '#7c9cff', fixed: true },
        { id: 'food', name: 'Food', monthlyLimit: 600, color: '#5fd0a4', fixed: false }
      ],
      transactions: [
        {
          id: '1',
          date: '2026-01-02',
          description: 'Rent',
          amount: 1800,
          kind: 'expense',
          categoryId: 'rent',
          source: 'manual',
          createdAt: ''
        },
        {
          id: '2',
          date: '2026-01-05',
          description: 'Groceries',
          amount: 200,
          kind: 'expense',
          categoryId: 'food',
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    const pace = computeMonthPace(data, '2026-01', new Date(2026, 0, 10))
    // rent committed at its 2000 limit + food's 200 over 10/31 of the month
    expect(pace.projectedSpend).toBeCloseTo(2000 + 620, 2)
  })

  it('treats spend with no category as variable', () => {
    const data = makeData({
      categories: [rentFixed],
      transactions: [
        {
          id: '1',
          date: '2026-01-05',
          description: 'Mystery',
          amount: 100,
          kind: 'expense',
          categoryId: null,
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    const pace = computeMonthPace(data, '2026-01', new Date(2026, 0, 10))
    expect(pace.projectedSpend).toBeCloseTo(1800 + 310, 2)
  })
})

describe('computeMonthPace', () => {
  const today = new Date(2026, 0, 10) // Jan 10 -> 10/31 of the month elapsed

  it('uses actual fixed expenses for a closed month and ignores unrecorded schedules', () => {
    const data = makeData({
      categories: [{ id: 'rent', name: 'Rent', monthlyLimit: 1800, color: '#fff', fixed: true }],
      bills: [{ id: 'bill', name: 'Rent', categoryId: 'rent', amount: 1800, startDate: '2025-01-01', frequency: 'monthly' }],
      transactions: [{ id: 'rent-tx', date: '2025-12-01', description: 'Rent discount', amount: 1700, kind: 'expense', categoryId: 'rent', source: 'manual', createdAt: '' }]
    })
    const pace = computeMonthPace(data, '2025-12', today)
    expect(pace).toMatchObject({ period: 'past', elapsed: 1, daysLeft: 0, spent: 1700, projectedSpend: 1700 })
    expect(pace.categories[0].projected).toBe(1700)
    expect(computeMonthPace({ ...data, transactions: [] }, '2025-12', today).projectedSpend).toBe(0)
  })

  it('counts future entries once and reserves fixed commitments without a fictional daily rate', () => {
    const data = makeData({
      categories: [
        { id: 'rent', name: 'Rent', monthlyLimit: 1800, color: '#fff', fixed: true },
        { id: 'food', name: 'Food', monthlyLimit: 600, color: '#fff', fixed: false }
      ],
      transactions: [{ id: 'food-tx', date: '2026-02-10', description: 'Preordered groceries', amount: 100, kind: 'expense', categoryId: 'food', source: 'manual', createdAt: '' }]
    })
    const pace = computeMonthPace(data, '2026-02', today)
    expect(pace).toMatchObject({ period: 'future', elapsed: 0, daysLeft: 28, spent: 100, projectedSpend: 1900, expectedByNow: 0 })
    expect(pace.categories.find((c) => c.category.id === 'food')).toMatchObject({ projected: 100, expectedByNow: 0 })
  })

  it('adds outstanding fixed bills once and stops reserving each one after linking its payment', () => {
    const bills: AppData['bills'] = [
      { id: 'a', name: 'Internet', categoryId: 'utilities', amount: 80, startDate: '2026-01-01', frequency: 'monthly' },
      { id: 'b', name: 'Power', categoryId: 'utilities', amount: 100, startDate: '2026-01-15', frequency: 'monthly' }
    ]
    const data = makeData({
      categories: [{ id: 'utilities', name: 'Utilities', monthlyLimit: 100, color: '#fff', fixed: true }],
      bills,
      transactions: [{ id: 'payment', date: '2026-01-01', description: 'Internet', amount: 80, kind: 'expense', categoryId: 'utilities', source: 'csv', createdAt: '', billId: 'a', billDueDate: '2026-01-01' }]
    })
    expect(computeMonthPace(data, '2026-01', today).projectedSpend).toBe(180)
    expect(computeMonthPace({ ...data, transactions: [] }, '2026-01', today).projectedSpend).toBe(180)
  })

  it.each([
    ['estimate', 10_000],
    ['recorded', 500],
    ['estimate-plus-extra', 10_500]
  ] as const)('uses the %s income basis without double counting salary', (incomeBasis, income) => {
    const data = makeData({
      profile: { ...profile, incomeBasis },
      transactions: [{ id: 'salary', date: '2026-01-01', description: 'Deposit', amount: 500, kind: 'income', categoryId: null, source: 'csv', createdAt: '' }]
    })
    expect(computeMonthPace(data, '2026-01', today).income).toBe(income)
  })

  it('keeps current goal balances when inspecting historical spending', () => {
    const data = makeData({ goals: [{ id: 'g', name: 'Goal', targetAmount: 1000, savedAmount: 0, targetDate: '2026-02-10', horizon: 'year', createdAt: '' }] })
    expect(computeMonthPace(data, '2025-01', today).requiredSavings).toBe(1000)
  })

  it('projects month-end spend from the current daily rate', () => {
    const data = makeData({
      transactions: [
        {
          id: '1',
          date: '2026-01-05',
          description: 'Groceries',
          amount: 200,
          kind: 'expense',
          categoryId: 'food',
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    const pace = computeMonthPace(data, '2026-01', today)
    expect(pace.spent).toBe(200)
    expect(pace.projectedSpend).toBeCloseTo(200 / (10 / 31), 2)
  })

  it('adds income transactions on top of salary', () => {
    const data = makeData({
      transactions: [
        {
          id: '1',
          date: '2026-01-04',
          description: 'Freelance',
          amount: 500,
          kind: 'income',
          categoryId: null,
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    expect(computeMonthPace(data, '2026-01', today).income).toBe(10_500)
  })

  it('ignores transactions from other months', () => {
    const data = makeData({
      transactions: [
        {
          id: '1',
          date: '2025-12-30',
          description: 'Old',
          amount: 999,
          kind: 'expense',
          categoryId: 'food',
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    expect(computeMonthPace(data, '2026-01', today).spent).toBe(0)
  })

  it('tracks spend with no category separately', () => {
    const data = makeData({
      transactions: [
        {
          id: '1',
          date: '2026-01-06',
          description: 'Unknown',
          amount: 75,
          kind: 'expense',
          categoryId: null,
          source: 'csv',
          createdAt: ''
        }
      ]
    })
    expect(computeMonthPace(data, '2026-01', today).uncategorizedSpend).toBe(75)
  })

  it('flags a category that is pacing past its limit', () => {
    const data = makeData({
      transactions: [
        {
          id: '1',
          date: '2026-01-08',
          description: 'Restaurants',
          amount: 500,
          kind: 'expense',
          categoryId: 'food',
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    const food = computeMonthPace(data, '2026-01', today).categories.find((c) => c.category.id === 'food')!
    expect(food.projected).toBeGreaterThan(600)
    expect(food.status).toBe('red')
  })

  it('warns on a modest variable overshoot before the category is actually over budget', () => {
    const data = makeData({
      categories: [{ id: 'food', name: 'Food', monthlyLimit: 600, color: '#fff', fixed: false }],
      transactions: [{
        id: 'food', date: '2026-01-10', description: 'Groceries', amount: 230,
        kind: 'expense', categoryId: 'food', source: 'manual', createdAt: ''
      }]
    })
    const pace = computeMonthPace(data, '2026-01', today)
    expect(pace.categories[0]).toMatchObject({ spent: 230, projected: 713, status: 'yellow' })
    expect(pace.status).toBe('yellow')
  })

  it('does not divide by zero for an empty category budget, but flags spending against it', () => {
    const data = makeData({
      categories: [{ id: 'food', name: 'Food', monthlyLimit: 0, color: '#fff', fixed: false }]
    })
    expect(computeMonthPace(data, '2026-01', today).categories[0]).toMatchObject({ ratio: 0, status: 'green' })
    data.transactions.push({
      id: 'food', date: '2026-01-10', description: 'Groceries', amount: 1,
      kind: 'expense', categoryId: 'food', source: 'manual', createdAt: ''
    })
    expect(computeMonthPace(data, '2026-01', today).categories[0]).toMatchObject({ ratio: 1, status: 'red' })
  })

  it('does not flag a fixed monthly charge that landed on budget', () => {
    // Rent is one lump on the 1st: near the end of the month the straight-line
    // projection overshoots slightly, and that must not read as "over budget".
    const data = makeData({
      categories: [{ id: 'rent', name: 'Rent', monthlyLimit: 1800, color: '#7c9cff', fixed: false }],
      transactions: [
        {
          id: '1',
          date: '2026-01-01',
          description: 'Rent',
          amount: 1800,
          kind: 'expense',
          categoryId: 'rent',
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    const rent = computeMonthPace(data, '2026-01', new Date(2026, 0, 29)).categories[0]
    expect(rent.status).toBe('green')
  })

  it('goes red the moment a category is actually overspent', () => {
    const data = makeData({
      transactions: [
        {
          id: '1',
          date: '2026-01-02',
          description: 'Splurge',
          amount: 700,
          kind: 'expense',
          categoryId: 'food',
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    const food = computeMonthPace(data, '2026-01', new Date(2026, 0, 29)).categories.find(
      (c) => c.category.id === 'food'
    )!
    expect(food.status).toBe('red')
  })

  it('turns red once a goal can no longer be funded', () => {
    const data = makeData({
      goals: [
        {
          id: 'car',
          name: 'Car',
          horizon: 'year',
          targetAmount: 50_000,
          savedAmount: 0,
          targetDate: '2026-12-31',
          createdAt: ''
        }
      ],
      transactions: [
        {
          id: '1',
          date: '2026-01-09',
          description: 'Spree',
          amount: 2000,
          kind: 'expense',
          categoryId: 'food',
          source: 'manual',
          createdAt: ''
        }
      ]
    })
    const pace = computeMonthPace(data, '2026-01', today)
    expect(pace.requiredSavings).toBeGreaterThan(4000)
    expect(pace.status).toBe('red')
  })
})
