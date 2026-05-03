import type { ReactNode } from 'react'

export function PageHeader(props: { eyebrow: string; title: string; description: string; action?: ReactNode }): JSX.Element {
  return (
    <header className="flex flex-col gap-4 mb-12">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-4">
          <div className="label-mono opacity-60">{props.eyebrow}</div>
          <h1 className="heading-xl">{props.title}</h1>
        </div>
        {props.action && <div className="shrink-0">{props.action}</div>}
      </div>
      <p className="max-w-2xl text-[var(--text-secondary)] leading-relaxed text-sm">
        {props.description}
      </p>
    </header>
  )
}
