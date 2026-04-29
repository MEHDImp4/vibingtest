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
  const oldSettings = settings as any
  const normalized: AppSettings = {
    ...settings,
    appProfiles: Array.isArray(settings.appProfiles) ? settings.appProfiles : DEFAULT_SETTINGS.appProfiles,
    privacyMode: Boolean(settings.privacyMode),
    disableAutoPasteInPrivacyMode: Boolean(settings.disableAutoPasteInPrivacyMode),
    keepLastAudio: settings.keepLastAudio !== false,
    commandMode: settings.commandMode !== false,
    onboardingCompleted: Boolean(settings.onboardingCompleted),
    localLlmModel: settings.localLlmModel?.trim() || DEFAULT_SETTINGS.localLlmModel,
    localLlmEndpoint: settings.localLlmEndpoint?.trim() || DEFAULT_SETTINGS.localLlmEndpoint,
    offlineFallback: settings.offlineFallback !== false,
    undoHotkey: settings.undoHotkey || DEFAULT_SETTINGS.undoHotkey,
    personalDictionary: settings.personalDictionary || DEFAULT_SETTINGS.personalDictionary
  }

  // Migrate autoPaste to pasteMode
  if (normalized.pasteMode === undefined) {
    if (oldSettings.autoPaste === false) {
      normalized.pasteMode = 'copy-only'
    } else {
      normalized.pasteMode = 'auto-paste'
    }
  }

  if (normalized.llmProvider === 'nvidia-nim' && normalized.llmModel === 'nvidia/llama-3.3-nemotron-super-49b-v1') {
    normalized.llmModel = 'nvidia/llama-3.3-nemotron-super-49b-v1.5'
  }

  normalized.appProfiles = normalized.appProfiles.map((profile) => {
    const oldProfile = profile as any
    const p = {
      ...profile,
      localLlmModel: profile.localLlmModel?.trim() || normalized.localLlmModel,
      localLlmEndpoint: profile.localLlmEndpoint?.trim() || normalized.localLlmEndpoint,
      offlineFallback: profile.offlineFallback !== false,
      llmModel: profile.llmModel === 'nvidia/llama-3.3-nemotron-super-49b-v1'
        ? 'nvidia/llama-3.3-nemotron-super-49b-v1.5'
        : profile.llmModel
    }

    if (p.pasteMode === undefined) {
      if (oldProfile.autoPaste === false) {
        p.pasteMode = 'copy-only'
      } else {
        p.pasteMode = 'auto-paste'
      }
    }
    return p
  })

  if (normalized.privacyMode) {
    return {
      ...normalized,
      asrProvider: 'local-whisper',
      llmProvider: normalized.llmProvider === 'local-llm' ? 'local-llm' : 'none',
      pasteMode: normalized.disableAutoPasteInPrivacyMode ? 'copy-only' : normalized.pasteMode
    }
  }

  return normalized
}
