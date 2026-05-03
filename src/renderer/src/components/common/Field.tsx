import type { ReactNode } from 'react'

export function Field(props: { label: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <label className="field">
      <span>{props.label}</span>
      {props.children}
      {props.hint && <small>{props.hint}</small>}
    </label>
  )
}
