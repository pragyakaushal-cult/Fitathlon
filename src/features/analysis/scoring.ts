import type { PostureRuleFlags } from './postureRules'

export interface PostureScoreWeights {
  excessiveTorsoLean: number
  kneeCollapse: number
  insufficientDepth: number
  leftRightAsymmetry: number
  insufficientHipHinge: number
  excessiveKneeDrive: number
  insufficientRangeOfMotion: number
  hipDrop: number
  hipPike: number
  shoulderInstability: number
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
  insufficientHipHinge: 30,
  excessiveKneeDrive: 25,
  insufficientRangeOfMotion: 30,
  hipDrop: 30,
  hipPike: 25,
  shoulderInstability: 20,
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
    insufficientHipHinge: flags.insufficientHipHinge
      ? resolvedWeights.insufficientHipHinge
      : 0,
    excessiveKneeDrive: flags.excessiveKneeDrive
      ? resolvedWeights.excessiveKneeDrive
      : 0,
    insufficientRangeOfMotion: flags.insufficientRangeOfMotion
      ? resolvedWeights.insufficientRangeOfMotion
      : 0,
    hipDrop: flags.hipDrop ? resolvedWeights.hipDrop : 0,
    hipPike: flags.hipPike ? resolvedWeights.hipPike : 0,
    shoulderInstability: flags.shoulderInstability
      ? resolvedWeights.shoulderInstability
      : 0,
  }

  const totalPenalty =
    penalties.excessiveTorsoLean +
    penalties.kneeCollapse +
    penalties.insufficientDepth +
    penalties.leftRightAsymmetry +
    penalties.insufficientHipHinge +
    penalties.excessiveKneeDrive +
    penalties.insufficientRangeOfMotion +
    penalties.hipDrop +
    penalties.hipPike +
    penalties.shoulderInstability

  return {
    postureScore: Math.max(0, 100 - totalPenalty),
    totalPenalty,
    penalties,
  }
}
