import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { AppSettings, DEFAULT_SETTINGS } from '@shared/types'

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

export function loadSettings(): AppSettings {
  try {
    if (!fs.existsSync(SETTINGS_PATH)) return { ...DEFAULT_SETTINGS }
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8')
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) })
  } catch {
    return { ...DEFAULT_SETTINGS }
  }
}

export function saveSettings(settings: AppSettings): void {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(normalizeSettings(settings), null, 2), 'utf-8')
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
