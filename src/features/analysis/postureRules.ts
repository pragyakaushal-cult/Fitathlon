import type { AnalysisProfile } from './profiles'
import { mapSquatLandmarks, midpoint, toPoint2D } from './geometry'
import type { SquatPhase } from './repStateMachine'
import type { FrameMetrics, PoseLandmarksInput } from './types'

export interface PostureRuleConfig {
  minPoseVisibility: number
  lowerBodyEngagedKneeAngleDeg: number
  upperBodyEngagedElbowAngleDeg: number
  pushEvaluationMode: 'horizontal' | 'vertical'
  squatBottomEvaluationKneeAngleDeg: number
  squatTorsoLeanWarningDeg: number
  squatKneeCollapseRatioThreshold: number
  squatInsufficientDepthNormalized: number
  squatInsufficientDepthAbsolute: number
  squatAsymmetryScoreThreshold: number
  lungeTorsoLeanWarningDeg: number
  lungeKneeCollapseRatioThreshold: number
  lungeDepthKneeAngleDeg: number
  lungeAsymmetryScoreThreshold: number
  hingeActiveTorsoLeanDeg: number
  hingeMinTorsoLeanDeg: number
  hingeExcessiveKneeDriveDeg: number
  hingeAsymmetryScoreThreshold: number
  pushDepthElbowAngleDeg: number
  pushVerticalLockoutElbowAngleDeg: number
  pushVerticalReachThreshold: number
  pushVerticalTorsoLeanWarningDeg: number
  pushVerticalKneeDriveAngleDeg: number
  pushHipDropThreshold: number
  pushHipPikeThreshold: number
  pushShoulderInstabilityThreshold: number
  pullRangeOfMotionElbowAngleDeg: number
  pullTorsoLeanWarningDeg: number
  pullShoulderInstabilityThreshold: number
  coreHipDropThreshold: number
  coreHipPikeThreshold: number
  coreShoulderInstabilityThreshold: number
}

export interface PostureRuleFlags {
  excessiveTorsoLean: boolean
  kneeCollapse: boolean
  insufficientDepth: boolean
  leftRightAsymmetry: boolean
  insufficientHipHinge: boolean
  excessiveKneeDrive: boolean
  insufficientRangeOfMotion: boolean
  hipDrop: boolean
  hipPike: boolean
  shoulderInstability: boolean
}

export interface PostureRuleMeasurements {
  torsoLeanDeg: number | null
  minKneeAngleDeg: number | null
  leftKneeTrackingRatio: number | null
  rightKneeTrackingRatio: number | null
  minKneeTrackingRatio: number | null
  squatDepth: number | null
  squatDepthMode: 'normalized' | 'absolute' | null
  symmetryScore: number | null
  leftElbowAngleDeg: number | null
  rightElbowAngleDeg: number | null
  averageElbowAngleDeg: number | null
  elbowSymmetryScore: number | null
  averageWristOverShoulderNormalized: number | null
  minWristOverShoulderNormalized: number | null
  bodyLineAngleDeg: number | null
  bodyLineOffsetNormalized: number | null
}

export interface PostureRuleEvaluation {
  flags: PostureRuleFlags
  measurements: PostureRuleMeasurements
  isReliable: boolean
}

export interface EvaluatePostureRulesOptions {
  metrics: FrameMetrics | null
  landmarks: PoseLandmarksInput | null | undefined
  profile?: AnalysisProfile | null
  phase?: SquatPhase | null
  config?: Partial<PostureRuleConfig>
}

