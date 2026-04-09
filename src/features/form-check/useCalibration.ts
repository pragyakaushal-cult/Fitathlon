import { createSquatBaseline } from '@/features/analysis/frameMetrics'
import type { PoseLandmarksInput, SquatBaseline } from '@/features/analysis/types'
import { useCallback, useMemo, useState } from 'react'
import type { CalibrationState } from './types'

export interface UseCalibrationOptions {
  landmarks: PoseLandmarksInput | null | undefined
  averageVisibility: number | null
  minVisibility?: number
}

export interface UseCalibrationReturn extends CalibrationState {
  captureBaseline: () => boolean
  resetBaseline: () => void
}

const DEFAULT_MIN_VISIBILITY = 0.6

export function useCalibration({
  landmarks,
  averageVisibility,
  minVisibility = DEFAULT_MIN_VISIBILITY,
}: UseCalibrationOptions): UseCalibrationReturn {
  const [baseline, setBaseline] = useState<SquatBaseline | null>(null)
  const [capturedAtMs, setCapturedAtMs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const canCapture =
    !!landmarks &&
    landmarks.length > 0 &&
    averageVisibility !== null &&
    averageVisibility >= minVisibility

  const captureBaseline = useCallback(() => {
    const nextBaseline = createSquatBaseline(landmarks)

    if (!canCapture || !nextBaseline) {
      setError('Stand fully in frame and hold still before calibrating.')
      return false
    }

    setBaseline(nextBaseline)
    setCapturedAtMs(Date.now())
    setError(null)
    return true
  }, [canCapture, landmarks])

  const resetBaseline = useCallback(() => {
    setBaseline(null)
    setCapturedAtMs(null)
    setError(null)
  }, [])

  return useMemo(() => {
    if (baseline) {
      return {
        status: 'captured' as const,
        canCapture: true,
        baseline,
        capturedAtMs,
        message:
          'Standing baseline captured. You can start the 3-squat form check.',
        error: null,
        captureBaseline,
        resetBaseline,
      }
    }

    if (error) {
      return {
        status: 'error' as const,
        canCapture,
        baseline: null,
        capturedAtMs: null,
        message: error,
        error,
        captureBaseline,
        resetBaseline,
      }
    }

    if (canCapture) {
      return {
        status: 'ready' as const,
        canCapture: true,
        baseline: null,
        capturedAtMs: null,
        message:
          'Stand tall with your full body visible, then capture your baseline.',
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
      message:
        'Move into frame until your shoulders, hips, knees, and ankles are clearly visible.',
      error: null,
      captureBaseline,
      resetBaseline,
    }
  }, [
    baseline,
    canCapture,
    captureBaseline,
    capturedAtMs,
    error,
    resetBaseline,
  ])
}
