import { useState, useEffect } from 'react'
import { IPC, RecordingState } from '../../../shared/types'
import { useIpcOn } from '../hooks/useIpc'
import { Waveform } from './Waveform'
import { Spinner } from './Spinner'

export function RecordingOverlay(): JSX.Element {
  const [state, setState] = useState<RecordingState>('idle')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useIpcOn(IPC.RECORDING_STATE, (s) => setState(s as RecordingState))
  useIpcOn(IPC.TRANSCRIPTION_FINAL, (t) => setFinalText(t as string))
  useIpcOn(IPC.TRANSCRIPTION_ERROR, (e) => setError(e as string))

  useEffect(() => {
    if (state === 'recording') {
      setFinalText('')
      setError('')
      setCopied(false)
    }
  }, [state])

  const handleCopy = async (): Promise<void> => {
    await window.voxflow.copyText(finalText)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="w-full h-full flex items-center px-6 py-3 panel-glass border-[var(--border-subtle)] shadow-2xl animate-reveal">
      {state === 'recording' && (
        <div className="flex items-center gap-6 w-full animate-reveal">
          <div className="record-orb recording w-2.5 h-2.5" />
          <Waveform />
          <span className="label-mono text-[10px] opacity-40 ml-auto">Capturing...</span>
        </div>
      )}

      {state === 'processing' && (
        <div className="flex items-center gap-4 w-full animate-reveal">
          <div className="record-orb processing w-2.5 h-2.5" />
          <span className="text-xs font-medium text-[var(--text-secondary)]">Transcribing pipeline...</span>
        </div>
      )}

      {state === 'done' && finalText && (
        <div className="flex items-center gap-4 w-full animate-reveal">
          <div className="record-orb done w-2 h-2" />
          <p className="text-xs text-[var(--text-primary)] leading-snug flex-1 line-clamp-2 pr-4">{finalText}</p>
          <button
            onClick={handleCopy}
            className="no-drag label-mono text-[9px] opacity-40 hover:opacity-100 transition-opacity flex-shrink-0"
          >
            {copied ? '✓ COPIED' : 'COPY'}
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-4 w-full animate-reveal">
          <div className="record-orb error w-2 h-2" />
          <p className="text-xs text-[var(--color-error)] flex-1 truncate">{error || 'Capture error'}</p>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex items-center gap-4 w-full opacity-20 animate-reveal">
          <div className="record-orb w-2 h-2" />
          <span className="label-mono text-[10px]">VoxFlow Standby</span>
        </div>
      )}
    </div>
  )
}
