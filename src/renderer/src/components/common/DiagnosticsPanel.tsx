import { useState } from 'react'
import type { AppSettings } from '../../../shared/types'
import { formatDiagnosticError, formatDuration } from '../../utils/formatters'
import { StatusPill } from './StatusPill'
import { InlineError } from './InlineError'

export function DiagnosticsPanel({ settings }: { settings: AppSettings }): JSX.Element {
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null)
  const [running, setRunning] = useState(false)
  const [logs, setLogs] = useState<{ level: string; message: string; timestamp: number }[]>([])

  const run = async (): Promise<void> => {
    setRunning(true)
    try {
      setDiagnostics(await window.voxflow.getDiagnostics())
    } finally {
      setRunning(false)
    }
  }

  useIpcOn(window.voxflow.IPC.NATIVE_LOG, (log: any) => {
    setLogs((prev) => [{ ...log, timestamp: Date.now() }, ...prev].slice(0, 50))
  })

  const providerReady = settings.privacyMode || settings.llmProvider === 'none' || (
    (settings.llmProvider === 'openai' && settings.openaiApiKey) ||
    (settings.llmProvider === 'anthropic' && settings.anthropicApiKey) ||
    (settings.llmProvider === 'nvidia-nim' && settings.nvidiaApiKey) ||
    settings.llmProvider === 'local-llm' ||
    settings.offlineFallback
  )

  const whisperStatus = diagnostics?.localWhisperAvailable ? 'ready' : (diagnostics?.pythonHelperStatus === 'ready' ? 'missing files' : 'unavailable')
  const parakeetStatus = diagnostics?.localParakeetAvailable ? 'ready' : (diagnostics?.pythonHelperStatus === 'ready' ? 'missing files' : 'unavailable')

  return (
    <div className="grid gap-4">
      <div className="diagnostic-grid">
        <StatusPill label="Native helper" value={String(diagnostics?.pythonHelperStatus ?? diagnostics?.nativeStatus ?? 'unknown')} good={diagnostics?.pythonHelperStatus === 'ready' || diagnostics?.nativeStatus === 'ready'} />
        <StatusPill label="Recording" value={String(diagnostics?.microphoneRecordingStatus ?? 'unknown')} good />
        <StatusPill label="Local Whisper" value={whisperStatus} good={Boolean(diagnostics?.localWhisperAvailable)} />
        <StatusPill label="Local Parakeet" value={parakeetStatus} good={Boolean(diagnostics?.localParakeetAvailable)} />
        <StatusPill label="Ollama" value={diagnostics?.ollamaAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics?.ollamaAvailable)} />
        <StatusPill label="ASR" value={String(diagnostics?.selectedAsrProvider ?? settings.asrProvider)} good />
        <StatusPill label="LLM" value={String(diagnostics?.selectedLlmProvider ?? settings.llmProvider)} good={Boolean(providerReady)} />
      </div>

      {logs.length > 0 && (
        <div className="micro-panel bg-stone-900/50 p-3 rounded border border-white/5">
          <div className="flex justify-between items-center mb-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-stone-500">Live Logs</span>
            <button className="text-[9px] uppercase tracking-widest text-stone-600 hover:text-stone-400" onClick={() => setLogs([])}>Clear</button>
          </div>
          <div className="max-h-32 overflow-y-auto font-mono text-[11px] space-y-1">
            {logs.map((log, i) => (
              <div key={i} className={`flex gap-2 ${log.level === 'error' ? 'text-red-400' : log.level === 'warn' ? 'text-amber-400' : 'text-stone-400'}`}>
                <span className="opacity-30">[{new Date(log.timestamp).toLocaleTimeString()}]</span>
                <span className="break-all">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
