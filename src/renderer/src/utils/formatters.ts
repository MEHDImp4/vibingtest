import type { PipelineDiagnostics } from "../../shared/types"

export function formatDuration(value: unknown): string {
  return typeof value === 'number' ? `${Math.round(value)}ms` : 'none'
}

export function formatDiagnosticError(value: unknown): string {
  const error = value as Partial<PipelineDiagnostics['lastError']>
  if (!error) return 'Unknown error'
  return [error.message, error.stack].filter(Boolean).join('\n')
}
