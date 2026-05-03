export function HotkeyField(props: {
  label: string
  hint: string
  value: string
  isCapturing: boolean
  onCaptureStart: () => void
  onCaptureCancel: () => void
  onChange: (value: string) => void
}): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <label className="label-mono text-[10px] opacity-60">{props.label}</label>
        <p className="text-[10px] text-[var(--text-tertiary)] leading-snug">{props.hint}</p>
      </div>
      <div className={`flex items-center justify-between gap-4 p-3 panel-base bg-[var(--bg-primary)] ${props.isCapturing ? 'border-[var(--border-active)]' : ''}`}>
        <code className="label-mono text-[11px] text-[var(--text-primary)] truncate">
          {props.isCapturing ? 'RECORDING COMBO...' : props.value}
        </code>
        <button
          type="button"
          className="secondary-button compact text-[10px]"
          onClick={props.isCapturing ? props.onCaptureCancel : props.onCaptureStart}
        >
          {props.isCapturing ? 'CANCEL' : 'CHANGE'}
        </button>
      </div>
    </div>
  )
}
