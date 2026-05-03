import { useEffect, useState } from 'react'
import type { CSSProperties } from 'react'
import { IPC, TranscriptionEntry, WordStats } from '../../../shared/types'
import { useIpcOn } from '../hooks/useIpc'
import { PageHeader } from '../components/common/PageHeader'
import { InlineError } from '../components/common/InlineError'
import { HistorySkeleton } from '../components/common/Skeletons'

export function HistoryPage(): JSX.Element {
  const [history, setHistory] = useState<TranscriptionEntry[]>([])
  const [stats, setStats] = useState<WordStats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const refresh = async (): Promise<void> => {
    try {
      setError('')
      const [entries, wordStats] = await Promise.all([
        window.voxflow.getHistory(),
        window.voxflow.getWordStats()
      ])
      setHistory(entries)
      setStats(wordStats)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { void refresh() }, [])
  useIpcOn(IPC.TRANSCRIPTION_FINAL, () => { void refresh() })

  const clear = async (): Promise<void> => {
    await window.voxflow.clearHistory()
    setHistory([])
    setStats(null)
  }

  const remove = async (id: string): Promise<void> => {
    await window.voxflow.deleteEntry(id)
    await refresh()
  }

  return (
    <section className="page-shell">
      <PageHeader
        eyebrow="Local archive"
        title="Recent captures with raw and final text."
        description="The archive is capped to 500 entries and stays on this machine."
        action={history.length > 0 ? <button className="secondary-button" onClick={clear}>Clear history</button> : null}
      />

      {error && <InlineError message={error} />}
      {stats && (
        <div className="word-stats-grid">
          <WordStatCard label="Today" words={stats.today} captures={stats.capturesToday} />
          <WordStatCard label="This week" words={stats.thisWeek} captures={stats.capturesThisWeek} />
          <WordStatCard label="This month" words={stats.thisMonth} captures={stats.capturesThisMonth} />
          <WordStatCard label="All time" words={stats.total} captures={history.length} />
        </div>
      )}

      {loading ? (
        <HistorySkeleton />
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-mark" />
          <h3>No captures yet</h3>
          <p>Use the dictation hotkey in any app. Completed captures will appear here with raw and final text.</p>
        </div>
      ) : (
        <div className="history-list">
          {history.map((entry, index) => (
            <article className="history-item" key={entry.id} style={{ '--index': index } as CSSProperties}>
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto]">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] uppercase tracking-[0.2em] text-stone-500">
                    {new Date(entry.timestamp).toLocaleString()} / {entry.mode} / {entry.appName}
                  </div>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-stone-100">{entry.finalText}</p>
                  {entry.rawTranscript !== entry.finalText && (
                    <details className="mt-3">
                      <summary className="cursor-pointer text-xs text-stone-500">Raw transcript</summary>
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-5 text-stone-500">{entry.rawTranscript}</p>
                      <DiffView raw={entry.rawTranscript} finalText={entry.finalText} />
                    </details>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button className="secondary-button compact" onClick={() => window.voxflow.copyText(entry.finalText)}>Copy</button>
                  <button className="secondary-button compact danger" onClick={() => remove(entry.id)}>Delete</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function WordStatCard(props: { label: string; words: number; captures: number }): JSX.Element {
  return (
    <div className="word-stat-card">
      <span>{props.label}</span>
      <strong>{props.words.toLocaleString()}</strong>
      <small>{props.captures.toLocaleString()} captures</small>
    </div>
  )
}

function DiffView({ raw, finalText }: { raw: string; finalText: string }): JSX.Element {
  const rawWords = new Set(raw.toLowerCase().split(/\s+/).filter(Boolean))
  const finalWords = finalText.split(/(\s+)/)

  return (
    <div className="diff-view">
      <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-stone-500">Rewrite diff</div>
      <p>
        {finalWords.map((word, index) => {
          if (/^\s+$/.test(word)) return word
          const added = !rawWords.has(word.toLowerCase())
          return <mark key={`${word}-${index}`} className={added ? 'added' : ''}>{word}</mark>
        })}
      </p>
    </div>
  )
}
