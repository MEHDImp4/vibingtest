import type { ReactNode } from 'react'

export function Panel(props: { title: string; description: string; children: ReactNode }): JSX.Element {
  return (
    <section className="panel">
      <div className="mb-5">
        <h2>{props.title}</h2>
        <p>{props.description}</p>
      </div>
      <div className="grid gap-4">{props.children}</div>
    </section>
  )
}
