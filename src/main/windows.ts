import { app, BrowserWindow, screen } from 'electron'
import path from 'path'

let overlayWindow: BrowserWindow | null = null
let settingsWindow: BrowserWindow | null = null

// ─── Overlay (floating recording status) ─────────────────────────────────────

export function createOverlayWindow(): BrowserWindow {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  overlayWindow = new BrowserWindow({
    width: 420,
    height: 120,
    x: Math.floor(width / 2 - 210),
    y: height - 160,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../../resources/icon.png')
  })

  overlayWindow.setIgnoreMouseEvents(false)

  if (!appIsPackaged() && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?window=overlay')
  } else {
    overlayWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: { window: 'overlay' }
    })
  }

  return overlayWindow
}

// ─── Settings / main window ───────────────────────────────────────────────────

export function createSettingsWindow(): BrowserWindow {
  if (settingsWindow && !settingsWindow.isDestroyed()) {
    settingsWindow.focus()
    return settingsWindow
  }

  settingsWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    transparent: false,
    backgroundColor: '#10100e',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    icon: path.join(__dirname, '../../resources/icon.png')
  })

  if (!appIsPackaged() && process.env['ELECTRON_RENDERER_URL']) {
    settingsWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '?window=main')
  } else {
    settingsWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
      query: { window: 'main' }
    })
  }

  settingsWindow.once('ready-to-show', () => settingsWindow?.show())
  settingsWindow.on('closed', () => { settingsWindow = null })

  return settingsWindow
}

export function getOverlayWindow(): BrowserWindow | null { return overlayWindow }
export function getSettingsWindow(): BrowserWindow | null { return settingsWindow }

export function showOverlay(): void { overlayWindow?.show() }
export function hideOverlay(): void { overlayWindow?.hide() }

export function broadcastToAll(channel: string, ...args: unknown[]): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

function appIsPackaged(): boolean {
  return app.isPackaged
}
