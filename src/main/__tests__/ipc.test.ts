import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'fs'
import * as files from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC } from '../../shared/api'
import { defaultAppData } from '../store/defaults'
import { BudgetStore } from '../store/budgetStore'
import { JsonDatabase } from '../store/jsonDatabase'
import { isTrustedRenderer, registerIpc } from '../ipc'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => unknown>(),
  directory: '',
  dialogs: { showSaveDialog: vi.fn(), showOpenDialog: vi.fn(), showMessageBox: vi.fn() }
}))
vi.mock('electron', () => ({
  ipcMain: { handle: (channel: string, handler: (...args: unknown[]) => unknown) => mocks.handlers.set(channel, handler) },
  app: { getPath: () => mocks.directory },
  BrowserWindow: { fromWebContents: () => null },
  dialog: mocks.dialogs
}))
vi.mock('fs/promises', async (importOriginal) => {
  const original = await importOriginal<typeof import('fs/promises')>()
  return { ...original, writeFile: vi.fn(original.writeFile), rename: vi.fn(original.rename), stat: vi.fn(original.stat) }
})

const trustedUrl = 'file:///app/renderer/index.html'
function eventFor(url = trustedUrl, isMainFrame = true) {
  const mainFrame = { url: trustedUrl }
  return { sender: { mainFrame }, senderFrame: isMainFrame ? Object.assign(mainFrame, { url }) : { url } }
}
async function invoke(channel: string, ...args: unknown[]) {
  return mocks.handlers.get(channel)!(eventFor(), ...args)
}

