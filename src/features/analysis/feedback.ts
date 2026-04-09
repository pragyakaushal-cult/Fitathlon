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
  phase?: SquatPhase | null
  ruleConfig?: Partial<PostureRuleConfig>
  scoreWeights?: Partial<PostureScoreWeights>
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
}

const WARNING_ORDER: PostureWarningKey[] = [
  'kneeCollapse',
  'excessiveTorsoLean',
  'insufficientDepth',
  'leftRightAsymmetry',
]

export function buildPostureFeedback({
  metrics,
  landmarks,
  phase,
  ruleConfig,
  scoreWeights,
}: BuildPostureFeedbackOptions): PostureFeedback {
  const ruleEvaluation = evaluatePostureRules({
    metrics,
    landmarks,
    phase,
    config: ruleConfig,
  })
  const scoreBreakdown = scorePostureFlags(
    ruleEvaluation.flags,
    scoreWeights,
  )

  const triggeredWarnings = WARNING_ORDER.filter(
    (key) => ruleEvaluation.flags[key],
  ).map((key) => WARNING_LIBRARY[key])

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
