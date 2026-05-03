import { ipcMain, clipboard, BrowserWindow } from 'electron'
import { AppSettings, IPC, LastAudioSnapshot } from '@shared/types'
import { loadSettings, saveSettings } from './settings-store'
import { getHistory, getWordStats, clearHistory, deleteEntry } from './history-store'

export function registerIpcHandlers(
  onSettingsSave?: (settings: AppSettings) => void,
  getNativeStatus?: () => 'ready' | 'error' | 'starting',
  getLastAudio?: () => LastAudioSnapshot,
  retryLastAudio?: () => Promise<{ ok: boolean; error?: string }>,
  getDiagnostics?: () => Promise<Record<string, unknown>>,
  getAudioDevices?: () => Promise<Array<{ id: number | string; name: string }>>
): void {
  ipcMain.handle(IPC.SETTINGS_GET, () => loadSettings())

  ipcMain.handle(IPC.SETTINGS_SAVE, (_e, settings: AppSettings) => {
    saveSettings(settings)
    onSettingsSave?.(settings)
    return { ok: true }
  })

  ipcMain.handle(IPC.HISTORY_GET, () => getHistory())

  ipcMain.handle(IPC.HISTORY_WORD_STATS, () => getWordStats())

  ipcMain.handle(IPC.HISTORY_CLEAR, () => {
    clearHistory()
    return { ok: true }
  })

  ipcMain.handle(IPC.HISTORY_DELETE, (_e, id: string) => {
    deleteEntry(id)
    return { ok: true }
  })

  ipcMain.handle(IPC.COPY_TEXT, (_e, text: string) => {
    clipboard.writeText(text)
    return { ok: true }
  })

  ipcMain.handle(IPC.NATIVE_STATUS_GET, () => getNativeStatus?.() ?? 'starting')

  ipcMain.handle(IPC.LAST_AUDIO_GET, () => getLastAudio?.() ?? { exists: false })

  ipcMain.handle(IPC.LAST_AUDIO_RETRY, () => retryLastAudio?.() ?? { ok: false, error: 'No retry handler registered' })

  ipcMain.handle(IPC.DIAGNOSTICS_GET, () => getDiagnostics?.() ?? {})

  ipcMain.handle(IPC.AUDIO_DEVICES_GET, () => getAudioDevices?.() ?? [])

  ipcMain.on(IPC.OPEN_SETTINGS, () => {
    BrowserWindow.getAllWindows().forEach((w) => {
      if (!w.isDestroyed() && w.webContents.getURL().includes('window=main')) {
        w.focus()
      }
    })
  })

  ipcMain.handle(IPC.WINDOW_CLOSE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.close()
    return { ok: true }
  })

  ipcMain.handle(IPC.WINDOW_MINIMIZE, (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
    return { ok: true }
  })
}
