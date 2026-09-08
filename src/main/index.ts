import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import { pathToFileURL } from 'url'
import { getTheme } from '../shared/themes'
import { isTrustedRenderer, registerIpc } from './ipc'
import { BudgetStore } from './store/budgetStore'
import { JsonDatabase } from './store/jsonDatabase'

const isDev = !app.isPackaged
// Development and smoke tests can use a disposable budget without touching personal data.
if (isDev && process.env.BUDGET_DATA_DIR) app.setPath('userData', process.env.BUDGET_DATA_DIR)
const rendererUrl =
  isDev && process.env.ELECTRON_RENDERER_URL
    ? process.env.ELECTRON_RENDERER_URL
    : pathToFileURL(join(__dirname, '../renderer/index.html')).href

function createWindow(backgroundColor: string): BrowserWindow {
  const window = new BrowserWindow({
    width: 1200,
    height: 820,
    minWidth: 940,
    minHeight: 640,
    show: false,
    title: 'Budgeting App',
    // Matches the saved theme so the window doesn't flash a wrong colour on open.
    backgroundColor,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      // The three settings that keep the renderer sandboxed from Node.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.on('ready-to-show', () => window.show())

  // External links open in the user's browser, never inside the app shell.
  window.webContents.setWindowOpenHandler(({ url }) => {
    // Only ordinary links may invoke another application; never forward file,
    // JavaScript or custom command protocols from renderer-controlled content.
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url).catch((error) => {
        console.error('[window] could not open link:', error)
      })
    }
    return { action: 'deny' }
  })
  window.webContents.on('will-navigate', (event, url) => {
    if (!isTrustedRenderer(url, rendererUrl)) event.preventDefault()
  })
  void window.loadURL(rendererUrl)

  return window
}

// JSON snapshots cannot merge concurrent writers. A second launch focuses the
// existing window instead of opening another cache against the same budget.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const window = BrowserWindow.getAllWindows()[0]
    if (window?.isMinimized()) window.restore()
    window?.show()
    window?.focus()
  })
  app.whenReady()
    .then(() => {
      const database = JsonDatabase.in(app.getPath('userData'))
      registerIpc(new BudgetStore(database), rendererUrl)
      console.log('[budget] data file:', database.path)

      const background = getTheme(database.load().profile.themeId).tokens.bg
      createWindow(background)

      app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
          createWindow(getTheme(database.load().profile.themeId).tokens.bg)
      })
    })
    .catch((error) => {
      // Storage failures need an actionable explanation, not an invisible app
      // process or an automatic reset of a budget that could not be opened.
      dialog.showErrorBox(
        'Unable to open your budget',
        error instanceof Error ? error.message : String(error)
      )
      app.quit()
    })
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
