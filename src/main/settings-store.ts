import { app, safeStorage } from 'electron'
import path from 'path'
import fs from 'fs'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')
const ENC_PREFIX = 'v1:'
const SENSITIVE_KEYS: (keyof AppSettings)[] = [
  'openaiApiKey',
  'anthropicApiKey',
  'nvidiaApiKey',
  'deepgramApiKey'
]

function encryptValue(val: string): string {
  if (!val || val.startsWith(ENC_PREFIX)) return val
  if (!safeStorage.isEncryptionAvailable()) return val
  try {
    return ENC_PREFIX + safeStorage.encryptString(val).toString('base64')
  } catch (err) {
    console.error('[settings] Encryption failed:', err)
    return val
  }
}

function decryptValue(val: string): string {
  if (!val || !val.startsWith(ENC_PREFIX)) return val
  if (!safeStorage.isEncryptionAvailable()) return val
  try {
    const buffer = Buffer.from(val.slice(ENC_PREFIX.length), 'base64')
    return safeStorage.decryptString(buffer)
  } catch (err) {
    console.error('[settings] Decryption failed:', err)
    return val
  }
}

export function loadSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULT_SETTINGS }
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
    const parsed = JSON.parse(raw)
    
    // Decrypt sensitive keys
    for (const key of SENSITIVE_KEYS) {
      if (typeof parsed[key] === 'string') {
        parsed[key] = decryptValue(parsed[key])
      }
    }

    return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed })
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  const normalized = normalizeSettings(settings)
  const toSave = { ...normalized }

  // Encrypt sensitive keys before saving
  for (const key of SENSITIVE_KEYS) {
    if (typeof toSave[key] === 'string') {
      toSave[key] = encryptValue(toSave[key] as string) as any
    }
  }

  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(toSave, null, 2), 'utf-8')
}

function normalizeSettings(settings: AppSettings): AppSettings {
  const normalized: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    appProfiles: (settings.appProfiles || DEFAULT_SETTINGS.appProfiles).map((p) => ({
      ...DEFAULT_SETTINGS.appProfiles[0], // fallback to first default profile for shape
      ...p,
      pasteMode: p.pasteMode ?? ((p as Record<string, unknown>).autoPaste === false ? 'copy-only' : 'auto-paste'),
      llmModel: p.llmModel?.replace('-v1', '-v1.5') ?? p.llmModel
    }))
  }

  // Global migrations
  normalized.pasteMode = normalized.pasteMode ?? ((settings as Record<string, unknown>).autoPaste === false ? 'copy-only' : 'auto-paste')
  normalized.llmModel = normalized.llmModel?.replace('-v1', '-v1.5')

  if (normalized.privacyMode) {
    normalized.asrProvider = 'local-whisper'
    normalized.llmProvider = normalized.llmProvider === 'local-llm' ? 'local-llm' : 'none'
    normalized.pasteMode = normalized.disableAutoPasteInPrivacyMode ? 'copy-only' : normalized.pasteMode
  }

  return normalized
}
