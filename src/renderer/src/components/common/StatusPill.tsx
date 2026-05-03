export function StatusPill(props: { label: string; value: string; good: boolean }): JSX.Element {
  return (
    <div className={`status-pill ${props.good ? 'good' : 'warn'}`}>
      <span>{props.label}</span>
      <strong>{props.value}</strong>
    </div>
  )
}
