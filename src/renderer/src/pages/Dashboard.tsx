import { useState, useEffect } from 'react'
import { IPC, RecordingState, AppSettings, DEFAULT_SETTINGS, LastAudioSnapshot } from '../../../shared/types'
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

export function Dashboard(): JSX.Element {
  const [state, setState] = useState<RecordingState>('idle')
  const [rawText, setRawText] = useState('')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS)
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
    window.voxflow.getSettings().then(setSettings)
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
    <section className="capture-shell">
      <div className="capture-grid">
        <div className="capture-primary">
          <div className="capture-header">
            <div>
              <div className="eyebrow">Capture console</div>
              <h1>Speak once. Paste clean text.</h1>
              <p>VoxFlow listens only while your hotkey is held, then prepares text for the focused Windows app.</p>
            </div>
            <NativeStatusBadge status={nativeStatus} />
          </div>

          {nativeStatus === 'ready' && (
            <>
              {settings.asrProvider === 'local-parakeet' && !lastAudio.exists && (
                <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                  <div className="mt-1 text-amber-400">⚠️</div>
                  <div className="text-xs text-amber-200/70 leading-relaxed">
                    <strong className="block text-amber-300 mb-0.5">Local Parakeet files missing</strong>
                    Ensure the model files are in the <code>src/native/models</code> directory. Check Settings &gt; Diagnostics for details.
                  </div>
                </div>
              )}
              {settings.asrProvider === 'local-whisper' && !lastAudio.exists && (
                <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex gap-3 items-start animate-in fade-in slide-in-from-top-2">
                  <div className="mt-1 text-blue-400">ℹ️</div>
                  <div className="text-xs text-blue-200/70 leading-relaxed">
                    <strong className="block text-blue-300 mb-0.5">First-run Model Download</strong>
                    Local Whisper will download the <code>{settings.localAsrModel}</code> model on your first capture (~1GB). Ensure you have internet access.
                  </div>
                </div>
              )}
            </>
          )}

          <div className={`capture-stage state-${state}`}>
            <div className="stage-topline">
              <div className={`record-orb ${state}`} />
              <div>
                <div className="stage-state">{STATUS_TEXT[state].label}</div>
                <div className="stage-detail">{STATUS_TEXT[state].detail}</div>
              </div>
            </div>

            <div className="stage-body">
              {state === 'idle' && (
                <div className="idle-composition">
                  <div className="listening-ring">
                    <div />
                    <div />
                    <div />
                  </div>
                  <div>
                    <p className="text-sm text-stone-400">Dictation</p>
                    <kbd>{settings.dictateHotkey}</kbd>
                  </div>
                </div>
              )}

              {state === 'recording' && (
                <div className="recording-composition">
                  <Waveform />
                  <p>Recording audio locally before transcription.</p>
                </div>
              )}

              {state === 'processing' && (
                <div className="processing-composition">
                  <div className="pipeline-loader">
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>{rawText || 'Waiting for first transcript tokens.'}</p>
                </div>
              )}

              {state === 'done' && finalText && (
                <div className="result-composition">
                  <p>{finalText}</p>
                  <button onClick={handleCopy} className="secondary-button compact">{copied ? 'Copied' : 'Copy'}</button>
                </div>
              )}

              {state === 'error' && (
                <div className="error-composition">
                  <strong>Capture could not finish</strong>
                  <p>{error || 'Check Python, microphone access, and provider settings.'}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <aside className="capture-secondary">
          <div className="metric-stack">
            <div className="metric-row">
              <span>Mode</span>
              <strong>{settings.llmProvider === 'none' ? 'Raw ASR' : settings.rewriteStyle}</strong>
            </div>
            <div className="metric-row">
              <span>ASR</span>
              <strong>{settings.asrProvider}</strong>
            </div>
            <div className="metric-row">
              <span>Translate</span>
              <strong>{settings.translateHotkey}</strong>
            </div>
            <div className="metric-row">
              <span>Paste</span>
              <strong>
                {settings.privacyMode
                  ? 'Private'
                  : settings.pasteMode === 'auto-paste'
                    ? 'Auto'
                    : settings.pasteMode === 'confirm'
                      ? 'Confirm'
                      : 'Copy only'}
              </strong>
            </div>
            <div className="metric-row">
              <span>Profiles</span>
              <strong>{settings.appProfiles.filter((profile) => profile.enabled).length} active</strong>
            </div>
          </div>

          <div className="mini-command-bar">
            <button className={settings.privacyMode ? 'active' : ''}>Private</button>
            <button className={settings.commandMode ? 'active' : ''}>Commands</button>
            <button className={settings.keepLastAudio ? 'active' : ''}>Replay</button>
          </div>

          <div className="transcript-panel">
            <div className="panel-label">Transcript preview</div>
            {rawText || finalText ? (
              <div className="grid gap-4">
                {rawText && (
                  <div>
                    <span>Raw</span>
                    <p>{rawText}</p>
                  </div>
                )}
                {finalText && rawText !== finalText && (
                  <div>
                    <span>Final</span>
                    <p>{finalText}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="mini-empty">
                <div className="mini-empty-bars">
                  <i />
                  <i />
                  <i />
                </div>
                <p>Completed captures will preview here before they enter history.</p>
              </div>
            )}
          </div>

          <div className="transcript-panel">
            <div className="panel-label">Last audio</div>
            {lastAudio.exists && lastAudio.audioBase64 ? (
              <div className="audio-retry">
                <audio
                  key={lastAudio.recordedAt ?? lastAudio.audioBase64.length}
                  controls
                  preload="metadata"
                  src={`data:audio/wav;base64,${lastAudio.audioBase64}`}
                  onCanPlay={() => setPlaybackError('')}
                  onError={() => setPlaybackError('Playback failed. Record again or restart VoxFlow so the updated media policy loads.')}
                />
                <div className="metric-row">
                  <span>{lastAudio.mode}</span>
                  <strong>{lastAudio.duration?.toFixed(1)}s</strong>
                </div>
                {playbackError && <p className="text-sm text-red-300">{playbackError}</p>}
                <button className="secondary-button compact" onClick={retryLastAudio}>{retrying ? 'Retrying' : 'Retry pipeline'}</button>
                {retryError && <p className="text-sm text-red-300">{retryError}</p>}
              </div>
            ) : (
              <div className="mini-empty">
                <div className="mini-empty-bars">
                  <i />
                  <i />
                </div>
                <p>Enable last-audio retention in Settings, then record once to replay or retry.</p>
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  )
}

function NativeStatusBadge(props: { status: 'ready' | 'error' | 'starting' }): JSX.Element {
  return (
    <div className={`native-badge ${props.status}`}>
      <span />
      {props.status === 'ready' && 'Helper ready'}
      {props.status === 'starting' && 'Starting helper'}
      {props.status === 'error' && 'Helper error'}
    </div>
  )
}
