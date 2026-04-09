import type { ReactNode, RefObject } from 'react'

export type WebcamFacingMode = 'user' | 'environment'

export type WebcamStatus =
  | 'idle'
  | 'requesting'
  | 'ready'
  | 'error'
  | 'unsupported'

export type WebcamErrorCode =
  | 'UNSUPPORTED'
  | 'PERMISSION_DENIED'
  | 'DEVICE_NOT_FOUND'
  | 'DEVICE_IN_USE'
  | 'CONSTRAINTS_NOT_SATISFIED'
  | 'STREAM_START_FAILED'
  | 'UNKNOWN'

export interface WebcamErrorState {
  code: WebcamErrorCode
  message: string
  name?: string
}

export interface UseWebcamOptions {
  facingMode?: WebcamFacingMode
  autoStart?: boolean
  audio?: boolean
  preferredWidth?: number
  preferredHeight?: number
  debug?: boolean
  onStreamStart?: (stream: MediaStream) => void
  onStreamStop?: () => void
}

export interface WebcamController {
  status: WebcamStatus
  error: WebcamErrorState | null
  isLoading: boolean
  isSupported: boolean
  stream: MediaStream | null
  facingMode: WebcamFacingMode
  videoRef: RefObject<HTMLVideoElement | null>
  containerRef: RefObject<HTMLDivElement | null>
  start: () => Promise<void>
  stop: () => void
  restart: () => Promise<void>
}

export interface WebcamViewProps {
  webcam: WebcamController
  className?: string
  title?: string
  description?: string
  mirrored?: boolean
  showControls?: boolean
  showStatus?: boolean
  children?: ReactNode
}
