import type { RefObject } from 'react'
import type {
  Landmark,
  NormalizedLandmark,
  PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'

export type PoseHookStatus =
  | 'idle'
  | 'initializing'
  | 'running'
  | 'stopped'
  | 'error'

export type PosePersonStatus = 'detected' | 'lost' | 'not-detected'

export interface PoseLandmarkerConfig {
  wasmRoot: string
  modelAssetPath: string
  delegate: 'CPU' | 'GPU'
  numPoses: number
  minPoseDetectionConfidence: number
  minPosePresenceConfidence: number
  minTrackingConfidence: number
}

export interface PoseVisibilitySummary {
  averageVisibility: number
  minVisibility: number
  maxVisibility: number
  landmarkCount: number
}

export interface PoseInferenceResult {
  rawResult: PoseLandmarkerResult
  landmarks: NormalizedLandmark[][]
  worldLandmarks: Landmark[][]
  poseCount: number
  primaryLandmarks: NormalizedLandmark[] | null
  primaryWorldLandmarks: Landmark[] | null
  poseVisibility: PoseVisibilitySummary[]
  primaryPoseVisibility: PoseVisibilitySummary | null
  timestampMs: number
  videoTimeS: number
  inferenceDurationMs: number
}

export interface UsePoseLandmarkerOptions {
  videoRef: RefObject<HTMLVideoElement | null>
  enabled?: boolean
  autoStart?: boolean
  closeOnUnmount?: boolean
  targetFps?: number
  lostPersonThresholdMs?: number
  debug?: boolean
  config?: Partial<PoseLandmarkerConfig>
  onResults?: (result: PoseInferenceResult) => void
  onError?: (error: Error) => void
}

export interface UsePoseLandmarkerReturn {
  status: PoseHookStatus
  personStatus: PosePersonStatus
  lastPersonSeenAtMs: number | null
  error: Error | null
  result: PoseInferenceResult | null
  isRunning: boolean
  isInitializing: boolean
  start: () => Promise<void>
  stop: () => void
  initialize: () => Promise<void>
}
