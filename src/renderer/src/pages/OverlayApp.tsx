import { useEffect, useState } from 'react'
import { AppSettings, IPC, RecordingState } from '../../../shared/types'
import { useIpcOn } from '../hooks/useIpc'

export function OverlayApp(): JSX.Element {
  const [state, setState] = useState<RecordingState>('idle')
  const [finalText, setFinalText] = useState('')
  const [error, setError] = useState('')
  const [settings, setSettings] = useState<AppSettings | null>(null)

  useIpcOn(IPC.RECORDING_STATE, (next) => {
    setState(next as RecordingState)
    if (next === 'recording') {
      setFinalText('')
      setError('')
    }
  })
  useIpcOn(IPC.TRANSCRIPTION_FINAL, (text) => setFinalText(text as string))
  useIpcOn(IPC.TRANSCRIPTION_ERROR, (message) => setError(message as string))

  useEffect(() => {
    window.voxflow.getSettings().then(setSettings).catch(() => {})
  }, [])

  const confirm = async (): Promise<void> => {
    await window.voxflow.confirmPaste()
    setFinalText('')
    setState('idle')
  }

  return (
    <div className="grid h-[120px] place-items-center bg-transparent px-6 overflow-hidden">
      <div className={`w-full panel-glass px-6 py-4 shadow-2xl transition-all duration-500 ${state === 'idle' ? 'opacity-0 scale-95 translate-y-4' : 'opacity-100 scale-100 translate-y-0'}`}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className={`record-orb ${state} w-2.5 h-2.5 shrink-0`} />
            
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="label-mono text-[10px] opacity-60">
                  {state === 'recording' ? 'Live' : state === 'processing' ? 'Thinking' : 'VoxFlow'}
                </span>
                <span className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {state === 'recording' && 'Listening...'}
                  {state === 'processing' && 'Processing...'}
                  {state === 'done' && (finalText ? 'Ready' : 'Done')}
                  {state === 'error' && 'Error'}
                  {state === 'idle' && 'Standby'}
                </span>
              </div>
              
              {(state === 'done' || state === 'error') && (
                <div className="mt-1 truncate text-[11px] text-[var(--text-secondary)] leading-relaxed">
                  {state === 'done' && (finalText || 'Transcription complete.')}
                  {state === 'error' && (error || 'Pipeline error.')}
                </div>
              )}
            </div>
          </div>

          {state === 'done' && settings?.pasteMode === 'confirm' && (
            <button className="primary-button compact text-[10px]" onClick={confirm}>
              PASTE
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
