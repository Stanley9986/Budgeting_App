/** yyyy-mm-dd for a Date, in local time (not UTC — avoids off-by-one days). */
export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Parses yyyy-mm-dd as a local date. */
export function fromISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

export function isISODate(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number(value.slice(0, 4)) >= 1000 &&
    toISODate(fromISODate(value)) === value
  )
}

/** yyyy-mm key used to bucket transactions by month. */
export function monthKey(isoDate: string): string {
  return isoDate.slice(0, 7)
}

export function monthKeyOf(d: Date): string {
  return toISODate(d).slice(0, 7)
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate()
}

export function monthLabel(key: string): string {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

/**
 * Whole months from `from` to `to`, floored at 0. Used for "how many months of
 * saving are left before this goal is due".
 */
export function monthsUntil(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth())
  if (months < 0) return 0
  return to.getDate() >= from.getDate() ? months : Math.max(0, months - 1)
}

export function addMonths(d: Date, n: number): Date {
  const copy = new Date(d)
  // Moving January 31 directly to February rolls into March in JavaScript.
  // Select the destination month first, then clamp to its last calendar day.
  const day = copy.getDate()
  copy.setDate(1)
  copy.setMonth(copy.getMonth() + n)
  copy.setDate(Math.min(day, daysInMonth(copy.getFullYear(), copy.getMonth() + 1)))
  return copy
}
