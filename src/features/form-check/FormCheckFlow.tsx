import { useEffect, useMemo, useState, type ReactNode } from 'react'

import { buildPostureFeedback } from '@/features/analysis/feedback'
import { createFrameMetrics } from '@/features/analysis/frameMetrics'
import { getAnalysisProfileLabel } from '@/features/analysis/profiles'
import { useRepDetection } from '@/features/analysis/useRepDetection'
import { useWebcam } from '@/features/camera/useWebcam'
import { WebcamView } from '@/features/camera/WebcamView'
import {
  EXERCISE_CATALOG,
  getExerciseById,
  type ExerciseCategory,
  type ExerciseConfig,
  type ExerciseFamily,
  type ExerciseId,
} from '@/features/exercises/config'
import { useCalibration } from '@/features/form-check/useCalibration'
import { useAssessmentSession } from '@/features/form-check/useAssessmentSession'
import { PoseCanvasOverlay } from '@/features/pose/PoseCanvasOverlay'
import { usePoseLandmarker } from '@/features/pose/usePoseLandmarker'
import { ResultsScreen } from '@/features/results/ResultsScreen'
import './FormCheckFlow.css'

type FlowStep =
  | 'intro'
  | 'exercise'
  | 'camera-setup'
  | 'calibration'
  | 'assessment'
  | 'results'

type StatusTone = 'ok' | 'warn' | 'error' | 'muted'
type ThemeMode = 'studio' | 'night'

const THEME_STORAGE_KEY = 'cult-copilot-theme'

const CATEGORY_COPY: Record<
  ExerciseCategory,
  { description: string; label: string }
> = {
  lower_body: {
    label: 'Lower body',
    description:
      'Squats, lunges, hinges, glute work, and lower-body athletic drills.',
  },
  upper_body: {
    label: 'Upper body',
    description:
      'Push, pull, and core sessions using the same camera and live pose overlay.',
  },
}

function getFlowSteps(selectedExercise: ExerciseConfig | null) {
  const base: Array<{ key: FlowStep; label: string }> = [
    { key: 'intro', label: 'Intro' },
    { key: 'exercise', label: 'Workout' },
    { key: 'camera-setup', label: 'Camera' },
  ]

  if (!selectedExercise) {
    return base
  }

  if (selectedExercise.analysisProfile === 'squat') {
    return [
      ...base,
      { key: 'calibration', label: 'Calibration' },
      { key: 'assessment', label: '3 Rep Test' },
      { key: 'results', label: 'Results' },
    ]
  }

  return [...base, { key: 'assessment', label: 'Live Tracking' }]
}

function Stepper({
  currentStep,
  selectedExercise,
}: {
  currentStep: FlowStep
  selectedExercise: ExerciseConfig | null
}) {
  const steps = getFlowSteps(selectedExercise)
  const currentIndex = steps.findIndex((step) => step.key === currentStep)

  return (
    <div className="form-flow__stepper" aria-label="tracking flow steps">
      {steps.map((step, index) => {
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
  actions,
  description,
  label,
  title,
}: {
  actions?: ReactNode
  description: string
  label: string
  title: string
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

function CategoryCard({
  category,
  onClick,
}: {
  category: ExerciseCategory
  onClick: () => void
}) {
  return (
    <button className="category-card" type="button" onClick={onClick}>
      <strong>{CATEGORY_COPY[category].label}</strong>
      <span>{CATEGORY_COPY[category].description}</span>
    </button>
  )
}

function groupByFamily(exercises: ExerciseConfig[]) {
  const grouped = new Map<ExerciseFamily, ExerciseConfig[]>()

  exercises.forEach((exercise) => {
    const current = grouped.get(exercise.family) ?? []
    current.push(exercise)
    grouped.set(exercise.family, current)
  })

  return Array.from(grouped.entries())
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Waiting'
  }

  return `${Math.round(value * 100)}%`
}

function formatAngle(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Waiting'
  }

  return `${Math.round(value)}deg`
}

function formatDepth(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'Waiting'
  }

  return value.toFixed(2)
}

function getStatusTone(status: string): StatusTone {
  switch (status) {
    case 'ready':
    case 'running':
    case 'detected':
    case 'captured':
    case 'complete':
      return 'ok'
    case 'requesting':
    case 'initializing':
    case 'lost':
      return 'warn'
    case 'error':
    case 'unsupported':
      return 'error'
    default:
      return 'muted'
  }
}

function getTrackingHeadline(
  selectedExercise: ExerciseConfig | null,
  isSquatProfile: boolean,
) {
  if (!selectedExercise) {
    return 'Choose a workout to start'
  }

  return isSquatProfile
    ? `${selectedExercise.shortLabel} form check`
    : `${selectedExercise.shortLabel} live posture tracking`
}

function getInitialThemeMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return 'studio'
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY)
  const resolvedTheme =
    storedTheme === 'studio' || storedTheme === 'night'
      ? storedTheme
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'night'
        : 'studio'

  if (typeof document !== 'undefined') {
    document.documentElement.dataset.theme = resolvedTheme
  }

  return resolvedTheme
}

