import { mapSquatLandmarks, midpoint, toPoint2D } from './geometry'
import type { SquatPhase } from './repStateMachine'
import type { FrameMetrics, PoseLandmarksInput } from './types'

export interface PostureRuleConfig {
  minPoseVisibility: number
  engagedKneeAngleDeg: number
  bottomEvaluationKneeAngleDeg: number
  torsoLeanWarningDeg: number
  kneeCollapseRatioThreshold: number
  insufficientDepthNormalized: number
  insufficientDepthAbsolute: number
  asymmetryScoreThreshold: number
}

export interface PostureRuleFlags {
  excessiveTorsoLean: boolean
  kneeCollapse: boolean
  insufficientDepth: boolean
  leftRightAsymmetry: boolean
}

export interface PostureRuleMeasurements {
  torsoLeanDeg: number | null
  leftKneeTrackingRatio: number | null
  rightKneeTrackingRatio: number | null
  minKneeTrackingRatio: number | null
  squatDepth: number | null
  squatDepthMode: 'normalized' | 'absolute' | null
  symmetryScore: number | null
}

export interface PostureRuleEvaluation {
  flags: PostureRuleFlags
  measurements: PostureRuleMeasurements
  isReliable: boolean
}

export interface EvaluatePostureRulesOptions {
  metrics: FrameMetrics | null
  landmarks: PoseLandmarksInput | null | undefined
  phase?: SquatPhase | null
  config?: Partial<PostureRuleConfig>
}

export const DEFAULT_POSTURE_RULE_CONFIG: PostureRuleConfig = {
  minPoseVisibility: 0.45,
  engagedKneeAngleDeg: 150,
  bottomEvaluationKneeAngleDeg: 125,
  torsoLeanWarningDeg: 36,
  kneeCollapseRatioThreshold: 0.72,
  insufficientDepthNormalized: 0.18,
  insufficientDepthAbsolute: 0.18,
  asymmetryScoreThreshold: 72,
}

function getEffectiveDepth(metrics: FrameMetrics) {
  if (
    metrics.hipDepthNormalized !== null &&
    Number.isFinite(metrics.hipDepthNormalized)
  ) {
    return {
      value: metrics.hipDepthNormalized,
      mode: 'normalized' as const,
    }
  }

  if (metrics.hipDepthPx !== null && Number.isFinite(metrics.hipDepthPx)) {
    return {
      value: metrics.hipDepthPx,
      mode: 'absolute' as const,
    }
  }

  return {
    value: null,
    mode: null,
  }
}

function getDepthThreshold(
  config: PostureRuleConfig,
  mode: 'normalized' | 'absolute' | null,
) {
  if (mode === 'normalized') {
    return config.insufficientDepthNormalized
  }

  if (mode === 'absolute') {
    return config.insufficientDepthAbsolute
  }

  return null
}

function computeKneeTrackingRatios(
  landmarks: PoseLandmarksInput | null | undefined,
) {
  const namedLandmarks = mapSquatLandmarks(landmarks)
  const hipCenter = midpoint(
    toPoint2D(namedLandmarks.leftHip),
    toPoint2D(namedLandmarks.rightHip),
  )

  if (!hipCenter) {
    return {
      leftKneeTrackingRatio: null,
      rightKneeTrackingRatio: null,
      minKneeTrackingRatio: null,
    }
  }

  const leftKnee = toPoint2D(namedLandmarks.leftKnee)
  const rightKnee = toPoint2D(namedLandmarks.rightKnee)
  const leftAnkle = toPoint2D(namedLandmarks.leftAnkle)
  const rightAnkle = toPoint2D(namedLandmarks.rightAnkle)

  const leftAnkleDistance =
    leftAnkle !== null ? Math.abs(leftAnkle.x - hipCenter.x) : null
  const rightAnkleDistance =
    rightAnkle !== null ? Math.abs(rightAnkle.x - hipCenter.x) : null
  const leftKneeDistance =
    leftKnee !== null ? Math.abs(leftKnee.x - hipCenter.x) : null
  const rightKneeDistance =
    rightKnee !== null ? Math.abs(rightKnee.x - hipCenter.x) : null

  const leftKneeTrackingRatio =
    leftKneeDistance !== null &&
    leftAnkleDistance !== null &&
    leftAnkleDistance > 0
      ? leftKneeDistance / leftAnkleDistance
      : null

  const rightKneeTrackingRatio =
    rightKneeDistance !== null &&
    rightAnkleDistance !== null &&
    rightAnkleDistance > 0
      ? rightKneeDistance / rightAnkleDistance
      : null

  const validRatios = [leftKneeTrackingRatio, rightKneeTrackingRatio].filter(
    (value): value is number => value !== null && Number.isFinite(value),
  )

  return {
    leftKneeTrackingRatio,
    rightKneeTrackingRatio,
    minKneeTrackingRatio:
      validRatios.length > 0 ? Math.min(...validRatios) : null,
  }
}

