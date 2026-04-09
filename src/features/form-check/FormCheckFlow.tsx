import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react'

import { buildPostureFeedback } from '@/features/analysis/feedback'
import { createFrameMetrics } from '@/features/analysis/frameMetrics'
import { getAnalysisProfileLabel } from '@/features/analysis/profiles'
import { useDemoExerciseRepDetection } from '@/features/analysis/useDemoExerciseRepDetection'
import { useRepDetection } from '@/features/analysis/useRepDetection'
import { useWebcam } from '@/features/camera/useWebcam'
import { WebcamView } from '@/features/camera/WebcamView'
import { getDemoExercisePreset } from '@/features/exercises/demoAssessment'
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
import { useVoiceCoach } from '@/features/voice/useVoiceCoach'
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
  const demoExercisePreset = getDemoExercisePreset(selectedExercise?.id)
  const base: Array<{ key: FlowStep; label: string }> = [
    { key: 'intro', label: 'Intro' },
    { key: 'exercise', label: 'Workout' },
    { key: 'camera-setup', label: 'Camera' },
  ]
  const assessmentLabel = targetReps
    ? `${targetReps}-Rep Assessment`
    : 'Assessment'

  if (!selectedExercise) {
    return base
  }

  if (
    selectedExercise.analysisProfile === 'squat' ||
    demoExercisePreset?.requiresCalibration
  ) {
    return [
      ...base,
      { key: 'calibration', label: 'Calibration' },
      { key: 'assessment', label: assessmentLabel },
      { key: 'results', label: 'Results' },
    ]
  }

  if (demoExercisePreset) {
    return [
      ...base,
      { key: 'assessment', label: assessmentLabel },
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

function getRepHudLabel(
  usesRepTracking: boolean,
  completedReps: number,
  targetReps: number | null,
  selectedExercise: ExerciseConfig | null,
) {
  if (targetReps === null) {
    return selectedExercise ? 'Set reps' : 'Choose workout'
  }

  return usesRepTracking
    ? `Reps ${completedReps}/${targetReps}`
    : `Target ${targetReps} reps`
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

function getVoiceStatusTone(status: 'unsupported' | 'ready' | 'muted'): StatusTone {
  switch (status) {
    case 'ready':
      return 'ok'
    case 'unsupported':
      return 'warn'
    case 'muted':
    default:
      return 'muted'
  }
}

function formatUiStateLabel(value: string) {
  switch (value) {
    case 'ready':
      return 'Ready'
    case 'running':
      return 'Live'
    case 'requesting':
      return 'Requesting access'
    case 'initializing':
      return 'Starting'
    case 'detected':
      return 'Locked'
    case 'not-detected':
      return 'Not detected'
    case 'lost':
      return 'Lost'
    case 'captured':
      return 'Captured'
    case 'complete':
      return 'Complete'
    case 'intro':
      return 'Intro'
    case 'exercise':
      return 'Workout'
    case 'camera-setup':
      return 'Camera setup'
    case 'assessment':
      return 'Assessment'
    case 'results':
      return 'Results'
    case 'descending':
      return 'Lowering'
    case 'bottom':
      return 'Bottom'
    case 'ascending':
      return 'Rising'
    case 'holding':
      return 'Holding'
    case 'idle':
      return 'Waiting'
    case 'unsupported':
      return 'Unsupported'
    case 'error':
      return 'Error'
    case 'assessment setup':
      return 'Assessment setup'
    case 'rep assessment':
      return 'Rep assessment'
    case 'live tracking':
      return 'Live tracking'
    case 'setup':
      return 'Setup'
    default:
      return value
  }
}

function getTrackingHeadline(
  selectedExercise: ExerciseConfig | null,
  hasStructuredAssessment: boolean,
) {
  if (!selectedExercise) {
    return 'Choose a workout to begin'
  }

  return hasStructuredAssessment
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
  const demoExercisePreset = useMemo(
    () => getDemoExercisePreset(selectedExerciseId),
    [selectedExerciseId],
  )
  const isNightMode = themeMode === 'night'
  const isSquatProfile = selectedExercise?.analysisProfile === 'squat'
  const requiresCalibration =
    isSquatProfile || demoExercisePreset?.requiresCalibration === true
  const hasStructuredAssessment =
    isSquatProfile || demoExercisePreset !== null
  const usesDemoRepDetection =
    demoExercisePreset !== null &&
    demoExercisePreset.repTracking.kind !== 'existing-squat'
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
  const voiceCoach = useVoiceCoach({
    debug: debugMode,
    defaultMuted: false,
    lang: 'en-US',
    voicePreference: 'female',
    rate: 0.92,
    pitch: 1.08,
    volume: 0.9,
    minGapMs: 2200,
    repeatGapMs: 7500,
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

  const squatRepDetection = useRepDetection({
    frameMetrics,
    enabled:
      isSquatProfile &&
      step === 'assessment' &&
      webcam.status === 'ready' &&
      pose.status === 'running' &&
      !usesDemoRepDetection,
    debug: debugMode,
    config: demoExercisePreset?.repConfig,
  })
  const demoRepDetection = useDemoExerciseRepDetection({
    frameMetrics,
    enabled:
      usesDemoRepDetection &&
      step === 'assessment' &&
      webcam.status === 'ready' &&
      pose.status === 'running',
    preset: demoExercisePreset,
  })
  const repDetection = usesDemoRepDetection
    ? demoRepDetection
    : squatRepDetection

  const postureFeedback = useMemo(
    () =>
      buildPostureFeedback({
        metrics: frameMetrics,
        landmarks: pose.result?.primaryLandmarks,
        profile: selectedExercise?.analysisProfile ?? 'squat',
        phase: repDetection.phase,
        ruleConfig: demoExercisePreset?.ruleConfig,
        scoreWeights: demoExercisePreset?.scoreWeights,
        warningOverrides: demoExercisePreset?.warningOverrides,
      }),
    [
      demoExercisePreset?.ruleConfig,
      demoExercisePreset?.scoreWeights,
      demoExercisePreset?.warningOverrides,
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
    targetReps: targetReps ?? MIN_TARGET_REPS,
  })
  const lastAnnouncedRepRef = useRef(0)

  useEffect(() => {
    if (
      !hasStructuredAssessment ||
      step !== 'assessment' ||
      assessment.status !== 'idle'
    ) {
      return
    }

    assessment.startSession(repDetection.repCount)
  }, [assessment, hasStructuredAssessment, repDetection.repCount, step])

  useEffect(() => {
    if (
      !hasStructuredAssessment ||
      step !== 'assessment' ||
      !assessment.isComplete
    ) {
      return
    }

    const resultsTimer = window.setTimeout(() => {
      setStep('results')
    }, 0)

    return () => {
      window.clearTimeout(resultsTimer)
    }
  }, [assessment.isComplete, hasStructuredAssessment, step])

  useEffect(() => {
    if (step !== 'assessment' || !selectedExercise) {
      return
    }

    if (pose.personStatus !== 'detected') {
      const isLost = pose.personStatus === 'lost'
      voiceCoach.announce({
        id: isLost ? 'person-lost' : 'person-not-detected',
        text: isLost
          ? 'I lost tracking. Step back so your full body is visible.'
          : 'Step into frame so I can track your movement.',
        priority: 'critical',
        repeatGapMs: 6000,
      })
      return
    }

    if (postureFeedback.activeWarning) {
      voiceCoach.announce({
        id: `warning-${postureFeedback.activeWarning.key}`,
        text: `${postureFeedback.activeWarning.title}. ${postureFeedback.activeWarning.recommendation}`,
        priority: 'high',
        repeatGapMs: 7000,
      })
    }
  }, [
    pose.personStatus,
    postureFeedback.activeWarning,
    selectedExercise,
    step,
    voiceCoach,
  ])

  useEffect(() => {
    if (!hasStructuredAssessment || step !== 'assessment') {
      lastAnnouncedRepRef.current = repDetection.repCount
      return
    }

    if (repDetection.repCount <= lastAnnouncedRepRef.current) {
      return
    }

    lastAnnouncedRepRef.current = repDetection.repCount
    const repsRemaining = Math.max(assessment.targetReps - repDetection.repCount, 0)
    const completedLabel =
      demoExercisePreset?.id === 'plank'
        ? `Hold ${repDetection.repCount} complete.`
        : `Rep ${repDetection.repCount} complete.`

    voiceCoach.announce({
      id: `rep-${repDetection.repCount}`,
      text:
        repsRemaining > 0
          ? `${completedLabel} ${repsRemaining} to go.`
          : 'Great work. Assessment complete.',
      priority: 'high',
      repeatGapMs: 1000,
    })
  }, [
    assessment.targetReps,
    demoExercisePreset?.id,
    hasStructuredAssessment,
    repDetection.repCount,
    step,
    voiceCoach,
  ])

  useEffect(() => {
    if (typeof document === 'undefined' || typeof window === 'undefined') {
      return
    }

    document.documentElement.dataset.theme = themeMode
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode)
  }, [themeMode])

  const personTrackingMessage =
    pose.personStatus === 'detected'
      ? 'Tracking locked'
      : pose.personStatus === 'lost'
        ? 'Tracking lost'
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

    if (!selectedExercise) {
      return 'Choose a workout to start guided tracking.'
    }

    if (hasStructuredAssessment) {
      if (requiresCalibration && step === 'calibration') {
        return calibration.message
      }

      if (step === 'assessment' && postureFeedback.activeWarning) {
        return `${postureFeedback.activeWarning.title}: ${postureFeedback.activeWarning.recommendation}`
      }

      return (
        demoExercisePreset?.idleCue ??
        `Move with control. The session completes after ${targetReps ?? 'your chosen'} valid reps.`
      )
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
    demoExercisePreset?.idleCue,
    hasStructuredAssessment,
    pose.personStatus,
    postureFeedback.activeWarning,
    requiresCalibration,
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
      value: formatUiStateLabel(
        selectedExercise
        ? hasStructuredAssessment
          ? step === 'assessment'
            ? repDetection.phase
            : requiresCalibration
              ? 'assessment setup'
              : 'rep assessment'
          : 'live tracking'
        : 'setup',
      ),
    },
    {
      label: 'Camera',
      value: formatUiStateLabel(webcam.status),
    },
    {
      label: 'Pose',
      value: formatUiStateLabel(pose.status),
    },
    {
      label: 'Tracking',
      value: personTrackingMessage,
    },
    {
      label: 'Visibility',
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
    squatRepDetection.reset()
    demoRepDetection.reset()
  }

  const restartFlow = () => {
    resetTrackingState()
    setSelectedCategory(null)
    setSelectedExerciseId(null)
    setTargetReps(null)
    setStep('intro')
  }

  const handleSelectExercise = (exerciseId: ExerciseId) => {
    resetTrackingState()
    setSelectedExerciseId(exerciseId)
    setTargetReps(null)
    setStep('exercise')
  }

  const handleChangeExercise = () => {
    resetTrackingState()
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
          <div className="hero-panel__control-stack">
            <button
              type="button"
              className={[
                'voice-toggle',
                !voiceCoach.isMuted && voiceCoach.isSupported
                  ? 'voice-toggle--active'
                  : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={voiceCoach.toggleMuted}
              disabled={!voiceCoach.isSupported}
              aria-pressed={voiceCoach.isSupported ? !voiceCoach.isMuted : false}
              aria-label={
                voiceCoach.isSupported
                  ? `${voiceCoach.isMuted ? 'Enable' : 'Disable'} voice coach`
                  : 'Voice coach unavailable'
              }
            >
              <span className="voice-toggle__label">Voice coach</span>
              <span className="voice-toggle__value">
                {voiceCoach.isSupported
                  ? voiceCoach.isMuted
                    ? 'Off'
                    : 'On'
                  : 'Unavailable'}
              </span>
            </button>

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
        </div>

        <p className="eyebrow">Cult Copilot</p>
        <h1>One camera flow for multiple workouts.</h1>
        <p className="hero-copy">
          Cult Copilot now combines a stronger multi-workout interface with the
          live pose-tracking pipeline from your original build. Bodyweight
          squat, forward lunge, conventional deadlift, push-ups, plank,
          shoulder press, and Arnold press run exercise-specific assessments.
          The rest stay on family-based live coaching with pose overlay and
          camera-quality guidance.
        </p>

        <div className="status-row">
          <span className={`status-pill status-pill--${getStatusTone(webcam.status)}`}>
            Camera: {formatUiStateLabel(webcam.status)}
          </span>
          <span className={`status-pill status-pill--${getStatusTone(pose.status)}`}>
            Pose: {formatUiStateLabel(pose.status)}
          </span>
          <span
            className={`status-pill status-pill--${getStatusTone(
              pose.personStatus,
            )}`}
          >
            Tracking: {formatUiStateLabel(pose.personStatus)}
          </span>
          <span className="status-pill status-pill--muted">
            Workout: {selectedExercise?.shortLabel ?? 'Choose a workout'}
          </span>
          <span
            className={`status-pill status-pill--${getVoiceStatusTone(
              voiceCoach.status,
            )}`}
          >
            Voice coach:{' '}
            {voiceCoach.isSupported
              ? voiceCoach.isMuted
                ? 'Off'
                : 'On'
              : 'Unavailable'}
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
            <h2>{getTrackingHeadline(selectedExercise, hasStructuredAssessment)}</h2>
          </div>

          <p className="form-flow__copy">
            {selectedExercise
              ? demoExercisePreset?.assessmentIntro ?? selectedExercise.description
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
                {step === 'assessment' && hasStructuredAssessment
                    ? formatUiStateLabel(repDetection.phase)
                    : selectedExercise
                    ? getAnalysisProfileLabel(selectedExercise.analysisProfile)
                    : 'Setup'}
              </span>
              <span className="status-pill status-pill--muted">
                {getRepHudLabel(
                  hasStructuredAssessment,
                  assessment.completedReps,
                  targetReps,
                  selectedExercise,
                )}
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
                description="This experience keeps Cult Copilot's stable browser-based pose tracking and pairs it with a broader workout flow, so the demo feels like a real product instead of a squat-only prototype."
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
                  <li>Bodyweight squat, forward lunge, conventional deadlift, push-ups, plank, shoulder press, and Arnold press use exercise-specific assessment logic.</li>
                  <li>Other workouts use family-based live coaching and error tracing.</li>
                  <li>Only calibration-based squat movements require a standing baseline step.</li>
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
                  movements and the featured demo exercises unlock the full
                  assessment flow. Other workouts use family-specific live
                  coaching, overlay, and camera-readiness feedback.
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
                    ? demoExercisePreset?.assessmentIntro ??
                      selectedExercise.description
                    : 'Pick a movement to continue into the camera and tracking flow.'}
                </p>

                {selectedExercise ? (
                  <>
                    <div className="form-flow__field">
                      <label
                        className="form-flow__field-label"
                        htmlFor="target-reps"
                      >
                        Target reps
                      </label>
                      <input
                        id="target-reps"
                        className="form-flow__input"
                        type="number"
                        inputMode="numeric"
                        min={MIN_TARGET_REPS}
                        max={MAX_TARGET_REPS}
                        step={1}
                        placeholder="Enter reps"
                        value={targetReps ?? ''}
                        onChange={handleTargetRepsChange}
                      />
                      <p className="form-flow__field-hint">
                        Choose how many reps you want to perform for this
                        exercise.
                      </p>
                    </div>

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
                          {hasStructuredAssessment
                            ? demoExercisePreset?.trackingSummary ??
                              'Calibration, rep counting, posture scoring, and a full results summary'
                            : 'Live pose overlay with family-based coaching'}
                        </dd>
                      </div>
                      <div>
                        <dt>Assessment model</dt>
                        <dd>
                          {hasStructuredAssessment
                            ? demoExercisePreset
                              ? 'Exercise-specific'
                              : 'Squat-specific'
                            : 'Live coaching'}
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
                title="Get your full body into frame"
                description={
                  selectedExercise
                    ? `${demoExercisePreset?.assessmentIntro ?? `Set up the camera for ${selectedExercise.shortLabel}.`} Target reps: ${targetReps ?? 'not set'}. Continue once the camera is live and tracking is locked.`
                    : 'Choose a workout first, then continue once the camera is live and tracking is locked.'
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
                        setStep(requiresCalibration ? 'calibration' : 'assessment')
                      }
                      disabled={!selectedExercise || !canContinueFromCamera}
                    >
                      {targetReps === null
                        ? 'Choose reps first'
                        : requiresCalibration
                          ? 'Continue to calibration'
                          : hasStructuredAssessment
                            ? 'Start assessment'
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
                  <li>Use a side angle for squat-family movements when possible.</li>
                  <li>Give the camera enough distance to avoid cropped limbs.</li>
                </ul>
              </article>
            </>
          ) : null}

          {step === 'calibration' && selectedExercise && requiresCalibration ? (
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
                        Start {targetReps ?? assessment.targetReps}-rep assessment
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
                    {hasStructuredAssessment ? 'Assessment' : 'Live Tracking'}
                  </p>
                  <h2>{selectedExercise.label}</h2>
                </div>

                <p className="form-flow__copy">
                  {hasStructuredAssessment
                    ? pose.personStatus !== 'detected'
                      ? 'Tracking was lost. Re-enter frame before continuing reps.'
                      : postureFeedback.activeWarning
                        ? `${postureFeedback.activeWarning.title}: ${postureFeedback.activeWarning.recommendation}`
                        : demoExercisePreset?.idleCue ??
                          `Move at a steady pace. The session completes after ${assessment.targetReps} valid reps.`
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
                  {hasStructuredAssessment ? (
                    <>
                      {requiresCalibration ? (
                        <button
                          type="button"
                          className="form-flow__button form-flow__button--secondary"
                          onClick={() => {
                            calibration.resetBaseline()
                            assessment.resetSession()
                            squatRepDetection.reset()
                            demoRepDetection.reset()
                            setStep('calibration')
                          }}
                        >
                          Recalibrate
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="form-flow__button form-flow__button--secondary"
                          onClick={() => setStep('camera-setup')}
                        >
                          Back to camera setup
                        </button>
                      )}
                      <button
                        type="button"
                        className="form-flow__button form-flow__button--secondary"
                        onClick={() => {
                          assessment.resetSession()
                          squatRepDetection.reset()
                          demoRepDetection.reset()
                        }}
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
                    <h3>Current view</h3>
                    <p>{formatUiStateLabel(step)}</p>
                  </div>
                  <div className="stack-item">
                    <h3>Reps detected</h3>
                    <p>{hasStructuredAssessment ? repDetection.repCount : 'N/A'}</p>
                  </div>
                  <div className="stack-item">
                    <h3>Reps scored</h3>
                    <p>{hasStructuredAssessment ? assessment.completedReps : 'N/A'}</p>
                  </div>
                  <div className="stack-item">
                    <h3>Lowest rep score</h3>
                    <p>
                      {hasStructuredAssessment
                        ? assessment.currentRepLowestScore !== null
                          ? assessment.currentRepLowestScore
                          : 'Waiting'
                        : 'Not used'}
                    </p>
                  </div>
                  <div className="stack-item">
                    <h3>Baseline captured</h3>
                    <p>
                      {requiresCalibration
                        ? calibration.baseline
                          ? 'Yes'
                          : 'No'
                        : 'Not required'}
                    </p>
                  </div>
                </div>
              </article>
            </>
          ) : null}

          {step === 'results' && selectedExercise && hasStructuredAssessment ? (
            <ResultsScreen
              results={assessment.results}
              onRestart={restartFlow}
              title={
                demoExercisePreset?.resultTitle ??
                `${selectedExercise.shortLabel} summary`
              }
            />
          ) : null}
        </div>
      </section>
    </main>
  )
}
