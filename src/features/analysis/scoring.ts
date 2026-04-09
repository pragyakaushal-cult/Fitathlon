import type { PostureRuleFlags } from './postureRules'

export interface PostureScoreWeights {
  excessiveTorsoLean: number
  kneeCollapse: number
  insufficientDepth: number
  leftRightAsymmetry: number
}

export interface PostureScoreBreakdown {
  postureScore: number
  totalPenalty: number
  penalties: PostureScoreWeights
}

export const DEFAULT_POSTURE_SCORE_WEIGHTS: PostureScoreWeights = {
  excessiveTorsoLean: 30,
  kneeCollapse: 30,
  insufficientDepth: 25,
  leftRightAsymmetry: 15,
}

export function resolvePostureScoreWeights(
  weights?: Partial<PostureScoreWeights>,
): PostureScoreWeights {
  return {
    ...DEFAULT_POSTURE_SCORE_WEIGHTS,
    ...weights,
  }
}

export function scorePostureFlags(
  flags: PostureRuleFlags,
  weights?: Partial<PostureScoreWeights>,
): PostureScoreBreakdown {
  const resolvedWeights = resolvePostureScoreWeights(weights)

  const penalties: PostureScoreWeights = {
    excessiveTorsoLean: flags.excessiveTorsoLean
      ? resolvedWeights.excessiveTorsoLean
      : 0,
    kneeCollapse: flags.kneeCollapse ? resolvedWeights.kneeCollapse : 0,
    insufficientDepth: flags.insufficientDepth
      ? resolvedWeights.insufficientDepth
      : 0,
    leftRightAsymmetry: flags.leftRightAsymmetry
      ? resolvedWeights.leftRightAsymmetry
      : 0,
  }

  const totalPenalty =
    penalties.excessiveTorsoLean +
    penalties.kneeCollapse +
    penalties.insufficientDepth +
    penalties.leftRightAsymmetry

  return {
    postureScore: Math.max(0, 100 - totalPenalty),
    totalPenalty,
    penalties,
  }
}
