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
        ]
          .filter(Boolean)
          .join(' ')}
      >
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
    </section>
  )
}
