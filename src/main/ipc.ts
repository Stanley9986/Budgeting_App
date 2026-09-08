import { BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile } from 'fs/promises'
import { basename } from 'path'
import { IPC } from '../shared/api'
import type { NewCategory, NewGoal, NewTransaction, Profile, Transaction } from '../shared/types'
import type { BudgetStore } from './store/budgetStore'

/**
 * One handler per channel, each returning the fresh snapshot. Nothing in the
 * renderer can reach Node directly — this is the whole privileged surface.
 */
export function registerIpc(store: BudgetStore): void {
  ipcMain.handle(IPC.getData, () => store.read())
  ipcMain.handle(IPC.saveProfile, (_e, profile: Profile) => store.saveProfile(profile))
  ipcMain.handle(IPC.upsertCategory, (_e, c: NewCategory) => store.upsertCategory(c))
  ipcMain.handle(IPC.deleteCategory, (_e, id: string) => store.deleteCategory(id))
  ipcMain.handle(IPC.upsertGoal, (_e, g: NewGoal) => store.upsertGoal(g))
  ipcMain.handle(IPC.deleteGoal, (_e, id: string) => store.deleteGoal(id))
  ipcMain.handle(IPC.addTransaction, (_e, t: NewTransaction) => store.addTransaction(t))
  ipcMain.handle(IPC.updateTransaction, (_e, t: Transaction) => store.updateTransaction(t))
  ipcMain.handle(IPC.deleteTransaction, (_e, id: string) => store.deleteTransaction(id))
  ipcMain.handle(IPC.importTransactions, (_e, ts: NewTransaction[]) => store.importTransactions(ts))
  ipcMain.handle(IPC.loadDemoData, () => store.loadDemoData())
  ipcMain.handle(IPC.resetData, () => store.resetData())

  ipcMain.handle(IPC.pickCsvFile, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    const result = window
      ? await dialog.showOpenDialog(window, {
          title: 'Import transactions',
          filters: [{ name: 'CSV', extensions: ['csv', 'txt'] }],
          properties: ['openFile']
        })
      : await dialog.showOpenDialog({ properties: ['openFile'] })

    if (result.canceled || result.filePaths.length === 0) return null
    const filePath = result.filePaths[0]
    return { fileName: basename(filePath), content: await readFile(filePath, 'utf-8') }
  })
}