export const DEFAULT_POSTURE_RULE_CONFIG: PostureRuleConfig = {
  minPoseVisibility: 0.45,
  lowerBodyEngagedKneeAngleDeg: 150,
  upperBodyEngagedElbowAngleDeg: 150,
  pushEvaluationMode: 'horizontal',
  squatBottomEvaluationKneeAngleDeg: 125,
  squatTorsoLeanWarningDeg: 36,
  squatKneeCollapseRatioThreshold: 0.72,
  squatInsufficientDepthNormalized: 0.18,
  squatInsufficientDepthAbsolute: 0.18,
  squatAsymmetryScoreThreshold: 72,
  lungeTorsoLeanWarningDeg: 34,
  lungeKneeCollapseRatioThreshold: 0.7,
  lungeDepthKneeAngleDeg: 112,
  lungeAsymmetryScoreThreshold: 68,
  hingeActiveTorsoLeanDeg: 12,
  hingeMinTorsoLeanDeg: 28,
  hingeExcessiveKneeDriveDeg: 132,
  hingeAsymmetryScoreThreshold: 70,
  pushDepthElbowAngleDeg: 112,
  pushVerticalLockoutElbowAngleDeg: 154,
  pushVerticalReachThreshold: 0.05,
  pushVerticalTorsoLeanWarningDeg: 24,
  pushVerticalKneeDriveAngleDeg: 150,
  pushHipDropThreshold: 0.04,
  pushHipPikeThreshold: 0.04,
  pushShoulderInstabilityThreshold: 72,
  pullRangeOfMotionElbowAngleDeg: 96,
  pullTorsoLeanWarningDeg: 42,
  pullShoulderInstabilityThreshold: 70,
  coreHipDropThreshold: 0.035,
  coreHipPikeThreshold: 0.035,
  coreShoulderInstabilityThreshold: 72,
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
    return config.squatInsufficientDepthNormalized
  }

  if (mode === 'absolute') {
    return config.squatInsufficientDepthAbsolute
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
  minKneeAngleDeg: number | null,
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

  return minKneeAngleDeg !== null && minKneeAngleDeg <= engagedKneeAngleDeg
}

function isUpperBodyActive(
  averageElbowAngleDeg: number | null,
  engagedElbowAngleDeg: number,
) {
  return (
    averageElbowAngleDeg !== null &&
    averageElbowAngleDeg <= engagedElbowAngleDeg
  )
}

