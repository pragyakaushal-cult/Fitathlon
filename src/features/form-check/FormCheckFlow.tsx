import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'

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
const MIN_TARGET_REPS = 1
const MAX_TARGET_REPS = 30

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

function getFlowSteps(
  selectedExercise: ExerciseConfig | null,
  targetReps: number | null,
) {
  const base: Array<{ key: FlowStep; label: string }> = [
    { key: 'intro', label: 'Intro' },
    { key: 'calibration', label: 'Calibration' },
    { key: 'exercise', label: 'Workout' },
    { key: 'camera-setup', label: 'Camera' },
  ]

  if (!selectedExercise) {
    return base
  }

  if (selectedExercise.analysisProfile === 'squat') {
    return [
      ...base,
      {
        key: 'assessment',
        label: targetReps ? `${targetReps} Rep Test` : 'Rep Test',
      },
      { key: 'results', label: 'Results' },
    ]
  }

  return [...base, { key: 'assessment', label: 'Live Tracking' }]
}

function Stepper({
  currentStep,
  selectedExercise,
  targetReps,
}: {
  currentStep: FlowStep
  selectedExercise: ExerciseConfig | null
  targetReps: number | null
}) {
  const steps = getFlowSteps(selectedExercise, targetReps)
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

function clampTargetReps(value: number) {
  if (!Number.isFinite(value)) {
    return null
  }

  return Math.min(MAX_TARGET_REPS, Math.max(MIN_TARGET_REPS, Math.round(value)))
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

function getCalibrationProgressLabel(status: string) {
  switch (status) {
    case 'captured':
      return 'Calibration locked'
    case 'ready':
      return 'Almost locked'
    case 'stabilizing':
      return 'Hold still'
    case 'error':
      return 'Reposition'
    default:
      return 'Find full body'
  }
}

function CalibrationProgress({
  progress,
  status,
}: {
  progress: number
  status: string
}) {
  const progressPercent = Math.round(progress * 100)

  return (
    <div
      className={[
        'form-flow__calibration-progress',
        progress > 0 ? 'form-flow__calibration-progress--active' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      aria-label={`Calibration progress ${progressPercent}%`}
    >
      <div className="form-flow__calibration-progress-copy">
        <span>{getCalibrationProgressLabel(status)}</span>
        <strong>{progressPercent}%</strong>
      </div>
      <div
        className="form-flow__calibration-progress-track"
        aria-hidden="true"
      >
        <span style={{ width: `${progressPercent}%` }} />
      </div>
    </div>
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
  const [targetReps, setTargetReps] = useState<number | null>(null)
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
    enabled: step === 'calibration',
    landmarks: pose.result?.primaryLandmarks,
    averageVisibility:
      pose.result?.primaryPoseVisibility?.averageVisibility ?? null,
    timestampMs: pose.result?.timestampMs ?? null,
  })
  const calibrationBaseline = calibration.baseline

  const frameMetrics = useMemo(() => {
    if (!pose.result?.primaryLandmarks) {
      return null
    }

    return createFrameMetrics({
      landmarks: pose.result.primaryLandmarks,
      timestampMs: pose.result.timestampMs,
      baseline: calibrationBaseline,
    })
  }, [calibrationBaseline, pose.result])

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
    targetReps: targetReps ?? 1,
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
    pose.personStatus === 'detected' &&
    targetReps !== null

  const trackingWarning = useMemo(() => {
    if (pose.personStatus !== 'detected') {
      return 'Keep your full body in frame so tracking stays stable.'
    }

    if (step === 'calibration') {
      return calibration.message
    }

    if (!selectedExercise) {
      return calibrationBaseline
        ? 'Body calibration is ready. Choose a workout to continue.'
        : calibration.message
    }

    if (isSquatProfile) {
      if (step === 'assessment' && postureFeedback.activeWarning) {
        return `${postureFeedback.activeWarning.title}: ${postureFeedback.activeWarning.recommendation}`
      }

      return `Move with control. The session completes after ${targetReps ?? 'your chosen'} valid reps.`
    }

    if (postureFeedback.activeWarning) {
      return `${postureFeedback.activeWarning.title}: ${postureFeedback.activeWarning.recommendation}`
    }

    return `Live posture coaching is active for ${selectedExercise.shortLabel}. Focus on ${selectedExercise.focus
      .slice(0, 2)
      .join(' and ')
      .toLowerCase()}.`
  }, [
    calibrationBaseline,
    calibration.message,
    isSquatProfile,
    pose.personStatus,
    postureFeedback.activeWarning,
    selectedExercise,
    step,
    targetReps,
  ])

  const metricItems = [
    {
      label: 'Workout',
      value: selectedExercise?.shortLabel ?? 'Not selected',
    },
    {
      label: 'Target reps',
      value: targetReps !== null ? String(targetReps) : 'Choose reps',
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

  const resetAssessmentState = () => {
    assessment.resetSession()
  }

  const restartFlow = () => {
    calibration.resetBaseline()
    resetAssessmentState()
    setSelectedCategory(null)
    setSelectedExerciseId(null)
    setTargetReps(null)
    setStep('intro')
  }

  const handleSelectExercise = (exerciseId: ExerciseId) => {
    resetAssessmentState()
    setSelectedExerciseId(exerciseId)
    setTargetReps(null)
    setStep('exercise')
  }

  const handleChangeExercise = () => {
    resetAssessmentState()
    setSelectedExerciseId(null)
    setTargetReps(null)
    setStep('exercise')
  }

  const handleTargetRepsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextValue = event.target.value.trim()

    if (nextValue === '') {
      setTargetReps(null)
      return
    }

    setTargetReps(clampTargetReps(Number.parseInt(nextValue, 10)))
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
          Start by calibrating the full body once, then unlock the workout
          picker, set your target reps, and continue into lower-body or
          upper-body tracking. Squat-family exercises still run rep-counted
          scoring and results, while the rest use profile-based live coaching
          with pose overlay and camera-quality guidance.
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

        <Stepper
          currentStep={step}
          selectedExercise={selectedExercise}
          targetReps={targetReps}
        />
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
              : 'Calibrate your body first, then choose a workout and move fully into frame so the pose detector can lock onto shoulders, hips, knees, and ankles.'}
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
                  : `Target ${targetReps} reps`}
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

            {step === 'calibration' ? (
              <div className="form-flow__stage-panel">
                <div className="form-flow__stage-panel-header">
                  <span className="form-flow__stage-panel-label">
                    Calibration
                  </span>
                  <strong className="form-flow__stage-panel-title">
                    {calibration.baseline
                      ? 'Body calibration saved'
                      : 'Capture body baseline'}
                  </strong>
                </div>

                <p className="form-flow__stage-panel-copy">
                  {calibration.baseline
                    ? 'Calibration is complete. You can exit fullscreen and continue to workout selection.'
                    : calibration.message}
                </p>

                {!calibration.baseline ? (
                  <CalibrationProgress
                    progress={calibration.progress}
                    status={calibration.status}
                  />
                ) : null}

                <div className="form-flow__stage-panel-actions">
                  {calibration.baseline ? (
                    <button
                      type="button"
                      className="form-flow__button form-flow__button--secondary form-flow__button--compact"
                      onClick={calibration.resetBaseline}
                    >
                      Reset baseline
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="form-flow__button form-flow__button--compact"
                      onClick={() => {
                        calibration.captureBaseline()
                      }}
                      disabled={!calibration.canCapture}
                    >
                      Capture now
                    </button>
                  )}
                </div>
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
                title="Calibrate first, then unlock workouts"
                description="This flow now starts with a global body calibration. Once the baseline is captured, the workout picker unlocks, you can choose upper body or lower body, and then set the target reps before starting live tracking."
                actions={
                  <>
                    <button
                      type="button"
                      className="form-flow__button"
                      onClick={() => setStep('calibration')}
                    >
                      Calibrate body
                    </button>
                    <button
                      type="button"
                      className="form-flow__button form-flow__button--secondary"
                      onClick={() => setStep('exercise')}
                      disabled={!calibration.baseline}
                    >
                      Choose workout
                    </button>
                  </>
                }
              />

              <article className="card">
                <div className="card-header">
                  <p className="section-label">Coverage</p>
                  <h2>What is fully implemented today</h2>
                </div>

                <ul className="feedback-list">
                  <li>Body calibration now happens before workout selection.</li>
                  <li>Workout selection stays locked until calibration is captured.</li>
                  <li>Each workout now carries a configurable target reps value.</li>
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
                  Calibration is complete. Pick the body area first, then select
                  a movement. Squat-family exercises still unlock the full
                  scoring pipeline. Other workouts use family-specific live
                  coaching, overlay, and camera-readiness feedback.
                </p>

                {!selectedCategory ? (
                  <div className="category-grid flow-subtitle">
                    {(Object.keys(CATEGORY_COPY) as ExerciseCategory[]).map(
                      (category) => (
                        <CategoryCard
                          key={category}
                          category={category}
                          onClick={() => {
                            setSelectedCategory(category)
                            setSelectedExerciseId(null)
                            setTargetReps(null)
                          }}
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
                        onClick={() => {
                          setSelectedCategory(null)
                          setSelectedExerciseId(null)
                          setTargetReps(null)
                        }}
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
                    <label className="form-flow__field">
                      <span className="form-flow__field-label">Target reps</span>
                      <input
                        type="number"
                        min={MIN_TARGET_REPS}
                        max={MAX_TARGET_REPS}
                        step={1}
                        inputMode="numeric"
                        className="form-flow__input"
                        value={targetReps ?? ''}
                        onChange={handleTargetRepsChange}
                        placeholder="Enter reps"
                      />
                    </label>
                    <p className="form-flow__field-hint">
                      Choose the reps for this workout before continuing.
                      {targetReps !== null
                        ? ` Squat-profile exercises will complete and score the set after ${targetReps} valid reps.`
                        : ' The next step stays locked until reps are entered.'}
                    </p>

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
                            ? 'Rep-counted scoring, posture score, and results'
                            : 'Live pose overlay and profile-based coaching'}
                        </dd>
                      </div>
                    </dl>

                    <div className="form-flow__actions">
                      <button
                        type="button"
                        className="form-flow__button"
                        onClick={() => setStep('camera-setup')}
                        disabled={targetReps === null}
                      >
                        Continue to camera setup
                      </button>
                    </div>
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
                    ? `Set up the camera for ${selectedExercise.shortLabel}. The target is ${targetReps ?? 'not chosen'} reps. Continue once the camera is live, the person is tracked, and the rep target is set.`
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
                      onClick={() => setStep('assessment')}
                      disabled={!selectedExercise || !canContinueFromCamera}
                    >
                      {isSquatProfile
                        ? targetReps !== null
                          ? `Start ${targetReps}-rep test`
                          : 'Choose reps first'
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

          {step === 'calibration' ? (
            <>
              <InfoCard
                label="Calibration"
                title="Capture a standing body baseline"
                description={calibration.message}
                actions={
                  <>
                    <button
                      type="button"
                      className="form-flow__button form-flow__button--secondary"
                      onClick={() =>
                        setStep(selectedExercise ? 'camera-setup' : 'intro')
                      }
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
                        Capture now
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="form-flow__button"
                        onClick={() =>
                          setStep(selectedExercise ? 'camera-setup' : 'exercise')
                        }
                      >
                        {selectedExercise ? 'Back to workout' : 'Choose workout'}
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

                {!calibration.baseline ? (
                  <CalibrationProgress
                    progress={calibration.progress}
                    status={calibration.status}
                  />
                ) : null}

                <p className="panel-copy">
                  This standing capture creates a stable body baseline before
                  workout selection. The same calibration is later reused by
                  squat-profile movements for depth checks and keeps the overall
                  flow consistent across all workouts.
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
                        : `Move at a steady pace. The session completes after ${targetReps} valid reps.`
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
                    <h3>Target reps</h3>
                    <p>{targetReps}</p>
                  </div>
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
