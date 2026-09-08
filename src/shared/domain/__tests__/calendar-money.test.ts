import { describe, expect, it } from 'vitest'
import { addMonths, daysInMonth, fromISODate, isISODate, monthsUntil, toISODate } from '../dates'
import { formatCompact, formatMoney, formatPct, round2 } from '../money'

describe('local calendar arithmetic', () => {
  it('clamps short destination months and preserves the input date and time', () => {
    const date = new Date(2026, 0, 31, 14, 30)
    const next = addMonths(date, 1)
    expect(toISODate(next)).toBe('2026-02-28')
    expect(next.getHours()).toBe(14)
    expect(next.getMinutes()).toBe(30)
    expect(toISODate(date)).toBe('2026-01-31')
    expect(toISODate(addMonths(date, -1))).toBe('2025-12-31')
    expect(toISODate(addMonths(new Date(2024, 0, 31), 1))).toBe('2024-02-29')
  })

  it('round-trips local dates across DST changes without timezone offsets', () => {
    for (const date of ['2026-03-08', '2026-11-01', '2024-02-29']) {
      expect(toISODate(fromISODate(date))).toBe(date)
    }
  })

  it('validates dates without calendar rollover and follows Gregorian leap years', () => {
    expect(isISODate('2024-02-29')).toBe(true)
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2026-04-31')).toBe(false)
    expect(isISODate('2026-00-01')).toBe(false)
    expect(isISODate('2026-13-01')).toBe(false)
    expect(isISODate('2026-01-00')).toBe(false)
    expect(isISODate('0999-01-01')).toBe(false)
    expect(isISODate(null)).toBe(false)
    expect(daysInMonth(2000, 2)).toBe(29)
    expect(daysInMonth(2100, 2)).toBe(28)
  })

  it('counts only complete remaining months and never returns a negative count', () => {
    const from = new Date(2026, 0, 15)
    expect(monthsUntil(from, new Date(2026, 1, 15))).toBe(1)
    expect(monthsUntil(from, new Date(2026, 1, 14))).toBe(0)
    expect(monthsUntil(from, new Date(2025, 11, 15))).toBe(0)
    expect(monthsUntil(from, new Date(2027, 0, 15))).toBe(12)
  })
})

describe('money calculations and display', () => {
  it.each([
    [1.005, 1.01], [10.075, 10.08], [-1.005, -1.01], [-10.075, -10.08],
    [0.1 + 0.2, 0.3], [1e-7, 0], [-0.001, 0], [1e21, 1e21]
  ])('rounds %s to %s cents', (input, expected) => {
    expect(round2(input)).toBe(expected)
  })

  it('formats configured currencies, precision, compact totals and percentages', () => {
    expect(formatMoney(1234.5)).toBe('$1,234.50')
    expect(formatMoney(-12, 'EUR')).toBe('-€12.00')
    expect(formatMoney(1234.5, 'USD', 0)).toBe('$1,235')
    expect(formatCompact(1200)).toBe('$1.2K')
    expect(formatPct(1.25)).toBe('125%')
  })
})
