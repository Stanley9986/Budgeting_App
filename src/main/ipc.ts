import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { readFile, stat, writeFile } from 'fs/promises'
import { basename, join } from 'path'
import { IPC, type BulkTransactionAction } from '../shared/api'
import type {
  ImportPreset,
  NewBill,
  NewCategoryRule,
  NewCategory,
  NewGoal,
  NewTransaction,
  Profile,
  Transaction
} from '../shared/types'
import type { BudgetStore } from './store/budgetStore'
import { parseBudgetFile } from './store/jsonDatabase'
import { exportTransactions } from '../shared/domain/export'
import { toISODate } from '../shared/domain/dates'

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
  ipcMain.handle(
    IPC.importTransactions,
    (_e, ts: NewTransaction[], skip?: boolean, incomeBasis?: Profile['incomeBasis']) =>
      store.importTransactions(ts, skip, incomeBasis)
  )
  ipcMain.handle(IPC.loadDemoData, () => store.loadDemoData())
  ipcMain.handle(IPC.resetData, () => store.resetData())
  ipcMain.handle(IPC.canUndo, () => store.canUndo())
  ipcMain.handle(IPC.saveImportPreset, (_e, preset: Omit<ImportPreset, 'id'> & { id?: string }) =>
    store.saveImportPreset(preset)
  )
  ipcMain.handle(IPC.deleteImportPreset, (_e, id: string) => store.deleteImportPreset(id))
  ipcMain.handle(IPC.undo, () => store.undo())
  ipcMain.handle(IPC.upsertRule, (_e, rule: NewCategoryRule) => store.upsertRule(rule))
  ipcMain.handle(IPC.deleteRule, (_e, id: string) => store.deleteRule(id))
  ipcMain.handle(IPC.bulkTransactions, (_e, ids: string[], action: BulkTransactionAction) =>
    store.bulkTransactions(ids, action)
  )
  ipcMain.handle(IPC.upsertBill, (_e, bill: NewBill) => store.upsertBill(bill))
  ipcMain.handle(IPC.deleteBill, (_e, id: string) => store.deleteBill(id))
  ipcMain.handle(IPC.recordBill, (_e, id: string, date: string, transactionId?: string) =>
    store.recordBill(id, date, transactionId)
  )
  ipcMain.handle(IPC.exportCsv, async (_e, ids: string[]) => {
    const selected = new Set(ids)
    const data = store.read()
    const rows = data.transactions
      .filter((t) => selected.has(t.id))
      .sort((a, b) => b.date.localeCompare(a.date))
    const result = await dialog.showSaveDialog({
      title: 'Export transactions',
      defaultPath: `transactions-${toISODate(new Date())}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, exportTransactions(rows, data.categories), 'utf-8')
    return true
  })
  ipcMain.handle(IPC.exportBackup, async () => {
    const content = JSON.stringify(store.read(), null, 2)
    const result = await dialog.showSaveDialog({
      title: 'Save budget backup',
      defaultPath: `budget-backup-${toISODate(new Date())}.json`,
      filters: [{ name: 'Budget backup', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    await writeFile(result.filePath, content, 'utf-8')
    return true
  })
  ipcMain.handle(IPC.restoreBackup, async () => {
    const result = await dialog.showOpenDialog({
      title: 'Restore budget backup',
      filters: [{ name: 'Budget backup', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths[0]) return store.read()
    const candidate = parseBudgetFile(await readFile(result.filePaths[0], 'utf-8'))
    const confirmation = await dialog.showMessageBox({
      type: 'warning',
      buttons: ['Cancel', 'Restore backup'],
      defaultId: 0,
      cancelId: 0,
      message: 'Replace this budget with the backup?',
      detail: `${candidate.transactions.length} transactions, ${candidate.goals.length} goals, ${candidate.bills.length} bills and ${candidate.rules.length} rules. A recovery copy of your current budget will be saved locally first.`
    })
    if (confirmation.response !== 1) return store.read()
    await writeFile(
      join(app.getPath('userData'), `budget-before-restore-${Date.now()}.json`),
      JSON.stringify(store.read(), null, 2),
      'utf-8'
    )
    return store.restore(candidate)
  })

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
    if ((await stat(filePath)).size > 25 * 1024 * 1024)
      throw new Error('Choose a statement smaller than 25 MB.')
    return { fileName: basename(filePath), content: await readFile(filePath, 'utf-8') }
  })
}
