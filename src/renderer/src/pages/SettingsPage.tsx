import { useEffect, useState } from 'react'
import { AppProfile, AppSettings } from '../../../shared/types'
import { hotkeyFromKeyboardEvent, isValidHotkey, normalizeHotkey } from '../utils/hotkeys'
import { PageHeader } from '../components/common/PageHeader'
import { InlineError } from '../components/common/InlineError'
import { SettingsSkeleton } from '../components/common/Skeletons'
import { Panel } from '../components/common/Panel'
import { HotkeyField } from '../components/common/HotkeyField'
import { Field } from '../components/common/Field'
import { Toggle } from '../components/common/Toggle'
import { DiagnosticsPanel } from '../components/common/DiagnosticsPanel'

const LOCAL_ASR_MODELS = ['tiny', 'base', 'small', 'medium', 'large-v3', 'turbo']
const CLOUD_LLM_MODELS = [
  'gpt-4o-mini',
  'gpt-4o',
  'o1-mini',
  'claude-3-5-sonnet-20241022',
  'claude-3-5-haiku-20241022',
  'nvidia/llama-3.1-nemotron-70b-instruct',
  'nvidia/llama-3.3-nemotron-super-49b-v1.5'
]
const LOCAL_LLM_MODELS = [
  'llama3.2:1b',
  'llama3.2:3b',
  'phi3:mini',
  'mistral',
  'gemma2:2b',
  'qwen2.5:0.5b',
  'qwen2.5:1.5b'
]

