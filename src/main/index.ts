/**
 * VoxFlow Main Entry Point
 * Last Build Trigger: 2026-04-30
 */
import { app, clipboard, ipcMain, BrowserWindow } from 'electron'
import { createTray, setTrayRecording, destroyTray } from './tray'
import {
  createOverlayWindow,
  createSettingsWindow,
  broadcastToAll,
  showOverlay,
  hideOverlay
} from './windows'
import { registerIpcHandlers } from './ipc'
import { NativeBridge } from './native-bridge'
import { loadSettings } from './settings-store'
import { addEntry } from './history-store'
import { isLocalWhisperAvailable, isLocalParakeetAvailable, isOllamaAvailable, rewriteTranscriptStep, transcribeAudioStep } from './ai-pipeline'
import { setupUpdater, manualCheckForUpdates } from './updater'
import { applySpokenCommands } from './utils'
import { AppSettings, IPC, LastAudioSnapshot, PipelineDiagnostics, PipelineMetadata, RecordingState, RecordingMode, StepError } from '@shared/types'
import { randomUUID } from 'crypto'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'

// ─── Prevent second instance ──────────────────────────────────────────────────

if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// ─── App state ────────────────────────────────────────────────────────────────

const bridge = new NativeBridge()
let currentState: RecordingState = 'idle'
let currentMode: RecordingMode = 'dictate'
let nativeStatus: 'ready' | 'error' | 'starting' = 'starting'
let resetStateTimer: NodeJS.Timeout | null = null
let lastAudio: Omit<LastAudioSnapshot, 'audioBase64' | 'exists'> | null = null
let lastDiagnostics: Partial<PipelineDiagnostics> = {
  lastPasteStatus: 'skipped'
}
let pendingPaste: string | null = null
let deviceListResolver: ((devices: any[]) => void) | null = null

function lastAudioPath(): string {
  return path.join(app.getPath('userData'), 'last-recording.wav')
}

function lastAudioMetaPath(): string {
  return path.join(app.getPath('userData'), 'last-recording.json')
}

function setState(state: RecordingState): void {
  if (resetStateTimer) {
    clearTimeout(resetStateTimer)
    resetStateTimer = null
  }

  currentState = state
  broadcastToAll(IPC.RECORDING_STATE, state)
  setTrayRecording(state === 'recording')
  const settings = loadSettings()

  if (settings.showOverlay && (state === 'recording' || state === 'processing')) {
    showOverlay()
  } else {
    // Auto-hide overlay after showing result
    if (state === 'done' || state === 'error') {
      setTimeout(() => hideOverlay(), 4000)
    }
  }

  if (state === 'done' || state === 'error') {
    resetStateTimer = setTimeout(() => setState('idle'), 1200)
  }
}

function canStartRecording(): boolean {
  return currentState === 'idle' || currentState === 'done' || currentState === 'error'
}

// ─── Audio processing pipeline ────────────────────────────────────────────────

