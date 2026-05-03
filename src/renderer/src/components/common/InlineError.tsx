export function InlineError(props: { message: string }): JSX.Element {
  return (
    <div className="p-4 mb-8 panel-base border-[var(--color-error)]/30 bg-[var(--color-error)]/5 text-[var(--color-error)] text-xs animate-reveal">
      {props.message}
    </div>
  )
}
