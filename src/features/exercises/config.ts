import type { AnalysisProfile } from '@/features/analysis/profiles'

export type ExerciseId = string
export type ExerciseCategory = 'lower_body' | 'upper_body'
export type ExerciseStatus = 'ready'
export type ExerciseFamily =
  | 'Push'
  | 'Pull'
  | 'Core'
  | 'Squats'
  | 'Lunges'
  | 'Glutes / Hips'
  | 'Deadlifts / Hinge'
  | 'Functional Lower Body'

export type ExerciseAnalysisProfile = AnalysisProfile

export interface ExerciseConfig {
  analysisProfile: ExerciseAnalysisProfile
  category: ExerciseCategory
  description: string
  family: ExerciseFamily
  focus: string[]
  id: ExerciseId
  label: string
  shortLabel: string
  status: ExerciseStatus
}

type ExerciseSeed = Omit<ExerciseConfig, 'id' | 'status'>

function toExerciseId(label: string) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

function createExercise(seed: ExerciseSeed): ExerciseConfig {
  return {
    ...seed,
    id: toExerciseId(seed.label),
    status: 'ready',
  }
}

const upperBodyPush = [
  'Push-ups',
  'Incline Push-ups',
  'Decline Push-ups',
  'Bench Press',
  'Dumbbell Chest Press',
  'Shoulder Press',
  'Arnold Press',
  'Pike Push-ups',
  'Tricep Dips',
  'Bench Dips',
  'Overhead Tricep Extension',
].map((label) =>
  createExercise({
    analysisProfile: 'push',
    category: 'upper_body',
    description: `Live coaching for ${label.toLowerCase()} with camera framing, visibility checks, and a full-body pose overlay.`,
    family: 'Push',
    focus: ['Shoulder stack', 'Arm path', 'Trunk alignment'],
    label,
    shortLabel: label,
  }),
)

const upperBodyPull = [
  'Pull-ups',
  'Chin-ups',
  'Assisted Pull-ups',
  'Lat Pulldown',
  'Seated Row',
  'Bent-over Row',
  'One-arm Dumbbell Row',
  'Face Pulls',
  'Reverse Fly',
].map((label) =>
  createExercise({
    analysisProfile: 'pull',
    category: 'upper_body',
    description: `Live coaching for ${label.toLowerCase()} with stable pose tracking and movement visibility checks.`,
    family: 'Pull',
    focus: ['Shoulder control', 'Arm path', 'Torso posture'],
    label,
    shortLabel: label,
  }),
)

const upperBodyCore = [
  'Plank',
  'Side Plank',
  'Mountain Climbers',
  'Bicycle Crunches',
  'Leg Raises',
  'Hanging Leg Raises',
  'Russian Twists',
  'Dead Bug',
].map((label) =>
  createExercise({
    analysisProfile: 'core',
    category: 'upper_body',
    description: `Live coaching for ${label.toLowerCase()} focused on trunk stability, alignment, and reliable landmark tracking.`,
    family: 'Core',
    focus: ['Trunk stability', 'Hip alignment', 'Balance'],
    label,
    shortLabel: label,
  }),
)

const lowerBodySquats = [
  'Bodyweight Squat',
  'Air Squat',
  'Goblet Squat',
  'Barbell Back Squat',
  'Front Squat',
  'Sumo Squat',
  'Overhead Squat',
  'Pulse Squats',
].map((label) =>
  createExercise({
    analysisProfile: 'squat',
    category: 'lower_body',
    description: `Full assessment for ${label.toLowerCase()} with baseline calibration, rep counting, live coaching, and a scored summary.`,
    family: 'Squats',
    focus: ['Hip depth', 'Knee angle', 'Torso lean'],
    label,
    shortLabel: label,
  }),
)

const lowerBodyLunges = [
  'Forward Lunge',
  'Reverse Lunge',
  'Walking Lunges',
  'Side Lunges',
  'Curtsy Lunges',
  'Bulgarian Split Squat',
].map((label) =>
  createExercise({
    analysisProfile: 'lunge',
    category: 'lower_body',
    description: `Live coaching for ${label.toLowerCase()} with split-stance tracking, balance checks, and posture cues.`,
    family: 'Lunges',
    focus: ['Split stance', 'Knee tracking', 'Balance'],
    label,
    shortLabel: label,
  }),
)

const lowerBodyGlutes = [
  {
    label: 'Hip Thrust',
    analysisProfile: 'hinge' as const,
  },
  {
    label: 'Glute Bridge',
    analysisProfile: 'core' as const,
  },
  {
    label: 'Single-leg Glute Bridge',
    analysisProfile: 'core' as const,
  },
  {
    label: 'Step-ups',
    analysisProfile: 'lunge' as const,
  },
  {
    label: 'Box Squats',
    analysisProfile: 'squat' as const,
  },
].map(({ label, analysisProfile }) =>
  createExercise({
    analysisProfile,
    category: 'lower_body',
    description: `Live coaching for ${label.toLowerCase()} with a focus on hip drive, pelvic control, and stable tracking.`,
    family: 'Glutes / Hips',
    focus: ['Hip drive', 'Pelvic control', 'Balance'],
    label,
    shortLabel: label,
  }),
)

const lowerBodyHinge = [
  'Conventional Deadlift',
  'Romanian Deadlift',
  'Sumo Deadlift',
  'Single-leg Deadlift',
].map((label) =>
  createExercise({
    analysisProfile: 'hinge',
    category: 'lower_body',
    description: `Live coaching for ${label.toLowerCase()} with hip-hinge tracking, knee-drive checks, and posture cues.`,
    family: 'Deadlifts / Hinge',
    focus: ['Hip hinge', 'Back angle', 'Balance'],
    label,
    shortLabel: label,
  }),
)

const lowerBodyFunctional = [
  {
    label: 'Jump Squats',
    analysisProfile: 'squat' as const,
  },
  {
    label: 'Box Jumps',
    analysisProfile: 'squat' as const,
  },
  {
    label: 'Kettlebell Swings',
    analysisProfile: 'hinge' as const,
  },
  {
    label: 'Wall Balls',
    analysisProfile: 'squat' as const,
  },
].map(({ label, analysisProfile }) =>
  createExercise({
    analysisProfile,
    category: 'lower_body',
    description: `Live coaching for ${label.toLowerCase()} with joint overlay and movement-control feedback.`,
    family: 'Functional Lower Body',
    focus: ['Movement path', 'Balance', 'Control'],
    label,
    shortLabel: label,
  }),
)

export const EXERCISE_CATALOG: ExerciseConfig[] = [
  ...lowerBodySquats,
  ...lowerBodyLunges,
  ...lowerBodyGlutes,
  ...lowerBodyHinge,
  ...lowerBodyFunctional,
  ...upperBodyPush,
  ...upperBodyPull,
  ...upperBodyCore,
]

export function getExerciseById(id: ExerciseId) {
  return EXERCISE_CATALOG.find((exercise) => exercise.id === id) ?? null
}
