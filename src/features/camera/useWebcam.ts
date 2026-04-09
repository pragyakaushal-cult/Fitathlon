import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createDebugLogger } from '@/lib/debug/logger'
import type {
  UseWebcamOptions,
  WebcamController,
  WebcamErrorState,
  WebcamStatus,
} from './types'

const DEFAULT_WIDTH = 1280
const DEFAULT_HEIGHT = 720

function createWebcamError(error: unknown): WebcamErrorState {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {
    return {
      code: 'UNSUPPORTED',
      message: 'This browser does not support webcam access.',
    }
  }

  if (!(error instanceof DOMException)) {
    return {
      code: 'UNKNOWN',
      message: 'Unable to start the webcam. Please try again.',
    }
  }

  switch (error.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return {
        code: 'PERMISSION_DENIED',
        name: error.name,
        message:
          'Camera permission was denied. Allow camera access in the browser and try again.',
      }
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return {
        code: 'DEVICE_NOT_FOUND',
        name: error.name,
        message: 'No camera was found on this device.',
      }
    case 'NotReadableError':
    case 'TrackStartError':
      return {
        code: 'DEVICE_IN_USE',
        name: error.name,
        message:
          'The camera is already in use by another application. Close it and retry.',
      }
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return {
        code: 'CONSTRAINTS_NOT_SATISFIED',
        name: error.name,
        message:
          'The requested camera settings are not available on this device.',
      }
    case 'AbortError':
      return {
        code: 'STREAM_START_FAILED',
        name: error.name,
        message: 'The camera started and then stopped unexpectedly.',
      }
    default:
      return {
        code: 'UNKNOWN',
        name: error.name,
        message: error.message || 'Unable to start the webcam.',
      }
  }
}

function stopMediaStream(stream: MediaStream | null) {
  if (!stream) {
    return
  }

  stream.getTracks().forEach((track) => {
    track.stop()
  })
}

