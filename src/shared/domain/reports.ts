import type { Transaction } from '../types'
import { fromISODate, monthKeyOf } from './dates'
import { round2 } from './money'

/** Reports use recorded activity only; salary estimates never become actual income. */
export function monthlyReport(txs: Transaction[], endMonth: string, count = 6) {
  const end = fromISODate(`${endMonth}-01`)
  return Array.from({ length: count }, (_, i) => {
    const month = monthKeyOf(new Date(end.getFullYear(), end.getMonth() - count + i + 1, 1))
    const rows = txs.filter((t) => t.date.startsWith(month))
    const income = round2(rows.filter((t) => t.kind === 'income').reduce((s, t) => s + t.amount, 0))
    const expense = round2(
      rows.filter((t) => t.kind === 'expense').reduce((s, t) => s + t.amount, 0)
    )
    return { month, income, expense, net: round2(income - expense), count: rows.length }
  })
}
