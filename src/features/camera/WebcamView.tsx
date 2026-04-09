import { useCallback, useEffect, useMemo, useState } from 'react'
import './WebcamView.css'
import type { WebcamStatus, WebcamViewProps } from './types'

const STATUS_LABELS: Record<WebcamStatus, string> = {
  idle: 'Idle',
  requesting: 'Starting',
  ready: 'Live',
  error: 'Error',
  unsupported: 'Unsupported',
}

function getOverlayCopy(status: WebcamStatus) {
  switch (status) {
    case 'requesting':
      return {
        title: 'Starting camera',
        message:
          'Requesting webcam access and attaching the stream to the video element.',
      }
    case 'error':
      return {
        title: 'Camera unavailable',
        message:
          'The webcam could not be started. Review the error below and retry.',
      }
    case 'unsupported':
      return {
        title: 'Camera unsupported',
        message:
          'This browser does not support camera access through getUserMedia.',
      }
    case 'idle':
    default:
      return {
        title: 'Camera paused',
        message: 'Start the webcam when you are ready to begin pose detection.',
      }
  }
}

type FullscreenDocument = Document & {
  webkitExitFullscreen?: () => Promise<void> | void
  webkitFullscreenElement?: Element | null
  webkitFullscreenEnabled?: boolean
}

type FullscreenElement = HTMLDivElement & {
  webkitRequestFullscreen?: () => Promise<void> | void
}

function getActiveFullscreenElement(documentRef: FullscreenDocument) {
  return (
    documentRef.fullscreenElement ??
    documentRef.webkitFullscreenElement ??
    null
  )
}

function isFullscreenSupported(documentRef: FullscreenDocument) {
  return !!(
    documentRef.fullscreenEnabled || documentRef.webkitFullscreenEnabled
  )
}

function isFullscreenElementSupported(element: FullscreenElement | null) {
  if (!element) {
    return false
  }

  return !!(element.requestFullscreen || element.webkitRequestFullscreen)
}

async function enterFullscreen(element: FullscreenElement) {
  if (element.requestFullscreen) {
    await element.requestFullscreen()
    return
  }

  if (element.webkitRequestFullscreen) {
    await element.webkitRequestFullscreen()
    return
  }

  throw new Error('Fullscreen is not supported on this element.')
}

async function exitFullscreen(documentRef: FullscreenDocument) {
  if (documentRef.exitFullscreen) {
    await documentRef.exitFullscreen()
    return
  }

  if (documentRef.webkitExitFullscreen) {
    await documentRef.webkitExitFullscreen()
    return
  }

  throw new Error('Fullscreen exit is not supported in this browser.')
}

export function WebcamView({
  webcam,
  className,
  title = 'Webcam preview',
  description = 'This module owns the browser camera lifecycle and exposes refs for pose inference.',
  mirrored = webcam.facingMode === 'user',
  showControls = true,
  showStatus = true,
  children,
}: WebcamViewProps) {
  const overlayCopy = getOverlayCopy(webcam.status)
  const rootClassName = ['webcam-view', className].filter(Boolean).join(' ')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [fullscreenError, setFullscreenError] = useState<string | null>(null)
  const fullscreenAvailable = useMemo(() => {
    if (typeof document === 'undefined') {
      return false
    }

    const fullscreenDocument = document as FullscreenDocument
    const fullscreenElement = (
      webcam.containerRef.current ??
      document.documentElement
    ) as FullscreenElement

    return (
      isFullscreenSupported(fullscreenDocument) &&
      isFullscreenElementSupported(fullscreenElement)
    )
  }, [webcam.containerRef])

  useEffect(() => {
    if (typeof document === 'undefined') {
      return
    }

    const handleFullscreenChange = () => {
      setIsFullscreen(
        getActiveFullscreenElement(document as FullscreenDocument) ===
          webcam.containerRef.current,
      )
    }

    handleFullscreenChange()

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener(
      'webkitfullscreenchange',
      handleFullscreenChange as EventListener,
    )

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener(
        'webkitfullscreenchange',
        handleFullscreenChange as EventListener,
      )
    }
  }, [webcam.containerRef])

  const handleToggleFullscreen = useCallback(async () => {
    if (typeof document === 'undefined') {
      return
    }

    const containerElement = webcam.containerRef.current as FullscreenElement | null
    const fullscreenDocument = document as FullscreenDocument

    if (!containerElement || !isFullscreenSupported(fullscreenDocument)) {
      setFullscreenError('Fullscreen is not available in this browser.')
      return
    }

    try {
      setFullscreenError(null)

      if (getActiveFullscreenElement(fullscreenDocument) === containerElement) {
        await exitFullscreen(fullscreenDocument)
      } else {
        await enterFullscreen(containerElement)
      }
    } catch {
      setFullscreenError(
        'Fullscreen could not be started. Try again or use another browser.',
      )
    }
  }, [webcam.containerRef])

  return (
    <section className={rootClassName}>
      <header className="webcam-view__header">
        <div className="webcam-view__title-row">
          <h2 className="webcam-view__title">{title}</h2>
          {showStatus ? (
            <span
              className="webcam-view__badge"
              data-status={webcam.status}
              aria-live="polite"
            >
              {STATUS_LABELS[webcam.status]}
            </span>
          ) : null}
        </div>
        <p className="webcam-view__description">{description}</p>
      </header>

      <div
        ref={webcam.containerRef}
        className={[
          'webcam-view__stage',
          mirrored ? 'webcam-view__stage--mirrored' : '',
          isFullscreen ? 'webcam-view__stage--fullscreen' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {fullscreenAvailable ? (
          <button
            type="button"
            className="webcam-view__stage-control"
            onClick={() => void handleToggleFullscreen()}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          </button>
        ) : null}

        <video
          ref={webcam.videoRef}
          className="webcam-view__video"
          autoPlay
          muted
          playsInline
        />

        {children}

        {webcam.status !== 'ready' ? (
          <div className="webcam-view__overlay">
            <div className="webcam-view__overlay-card">
              <h3>{overlayCopy.title}</h3>
              <p>{webcam.error?.message ?? overlayCopy.message}</p>
            </div>
          </div>
        ) : null}
      </div>

      <footer className="webcam-view__toolbar">
        <p className="webcam-view__meta">
          Facing mode: <strong>{webcam.facingMode}</strong>
          {webcam.stream ? ' • stream attached' : ' • stream inactive'}
        </p>

        {showControls ? (
          <div className="webcam-view__actions">
            {fullscreenAvailable ? (
              <button
                type="button"
                className="webcam-view__button webcam-view__button--secondary"
                onClick={() => void handleToggleFullscreen()}
              >
                {isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
              </button>
            ) : null}

            {webcam.status === 'ready' ? (
              <button
                type="button"
                className="webcam-view__button webcam-view__button--secondary"
                onClick={webcam.stop}
              >
                Stop camera
              </button>
            ) : null}

            {webcam.status === 'idle' ? (
              <button
                type="button"
                className="webcam-view__button"
                onClick={() => void webcam.start()}
                disabled={webcam.isLoading}
              >
                Start camera
              </button>
            ) : null}

            {webcam.status === 'error' || webcam.status === 'unsupported' ? (
              <button
                type="button"
                className="webcam-view__button"
                onClick={() => void webcam.restart()}
                disabled={webcam.isLoading}
              >
                Retry camera
              </button>
            ) : null}
          </div>
        ) : null}
      </footer>

      {fullscreenError ? (
        <p className="webcam-view__fullscreen-note" role="status">
          {fullscreenError}
        </p>
      ) : null}
    </section>
  )
}
