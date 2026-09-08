import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { randomUUID } from 'crypto'
import { readFile, rename, rm, stat, writeFile } from 'fs/promises'
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
 * Store mutations return a fresh snapshot; file dialogs return their documented
 * result. The renderer reaches Node only through these explicit capabilities.
 */
export function registerIpc(store: BudgetStore, trustedRendererUrl: string): void {
  const handle = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]): void => {
    ipcMain.handle(channel, (event, ...args) => {
      // The preload API is available only to our top-level document. Reject
      // frames or unexpected navigation before they reach a privileged action.
      if (
        event.senderFrame !== event.sender.mainFrame ||
        !isTrustedRenderer(event.senderFrame?.url, trustedRendererUrl)
      ) {
        throw new Error('This page cannot access the budget.')
      }
      return handler(event, ...args)
    })
  }
  handle(IPC.getData, () => store.read())
  handle(IPC.saveProfile, (_e, profile: Profile) => store.saveProfile(profile))
  handle(IPC.upsertCategory, (_e, c: NewCategory) => store.upsertCategory(c))
  handle(IPC.deleteCategory, (_e, id: string) => store.deleteCategory(id))
  handle(IPC.upsertGoal, (_e, g: NewGoal) => store.upsertGoal(g))
  handle(IPC.deleteGoal, (_e, id: string) => store.deleteGoal(id))
  handle(IPC.addTransaction, (_e, t: NewTransaction) => store.addTransaction(t))
  handle(IPC.updateTransaction, (_e, t: Transaction) => store.updateTransaction(t))
  handle(IPC.deleteTransaction, (_e, id: string) => store.deleteTransaction(id))
  handle(
    IPC.importTransactions,
    (_e, ts: NewTransaction[], skip?: boolean, incomeBasis?: Profile['incomeBasis']) =>
      store.importTransactions(ts, skip, incomeBasis)
  )
  handle(IPC.loadDemoData, () => store.loadDemoData())
  handle(IPC.resetData, () => store.resetData())
  handle(IPC.canUndo, () => store.canUndo())
  handle(IPC.saveImportPreset, (_e, preset: Omit<ImportPreset, 'id'> & { id?: string }) =>
    store.saveImportPreset(preset)
  )
  handle(IPC.deleteImportPreset, (_e, id: string) => store.deleteImportPreset(id))
  handle(IPC.undo, () => store.undo())
  handle(IPC.upsertRule, (_e, rule: NewCategoryRule) => store.upsertRule(rule))
  handle(IPC.deleteRule, (_e, id: string) => store.deleteRule(id))
  handle(IPC.bulkTransactions, (_e, ids: string[], action: BulkTransactionAction) =>
    store.bulkTransactions(ids, action)
  )
  handle(IPC.upsertBill, (_e, bill: NewBill) => store.upsertBill(bill))
  handle(IPC.deleteBill, (_e, id: string) => store.deleteBill(id))
  handle(IPC.recordBill, (_e, id: string, date: string, transactionId?: string) =>
    store.recordBill(id, date, transactionId)
  )
  handle(IPC.exportCsv, async (_e, ids: string[]) => {
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
    await writeExport(result.filePath, exportTransactions(rows, data.categories))
    return true
  })
  handle(IPC.exportBackup, async () => {
    const content = JSON.stringify(store.read(), null, 2)
    const result = await dialog.showSaveDialog({
      title: 'Save budget backup',
      defaultPath: `budget-backup-${toISODate(new Date())}.json`,
      filters: [{ name: 'Budget backup', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return false
    await writeExport(result.filePath, content)
    return true
  })
  handle(IPC.restoreBackup, async () => {
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
      join(app.getPath('userData'), `budget-before-restore-${Date.now()}-${randomUUID()}.json`),
      JSON.stringify(store.read(), null, 2),
      { encoding: 'utf-8', flag: 'wx', mode: 0o600, flush: true }
    )
    return store.restore(candidate)
  })

  handle(IPC.pickCsvFile, async (event) => {
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

/** Compare documents, allowing client-side routes without trusting another file or origin. */
export function isTrustedRenderer(candidate: string | undefined, trusted: string): boolean {
  if (!candidate) return false
  try {
    const actual = new URL(candidate)
    const expected = new URL(trusted)
    return (
      actual.protocol === expected.protocol &&
      actual.host === expected.host &&
      actual.pathname === expected.pathname
    )
  } catch {
    return false
  }
}

/** Preserve an existing export if writing the replacement fails partway through. */
async function writeExport(filePath: string, content: string): Promise<void> {
  const temporary = `${filePath}.${randomUUID()}.tmp`
  try {
    await writeFile(temporary, content, { encoding: 'utf-8', flag: 'wx', mode: 0o600, flush: true })
    await rename(temporary, filePath)
  } finally {
    await rm(temporary, { force: true }).catch((error) => {
      console.error('[export] could not remove temporary file:', error)
    })
  }
}
