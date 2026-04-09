import { buildPostureFeedback } from '@/features/analysis/feedback'
import { createFrameMetrics } from '@/features/analysis/frameMetrics'
import { useRepDetection } from '@/features/analysis/useRepDetection'
import { WebcamView } from '@/features/camera/WebcamView'
import { useWebcam } from '@/features/camera/useWebcam'
import { PoseCanvasOverlay } from '@/features/pose/PoseCanvasOverlay'
import { usePoseLandmarker } from '@/features/pose/usePoseLandmarker'
import { ResultsScreen } from '@/features/results/ResultsScreen'
import { useEffect, useMemo, useState } from 'react'
import './FormCheckFlow.css'
import type { FormCheckStep } from './types'
import { useAssessmentSession } from './useAssessmentSession'
import { useCalibration } from './useCalibration'

const FLOW_STEPS: Array<{ key: FormCheckStep; label: string }> = [
  { key: 'intro', label: 'Intro' },
  { key: 'camera-setup', label: 'Camera Setup' },
  { key: 'calibration', label: 'Calibration' },
  { key: 'assessment', label: '3 Squats' },
  { key: 'results', label: 'Results' },
]

function Stepper({ currentStep }: { currentStep: FormCheckStep }) {
  const currentIndex = FLOW_STEPS.findIndex((step) => step.key === currentStep)

  return (
    <div className="form-flow__stepper" aria-label="form check steps">
      {FLOW_STEPS.map((step, index) => {
        const isComplete = index < currentIndex
        const isActive = index === currentIndex

        return (
          <div
            key={step.key}
            className={[
              'form-flow__step',
              isComplete ? 'form-flow__step--complete' : '',
              isActive ? 'form-flow__step--active' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            <span className="form-flow__step-index">{index + 1}</span>
            <span>{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function InfoCard({
  label,
  title,
  description,
  actions,
}: {
  label: string
  title: string
  description: string
  actions?: React.ReactNode
}) {
  return (
    <article className="card">
      <div className="card-header">
        <p className="section-label">{label}</p>
        <h2>{title}</h2>
      </div>
      <p className="form-flow__copy">{description}</p>
      {actions ? <div className="form-flow__actions">{actions}</div> : null}
    </article>
  )
}

export function FormCheckFlow() {
  const [step, setStep] = useState<FormCheckStep>('intro')
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return new URLSearchParams(window.location.search).has('debug')
  }, [])

  const webcam = useWebcam({
    facingMode: 'user',
    autoStart: true,
    preferredWidth: 1280,
    preferredHeight: 720,
    debug: debugMode,
  })
  const pose = usePoseLandmarker({
    videoRef: webcam.videoRef,
    enabled: webcam.status === 'ready',
    autoStart: true,
    targetFps: 24,
    lostPersonThresholdMs: 1200,
    debug: debugMode,
  })
  const calibration = useCalibration({
    landmarks: pose.result?.primaryLandmarks,
    averageVisibility:
      pose.result?.primaryPoseVisibility?.averageVisibility ?? null,
  })

  const frameMetrics = useMemo(() => {
    if (!pose.result?.primaryLandmarks) {
      return null
    }

    return createFrameMetrics({
      landmarks: pose.result.primaryLandmarks,
      timestampMs: pose.result.timestampMs,
      baseline: calibration.baseline,
    })
  }, [calibration.baseline, pose.result])

  const repDetection = useRepDetection({
    frameMetrics,
    enabled:
      step === 'assessment' &&
      webcam.status === 'ready' &&
      pose.status === 'running',
    debug: debugMode,
  })

  const postureFeedback = useMemo(
    () =>
      buildPostureFeedback({
        metrics: frameMetrics,
        landmarks: pose.result?.primaryLandmarks,
        phase: repDetection.phase,
      }),
    [frameMetrics, pose.result?.primaryLandmarks, repDetection.phase],
  )

  const assessment = useAssessmentSession({
    repCount: repDetection.repCount,
    phase: repDetection.phase,
    postureFeedback,
    timestampMs: frameMetrics?.timestampMs ?? null,
    targetReps: 3,
  })
  const assessmentStatus = assessment.status
  const assessmentIsComplete = assessment.isComplete
  const startAssessmentSession = assessment.startSession

  useEffect(() => {
    if (step === 'assessment' && assessmentStatus === 'idle') {
      startAssessmentSession(repDetection.repCount)
    }
  }, [assessmentStatus, repDetection.repCount, startAssessmentSession, step])

  useEffect(() => {
    if (step !== 'assessment' || !assessmentIsComplete) {
      return
    }

    const resultsTimer = window.setTimeout(() => {
      setStep('results')
    }, 0)

    return () => {
      window.clearTimeout(resultsTimer)
    }
  }, [assessmentIsComplete, step])

  const canContinueFromCamera =
    webcam.status === 'ready' &&
    pose.status === 'running' &&
    pose.personStatus === 'detected'

  const personTrackingMessage =
    pose.personStatus === 'detected'
      ? 'Person tracked'
      : pose.personStatus === 'lost'
        ? 'Person lost: step back into frame'
        : 'No person detected'

  const restartFlow = () => {
    calibration.resetBaseline()
    assessment.resetSession()
    setStep('intro')
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <p className="eyebrow">Cult Copilot</p>
        <h1>Guided 3-squat form check.</h1>
        <p className="hero-copy">
          This flow walks the user from camera setup to standing calibration,
          then runs a short three-rep assessment before showing results.
        </p>

        <Stepper currentStep={step} />
      </section>

      <section className="content-grid">
        <article className="card">
          <div className="card-header">
            <p className="section-label">Live Camera</p>
            <h2>Pose preview</h2>
          </div>

          <WebcamView
            webcam={webcam}
            title="Webcam preview"
            description="Keep your full body in frame so the pose detector can see shoulders, hips, knees, and ankles."
          >
            <PoseCanvasOverlay
              result={pose.result}
              videoRef={webcam.videoRef}
              containerRef={webcam.containerRef}
              mirrored={webcam.facingMode === 'user'}
            />

            <div className="form-flow__hud">
              <span className="status-pill status-pill--live">
                {repDetection.phase}
              </span>
              <span className="status-pill">
                Reps {assessment.completedReps}/{assessment.targetReps}
              </span>
              <span className="status-pill">
                Score {postureFeedback.postureScore}
              </span>
            </div>

            {step === 'assessment' &&
            (pose.personStatus !== 'detected' || postureFeedback.activeWarning) ? (
              <div className="form-flow__warning">
                {pose.personStatus !== 'detected' ? (
                  <>
                    <strong>
                      {pose.personStatus === 'lost'
                        ? 'Person lost'
                        : 'No person detected'}
                    </strong>
                    <span>
                      Keep your full body in frame so rep counting and feedback
                      stay accurate.
                    </span>
                  </>
                ) : (
                  <>
                    <strong>{postureFeedback.activeWarning?.title}</strong>
                    <span>{postureFeedback.activeWarning?.message}</span>
                  </>
                )}
              </div>
            ) : null}
          </WebcamView>

          <div className="stack-list form-flow__metrics">
            <div className="stack-item">
              <h3>Camera</h3>
              <p>{webcam.status}</p>
            </div>
            <div className="stack-item">
              <h3>Pose</h3>
              <p>{pose.status}</p>
            </div>
            <div className="stack-item">
              <h3>Calibration</h3>
              <p>{calibration.status}</p>
            </div>
            <div className="stack-item">
              <h3>Live warning</h3>
              <p>{postureFeedback.activeWarning?.title ?? 'No warning'}</p>
            </div>
            <div className="stack-item">
              <h3>Person tracking</h3>
              <p>{personTrackingMessage}</p>
            </div>
          </div>
        </article>

        <div className="form-flow__panel-stack">
          {step === 'intro' ? (
            <InfoCard
              label="Intro"
              title="Quick setup before the assessment"
              description="You will turn on the camera, capture a standing baseline, then perform three controlled squats. The system uses that baseline to make hip-depth checks more personal."
              actions={
                <button
                  type="button"
                  className="form-flow__button"
                  onClick={() => setStep('camera-setup')}
                >
                  Start flow
                </button>
              }
            />
          ) : null}

          {step === 'camera-setup' ? (
            <InfoCard
              label="Camera Setup"
              title="Get the camera ready"
              description="Use a side-ish view when possible and make sure your full body is visible. Continue once the camera is live and a person is tracked."
              actions={
                <>
                  <button
                    type="button"
                    className="form-flow__button form-flow__button--secondary"
                    onClick={() => setStep('intro')}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="form-flow__button"
                    onClick={() => setStep('calibration')}
                    disabled={!canContinueFromCamera}
                  >
                    Continue to calibration
                  </button>
                </>
              }
            />
          ) : null}

          {step === 'calibration' ? (
            <InfoCard
              label="Calibration"
              title="Capture your standing baseline"
              description={calibration.message}
              actions={
                <>
                  <button
                    type="button"
                    className="form-flow__button form-flow__button--secondary"
                    onClick={() => setStep('camera-setup')}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="form-flow__button form-flow__button--secondary"
                    onClick={calibration.resetBaseline}
                  >
                    Reset baseline
                  </button>
                  {!calibration.baseline ? (
                    <button
                      type="button"
                      className="form-flow__button"
                      onClick={() => {
                        calibration.captureBaseline()
                      }}
                      disabled={!calibration.canCapture}
                    >
                      Capture baseline
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="form-flow__button"
                      onClick={() => setStep('assessment')}
                    >
                      Start 3-squat assessment
                    </button>
                  )}
                </>
              }
            />
          ) : null}

          {step === 'assessment' ? (
            <InfoCard
              label="Assessment"
              title="Complete three controlled squats"
              description={
                pose.personStatus !== 'detected'
                  ? 'Tracking was lost. Re-enter frame before continuing reps.'
                  : postureFeedback.activeWarning
                  ? `${postureFeedback.activeWarning.title}: ${postureFeedback.activeWarning.recommendation}`
                  : 'Move at a steady pace. The session completes after 3 valid reps.'
              }
              actions={
                <>
                  <button
                    type="button"
                    className="form-flow__button form-flow__button--secondary"
                    onClick={() => {
                      assessment.resetSession()
                      setStep('calibration')
                    }}
                  >
                    Recalibrate
                  </button>
                  <button
                    type="button"
                    className="form-flow__button form-flow__button--secondary"
                    onClick={assessment.resetSession}
                  >
                    Reset session
                  </button>
                </>
              }
            />
          ) : null}

          {step === 'results' ? (
            <ResultsScreen results={assessment.results} onRestart={restartFlow} />
          ) : null}

          <article className="card">
            <div className="card-header">
              <p className="section-label">Session Status</p>
              <h2>What the app is tracking</h2>
            </div>

            <div className="stack-list">
              <div className="stack-item">
                <h3>Current step</h3>
                <p>{step}</p>
              </div>
              <div className="stack-item">
                <h3>Detected reps</h3>
                <p>{repDetection.repCount}</p>
              </div>
              <div className="stack-item">
                <h3>Recorded reps</h3>
                <p>{assessment.completedReps}</p>
              </div>
              <div className="stack-item">
                <h3>Rep score floor</h3>
                <p>
                  {assessment.currentRepLowestScore !== null
                    ? assessment.currentRepLowestScore
                    : 'Waiting'}
                </p>
              </div>
              <div className="stack-item">
                <h3>Baseline ready</h3>
                <p>{calibration.baseline ? 'Yes' : 'No'}</p>
              </div>
            </div>
          </article>
        </div>
      </section>
    </main>
  )
}
