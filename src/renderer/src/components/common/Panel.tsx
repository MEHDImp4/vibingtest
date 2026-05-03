import type { ReactNode } from 'react'

export function Panel(props: { title: string; description: string; children: ReactNode }): JSX.Element {
  return (
    <section className="panel-base p-6 space-y-6 animate-reveal">
      <div className="space-y-1">
        <h2 className="text-sm font-bold text-[var(--text-primary)]">{props.title}</h2>
        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{props.description}</p>
      </div>
      <div className="space-y-4">{props.children}</div>
    </section>
  )
}