export function SettingsPage({
  settings: initialSettings,
  onUpdate
}: {
  settings: AppSettings
  onUpdate: (settings: AppSettings) => void
}): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(initialSettings)
  const [version, setVersion] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [capturingHotkey, setCapturingHotkey] = useState<
    keyof Pick<AppSettings, 'dictateHotkey' | 'translateHotkey' | 'undoHotkey'> | null
  >(null)

  useEffect(() => {
    // We already have settings from props, just fetch version
    window.voxflow
      .getVersion()
      .then(setVersion)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

  // Sync internal state with props if they change
  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  useEffect(() => {
    if (!capturingHotkey) return

    const handleDocumentKeyDown = (event: globalThis.KeyboardEvent): void => {
      event.preventDefault()
      event.stopPropagation()

      if (event.key === 'Escape') {
        setCapturingHotkey(null)
        return
      }

      const combo = hotkeyFromKeyboardEvent(event)
      if (!combo) return

      update(capturingHotkey, combo)
      setCapturingHotkey(null)
    }

    window.addEventListener('keydown', handleDocumentKeyDown, true)
    return () => window.removeEventListener('keydown', handleDocumentKeyDown, true)
  }, [capturingHotkey])

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    const next = { ...settings }

    if (key === 'llmProvider') {
      const provider = value as AppSettings['llmProvider']
      const defaultModelByProvider: Record<AppSettings['llmProvider'], string> = {
        none: next.llmModel,
        openai: 'gpt-4o-mini',
        anthropic: 'claude-3-5-haiku-20241022',
        'nvidia-nim': 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
        'local-llm': next.localLlmModel
      }
      next.llmProvider = provider
      next.llmModel = defaultModelByProvider[provider]
    } else {
      next[key] = value
    }

    setSettings(next)
    setSaved(false)
  }

  const updateProfile = <K extends keyof AppProfile>(
    id: string,
    key: K,
    value: AppProfile[K]
  ): void => {
    const next = {
      ...settings,
      appProfiles: (settings.appProfiles || []).map((profile) =>
        profile.id === id ? { ...profile, [key]: value } : profile
      )
    }
    setSettings(next)
    setSaved(false)
  }

  const addProfile = (): void => {
    const id = `profile-${Date.now()}`
    const next = {
      ...settings,
      appProfiles: [
        ...(settings.appProfiles || []),
        {
          id,
          name: 'Writing profile',
          match: 'notepad|code|word',
          enabled: true,
          asrProvider: settings.asrProvider,
          llmProvider: settings.llmProvider,
          rewriteStyle: settings.rewriteStyle,
          targetLanguage: settings.targetLanguage,
          pasteMode: settings.pasteMode,
          llmModel: settings.llmModel,
          localAsrModel: settings.localAsrModel,
          localLlmModel: settings.localLlmModel,
          localLlmEndpoint: settings.localLlmEndpoint,
          offlineFallback: settings.offlineFallback
        }
      ]
    }
    setSettings(next)
    setSaved(false)
  }

  const removeProfile = (id: string): void => {
    const next = {
      ...settings,
      appProfiles: (settings.appProfiles || []).filter((profile) => profile.id !== id)
    }
    setSettings(next)
    setSaved(false)
  }

  const save = async (): Promise<void> => {
    try {
      setError('')
      const dictateHotkey = normalizeHotkey(settings.dictateHotkey)
      const translateHotkey = normalizeHotkey(settings.translateHotkey)
      const undoHotkey = normalizeHotkey(settings.undoHotkey)

      if (
        !isValidHotkey(dictateHotkey) ||
        !isValidHotkey(translateHotkey) ||
        !isValidHotkey(undoHotkey)
      ) {
        setError('All hotkeys must include at least one modifier and one key.')
        return
      }

      const hotkeys = [dictateHotkey, translateHotkey, undoHotkey]
      if (new Set(hotkeys).size !== hotkeys.length) {
        setError('Hotkeys must be unique.')
        return
      }

      const normalizedSettings = { ...settings, dictateHotkey, translateHotkey, undoHotkey }
      setSettings(normalizedSettings)
      await window.voxflow.saveSettings(normalizedSettings)
      onUpdate(normalizedSettings) // Update parent state
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="p-8 animate-reveal">
      <PageHeader
        eyebrow={`Settings • v${version}`}
        title="Configuration"
        description="Choose between lightning-fast local models or high-accuracy cloud providers. All API keys are stored securely on your machine."
        action={
          <div className="flex gap-2">
            {settings.developerMode && (
              <button className="secondary-button compact" onClick={() => window.voxflow.openDevTools()}>CONSOLE</button>
            )}
            <button className="secondary-button compact" onClick={() => window.voxflow.checkForUpdates()}>UPDATES</button>
            <button className="primary-button compact" onClick={save}>{saved ? 'SAVED' : 'SAVE CHANGES'}</button>
          </div>
        }
      />

      {error && <InlineError message={error} />}

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <div className="grid grid-cols-2 gap-6 max-xl:grid-cols-1">
          <div className="space-y-6">
            <Panel title="Global Hotkeys" description="Capture commands without switching context.">
              <HotkeyField
                label="Dictation"
                hint="Hold to record, release to paste."
                value={settings.dictateHotkey}
                isCapturing={capturingHotkey === 'dictateHotkey'}
                onCaptureStart={() => setCapturingHotkey('dictateHotkey')}
                onCaptureCancel={() => setCapturingHotkey(null)}
                onChange={(value) => update('dictateHotkey', value)}
              />
              <HotkeyField
                label="Translation"
                hint="Translates speech to your target language."
                value={settings.translateHotkey}
                isCapturing={capturingHotkey === 'translateHotkey'}
                onCaptureStart={() => setCapturingHotkey('translateHotkey')}
                onCaptureCancel={() => setCapturingHotkey(null)}
                onChange={(value) => update('translateHotkey', value)}
              />
              <HotkeyField
                label="Undo last"
                hint="Simulates Ctrl+Z in the active window."
                value={settings.undoHotkey}
                isCapturing={capturingHotkey === 'undoHotkey'}
                onCaptureStart={() => setCapturingHotkey('undoHotkey')}
                onCaptureCancel={() => setCapturingHotkey(null)}
                onChange={(value) => update('undoHotkey', value)}
              />
            </Panel>

            <Panel title="Speech Processing" description="Choose how audio is converted to text.">
              <Field label="ASR Provider">
                <select value={settings.asrProvider} onChange={(e) => update('asrProvider', e.target.value as AppSettings['asrProvider'])}>
                  <option value="local-whisper">OpenAI Whisper (Local, Offline)</option>
                  <option value="local-parakeet">NVIDIA Parakeet (Local, Fast)</option>
                  <option value="openai-whisper">OpenAI Whisper API (Cloud)</option>
                  <option value="nvidia-nim">NVIDIA NIM Speech (Cloud)</option>
                  <option value="deepgram">Deepgram Nova-2 (Cloud)</option>
                </select>
              </Field>
              {settings.asrProvider === 'local-whisper' && (
                <Field label="Whisper Model" hint="Smaller models are faster; larger ones are more accurate.">
                  <select value={settings.localAsrModel} onChange={(e) => update('localAsrModel', e.target.value)}>
                    {LOCAL_ASR_MODELS.map(m => <option key={m} value={m}>{m.toUpperCase()}</option>)}
                  </select>
                </Field>
              )}
              <Field label="Personal Dictionary" hint="Add unique names or technical jargon.">
                <textarea
                  value={settings.personalDictionary}
                  onChange={(e) => update('personalDictionary', e.target.value)}
                  rows={3}
                  placeholder="Names, terms..."
                />
              </Field>
            </Panel>

            <Panel title="Credentials" description="Keys are stored locally in your app settings.">
              <div className="grid gap-4">
                <Field label="OpenAI API Key">
                  <input type="password" value={settings.openaiApiKey} onChange={(e) => update('openaiApiKey', e.target.value)} />
                </Field>
                <Field label="Anthropic API Key">
                  <input type="password" value={settings.anthropicApiKey} onChange={(e) => update('anthropicApiKey', e.target.value)} />
                </Field>
                <Field label="NVIDIA API Key">
                  <input type="password" value={settings.nvidiaApiKey} onChange={(e) => update('nvidiaApiKey', e.target.value)} />
                </Field>
              </div>
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Intelligence & Rewrite" description="Choose where dictation is polished.">
              <Field label="LLM Provider">
                <select value={settings.llmProvider} onChange={(e) => update('llmProvider', e.target.value as AppSettings['llmProvider'])}>
                  <option value="none">None (Raw Transcription)</option>
                  <option value="local-llm">Ollama (Local, Private)</option>
                  <option value="openai">OpenAI (Cloud)</option>
                  <option value="anthropic">Anthropic Claude (Cloud)</option>
                  <option value="nvidia-nim">NVIDIA NIM (Cloud)</option>
                </select>
              </Field>
              {settings.llmProvider === 'local-llm' && (
                <>
                  <Field label="Ollama Model" hint="Pull these models in Ollama first.">
                    <select value={settings.localLlmModel} onChange={(e) => update('localLlmModel', e.target.value)}>
                      {LOCAL_LLM_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </Field>
                  <Field label="Ollama Endpoint">
                    <input value={settings.localLlmEndpoint} onChange={(e) => update('localLlmEndpoint', e.target.value)} />
                  </Field>
                </>
              )}
              {['openai', 'anthropic', 'nvidia-nim'].includes(settings.llmProvider) && (
                <Field label="Cloud Model">
                  <select value={settings.llmModel} onChange={(e) => update('llmModel', e.target.value)}>
                    {CLOUD_LLM_MODELS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </Field>
              )}
              <Toggle label="Offline fallback" hint="Use local LLM if cloud fails." checked={settings.offlineFallback} onChange={(checked) => update('offlineFallback', checked)} />
            </Panel>

            <Panel title="Behavior & Output" description="Control how text is pasted and translated.">
              <Field label="Rewrite Style">
                <select value={settings.rewriteStyle} onChange={(e) => update('rewriteStyle', e.target.value as AppSettings['rewriteStyle'])}>
                  <option value="clean">Clean (Polished)</option>
                  <option value="formal">Formal (Professional)</option>
                  <option value="casual">Casual (Natural)</option>
                  <option value="minimal">Minimal (Raw + Punctuation)</option>
                </select>
              </Field>
              <Field label="Translation Target">
                <input value={settings.targetLanguage} onChange={(e) => update('targetLanguage', e.target.value)} />
              </Field>
              <Field label="Output Mode">
                <select value={settings.pasteMode} onChange={(e) => update('pasteMode', e.target.value as AppSettings['pasteMode'])}>
                  <option value="auto-paste">Auto-paste into window</option>
                  <option value="confirm">Confirm before pasting</option>
                  <option value="copy-only">Copy to clipboard only</option>
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <Toggle label="Show overlay" checked={settings.showOverlay} onChange={(checked) => update('showOverlay', checked)} />
                <Toggle label="Start to tray" checked={settings.startMinimized} onChange={(checked) => update('startMinimized', checked)} />
                <Toggle label="Command mode" checked={settings.commandMode} onChange={(checked) => update('commandMode', checked)} />
                <Toggle label="Keep audio" checked={settings.keepLastAudio} onChange={(checked) => update('keepLastAudio', checked)} />
              </div>
            </Panel>

            <Panel title="System Status" description="Current health of the AI pipeline.">
              <DiagnosticsPanel settings={settings} />
            </Panel>
          </div>
        </div>
      )}
    </section>
  )
}
