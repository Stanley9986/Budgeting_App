import type { AppData, Category, Profile, Transaction } from '../types'
import { daysInMonth, monthKey } from './dates'
import { requiredMonthlySavings } from './goals'
import { round2 } from './money'

/**
 * The colour system from the product notes:
 *   green  - on track: projected spend is inside the budget AND goals stay reachable
 *   yellow - over budget a little, but the goals are still reachable this month
 *   red    - at this pace the month's saving falls short of what the goals need
 *
 * Note the colour is anchored to *goal attainment*, not to the budget alone.
 * Being over budget only matters if it costs you the goal.
 */
export type PaceStatus = 'green' | 'yellow' | 'red'

export interface CategoryPace {
  category: Category
  spent: number
  /**
   * Straight-line share of the limit that "should" be spent by today. For a
   * fixed bill this is the whole limit — it is owed this month either way.
   */
  expectedByNow: number
  /** Month-end spend if the current pattern holds. */
  projected: number
  remaining: number
  /** spent / limit, unclamped so the UI can show > 100%. */
  ratio: number
  status: PaceStatus
}

export interface MonthPace {
  monthKey: string
  /** 0-1: how far through the month we are (day 1 is never 0). */
  elapsed: number
  daysLeft: number
  income: number
  budgetTotal: number
  spent: number
  expectedByNow: number
  projectedSpend: number
  projectedSavings: number
  requiredSavings: number
  /** projectedSavings - requiredSavings; negative means the goals slip. */
  savingsGap: number
  status: PaceStatus
  categories: CategoryPace[]
  uncategorizedSpend: number
}

