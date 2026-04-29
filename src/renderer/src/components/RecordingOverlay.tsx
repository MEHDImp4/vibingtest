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
    <div className="w-full h-full flex items-center px-4 py-3 rounded-2xl bg-zinc-900/90 backdrop-blur-md border border-zinc-700/60 shadow-2xl">
      {state === 'recording' && (
        <div className="flex items-center gap-3 w-full">
          <div className="pulse-dot w-2.5 h-2.5 rounded-full bg-stone-500 flex-shrink-0" />
          <Waveform />
          <span className="text-sm text-zinc-400 ml-auto">Recording…</span>
        </div>
      )}

      {state === 'processing' && (
        <div className="flex items-center gap-3 w-full">
          <Spinner />
          <span className="text-sm text-zinc-300">Transcribing & cleaning up…</span>
        </div>
      )}

      {state === 'done' && finalText && (
        <div className="flex items-start gap-3 w-full">
          <div className="w-2 h-2 rounded-full bg-emerald-400 mt-1.5 flex-shrink-0" />
          <p className="text-sm text-zinc-100 leading-snug flex-1 line-clamp-3">{finalText}</p>
          <button
            onClick={handleCopy}
            className="no-drag ml-2 text-xs text-zinc-500 hover:text-zinc-300 transition-colors flex-shrink-0"
          >
            {copied ? '✓' : 'copy'}
          </button>
        </div>
      )}

      {state === 'error' && (
        <div className="flex items-center gap-3 w-full">
          <div className="w-2 h-2 rounded-full bg-stone-500 flex-shrink-0" />
          <p className="text-sm text-stone-500 flex-1 truncate">{error || 'Something went wrong'}</p>
        </div>
      )}

      {state === 'idle' && (
        <div className="flex items-center gap-2 w-full opacity-40">
          <div className="w-2 h-2 rounded-full bg-zinc-500" />
          <span className="text-sm text-zinc-400">VoxFlow ready</span>
        </div>
      )}
    </div>
  )
}
