import type { AppData } from '../../shared/types'
import { isISODate } from '../../shared/domain/dates'

function assert(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(message)
}
const nonnegative = (v: unknown): boolean => typeof v === 'number' && Number.isFinite(v) && v >= 0
const text = (v: unknown): boolean => typeof v === 'string'

/** Check the complete candidate before any restore or disk write can replace real data. */
export function validateData(data: AppData): AppData {
  assert(data && typeof data === 'object', 'Invalid budget file.')
  assert(data.version === 2, 'Unsupported budget schema version.')
  const p = data.profile
  assert(
    p?.incomeBasis === undefined ||
      ['estimate', 'recorded', 'estimate-plus-extra'].includes(p.incomeBasis),
    'Invalid income basis.'
  )
  assert(p && text(p.name) && text(p.avatarEmoji) && text(p.themeId), 'Invalid profile.')
  assert(/^[A-Z]{3}$/.test(p.currency), 'Invalid currency.')
  assert(['salary', 'hourly'].includes(p.incomeMethod), 'Invalid income method.')
  assert(
    [p.annualSalary, p.hourlyRate, p.hoursPerWeek, p.withholdingPct].every(nonnegative) &&
      p.hoursPerWeek <= 168 &&
      p.withholdingPct <= 100,
    'Invalid income values.'
  )
  for (const key of [
    'categories',
    'goals',
    'transactions',
    'rules',
    'bills',
    'importPresets'
  ] as const) {
    assert(Array.isArray(data[key]), `Invalid ${key}.`)
    const ids = new Set<string>()
    for (const item of data[key]) {
      assert(
        item && typeof item === 'object' && text(item.id) && item.id && !ids.has(item.id),
        `Invalid or duplicate ID in ${key}.`
      )
      ids.add(item.id)
    }
  }
  const categories = new Map(data.categories.map((c) => [c.id, c]))
  for (const preset of data.importPresets) {
    assert(
      text(preset.name) &&
        preset.name.trim() &&
        typeof preset.positiveIsExpense === 'boolean' &&
        typeof preset.dayFirst === 'boolean' &&
        preset.columns &&
        typeof preset.columns === 'object' &&
        Object.entries(preset.columns).every(
          ([key, value]) =>
            ['date', 'description', 'amount', 'debit', 'credit', 'category'].includes(key) &&
            text(value)
        ),
      'Invalid import preset.'
    )
  }
  for (const c of data.categories) {
    assert(
      text(c.name) && nonnegative(c.monthlyLimit) && text(c.color) && typeof c.fixed === 'boolean',
      'Invalid category.'
    )
  }
  for (const g of data.goals) {
    assert(
      text(g.name) &&
        ['year', 'long-term'].includes(g.horizon) &&
        nonnegative(g.targetAmount) &&
        nonnegative(g.savedAmount) &&
        isISODate(g.targetDate) &&
        text(g.createdAt),
      'Invalid goal.'
    )
  }
  for (const r of data.rules) {
    assert(
      text(r.contains) && r.contains.trim() && categories.has(r.categoryId),
      'Invalid category rule.'
    )
  }
  for (const b of data.bills) {
    assert(
      text(b.name) &&
        b.name.trim() &&
        nonnegative(b.amount) &&
        b.amount > 0 &&
        isISODate(b.startDate) &&
        ['monthly', 'yearly'].includes(b.frequency) &&
        categories.get(b.categoryId)?.fixed,
      'Bills need a valid date, amount and fixed category.'
    )
  }
  const occurrences = new Set<string>()
  for (const t of data.transactions) {
    assert(
      text(t.description) &&
        isISODate(t.date) &&
        nonnegative(t.amount) &&
        t.amount > 0 &&
        ['expense', 'income'].includes(t.kind) &&
        ['manual', 'csv'].includes(t.source) &&
        text(t.createdAt) &&
        (t.categoryId === null || categories.has(t.categoryId)) &&
        (t.reviewed === undefined || typeof t.reviewed === 'boolean'),
      'Invalid transaction.'
    )
    if (t.billId !== undefined || t.billDueDate !== undefined) {
      assert(
        data.bills.some((b) => b.id === t.billId) &&
          isISODate(t.billDueDate) &&
          t.kind === 'expense',
        'Invalid bill link.'
      )
      const key = `${t.billId}/${t.billDueDate.slice(0, 7)}`
      assert(!occurrences.has(key), 'A bill occurrence can only be recorded once.')
      occurrences.add(key)
    }
  }
  return data
}