async function processRecording(audioPath: string, duration: number, appName: string): Promise<void> {
  const baseSettings = loadSettings()
  const settings = resolveSettingsForApp(baseSettings, appName)
  setState('processing')
  const metadata: PipelineMetadata = {
    asrProvider: baseSettings.asrProvider,
    llmProvider: baseSettings.llmProvider,
    effectiveAsrProvider: settings.asrProvider,
    effectiveLlmProvider: settings.llmProvider,
    privacyMode: baseSettings.privacyMode,
    historyWritten: false,
    lastPasteStatus: 'skipped'
  }

  try {
    rememberAudio(audioPath, duration, appName, currentMode, baseSettings)

    console.log(`[pipeline] audio file -> asr -> voice commands -> llm -> clipboard -> paste -> history (${audioPath})`)
    const asrResult = await transcribeAudioStep(audioPath, settings)
    metadata.lastAsrDurationMs = asrResult.durationMs
    metadata.fallbackUsed = asrResult.fallbackUsed
    lastDiagnostics = {
      ...lastDiagnostics,
      lastAsrDurationMs: asrResult.durationMs,
      fallbackUsed: asrResult.fallbackUsed,
      lastError: asrResult.error
    }

    if (!asrResult.ok || !asrResult.value?.trim()) {
      throw stepError(asrResult.error ?? { message: 'ASR returned no transcript' }, 'ASR failed')
    }

    const raw = asrResult.value
    broadcastToAll(IPC.TRANSCRIPTION_RAW, raw)

    const commandText = settings.commandMode ? applySpokenCommands(raw) : raw
    const llmResult = commandText.trim().length > 0
      ? await rewriteTranscriptStep(commandText, settings, currentMode)
      : {
          ok: true,
          step: 'llm',
          durationMs: 0,
          provider: settings.llmProvider,
          value: commandText
        }

    metadata.lastLlmDurationMs = llmResult.durationMs
    metadata.fallbackUsed = llmResult.fallbackUsed ?? metadata.fallbackUsed
    lastDiagnostics = {
      ...lastDiagnostics,
      lastLlmDurationMs: llmResult.durationMs,
      fallbackUsed: metadata.fallbackUsed,
      lastError: llmResult.error ?? lastDiagnostics.lastError
    }

    if (!llmResult.ok) {
      throw stepError(llmResult.error ?? { message: 'LLM rewrite failed' }, 'LLM failed')
    }

    const final = llmResult.value ?? commandText

    broadcastToAll(IPC.TRANSCRIPTION_FINAL, final)

    if (final.trim().length > 0) {
      if (settings.pasteMode === 'auto-paste') {
        try {
          // Small delay to let key-up events clear
          await new Promise((r) => setTimeout(r, 150))
          clipboard.writeText(final)
          bridge.paste()
          metadata.lastPasteStatus = 'success'
        } catch (error) {
          metadata.lastPasteStatus = 'failed'
          lastDiagnostics = {
            ...lastDiagnostics,
            lastPasteStatus: 'failed',
            lastError: normalizeError(error)
          }
          throw error
        }
      } else if (settings.pasteMode === 'confirm') {
        pendingPaste = final
        clipboard.writeText(final)
        metadata.lastPasteStatus = 'skipped' // waiting for confirm
        // Ensure overlay stays open for confirmation
        if (settings.showOverlay) {
          showOverlay()
        }
      } else {
        // copy-only
        clipboard.writeText(final)
        metadata.lastPasteStatus = 'skipped'
      }
    }
    lastDiagnostics = { ...lastDiagnostics, lastPasteStatus: metadata.lastPasteStatus }

    if (!baseSettings.privacyMode) {
      metadata.historyWritten = true
      addEntry({
        id: randomUUID(),
        timestamp: Date.now(),
        rawTranscript: raw,
        finalText: final,
        mode: currentMode,
        duration,
        appName,
        metadata
      })
    }

    setState('done')
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[pipeline] error:', message)
    lastDiagnostics = {
      ...lastDiagnostics,
      lastError: normalizeError(err)
    }
    broadcastToAll(IPC.TRANSCRIPTION_ERROR, message)
    setState('error')
  } finally {
    // Clean up temp audio file
    try { fs.unlinkSync(audioPath) } catch { /* ignore */ }
  }
}

function resolveSettingsForApp(settings: AppSettings, appName: string): AppSettings {
  if (settings.privacyMode) {
    return {
      ...settings,
      asrProvider: 'local-whisper',
      llmProvider: settings.llmProvider === 'local-llm' ? 'local-llm' : 'none',
      pasteMode: settings.disableAutoPasteInPrivacyMode ? 'copy-only' : settings.pasteMode
    }
  }

  const profile = settings.appProfiles.find((candidate) => {
    if (!candidate.enabled || !candidate.match.trim()) return false
    try {
      return new RegExp(candidate.match, 'i').test(appName)
    } catch {
      return appName.toLowerCase().includes(candidate.match.toLowerCase())
    }
  })

  if (!profile) return settings

  return {
    ...settings,
    asrProvider: profile.asrProvider,
    llmProvider: profile.llmProvider,
    rewriteStyle: profile.rewriteStyle,
    targetLanguage: profile.targetLanguage,
    pasteMode: profile.pasteMode,
    llmModel: profile.llmModel,
    localAsrModel: profile.localAsrModel,
    localLlmModel: profile.localLlmModel,
    localLlmEndpoint: profile.localLlmEndpoint,
    offlineFallback: profile.offlineFallback
  }
}

function rememberAudio(audioPath: string, duration: number, appName: string, mode: RecordingMode, settings: AppSettings): void {
  if (!settings.keepLastAudio) return

  try {
    fs.mkdirSync(path.dirname(lastAudioPath()), { recursive: true })
    if (path.resolve(audioPath) !== path.resolve(lastAudioPath())) {
      fs.copyFileSync(audioPath, lastAudioPath())
    }
    lastAudio = {
      appName,
      duration,
      mode,
      recordedAt: Date.now()
    }
    fs.writeFileSync(lastAudioMetaPath(), JSON.stringify(lastAudio, null, 2), 'utf-8')
    broadcastToAll(IPC.LAST_AUDIO_UPDATED, getLastAudioSnapshot())
  } catch (error) {
    console.warn('[audio] failed to preserve last recording:', error)
  }
}

