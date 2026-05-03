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
    <section className="p-8 animate-reveal">
      <PageHeader
        eyebrow="Local archive"
        title="History"
        description="Your recent captures with raw and final text. All data stays local on this machine."
        action={history.length > 0 ? <button className="secondary-button" onClick={clear}>Clear archive</button> : null}
      />

      {error && <InlineError message={error} />}
      {stats && (
        <div className="grid grid-cols-4 gap-4 mb-12 max-lg:grid-cols-2 max-sm:grid-cols-1">
          <WordStatCard label="Today" words={stats.today} captures={stats.capturesToday} />
          <WordStatCard label="This week" words={stats.thisWeek} captures={stats.capturesThisWeek} />
          <WordStatCard label="This month" words={stats.thisMonth} captures={stats.capturesThisMonth} />
          <WordStatCard label="Total" words={stats.total} captures={history.length} />
        </div>
      )}

      {loading ? (
        <HistorySkeleton />
      ) : history.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
          <div className="w-12 h-12 panel-base border-dashed rounded-full flex items-center justify-center">
            <div className="w-2 h-2 bg-[var(--text-tertiary)] rounded-full" />
          </div>
          <div className="space-y-1">
            <h3 className="font-bold">No captures yet</h3>
            <p className="text-xs max-w-[240px]">Record something using your hotkey to see it archived here.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry, index) => (
            <article 
              className="panel-base p-6 space-y-4 animate-reveal" 
              key={entry.id} 
              style={{ animationDelay: `${index * 40}ms` }}
            >
              <div className="flex items-start justify-between gap-6">
                <div className="space-y-3 min-w-0 flex-1">
                  <div className="label-mono text-[9px] opacity-40 flex items-center gap-2">
                    <span>{new Date(entry.timestamp).toLocaleString()}</span>
                    <span className="w-1 h-1 bg-[var(--bg-accent)] rounded-full" />
                    <span className="uppercase">{entry.mode}</span>
                    <span className="w-1 h-1 bg-[var(--bg-accent)] rounded-full" />
                    <span className="truncate">{entry.appName}</span>
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">{entry.finalText}</p>
                  
                  {entry.rawTranscript !== entry.finalText && (
                    <details className="group">
                      <summary className="cursor-pointer label-mono text-[9px] opacity-40 hover:opacity-100 transition-opacity list-none flex items-center gap-1.5">
                        <span className="group-open:rotate-90 transition-transform">▸</span>
                        VIEW REWRITE DIFF
                      </summary>
                      <div className="mt-4 p-4 bg-[var(--bg-primary)] rounded-lg border border-[var(--border-subtle)] space-y-4">
                        <div className="space-y-1">
                          <div className="label-mono text-[8px] opacity-40">Raw Transcript</div>
                          <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed italic">{entry.rawTranscript}</p>
                        </div>
                        <DiffView raw={entry.rawTranscript} finalText={entry.finalText} />
                      </div>
                    </details>
                  )}
                </div>
                <div className="flex gap-2">
                  <button className="secondary-button compact text-[10px]" onClick={() => window.voxflow.copyText(entry.finalText)}>COPY</button>
                  <button className="secondary-button compact text-[10px] text-[var(--color-error)]" onClick={() => remove(entry.id)}>DEL</button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}

function WordStatCard({ label, words, captures }: { label: string; words: number; captures: number }): JSX.Element {
  return (
    <div className="panel-base p-6 space-y-2">
      <div className="label-mono opacity-60 text-[9px]">{label}</div>
      <div className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
        {words.toLocaleString()}
      </div>
      <div className="label-mono text-[8px] opacity-40">
        {captures.toLocaleString()} captures
      </div>
    </div>
  )
}

function DiffView({ raw, finalText }: { raw: string; finalText: string }): JSX.Element {
  const rawWords = new Set(raw.toLowerCase().split(/\s+/).filter(Boolean))
  const finalWords = finalText.split(/(\s+)/)

  return (
    <div className="space-y-2">
      <div className="label-mono text-[8px] opacity-40">Changes</div>
      <p className="text-[11px] leading-relaxed">
        {finalWords.map((word, index) => {
          if (/^\s+$/.test(word)) return word
          const added = !rawWords.has(word.toLowerCase())
          return (
            <span 
              key={`${word}-${index}`} 
              className={added ? 'bg-[var(--color-success)]/20 text-[var(--text-primary)] px-0.5 rounded' : 'text-[var(--text-secondary)]'}
            >
              {word}
            </span>
          )
        })}
      </p>
    </div>
  )
}
