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
    <div className="grid h-[120px] place-items-center bg-transparent px-6">
      <div className={`overlay-shell w-full transition-all duration-500 ${state === 'idle' ? 'opacity-40 scale-95 grayscale' : 'opacity-100 scale-100'}`}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-4">
            <div className={`relative flex h-3 w-3 shrink-0 items-center justify-center`}>
               <div className={`absolute inset-0 rounded-full bg-emerald-500 opacity-20 ${state === 'recording' ? 'animate-ping' : ''}`} />
               <div className={`h-2 w-2 rounded-full transition-colors duration-300 ${
                 state === 'recording' ? 'bg-emerald-500' : 
                 state === 'processing' ? 'bg-amber-400 animate-pulse' :
                 state === 'error' ? 'bg-rose-500' : 'bg-stone-600'
               }`} />
            </div>
            
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="text-xs font-bold uppercase tracking-widest text-emerald-500/80">
                  {state === 'recording' ? 'Live' : state === 'processing' ? 'Thinking' : 'VoxFlow'}
                </span>
                <span className="truncate text-sm font-medium text-stone-200">
                  {state === 'recording' && 'Listening to your voice...'}
                  {state === 'processing' && 'Polishing your words...'}
                  {state === 'done' && (finalText ? 'Ready to paste' : 'Text processed')}
                  {state === 'error' && 'Something went wrong'}
                  {state === 'idle' && 'Ready for dictation'}
                </span>
              </div>
              
              {(state === 'done' || state === 'error') && (
                <div className="mt-1.5 truncate text-[11px] leading-relaxed text-stone-500">
                  {state === 'done' && (finalText || 'Transcription complete.')}
                  {state === 'error' && (error || 'Connection or model error.')}
                </div>
              )}
            </div>
          </div>

          {state === 'done' && settings?.pasteMode === 'confirm' && (
            <button className="primary-button compact text-[11px] uppercase tracking-wider" onClick={confirm}>
              Paste Now
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
