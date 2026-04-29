import { useEffect, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { AppProfile, AppSettings, DEFAULT_SETTINGS, IPC, PipelineDiagnostics, RecordingState, TranscriptionEntry, WordStats } from '../../shared/types'
import { Dashboard } from './pages/Dashboard'
import { useIpcOn } from './hooks/useIpc'

type View = 'home' | 'settings' | 'history'

const NAV: { id: View; label: string; eyebrow: string }[] = [
  { id: 'home', label: 'Capture', eyebrow: 'Live' },
  { id: 'settings', label: 'Settings', eyebrow: 'Local' },
  { id: 'history', label: 'History', eyebrow: 'Archive' }
]

export default function App(): JSX.Element {
  const windowType = window.voxflow.getWindowType()

  if (windowType === 'overlay') {
    return <OverlayApp />
  }

  return <MainApp />
}

function MainApp(): JSX.Element {
  const [view, setView] = useState<View>('home')
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useEffect(() => {
    window.voxflow.getSettings().then(setSettings).catch(() => setSettings(DEFAULT_SETTINGS))
  }, [])

  const completeOnboarding = async (nextSettings: AppSettings): Promise<void> => {
    await window.voxflow.saveSettings(nextSettings)
    setSettings(nextSettings)
    setView('settings')
  }

  if (!settings) {
    return <div className="app-surface min-h-[100dvh]" />
  }

  return (
    <div className="app-surface min-h-[100dvh] overflow-hidden text-stone-100">
      <div className="ambient-field pointer-events-none fixed inset-0" />
      <div className="grain" />

      <div className="relative grid min-h-[100dvh] grid-cols-[256px_minmax(0,1fr)] max-md:grid-cols-1">
        <aside className="drag app-sidebar flex min-h-[100dvh] flex-col px-4 py-4 max-md:min-h-0 max-md:border-b max-md:border-r-0">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="brand-mark">VF</div>
              <div className="mt-4 text-[1.35rem] font-semibold leading-none tracking-tight">VoxFlow</div>
              <div className="mt-2 max-w-[12rem] text-xs leading-5 text-stone-500">A compact voice console for dictation, translation, and paste-ready text.</div>
            </div>
            <div className="flex gap-2 no-drag">
              <button className="window-dot" onClick={() => window.voxflow.minimizeWindow()} aria-label="Minimize" />
              <button className="window-dot window-dot-close" onClick={() => window.voxflow.closeWindow()} aria-label="Close" />
            </div>
          </div>

          <nav className="no-drag mt-8 grid gap-2">
            {NAV.map((item, index) => (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`nav-item ${view === item.id ? 'nav-item-active' : ''}`}
                style={{ '--index': index } as CSSProperties}
              >
                <span className="nav-mark" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{item.label}</span>
                  <span className="mt-0.5 block font-mono text-[10px] uppercase tracking-[0.22em] text-stone-500">{item.eyebrow}</span>
                </span>
              </button>
            ))}
          </nav>

          <div className="mt-auto grid gap-3 pt-8 max-md:hidden">
            <div className="micro-panel">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-emerald-300/70">Pipeline</div>
              <div className="mt-3 grid gap-2">
                {['Hotkey', 'Audio', 'Transcript', 'Paste'].map((item, index) => (
                  <div className="pipeline-row" key={item}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    <strong>{item}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>

        <main className="no-drag relative min-w-0 overflow-y-auto">
          {!settings.onboardingCompleted && <OnboardingPage settings={settings} onComplete={completeOnboarding} />}
          {settings.onboardingCompleted && view === 'home' && <Dashboard />}
          {settings.onboardingCompleted && view === 'settings' && <SettingsPage />}
          {settings.onboardingCompleted && view === 'history' && <HistoryPage />}
        </main>
      </div>
    </div>
  )
}

function OnboardingPage(props: { settings: AppSettings; onComplete: (settings: AppSettings) => Promise<void> }): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(props.settings)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null)

  const update = <K extends keyof AppSettings>(key: K, value: AppSettings[K]): void => {
    setSettings((current) => ({ ...current, [key]: value }))
  }

  const finish = async (): Promise<void> => {
    setSaving(true)
    setError('')
    try {
      await props.onComplete({ ...settings, onboardingCompleted: true })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }

  const runDiagnostics = async (): Promise<void> => {
    setDiagnostics(await window.voxflow.getDiagnostics())
  }

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="First run"
        title="Set up capture before your first dictation."
        description="Walk through hotkeys, microphone readiness, providers, paste behavior, and private local-only mode."
        action={<button className="primary-button" onClick={finish}>{saving ? 'Saving' : 'Finish setup'}</button>}
      />
      {error && <InlineError message={error} />}
      <div className="settings-grid">
        <Panel title="Hotkeys" description="Choose the two shortcuts the Python helper registers globally.">
          <Field label="Dictation hotkey"><input value={settings.dictateHotkey} onChange={(e) => update('dictateHotkey', e.target.value)} /></Field>
          <Field label="Translation hotkey"><input value={settings.translateHotkey} onChange={(e) => update('translateHotkey', e.target.value)} /></Field>
        </Panel>
        <Panel title="Local or Cloud" description="Local mode keeps speech and rewrite on this machine. Cloud mode uses configured provider keys.">
          <Field label="ASR provider">
            <select value={settings.asrProvider} onChange={(e) => update('asrProvider', e.target.value as AppSettings['asrProvider'])}>
              <option value="local-whisper">Local Whisper</option>
              <option value="openai-whisper">OpenAI Whisper</option>
              <option value="deepgram">Deepgram</option>
              <option value="nvidia-nim">NVIDIA NIM Speech</option>
            </select>
          </Field>
          <Field label="LLM provider">
            <select value={settings.llmProvider} onChange={(e) => update('llmProvider', e.target.value as AppSettings['llmProvider'])}>
              <option value="none">None, paste raw transcript</option>
              <option value="local-llm">Local Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="nvidia-nim">NVIDIA NIM</option>
            </select>
          </Field>
        </Panel>
        <Panel title="Paste and Privacy" description="Paste is local. Private mode disables cloud providers and history writes.">
          <Field label="Output mode">
            <select value={settings.pasteMode} onChange={(e) => update('pasteMode', e.target.value as AppSettings['pasteMode'])}>
              <option value="auto-paste">Auto-paste into active window</option>
              <option value="confirm">Confirm text before pasting</option>
              <option value="copy-only">Copy to clipboard only</option>
            </select>
          </Field>
          <Toggle label="Use local-only privacy mode" checked={settings.privacyMode} onChange={(checked) => update('privacyMode', checked)} />
          <Toggle label="Disable auto-paste while private" checked={settings.disableAutoPasteInPrivacyMode} onChange={(checked) => update('disableAutoPasteInPrivacyMode', checked)} />
        </Panel>
        <Panel title="Microphone and Paste Test" description="Run diagnostics, then use the dictation hotkey in any text field to confirm recording and paste.">
          <button className="secondary-button compact w-max" onClick={runDiagnostics}>Run diagnostics</button>
          {diagnostics && <DiagnosticsGrid diagnostics={diagnostics} />}
        </Panel>
      </div>
    </section>
  )
}

function OverlayApp(): JSX.Element {
  const [state, setState] = useState<RecordingState>('idle')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState('')

  useIpcOn(IPC.RECORDING_STATE, (next) => {
    setState(next as RecordingState)
    if (next === 'recording') {
      setFinalText('')
      setError('')
    }
  })
  useIpcOn(IPC.TRANSCRIPTION_FINAL, (text) => setFinalText(text as string))
  useIpcOn(IPC.TRANSCRIPTION_ERROR, (message) => setError(message as string))

  const [settings, setSettings] = useState<AppSettings | null>(null)
  useEffect(() => {
    window.voxflow.getSettings().then(setSettings).catch(() => {})
  }, [])

  const confirm = async (): Promise<void> => {
    await window.voxflow.confirmPaste()
    setFinalText('')
    setState('idle')
  }

  return (
    <div className="grid h-[120px] place-items-center bg-transparent px-4">
      <div className="overlay-shell w-full">
        <div className="flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <div className={`record-orb ${state}`} />
            <div className="min-w-0">
              <div className="text-sm font-semibold text-stone-50">
                {state === 'recording' && 'Listening'}
                {state === 'processing' && 'Processing speech'}
                {state === 'done' && 'Text ready'}
                {state === 'error' && 'Capture failed'}
                {state === 'idle' && 'Ready'}
              </div>
              <div className="mt-1 truncate text-xs text-stone-500">
                {state === 'recording' && 'Release the hotkey to finish.'}
                {state === 'processing' && 'Transcribing and preparing final text.'}
                {state === 'done' && (finalText || 'Final text is ready.')}
                {state === 'error' && (error || 'Check helper and provider settings.')}
                {state === 'idle' && 'Hold your hotkey to dictate.'}
              </div>
            </div>
          </div>

          {state === 'done' && settings?.pasteMode === 'confirm' && (
            <div className="flex shrink-0 gap-2">
              <button className="primary-button compact px-4 py-2" onClick={confirm}>Paste</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function SettingsPage(): JSX.Element {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [capturingHotkey, setCapturingHotkey] = useState<keyof Pick<AppSettings, 'dictateHotkey' | 'translateHotkey' | 'undoHotkey'> | null>(null)

  useEffect(() => {
    window.voxflow.getSettings()
      .then(setSettings)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
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
          anthropic: 'claude-haiku-4-5-20251001',
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
        eyebrow="Configuration"
        title="Local controls for capture, models, and paste behavior."
        description="Provider credentials stay in the Electron user data directory. Keep the renderer as a control surface, not a provider client."
        action={<button className="primary-button" onClick={save}>{saved ? 'Saved' : 'Save settings'}</button>}
      />

      {error && <InlineError message={error} />}

      {loading ? (
        <SettingsSkeleton />
      ) : (
        <div className="settings-grid">
          <Panel title="Hotkeys" description="Capture key combinations without leaving the app.">
            <HotkeyField
              label="Dictation hotkey"
              hint="Click Capture, press the combo, then save."
              value={settings.dictateHotkey}
              isCapturing={capturingHotkey === 'dictateHotkey'}
              onCaptureStart={() => setCapturingHotkey('dictateHotkey')}
              onCaptureCancel={() => setCapturingHotkey(null)}
              onChange={(value) => update('dictateHotkey', value)}
            />
            <HotkeyField
              label="Translation hotkey"
              hint="Use a different combo from dictation."
              value={settings.translateHotkey}
              isCapturing={capturingHotkey === 'translateHotkey'}
              onCaptureStart={() => setCapturingHotkey('translateHotkey')}
              onCaptureCancel={() => setCapturingHotkey(null)}
              onChange={(value) => update('translateHotkey', value)}
            />
            <HotkeyField
              label="Undo last paste"
              hint="Simulates Ctrl+Z in the active window."
              value={settings.undoHotkey}
              isCapturing={capturingHotkey === 'undoHotkey'}
              onCaptureStart={() => setCapturingHotkey('undoHotkey')}
              onCaptureCancel={() => setCapturingHotkey(null)}
              onChange={(value) => update('undoHotkey', value)}
            />
          </Panel>

          <Panel title="Speech and Rewrite" description="Choose where audio becomes text and whether text is refined.">
            <Field label="ASR provider">
              <select value={settings.asrProvider} onChange={(e) => update('asrProvider', e.target.value as AppSettings['asrProvider'])}>
                <option value="local-whisper">Local Whisper, no API key</option>
                <option value="openai-whisper">OpenAI Whisper API</option>
                <option value="deepgram">Deepgram</option>
                <option value="nvidia-nim">NVIDIA NIM Speech</option>
              </select>
            </Field>
            <Field label="Local Whisper model" hint="Use tiny or base for speed. Use small or medium for accuracy.">
              <input value={settings.localAsrModel} onChange={(e) => update('localAsrModel', e.target.value)} placeholder="base" />
            </Field>
            <Field label="LLM provider">
              <select value={settings.llmProvider} onChange={(e) => update('llmProvider', e.target.value as AppSettings['llmProvider'])}>
                <option value="none">None, paste raw transcript</option>
                <option value="openai">OpenAI</option>
                <option value="anthropic">Anthropic</option>
                <option value="nvidia-nim">NVIDIA NIM</option>
                <option value="local-llm">Local Ollama</option>
              </select>
            </Field>
            <Field label="LLM model" hint="Recommended NVIDIA model: nvidia/llama-3.3-nemotron-super-49b-v1.5.">
              <input value={settings.llmModel} onChange={(e) => update('llmModel', e.target.value)} />
            </Field>
            <Field label="Local LLM model" hint="Fast offline choices: llama3.2:1b, qwen2.5:0.5b, gemma3:1b. Pull the model in Ollama first.">
              <input value={settings.localLlmModel} onChange={(e) => update('localLlmModel', e.target.value)} placeholder="llama3.2:1b" />
            </Field>
            <Field label="Local LLM endpoint">
              <input value={settings.localLlmEndpoint} onChange={(e) => update('localLlmEndpoint', e.target.value)} placeholder="http://127.0.0.1:11434" />
            </Field>
            <Field label="Personal dictionary" hint="Newline separated words or phrases to help ASR/LLM accuracy.">
              <textarea
                value={settings.personalDictionary}
                onChange={(e) => update('personalDictionary', e.target.value)}
                rows={4}
                placeholder="Specific names, technical terms, or common misspellings..."
              />
            </Field>
            <Toggle label="Fallback to local model if cloud rewrite fails" checked={settings.offlineFallback} onChange={(checked) => update('offlineFallback', checked)} />
          </Panel>

          <Panel title="Credentials" description="Keys are stored locally and sent only to the selected provider.">
            <Field label="OpenAI API key">
              <input type="password" value={settings.openaiApiKey} onChange={(e) => update('openaiApiKey', e.target.value)} />
            </Field>
            <Field label="Anthropic API key">
              <input type="password" value={settings.anthropicApiKey} onChange={(e) => update('anthropicApiKey', e.target.value)} />
            </Field>
            <Field label="NVIDIA API key">
              <input type="password" value={settings.nvidiaApiKey} onChange={(e) => update('nvidiaApiKey', e.target.value)} />
            </Field>
            <Field label="Deepgram API key">
              <input type="password" value={settings.deepgramApiKey} onChange={(e) => update('deepgramApiKey', e.target.value)} />
            </Field>
          </Panel>

          <Panel title="Output" description="Control final text, translation target, and app feedback.">
            <Field label="Rewrite style">
              <select value={settings.rewriteStyle} onChange={(e) => update('rewriteStyle', e.target.value as AppSettings['rewriteStyle'])}>
                <option value="clean">Clean</option>
                <option value="formal">Formal</option>
                <option value="casual">Casual</option>
                <option value="minimal">Minimal</option>
              </select>
            </Field>
            <Field label="Translation target">
              <input value={settings.targetLanguage} onChange={(e) => update('targetLanguage', e.target.value)} />
            </Field>
            <Field label="Output mode">
              <select value={settings.pasteMode} onChange={(e) => update('pasteMode', e.target.value as AppSettings['pasteMode'])}>
                <option value="auto-paste">Auto-paste into active window</option>
                <option value="confirm">Confirm text before pasting</option>
                <option value="copy-only">Copy to clipboard only</option>
              </select>
            </Field>
            <Toggle label="Show floating overlay" checked={settings.showOverlay} onChange={(checked) => update('showOverlay', checked)} />
            <Toggle label="Start minimized to tray" checked={settings.startMinimized} onChange={(checked) => update('startMinimized', checked)} />
            <Toggle label="Command mode for spoken punctuation" checked={settings.commandMode} onChange={(checked) => update('commandMode', checked)} />
            <Toggle label="Keep last audio for replay and retry" checked={settings.keepLastAudio} onChange={(checked) => update('keepLastAudio', checked)} />
          </Panel>

          <Panel title="Privacy Mode" description="Local-only capture. Cloud providers and history writes are disabled while active.">
            <Toggle label="Use local-only private mode" checked={settings.privacyMode} onChange={(checked) => update('privacyMode', checked)} />
            <Toggle label="Disable auto-paste while private" checked={settings.disableAutoPasteInPrivacyMode} onChange={(checked) => update('disableAutoPasteInPrivacyMode', checked)} />
            <div className="settings-note">
              Private mode forces Local Whisper and prevents cloud LLM use unless Local Ollama is selected. It also prevents new history entries from being saved.
            </div>
          </Panel>

          <Panel title="Per-app Profiles" description="Match the active app name with text or a regular expression and override output behavior.">
            <button className="secondary-button compact w-max" onClick={addProfile}>Add profile</button>
            <div className="profile-list">
              {settings.appProfiles.map((profile) => (
                <div className="profile-card" key={profile.id}>
                  <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                    <Field label="Name">
                      <input value={profile.name} onChange={(e) => updateProfile(profile.id, 'name', e.target.value)} />
                    </Field>
                    <Field label="App match">
                      <input value={profile.match} onChange={(e) => updateProfile(profile.id, 'match', e.target.value)} placeholder="chrome|code|slack" />
                    </Field>
                    <div className="flex items-end gap-2">
                      <button className="secondary-button compact" onClick={() => updateProfile(profile.id, 'enabled', !profile.enabled)}>
                        {profile.enabled ? 'On' : 'Off'}
                      </button>
                      <button className="secondary-button compact danger" onClick={() => removeProfile(profile.id)}>Remove</button>
                    </div>
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <Field label="ASR">
                      <select value={profile.asrProvider} onChange={(e) => updateProfile(profile.id, 'asrProvider', e.target.value as AppProfile['asrProvider'])}>
                        <option value="local-whisper">Local Whisper</option>
                        <option value="openai-whisper">OpenAI Whisper</option>
                        <option value="deepgram">Deepgram</option>
                        <option value="nvidia-nim">NVIDIA NIM</option>
                      </select>
                    </Field>
                    <Field label="LLM">
                      <select value={profile.llmProvider} onChange={(e) => updateProfile(profile.id, 'llmProvider', e.target.value as AppProfile['llmProvider'])}>
                        <option value="none">None</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic</option>
                        <option value="nvidia-nim">NVIDIA NIM</option>
                        <option value="local-llm">Local Ollama</option>
                      </select>
                    </Field>
                    <Field label="Style">
                      <select value={profile.rewriteStyle} onChange={(e) => updateProfile(profile.id, 'rewriteStyle', e.target.value as AppProfile['rewriteStyle'])}>
                        <option value="clean">Clean</option>
                        <option value="formal">Formal</option>
                        <option value="casual">Casual</option>
                        <option value="minimal">Minimal</option>
                      </select>
                    </Field>
                    <Field label="Mode">
                      <select value={profile.pasteMode} onChange={(e) => updateProfile(profile.id, 'pasteMode', e.target.value as AppProfile['pasteMode'])}>
                        <option value="auto-paste">Auto-paste</option>
                        <option value="confirm">Confirm</option>
                        <option value="copy-only">Copy only</option>
                      </select>
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Diagnostics" description="Run a local preflight before relying on capture.">
            <DiagnosticsPanel settings={settings} />
          </Panel>
        </div>
      )}
    </section>
  )
}

function HotkeyField(props: {
  label: string
  hint: string
  value: string
  isCapturing: boolean
  onCaptureStart: () => void
  onCaptureCancel: () => void
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <div className="field">
      <span>{props.label}</span>
      <div className={`hotkey-control ${props.isCapturing ? 'is-capturing' : ''}`}>
        <code>{props.isCapturing ? 'Press a key combo' : props.value}</code>
        <button
          type="button"
          className="secondary-button compact"
          onClick={props.isCapturing ? props.onCaptureCancel : props.onCaptureStart}
          autoFocus={props.isCapturing}
        >
          {props.isCapturing ? 'Cancel' : 'Capture'}
        </button>
      </div>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={(event) => props.onChange(normalizeHotkey(event.target.value))}
        placeholder="ctrl+shift+space"
      />
      <small>{props.hint}</small>
    </div>
  )
}

function DiagnosticsPanel({ settings }: { settings: AppSettings }): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null)
  const [running, setRunning] = useState(false)

  const run = async (): Promise<void> => {
    setRunning(true)
    try {
      setDiagnostics(await window.voxflow.getDiagnostics())
    } finally {
      setRunning(false)
    }
  }

  const providerReady = settings.privacyMode || settings.llmProvider === 'none' || (
    (settings.llmProvider === 'openai' && settings.openaiApiKey) ||
    (settings.llmProvider === 'anthropic' && settings.anthropicApiKey) ||
    (settings.llmProvider === 'nvidia-nim' && settings.nvidiaApiKey) ||
    settings.llmProvider === 'local-llm' ||
    settings.offlineFallback
  )

  return (
    <div className="grid gap-4">
      <div className="diagnostic-grid">
        <StatusPill label="Native helper" value={String(diagnostics?.pythonHelperStatus ?? diagnostics?.nativeStatus ?? 'unknown')} good={diagnostics?.pythonHelperStatus === 'ready' || diagnostics?.nativeStatus === 'ready'} />
        <StatusPill label="Recording" value={String(diagnostics?.microphoneRecordingStatus ?? 'unknown')} good />
        <StatusPill label="Local Whisper" value={diagnostics?.localWhisperAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics?.localWhisperAvailable)} />
        <StatusPill label="Ollama" value={diagnostics?.ollamaAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics?.ollamaAvailable)} />
        <StatusPill label="ASR" value={String(diagnostics?.selectedAsrProvider ?? settings.asrProvider)} good />
        <StatusPill label="LLM" value={String(diagnostics?.selectedLlmProvider ?? settings.llmProvider)} good={Boolean(providerReady)} />
        <StatusPill label="ASR duration" value={formatDuration(diagnostics?.lastAsrDurationMs)} good />
        <StatusPill label="LLM duration" value={formatDuration(diagnostics?.lastLlmDurationMs)} good />
        <StatusPill label="Paste" value={String(diagnostics?.lastPasteStatus ?? 'none')} good={diagnostics?.lastPasteStatus !== 'failed'} />
        <StatusPill label="Fallback" value={String(diagnostics?.fallbackUsed ?? 'none')} good />
      </div>
      {!!diagnostics?.lastError && (
        <InlineError message={formatDiagnosticError(diagnostics.lastError)} />
      )}
      <div className="flex flex-wrap gap-2">
        <button className="secondary-button compact" onClick={run}>{running ? 'Checking' : 'Run diagnostics'}</button>
        <button className="secondary-button compact" onClick={() => window.voxflow.testMicrophone()}>Test Mic</button>
        <button className="secondary-button compact" onClick={() => window.voxflow.testPaste()}>Test Paste</button>
      </div>
    </div>
  )
}

function DiagnosticsGrid({ diagnostics }: { diagnostics: Record<string, unknown> }): JSX.Element {
  return (
    <div className="diagnostic-grid">
      <StatusPill label="Native helper" value={String(diagnostics.pythonHelperStatus ?? diagnostics.nativeStatus ?? 'unknown')} good={diagnostics.pythonHelperStatus === 'ready' || diagnostics.nativeStatus === 'ready'} />
      <StatusPill label="Recording" value={String(diagnostics.microphoneRecordingStatus ?? 'unknown')} good />
      <StatusPill label="Local Whisper" value={diagnostics.localWhisperAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics.localWhisperAvailable)} />
      <StatusPill label="Ollama" value={diagnostics.ollamaAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics.ollamaAvailable)} />
    </div>
  )
}

function formatDuration(value: unknown): string {
  return typeof value === 'number' ? `${Math.round(value)}ms` : 'none'
}

function formatDiagnosticError(value: unknown): string {
  const error = value as Partial<PipelineDiagnostics['lastError']>
  if (!error) return 'Unknown error'
  return [error.message, error.stack].filter(Boolean).join('\n')
}

function StatusPill(props: { label: string; value: string; good: boolean }): JSX.Element {
  return (
    <div className={`status-pill ${props.good ? 'good' : 'warn'}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}

function hotkeyFromKeyboardEvent(event: globalThis.KeyboardEvent): string {
  const key = normalizeKeyName(event.key)
  if (!key || ['ctrl', 'shift', 'alt', 'win'].includes(key)) return ''

  const parts = [
    event.ctrlKey ? 'ctrl' : '',
    event.shiftKey ? 'shift' : '',
    event.altKey ? 'alt' : '',
    event.metaKey ? 'win' : '',
    key
  ].filter(Boolean)

  if (parts.length < 2) return ''
  return parts.join('+')
}

function normalizeHotkey(value: string): string {
  const aliases: Record<string, string> = {
    control: 'ctrl',
    ctl: 'ctrl',
    cmdorctrl: 'ctrl',
    commandorcontrol: 'ctrl',
    controlorcommand: 'ctrl',
    command: 'win',
    cmd: 'win',
    windows: 'win',
    meta: 'win',
    super: 'win',
    option: 'alt',
    alternate: 'alt',
    return: 'enter',
    esc: 'escape',
    del: 'delete'
  }

  const rawParts = value
    .replace(/-/g, '+')
    .split('+')
    .map((part: string) => part.trim().toLowerCase())
    .filter(Boolean)

  const parts = rawParts.map((part: string) => aliases[part] ?? part)
  const ordered = ['ctrl', 'shift', 'alt', 'win']
    .filter((modifier: string) => parts.includes(modifier))
    .concat(parts.filter((part: string) => !['ctrl', 'shift', 'alt', 'win'].includes(part)))

  return Array.from(new Set(ordered)).join('+')
}

function isValidHotkey(value: string): boolean {
  const parts = normalizeHotkey(value).split('+').filter(Boolean)
  const hasModifier = parts.some((part) => ['ctrl', 'shift', 'alt', 'win'].includes(part))
  const hasNonModifier = parts.some((part) => !['ctrl', 'shift', 'alt', 'win'].includes(part))
  return hasModifier && hasNonModifier
}

function normalizeKeyName(key: string): string {
  if (key.length === 1) return key.toLowerCase()

  const aliases: Record<string, string> = {
    ' ': 'space',
    Spacebar: 'space',
    Control: 'ctrl',
    Shift: 'shift',
    Alt: 'alt',
    Meta: 'win',
    OS: 'win',
    Escape: 'escape',
    Esc: 'escape',
    ArrowUp: 'up',
    ArrowDown: 'down',
    ArrowLeft: 'left',
    ArrowRight: 'right'
  }

  return aliases[key] ?? key.toLowerCase()
}

function HistoryPage(): JSX.Element {
  const [history, setHistory] = useState<TranscriptionEntry[]>([])
  const [stats, setStats] = useState<WordStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = async (): Promise<void> => {
    try {
      setError('')
      const [entries, wordStats] = await Promise.all([
        window.voxflow.getHistory(),
        window.voxflow.getWordStats()
      ])
      setHistory(entries)
      setStats(wordStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])
  useIpcOn(IPC.TRANSCRIPTION_FINAL, () => { void refresh() })

  const clear = async (): Promise<void> => {
    await window.voxflow.clearHistory()
    setHistory([])
    setStats(null)
  }

  const remove = async (id: string): Promise<void> => {
    await window.voxflow.deleteEntry(id)
    setHistory((items) => items.filter((item) => item.id !== id))
  }

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Local archive"
        title="Recent captures with raw and final text."
        description="The archive is capped to 500 entries and stays on this machine."
        action={history.length > 0 ? <button className="secondary-button" onClick={clear}>Clear history</button> : null}
      />

      {error && <InlineError message={error} />}
      {stats && (
        <div className="word-stats-grid">
          <WordStatCard label="Today" words={stats.today} captures={stats.capturesToday} />
          <WordStatCard label="This week" words={stats.thisWeek} captures={stats.capturesThisWeek} />
          <WordStatCard label="This month" words={stats.thisMonth} captures={stats.capturesThisMonth} />
          <WordStatCard label="All time" words={stats.total} captures={history.length} />
        </div>
      )}

      {loading ? (
        <HistorySkeleton />
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-mark" />
          <h3>No captures yet</h3>
          <p>Use the dictation hotkey in any app. Completed captures will appear here with raw and final text.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((entry, index) => (
            <article className="history-item" key={entry.id} style={{ '--index': index } as CSSProperties}>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-500">
                    {new Date(entry.timestamp).toLocaleString()} / {entry.mode} / {entry.appName}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-100">{entry.finalText}</p>
                  {entry.rawTranscript !== entry.finalText && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-stone-500">Raw transcript</summary>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-500">{entry.rawTranscript}</p>
                      <DiffView raw={entry.rawTranscript} finalText={entry.finalText} />
                    </details>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="secondary-button compact" onClick={() => window.voxflow.copyText(entry.finalText)}>Copy</button>
                  <button className="secondary-button compact danger" onClick={() => remove(entry.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function WordStatCard(props: { label: string; words: number; captures: number }): JSX.Element {
  return (
    <div className="word-stat-card">
      <span>{props.label}</span>
      <strong>{props.words.toLocaleString()}</strong>
      <small>{props.captures.toLocaleString()} captures</small>
    </div>
  )
}

function DiffView({ raw, finalText }: { raw: string; finalText: string }): JSX.Element {
  const rawWords = new Set(raw.toLowerCase().split(/\s+/).filter(Boolean))
  const finalWords = finalText.split(/(\s+)/)

  return (
    <div className="diff-view">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">Rewrite diff</div>
      <p>
        {finalWords.map((word, index) => {
          if (/^\s+$/.test(word)) return word
          const added = !rawWords.has(word.toLowerCase())
          return <mark key={`${word}-${index}`} className={added ? 'added' : ''}>{word}</mark>
        })}
      </p>
    </div>
  )
}

function PageHeader(props: { eyebrow: string; title: string; description: string; action?: ReactNode }): JSX.Element {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{props.eyebrow}</div>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
      {props.action && <div className="shrink-0">{props.action}</div>}
    </header>
  )
}

function Panel(props: { title: string; description: string; children: ReactNode }): JSX.Element {
  return (
    <section className="panel">
      <div className="mb-5">
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </div>
      <div className="grid gap-4">{props.children}</div>
    </section>
  )
}

function Field(props: { label: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
      {props.hint && <small>{props.hint}</small>}
    </label>
  )
}

function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }): JSX.Element {
  return (
    <label className="toggle-row">
      <span>{props.label}</span>
      <button
        type="button"
        className={`toggle ${props.checked ? 'toggle-on' : ''}`}
        onClick={() => props.onChange(!props.checked)}
        aria-pressed={props.checked}
      >
        <span />
      </button>
    </label>
  )
}

function InlineError({ message }: { message: string }): JSX.Element {
  return <div className="inline-error">{message}</div>
}

function SettingsSkeleton(): JSX.Element {
  return (
    <div className="settings-grid">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="panel skeleton-panel" key={index}>
          <div className="skeleton-line w-1/3" />
          <div className="skeleton-line mt-3 w-2/3" />
          <div className="mt-6 grid gap-3">
            <div className="skeleton-input" />
            <div className="skeleton-input" />
            <div className="skeleton-input" />
          </div>
        </div>
      ))}
    </div>
  )
}

function HistorySkeleton(): JSX.Element {
  return (
    <div className="history-list">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="history-item" key={index} style={{ '--index': index } as CSSProperties}>
          <div className="skeleton-line w-1/4" />
          <div className="skeleton-line mt-4 w-5/6" />
          <div className="skeleton-line mt-2 w-2/3" />
        </div>
      ))}
    </div>
  )
}
