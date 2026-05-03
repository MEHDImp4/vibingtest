import type { ReactNode } from 'react'

export function PageHeader(props: { eyebrow: string; title: string; description: string; action?: ReactNode }): JSX.Element {
  return (
    <header className="page-header">
      <div>
        <div className="eyebrow">{props.eyebrow}</div>
        <h1>{props.title}</h1>
        <p>{props.description}</p>
      </div>
      {props.action && <div className="shrink-0">{props.action}</div>}
    </header>
  )
}
