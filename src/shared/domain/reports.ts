import type { Transaction } from '../types'
import { fromISODate, monthKey, monthKeyOf } from './dates'
import { round2 } from './money'

/** Reports use recorded activity only; salary estimates never become actual income. */
export function monthlyReport(txs: Transaction[], endMonth: string, count = 6) {
  const end = fromISODate(`${endMonth}-01`)
  const totals = new Map<string, { income: number; expense: number; count: number }>()
  // Group once; switching between six and twelve months should not repeatedly
  // scan years of imported transactions for each output month.
  for (const transaction of txs) {
    const month = monthKey(transaction.date)
    const total = totals.get(month) ?? { income: 0, expense: 0, count: 0 }
    total[transaction.kind] += transaction.amount
    total.count++
    totals.set(month, total)
  }
  return Array.from({ length: count }, (_, i) => {
    const month = monthKeyOf(new Date(end.getFullYear(), end.getMonth() - count + i + 1, 1))
    const total = totals.get(month)
    const income = round2(total?.income ?? 0)
    const expense = round2(total?.expense ?? 0)
    return { month, income, expense, net: round2(income - expense), count: total?.count ?? 0 }
  })
}
