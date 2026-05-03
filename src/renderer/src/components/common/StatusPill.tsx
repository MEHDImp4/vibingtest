export function StatusPill(props: { label: string; value: string; good: boolean }): JSX.Element {
  return (
    <div className={`p-3 panel-base bg-[var(--bg-primary)]/50 space-y-1 ${props.good ? '' : 'border-[var(--color-error)]/30'}`}>
      <div className="label-mono text-[8px] opacity-40">{props.label}</div>
      <div className={`text-[11px] font-bold truncate ${props.good ? 'text-[var(--text-primary)]' : 'text-[var(--color-error)]'}`}>
        {props.value.toUpperCase()}
      </div>
    </div>
  )
}