export function monthlyIncome(profile: Profile): number {
  const gross =
    profile.incomeMethod === 'salary'
      ? profile.annualSalary / 12
      : (profile.hourlyRate * profile.hoursPerWeek * 52) / 12
  const net = gross * (1 - clamp(profile.withholdingPct, 0, 100) / 100)
  return round2(Math.max(0, net))
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

/** How far through the month `today` is. Day 1 counts as one full day. */
export function elapsedFraction(today: Date, key: string): number {
  const [year, month] = key.split('-').map(Number)
  const total = daysInMonth(year, month)
  const isSameMonth = today.getFullYear() === year && today.getMonth() + 1 === month
  if (!isSameMonth) {
    const isPast =
      today.getFullYear() > year || (today.getFullYear() === year && today.getMonth() + 1 > month)
    return isPast ? 1 : 1 / total
  }
  return clamp(today.getDate() / total, 1 / total, 1)
}

export function transactionsForMonth(txs: Transaction[], key: string): Transaction[] {
  return txs.filter((t) => monthKey(t.date) === key)
}

/** Every yyyy-mm that has at least one transaction — drives the month picker's dots. */
export function activeMonths(txs: Transaction[]): Set<string> {
  return new Set(txs.map((t) => monthKey(t.date)))
}

/**
 * A fixed bill is binary — it is either paid or it is not. Projecting it from a
 * daily rate would say rent paid on the 1st is heading for 30x the budget.
 */
function fixedStatus(limit: number, spent: number): PaceStatus {
  if (limit <= 0) return spent > 0 ? 'red' : 'green'
  return spent > limit + 0.005 ? 'red' : 'green'
}

/**
 * The tolerance bands matter even for variable spending: a lumpy purchase early
 * in the month makes the straight-line projection overshoot, so a category is
 * only flagged once the projection is meaningfully past its limit.
 */
function variableStatus(projected: number, limit: number, spent: number): PaceStatus {
  if (limit <= 0) return spent > 0 ? 'red' : 'green'
  if (spent > limit + 0.005 || projected > limit * 1.25) return 'red'
  if (projected > limit * 1.1) return 'yellow'
  return 'green'
}

export function overallStatus(
  projectedSpend: number,
  budgetTotal: number,
  projectedSavings: number,
  requiredSavings: number
): PaceStatus {
  const goalsReachable = projectedSavings >= requiredSavings - 0.005
  if (!goalsReachable) return 'red'
  const withinBudget = budgetTotal <= 0 || projectedSpend <= budgetTotal + 0.005
  return withinBudget ? 'green' : 'yellow'
}

export function computeMonthPace(data: AppData, key: string, today = new Date()): MonthPace {
  const [year, month] = key.split('-').map(Number)
  const totalDays = daysInMonth(year, month)
  const elapsed = elapsedFraction(today, key)
  const monthTxs = transactionsForMonth(data.transactions, key)

  const spentByCategory = new Map<string, number>()
  const fixedIds = new Set(data.categories.filter((c) => c.fixed).map((c) => c.id))
  let spent = 0
  let extraIncome = 0
  let uncategorizedSpend = 0
  let variableSpent = 0

  for (const t of monthTxs) {
    if (t.kind === 'income') {
      extraIncome += t.amount
      continue
    }
    spent += t.amount
    if (t.categoryId) {
      spentByCategory.set(t.categoryId, (spentByCategory.get(t.categoryId) ?? 0) + t.amount)
      if (!fixedIds.has(t.categoryId)) variableSpent += t.amount
    } else {
      uncategorizedSpend += t.amount
      // Spend with no category is treated as variable — it is day-to-day money.
      variableSpent += t.amount
    }
  }

  const categories: CategoryPace[] = data.categories.map((category) => {
    const catSpent = round2(spentByCategory.get(category.id) ?? 0)
    // A fixed bill that has not been charged yet is still owed, so its month-end
    // figure is the limit; once charged, whatever was actually charged.
    const projected = category.fixed
      ? round2(Math.max(catSpent, category.monthlyLimit))
      : round2(catSpent / elapsed)
    return {
      category,
      spent: catSpent,
      expectedByNow: round2(category.fixed ? category.monthlyLimit : category.monthlyLimit * elapsed),
      projected,
      remaining: round2(category.monthlyLimit - catSpent),
      ratio: category.monthlyLimit > 0 ? catSpent / category.monthlyLimit : catSpent > 0 ? 1 : 0,
      status: category.fixed
        ? fixedStatus(category.monthlyLimit, catSpent)
        : variableStatus(projected, category.monthlyLimit, catSpent)
    }
  })

  const budgetTotal = round2(data.categories.reduce((s, c) => s + c.monthlyLimit, 0))
  const fixedBudget = round2(
    data.categories.filter((c) => c.fixed).reduce((s, c) => s + c.monthlyLimit, 0)
  )
  const variableBudget = round2(budgetTotal - fixedBudget)

  // Fixed bills are committed in full; only variable spending gets extrapolated
  // from the daily rate. Projecting the whole month's spend off a rent payment
  // made on the 1st is the single biggest source of a wrong month-end number.
  const fixedCommitted = round2(
    categories.filter((c) => c.category.fixed).reduce((s, c) => s + c.projected, 0)
  )
  const income = round2(monthlyIncome(data.profile) + extraIncome)
  const projectedSpend = round2(fixedCommitted + variableSpent / elapsed)
  const projectedSavings = round2(income - projectedSpend)
  const required = requiredMonthlySavings(data.goals, today)

  return {
    monthKey: key,
    elapsed,
    daysLeft: Math.max(0, totalDays - Math.round(elapsed * totalDays)),
    income,
    budgetTotal,
    spent: round2(spent),
    expectedByNow: round2(fixedBudget + variableBudget * elapsed),
    projectedSpend,
    projectedSavings,
    requiredSavings: required,
    savingsGap: round2(projectedSavings - required),
    status: overallStatus(projectedSpend, budgetTotal, projectedSavings, required),
    categories,
    uncategorizedSpend: round2(uncategorizedSpend)
  }
}

export const STATUS_COPY: Record<PaceStatus, { label: string; blurb: string }> = {
  green: { label: "You're on track", blurb: 'Awesome — keep this pace and you hit your goals.' },
  yellow: {
    label: 'A little over budget',
    blurb: 'Spending is past plan, but your goals are still within reach.'
  },
  red: {
    label: "You're way over budget",
    blurb: 'At this pace this month puts your goals out of reach.'
  }
}
