export function InlineError({ message }: { message: string }): JSX.Element {
  return <div className="inline-error">{message}</div>
}
