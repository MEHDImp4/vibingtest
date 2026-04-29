// ─── Recording states ────────────────────────────────────────────────────────

export type RecordingState = 'idle' | 'recording' | 'processing' | 'done' | 'error'

export type RecordingMode = 'dictate' | 'translate'

export type AsrProvider = 'openai-whisper' | 'deepgram' | 'nvidia-nim' | 'local-whisper'
export type LlmProvider = 'none' | 'openai' | 'anthropic' | 'nvidia-nim' | 'local-llm'
export type RewriteStyle = 'clean' | 'formal' | 'casual' | 'minimal'
export type PasteMode = 'copy-only' | 'auto-paste' | 'confirm'

export interface AppProfile {
  id: string
  name: string
  match: string
  enabled: boolean
  asrProvider: AsrProvider
  llmProvider: LlmProvider
  rewriteStyle: RewriteStyle
  targetLanguage: string
  pasteMode: PasteMode
  llmModel: string
  localAsrModel: string
  localLlmModel: string
  localLlmEndpoint: string
  offlineFallback: boolean
}

export interface LastAudioSnapshot {
  exists: boolean
  appName?: string
  duration?: number
  mode?: RecordingMode
  recordedAt?: number
  audioBase64?: string
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface AppSettings {
  dictateHotkey: string
  translateHotkey: string
  asrProvider: AsrProvider
  llmProvider: LlmProvider
  openaiApiKey: string
  anthropicApiKey: string
  nvidiaApiKey: string
  deepgramApiKey: string
  targetLanguage: string   // for translation mode
  rewriteStyle: RewriteStyle
  pasteMode: PasteMode
  undoHotkey: string
  personalDictionary: string
  showOverlay: boolean
  startMinimized: boolean
  llmModel: string
  localAsrModel: string
  localLlmModel: string
  localLlmEndpoint: string
  offlineFallback: boolean
  privacyMode: boolean
  disableAutoPasteInPrivacyMode: boolean
  keepLastAudio: boolean
  commandMode: boolean
  onboardingCompleted: boolean
  appProfiles: AppProfile[]
}

export interface WordStats {
  today: number
  thisWeek: number
  thisMonth: number
  total: number
  capturesToday: number
  capturesThisWeek: number
  capturesThisMonth: number
}

export const DEFAULT_SETTINGS: AppSettings = {
  dictateHotkey: 'ctrl+shift+space',
  translateHotkey: 'ctrl+shift+t',
  asrProvider: 'local-whisper',
  llmProvider: 'none',
  openaiApiKey: '',
  anthropicApiKey: '',
  nvidiaApiKey: '',
  deepgramApiKey: '',
  targetLanguage: 'English',
  rewriteStyle: 'clean',
  pasteMode: 'auto-paste',
  undoHotkey: 'ctrl+shift+z',
  personalDictionary: '',
  showOverlay: true,
  startMinimized: false,
  llmModel: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
  localAsrModel: 'base',
  localLlmModel: 'llama3.2:1b',
  localLlmEndpoint: 'http://127.0.0.1:11434',
  offlineFallback: true,
  privacyMode: false,
  disableAutoPasteInPrivacyMode: false,
  keepLastAudio: true,
  commandMode: true,
  onboardingCompleted: false,
  appProfiles: [
    {
      id: 'profile-browser',
      name: 'Browser writing',
      match: 'chrome|edge|firefox|brave',
      enabled: false,
      asrProvider: 'local-whisper',
      llmProvider: 'none',
      rewriteStyle: 'clean',
      targetLanguage: 'English',
      pasteMode: 'auto-paste',
      llmModel: 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
      localAsrModel: 'base',
      localLlmModel: 'llama3.2:1b',
      localLlmEndpoint: 'http://127.0.0.1:11434',
      offlineFallback: true
    }
  ]
}

// ─── History ─────────────────────────────────────────────────────────────────

export interface TranscriptionEntry {
  id: string
  timestamp: number
  rawTranscript: string
  finalText: string
  mode: RecordingMode
  duration: number       // seconds
  appName: string        // active app when pasted
  error?: string
  metadata?: PipelineMetadata
}

export interface StepError {
  message: string
  stack?: string
  code?: string
}

export interface StepResult<T> {
  ok: boolean
  step: string
  durationMs: number
  provider?: string
  fallbackUsed?: string
  value?: T
  error?: StepError
}

export interface PipelineMetadata {
  asrProvider: AsrProvider
  llmProvider: LlmProvider
  effectiveAsrProvider: AsrProvider
  effectiveLlmProvider: LlmProvider
  fallbackUsed?: string
  lastAsrDurationMs?: number
  lastLlmDurationMs?: number
  lastPasteStatus?: 'skipped' | 'success' | 'failed'
  privacyMode: boolean
  historyWritten: boolean
}

export interface PipelineDiagnostics {
  pythonHelperStatus: 'ready' | 'error' | 'starting'
  microphoneRecordingStatus: RecordingState
  localWhisperAvailable: boolean
  ollamaAvailable: boolean
  selectedAsrProvider: AsrProvider
  selectedLlmProvider: LlmProvider
  lastAsrDurationMs?: number
  lastLlmDurationMs?: number
  lastPasteStatus?: 'skipped' | 'success' | 'failed'
  lastError?: StepError
  fallbackUsed?: string
}

export type NativeStatus = 'ready' | 'error' | 'starting'

export type RendererEventChannel =
  | typeof IPC.RECORDING_STATE
  | typeof IPC.TRANSCRIPTION_RAW
  | typeof IPC.TRANSCRIPTION_FINAL
  | typeof IPC.TRANSCRIPTION_ERROR
  | typeof IPC.LAST_AUDIO_UPDATED
  | typeof IPC.NATIVE_STATUS

export interface VoxflowApi {
  getSettings: () => Promise<AppSettings>
  saveSettings: (settings: AppSettings) => Promise<{ ok: boolean }>
  getHistory: () => Promise<TranscriptionEntry[]>
  getWordStats: () => Promise<WordStats>
  clearHistory: () => Promise<{ ok: boolean }>
  deleteEntry: (id: string) => Promise<{ ok: boolean }>
  copyText: (text: string) => Promise<{ ok: boolean }>
  getNativeStatus: () => Promise<NativeStatus>
  getLastAudio: () => Promise<LastAudioSnapshot>
  retryLastAudio: () => Promise<{ ok: boolean; error?: string }>
  getDiagnostics: () => Promise<Record<string, unknown>>
  closeWindow: () => Promise<{ ok: boolean }>
  minimizeWindow: () => Promise<{ ok: boolean }>
  testMicrophone: () => Promise<{ ok: boolean }>
  testPaste: () => Promise<{ ok: boolean }>
  confirmPaste: () => Promise<{ ok: boolean }>
  on: (channel: RendererEventChannel, cb: (...args: unknown[]) => void) => () => void
  getWindowType: () => string
}

// ─── IPC channel names ────────────────────────────────────────────────────────

export const IPC = {
  // Main → Renderer
  RECORDING_STATE: 'recording:state',
  TRANSCRIPTION_RAW: 'transcription:raw',
  TRANSCRIPTION_FINAL: 'transcription:final',
  TRANSCRIPTION_ERROR: 'transcription:error',
  LAST_AUDIO_UPDATED: 'audio:last:updated',
  NATIVE_STATUS: 'native:status',

  // Renderer → Main (invoke)
  SETTINGS_GET: 'settings:get',
  SETTINGS_SAVE: 'settings:save',
  HISTORY_GET: 'history:get',
  HISTORY_WORD_STATS: 'history:word-stats',
  HISTORY_CLEAR: 'history:clear',
  HISTORY_DELETE: 'history:delete',
  OPEN_SETTINGS: 'window:settings',
  COPY_TEXT: 'clipboard:copy',
  NATIVE_STATUS_GET: 'native:status:get',
  LAST_AUDIO_GET: 'audio:last:get',
  LAST_AUDIO_RETRY: 'audio:last:retry',
  DIAGNOSTICS_GET: 'diagnostics:get',
  WINDOW_CLOSE: 'window:close',
  WINDOW_MINIMIZE: 'window:minimize',

  // Feature expansion
  TEST_MICROPHONE: 'test:microphone',
  TEST_PASTE: 'test:paste',
  PASTE_CONFIRM: 'paste:confirm'
} as const

// ─── Native helper messages ───────────────────────────────────────────────────

export interface NativeEvent {
  event: 'ready' | 'hotkey_down' | 'hotkey_up' | 'hotkey_undo' | 'error' | 'log'
  hotkey?: string
  mode?: RecordingMode
  audio_path?: string
  duration?: number
  message?: string
  level?: 'info' | 'warn' | 'error'
  app_name?: string
}

export interface NativeCommand {
  cmd: 'update_hotkeys' | 'paste' | 'undo' | 'shutdown'
  dictate_hotkey?: string
  translate_hotkey?: string
  undo_hotkey?: string
  text?: string
}