function isSquatActive(
  phase: SquatPhase | null | undefined,
  kneeAngleDeg: number | null,
  engagedKneeAngleDeg: number,
) {
  if (
    phase === 'descending' ||
    phase === 'bottom' ||
    phase === 'ascending' ||
    phase === 'complete'
  ) {
    return true
  }

  return kneeAngleDeg !== null && kneeAngleDeg <= engagedKneeAngleDeg
}

export function resolvePostureRuleConfig(
  config?: Partial<PostureRuleConfig>,
): PostureRuleConfig {
  return {
    ...DEFAULT_POSTURE_RULE_CONFIG,
    ...config,
  }
}

export function evaluatePostureRules({
  metrics,
  landmarks,
  phase,
  config,
}: EvaluatePostureRulesOptions): PostureRuleEvaluation {
  const resolvedConfig = resolvePostureRuleConfig(config)

  const defaultFlags: PostureRuleFlags = {
    excessiveTorsoLean: false,
    kneeCollapse: false,
    insufficientDepth: false,
    leftRightAsymmetry: false,
  }

  const depthMetric = metrics ? getEffectiveDepth(metrics) : { value: null, mode: null }
  const kneeTracking = computeKneeTrackingRatios(landmarks)

  const measurements: PostureRuleMeasurements = {
    torsoLeanDeg: metrics?.torsoLeanDeg ?? null,
    leftKneeTrackingRatio: kneeTracking.leftKneeTrackingRatio,
    rightKneeTrackingRatio: kneeTracking.rightKneeTrackingRatio,
    minKneeTrackingRatio: kneeTracking.minKneeTrackingRatio,
    squatDepth: depthMetric.value,
    squatDepthMode: depthMetric.mode,
    symmetryScore: metrics?.symmetryScore ?? null,
  }

  const isReliable =
    !!metrics &&
    metrics.poseDetected &&
    metrics.averageVisibility !== null &&
    metrics.averageVisibility >= resolvedConfig.minPoseVisibility

  if (!isReliable || !metrics) {
    return {
      flags: defaultFlags,
      measurements,
      isReliable: false,
    }
  }

  const kneeAngleDeg = metrics.averageKneeAngleDeg
  const isActive = isSquatActive(
    phase,
    kneeAngleDeg,
    resolvedConfig.engagedKneeAngleDeg,
  )
  const depthThreshold = getDepthThreshold(
    resolvedConfig,
    measurements.squatDepthMode,
  )
  const evaluateDepth =
    kneeAngleDeg !== null &&
    kneeAngleDeg <= resolvedConfig.bottomEvaluationKneeAngleDeg

  const flags: PostureRuleFlags = {
    excessiveTorsoLean:
      isActive &&
      measurements.torsoLeanDeg !== null &&
      measurements.torsoLeanDeg >= resolvedConfig.torsoLeanWarningDeg,
    kneeCollapse:
      isActive &&
      measurements.minKneeTrackingRatio !== null &&
      measurements.minKneeTrackingRatio <=
        resolvedConfig.kneeCollapseRatioThreshold,
    insufficientDepth:
      isActive &&
      evaluateDepth &&
      depthThreshold !== null &&
      measurements.squatDepth !== null &&
      measurements.squatDepth < depthThreshold,
    leftRightAsymmetry:
      isActive &&
      measurements.symmetryScore !== null &&
      measurements.symmetryScore <= resolvedConfig.asymmetryScoreThreshold,
  }

  return {
    flags,
    measurements,
    isReliable: true,
  }
}
