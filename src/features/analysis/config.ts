export interface DepthThreshold {
  normalized: number
  absolute: number
}

export interface RepDetectionConfig {
  minPoseVisibility: number
  descendingKneeAngleDeg: number
  bottomKneeAngleDeg: number
  ascendingKneeAngleDeg: number
  standingKneeAngleDeg: number
  descendingHipDepth: DepthThreshold
  bottomHipDepth: DepthThreshold
  ascendingHipDepth: DepthThreshold
  standingHipDepth: DepthThreshold
  depthDeltaEpsilon: DepthThreshold
  minPhaseDurationMs: number
  minBottomHoldMs: number
  minCompleteHoldMs: number
  minRepIntervalMs: number
}

export const DEFAULT_REP_DETECTION_CONFIG: RepDetectionConfig = {
  minPoseVisibility: 0.45,
  descendingKneeAngleDeg: 160,
  bottomKneeAngleDeg: 110,
  ascendingKneeAngleDeg: 125,
  standingKneeAngleDeg: 165,
  descendingHipDepth: {
    normalized: 0.08,
    absolute: 0.08,
  },
  bottomHipDepth: {
    normalized: 0.2,
    absolute: 0.2,
  },
  ascendingHipDepth: {
    normalized: 0.16,
    absolute: 0.16,
  },
  standingHipDepth: {
    normalized: 0.05,
    absolute: 0.05,
  },
  depthDeltaEpsilon: {
    normalized: 0.01,
    absolute: 0.01,
  },
  minPhaseDurationMs: 120,
  minBottomHoldMs: 90,
  minCompleteHoldMs: 120,
  minRepIntervalMs: 700,
}

export function resolveRepDetectionConfig(
  config?: Partial<RepDetectionConfig>,
): RepDetectionConfig {
  return {
    ...DEFAULT_REP_DETECTION_CONFIG,
    ...config,
    descendingHipDepth: {
      ...DEFAULT_REP_DETECTION_CONFIG.descendingHipDepth,
      ...config?.descendingHipDepth,
    },
    bottomHipDepth: {
      ...DEFAULT_REP_DETECTION_CONFIG.bottomHipDepth,
      ...config?.bottomHipDepth,
    },
    ascendingHipDepth: {
      ...DEFAULT_REP_DETECTION_CONFIG.ascendingHipDepth,
      ...config?.ascendingHipDepth,
    },
    standingHipDepth: {
      ...DEFAULT_REP_DETECTION_CONFIG.standingHipDepth,
      ...config?.standingHipDepth,
    },
    depthDeltaEpsilon: {
      ...DEFAULT_REP_DETECTION_CONFIG.depthDeltaEpsilon,
      ...config?.depthDeltaEpsilon,
    },
  }
}
