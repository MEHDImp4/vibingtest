import { useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { formatDiagnosticError, formatDuration } from '../../utils/formatters'
import { StatusPill } from './StatusPill'
import { InlineError } from './InlineError'

export function DiagnosticsPanel({ settings }: { settings: AppSettings }): JSX.Element {
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
        <StatusPill label="Local Parakeet" value={diagnostics?.localParakeetAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics?.localParakeetAvailable)} />
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
        <button className="secondary-button compact" onClick={() => window.voxflow.restartHelper()}>Restart Helper</button>
      </div>
    </div>
  )
}

export function DiagnosticsGrid({ diagnostics }: { diagnostics: Record<string, unknown> }): JSX.Element {
  return (
    <div className="diagnostic-grid">
      <StatusPill label="Native helper" value={String(diagnostics.pythonHelperStatus ?? diagnostics.nativeStatus ?? 'unknown')} good={diagnostics.pythonHelperStatus === 'ready' || diagnostics.nativeStatus === 'ready'} />
      <StatusPill label="Recording" value={String(diagnostics.microphoneRecordingStatus ?? 'unknown')} good />
      <StatusPill label="Local Whisper" value={diagnostics.localWhisperAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics.localWhisperAvailable)} />
      <StatusPill label="Local Parakeet" value={diagnostics.localParakeetAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics.localParakeetAvailable)} />
      <StatusPill label="Ollama" value={diagnostics.ollamaAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics.ollamaAvailable)} />
    </div>
  )
}
