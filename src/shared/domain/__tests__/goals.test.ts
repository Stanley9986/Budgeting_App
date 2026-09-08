import { describe, expect, it } from 'vitest'
import type { Goal } from '../../types'
import { goalProgress, requiredMonthlySavings } from '../goals'

const car: Goal = {
  id: 'car',
  name: 'Car',
  horizon: 'year',
  targetAmount: 50_000,
  savedAmount: 10_000,
  targetDate: '2026-12-31',
  createdAt: ''
}

describe('goalProgress', () => {
  it('spreads the remainder across the months left', () => {
    const p = goalProgress(car, new Date(2026, 0, 1)) // 11 whole months to Dec 31
    expect(p.remaining).toBe(40_000)
    expect(p.progress).toBeCloseTo(0.2, 5)
    expect(p.monthsLeft).toBe(11)
    expect(p.requiredMonthly).toBeCloseTo(40_000 / 11, 2)
  })

  it('never divides by zero months', () => {
    const p = goalProgress(car, new Date(2026, 11, 31))
    expect(p.monthsLeft).toBe(0)
    expect(p.requiredMonthly).toBe(40_000)
  })

  it('asks for nothing once the goal is funded', () => {
    const p = goalProgress({ ...car, savedAmount: 50_000 }, new Date(2026, 0, 1))
    expect(p.funded).toBe(true)
    expect(p.requiredMonthly).toBe(0)
    expect(p.overdue).toBe(false)
  })

  it('marks an unfunded goal past its date as overdue', () => {
    expect(goalProgress(car, new Date(2027, 0, 15)).overdue).toBe(true)
  })

  it('clamps progress at 100% when oversaved', () => {
    expect(goalProgress({ ...car, savedAmount: 60_000 }, new Date(2026, 0, 1)).progress).toBe(1)
  })
})

describe('requiredMonthlySavings', () => {
  it('sums every goal', () => {
    const house: Goal = {
      id: 'house',
      name: 'House',
      horizon: 'long-term',
      targetAmount: 120_000,
      savedAmount: 0,
      targetDate: '2030-01-01',
      createdAt: ''
    }
    const today = new Date(2026, 0, 1)
    const expected =
      goalProgress(car, today).requiredMonthly + goalProgress(house, today).requiredMonthly
    expect(requiredMonthlySavings([car, house], today)).toBeCloseTo(expected, 2)
  })

  it('is zero with no goals', () => {
    expect(requiredMonthlySavings([], new Date())).toBe(0)
  })
})
