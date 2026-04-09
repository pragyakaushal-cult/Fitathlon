import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { poseLandmarkerService } from './poseLandmarkerService'
import { createDebugLogger } from '@/lib/debug/logger'
import type {
  PoseInferenceResult,
  PoseHookStatus,
  PosePersonStatus,
  UsePoseLandmarkerOptions,
  UsePoseLandmarkerReturn,
} from './types'

function toError(error: unknown) {
  if (error instanceof Error) {
    return error
  }

  return new Error('Pose detection failed.')
}

export function usePoseLandmarker(
  options: UsePoseLandmarkerOptions,
): UsePoseLandmarkerReturn {
  const {
    videoRef,
    enabled = true,
    autoStart = true,
    closeOnUnmount = true,
    targetFps = 24,
    lostPersonThresholdMs = 1200,
    debug = false,
    config,
    onResults,
    onError,
  } = options

  const [status, setStatus] = useState<PoseHookStatus>('idle')
  const [personStatus, setPersonStatus] =
    useState<PosePersonStatus>('not-detected')
  const [lastPersonSeenAtMs, setLastPersonSeenAtMs] = useState<number | null>(
    null,
  )
  const [error, setError] = useState<Error | null>(null)
  const [result, setResult] = useState<PoseInferenceResult | null>(null)

  const animationFrameIdRef = useRef<number | null>(null)
  const isRunningRef = useRef(false)
  const isProcessingRef = useRef(false)
  const hasInitializedRef = useRef(false)
  const lastVideoTimeRef = useRef(-1)
  const lastInferenceStartedAtMsRef = useRef(0)
  const lastInferenceTimestampMsRef = useRef(0)
  const lastPersonStatusRef = useRef<PosePersonStatus>('not-detected')
  const lastPersonSeenAtMsRef = useRef<number | null>(null)
  const configRef = useRef(config)
  const onResultsRef = useRef(onResults)
  const onErrorRef = useRef(onError)
  const targetFpsRef = useRef(targetFps)
  const lostPersonThresholdMsRef = useRef(lostPersonThresholdMs)

  configRef.current = config
  onResultsRef.current = onResults
  onErrorRef.current = onError
  targetFpsRef.current = targetFps
  lostPersonThresholdMsRef.current = lostPersonThresholdMs
  const logDebug = useMemo(() => createDebugLogger('pose', debug), [debug])

  const updatePersonStatus = useCallback(
    (nextStatus: PosePersonStatus, timestampMs: number | null) => {
      if (lastPersonStatusRef.current !== nextStatus) {
        lastPersonStatusRef.current = nextStatus
        setPersonStatus(nextStatus)
        logDebug('person_status_changed', { nextStatus, timestampMs })
      }
    },
    [logDebug],
  )

  const cleanupLoop = useCallback(() => {
    isRunningRef.current = false
    isProcessingRef.current = false
    lastVideoTimeRef.current = -1

    if (animationFrameIdRef.current !== null) {
      window.cancelAnimationFrame(animationFrameIdRef.current)
      animationFrameIdRef.current = null
    }
  }, [])

  const getNextInferenceTimestampMs = useCallback(() => {
    // MediaPipe video graphs require strictly increasing timestamps for every
    // detectForVideo call. `video.currentTime` can restart from zero after a
    // stream reset and can also lag behind an earlier `performance.now()`-based
    // timestamp, so the graph must use a single monotonic clock source.
    const nextTimestampMs = Math.max(
      performance.now(),
      lastInferenceTimestampMsRef.current + 1,
    )

    lastInferenceTimestampMsRef.current = nextTimestampMs

    return nextTimestampMs
  }, [])

  const detectNextFrame = useCallback(async () => {
    if (!isRunningRef.current || !enabled) {
      return
    }

    const videoElement = videoRef.current

    if (!videoElement) {
      animationFrameIdRef.current = window.requestAnimationFrame(() => {
        void detectNextFrame()
      })
      return
    }

    if (document.hidden) {
      animationFrameIdRef.current = window.requestAnimationFrame(() => {
        void detectNextFrame()
      })
      return
    }

    if (
      videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA ||
      videoElement.paused ||
      videoElement.ended
    ) {
      animationFrameIdRef.current = window.requestAnimationFrame(() => {
        void detectNextFrame()
      })
      return
    }

    if (isProcessingRef.current) {
      animationFrameIdRef.current = window.requestAnimationFrame(() => {
        void detectNextFrame()
      })
      return
    }

    if (videoElement.currentTime === lastVideoTimeRef.current) {
      animationFrameIdRef.current = window.requestAnimationFrame(() => {
        void detectNextFrame()
      })
      return
    }

    const nowMs = performance.now()
    const minIntervalMs =
      targetFpsRef.current > 0 ? 1000 / targetFpsRef.current : 0

    if (minIntervalMs > 0 && nowMs - lastInferenceStartedAtMsRef.current < minIntervalMs) {
      animationFrameIdRef.current = window.requestAnimationFrame(() => {
        void detectNextFrame()
      })
      return
    }

    isProcessingRef.current = true
    lastInferenceStartedAtMsRef.current = nowMs

    try {
      const timestampMs = getNextInferenceTimestampMs()
      const nextResult = await poseLandmarkerService.detectForVideo(
        videoElement,
        timestampMs,
        configRef.current,
      )

      if (!isRunningRef.current) {
        return
      }

      lastVideoTimeRef.current = videoElement.currentTime
      const poseDetected = nextResult.poseCount > 0
      const personSeenAtMs = poseDetected ? timestampMs : lastPersonSeenAtMsRef.current

      if (poseDetected) {
        lastPersonSeenAtMsRef.current = timestampMs
      }

      let nextPersonStatus: PosePersonStatus = 'not-detected'

      if (poseDetected) {
        nextPersonStatus = 'detected'
      } else if (
        personSeenAtMs !== null &&
        timestampMs - personSeenAtMs >= lostPersonThresholdMsRef.current
      ) {
        nextPersonStatus = 'lost'
      }

      updatePersonStatus(nextPersonStatus, personSeenAtMs)

      startTransition(() => {
        setResult(nextResult)
        setError(null)
        setStatus('running')
        setLastPersonSeenAtMs(personSeenAtMs)
      })
      onResultsRef.current?.(nextResult)
    } catch (unknownError) {
      const nextError = toError(unknownError)
      cleanupLoop()
      startTransition(() => {
        setError(nextError)
        setStatus('error')
      })
      logDebug('inference_error', nextError)
      onErrorRef.current?.(nextError)
      return
    } finally {
      isProcessingRef.current = false
    }

    animationFrameIdRef.current = window.requestAnimationFrame(() => {
      void detectNextFrame()
    })
  }, [
    cleanupLoop,
    enabled,
    getNextInferenceTimestampMs,
    logDebug,
    updatePersonStatus,
    videoRef,
  ])

  const initialize = useCallback(async () => {
    setError(null)
    setStatus('initializing')

    try {
      await poseLandmarkerService.initialize(configRef.current)
      hasInitializedRef.current = true
      setStatus(isRunningRef.current ? 'running' : 'stopped')
      logDebug('landmarker_initialized')
    } catch (unknownError) {
      const nextError = toError(unknownError)
      setError(nextError)
      setStatus('error')
      logDebug('landmarker_initialize_failed', nextError)
      onErrorRef.current?.(nextError)
      throw nextError
    }
  }, [logDebug])

  const start = useCallback(async () => {
    if (!enabled) {
      return
    }

    if (isRunningRef.current) {
      return
    }

    await initialize()

    isRunningRef.current = true
    lastVideoTimeRef.current = -1
    lastInferenceStartedAtMsRef.current = 0
    setStatus('running')
    logDebug('inference_started', { targetFps: targetFpsRef.current })
    void detectNextFrame()
  }, [detectNextFrame, enabled, initialize, logDebug])

  const stop = useCallback(() => {
    cleanupLoop()
    updatePersonStatus('not-detected', null)
    setLastPersonSeenAtMs(null)
    setStatus(hasInitializedRef.current ? 'stopped' : 'idle')
    logDebug('inference_stopped')
  }, [cleanupLoop, logDebug, updatePersonStatus])

  useEffect(() => {
    if (!enabled) {
      const stopTimer = window.setTimeout(() => {
        stop()
      }, 0)

      return () => {
        window.clearTimeout(stopTimer)
      }
    }

    if (!autoStart) {
      return
    }

    const startTimer = window.setTimeout(() => {
      void start()
    }, 0)

    return () => {
      window.clearTimeout(startTimer)
      cleanupLoop()
    }
  }, [autoStart, cleanupLoop, enabled, start, stop])

  useEffect(() => {
    return () => {
      cleanupLoop()

      if (closeOnUnmount) {
        poseLandmarkerService.close()
        logDebug('landmarker_closed_on_unmount')
      }
    }
  }, [cleanupLoop, closeOnUnmount, logDebug])

  return useMemo(
    () => ({
      status,
      personStatus,
      lastPersonSeenAtMs,
      error,
      result,
      isRunning: status === 'running',
      isInitializing: status === 'initializing',
      start,
      stop,
      initialize,
    }),
    [
      error,
      initialize,
      lastPersonSeenAtMs,
      personStatus,
      result,
      start,
      status,
      stop,
    ],
  )
}
