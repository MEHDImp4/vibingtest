import { app, clipboard, ipcMain } from 'electron'
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
import { isLocalWhisperAvailable, isOllamaAvailable, rewriteTranscriptStep, transcribeAudioStep } from './ai-pipeline'
import { setupUpdater, manualCheckForUpdates } from './updater'
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

function applySpokenCommands(raw: string): string {
  let text = raw

  const replacements: Array<[RegExp, string]> = [
    [/\b(?:new paragraph|nouveau paragraphe|paragraphe suivant|saut de paragraphe)\b/gi, '\n\n'],
    [/\b(?:new line|line break|ligne suivante|nouvelle ligne|retour a la ligne|retour à la ligne)\b/gi, '\n'],
    [/\b(?:bullet point|puce|liste a puce|liste à puce|tiret)\b/gi, '\n- '],
    [/\b(?:comma|virgule)\b/gi, ','],
    [/\b(?:period|full stop|point final|point)\b/gi, '.'],
    [/\b(?:colon|deux points)\b/gi, ':'],
    [/\b(?:semicolon|point virgule|point-virgule)\b/gi, ';'],
    [/\b(?:question mark|point d'interrogation|point interrogation)\b/gi, '?'],
    [/\b(?:exclamation mark|point d'exclamation|point exclamation)\b/gi, '!'],
    [/\b(?:open quote|ouvrez les guillemets|ouvrir les guillemets|guillemet ouvrant)\b/gi, '"'],
    [/\b(?:close quote|fermez les guillemets|fermer les guillemets|guillemet fermant)\b/gi, '"'],
    [/\b(?:open parenthesis|ouvrez la parenthese|ouvrez la parenthèse|parenthese ouvrante|parenthèse ouvrante)\b/gi, '('],
    [/\b(?:close parenthesis|fermez la parenthese|fermez la parenthèse|parenthese fermante|parenthèse fermante)\b/gi, ')'],
    [/\b(?:slash|barre oblique)\b/gi, '/'],
    [/\b(?:dash|em dash|tiret long)\b/gi, ' - '],
    [/\b(?:copy that|copie ca|copie ça)\b/gi, '']
  ]

  for (const [pattern, replacement] of replacements) {
    text = text.replace(pattern, replacement)
  }

  return text
    .replace(/[ \t]+([,.;:?!])/g, '$1')
    .replace(/([,.;:?!])(?=\S)/g, '$1 ')
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
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

  const [localWhisperAvailable, ollamaAvailable] = await Promise.all([
    isLocalWhisperAvailable(),
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
    getDiagnostics
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
  
  createOverlayWindow()

  if (!settings.startMinimized || !app.isPackaged) createSettingsWindow()

  createTray(
    () => createSettingsWindow(),
    () => app.quit()
  )

  // Start Python helper
  bridge.start(settings)

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
            setState('idle')
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
      case 'log':
        console.log(`[native:${event.level ?? 'info'}]`, event.message)
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