export function FormCheckFlow() {
  const [step, setStep] = useState<FlowStep>('intro')
  const [selectedCategory, setSelectedCategory] =
    useState<ExerciseCategory | null>(null)
  const [selectedExerciseId, setSelectedExerciseId] =
    useState<ExerciseId | null>(null)
  const [themeMode, setThemeMode] = useState<ThemeMode>(getInitialThemeMode)
  const debugMode = useMemo(() => {
    if (typeof window === 'undefined') {
      return false
    }

    return new URLSearchParams(window.location.search).has('debug')
  }, [])

  const selectedExercise = useMemo(
    () => (selectedExerciseId ? getExerciseById(selectedExerciseId) : null),
    [selectedExerciseId],
  )
  const isNightMode = themeMode === 'night'
  const isSquatProfile = selectedExercise?.analysisProfile === 'squat'
  const visibleExercises = useMemo(
    () =>
      selectedCategory
        ? EXERCISE_CATALOG.filter(
            (exercise) => exercise.category === selectedCategory,
          )
        : [],
    [selectedCategory],
  )
  const exerciseFamilies = useMemo(
    () => groupByFamily(visibleExercises),
    [visibleExercises],
  )

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
      isSquatProfile &&
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
        profile: selectedExercise?.analysisProfile ?? 'squat',
        phase: repDetection.phase,
      }),
    [
      frameMetrics,
      pose.result?.primaryLandmarks,
      repDetection.phase,
      selectedExercise?.analysisProfile,
    ],
  )

  const assessment = useAssessmentSession({
    repCount: repDetection.repCount,
    phase: repDetection.phase,
    postureFeedback,
    timestampMs: frameMetrics?.timestampMs ?? null,
    targetReps: 3,
  })

  useEffect(() => {
    if (!isSquatProfile || step !== 'assessment' || assessment.status !== 'idle') {
      return
    }

    assessment.startSession(repDetection.repCount)
  }, [assessment, isSquatProfile, repDetection.repCount, step])

  useEffect(() => {
    if (!isSquatProfile || step !== 'assessment' || !assessment.isComplete) {
      return
    }

    const resultsTimer = window.setTimeout(() => {
      setStep('results')
    }, 0)

    return () => {
      window.clearTimeout(resultsTimer)
    }
  }, [assessment.isComplete, isSquatProfile, step])

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    document.documentElement.dataset.theme = themeMode
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  const personTrackingMessage =
    pose.personStatus === 'detected'
      ? 'Person tracked'
      : pose.personStatus === 'lost'
        ? 'Person lost: step back into frame'
        : 'No person detected'
  const canContinueFromCamera =
    webcam.status === 'ready' &&
    pose.status === 'running' &&
    pose.personStatus === 'detected'

  const trackingWarning = useMemo(() => {
    if (pose.personStatus !== 'detected') {
      return 'Keep your full body in frame so tracking stays stable.'
    }

    if (!selectedExercise) {
      return 'Choose a workout to start guided tracking.'
    }

    if (isSquatProfile) {
      if (step === 'calibration') {
        return calibration.message
      }

      if (step === 'assessment' && postureFeedback.activeWarning) {
        return `${postureFeedback.activeWarning.title}: ${postureFeedback.activeWarning.recommendation}`
      }

      return 'Move with control. The session completes after 3 valid reps.'
    }

    if (postureFeedback.activeWarning) {
      return `${postureFeedback.activeWarning.title}: ${postureFeedback.activeWarning.recommendation}`
    }

    return `Live posture coaching is active for ${selectedExercise.shortLabel}. Focus on ${selectedExercise.focus
      .slice(0, 2)
      .join(' and ')
      .toLowerCase()}.`
  }, [
    calibration.message,
    isSquatProfile,
    pose.personStatus,
    postureFeedback.activeWarning,
    selectedExercise,
    step,
  ])

  const metricItems = [
    {
      label: 'Workout',
      value: selectedExercise?.shortLabel ?? 'Not selected',
    },
    {
      label: 'Mode',
      value: selectedExercise
        ? isSquatProfile
          ? step === 'assessment'
            ? repDetection.phase
            : 'squat scoring'
          : 'live tracking'
        : 'setup',
    },
    {
      label: 'Camera',
      value: webcam.status,
    },
    {
      label: 'Pose',
      value: pose.status,
    },
    {
      label: 'Person tracking',
      value: personTrackingMessage,
    },
    {
      label: 'Avg visibility',
      value: formatPercent(frameMetrics?.averageVisibility),
    },
    {
      label: 'Knee angle',
      value: formatAngle(frameMetrics?.averageKneeAngleDeg),
    },
    {
      label: isSquatProfile ? 'Hip depth' : 'Posture score',
      value: isSquatProfile
        ? formatDepth(frameMetrics?.hipDepthNormalized)
        : postureFeedback.postureScore,
    },
  ]

  const resetTrackingState = () => {
    calibration.resetBaseline()
    assessment.resetSession()
  }

  const restartFlow = () => {
    resetTrackingState()
    setSelectedCategory(null)
    setSelectedExerciseId(null)
    setStep('intro')
  }

  const handleSelectExercise = (exerciseId: ExerciseId) => {
    resetTrackingState()
    setSelectedExerciseId(exerciseId)
    setStep('camera-setup')
  }

  const handleChangeExercise = () => {
    resetTrackingState()
    setSelectedExerciseId(null)
    setStep('exercise')
  }

  return (
    <main className="app-shell">
      <section className="hero-panel">
        <div className="hero-panel__toolbar">
          <button
            type="button"
            className={[
              'theme-toggle',
              isNightMode ? 'theme-toggle--night' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() =>
              setThemeMode((currentTheme) =>
                currentTheme === 'studio' ? 'night' : 'studio',
              )
            }
            aria-pressed={isNightMode}
            aria-label={`Switch to ${isNightMode ? 'studio' : 'night'} mode`}
            title={`Switch to ${isNightMode ? 'studio' : 'night'} mode`}
          >
            <span className="theme-toggle__meta">
              <span className="theme-toggle__label">Display</span>
              <span className="theme-toggle__value">
                {isNightMode ? 'Night mode' : 'Studio mode'}
              </span>
            </span>
            <span className="theme-toggle__track" aria-hidden="true">
              <span className="theme-toggle__option">Studio</span>
              <span className="theme-toggle__option">Night</span>
              <span className="theme-toggle__thumb" />
            </span>
          </button>
        </div>

        <p className="eyebrow">Cult Copilot</p>
        <h1>One camera flow for multiple workouts.</h1>
        <p className="hero-copy">
          The stronger Cult Copilot tracking pipeline now sits behind the richer
          multi-workout UI from your posture-corrector concept. Squat-family
          exercises run full calibration, rep detection, posture scoring, and
          results. The rest now use profile-based live coaching with exercise
          family warnings, pose overlay, and camera-quality guidance.
        </p>

        <div className="status-row">
          <span className={`status-pill status-pill--${getStatusTone(webcam.status)}`}>
            Camera: {webcam.status}
          </span>
          <span className={`status-pill status-pill--${getStatusTone(pose.status)}`}>
            Pose: {pose.status}
          </span>
          <span
            className={`status-pill status-pill--${getStatusTone(
              pose.personStatus,
            )}`}
          >
            Person: {pose.personStatus}
          </span>
          <span className="status-pill status-pill--muted">
            Workout: {selectedExercise?.shortLabel ?? 'Choose one'}
          </span>
        </div>

        <Stepper currentStep={step} selectedExercise={selectedExercise} />
      </section>

      <section className="content-grid">
        <article className="card form-flow__camera-card">
          <div className="card-header">
            <p className="section-label">Live Camera</p>
            <h2>{getTrackingHeadline(selectedExercise, isSquatProfile)}</h2>
          </div>

          <p className="form-flow__copy">
            {selectedExercise
              ? selectedExercise.description
              : 'Choose a workout first, then move into frame so the pose detector can lock onto shoulders, hips, knees, and ankles.'}
          </p>

          <div
            className={[
              'callout',
              webcam.error || pose.error ? 'callout--error' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {webcam.error?.message ?? pose.error?.message ?? trackingWarning}
          </div>

          <WebcamView
            webcam={webcam}
            title="Webcam preview"
            description="Keep your full body visible for the cleanest pose overlay and coaching signals."
          >
            <PoseCanvasOverlay
              result={pose.result}
              videoRef={webcam.videoRef}
              containerRef={webcam.containerRef}
              mirrored={webcam.facingMode === 'user'}
            />

            <div className="form-flow__hud">
              <span className="status-pill status-pill--ok">
                {step === 'assessment' && isSquatProfile
                    ? repDetection.phase
                    : selectedExercise
                    ? getAnalysisProfileLabel(selectedExercise.analysisProfile)
                    : 'setup'}
              </span>
              <span className="status-pill status-pill--muted">
                {isSquatProfile
                  ? `Reps ${assessment.completedReps}/${assessment.targetReps}`
                  : selectedExercise?.shortLabel ?? 'Choose workout'}
              </span>
              <span className="status-pill status-pill--muted">
                Visibility {formatPercent(frameMetrics?.averageVisibility)}
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
                      Keep your full body in frame so live tracking stays
                      accurate.
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

          <div className="metric-grid form-flow__metrics">
            {metricItems.map((item) => (
              <article key={item.label} className="metric-card">
                <span className="metric-label">{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
        </article>

        <div className="form-flow__panel-stack">
          {step === 'intro' ? (
            <>
              <InfoCard
                label="Intro"
                title="Start with the workout, not the camera"
                description="This version keeps the stable browser pose tracking from Cult Copilot, then wraps it in the broader workout selection UX from your other project so the demo feels like a real product instead of a single squat-only screen."
                actions={
                  <button
                    type="button"
                    className="form-flow__button"
                    onClick={() => setStep('exercise')}
                  >
                    Choose workout
                  </button>
                }
              />

              <article className="card">
                <div className="card-header">
                  <p className="section-label">Coverage</p>
                  <h2>What is fully implemented today</h2>
                </div>

                <ul className="feedback-list">
                  <li>Squat-family movements run calibration, rep counting, and results.</li>
                  <li>Other workouts now use profile-based live error tracing by movement family.</li>
                  <li>Only squat-family movements currently have full rep-scored results.</li>
                </ul>
              </article>
            </>
          ) : null}

          {step === 'exercise' ? (
            <>
              <article className="card">
                <div className="card-header">
                  <p className="section-label">Workout</p>
                  <h2>Choose what to track</h2>
                </div>

                <p className="form-flow__copy">
                  Pick the body area first, then select a movement. Squat-family
                  exercises unlock the full scoring pipeline. Other workouts
                  now get family-specific live coaching, overlay, and
                  camera-readiness feedback.
                </p>

                {!selectedCategory ? (
                  <div className="category-grid flow-subtitle">
                    {(Object.keys(CATEGORY_COPY) as ExerciseCategory[]).map(
                      (category) => (
                        <CategoryCard
                          key={category}
                          category={category}
                          onClick={() => setSelectedCategory(category)}
                        />
                      ),
                    )}
                  </div>
                ) : (
                  <div className="exercise-list flow-subtitle">
                    <div className="picker-toolbar">
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">Selected area</p>
                          <h3>{CATEGORY_COPY[selectedCategory].label}</h3>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="form-flow__button form-flow__button--secondary"
                        onClick={() => setSelectedCategory(null)}
                      >
                        Change body area
                      </button>
                    </div>

                    {exerciseFamilies.map(([family, familyExercises]) => (
                      <section key={family} className="exercise-group">
                        <h3>{family}</h3>
                        <div className="exercise-button-grid">
                          {familyExercises.map((exercise) => (
                            <button
                              key={exercise.id}
                              type="button"
                              className="exercise-button"
                              onClick={() => handleSelectExercise(exercise.id)}
                            >
                              <span>{exercise.label}</span>
                              <small>
                                {getAnalysisProfileLabel(
                                  exercise.analysisProfile,
                                )}
                              </small>
                            </button>
                          ))}
                        </div>
                      </section>
                    ))}
                  </div>
                )}
              </article>

              <article className="card">
                <div className="card-header">
                  <p className="section-label">Current selection</p>
                  <h2>{selectedExercise?.label ?? 'No workout selected yet'}</h2>
                </div>

                <p className="panel-copy">
                  {selectedExercise
                    ? selectedExercise.description
                    : 'Pick a movement to continue into the camera and tracking flow.'}
                </p>

                {selectedExercise ? (
                  <>
                    <ul className="exercise-focus-list">
                      {selectedExercise.focus.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>

                    <dl className="detail-list">
                      <div>
                        <dt>Family</dt>
                        <dd>{selectedExercise.family}</dd>
                      </div>
                      <div>
                        <dt>Tracking mode</dt>
                        <dd>
                          {isSquatProfile
                            ? 'Calibration, rep counting, posture score, and results'
                            : 'Live pose overlay and profile-based coaching'}
                        </dd>
                      </div>
                    </dl>
                  </>
                ) : null}
              </article>
            </>
          ) : null}

          {step === 'camera-setup' ? (
            <>
              <InfoCard
                label="Camera"
                title="Get the athlete fully into frame"
                description={
                  selectedExercise
                    ? `Set up the camera for ${selectedExercise.shortLabel}. Continue once the camera is live and the person is tracked.`
                    : 'Pick a workout first, then continue once the camera is live and a person is tracked.'
                }
                actions={
                  <>
                    <button
                      type="button"
                      className="form-flow__button form-flow__button--secondary"
                      onClick={() => setStep('exercise')}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="form-flow__button"
                      onClick={() =>
                        setStep(isSquatProfile ? 'calibration' : 'assessment')
                      }
                      disabled={!selectedExercise || !canContinueFromCamera}
                    >
                      {isSquatProfile
                        ? 'Continue to calibration'
                        : 'Start live tracking'}
                    </button>
                  </>
                }
              />

              <article className="card">
                <div className="card-header">
                  <p className="section-label">Checklist</p>
                  <h2>Camera setup for cleaner tracking</h2>
                </div>

                <ul className="feedback-list">
                  <li>Keep shoulders, hips, knees, and ankles visible.</li>
                  <li>Use a side-ish angle for squat-family movements when possible.</li>
                  <li>Give the camera enough distance to avoid cropped limbs.</li>
                </ul>
              </article>
            </>
          ) : null}

          {step === 'calibration' && selectedExercise ? (
            <>
              <InfoCard
                label="Calibration"
                title={`Capture a standing baseline for ${selectedExercise.shortLabel}`}
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
                        Start 3-rep test
                      </button>
                    )}
                  </>
                }
              />

              <article className="card">
                <div className="card-header">
                  <p className="section-label">Baseline</p>
                  <h2>Why calibration matters here</h2>
                </div>

                <p className="panel-copy">
                  The squat pipeline uses your standing pose as a personal depth
                  reference. That makes hip-depth checks much more stable across
                  athletes and camera positions.
                </p>
              </article>
            </>
          ) : null}

          {step === 'assessment' && selectedExercise ? (
            <>
              <article className="card">
                <div className="card-header">
                  <p className="section-label">
                    {isSquatProfile ? 'Assessment' : 'Live Tracking'}
                  </p>
                  <h2>{selectedExercise.label}</h2>
                </div>

                <p className="form-flow__copy">
                  {isSquatProfile
                    ? pose.personStatus !== 'detected'
                      ? 'Tracking was lost. Re-enter frame before continuing reps.'
                      : postureFeedback.activeWarning
                        ? `${postureFeedback.activeWarning.title}: ${postureFeedback.activeWarning.recommendation}`
                        : 'Move at a steady pace. The session completes after 3 valid reps.'
                    : trackingWarning}
                </p>

                <ul className="exercise-focus-list">
                  {selectedExercise.focus.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>

                <div className="form-flow__actions">
                  <button
                    type="button"
                    className="form-flow__button form-flow__button--secondary"
                    onClick={handleChangeExercise}
                  >
                    Change exercise
                  </button>
                  {isSquatProfile ? (
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
                  ) : (
                    <button
                      type="button"
                      className="form-flow__button form-flow__button--secondary"
                      onClick={() => setStep('camera-setup')}
                    >
                      Back to camera setup
                    </button>
                  )}
                </div>
              </article>

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
                    <p>{isSquatProfile ? repDetection.repCount : 'N/A'}</p>
                  </div>
                  <div className="stack-item">
                    <h3>Recorded reps</h3>
                    <p>{isSquatProfile ? assessment.completedReps : 'N/A'}</p>
                  </div>
                  <div className="stack-item">
                    <h3>Rep score floor</h3>
                    <p>
                      {isSquatProfile
                        ? assessment.currentRepLowestScore !== null
                          ? assessment.currentRepLowestScore
                          : 'Waiting'
                        : 'Not used in generic mode'}
                    </p>
                  </div>
                  <div className="stack-item">
                    <h3>Baseline ready</h3>
                    <p>{calibration.baseline ? 'Yes' : 'No'}</p>
                  </div>
                </div>
              </article>
            </>
          ) : null}

          {step === 'results' && selectedExercise ? (
            <ResultsScreen
              results={assessment.results}
              onRestart={restartFlow}
              title={`${selectedExercise.shortLabel} summary`}
            />
          ) : null}
        </div>
      </section>
    </main>
  )
}
