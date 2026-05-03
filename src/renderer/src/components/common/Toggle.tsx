export function Toggle(props: {
  label: string
  hint?: string
  checked: boolean
  onChange: (checked: boolean) => void
}): JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 p-4 panel-base bg-[var(--bg-primary)]/50">
      <div className="space-y-1">
        <div className="text-[11px] font-bold text-[var(--text-primary)]">{props.label}</div>
        {props.hint && <div className="text-[10px] text-[var(--text-tertiary)] leading-snug">{props.hint}</div>}
      </div>
      <button 
        onClick={() => props.onChange(!props.checked)}
        className={`w-9 h-5 rounded-full transition-colors relative flex-shrink-0 ${props.checked ? 'bg-[var(--color-success)]' : 'bg-[var(--bg-accent)]'}`}
      >
        <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${props.checked ? 'translate-x-4' : ''}`} />
      </button>
    </div>
  )
}
