import { createSquatBaseline } from '@/features/analysis/frameMetrics'
import {
  angleBetweenThreePoints,
  distanceBetweenPoints,
  mapSquatLandmarks,
  midpoint,
  toPoint2D,
  torsoLeanRelativeToVertical,
} from '@/features/analysis/geometry'
import type {
  Point2D,
  PoseLandmarksInput,
  SquatBaseline,
} from '@/features/analysis/types'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CalibrationState } from './types'

export interface UseCalibrationOptions {
  enabled?: boolean
  landmarks: PoseLandmarksInput | null | undefined
  averageVisibility: number | null
  timestampMs?: number | null
  minVisibility?: number
}

export interface UseCalibrationReturn extends CalibrationState {
  captureBaseline: () => boolean
  resetBaseline: () => void
}

const DEFAULT_MIN_VISIBILITY = 0.6
const AUTO_CAPTURE_HOLD_MS = 1000
const READY_PROGRESS = 0.35
const MAX_MOVEMENT_DELTA_NORMALIZED = 0.04
const FRAME_RESET_GAP_MS = 500
const FRAME_MARGIN = 0.03
const MIN_BODY_HEIGHT_NORMALIZED = 0.26
const MIN_STANDING_KNEE_ANGLE_DEG = 142
const MAX_TORSO_LEAN_DEG = 22
const SAMPLE_WINDOW_LIMIT = 48

interface CalibrationSnapshot {
  baselineCandidate: SquatBaseline
  hipCenter: Point2D
  shoulderCenter: Point2D
  ankleCenter: Point2D
  guidance: string
  isFrameEligible: boolean
}

interface StabilityWindow {
  lastAnkleCenter: Point2D | null
  lastHipCenter: Point2D | null
  lastShoulderCenter: Point2D | null
  lastTimestampMs: number | null
  samples: SquatBaseline[]
  startedAtMs: number | null
}

function createStabilityWindow(): StabilityWindow {
  return {
    lastAnkleCenter: null,
    lastHipCenter: null,
    lastShoulderCenter: null,
    lastTimestampMs: null,
    samples: [],
    startedAtMs: null,
  }
}

function isLandmarkInFrame(
  x: number | undefined,
  y: number | undefined,
  frameMargin = FRAME_MARGIN,
) {
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    !Number.isFinite(x) ||
    !Number.isFinite(y)
  ) {
    return false
  }

  return (
    x >= frameMargin &&
    x <= 1 - frameMargin &&
    y >= frameMargin &&
    y <= 1 - frameMargin
  )
}

function averageBaselineSamples(samples: SquatBaseline[]) {
  if (samples.length === 0) {
    return null
  }

  const total = samples.reduce(
    (accumulator, sample) => ({
      standingHipCenterY:
        accumulator.standingHipCenterY + sample.standingHipCenterY,
      standingShoulderCenterY:
        accumulator.standingShoulderCenterY + sample.standingShoulderCenterY,
      torsoLength: accumulator.torsoLength + sample.torsoLength,
      hipToAnkleLength:
        accumulator.hipToAnkleLength + sample.hipToAnkleLength,
    }),
    {
      standingHipCenterY: 0,
      standingShoulderCenterY: 0,
      torsoLength: 0,
      hipToAnkleLength: 0,
    },
  )

  return {
    standingHipCenterY: total.standingHipCenterY / samples.length,
    standingShoulderCenterY: total.standingShoulderCenterY / samples.length,
    torsoLength: total.torsoLength / samples.length,
    hipToAnkleLength: total.hipToAnkleLength / samples.length,
  }
}

function getMovementDeltaNormalized(
  currentSnapshot: CalibrationSnapshot,
  stabilityWindow: StabilityWindow,
) {
  const bodyScale = Math.max(
    distanceBetweenPoints(
      currentSnapshot.hipCenter,
      currentSnapshot.shoulderCenter,
    ) ?? 0,
    distanceBetweenPoints(currentSnapshot.hipCenter, currentSnapshot.ankleCenter) ??
      0,
    0.0001,
  )

  return Math.max(
    (distanceBetweenPoints(
      currentSnapshot.hipCenter,
      stabilityWindow.lastHipCenter,
    ) ?? 0) / bodyScale,
    (distanceBetweenPoints(
      currentSnapshot.shoulderCenter,
      stabilityWindow.lastShoulderCenter,
    ) ?? 0) / bodyScale,
    (distanceBetweenPoints(
      currentSnapshot.ankleCenter,
      stabilityWindow.lastAnkleCenter,
    ) ?? 0) / bodyScale,
  )
}

