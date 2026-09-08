import type { Goal } from '../types'
import { fromISODate, monthsUntil, toISODate } from './dates'
import { round2 } from './money'

export interface GoalProgress {
  goal: Goal
  remaining: number
  /** 0-1, clamped. */
  progress: number
  monthsLeft: number
  /** What must be set aside every month from now to hit the target on time. */
  requiredMonthly: number
  /** True once the target date has passed with money still owed. */
  overdue: boolean
  funded: boolean
}

export function goalProgress(goal: Goal, today = new Date()): GoalProgress {
  const remaining = Math.max(0, round2(goal.targetAmount - goal.savedAmount))
  const progress = goal.targetAmount > 0 ? Math.min(1, goal.savedAmount / goal.targetAmount) : 1
  const monthsLeft = monthsUntil(today, fromISODate(goal.targetDate))
  const funded = remaining === 0
  // With 0 months left the whole remainder is due now, so divide by 1 rather
  // than by 0 (which would report Infinity and poison every downstream total).
  const requiredMonthly = funded ? 0 : round2(remaining / Math.max(1, monthsLeft))
  return {
    goal,
    remaining,
    progress,
    monthsLeft,
    requiredMonthly,
    // A due date includes that entire local calendar day, not just midnight.
    overdue: !funded && goal.targetDate < toISODate(today),
    funded
  }
}

/** Total monthly savings all active goals demand. Drives the pacing colour. */
export function requiredMonthlySavings(goals: Goal[], today = new Date()): number {
  return round2(
    goals.reduce((sum, g) => sum + goalProgress(g, today).requiredMonthly, 0)
  )
}

export function allGoalProgress(goals: Goal[], today = new Date()): GoalProgress[] {
  return goals
    .map((g) => goalProgress(g, today))
    .sort((a, b) => a.goal.targetDate.localeCompare(b.goal.targetDate))
}
