import type { ReactNode } from 'react'

export function Field(props: { label: string; hint?: string; children: ReactNode }): JSX.Element {
  return (
    <div className="space-y-2">
      <div className="flex flex-col gap-1">
        <label className="label-mono text-[10px] opacity-60">{props.label}</label>
        {props.hint && <p className="text-[10px] text-[var(--text-tertiary)] leading-snug">{props.hint}</p>}
      </div>
      <div className="[&>input]:input-field [&>select]:input-field [&>textarea]:input-field">
        {props.children}
      </div>
    </div>
  )
}
