import { useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { PageHeader } from '../components/common/PageHeader'
import { InlineError } from '../components/common/InlineError'
import { Panel } from '../components/common/Panel'
import { Field } from '../components/common/Field'
import { Toggle } from '../components/common/Toggle'
import { DiagnosticsGrid } from '../components/common/DiagnosticsPanel'

export function OnboardingPage(props: { settings: AppSettings; onComplete: (settings: AppSettings) => Promise<void> }): JSX.Element {
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
    <section className="p-8 animate-reveal">
      <PageHeader
        eyebrow="Welcome"
        title="Get started"
        description="Set up your capture environment. You can choose between lightning-fast local models or high-accuracy cloud providers."
        action={<button className="primary-button" onClick={finish}>{saving ? 'SAVING...' : 'FINISH SETUP'}</button>}
      />
      {error && <InlineError message={error} />}
      <div className="grid grid-cols-2 gap-6 max-xl:grid-cols-1">
        <Panel title="Hotkeys" description="Choose the two shortcuts the helper registers globally.">
          <Field label="Dictation hotkey"><input className="input-field" value={settings.dictateHotkey} onChange={(e) => update('dictateHotkey', e.target.value)} /></Field>
          <Field label="Translation hotkey"><input className="input-field" value={settings.translateHotkey} onChange={(e) => update('translateHotkey', e.target.value)} /></Field>
        </Panel>
        <Panel title="Local or Cloud" description="Local mode keeps speech on this machine. Cloud mode uses your own API keys.">
          <Field label="ASR provider">
            <select className="input-field" value={settings.asrProvider} onChange={(e) => update('asrProvider', e.target.value as AppSettings['asrProvider'])}>
              <option value="local-whisper">Local Whisper</option>
              <option value="openai-whisper">OpenAI Whisper</option>
              <option value="deepgram">Deepgram</option>
              <option value="nvidia-nim">NVIDIA NIM Speech</option>
            </select>
          </Field>
          <Field label="LLM provider">
            <select className="input-field" value={settings.llmProvider} onChange={(e) => update('llmProvider', e.target.value as AppSettings['llmProvider'])}>
              <option value="none">None, paste raw transcript</option>
              <option value="local-llm">Local Ollama</option>
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
              <option value="nvidia-nim">NVIDIA NIM</option>
            </select>
          </Field>
        </Panel>
        <Panel title="Paste and Privacy" description="Private mode disables cloud providers and history writes.">
          <Field label="Output mode">
            <select className="input-field" value={settings.pasteMode} onChange={(e) => update('pasteMode', e.target.value as AppSettings['pasteMode'])}>
              <option value="auto-paste">Auto-paste into active window</option>
              <option value="confirm">Confirm text before pasting</option>
              <option value="copy-only">Copy to clipboard only</option>
            </select>
          </Field>
          <Toggle label="Use local-only private mode" checked={settings.privacyMode} onChange={(checked) => update('privacyMode', checked)} />
          <Toggle label="Disable auto-paste while private" checked={settings.disableAutoPasteInPrivacyMode} onChange={(checked) => update('disableAutoPasteInPrivacyMode', checked)} />
        </Panel>
        <Panel title="Readiness" description="Run a quick check to ensure the helper and microphone are ready.">
          <button className="secondary-button compact w-full" onClick={runDiagnostics}>RUN DIAGNOSTICS</button>
          {diagnostics && <DiagnosticsGrid diagnostics={diagnostics} />}
        </Panel>
      </div>
    </section>
  )
}