describe('IPC boundary', () => {
  let store: BudgetStore
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handlers.clear()
    mocks.directory = mkdtempSync(join(tmpdir(), 'budget-ipc-'))
    store = new BudgetStore(JsonDatabase.in(mocks.directory))
    registerIpc(store, trustedUrl)
  })
  afterEach(() => rmSync(mocks.directory, { recursive: true, force: true }))

  it('registers the complete preload API without extra privileged channels', () => {
    expect([...mocks.handlers.keys()].sort()).toEqual(Object.values(IPC).sort())
  })

  it('persists profile settings and category/goal edits across IPC calls', async () => {
    const profile = { ...store.read().profile, name: 'Household', incomeMethod: 'hourly', hourlyRate: 45, hoursPerWeek: 35 }
    await invoke(IPC.saveProfile, profile)
    await invoke(IPC.upsertCategory, { id: 'pets', name: 'Pets', monthlyLimit: 80, color: '#abcdef' })
    await invoke(IPC.upsertCategory, { id: 'pets', name: 'Pet care', monthlyLimit: 100, color: '#abcdef' })
    await invoke(IPC.upsertGoal, { id: 'goal', name: 'Car', horizon: 'year', targetAmount: 10000, savedAmount: 0, targetDate: '2026-12-31' })
    await invoke(IPC.upsertGoal, { id: 'goal', name: 'Car', horizon: 'year', targetAmount: 10000, savedAmount: 500, targetDate: '2026-12-31' })
    expect(await invoke(IPC.getData)).toMatchObject({ profile, goals: [{ id: 'goal', savedAmount: 500 }] })
    expect(store.read().categories.find((c) => c.id === 'pets')).toMatchObject({ name: 'Pet care', monthlyLimit: 100 })
    await invoke(IPC.deleteGoal, 'goal')
    await invoke(IPC.deleteCategory, 'pets')
    expect(store.read().goals).toEqual([])
    expect(store.read().categories.some((c) => c.id === 'pets')).toBe(false)
    expect(await invoke(IPC.canUndo)).toBe(true)
    await invoke(IPC.undo)
    expect(store.read().categories.some((c) => c.id === 'pets')).toBe(true)
  })

  it('uses rule and import arguments correctly, including duplicate opt-out and the chosen income basis', async () => {
    const categoryId = store.read().categories[1].id
    await invoke(IPC.upsertRule, { id: 'rule', contains: 'coffee', categoryId })
    await invoke(IPC.saveImportPreset, { id: 'preset', name: 'Checking', columns: { date: 'Posted', amount: 'Amount' }, dayFirst: false, positiveIsExpense: true })
    const expense = { date: '2026-01-04', description: 'Coffee shop', amount: 4.5, kind: 'expense', categoryId: null }
    await invoke(IPC.importTransactions, [expense], true, 'recorded')
    await invoke(IPC.importTransactions, [expense], false, 'recorded')
    expect(store.read()).toMatchObject({ profile: { incomeBasis: 'recorded' }, importPresets: [{ id: 'preset' }] })
    expect(store.read().transactions).toHaveLength(2)
    expect(store.read().transactions.every((tx) => tx.categoryId === categoryId && tx.source === 'csv' && !tx.reviewed)).toBe(true)
    await invoke(IPC.deleteRule, 'rule')
    await invoke(IPC.deleteImportPreset, 'preset')
    expect(store.read()).toMatchObject({ rules: [], importPresets: [] })
  })

  it('supports manual edit, bulk review, deletion and undo through the bridge', async () => {
    await invoke(IPC.addTransaction, { date: '2026-01-04', description: 'Coffee shop', amount: 4.5, kind: 'expense', categoryId: null })
    const tx = store.read().transactions[0]
    await invoke(IPC.updateTransaction, { ...tx, amount: 5 })
    await invoke(IPC.bulkTransactions, [tx.id], { reviewed: true, categoryId: store.read().categories[1].id })
    expect(store.read().transactions[0]).toMatchObject({ id: tx.id, amount: 5, reviewed: true, categoryId: store.read().categories[1].id })
    await invoke(IPC.deleteTransaction, tx.id)
    expect(store.read().transactions).toEqual([])
    await invoke(IPC.undo)
    expect(store.read().transactions[0].amount).toBe(5)
  })

  it('links a bill to an existing payment and preserves the expense when deleting the schedule', async () => {
    await invoke(IPC.upsertBill, { id: 'rent', name: 'Rent', amount: 1800, startDate: '2026-01-01', frequency: 'monthly', categoryId: store.read().categories[0].id })
    await invoke(IPC.addTransaction, { date: '2026-01-04', description: 'Payment', amount: 1800, kind: 'expense', categoryId: null })
    const paymentId = store.read().transactions[0].id
    await invoke(IPC.recordBill, 'rent', '2026-01-01', paymentId)
    expect(store.read().transactions).toHaveLength(1)
    expect(store.read().transactions[0]).toMatchObject({ id: paymentId, billId: 'rent', billDueDate: '2026-01-01' })
    await invoke(IPC.deleteBill, 'rent')
    expect(store.read().bills).toEqual([])
    expect(store.read().transactions[0]).toMatchObject({ id: paymentId, amount: 1800, billId: undefined })
  })

  it('loads demo data, resets, and undoes reset through IPC', async () => {
    await invoke(IPC.loadDemoData)
    const demo = store.read()
    expect(demo.transactions.length).toBeGreaterThan(0)
    await invoke(IPC.resetData)
    expect(store.read()).toEqual(defaultAppData())
    await invoke(IPC.undo)
    expect(store.read()).toEqual(demo)
  })

  it.each([
    ['https://untrusted.example/', true],
    ['file:///app/renderer/other.html', true],
    [trustedUrl, false]
  ])('rejects untrusted sender %s (main frame: %s) before touching storage', (url, mainFrame) => {
    const spy = vi.spyOn(store, 'resetData')
    expect(() => mocks.handlers.get(IPC.resetData)!(eventFor(url, mainFrame))).toThrow('cannot access')
    expect(spy).not.toHaveBeenCalled()
  })

  it('exports only selected transactions, newest first, with category labels', async () => {
    const categoryId = store.read().categories[1].id
    const older = store.addTransaction({ date: '2026-01-01', description: 'Older', amount: 10, kind: 'expense', categoryId }).transactions[0]
    store.addTransaction({ date: '2026-01-02', description: 'Excluded', amount: 20, kind: 'expense', categoryId })
    const newer = store.addTransaction({ date: '2026-01-03', description: 'Newer', amount: 30, kind: 'expense', categoryId }).transactions[0]
    const filePath = join(mocks.directory, 'selected.csv')
    mocks.dialogs.showSaveDialog.mockResolvedValue({ canceled: false, filePath })
    expect(await invoke(IPC.exportCsv, [older.id, newer.id, 'missing'])).toBe(true)
    const content = readFileSync(filePath, 'utf8')
    expect(content).toContain('Groceries')
    expect(content).not.toContain('Excluded')
    expect(content.indexOf('Newer')).toBeLessThan(content.indexOf('Older'))
  })

  it.each([IPC.exportCsv, IPC.exportBackup])('does not write when %s is cancelled', async (channel) => {
    mocks.dialogs.showSaveDialog.mockResolvedValue({ canceled: true })
    expect(await invoke(channel, [])).toBe(false)
    expect(files.writeFile).not.toHaveBeenCalled()
  })

  it('exports a full backup and safely replaces an existing export', async () => {
    const filePath = join(mocks.directory, 'backup.json')
    writeFileSync(filePath, 'old backup')
    const original = store.loadDemoData()
    mocks.dialogs.showSaveDialog.mockResolvedValue({ canceled: false, filePath })
    expect(await invoke(IPC.exportBackup)).toBe(true)
    expect(JSON.parse(readFileSync(filePath, 'utf8'))).toEqual(original)
    expect(readdirSync(mocks.directory).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('preserves an existing backup when its replacement cannot be installed', async () => {
    const filePath = join(mocks.directory, 'backup.json')
    writeFileSync(filePath, 'old backup')
    mocks.dialogs.showSaveDialog.mockResolvedValue({ canceled: false, filePath })
    vi.mocked(files.rename).mockRejectedValueOnce(new Error('Disk failure'))
    await expect(invoke(IPC.exportBackup)).rejects.toThrow('Disk failure')
    expect(readFileSync(filePath, 'utf8')).toBe('old backup')
    expect(readdirSync(mocks.directory).some((name) => name.endsWith('.tmp'))).toBe(false)
  })

  it('preserves a recovery copy before restoring and supports undo', async () => {
    const original = store.loadDemoData()
    const candidate = defaultAppData()
    candidate.profile.name = 'Restored profile'
    const filePath = join(mocks.directory, 'incoming.json')
    writeFileSync(filePath, JSON.stringify(candidate))
    mocks.dialogs.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })
    mocks.dialogs.showMessageBox.mockResolvedValue({ response: 1 })
    expect(await invoke(IPC.restoreBackup)).toEqual(candidate)
    const recovery = readdirSync(mocks.directory).find((name) => name.startsWith('budget-before-restore-'))!
    expect(JSON.parse(readFileSync(join(mocks.directory, recovery), 'utf8'))).toEqual(original)
    expect(store.undo()).toEqual(original)
  })

  it('leaves the budget unchanged when the restore recovery copy fails', async () => {
    const original = store.loadDemoData()
    const filePath = join(mocks.directory, 'incoming.json')
    writeFileSync(filePath, JSON.stringify(defaultAppData()))
    mocks.dialogs.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })
    mocks.dialogs.showMessageBox.mockResolvedValue({ response: 1 })
    vi.mocked(files.writeFile).mockRejectedValueOnce(new Error('Disk full'))
    await expect(invoke(IPC.restoreBackup)).rejects.toThrow('Disk full')
    expect(store.read()).toEqual(original)
  })

  it.each(['picker', 'confirmation'])('leaves a restore unchanged when cancelling %s', async (step) => {
    const original = store.loadDemoData()
    const filePath = join(mocks.directory, 'incoming.json')
    writeFileSync(filePath, JSON.stringify(defaultAppData()))
    mocks.dialogs.showOpenDialog.mockResolvedValue({ canceled: step === 'picker', filePaths: [filePath] })
    mocks.dialogs.showMessageBox.mockResolvedValue({ response: 0 })
    expect(await invoke(IPC.restoreBackup)).toEqual(original)
    expect(files.writeFile).not.toHaveBeenCalled()
  })

  it('rejects malformed backups before prompting to replace a budget', async () => {
    const original = store.loadDemoData()
    const filePath = join(mocks.directory, 'incoming.json')
    writeFileSync(filePath, '{ broken')
    mocks.dialogs.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })
    await expect(invoke(IPC.restoreBackup)).rejects.toThrow()
    expect(mocks.dialogs.showMessageBox).not.toHaveBeenCalled()
    expect(store.read()).toEqual(original)
  })

  it('reads selected CSV contents without exposing an arbitrary renderer-provided path', async () => {
    const filePath = join(mocks.directory, 'statement.csv')
    writeFileSync(filePath, 'Date,Amount\n2026-01-01,-10')
    mocks.dialogs.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: [filePath] })
    expect(await invoke(IPC.pickCsvFile)).toEqual({ fileName: 'statement.csv', content: 'Date,Amount\n2026-01-01,-10' })
  })

  it('returns no statement when the file picker is cancelled', async () => {
    mocks.dialogs.showOpenDialog.mockResolvedValue({ canceled: true, filePaths: [] })
    expect(await invoke(IPC.pickCsvFile)).toBeNull()
  })

  it('rejects oversized statements before reading their contents', async () => {
    mocks.dialogs.showOpenDialog.mockResolvedValue({ canceled: false, filePaths: ['/not-read.csv'] })
    vi.mocked(files.stat).mockResolvedValueOnce({ size: 26 * 1024 * 1024 } as Awaited<ReturnType<typeof files.stat>>)
    await expect(invoke(IPC.pickCsvFile)).rejects.toThrow('smaller than 25 MB')
  })
})

describe('trusted renderer document matching', () => {
  it('allows hash routes and query parameters on the exact document', () => {
    expect(isTrustedRenderer(`${trustedUrl}?theme=dark#/transactions`, trustedUrl)).toBe(true)
    expect(isTrustedRenderer('http://localhost:5173/#/bills', 'http://localhost:5173/')).toBe(true)
  })
  it.each([undefined, 'not a URL', 'https://localhost:5173/', 'http://localhost:5174/', 'http://localhost:5173/other'])('rejects %s', (candidate) => {
    expect(isTrustedRenderer(candidate, 'http://localhost:5173/')).toBe(false)
  })
})
