import { PoseLandmarker } from '@mediapipe/tasks-vision'

export interface PoseConnector {
  start: number
  end: number
}

export const POSE_CONNECTIONS: PoseConnector[] =
  PoseLandmarker.POSE_CONNECTIONS.map((connection) => ({
    start: connection.start,
    end: connection.end,
  }))

export const POSE_VISIBILITY_THRESHOLD = 0.35

export const POSE_DRAW_STYLE = {
  connectorColor: 'rgba(56, 189, 248, 0.9)',
  connectorWidth: 3,
  landmarkFill: 'rgba(248, 250, 252, 0.95)',
  landmarkStroke: 'rgba(14, 165, 233, 0.95)',
  landmarkStrokeWidth: 2,
  landmarkRadius: 4,
} as const