function createDefaultFlags(): PostureRuleFlags {
  return {
    excessiveTorsoLean: false,
    kneeCollapse: false,
    insufficientDepth: false,
    leftRightAsymmetry: false,
    insufficientHipHinge: false,
    excessiveKneeDrive: false,
    insufficientRangeOfMotion: false,
    hipDrop: false,
    hipPike: false,
    shoulderInstability: false,
  }
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
  profile = 'squat',
  phase,
  config,
}: EvaluatePostureRulesOptions): PostureRuleEvaluation {
  const resolvedConfig = resolvePostureRuleConfig(config)
  const defaultFlags = createDefaultFlags()

  const depthMetric = metrics ? getEffectiveDepth(metrics) : { value: null, mode: null }
  const kneeTracking = computeKneeTrackingRatios(landmarks)

  const measurements: PostureRuleMeasurements = {
    torsoLeanDeg: metrics?.torsoLeanDeg ?? null,
    minKneeAngleDeg: metrics?.minKneeAngleDeg ?? null,
    leftKneeTrackingRatio: kneeTracking.leftKneeTrackingRatio,
    rightKneeTrackingRatio: kneeTracking.rightKneeTrackingRatio,
    minKneeTrackingRatio: kneeTracking.minKneeTrackingRatio,
    squatDepth: depthMetric.value,
    squatDepthMode: depthMetric.mode,
    symmetryScore: metrics?.symmetryScore ?? null,
    leftElbowAngleDeg: metrics?.leftElbowAngleDeg ?? null,
    rightElbowAngleDeg: metrics?.rightElbowAngleDeg ?? null,
    averageElbowAngleDeg: metrics?.averageElbowAngleDeg ?? null,
    elbowSymmetryScore: metrics?.elbowSymmetryScore ?? null,
    averageWristOverShoulderNormalized:
      metrics?.averageWristOverShoulderNormalized ?? null,
    minWristOverShoulderNormalized:
      metrics?.minWristOverShoulderNormalized ?? null,
    bodyLineAngleDeg: metrics?.bodyLineAngleDeg ?? null,
    bodyLineOffsetNormalized: metrics?.bodyLineOffsetNormalized ?? null,
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

  const isLowerBodyActive = isSquatActive(
    phase,
    measurements.minKneeAngleDeg,
    resolvedConfig.lowerBodyEngagedKneeAngleDeg,
  )
  const isUpperBodyPatternActive = isUpperBodyActive(
    measurements.averageElbowAngleDeg,
    resolvedConfig.upperBodyEngagedElbowAngleDeg,
  )
  const isActiveRepPhase =
    phase === 'descending' ||
    phase === 'bottom' ||
    phase === 'ascending' ||
    phase === 'holding' ||
    phase === 'complete'
  const isHingeActive =
    (measurements.torsoLeanDeg !== null &&
      measurements.torsoLeanDeg >= resolvedConfig.hingeActiveTorsoLeanDeg) ||
    (measurements.minKneeAngleDeg !== null &&
      measurements.minKneeAngleDeg < 170)

  let flags = createDefaultFlags()

  switch (profile) {
    case 'lunge':
      flags = {
        ...defaultFlags,
        excessiveTorsoLean:
          isLowerBodyActive &&
          measurements.torsoLeanDeg !== null &&
          measurements.torsoLeanDeg >= resolvedConfig.lungeTorsoLeanWarningDeg,
        kneeCollapse:
          isLowerBodyActive &&
          measurements.minKneeTrackingRatio !== null &&
          measurements.minKneeTrackingRatio <=
            resolvedConfig.lungeKneeCollapseRatioThreshold,
        insufficientDepth:
          isLowerBodyActive &&
          measurements.minKneeAngleDeg !== null &&
          measurements.minKneeAngleDeg > resolvedConfig.lungeDepthKneeAngleDeg,
        leftRightAsymmetry:
          isLowerBodyActive &&
          measurements.symmetryScore !== null &&
          measurements.symmetryScore <=
            resolvedConfig.lungeAsymmetryScoreThreshold,
      }
      break
    case 'hinge':
      flags = {
        ...defaultFlags,
        insufficientHipHinge:
          isHingeActive &&
          measurements.torsoLeanDeg !== null &&
          measurements.torsoLeanDeg < resolvedConfig.hingeMinTorsoLeanDeg,
        excessiveKneeDrive:
          isHingeActive &&
          measurements.minKneeAngleDeg !== null &&
          measurements.minKneeAngleDeg < resolvedConfig.hingeExcessiveKneeDriveDeg,
        leftRightAsymmetry:
          measurements.symmetryScore !== null &&
          measurements.symmetryScore <=
            resolvedConfig.hingeAsymmetryScoreThreshold,
      }
      break
    case 'push':
      if (resolvedConfig.pushEvaluationMode === 'vertical') {
        const hasOverheadReach =
          measurements.minWristOverShoulderNormalized !== null &&
          measurements.minWristOverShoulderNormalized >=
            resolvedConfig.pushVerticalReachThreshold
        const hasLockout =
          measurements.averageElbowAngleDeg !== null &&
          measurements.averageElbowAngleDeg >=
            resolvedConfig.pushVerticalLockoutElbowAngleDeg
        const isVerticalPushActive = isActiveRepPhase || isUpperBodyPatternActive

        flags = {
          ...defaultFlags,
          insufficientRangeOfMotion:
            isVerticalPushActive && (!hasOverheadReach || !hasLockout),
          excessiveTorsoLean:
            isVerticalPushActive &&
            measurements.torsoLeanDeg !== null &&
            measurements.torsoLeanDeg >=
              resolvedConfig.pushVerticalTorsoLeanWarningDeg,
          excessiveKneeDrive:
            isVerticalPushActive &&
            measurements.minKneeAngleDeg !== null &&
            measurements.minKneeAngleDeg <
              resolvedConfig.pushVerticalKneeDriveAngleDeg,
          shoulderInstability:
            isVerticalPushActive &&
            measurements.elbowSymmetryScore !== null &&
            measurements.elbowSymmetryScore <=
              resolvedConfig.pushShoulderInstabilityThreshold,
        }
        break
      }

      flags = {
        ...defaultFlags,
        insufficientRangeOfMotion:
          isUpperBodyPatternActive &&
          measurements.averageElbowAngleDeg !== null &&
          measurements.averageElbowAngleDeg >
            resolvedConfig.pushDepthElbowAngleDeg,
        hipDrop:
          measurements.bodyLineOffsetNormalized !== null &&
          measurements.bodyLineOffsetNormalized >=
            resolvedConfig.pushHipDropThreshold,
        hipPike:
          measurements.bodyLineOffsetNormalized !== null &&
          measurements.bodyLineOffsetNormalized <=
            -resolvedConfig.pushHipPikeThreshold,
        shoulderInstability:
          isUpperBodyPatternActive &&
          measurements.elbowSymmetryScore !== null &&
          measurements.elbowSymmetryScore <=
            resolvedConfig.pushShoulderInstabilityThreshold,
      }
      break
    case 'pull':
      flags = {
        ...defaultFlags,
        insufficientRangeOfMotion:
          isUpperBodyPatternActive &&
          measurements.averageElbowAngleDeg !== null &&
          measurements.averageElbowAngleDeg >
            resolvedConfig.pullRangeOfMotionElbowAngleDeg,
        excessiveTorsoLean:
          measurements.torsoLeanDeg !== null &&
          measurements.torsoLeanDeg >= resolvedConfig.pullTorsoLeanWarningDeg,
        shoulderInstability:
          isUpperBodyPatternActive &&
          measurements.elbowSymmetryScore !== null &&
          measurements.elbowSymmetryScore <=
            resolvedConfig.pullShoulderInstabilityThreshold,
        leftRightAsymmetry:
          measurements.elbowSymmetryScore !== null &&
          measurements.elbowSymmetryScore <=
            resolvedConfig.pullShoulderInstabilityThreshold,
      }
      break
    case 'core':
      flags = {
        ...defaultFlags,
        hipDrop:
          measurements.bodyLineOffsetNormalized !== null &&
          measurements.bodyLineOffsetNormalized >=
            resolvedConfig.coreHipDropThreshold,
        hipPike:
          measurements.bodyLineOffsetNormalized !== null &&
          measurements.bodyLineOffsetNormalized <=
            -resolvedConfig.coreHipPikeThreshold,
        shoulderInstability:
          measurements.elbowSymmetryScore !== null &&
          measurements.elbowSymmetryScore <=
            resolvedConfig.coreShoulderInstabilityThreshold,
      }
      break
    case 'squat':
    default: {
      const depthThreshold = getDepthThreshold(
        resolvedConfig,
        measurements.squatDepthMode,
      )
      const evaluateDepth =
        measurements.minKneeAngleDeg !== null &&
        measurements.minKneeAngleDeg <=
          resolvedConfig.squatBottomEvaluationKneeAngleDeg

      flags = {
        ...defaultFlags,
        excessiveTorsoLean:
          isLowerBodyActive &&
          measurements.torsoLeanDeg !== null &&
          measurements.torsoLeanDeg >= resolvedConfig.squatTorsoLeanWarningDeg,
        kneeCollapse:
          isLowerBodyActive &&
          measurements.minKneeTrackingRatio !== null &&
          measurements.minKneeTrackingRatio <=
            resolvedConfig.squatKneeCollapseRatioThreshold,
        insufficientDepth:
          isLowerBodyActive &&
          evaluateDepth &&
          depthThreshold !== null &&
          measurements.squatDepth !== null &&
          measurements.squatDepth < depthThreshold,
        leftRightAsymmetry:
          isLowerBodyActive &&
          measurements.symmetryScore !== null &&
          measurements.symmetryScore <=
            resolvedConfig.squatAsymmetryScoreThreshold,
      }
      break
    }
  }

  return {
    flags,
    measurements,
    isReliable: true,
  }
}
