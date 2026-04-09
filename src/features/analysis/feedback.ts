import type { AnalysisProfile } from './profiles'
import type { SquatPhase } from './repStateMachine'
import {
  evaluatePostureRules,
  type PostureRuleConfig,
  type PostureRuleEvaluation,
  type PostureRuleFlags,
} from './postureRules'
import {
  scorePostureFlags,
  type PostureScoreBreakdown,
  type PostureScoreWeights,
} from './scoring'
import type { FrameMetrics, PoseLandmarksInput } from './types'

export type PostureWarningKey =
  | 'excessiveTorsoLean'
  | 'kneeCollapse'
  | 'insufficientDepth'
  | 'leftRightAsymmetry'
  | 'insufficientHipHinge'
  | 'excessiveKneeDrive'
  | 'insufficientRangeOfMotion'
  | 'hipDrop'
  | 'hipPike'
  | 'shoulderInstability'

export interface PostureWarning {
  key: PostureWarningKey
  title: string
  message: string
  recommendation: string
  priority: number
}

export interface PostureFeedback {
  activeWarning: PostureWarning | null
  triggeredWarnings: PostureWarning[]
  rawRuleFlags: PostureRuleFlags
  postureScore: number
  recommendationStrings: string[]
  ruleEvaluation: PostureRuleEvaluation
  scoreBreakdown: PostureScoreBreakdown
}

export interface BuildPostureFeedbackOptions {
  metrics: FrameMetrics | null
  landmarks: PoseLandmarksInput | null | undefined
  profile?: AnalysisProfile | null
  phase?: SquatPhase | null
  ruleConfig?: Partial<PostureRuleConfig>
  scoreWeights?: Partial<PostureScoreWeights>
  warningOverrides?: Partial<
    Record<PostureWarningKey, Partial<PostureWarning>>
  >
}

const WARNING_LIBRARY: Record<PostureWarningKey, PostureWarning> = {
  kneeCollapse: {
    key: 'kneeCollapse',
    title: 'Drive knees out',
    message: 'Your knees are tracking inward. Keep them over your toes.',
    recommendation: 'Press your knees slightly outward as you squat.',
    priority: 1,
  },
  excessiveTorsoLean: {
    key: 'excessiveTorsoLean',
    title: 'Keep chest up',
    message: 'Your torso is leaning too far forward.',
    recommendation: 'Lift the chest and keep the torso more upright.',
    priority: 2,
  },
  insufficientDepth: {
    key: 'insufficientDepth',
    title: 'Squat deeper',
    message: 'You are not reaching your target squat depth.',
    recommendation: 'Sit the hips lower before driving back up.',
    priority: 3,
  },
  leftRightAsymmetry: {
    key: 'leftRightAsymmetry',
    title: 'Balance both sides',
    message: 'One side is moving differently from the other.',
    recommendation: 'Slow down and keep pressure even through both legs.',
    priority: 4,
  },
  insufficientHipHinge: {
    key: 'insufficientHipHinge',
    title: 'Push hips back',
    message: 'The movement looks too upright for a hinge pattern.',
    recommendation: 'Send the hips back more before driving through the rep.',
    priority: 3,
  },
  excessiveKneeDrive: {
    key: 'excessiveKneeDrive',
    title: 'Soften the knees',
    message: 'Your knees are taking over instead of the hinge.',
    recommendation: 'Keep a soft bend in the knees and load the hips more.',
    priority: 4,
  },
  insufficientRangeOfMotion: {
    key: 'insufficientRangeOfMotion',
    title: 'Use more range',
    message: 'The rep is staying short and not reaching full working range.',
    recommendation: 'Move deeper into the rep while staying controlled.',
    priority: 3,
  },
  hipDrop: {
    key: 'hipDrop',
    title: 'Keep hips up',
    message: 'Your midline is sagging and losing tension.',
    recommendation: 'Brace harder and keep the body in one strong line.',
    priority: 1,
  },
  hipPike: {
    key: 'hipPike',
    title: 'Lower the hips',
    message: 'Your hips are drifting too high and breaking the line.',
    recommendation: 'Bring the hips back into line with shoulders and ankles.',
    priority: 2,
  },
  shoulderInstability: {
    key: 'shoulderInstability',
    title: 'Even out the shoulders',
    message: 'Your left and right arm path are not moving evenly.',
    recommendation: 'Slow down and keep both shoulders and arms moving together.',
    priority: 4,
  },
}

const WARNING_ORDER: PostureWarningKey[] = [
  'kneeCollapse',
  'hipDrop',
  'hipPike',
  'insufficientHipHinge',
  'insufficientRangeOfMotion',
  'shoulderInstability',
  'excessiveKneeDrive',
  'excessiveTorsoLean',
  'insufficientDepth',
  'leftRightAsymmetry',
]

export function buildPostureFeedback({
  metrics,
  landmarks,
  profile = 'squat',
  phase,
  ruleConfig,
  scoreWeights,
  warningOverrides,
}: BuildPostureFeedbackOptions): PostureFeedback {
  const ruleEvaluation = evaluatePostureRules({
    metrics,
    landmarks,
    profile,
    phase,
    config: ruleConfig,
  })
  const scoreBreakdown = scorePostureFlags(
    ruleEvaluation.flags,
    scoreWeights,
  )

  const triggeredWarnings = WARNING_ORDER.filter(
    (key) => ruleEvaluation.flags[key],
  ).map((key) => ({
    ...WARNING_LIBRARY[key],
    ...warningOverrides?.[key],
  }))

  return {
    activeWarning: triggeredWarnings[0] ?? null,
    triggeredWarnings,
    rawRuleFlags: ruleEvaluation.flags,
    postureScore: scoreBreakdown.postureScore,
    recommendationStrings:
      triggeredWarnings.length > 0
        ? triggeredWarnings.map((warning) => warning.recommendation)
        : ['Form looks stable. Keep the same tempo and bracing.'],
    ruleEvaluation,
    scoreBreakdown,
  }
}
