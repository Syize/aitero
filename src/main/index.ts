import { electronApp, is, optimizer } from '@electron-toolkit/utils'
import { app, BrowserWindow, ipcMain, shell } from 'electron'
import { join } from 'path'
import icon from '../../resources/icon.png?asset'
import { createAppConfigStore } from './config/store'
import {
  type ZoteroIpcError,
  type ZoteroIpcResult,
  zoteroIpcChannels
} from './zotero/ipc'
import { createZoteroService } from './zotero/service'
import { ZoteroServiceError } from './zotero/service'

let zoteroService: ReturnType<typeof createZoteroService>

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // open dev tools
  mainWindow.webContents.openDevTools()

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  const configStore = createAppConfigStore(app.getPath('userData'))
  zoteroService = createZoteroService(configStore)

  // Phase 2 entry point: keep Zotero library access isolated in the main process.
  await zoteroService.initialize()
  zoteroService.getSummary()
  registerZoteroIpcHandlers()

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.

function registerZoteroIpcHandlers(): void {
  ipcMain.handle(zoteroIpcChannels.selectZoteroDataDir, async (event) => {
    const ownerWindow = BrowserWindow.fromWebContents(event.sender) ?? undefined
    return handleZoteroRequest(() => zoteroService.selectZoteroDataDir(ownerWindow))
  })

  ipcMain.handle(zoteroIpcChannels.getZoteroConfig, () => {
    return handleZoteroRequest(() => zoteroService.getZoteroConfig())
  })

  ipcMain.handle(zoteroIpcChannels.listCollections, () => {
    return handleZoteroRequest(() => zoteroService.listCollections())
  })

  ipcMain.handle(zoteroIpcChannels.listItems, () => {
    return handleZoteroRequest(() => zoteroService.listItems())
  })

  ipcMain.handle(zoteroIpcChannels.getItemDetail, (_event, itemId: number) => {
    return handleZoteroRequest(() => zoteroService.getItemDetail(itemId))
  })

  ipcMain.handle(zoteroIpcChannels.resolveItemDefaultPdf, (_event, itemId: number) => {
    return handleZoteroRequest(() => zoteroService.resolveItemDefaultPdf(itemId))
  })
}

async function handleZoteroRequest<T>(run: () => Promise<T> | T): Promise<ZoteroIpcResult<T>> {
  try {
    return {
      ok: true,
      data: await run()
    }
  } catch (error) {
    return {
      ok: false,
      error: serializeZoteroError(error)
    }
  }
}

function serializeZoteroError(error: unknown): ZoteroIpcError {
  if (error instanceof ZoteroServiceError) {
    return {
      code: error.code,
      message: error.message
    }
  }

  return {
    code: 'database-query-failed',
    message: 'An unexpected Zotero error occurred.'
  }
}