function buildCalibrationSnapshot(
  landmarks: PoseLandmarksInput | null | undefined,
  averageVisibility: number | null,
  minVisibility: number,
): CalibrationSnapshot | null {
  if (!landmarks || landmarks.length === 0) {
    return null
  }

  const baselineCandidate = createSquatBaseline(landmarks)

  if (!baselineCandidate) {
    return null
  }

  const mappedLandmarks = mapSquatLandmarks(landmarks)
  const trackedLandmarks = [
    mappedLandmarks.leftShoulder,
    mappedLandmarks.rightShoulder,
    mappedLandmarks.leftHip,
    mappedLandmarks.rightHip,
    mappedLandmarks.leftKnee,
    mappedLandmarks.rightKnee,
    mappedLandmarks.leftAnkle,
    mappedLandmarks.rightAnkle,
  ]

  const requiredLandmarksVisible = trackedLandmarks.every(
    (landmark) =>
      !!landmark &&
      Number.isFinite(landmark.visibility) &&
      (landmark.visibility ?? 0) >= minVisibility - 0.05,
  )

  if (
    averageVisibility === null ||
    averageVisibility < minVisibility ||
    !requiredLandmarksVisible
  ) {
    return {
      baselineCandidate,
      hipCenter: midpoint(
        toPoint2D(mappedLandmarks.leftHip),
        toPoint2D(mappedLandmarks.rightHip),
      ) ?? { x: 0, y: 0 },
      shoulderCenter: midpoint(
        toPoint2D(mappedLandmarks.leftShoulder),
        toPoint2D(mappedLandmarks.rightShoulder),
      ) ?? { x: 0, y: 0 },
      ankleCenter: midpoint(
        toPoint2D(mappedLandmarks.leftAnkle),
        toPoint2D(mappedLandmarks.rightAnkle),
      ) ?? { x: 0, y: 0 },
      guidance:
        'Step back until both shoulders, hips, knees, and ankles are clearly visible.',
      isFrameEligible: false,
    }
  }

  const hipCenter = midpoint(
    toPoint2D(mappedLandmarks.leftHip),
    toPoint2D(mappedLandmarks.rightHip),
  )
  const shoulderCenter = midpoint(
    toPoint2D(mappedLandmarks.leftShoulder),
    toPoint2D(mappedLandmarks.rightShoulder),
  )
  const ankleCenter = midpoint(
    toPoint2D(mappedLandmarks.leftAnkle),
    toPoint2D(mappedLandmarks.rightAnkle),
  )
  const leftHip = toPoint2D(mappedLandmarks.leftHip)
  const rightHip = toPoint2D(mappedLandmarks.rightHip)
  const leftKnee = toPoint2D(mappedLandmarks.leftKnee)
  const rightKnee = toPoint2D(mappedLandmarks.rightKnee)
  const leftAnkle = toPoint2D(mappedLandmarks.leftAnkle)
  const rightAnkle = toPoint2D(mappedLandmarks.rightAnkle)

  if (!hipCenter || !shoulderCenter || !ankleCenter) {
    return null
  }

  const requiredLandmarksInFrame = trackedLandmarks.every((landmark) =>
    isLandmarkInFrame(landmark?.x, landmark?.y),
  )

  if (!requiredLandmarksInFrame) {
    return {
      baselineCandidate,
      hipCenter,
      shoulderCenter,
      ankleCenter,
      guidance: 'Fit your full body inside the frame before calibration can lock.',
      isFrameEligible: false,
    }
  }

  const bodyHeightNormalized = Math.abs(ankleCenter.y - shoulderCenter.y)

  if (bodyHeightNormalized < MIN_BODY_HEIGHT_NORMALIZED) {
    return {
      baselineCandidate,
      hipCenter,
      shoulderCenter,
      ankleCenter,
      guidance:
        'Move a little closer so the body baseline has enough detail to lock cleanly.',
      isFrameEligible: false,
    }
  }

  const leftKneeAngleDeg = angleBetweenThreePoints(leftHip, leftKnee, leftAnkle)
  const rightKneeAngleDeg = angleBetweenThreePoints(
    rightHip,
    rightKnee,
    rightAnkle,
  )
  const validKneeAngles = [leftKneeAngleDeg, rightKneeAngleDeg].filter(
    (angle): angle is number => angle !== null && Number.isFinite(angle),
  )
  const minKneeAngleDeg =
    validKneeAngles.length > 0 ? Math.min(...validKneeAngles) : null
  const torsoLeanDeg = torsoLeanRelativeToVertical(hipCenter, shoulderCenter)

  if (
    torsoLeanDeg === null ||
    torsoLeanDeg > MAX_TORSO_LEAN_DEG ||
    minKneeAngleDeg === null ||
    minKneeAngleDeg < MIN_STANDING_KNEE_ANGLE_DEG
  ) {
    return {
      baselineCandidate,
      hipCenter,
      shoulderCenter,
      ankleCenter,
      guidance:
        'Stand tall in a neutral pose with your torso upright and knees extended before calibration starts.',
      isFrameEligible: false,
    }
  }

  return {
    baselineCandidate,
    hipCenter,
    shoulderCenter,
    ankleCenter,
    guidance: 'Full body found. Hold still while calibration locks in.',
    isFrameEligible: true,
  }
}

