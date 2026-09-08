import { contextBridge, ipcRenderer } from 'electron'
import { IPC, type BudgetApi } from '../shared/api'

/**
 * The renderer gets this object and nothing else — no `require`, no `fs`, no
 * arbitrary channel access. Each method is an explicit, typed capability.
 */
const api: BudgetApi = {
  getData: () => ipcRenderer.invoke(IPC.getData),
  saveProfile: (profile) => ipcRenderer.invoke(IPC.saveProfile, profile),
  upsertCategory: (category) => ipcRenderer.invoke(IPC.upsertCategory, category),
  deleteCategory: (id) => ipcRenderer.invoke(IPC.deleteCategory, id),
  upsertGoal: (goal) => ipcRenderer.invoke(IPC.upsertGoal, goal),
  deleteGoal: (id) => ipcRenderer.invoke(IPC.deleteGoal, id),
  addTransaction: (tx) => ipcRenderer.invoke(IPC.addTransaction, tx),
  updateTransaction: (tx) => ipcRenderer.invoke(IPC.updateTransaction, tx),
  deleteTransaction: (id) => ipcRenderer.invoke(IPC.deleteTransaction, id),
  importTransactions: (txs, skipDuplicates, incomeBasis) => ipcRenderer.invoke(IPC.importTransactions, txs, skipDuplicates, incomeBasis),
  pickCsvFile: () => ipcRenderer.invoke(IPC.pickCsvFile),
  loadDemoData: () => ipcRenderer.invoke(IPC.loadDemoData),
  resetData: () => ipcRenderer.invoke(IPC.resetData),
  canUndo: () => ipcRenderer.invoke(IPC.canUndo),
  undo: () => ipcRenderer.invoke(IPC.undo),
  upsertRule: (rule) => ipcRenderer.invoke(IPC.upsertRule, rule),
  deleteRule: (id) => ipcRenderer.invoke(IPC.deleteRule, id),
  bulkTransactions: (ids, action) => ipcRenderer.invoke(IPC.bulkTransactions, ids, action),
  upsertBill: (bill) => ipcRenderer.invoke(IPC.upsertBill, bill),
  deleteBill: (id) => ipcRenderer.invoke(IPC.deleteBill, id),
  recordBill: (id, dueDate, transactionId) => ipcRenderer.invoke(IPC.recordBill, id, dueDate, transactionId),
  exportCsv: (ids) => ipcRenderer.invoke(IPC.exportCsv, ids),
  exportBackup: () => ipcRenderer.invoke(IPC.exportBackup),
  restoreBackup: () => ipcRenderer.invoke(IPC.restoreBackup),
  saveImportPreset: (preset) => ipcRenderer.invoke(IPC.saveImportPreset, preset),
  deleteImportPreset: (id) => ipcRenderer.invoke(IPC.deleteImportPreset, id)
}

contextBridge.exposeInMainWorld('budget', api)
