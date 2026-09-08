import { app, BrowserWindow, shell } from 'electron'
import { join } from 'path'
import { getTheme } from '../shared/themes'
import { registerIpc } from './ipc'
import { BudgetStore } from './store/budgetStore'
import { JsonDatabase } from './store/jsonDatabase'

const isDev = !app.isPackaged

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
      sandbox: false
    }
  })

  window.on('ready-to-show', () => window.show())

  // External links open in the user's browser, never inside the app shell.
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    window.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

app.whenReady().then(() => {
  const database = JsonDatabase.in(app.getPath('userData'))
  registerIpc(new BudgetStore(database))
  console.log('[budget] data file:', database.path)

  const background = getTheme(database.load().profile.themeId).tokens.bg
  createWindow(background)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(background)
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
