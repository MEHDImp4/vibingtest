import type { CSSProperties } from 'react'

export function SettingsSkeleton(): JSX.Element {
  return (
    <div className="settings-grid">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="panel skeleton-panel" key={index}>
          <div className="skeleton-line w-1/3" />
          <div className="skeleton-line mt-3 w-2/3" />
          <div className="mt-6 grid gap-3">
            <div className="skeleton-input" />
            <div className="skeleton-input" />
            <div className="skeleton-input" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function HistorySkeleton(): JSX.Element {
  return (
    <div className="history-list">
      {Array.from({ length: 4 }).map((_, index) => (
        <div className="history-item" key={index} style={{ '--index': index } as CSSProperties}>
          <div className="skeleton-line w-1/4" />
          <div className="skeleton-line mt-4 w-5/6" />
          <div className="skeleton-line mt-2 w-2/3" />
        </div>
      ))}
    </div>
  )
}
