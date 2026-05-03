import type { CSSProperties } from 'react'

export function SettingsSkeleton(): JSX.Element {
  return (
    <div className="settings-grid">
      {[1, 2, 3, 4].map((i) => (
        <div className="panel skeleton-panel" key={i}>
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
      {[1, 2, 3, 4].map((i, index) => (
        <div className="history-item" key={i} style={{ '--index': index } as CSSProperties}>
          <div className="skeleton-line w-1/4" />
          <div className="skeleton-line mt-4 w-5/6" />
          <div className="skeleton-line mt-2 w-2/3" />
        </div>
      ))}
    </div>
  )
}
