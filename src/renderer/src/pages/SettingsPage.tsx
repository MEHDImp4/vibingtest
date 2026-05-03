import { useEffect, useState } from 'react'
import { AppProfile, AppSettings, DEFAULT_SETTINGS } from '../../../shared/types'
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

export function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [version, setVersion] = useState('')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [capturingHotkey, setCapturingHotkey] = useState<keyof Pick<AppSettings, 'dictateHotkey' | 'translateHotkey' | 'undoHotkey'> | null>(null)

  useEffect(() => {
    Promise.all([
      window.voxflow.getSettings(),
      window.voxflow.getVersion()
    ]).then(([s, v]) => {
      setSettings(s)
      setVersion(v)
    }).catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [])

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
    setSettings((current) => {
      if (key === 'llmProvider') {
        const provider = value as AppSettings['llmProvider']
        const defaultModelByProvider: Record<AppSettings['llmProvider'], string> = {
          none: current.llmModel,
          openai: 'gpt-4o-mini',
          anthropic: 'claude-3-5-haiku-20241022',
          'nvidia-nim': 'nvidia/llama-3.3-nemotron-super-49b-v1.5',
          'local-llm': current.localLlmModel
        }
        return { ...current, llmProvider: provider, llmModel: defaultModelByProvider[provider] }
      }

      return { ...current, [key]: value }
    })
    setSaved(false)
  }

  const updateProfile = <K extends keyof AppProfile>(id: string, key: K, value: AppProfile[K]): void => {
    setSettings((current) => ({
      ...current,
      appProfiles: current.appProfiles.map((profile) => (
        profile.id === id ? { ...profile, [key]: value } : profile
      ))
    }))
    setSaved(false)
  }

  const addProfile = (): void => {
    const id = `profile-${Date.now()}`
    setSettings((current) => ({
      ...current,
      appProfiles: [
        ...current.appProfiles,
        {
          id,
          name: 'Writing profile',
          match: 'notepad|code|word',
          enabled: true,
          asrProvider: current.asrProvider,
          llmProvider: current.llmProvider,
          rewriteStyle: current.rewriteStyle,
          targetLanguage: current.targetLanguage,
          pasteMode: current.pasteMode,
          llmModel: current.llmModel,
          localAsrModel: current.localAsrModel,
          localLlmModel: current.localLlmModel,
          localLlmEndpoint: current.localLlmEndpoint,
          offlineFallback: current.offlineFallback
        }
      ]
    }))
    setSaved(false)
  }

  const removeProfile = (id: string): void => {
    setSettings((current) => ({
      ...current,
      appProfiles: current.appProfiles.filter((profile) => profile.id !== id)
    }))
    setSaved(false)
  }

  const save = async (): Promise<void> => {
    try {
      setError('')
      const dictateHotkey = normalizeHotkey(settings.dictateHotkey)
      const translateHotkey = normalizeHotkey(settings.translateHotkey)
      const undoHotkey = normalizeHotkey(settings.undoHotkey)

      if (!isValidHotkey(dictateHotkey) || !isValidHotkey(translateHotkey) || !isValidHotkey(undoHotkey)) {
        setError('All hotkeys must include at least one modifier and one key.')
        return
      }

      if (dictateHotkey === translateHotkey || dictateHotkey === undoHotkey || translateHotkey === undoHotkey) {
        setError('Hotkeys must be unique.')
        return
      }

      const normalizedSettings = { ...settings, dictateHotkey, translateHotkey, undoHotkey }
      setSettings(normalizedSettings)
      await window.voxflow.saveSettings(normalizedSettings)
      setSaved(true)
      setTimeout(() => setSaved(false), 1600)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow={`Settings • v${version}`}
        title="Voice Control & Model Configuration"
        description="Configure your hotkeys and choose between lightning-fast local models or high-accuracy cloud providers."
        action={
          <div className="flex gap-2">
            {settings.developerMode && (
              <button className="secondary-button" onClick={() => window.voxflow.openDevTools()}>Console</button>
            )}
            <button className="secondary-button" onClick={() => window.voxflow.checkForUpdates()}>Updates</button>
            <button className="primary-button" onClick={save}>{saved ? 'Saved' : 'Save changes'}</button>
          </div>
        }
      />

      {error && <InlineError message={error} />}

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <div className="settings-grid">
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
            <div className="settings-note mt-2">
              <strong>Tip:</strong> You can use the Windows key (e.g., <code>win+space</code>). Note that some system shortcuts may take precedence.
            </div>
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
            <Field label="Personal Dictionary" hint="Add unique names or technical jargon to help accuracy.">
              <textarea
                value={settings.personalDictionary}
                onChange={(e) => update('personalDictionary', e.target.value)}
                rows={3}
                placeholder="Specific names, technical terms..."
              />
            </Field>
          </Panel>

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
                  <input value={settings.localLlmEndpoint} onChange={(e) => update('localLlmEndpoint', e.target.value)} placeholder="http://127.0.0.1:11434" />
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
            <Toggle label="Offline fallback" hint="Use local LLM if cloud provider fails." checked={settings.offlineFallback} onChange={(checked) => update('offlineFallback', checked)} />
          </Panel>

          <Panel title="Behavior & Output" description="Control how text is pasted and translated.">
            <Field label="Rewrite Style">
              <select value={settings.rewriteStyle} onChange={(e) => update('rewriteStyle', e.target.value as AppSettings['rewriteStyle'])}>
                <option value="clean">Clean (Everyday polished)</option>
                <option value="formal">Formal (Professional)</option>
                <option value="casual">Casual (Natural voice)</option>
                <option value="minimal">Minimal (Punctuation only)</option>
              </select>
            </Field>
            <Field label="Translation Target">
              <input value={settings.targetLanguage} onChange={(e) => update('targetLanguage', e.target.value)} />
            </Field>
            <Field label="Output Mode">
              <select value={settings.pasteMode} onChange={(e) => update('pasteMode', e.target.value as AppSettings['pasteMode'])}>
                <option value="auto-paste">Auto-paste into active window</option>
                <option value="confirm">Confirm before pasting</option>
                <option value="copy-only">Copy to clipboard only</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4 mt-2">
              <Toggle label="Show overlay" checked={settings.showOverlay} onChange={(checked) => update('showOverlay', checked)} />
              <Toggle label="Start to tray" checked={settings.startMinimized} onChange={(checked) => update('startMinimized', checked)} />
              <Toggle label="Command mode" checked={settings.commandMode} onChange={(checked) => update('commandMode', checked)} />
              <Toggle label="Keep audio" checked={settings.keepLastAudio} onChange={(checked) => update('keepLastAudio', checked)} />
            </div>
          </Panel>

          <Panel title="Credentials" description="API keys are stored locally.">
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

          <Panel title="Privacy & Developer" description="Privacy mode disables cloud and history.">
            <Toggle label="Local-only Private Mode" checked={settings.privacyMode} onChange={(checked) => update('privacyMode', checked)} />
            <Toggle label="Developer Mode" hint="Enables console and advanced debugging." checked={settings.developerMode} onChange={(checked) => update('developerMode', checked)} />
          </Panel>

          <Panel title="App Profiles" description="Override behavior based on the active application.">
            <button className="secondary-button compact w-max mb-3" onClick={addProfile}>Add profile</button>
            <div className="profile-list">
              {settings.appProfiles.map((profile) => (
                <div className="profile-card" key={profile.id}>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <Field label="Name">
                      <input value={profile.name} onChange={(e) => updateProfile(profile.id, 'name', e.target.value)} />
                    </Field>
                    <Field label="App Match (RegEx)">
                      <input value={profile.match} onChange={(e) => updateProfile(profile.id, 'match', e.target.value)} placeholder="chrome|slack|code" />
                    </Field>
                    <div className="flex items-end gap-2">
                      <button className="secondary-button compact" onClick={() => updateProfile(profile.id, 'enabled', !profile.enabled)}>
                        {profile.enabled ? 'On' : 'Off'}
                      </button>
                      <button className="secondary-button compact danger" onClick={() => removeProfile(profile.id)}>×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="System Status" description="Current health of the AI pipeline.">
            <DiagnosticsPanel settings={settings} />
          </Panel>
        </div>
      )}
    </section>
  )
}
