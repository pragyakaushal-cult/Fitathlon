import type { PostureWarningKey } from '@/features/analysis/feedback'
import type { SquatBaseline } from '@/features/analysis/types'

export type FormCheckStep =
  | 'intro'
  | 'camera-setup'
  | 'calibration'
  | 'assessment'
  | 'results'

export type CalibrationStatus =
  | 'idle'
  | 'stabilizing'
  | 'ready'
  | 'captured'
  | 'error'

export interface CalibrationState {
  status: CalibrationStatus
  canCapture: boolean
  baseline: SquatBaseline | null
  capturedAtMs: number | null
  progress: number
  message: string
  error: string | null
}

export interface AssessmentRepSummary {
  repNumber: number
  postureScore: number
  warningKeys: PostureWarningKey[]
  recommendations: string[]
  completedAtMs: number
}

export type AssessmentSessionStatus = 'idle' | 'running' | 'complete'

export type FatigueTrend = 'stable' | 'slight-drop' | 'moderate-drop'

export interface AssessmentResults {
  repsCompleted: number
  targetReps: number
  postureScore: number
  movementScore: number
  fatigueTrend: FatigueTrend
  topRecommendations: string[]
  repSummaries: AssessmentRepSummary[]
}

export interface AssessmentSessionState {
  status: AssessmentSessionStatus
  targetReps: number
  completedReps: number
  remainingReps: number
  repSummaries: AssessmentRepSummary[]
  results: AssessmentResults | null
  isComplete: boolean
  currentRepLowestScore: number | null
}
