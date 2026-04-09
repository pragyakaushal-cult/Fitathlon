import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export interface Point2D {
  x: number
  y: number
}

export interface LandmarkLike extends Point2D {
  z?: number
  visibility?: number
}

export interface NamedSquatLandmarks {
  leftShoulder: LandmarkLike | null
  rightShoulder: LandmarkLike | null
  leftElbow: LandmarkLike | null
  rightElbow: LandmarkLike | null
  leftWrist: LandmarkLike | null
  rightWrist: LandmarkLike | null
  leftHip: LandmarkLike | null
  rightHip: LandmarkLike | null
  leftKnee: LandmarkLike | null
  rightKnee: LandmarkLike | null
  leftAnkle: LandmarkLike | null
  rightAnkle: LandmarkLike | null
}

export interface SquatBaseline {
  standingHipCenterY: number
  standingShoulderCenterY: number
  torsoLength: number
  hipToAnkleLength: number
}

export interface FrameMetrics {
  timestampMs: number
  poseDetected: boolean
  averageVisibility: number | null
  leftKneeAngleDeg: number | null
  rightKneeAngleDeg: number | null
  averageKneeAngleDeg: number | null
  minKneeAngleDeg: number | null
  leftElbowAngleDeg: number | null
  rightElbowAngleDeg: number | null
  averageElbowAngleDeg: number | null
  elbowSymmetryScore: number | null
  torsoLeanDeg: number | null
  bodyLineAngleDeg: number | null
  bodyLineOffsetNormalized: number | null
  hipDepthPx: number | null
  hipDepthNormalized: number | null
  symmetryScore: number | null
  hipCenter: Point2D | null
  shoulderCenter: Point2D | null
  ankleCenter: Point2D | null
}

export interface SmoothingBuffer {
  readonly windowSize: number
  values: number[]
}

export type PoseLandmarksInput = NormalizedLandmark[] | LandmarkLike[]
