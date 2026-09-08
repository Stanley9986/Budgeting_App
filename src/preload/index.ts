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
  importTransactions: (txs) => ipcRenderer.invoke(IPC.importTransactions, txs),
  pickCsvFile: () => ipcRenderer.invoke(IPC.pickCsvFile),
  loadDemoData: () => ipcRenderer.invoke(IPC.loadDemoData),
  resetData: () => ipcRenderer.invoke(IPC.resetData)
}

contextBridge.exposeInMainWorld('budget', api)
