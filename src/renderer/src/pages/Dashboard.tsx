import { useState, useEffect } from 'react'
import { IPC, RecordingState, AppSettings, LastAudioSnapshot } from '../../../shared/types'
import { useIpcOn } from '../hooks/useIpc'
import { Waveform } from '../components/Waveform'

const STATUS_TEXT: Record<RecordingState, { label: string; detail: string }> = {
  idle: {
    label: 'Ready',
    detail: 'Hold the dictation hotkey in any app.'
  },
  recording: {
    label: 'Recording',
    detail: 'Release the hotkey to stop capture.'
  },
  processing: {
    label: 'Processing',
    detail: 'Audio is moving through the transcription pipeline.'
  },
  done: {
    label: 'Complete',
    detail: 'Final text is ready for paste or copy.'
  },
  error: {
    label: 'Attention',
    detail: 'The helper or provider returned an error.'
  }
}

export function Dashboard({ settings: initialSettings }: { settings: AppSettings }): JSX.Element {
  const [state, setState] = useState<RecordingState>('idle')
  const [rawText, setRawText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<AppSettings>(initialSettings)
  const [nativeStatus, setNativeStatus] = useState<'ready' | 'error' | 'starting'>('starting')
  const [copied, setCopied] = useState(false)
  const [lastAudio, setLastAudio] = useState<LastAudioSnapshot>({ exists: false })
  const [retrying, setRetrying] = useState(false)
  const [retryError, setRetryError] = useState('')
  const [playbackError, setPlaybackError] = useState('')

  const refreshLastAudio = (): void => {
    window.voxflow.getLastAudio()
      .then(setLastAudio)
      .catch(() => setLastAudio({ exists: false }))
  }

  useEffect(() => {
    setSettings(initialSettings)
  }, [initialSettings])

  useEffect(() => {
    window.voxflow.getNativeStatus().then(setNativeStatus)
    refreshLastAudio()
  }, [])

  useIpcOn(IPC.RECORDING_STATE, (s) => {
    setState(s as RecordingState)
    if (s === 'recording') {
      setRawText('')
      setFinalText('')
      setError('')
      setCopied(false)
    }
  })
  useIpcOn(IPC.TRANSCRIPTION_RAW, (t) => setRawText(t as string))
  useIpcOn(IPC.TRANSCRIPTION_FINAL, (t) => {
    setFinalText(t as string)
    refreshLastAudio()
  })
  useIpcOn(IPC.TRANSCRIPTION_ERROR, (e) => {
    setError(e as string)
    refreshLastAudio()
  })
  useIpcOn(IPC.LAST_AUDIO_UPDATED, (snapshot) => setLastAudio(snapshot as LastAudioSnapshot))
  useIpcOn(IPC.NATIVE_STATUS, (s) => setNativeStatus(s as 'ready' | 'error' | 'starting'))

  const handleCopy = async (): Promise<void> => {
    await window.voxflow.copyText(finalText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const retryLastAudio = async (): Promise<void> => {
    setRetrying(true)
    setRetryError('')
    try {
      const result = await window.voxflow.retryLastAudio()
      if (!result.ok) setRetryError(result.error ?? 'Retry failed.')
      refreshLastAudio()
    } catch (error) {
      setRetryError(error instanceof Error ? error.message : 'Retry failed.')
    } finally {
      setRetrying(false)
    }
  }

  return (
    <section className="p-8 animate-reveal">
      <div className="grid grid-cols-[1fr_300px] gap-8 max-xl:grid-cols-1">
        <div className="space-y-8">
          <header className="flex items-start justify-between gap-6">
            <div className="space-y-4">
              <div className="label-mono opacity-60">Capture console</div>
              <h1 className="heading-xl">Speak once.<br />Paste clean text.</h1>
              <p className="max-w-xl text-[var(--text-secondary)] leading-relaxed">
                VoxFlow listens only while your hotkey is held, then prepares text for the focused Windows app.
              </p>
            </div>
            <NativeStatusBadge status={nativeStatus} />
          </header>

          {nativeStatus === 'ready' && (
            <div className="space-y-4">
              {settings.asrProvider === 'local-parakeet' && !lastAudio.exists && (
                <div className="p-4 panel-base border-[var(--color-success)]/20 bg-[var(--color-success)]/5 flex gap-4 items-start animate-reveal">
                  <div className="text-[var(--color-success)]">⚠️</div>
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    <strong className="block text-[var(--text-primary)] mb-1">Local Parakeet files missing</strong>
                    Ensure the model files are in the <code>src/native/models</code> directory.
                  </div>
                </div>
              )}
              {settings.asrProvider === 'local-whisper' && !lastAudio.exists && (
                <div className="p-4 panel-base border-blue-500/20 bg-blue-500/5 flex gap-4 items-start animate-reveal">
                  <div className="text-blue-400">ℹ️</div>
                  <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    <strong className="block text-[var(--text-primary)] mb-1">First-run Model Download</strong>
                    Local Whisper will download <code>{settings.localAsrModel}</code> on your first capture (~1GB).
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="capture-stage min-h-[400px] flex flex-col p-8">
            <div className="flex items-center gap-4 mb-auto">
              <div className={`record-orb ${state}`} />
              <div>
                <div className="text-sm font-bold">{STATUS_TEXT[state].label}</div>
                <div className="text-xs text-[var(--text-secondary)]">{STATUS_TEXT[state].detail}</div>
              </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
              {state === 'idle' && (
                <div className="text-center space-y-6 animate-reveal">
                  <div className="flex items-center justify-center gap-2 h-12">
                    <div className="w-1 h-4 bg-[var(--bg-accent)] rounded-full" />
                    <div className="w-1 h-8 bg-[var(--bg-accent)] rounded-full" />
                    <div className="w-1 h-4 bg-[var(--bg-accent)] rounded-full" />
                  </div>
                  <div className="space-y-2">
                    <div className="label-mono opacity-40">Dictation</div>
                    <kbd className="px-3 py-1.5 panel-base label-mono text-[var(--text-primary)]">{settings.dictateHotkey}</kbd>
                  </div>
                </div>
              )}

              {state === 'recording' && (
                <div className="text-center space-y-4 animate-reveal">
                  <Waveform />
                  <p className="text-sm text-[var(--text-secondary)]">Capturing audio...</p>
                </div>
              )}

              {state === 'processing' && (
                <div className="text-center space-y-6 animate-reveal max-w-md">
                  <div className="flex items-center justify-center gap-1.5">
                    <div className="w-8 h-1 bg-[var(--bg-accent)] rounded-full overflow-hidden">
                      <div className="w-full h-full bg-[var(--color-success)] animate-pulse" />
                    </div>
                    <div className="w-8 h-1 bg-[var(--bg-accent)] rounded-full overflow-hidden">
                      <div className="w-full h-full bg-[var(--color-success)] animate-pulse delay-75" />
                    </div>
                    <div className="w-8 h-1 bg-[var(--bg-accent)] rounded-full overflow-hidden">
                      <div className="w-full h-full bg-[var(--color-success)] animate-pulse delay-150" />
                    </div>
                  </div>
                  <p className="text-sm italic text-[var(--text-primary)] leading-relaxed">
                    {rawText || 'Analyzing signal...'}
                  </p>
                </div>
              )}

              {state === 'done' && finalText && (
                <div className="panel-base p-6 space-y-4 animate-reveal max-w-lg w-full">
                  <p className="text-[var(--text-primary)] leading-relaxed">{finalText}</p>
                  <button onClick={handleCopy} className="secondary-button w-full">
                    {copied ? '✓ Copied' : 'Copy to clipboard'}
                  </button>
                </div>
              )}

              {state === 'error' && (
                <div className="panel-base border-[var(--color-error)]/30 bg-[var(--color-error)]/5 p-6 space-y-2 animate-reveal text-center max-w-sm">
                  <div className="text-[var(--color-error)] font-bold">Capture failed</div>
                  <p className="text-xs text-[var(--text-secondary)]">{error || 'Unknown error occurred.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="panel-base p-6 space-y-4">
            <div className="label-mono opacity-60">Metrics</div>
            <div className="space-y-4">
              <MetricRow label="Mode" value={settings.llmProvider === 'none' ? 'Raw ASR' : settings.rewriteStyle} />
              <MetricRow label="ASR" value={settings.asrProvider} />
              <MetricRow label="Paste" value={settings.privacyMode ? 'Private' : settings.pasteMode} />
            </div>
          </div>

          <div className="panel-base p-2 flex gap-1">
            <button className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-colors ${settings.privacyMode ? 'bg-[var(--bg-accent)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>PRIVATE</button>
            <button className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-colors ${settings.commandMode ? 'bg-[var(--bg-accent)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>COMMANDS</button>
            <button className={`flex-1 py-2 text-[10px] font-bold rounded-md transition-colors ${settings.keepLastAudio ? 'bg-[var(--bg-accent)] text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}`}>REPLAY</button>
          </div>

          <div className="panel-base p-6 space-y-4">
            <div className="label-mono opacity-60">Transcript preview</div>
            {rawText || finalText ? (
              <div className="space-y-4">
                {rawText && (
                  <div className="space-y-1">
                    <div className="label-mono text-[9px] opacity-40">Raw</div>
                    <p className="text-xs text-[var(--text-secondary)] line-clamp-4">{rawText}</p>
                  </div>
                )}
                {finalText && rawText !== finalText && (
                  <div className="space-y-1">
                    <div className="label-mono text-[9px] opacity-40">Final</div>
                    <p className="text-xs text-[var(--text-primary)] line-clamp-4">{finalText}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 py-4 opacity-20">
                <div className="space-y-2">
                  <div className="h-2 w-full bg-[var(--bg-accent)] rounded-full" />
                  <div className="h-2 w-2/3 bg-[var(--bg-accent)] rounded-full" />
                </div>
                <p className="text-[10px] font-medium leading-relaxed">Captures will preview here before entry.</p>
              </div>
            )}
          </div>

          {lastAudio.exists && lastAudio.audioBase64 && (
            <div className="panel-base p-6 space-y-4">
              <div className="label-mono opacity-60">Last session</div>
              <div className="space-y-4">
                <audio
                  key={lastAudio.recordedAt ?? lastAudio.audioBase64.length}
                  controls
                  className="w-full h-8 opacity-60 grayscale invert"
                  src={`data:audio/wav;base64,${lastAudio.audioBase64}`}
                />
                <button 
                  className="secondary-button w-full text-xs py-2" 
                  onClick={retryLastAudio}
                >
                  {retrying ? 'Retrying...' : 'Re-run pipeline'}
                </button>
              </div>
            </div>
          )}
        </aside>
      </div>
    </section>
  )
}

function MetricRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wider">{label}</span>
      <span className="label-mono text-[var(--text-primary)] truncate max-w-[120px]">{value}</span>
    </div>
  )
}

function NativeStatusBadge({ status }: { status: 'ready' | 'error' | 'starting' }): JSX.Element {
  const colors = {
    ready: 'bg-[var(--color-success)]',
    starting: 'bg-amber-400',
    error: 'bg-[var(--color-error)]'
  }
  
  return (
    <div className="flex items-center gap-2.5 px-3 py-1.5 panel-base bg-[var(--bg-secondary)] border-[var(--border-subtle)]">
      <div className={`w-1.5 h-1.5 rounded-full ${colors[status]}`} />
      <span className="label-mono text-[9px] opacity-80">{status}</span>
    </div>
  )
}
