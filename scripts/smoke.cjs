/* Run after npm run build. Requires Playwright; NODE_PATH may point to a bundled install. */
const { _electron: electron } = require('playwright')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')

async function main() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'budget-ui-smoke-'))
  const screenshotDir = process.env.BUDGET_SCREENSHOTS || path.join(directory, 'screenshots')
  fs.mkdirSync(screenshotDir, { recursive: true })
  const csvPath = path.join(directory, 'statement.csv')
  const backupPath = path.join(directory, 'backup.json')
  const exportPath = path.join(directory, 'transactions.csv')
  fs.writeFileSync(
    csvPath,
    'Booked,Merchant,Value\n04/01/2026,Coffee shop,-4.50\n04/01/2026,Coffee shop,-4.50\n05/01/2026,Salary,5000\n01/01/2026,Monthly rent,-1800\n'
  )
  const env = { ...process.env, BUDGET_DATA_DIR: directory }
  delete env.ELECTRON_RUN_AS_NODE
  const app = await electron.launch({
    executablePath: require('electron'),
    args: [path.resolve('out/main/index.js')],
    env
  })
  try {
    const page = await app.firstWindow()
    page.setDefaultTimeout(10000)
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.getByRole('button', { name: /Settings$/ }).click()
    await page.getByLabel('Description contains').fill('coffee')
    await page.getByLabel('Assign category').selectOption({ label: 'Groceries' })
    await page.getByRole('button', { name: 'Add rule', exact: true }).click()
    await page.getByText('→ Groceries', { exact: true }).waitFor()
    await page.getByRole('button', { name: /Transactions$/ }).click()
    await page.getByRole('button', { name: 'Import CSV', exact: true }).click()
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
    }, csvPath)
    await page.getByRole('button', { name: 'Choose a CSV file…' }).click()
    await page.getByText('Adjust columns & save bank format', { exact: true }).click()
    await page.getByLabel('Date column', { exact: true }).selectOption('Booked')
    await page.getByLabel('Amount column', { exact: true }).selectOption('Value')
    await page.getByText('Day-first dates (DD/MM/YYYY)', { exact: true }).click()
    await page.getByRole('textbox', { name: 'Bank format name' }).fill('My checking CSV')
    await page.getByRole('button', { name: 'Save format', exact: true }).click()
    await page.getByText('Saved', { exact: true }).waitFor()
    await page.getByText('Adjust columns & save bank format', { exact: true }).click()
    await page.screenshot({ path: path.join(screenshotDir, 'import-ready.png') })
    await page.getByRole('button', { name: 'Import 3 transactions', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    let data = await page.evaluate(() => window.budget.getData())
    assert.equal(data.transactions.length, 3)
    assert.equal(data.importPresets.length, 1)
    assert.equal(
      data.transactions.find((t) => t.description === 'Coffee shop').categoryId,
      'groceries'
    )
    assert.equal(data.transactions.find((t) => t.description === 'Coffee shop').date, '2026-01-04')
    assert.equal(data.profile.incomeBasis, 'estimate')
    await page.getByLabel('Needs review', { exact: true }).check()
    await page.getByRole('checkbox', { name: 'Select this page', exact: true }).check()
    await page.getByRole('button', { name: 'Mark reviewed', exact: true }).click()
    await page.getByText('No matching transactions', { exact: true }).waitFor()
    await page.getByRole('button', { name: 'Undo last change', exact: false }).click()
    await page.getByRole('checkbox', { name: 'Select this page', exact: true }).waitFor()
    await page.getByLabel('Needs review', { exact: true }).uncheck()
    await page.getByRole('checkbox', { name: 'Select this page', exact: true }).uncheck()
    await page.screenshot({ path: path.join(screenshotDir, 'transactions.png') })

    // Export uses a native save dialog and writes real CSV, with the dialog choice supplied here.
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    }, exportPath)
    await page.getByRole('button', { name: 'Export CSV', exact: true }).click()
    await page.getByText('CSV exported with all matching transactions.', { exact: true }).waitFor()
    assert.match(fs.readFileSync(exportPath, 'utf8'), /Coffee shop/)

    // Reopen with the saved bank format; importing the same statement finds only duplicates.
    await page.getByRole('button', { name: 'Import CSV', exact: true }).click()
    await page
      .getByRole('combobox', { name: 'Bank import preset', exact: true })
      .selectOption({ label: 'My checking CSV' })
    await page.getByRole('button', { name: 'Choose a CSV file…' }).click()
    assert.equal(
      await page.getByRole('button', { name: 'Import 0 transactions', exact: true }).isDisabled(),
      true
    )
    await page.screenshot({ path: path.join(screenshotDir, 'import.png') })
    await page.keyboard.press('Escape')

    await page.getByRole('button', { name: /Bills$/ }).click()
    await page.getByRole('button', { name: 'Add bill', exact: true }).click()
    await page.getByLabel('Bill name', { exact: true }).fill('Monthly rent')
    await page.getByLabel('Amount', { exact: true }).fill('1800')
    await page.getByLabel('First due date', { exact: true }).fill('2026-01-01')
    await page.getByRole('button', { name: 'Save bill', exact: true }).click()
    await page.getByRole('button', { name: 'Record / link…', exact: true }).click()
    data = await page.evaluate(() => window.budget.getData())
    const rent = data.transactions.find((t) => t.description === 'Monthly rent')
    await page.getByLabel('Payment', { exact: true }).selectOption(rent.id)
    await page.getByRole('button', { name: 'Link payment', exact: true }).click()
    await page.getByText('Recorded', { exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.budget.getData())).transactions.length, 3)
    await page.screenshot({ path: path.join(screenshotDir, 'bills.png') })
    await page.getByRole('button', { name: /Reports$/ }).click()
    await page.getByRole('heading', { name: 'Reports', exact: true }).waitFor()
    await page.screenshot({ path: path.join(screenshotDir, 'reports.png') })

    await page.getByRole('button', { name: /Settings$/ }).click()
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async () => ({ canceled: false, filePath })
    }, backupPath)
    await page.getByRole('button', { name: 'Save backup', exact: true }).click()
    await page.getByText('Backup saved', { exact: true }).waitFor()
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    assert.equal(backup.bills.length, 1)
    assert.equal(backup.rules.length, 1)
    assert.equal(backup.importPresets.length, 1)
    // A failed mutation must leave both the app and the editor usable.
    await page.getByRole('button', { name: /Bills$/ }).click()
    await page.getByRole('button', { name: 'Add bill', exact: true }).click()
    await page.getByLabel('Bill name', { exact: true }).fill('Invalid date example')
    await page.getByLabel('Amount', { exact: true }).fill('20')
    await page.getByLabel('First due date', { exact: true }).fill('0999-01-01')
    await page.getByRole('button', { name: 'Save bill', exact: true }).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByRole('dialog').isVisible(), true)
    assert.equal(
      await page.getByLabel('Bill name', { exact: true }).inputValue(),
      'Invalid date example'
    )
    await page.getByLabel('First due date', { exact: true }).fill('2026-01-01')
    await page.getByRole('button', { name: 'Save bill', exact: true }).click()
    await page.getByRole('dialog').waitFor({ state: 'hidden' })
    assert.equal((await page.evaluate(() => window.budget.getData())).bills.length, 2)

    // Restore a valid backup through the real handler; original data gets a recovery file.
    await page.getByRole('button', { name: /Settings$/ }).click()
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [filePath] })
      dialog.showMessageBox = async () => ({ response: 1, checkboxChecked: false })
    }, backupPath)
    await page.getByRole('button', { name: 'Restore backup…', exact: true }).click()
    await page.waitForFunction(async () => (await window.budget.getData()).bills.length === 1)
    await page.getByRole('button', { name: 'Save profile', exact: true }).waitFor()
    assert.equal((await page.evaluate(() => window.budget.getData())).transactions.length, 3)
    const recovery = fs
      .readdirSync(directory)
      .find((name) => name.startsWith('budget-before-restore-'))
    assert.ok(recovery)
    assert.equal(
      JSON.parse(fs.readFileSync(path.join(directory, recovery), 'utf8')).bills.length,
      2
    )
    // Test the supported minimum window size and a dark theme with real renderer layout.
    await page.getByRole('button', { name: /Midnight/ }).click()
    await page.getByRole('button', { name: /Transactions$/ }).click()
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setSize(940, 640))
    await page.screenshot({ path: path.join(screenshotDir, 'transactions-dark-small.png') })
    assert.deepEqual(errors, [])
    console.log(
      JSON.stringify({
        result: 'passed',
        screenshots: screenshotDir,
        checks:
          'CSV mapping and presets, rules, deduplication, review/undo, export, bill linking, reports, backup/restore, error recovery, small-window dark theme'
      })
    )
  } catch (error) {
    const page = await app.firstWindow()
    console.error((await page.locator('body').innerText()).slice(0, 6000))
    await page.screenshot({ path: path.join(screenshotDir, 'failure.png') })
    throw error
  } finally {
    await app.close()
    if (!process.env.BUDGET_KEEP_SMOKE_DATA) fs.rmSync(directory, { recursive: true, force: true })
  }
}
main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
