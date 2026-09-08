import type { AppData, Bill, Transaction } from '../types'
import { daysInMonth } from './dates'

export interface BillOccurrence {
  bill: Bill
  dueDate: string
  transaction?: Transaction
}

/** Anchor to the original day: Jan 31 -> Feb 28 -> Mar 31, including leap years. */
export function billDate(bill: Bill, month: string): string | null {
  if (month < bill.startDate.slice(0, 7)) return null
  const [year, monthNumber] = month.split('-').map(Number)
  if (bill.frequency === 'yearly' && monthNumber !== Number(bill.startDate.slice(5, 7))) return null
  const day = Math.min(Number(bill.startDate.slice(8)), daysInMonth(year, monthNumber))
  return `${month}-${String(day).padStart(2, '0')}`
}

export function billsForMonth(data: AppData, month: string): BillOccurrence[] {
  return data.bills
    .flatMap((bill) => {
      const dueDate = billDate(bill, month)
      return dueDate
        ? [
            {
              bill,
              dueDate,
              transaction: data.transactions.find(
                (t) => t.billId === bill.id && t.billDueDate?.slice(0, 7) === month
              )
            }
          ]
        : []
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.bill.name.localeCompare(b.bill.name))
}
