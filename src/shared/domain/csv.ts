import type { CsvColumns, NewTransaction, TransactionKind } from '../types'
import { isISODate, toISODate } from './dates'
import { round2 } from './money'

/** A minimal RFC4180 parser: quoted fields, escaped quotes, CRLF or LF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      field += char
    }
  }
  row.push(field)
  if (row.some((c) => c.trim() !== '')) rows.push(row)
  return rows
}

/** Header aliases seen across common bank exports. */
const HEADERS = {
  date: ['date', 'transaction date', 'posted date', 'post date', 'posting date'],
  description: [
    'description',
    'name',
    'memo',
    'payee',
    'details',
    'merchant',
    'original description'
  ],
  amount: ['amount', 'transaction amount'],
  debit: ['debit', 'withdrawal', 'withdrawals', 'money out'],
  credit: ['credit', 'deposit', 'deposits', 'money in'],
  category: ['category', 'type']
}

function findColumn(header: string[], aliases: string[]): number {
  return header.findIndex((h) => aliases.includes(h.trim().toLowerCase().replace(/^﻿/, '')))
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[$,\s]/g, '').replace(/^\((.*)\)$/, '-$1')
  if (cleaned === '' || cleaned === '-') return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

/** Accepts yyyy-mm-dd, mm/dd/yyyy and mm/dd/yy. */
export function parseDate(raw: string, dayFirst = false): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isISODate(s) ? s : null
  const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  if (slash) {
    const [, first, second, y] = slash
    const [m, d] = dayFirst ? [second, first] : [first, second]
    const year = y.length === 2 ? 2000 + Number(y) : Number(y)
    const date = new Date(year, Number(m) - 1, Number(d))
    if (
      date.getFullYear() === year &&
      date.getMonth() === Number(m) - 1 &&
      date.getDate() === Number(d)
    )
      return toISODate(date)
    return null
  }
  const parsed = new Date(s)
  return Number.isNaN(parsed.getTime()) ? null : toISODate(parsed)
}

export interface CsvImportOptions {
  columns?: CsvColumns
  dayFirst?: boolean
  /**
   * Some exports write expenses as positive numbers in a single Amount column.
   * When false (the default) a negative amount is treated as an expense.
   */
  positiveIsExpense?: boolean
  /** Maps a CSV category label to an existing category id. */
  resolveCategoryId?: (label: string) => string | null
}

export interface CsvImportResult {
  transactions: NewTransaction[]
  /** Human-readable reasons rows were skipped, one per row, capped by the caller. */
  errors: string[]
  skipped: number
  /** Column headers the parser actually recognised, for the preview UI. */
  detected: { date: string; description: string; amount: string }
}

export function importCsv(text: string, options: CsvImportOptions = {}): CsvImportResult {
  const rows = parseCsv(text)
  const errors: string[] = []
  if (rows.length < 2) {
    return {
      transactions: [],
      errors: ['The file has no data rows.'],
      skipped: 0,
      detected: { date: '', description: '', amount: '' }
    }
  }

  const header = rows[0]
  const column = (key: keyof CsvColumns): number => {
    const mapped = options.columns?.[key]
    if (mapped === '') return -1
    if (mapped === undefined) return findColumn(header, HEADERS[key])
    const index = header.indexOf(mapped)
    if (index < 0)
      errors.push(
        `The saved ${key} column "${mapped}" is missing. Choose a column or use auto-detect.`
      )
    return index
  }
  const dateCol = column('date')
  const descCol = column('description')
  const amountCol = column('amount')
  const debitCol = column('debit')
  const creditCol = column('credit')
  const catCol = column('category')

  if (dateCol === -1)
    errors.push('No date column found (expected one of: Date, Transaction Date, Posted Date).')
  if (amountCol === -1 && debitCol === -1 && creditCol === -1)
    errors.push('No amount column found (expected Amount, or Debit/Credit).')
  if (errors.length) {
    return {
      transactions: [],
      errors,
      skipped: rows.length - 1,
      detected: { date: '', description: '', amount: '' }
    }
  }

  const transactions: NewTransaction[] = []
  let skipped = 0

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    const isoDate = parseDate(cells[dateCol] ?? '', options.dayFirst)
    if (!isoDate) {
      skipped++
      if (errors.length < 5)
        errors.push(`Row ${i + 1}: could not read the date "${cells[dateCol] ?? ''}".`)
      continue
    }

    let signed: number | null = null
    if (amountCol !== -1) {
      signed = parseAmount(cells[amountCol] ?? '')
      if (signed !== null && options.positiveIsExpense) signed = -signed
    } else {
      const debit = debitCol !== -1 ? parseAmount(cells[debitCol] ?? '') : null
      const credit = creditCol !== -1 ? parseAmount(cells[creditCol] ?? '') : null
      if (debit) signed = -Math.abs(debit)
      else if (credit) signed = Math.abs(credit)
    }

    if (signed === null || signed === 0) {
      skipped++
      if (errors.length < 5) errors.push(`Row ${i + 1}: could not read an amount.`)
      continue
    }

    const kind: TransactionKind = signed < 0 ? 'expense' : 'income'
    const label = (catCol !== -1 ? cells[catCol] : '')?.trim() ?? ''
    transactions.push({
      date: isoDate,
      description: (cells[descCol] ?? '').trim() || 'Imported transaction',
      amount: round2(Math.abs(signed)),
      kind,
      categoryId: label && options.resolveCategoryId ? options.resolveCategoryId(label) : null,
      source: 'csv'
    })
  }

  return {
    transactions,
    errors,
    skipped,
    detected: {
      date: header[dateCol] ?? '',
      description: descCol !== -1 ? header[descCol] : '(none)',
      amount:
        amountCol !== -1
          ? header[amountCol]
          : `${header[debitCol] ?? ''}/${header[creditCol] ?? ''}`
    }
  }
}

/** Same date + same amount + same description already on file. */
export function isDuplicate(
  candidate: NewTransaction,
  existing: { date: string; amount: number; description: string; kind?: TransactionKind }[]
): boolean {
  return existing.some(
    (t) =>
      t.date === candidate.date &&
      (t.kind === undefined || t.kind === candidate.kind) &&
      Math.abs(t.amount - candidate.amount) < 0.005 &&
      t.description.trim().toLowerCase() === candidate.description.trim().toLowerCase()
  )
}

/** Index once so importing a long statement doesn't repeatedly scan all stored history. */
export function withoutDuplicates<T extends NewTransaction>(
  candidates: T[],
  existing: NewTransaction[]
): T[] {
  const key = (t: NewTransaction): string =>
    JSON.stringify([
      t.date,
      Math.abs(round2(t.amount)).toFixed(2),
      t.description.trim().toLowerCase(),
      t.kind
    ])
  const seen = new Set(existing.map(key))
  return candidates.filter((t) => {
    const identity = key(t)
    if (seen.has(identity)) return false
    seen.add(identity)
    return true
  })
}
