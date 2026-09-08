import type { AppData, NewCategory, NewGoal, NewTransaction, Profile, Transaction } from './types'

/** Every IPC channel the renderer is allowed to call. */
export const IPC = {
  getData: 'data:get',
  saveProfile: 'profile:save',
  upsertCategory: 'category:upsert',
  deleteCategory: 'category:delete',
  upsertGoal: 'goal:upsert',
  deleteGoal: 'goal:delete',
  addTransaction: 'tx:add',
  updateTransaction: 'tx:update',
  deleteTransaction: 'tx:delete',
  importTransactions: 'tx:import',
  pickCsvFile: 'csv:pick',
  loadDemoData: 'data:demo',
  resetData: 'data:reset'
} as const

/**
 * Mutations return the whole AppData snapshot. For an MVP dataset (thousands of
 * rows at most) that is cheap, and it keeps the renderer's state model to a
 * single source of truth instead of hand-merging optimistic updates.
 */
export interface BudgetApi {
  getData(): Promise<AppData>
  saveProfile(profile: Profile): Promise<AppData>
  upsertCategory(category: NewCategory): Promise<AppData>
  deleteCategory(id: string): Promise<AppData>
  upsertGoal(goal: NewGoal): Promise<AppData>
  deleteGoal(id: string): Promise<AppData>
  addTransaction(tx: NewTransaction): Promise<AppData>
  updateTransaction(tx: Transaction): Promise<AppData>
  deleteTransaction(id: string): Promise<AppData>
  importTransactions(txs: NewTransaction[]): Promise<AppData>
  pickCsvFile(): Promise<{ fileName: string; content: string } | null>
  loadDemoData(): Promise<AppData>
  resetData(): Promise<AppData>
}