export function useWebcam(options: UseWebcamOptions = {}): WebcamController {
  const {
    facingMode = 'user',
    autoStart = true,
    audio = false,
    preferredWidth = DEFAULT_WIDTH,
    preferredHeight = DEFAULT_HEIGHT,
    debug = false,
    onStreamStart,
    onStreamStop,
  } = options

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    !!navigator.mediaDevices.getUserMedia

  const [status, setStatus] = useState<WebcamStatus>(
    isSupported ? 'idle' : 'unsupported',
  )
  const [error, setError] = useState<WebcamErrorState | null>(null)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const mountedRef = useRef(true)
  const requestTokenRef = useRef(0)
  const activeStreamRef = useRef<MediaStream | null>(null)
  const pendingStartRef = useRef<Promise<void> | null>(null)
  const detachStreamListenersRef = useRef<(() => void) | null>(null)
  const logDebug = useMemo(() => createDebugLogger('webcam', debug), [debug])

  const clearVideoElement = useCallback(() => {
    const videoElement = videoRef.current

    if (!videoElement) {
      return
    }

    videoElement.pause()
    videoElement.srcObject = null
  }, [])

  const releaseStream = useCallback(
    (notifyStreamStop: boolean) => {
      detachStreamListenersRef.current?.()
      detachStreamListenersRef.current = null

      if (activeStreamRef.current) {
        stopMediaStream(activeStreamRef.current)
        activeStreamRef.current = null
        setStream(null)
        logDebug('stream_released', { notifyStreamStop })

        if (notifyStreamStop) {
          onStreamStop?.()
        }
      }

      clearVideoElement()
    },
    [clearVideoElement, logDebug, onStreamStop],
  )

  const attachStreamToVideo = useCallback(async (nextStream: MediaStream) => {
    const videoElement = videoRef.current

    if (!videoElement) {
      return
    }

    videoElement.srcObject = nextStream
    videoElement.muted = true
    videoElement.playsInline = true

    try {
      await videoElement.play()
    } catch {
      // Browsers sometimes delay autoplay until metadata is ready. The stream is still attached.
    }
  }, [])

  const attachStreamListeners = useCallback(
    (nextStream: MediaStream, requestToken: number) => {
      const handleUnexpectedEnd = (reason: string) => {
        if (!mountedRef.current || requestToken !== requestTokenRef.current) {
          return
        }

        logDebug('stream_unexpected_end', { reason })
        releaseStream(false)
        setError({
          code: 'STREAM_START_FAILED',
          message:
            'Camera stream ended unexpectedly. Check camera permissions or connection and retry.',
        })
        setStatus('error')
      }

      const videoTracks = nextStream.getVideoTracks()
      const onTrackEnded = () => {
        handleUnexpectedEnd('video_track_ended')
      }
      const onStreamInactive = () => {
        handleUnexpectedEnd('stream_inactive')
      }

      videoTracks.forEach((track) => {
        track.addEventListener('ended', onTrackEnded)
      })
      nextStream.addEventListener('inactive', onStreamInactive)

      detachStreamListenersRef.current = () => {
        videoTracks.forEach((track) => {
          track.removeEventListener('ended', onTrackEnded)
        })
        nextStream.removeEventListener('inactive', onStreamInactive)
      }
    },
    [logDebug, releaseStream],
  )

  const start = useCallback(async () => {
    if (!isSupported) {
      setStatus('unsupported')
      setError(createWebcamError(null))
      return
    }

    if (pendingStartRef.current) {
      return pendingStartRef.current
    }

    const requestToken = requestTokenRef.current + 1
    requestTokenRef.current = requestToken

    const pendingStart = (async () => {
      setStatus('requesting')
      setError(null)
      releaseStream(false)

      try {
        const nextStream = await navigator.mediaDevices.getUserMedia({
          audio,
          video: {
            width: { ideal: preferredWidth },
            height: { ideal: preferredHeight },
            facingMode: { ideal: facingMode },
          },
        })

        if (!mountedRef.current || requestToken !== requestTokenRef.current) {
          stopMediaStream(nextStream)
          return
        }

        activeStreamRef.current = nextStream
        setStream(nextStream)
        attachStreamListeners(nextStream, requestToken)
        await attachStreamToVideo(nextStream)
        setStatus('ready')
        logDebug('stream_started', {
          facingMode,
          preferredWidth,
          preferredHeight,
        })
        onStreamStart?.(nextStream)
      } catch (unknownError) {
        if (!mountedRef.current || requestToken !== requestTokenRef.current) {
          return
        }

        releaseStream(false)

        const nextError = createWebcamError(unknownError)
        setError(nextError)
        setStatus(nextError.code === 'UNSUPPORTED' ? 'unsupported' : 'error')
        logDebug('stream_start_failed', nextError)
      }
    })()

    pendingStartRef.current = pendingStart.finally(() => {
      pendingStartRef.current = null
    })

    return pendingStartRef.current
  }, [
    attachStreamListeners,
    attachStreamToVideo,
    audio,
    facingMode,
    isSupported,
    logDebug,
    onStreamStart,
    preferredHeight,
    preferredWidth,
    releaseStream,
  ])

  const stop = useCallback(() => {
    requestTokenRef.current += 1
    releaseStream(true)
    setError(null)
    setStatus(isSupported ? 'idle' : 'unsupported')
    logDebug('stream_stopped_by_user')
  }, [isSupported, logDebug, releaseStream])

  const restart = useCallback(async () => {
    requestTokenRef.current += 1
    releaseStream(false)
    setStatus(isSupported ? 'idle' : 'unsupported')
    logDebug('stream_restart_requested')
    await start()
  }, [isSupported, logDebug, releaseStream, start])

  useEffect(() => {
    mountedRef.current = true
    let autoStartTimer: number | null = null

    if (autoStart) {
      autoStartTimer = window.setTimeout(() => {
        void start()
      }, 0)
    }

    return () => {
      if (autoStartTimer !== null) {
        window.clearTimeout(autoStartTimer)
      }

      mountedRef.current = false
      requestTokenRef.current += 1
      releaseStream(false)
    }
  }, [autoStart, releaseStream, start])

  useEffect(() => {
    if (status !== 'ready' || !stream) {
      return
    }

    void attachStreamToVideo(stream)
  }, [attachStreamToVideo, status, stream])

  return useMemo(
    () => ({
      status,
      error,
      isLoading: status === 'requesting',
      isSupported,
      stream,
      facingMode,
      videoRef,
      containerRef,
      start,
      stop,
      restart,
    }),
    [error, facingMode, isSupported, restart, start, status, stop, stream],
  )
}
