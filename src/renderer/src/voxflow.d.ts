/// <reference types="vite/client" />
import { VoxflowApi } from '../../shared/types'

declare global {
  interface Window {
    voxflow: VoxflowApi
  }
}

export {}
