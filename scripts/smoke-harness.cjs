const { _electron: electron } = require('playwright')
const { expect } = require('playwright/test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

/** UI actions use the real renderer, preload, IPC handlers, and disk store.
 * Only native file choices/confirmations are supplied by the harness. Never
 * mutate data via the preload to make a scenario pass: fixtures enter as CSV.
 */
async function createHarness() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-ui-smoke-'))
  const screenshotDir = process.env.BUDGET_SCREENSHOTS || path.join(directory, 'screenshots')
  fs.mkdirSync(screenshotDir, { recursive: true })
  const errors = []
  const checks = []
  const h = { directory, screenshotDir, errors, checks, app: null, page: null }
  const env = { ...process.env, BUDGET_DATA_DIR: directory }
  delete env.ELECTRON_RUN_AS_NODE
  delete env.ELECTRON_RENDERER_URL

  h.launch = async () => {
    h.app = await electron.launch({
      executablePath: require('electron'),
      args: [path.resolve('out/main/index.js')],
      env
    })
    // Abort before any action if the isolation override stops being supported.
    assert.equal(await h.app.evaluate(({ app }) => app.getPath('userData')), directory)
    h.page = await h.app.firstWindow()
    h.page.setDefaultTimeout(10000)
    h.page.on('pageerror', (error) => errors.push(error.message))
    await h.page.getByRole('button', { name: /Settings$/ }).waitFor()
    assert.equal(await h.app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences().sandbox), true)
    assert.deepEqual(await h.page.evaluate(() => ({
      budget: typeof window.budget?.getData,
      require: typeof window.require,
      process: typeof window.process
    })), { budget: 'function', require: 'undefined', process: 'undefined' })
  }
  h.data = () => h.page.evaluate(() => window.budget.getData())
  // JSON backups omit optional undefined keys; compare their serialized semantics.
  h.persistedData = async () => JSON.parse(JSON.stringify(await h.data()))
  h.saved = async (predicate) => {
    await expect.poll(async () => predicate(await h.data()), { timeout: 10000 }).toBe(true)
    // The persistent snapshot can update slightly before React sees it.
    await expect(h.page.getByRole('button', { name: /Undo last change/ })).toBeEnabled()
  }
  h.nav = async (name) => {
    await h.page.getByRole('button', { name: new RegExp(`${name}$`) }).click()
    if (name !== 'Dashboard') await h.page.getByRole('heading', { name, exact: true }).waitFor()
    await expect.poll(() => h.page.locator('main').evaluate((main) => main.scrollTop)).toBe(0)
  }
  h.button = (name, scope = h.page) => scope.getByRole('button', { name, exact: true })
  h.field = (name) => h.page.getByLabel(name, { exact: true })
  h.card = (name) => h.page.locator('section.card').filter({ has: h.page.getByRole('heading', { name, exact: true }) })
  h.row = (description) => h.page.locator('tbody tr').filter({
    has: h.page.getByRole('checkbox', { name: new RegExp(`^Select ${description.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} on `) })
  })
  h.dismiss = async () => {
    await h.button('Dismiss').click()
    await expect(h.page.getByRole('alert')).toHaveCount(0)
  }
  h.undo = async () => {
    await h.page.getByRole('button', { name: /Undo last change/ }).click()
  }
  h.confirm = async (button, accepted = true) => {
    // Electron implements confirm using its native dialog module. A native
    // answer can settle before CDP's dialog.accept call; supply only the answer
    // and still assert the UI asks for confirmation before executing the action.
    await h.page.evaluate((answer) => {
      window.__smokeConfirm = window.confirm
      window.__smokeConfirmation = null
      window.confirm = (message) => {
        window.__smokeConfirmation = message
        return answer
      }
    }, accepted)
    try {
      await button.click()
      assert.ok(await h.page.evaluate(() => window.__smokeConfirmation), 'Action must ask for confirmation')
    } finally {
      await h.page.evaluate(() => {
        window.confirm = window.__smokeConfirm
        delete window.__smokeConfirm
        delete window.__smokeConfirmation
      })
    }
  }
  h.write = (name, content) => {
    const file = path.join(directory, name)
    fs.writeFileSync(file, content)
    return file
  }
  h.chooseOpen = (file = null, response = 1) => h.app.evaluate(({ dialog }, choice) => {
    dialog.showOpenDialog = async () => ({ canceled: !choice.file, filePaths: choice.file ? [choice.file] : [] })
    dialog.showMessageBox = async () => ({ response: choice.response, checkboxChecked: false })
  }, { file, response })
  h.chooseSave = (file = null) => h.app.evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = async () => ({ canceled: !filePath, filePath })
  }, file)
  h.openCsv = async (file) => {
    await h.button('Import CSV').click()
    await h.chooseOpen(file)
    await h.button('Choose a CSV file…').click()
  }
  h.closeModal = async () => {
    await h.page.keyboard.press('Escape')
    await expect(h.page.getByRole('dialog')).toHaveCount(0)
  }
  h.importCount = async (count) => {
    await h.button(`Import ${count} transaction${count === 1 ? '' : 's'}`).click()
    await expect(h.page.getByRole('dialog')).toHaveCount(0)
  }
  h.month = async (year, label) => {
    await h.page.getByTitle('Jump to a month', { exact: true }).click()
    const picker = h.page.getByRole('dialog', { name: 'Jump to a month', exact: true })
    let current = Number(await picker.locator('strong').innerText())
    while (current !== year) {
      await picker.getByLabel(current < year ? 'Next year' : 'Previous year', { exact: true }).click()
      current += current < year ? 1 : -1
    }
    await h.button(`${label} ${year}`, picker).click()
    await expect(picker).toHaveCount(0)
  }
  h.addTransaction = async ({ description, amount, date, kind = 'expense', category = '' }) => {
    await h.button('Add transaction').click()
    const dialog = h.page.getByRole('dialog')
    await h.field('Description').fill(description)
    await h.field('Amount').fill(String(amount))
    await h.field('Date').fill(date)
    await h.field('Type').selectOption(kind)
    await h.field('Category').selectOption(category)
    await h.button('Add transaction', dialog).click()
    await expect(dialog).toHaveCount(0)
    await h.saved((d) => d.transactions.some((t) => t.description === description && t.amount === amount))
  }
  h.holdFirstIpc = async (channel) => {
    // Electron has no public invoke-handler interceptor. This test-only wrapper
    // guards the private map shape, keeps the real handler, and restores it.
    // An explicit gate makes queued-edit races deterministic without sleeps.
    await h.app.evaluate(({ ipcMain }, name) => {
      const original = ipcMain._invokeHandlers?.get(name)
      if (typeof original !== 'function') throw new Error(`Cannot intercept IPC handler ${name}`)
      let release
      const wait = new Promise((resolve) => { release = resolve })
      const gate = { name, original, release, started: false }
      globalThis.__budgetSmokeGate = gate
      ipcMain.removeHandler(name)
      ipcMain.handle(name, async (...args) => {
        if (!gate.started) {
          gate.started = true
          await wait
        }
        return original(...args)
      })
    }, channel)
  }
  h.waitForHeldIpc = () => expect.poll(() =>
    h.app.evaluate(() => globalThis.__budgetSmokeGate.started)).toBe(true)
  h.releaseIpc = () => h.app.evaluate(({ ipcMain }) => {
    const gate = globalThis.__budgetSmokeGate
    gate.release()
    ipcMain.removeHandler(gate.name)
    ipcMain.handle(gate.name, gate.original)
    delete globalThis.__budgetSmokeGate
  })
  h.screenshot = (name) => h.page.screenshot({ path: path.join(screenshotDir, `${name}.png`) })
  h.scenario = async (name, run) => {
    console.log(`Checking: ${name}`)
    await run(h)
    checks.push(name)
    assert.deepEqual(errors, [], `Renderer exceptions during ${name}`)
  }
  h.dispose = async () => {
    if (h.app) await h.app.close()
    if (!process.env.BUDGET_KEEP_SMOKE_DATA) fs.rmSync(directory, { recursive: true, force: true })
  }
  try {
    await h.launch()
    return h
  } catch (error) {
    await h.dispose()
    throw error
  }
}

module.exports = { createHarness, expect, assert, fs, path }
