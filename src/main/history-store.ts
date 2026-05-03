import { app } from 'electron'
import path from 'path'
import fs from 'fs'
import { TranscriptionEntry, WordStats } from '@shared/types'

const HISTORY_PATH = path.join(app.getPath('userData'), 'history.json')
const MAX_ENTRIES = 500

function read(): TranscriptionEntry[] {
  try {
    if (!fs.existsSync(HISTORY_PATH)) return []
    return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf-8'))
  } catch {
    return []
  }
}

function write(entries: TranscriptionEntry[]): void {
  fs.mkdirSync(path.dirname(HISTORY_PATH), { recursive: true })
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(entries, null, 2), 'utf-8')
}

export function getHistory(): TranscriptionEntry[] {
  return read()
}

export function getWordStats(now = new Date()): WordStats {
  const entries = read()
  const dayStart = startOfDay(now).getTime()
  const weekStart = startOfWeek(now).getTime()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime()

  return entries.reduce<WordStats>((stats, entry) => {
    const words = countWords(entry.finalText || entry.rawTranscript)
    stats.total += words

    if (entry.timestamp >= dayStart) {
      stats.today += words
      stats.capturesToday += 1
    }

    if (entry.timestamp >= weekStart) {
      stats.thisWeek += words
      stats.capturesThisWeek += 1
    }

    if (entry.timestamp >= monthStart) {
      stats.thisMonth += words
      stats.capturesThisMonth += 1
    }

    return stats
  }, {
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    total: 0,
    capturesToday: 0,
    capturesThisWeek: 0,
    capturesThisMonth: 0
  })
}

export function addEntry(entry: TranscriptionEntry): void {
  const entries = [entry, ...read()].slice(0, MAX_ENTRIES)
  write(entries)
}

export function deleteEntry(id: string): void {
  write(read().filter((e) => e.id !== id))
}

export function clearHistory(): void {
  write([])
}

function countWords(text: string): number {
  return (text.match(/(?:[\p{L}\p{N}]+['’\-])*[\p{L}\p{N}]+/gu) ?? []).length
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function startOfWeek(date: Date): Date {
  const start = startOfDay(date)
  const day = start.getDay()
  const diff = day === 0 ? 6 : day - 1
  start.setDate(start.getDate() - diff)
  return start
}
