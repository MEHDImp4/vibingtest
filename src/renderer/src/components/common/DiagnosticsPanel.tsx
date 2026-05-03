import { useState, useCallback } from 'react'
import { IPC, type AppSettings } from '@shared/types'
import { formatDiagnosticError } from '../../utils/formatters'
import { useIpcOn } from '../../hooks/useIpc'
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
    } catch (err) {
      console.error('Failed to fetch diagnostics:', err)
    } finally {
      setRunning(false)
    }
  }

  useIpcOn(
    IPC.NATIVE_LOG,
    useCallback((log: { level: string; message: string }) => {
      setLogs((prev) => [{ ...log, timestamp: Date.now() }, ...prev].slice(0, 50))
    }, [])
  )

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
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
        <StatusPill label="Native helper" value={String(diagnostics?.pythonHelperStatus ?? diagnostics?.nativeStatus ?? 'unknown')} good={diagnostics?.pythonHelperStatus === 'ready' || diagnostics?.nativeStatus === 'ready'} />
        <StatusPill label="Recording" value={String(diagnostics?.microphoneRecordingStatus ?? 'unknown')} good />
        <StatusPill label="Local Whisper" value={whisperStatus} good={Boolean(diagnostics?.localWhisperAvailable)} />
        <StatusPill label="Local Parakeet" value={parakeetStatus} good={Boolean(diagnostics?.localParakeetAvailable)} />
        <StatusPill label="Ollama" value={diagnostics?.ollamaAvailable ? 'available' : 'unavailable'} good={Boolean(diagnostics?.ollamaAvailable)} />
        <StatusPill label="ASR" value={String(diagnostics?.selectedAsrProvider ?? settings.asrProvider)} good />
      </div>

      {logs.length > 0 && (
        <div className="panel-base bg-[var(--bg-primary)] p-4 space-y-4">
          <div className="flex justify-between items-center">
            <span className="label-mono text-[9px] opacity-40">Live Logs</span>
            <button className="label-mono text-[8px] opacity-20 hover:opacity-100 transition-opacity" onClick={() => setLogs([])}>CLEAR</button>
          </div>
          <div className="max-h-40 overflow-y-auto label-mono text-[10px] space-y-2 scrollbar-hide">
            {logs.map((log, i) => (
              <div key={i} className={`flex gap-3 ${log.level === 'error' ? 'text-[var(--color-error)]' : log.level === 'warn' ? 'text-amber-400' : 'text-[var(--text-tertiary)]'}`}>
                <span className="opacity-20 flex-shrink-0">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false })}]</span>
                <span className="break-all leading-relaxed">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!!diagnostics?.lastError && (
        <InlineError message={formatDiagnosticError(diagnostics.lastError)} />
      )}
      <div className="flex flex-wrap gap-2">
        <button className="secondary-button compact text-[10px]" onClick={run}>{running ? 'CHECKING...' : 'RUN DIAGNOSTICS'}</button>
        <button className="secondary-button compact text-[10px]" onClick={() => window.voxflow.testMicrophone()}>TEST MIC</button>
        <button className="secondary-button compact text-[10px]" onClick={() => window.voxflow.testPaste()}>TEST PASTE</button>
        <button className="secondary-button compact text-[10px]" onClick={() => window.voxflow.restartHelper()}>RESTART HELPER</button>
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
