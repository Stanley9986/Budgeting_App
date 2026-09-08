import type {
  AppData,
  ImportPreset,
  NewBill,
  NewCategoryRule,
  NewCategory,
  NewGoal,
  NewTransaction,
  Profile,
  Transaction
} from './types'

export interface BulkTransactionAction {
  categoryId?: string | null
  reviewed?: boolean
  delete?: boolean
  applyRules?: boolean
}

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
  resetData: 'data:reset',
  canUndo: 'data:can-undo',
  undo: 'data:undo',
  upsertRule: 'rule:upsert',
  deleteRule: 'rule:delete',
  bulkTransactions: 'tx:bulk',
  upsertBill: 'bill:upsert',
  deleteBill: 'bill:delete',
  recordBill: 'bill:record',
  exportCsv: 'csv:export',
  exportBackup: 'backup:export',
  restoreBackup: 'backup:restore',
  saveImportPreset: 'import-preset:save',
  deleteImportPreset: 'import-preset:delete'
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
  importTransactions(
    txs: NewTransaction[],
    skipDuplicates?: boolean,
    incomeBasis?: Profile['incomeBasis']
  ): Promise<AppData>
  pickCsvFile(): Promise<{ fileName: string; content: string } | null>
  loadDemoData(): Promise<AppData>
  resetData(): Promise<AppData>
  canUndo(): Promise<boolean>
  undo(): Promise<AppData>
  upsertRule(rule: NewCategoryRule): Promise<AppData>
  deleteRule(id: string): Promise<AppData>
  bulkTransactions(ids: string[], action: BulkTransactionAction): Promise<AppData>
  upsertBill(bill: NewBill): Promise<AppData>
  deleteBill(id: string): Promise<AppData>
  recordBill(id: string, dueDate: string, transactionId?: string): Promise<AppData>
  exportCsv(ids: string[]): Promise<boolean>
  exportBackup(): Promise<boolean>
  restoreBackup(): Promise<AppData>
  saveImportPreset(preset: Omit<ImportPreset, 'id'> & { id?: string }): Promise<AppData>
  deleteImportPreset(id: string): Promise<AppData>
}
