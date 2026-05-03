export function Toggle(props: { label: string; checked: boolean; onChange: (checked: boolean) => void }): JSX.Element {
  return (
    <label className="toggle-row">
      <span>{props.label}</span>
      <button
        type="button"
        className={`toggle ${props.checked ? 'toggle-on' : ''}`}
        onClick={() => props.onChange(!props.checked)}
        aria-pressed={props.checked}
      >
        <span />
      </button>
    </label>
  )
}
