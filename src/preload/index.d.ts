import type { BudgetApi } from '../shared/api'

declare global {
  interface Window {
    budget: BudgetApi
  }
}

export {}
