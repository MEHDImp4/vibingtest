import { useEffect } from 'react'
import { RendererEventChannel } from '../../../shared/types'

export function useIpcOn(channel: RendererEventChannel, cb: (...args: unknown[]) => void): void {
  useEffect(() => {
    const off = window.voxflow.on(channel, cb)
    return off
  }, [channel])
}
