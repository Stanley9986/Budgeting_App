import type { CsvColumns, NewTransaction, TransactionKind } from '../types'
import { isISODate } from './dates'
import { round2 } from './money'

/**
 * RFC4180 fields with CRLF or LF records. Reject broken quoting instead of
 * silently combining transactions or shifting their columns. The preview can
 * show these errors; callers reading headers directly must also catch them.
 */
export function parseCsv(text: string): string[][] {
  text = text.replace(/^\uFEFF/, '')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let afterQuote = false
  let line = 1

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
          afterQuote = true
        }
      } else {
        field += char
        if (char === '\n' || (char === '\r' && text[i + 1] !== '\n')) line++
      }
      continue
    }
    if (char === '"') {
      if (field || afterQuote) {
        throw new Error(`CSV line ${line}: unexpected quote in an unquoted field.`)
      }
      inQuotes = true
    } else if (char === ',') {
      row.push(field)
      field = ''
      afterQuote = false
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      field = ''
      afterQuote = false
      line++
      if (row.some((c) => c.trim() !== '')) rows.push(row)
      row = []
    } else {
      if (afterQuote) {
        // Some bank exports pad a quoted field before its comma.
        if (char === ' ' || char === '\t') continue
        throw new Error(`CSV line ${line}: unexpected text after a closing quote.`)
      }
      field += char
    }
  }
  if (inQuotes) throw new Error(`CSV line ${line}: a quoted field is missing its closing quote.`)
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
  return header.findIndex((h) => aliases.includes(h.trim().toLowerCase()))
}

function parseAmount(raw: string): number | null {
  const cleaned = raw
    .trim()
    .replace(/^\((.*)\)$/, '-$1')
    .replace(/^([+-]?)\s*\$\s*([+-]?)/, '$1$2')
    .trim()
  // Number() also accepts hex and scientific notation. Bank amounts use plain
  // decimals; validate comma grouping before stripping separators.
  if (!/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d+)?|\.\d+)$/.test(cleaned)) return null
  const n = Number(cleaned.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

/** Explicit calendar formats only: ISO, or slash/dash month/day (optionally day-first). */
export function parseDate(raw: string, dayFirst = false): string | null {
  const s = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return isISODate(s) ? s : null
  const slash = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/)
  if (slash) {
    const [, first, second, y] = slash
    const [m, d] = dayFirst ? [second, first] : [first, second]
    const year = y.length === 2 ? 2000 + Number(y) : Number(y)
    const date = `${String(year).padStart(4, '0')}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
    return isISODate(date) ? date : null
  }
  // Date.parse varies across runtimes and can normalize February 30 or apply a
  // timezone shift to a bank's date-only value. Unsupported formats need an
  // explicit parser before they can safely be accepted.
  return null
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
  let rows: string[][]
  try {
    rows = parseCsv(text)
  } catch (error) {
    return {
      transactions: [],
      errors: [error instanceof Error ? error.message : 'Could not parse the CSV file.'],
      skipped: 0,
      detected: { date: '', description: '', amount: '' }
    }
  }
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
    const index = mapped === undefined ? findColumn(header, HEADERS[key]) : header.indexOf(mapped)
    if (index < 0 && mapped !== undefined) {
      errors.push(
        `The saved ${key} column "${mapped}" is missing. Choose a column or use auto-detect.`
      )
    } else if (index >= 0) {
      const label = header[index].trim().toLowerCase()
      if (header.some((h, i) => i !== index && h.trim().toLowerCase() === label)) {
        errors.push(`The ${key} header "${header[index]}" appears more than once. Rename duplicate headers before importing.`)
      }
    }
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
  const skip = (row: number, reason: string): void => {
    skipped++
    if (errors.length < 5) errors.push(`Row ${row}: ${reason}`)
  }

  for (let i = 1; i < rows.length; i++) {
    const cells = rows[i]
    if (cells.length !== header.length) {
      skip(i + 1, `expected ${header.length} columns, found ${cells.length}. Check commas and quoting.`)
      continue
    }
    const isoDate = parseDate(cells[dateCol] ?? '', options.dayFirst)
    if (!isoDate) {
      skip(i + 1, `could not read the date "${cells[dateCol] ?? ''}". Use YYYY-MM-DD or a slash date.`)
      continue
    }

    let signed: number | null = null
    if (amountCol !== -1) {
      signed = parseAmount(cells[amountCol] ?? '')
      if (signed !== null && options.positiveIsExpense) signed = -signed
    } else {
      const debit = debitCol !== -1 ? parseAmount(cells[debitCol] ?? '') : null
      const credit = creditCol !== -1 ? parseAmount(cells[creditCol] ?? '') : null
      const hasInvalidValue = [debitCol, creditCol].some((col) => {
        const raw = (cells[col] ?? '').trim()
        // Blank cells and dash placeholders both represent an unused side.
        return col !== -1 && raw !== '' && raw !== '-' && parseAmount(raw) === null
      })
      if (hasInvalidValue || (debit && credit)) {
        skip(
          i + 1,
          hasInvalidValue
            ? 'could not read a debit or credit amount.'
            : 'both debit and credit contain an amount; choose one amount column.'
        )
        continue
      }
      if (debit) signed = -Math.abs(debit)
      else if (credit) signed = Math.abs(credit)
    }

    const amount = signed === null ? 0 : round2(Math.abs(signed))
    if (signed === null || amount === 0 || !Number.isSafeInteger(Math.round(amount * 100))) {
      skip(i + 1, 'could not read a valid nonzero amount. Check its format and size.')
      continue
    }

    const kind: TransactionKind = signed < 0 ? 'expense' : 'income'
    const label = (catCol !== -1 ? cells[catCol] : '')?.trim() ?? ''
    transactions.push({
      date: isoDate,
      description: (cells[descCol] ?? '').trim() || 'Imported transaction',
      amount,
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
