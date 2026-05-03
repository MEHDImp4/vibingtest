import { normalizeHotkey } from '../../utils/hotkeys'

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
    <div className="field">
      <span>{props.label}</span>
      <div className={`hotkey-control ${props.isCapturing ? 'is-capturing' : ''}`}>
        <code>{props.isCapturing ? 'Press a key combo' : props.value}</code>
        <button
          type="button"
          className="secondary-button compact"
          onClick={props.isCapturing ? props.onCaptureCancel : props.onCaptureStart}
          autoFocus={props.isCapturing}
        >
          {props.isCapturing ? 'Cancel' : 'Capture'}
        </button>
      </div>
      <input
        value={props.value}
        onChange={(event) => props.onChange(event.target.value)}
        onBlur={(event) => props.onChange(normalizeHotkey(event.target.value))}
        placeholder="ctrl+shift+space"
      />
      <small>{props.hint}</small>
    </div>
  )
}