export function useCalibration({
  enabled = true,
  landmarks,
  averageVisibility,
  timestampMs = null,
  minVisibility = DEFAULT_MIN_VISIBILITY,
}: UseCalibrationOptions): UseCalibrationReturn {
  const [baseline, setBaseline] = useState<SquatBaseline | null>(null)
  const [capturedAtMs, setCapturedAtMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const stabilityWindowRef = useRef<StabilityWindow>(createStabilityWindow())

  const snapshot = useMemo(
    () => buildCalibrationSnapshot(landmarks, averageVisibility, minVisibility),
    [averageVisibility, landmarks, minVisibility],
  )

  const commitBaseline = useCallback((nextBaseline: SquatBaseline) => {
    setBaseline(nextBaseline)
    setCapturedAtMs(Date.now())
    setProgress(1)
    setError(null)
  }, [])

  const scheduleProgressUpdate = useCallback((nextProgress: number) => {
    queueMicrotask(() => {
      setProgress((currentProgress) =>
        currentProgress === nextProgress ? currentProgress : nextProgress,
      )
    })
  }, [])

  const scheduleErrorClear = useCallback(() => {
    queueMicrotask(() => {
      setError((currentError) => (currentError === null ? currentError : null))
    })
  }, [])

  const captureBaseline = useCallback(() => {
    if (!snapshot?.isFrameEligible) {
      setError(
        snapshot?.guidance ??
          'Stand fully in frame and keep a neutral posture before calibrating.',
      )
      return false
    }

    const nextBaseline =
      averageBaselineSamples(stabilityWindowRef.current.samples) ??
      snapshot.baselineCandidate

    if (!nextBaseline) {
      setError('Calibration data is still settling. Hold still and try again.')
      return false
    }

    commitBaseline(nextBaseline)
    return true
  }, [commitBaseline, snapshot])

  const resetBaseline = useCallback(() => {
    setBaseline(null)
    setCapturedAtMs(null)
    setError(null)
    setProgress(0)
    stabilityWindowRef.current = createStabilityWindow()
  }, [])

  useEffect(() => {
    if (baseline || !enabled) {
      stabilityWindowRef.current = createStabilityWindow()

      return
    }

    if (!timestampMs || !snapshot?.isFrameEligible) {
      stabilityWindowRef.current = createStabilityWindow()
      scheduleProgressUpdate(0)
      return
    }

    const nextStabilityWindow = stabilityWindowRef.current

    if (error) {
      scheduleErrorClear()
    }

    const shouldRestartWindow =
      nextStabilityWindow.lastTimestampMs === null ||
      nextStabilityWindow.startedAtMs === null ||
      timestampMs - nextStabilityWindow.lastTimestampMs > FRAME_RESET_GAP_MS ||
      getMovementDeltaNormalized(snapshot, nextStabilityWindow) >
        MAX_MOVEMENT_DELTA_NORMALIZED

    if (shouldRestartWindow) {
      nextStabilityWindow.startedAtMs = timestampMs
      nextStabilityWindow.samples = [snapshot.baselineCandidate]
      scheduleProgressUpdate(0)
    } else {
      nextStabilityWindow.samples.push(snapshot.baselineCandidate)

      if (nextStabilityWindow.samples.length > SAMPLE_WINDOW_LIMIT) {
        nextStabilityWindow.samples.shift()
      }

      const startedAtMs = nextStabilityWindow.startedAtMs ?? timestampMs

      const nextProgress = Math.min(
        1,
        (timestampMs - startedAtMs) / AUTO_CAPTURE_HOLD_MS,
      )

      scheduleProgressUpdate(nextProgress)

      if (nextProgress >= 1) {
        const averagedBaseline = averageBaselineSamples(
          nextStabilityWindow.samples,
        )

        if (averagedBaseline) {
          commitBaseline(averagedBaseline)
        }
      }
    }

    nextStabilityWindow.lastTimestampMs = timestampMs
    nextStabilityWindow.lastHipCenter = snapshot.hipCenter
    nextStabilityWindow.lastShoulderCenter = snapshot.shoulderCenter
    nextStabilityWindow.lastAnkleCenter = snapshot.ankleCenter
  }, [
    baseline,
    commitBaseline,
    enabled,
    error,
    scheduleErrorClear,
    scheduleProgressUpdate,
    snapshot,
    timestampMs,
  ])

  return useMemo(() => {
    if (baseline) {
      return {
        status: 'captured' as const,
        canCapture: true,
        baseline,
        capturedAtMs,
        progress: 1,
        message:
          'Body calibration locked. You can now unlock workout selection and continue.',
        error: null,
        captureBaseline,
        resetBaseline,
      }
    }

    if (error) {
      return {
        status: 'error' as const,
        canCapture: !!snapshot?.isFrameEligible,
        baseline: null,
        capturedAtMs: null,
        progress,
        message: error,
        error,
        captureBaseline,
        resetBaseline,
      }
    }

    if (!enabled) {
      return {
        status: 'idle' as const,
        canCapture: false,
        baseline: null,
        capturedAtMs: null,
        progress: 0,
        message:
          'Open calibration to capture a standing body baseline before choosing a workout.',
        error: null,
        captureBaseline,
        resetBaseline,
      }
    }

    if (snapshot?.isFrameEligible) {
      const remainingMs = Math.max(0, AUTO_CAPTURE_HOLD_MS - progress * AUTO_CAPTURE_HOLD_MS)
      const remainingSeconds = Math.max(1, Math.ceil(remainingMs / 1000))

      return {
        status:
          progress >= READY_PROGRESS ? ('ready' as const) : ('stabilizing' as const),
        canCapture: true,
        baseline: null,
        capturedAtMs: null,
        progress,
        message:
          progress >= READY_PROGRESS
            ? `Hold steady. Auto-capture will finish in about ${remainingSeconds} second${remainingSeconds === 1 ? '' : 's'}, or tap capture now.`
            : 'Hold still for a brief moment. If framing already looks correct, you can tap capture now.',
        error: null,
        captureBaseline,
        resetBaseline,
      }
    }

    return {
      status: 'idle' as const,
      canCapture: false,
      baseline: null,
      capturedAtMs: null,
      progress: 0,
      message:
        snapshot?.guidance ??
        'Move into frame until your shoulders, hips, knees, and ankles are clearly visible.',
      error: null,
      captureBaseline,
      resetBaseline,
    }
  }, [
    baseline,
    captureBaseline,
    capturedAtMs,
    enabled,
    error,
    progress,
    resetBaseline,
    snapshot,
  ])
}
