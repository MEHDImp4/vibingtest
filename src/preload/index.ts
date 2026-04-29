import { contextBridge, ipcRenderer } from 'electron'
import { IPC, AppSettings, LastAudioSnapshot, RendererEventChannel, TranscriptionEntry, VoxflowApi, WordStats } from '@shared/types'

const validEventChannels = [
  IPC.RECORDING_STATE,
  IPC.TRANSCRIPTION_RAW,
  IPC.TRANSCRIPTION_FINAL,
  IPC.TRANSCRIPTION_ERROR,
  IPC.LAST_AUDIO_UPDATED,
  IPC.NATIVE_STATUS
] satisfies RendererEventChannel[]

// Expose a safe, typed API to the renderer
const api: VoxflowApi = {
  // Settings
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke(IPC.SETTINGS_GET),
  saveSettings: (s: AppSettings): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke(IPC.SETTINGS_SAVE, s),

  // History
  getHistory: (): Promise<TranscriptionEntry[]> => ipcRenderer.invoke(IPC.HISTORY_GET),
  getWordStats: (): Promise<WordStats> => ipcRenderer.invoke(IPC.HISTORY_WORD_STATS),
  clearHistory: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.HISTORY_CLEAR),
  deleteEntry: (id: string): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.HISTORY_DELETE, id),

  // Clipboard
  copyText: (text: string): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.COPY_TEXT, text),
  getNativeStatus: (): Promise<'ready' | 'error' | 'starting'> =>
    ipcRenderer.invoke(IPC.NATIVE_STATUS_GET),
  getLastAudio: (): Promise<LastAudioSnapshot> => ipcRenderer.invoke(IPC.LAST_AUDIO_GET),
  retryLastAudio: (): Promise<{ ok: boolean; error?: string }> => ipcRenderer.invoke(IPC.LAST_AUDIO_RETRY),
  getDiagnostics: (): Promise<Record<string, unknown>> => ipcRenderer.invoke(IPC.DIAGNOSTICS_GET),
  closeWindow: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.WINDOW_CLOSE),
  minimizeWindow: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.WINDOW_MINIMIZE),
  testMicrophone: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.TEST_MICROPHONE),
  testPaste: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.TEST_PASTE),
  confirmPaste: (): Promise<{ ok: boolean }> => ipcRenderer.invoke(IPC.PASTE_CONFIRM),

  // Events from main
  on: (channel: RendererEventChannel, cb: (...args: unknown[]) => void) => {
    if (validEventChannels.includes(channel)) {
      const subscription = (_e: Electron.IpcRendererEvent, ...args: unknown[]) => cb(...args)
      ipcRenderer.on(channel, subscription)
      return () => ipcRenderer.removeListener(channel, subscription)
    }
    return () => {}
  },

  // Window type query
  getWindowType: () => {
    try {
      const search = (globalThis as any).location?.search
      if (!search) return 'main'
      const params = new URLSearchParams(search)
      return params.get('window') ?? 'main'
    } catch {
      return 'main'
    }
  }
}

contextBridge.exposeInMainWorld('voxflow', api)

// Type augmentation for window.voxflow
export {}