function loadLastAudioMeta(): Omit<LastAudioSnapshot, 'audioBase64' | 'exists'> | null {
  if (lastAudio) return lastAudio

  try {
    const metaPath = lastAudioMetaPath()
    if (!fs.existsSync(metaPath)) return null

    const parsed = JSON.parse(fs.readFileSync(metaPath, 'utf-8')) as Omit<LastAudioSnapshot, 'audioBase64' | 'exists'>
    if (!parsed.recordedAt) return null

    lastAudio = parsed
    return lastAudio
  } catch (error) {
    console.warn('[audio] failed to read last recording metadata:', error)
    return null
  }
}

function getLastAudioSnapshot(): LastAudioSnapshot {
  const filePath = lastAudioPath()
  const metadata = loadLastAudioMeta()
  if (!metadata || !fs.existsSync(filePath)) return { exists: false }

  return {
    exists: true,
    ...metadata,
    audioBase64: fs.readFileSync(filePath).toString('base64')
  }
}

async function retryLastAudio(): Promise<{ ok: boolean; error?: string }> {
  const filePath = lastAudioPath()
  const metadata = loadLastAudioMeta()
  if (!metadata || !fs.existsSync(filePath)) {
    return { ok: false, error: 'No preserved recording is available.' }
  }

  const retryPath = path.join(app.getPath('temp'), `voxflow-retry-${Date.now()}.wav`)
  fs.copyFileSync(filePath, retryPath)
  currentMode = metadata.mode ?? 'dictate'
  await processRecording(retryPath, metadata.duration ?? 0, metadata.appName ?? 'Retry')
  return { ok: true }
}

async function getDiagnostics(): Promise<Record<string, unknown>> {
  const settings = loadSettings()
  const providers = {
    localWhisper: settings.asrProvider === 'local-whisper' || settings.privacyMode,
    openai: Boolean(settings.openaiApiKey),
    anthropic: Boolean(settings.anthropicApiKey),
    nvidia: Boolean(settings.nvidiaApiKey),
    deepgram: Boolean(settings.deepgramApiKey),
    localLlm: settings.llmProvider === 'local-llm' || settings.offlineFallback
  }

  const [localWhisperAvailable, localParakeetAvailable, ollamaAvailable] = await Promise.all([
    isLocalWhisperAvailable(settings.localAsrModel),
    isLocalParakeetAvailable(),
    isOllamaAvailable(settings)
  ])

  return new Promise((resolve) => {
    execFile(process.platform === 'win32' ? 'python' : 'python3', ['--version'], { timeout: 3000 }, (error, stdout, stderr) => {
      resolve({
        nativeStatus,
        pythonHelperStatus: nativeStatus,
        microphoneRecordingStatus: currentState,
        python: error ? 'Unavailable' : (stdout || stderr).trim(),
        localWhisperAvailable,
        localParakeetAvailable,
        ollamaAvailable,
        selectedAsrProvider: settings.asrProvider,
        selectedLlmProvider: settings.llmProvider,
        lastAsrDurationMs: lastDiagnostics.lastAsrDurationMs,
        lastLlmDurationMs: lastDiagnostics.lastLlmDurationMs,
        lastPasteStatus: lastDiagnostics.lastPasteStatus,
        lastError: lastDiagnostics.lastError,
        fallbackUsed: lastDiagnostics.fallbackUsed,
        privacyMode: settings.privacyMode,
        keepLastAudio: settings.keepLastAudio,
        commandMode: settings.commandMode,
        localLlmModel: settings.localLlmModel,
        offlineFallback: settings.offlineFallback,
        profilesEnabled: settings.appProfiles.filter((profile) => profile.enabled).length,
        providers,
        lastAudioExists: fs.existsSync(lastAudioPath())
      })
    })
  })
}

function stepError(error: StepError, fallback: string): Error {
  const next = new Error(error.message || fallback)
  if (error.stack) next.stack = error.stack
  return next
}

function normalizeError(error: unknown): StepError {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack }
  }
  return { message: String(error) }
}

