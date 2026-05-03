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
