import type { Category, Transaction } from '../types'

/** Quote RFC4180 text and prevent a merchant name from becoming a spreadsheet formula. */
function cell(text: string): string {
  const safe = /^[\s]*[=+@-]/.test(text) || /^[\t\r\n]/.test(text) ? `'${text}` : text
  return `"${safe.replace(/"/g, '""')}"`
}

export function exportTransactions(txs: Transaction[], categories: Category[]): string {
  const names = new Map(categories.map((c) => [c.id, c.name]))
  return (
    [
      'Date,Description,Amount,Category,Kind,Reviewed',
      ...txs.map((t) =>
        [
          t.date,
          cell(t.description),
          (t.kind === 'expense' ? -t.amount : t.amount).toFixed(2),
          cell(names.get(t.categoryId ?? '') ?? ''),
          t.kind,
          String(t.reviewed !== false)
        ].join(',')
      )
    ].join('\r\n') + '\r\n'
  )
}
