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

export function billsForMonth(
  data: Pick<AppData, 'bills' | 'transactions'>,
  month: string
): BillOccurrence[] {
  // An occurrence is identified by its scheduled month, even when payment was
  // recorded early or late in a different month. Index once for large histories.
  const payments = new Map<string, Transaction>()
  for (const transaction of data.transactions) {
    if (
      transaction.billId &&
      transaction.billDueDate?.slice(0, 7) === month &&
      !payments.has(transaction.billId)
    ) {
      payments.set(transaction.billId, transaction)
    }
  }
  return data.bills
    .flatMap((bill) => {
      const dueDate = billDate(bill, month)
      return dueDate
        ? [
            {
              bill,
              dueDate,
              transaction: payments.get(bill.id)
            }
          ]
        : []
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.bill.name.localeCompare(b.bill.name))
}