// ─── App lifecycle ────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setAppUserModelId('com.voxflow.app')

  const settings = loadSettings()
  setupUpdater()

  registerIpcHandlers(
    (newSettings) => bridge.updateHotkeys(newSettings),
    () => nativeStatus,
    getLastAudioSnapshot,
    retryLastAudio,
    getDiagnostics,
    async () => {
      return new Promise((resolve) => {
        deviceListResolver = resolve
        bridge.listDevices()
        setTimeout(() => {
          if (deviceListResolver) {
            deviceListResolver([])
            deviceListResolver = null
          }
        }, 3000)
      })
    }
  )

  // Registered handlers already in registerIpcHandlers above

  ipcMain.handle(IPC.TEST_PASTE, async () => {
    const text = 'VoxFlow Test Paste\nSuccessful injection.'
    clipboard.writeText(text)
    bridge.paste()
    return { ok: true }
  })

  ipcMain.handle(IPC.TEST_MICROPHONE, async () => {
    // Simulate a 3s recording flow with dummy audio if we had one,
    // but for now just trigger the processing state for feedback.
    setState('recording')
    setTimeout(() => setState('processing'), 2000)
    setTimeout(() => {
      broadcastToAll(IPC.TRANSCRIPTION_FINAL, 'Microphone test successful.')
      setState('done')
    }, 4000)
    return { ok: true }
  })

  ipcMain.handle(IPC.PASTE_CONFIRM, async () => {
    if (pendingPaste) {
      bridge.paste()
      pendingPaste = null
      hideOverlay()
      return { ok: true }
    }
    return { ok: false, error: 'No pending paste' }
  })
  
  ipcMain.handle(IPC.CHECK_FOR_UPDATES, async () => {
    return manualCheckForUpdates()
  })

  ipcMain.handle(IPC.APP_VERSION, () => {
    return app.getVersion()
  })

  ipcMain.handle(IPC.NATIVE_RESTART, async () => {
    console.log('[app] Restarting native helper...')
    bridge.stop()
    // Give it a moment to release ports/files
    await new Promise(r => setTimeout(r, 800))
    bridge.start(loadSettings())
    return { ok: true }
  })

  ipcMain.on(IPC.OPEN_DEV_TOOLS, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.webContents.openDevTools({ mode: 'detach' })
  })
  
  createOverlayWindow()

  if (!settings.startMinimized || !app.isPackaged) createSettingsWindow()

  createTray(
    () => createSettingsWindow(),
    () => app.quit()
  )

  // Start Python helper
  bridge.start(settings);

  // Perform Local Readiness Check
  (async () => {
    const [whisper, parakeet, ollama] = await Promise.all([
      isLocalWhisperAvailable(),
      isLocalParakeetAvailable(),
      isOllamaAvailable(settings)
    ])
    console.log('[startup] Local Readiness Check:')
    console.log(` - Local Whisper: ${whisper ? 'READY' : 'NOT FOUND'}`)
    console.log(` - Local Parakeet: ${parakeet ? 'READY' : 'NOT FOUND'}`)
    console.log(` - Ollama: ${ollama ? 'READY' : 'NOT RUNNING'}`)
    
    if (settings.asrProvider === 'local-parakeet' && !parakeet) {
      console.warn('[startup] Warning: local-parakeet selected but models/script missing. Falling back to local-whisper for this session if available.')
    }
    
    if (settings.llmProvider === 'local-llm' && !ollama) {
      console.warn('[startup] Warning: local-llm selected but Ollama is not running.')
    }
  })()

  bridge.onEvent((event) => {
    switch (event.event) {
      case 'ready':
        console.log('[native] helper ready')
        nativeStatus = 'ready'
        broadcastToAll(IPC.NATIVE_STATUS, 'ready')
        break

      case 'hotkey_down':
        if (canStartRecording()) {
          currentMode = event.mode ?? 'dictate'
          setState('recording')
        }
        break

      case 'hotkey_up':
        if (currentState === 'recording' && event.audio_path) {
          const audioPath = event.audio_path
          const duration = event.duration ?? 0
          const appName = event.app_name ?? 'Unknown'

          // Check minimum duration (avoid accidental taps)
          if (duration < 0.5) {
            broadcastToAll(IPC.TRANSCRIPTION_ERROR, 'Enregistrement trop court')
            setState('error')
            return
          }

          processRecording(audioPath, duration, appName)
        }
        break

      case 'error':
        console.error('[native]', event.message)
        nativeStatus = 'error'
        broadcastToAll(IPC.NATIVE_STATUS, 'error')
        broadcastToAll(IPC.TRANSCRIPTION_ERROR, event.message ?? 'Native helper failed')
        if (currentState === 'recording' || currentState === 'processing') {
          setState('error')
        }
        break

      case 'hotkey_undo':
        console.log('[native] undo requested')
        bridge.undo()
        break
      case 'audio_devices':
        if (deviceListResolver) {
          deviceListResolver(event.devices || [])
          deviceListResolver = null
        }
        break
      case 'log':
        console.log(`[native:${event.level ?? 'info'}]`, event.message)
        broadcastToAll(IPC.NATIVE_LOG, { level: event.level ?? 'info', message: event.message })
        break
    }
  })

  console.log('[app] VoxFlow started')
})

app.on('window-all-closed', () => {
  // Keep running in tray
})

app.on('before-quit', () => {
  bridge.stop()
  destroyTray()
})
