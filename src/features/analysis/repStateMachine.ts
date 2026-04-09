import { DEFAULT_REP_DETECTION_CONFIG, resolveRepDetectionConfig, type DepthThreshold, type RepDetectionConfig } from './config'
import type { FrameMetrics } from './types'

export type SquatPhase =
  | 'idle'
  | 'descending'
  | 'bottom'
  | 'ascending'
  | 'holding'
  | 'complete'

type DepthMode = 'normalized' | 'absolute' | null

export interface RepDetectionDebugInfo {
  timestampMs: number | null
  averageVisibility: number | null
  kneeAngleDeg: number | null
  hipDepth: number | null
  hipDepthMode: DepthMode
  previousHipDepth: number | null
  hipDepthDelta: number | null
  phaseDurationMs: number
  msSinceLastRep: number | null
  transitionReason: string
  thresholds: {
    descendingKneeAngleDeg: number
    bottomKneeAngleDeg: number
    ascendingKneeAngleDeg: number
    standingKneeAngleDeg: number
    descendingHipDepth: number | null
    bottomHipDepth: number | null
    ascendingHipDepth: number | null
    standingHipDepth: number | null
    depthDeltaEpsilon: number | null
  }
}

export interface RepDetectionSnapshot {
  phase: SquatPhase
  repCount: number
  lastRepTimestampMs: number | null
  lastTransitionTimestampMs: number | null
  debug: RepDetectionDebugInfo
}

interface InternalState {
  phase: SquatPhase
  repCount: number
  lastRepTimestampMs: number | null
  lastTransitionTimestampMs: number | null
  phaseStartedAtMs: number | null
  previousHipDepth: number | null
  transitionReason: string
}

interface EffectiveDepthMetric {
  value: number | null
  mode: DepthMode
}

const DEFAULT_INTERNAL_STATE: InternalState = {
  phase: 'idle',
  repCount: 0,
  lastRepTimestampMs: null,
  lastTransitionTimestampMs: null,
  phaseStartedAtMs: null,
  previousHipDepth: null,
  transitionReason: 'waiting_for_pose',
}

function getEffectiveDepthMetric(metrics: FrameMetrics): EffectiveDepthMetric {
  if (metrics.hipDepthNormalized !== null && Number.isFinite(metrics.hipDepthNormalized)) {
    return {
      value: metrics.hipDepthNormalized,
      mode: 'normalized',
    }
  }

  if (metrics.hipDepthPx !== null && Number.isFinite(metrics.hipDepthPx)) {
    return {
      value: metrics.hipDepthPx,
      mode: 'absolute',
    }
  }

  return {
    value: null,
    mode: null,
  }
}

function getThresholdValue(
  threshold: DepthThreshold,
  mode: DepthMode,
): number | null {
  if (!mode) {
    return null
  }

  return mode === 'normalized' ? threshold.normalized : threshold.absolute
}

function getPhaseDurationMs(
  nowMs: number,
  phaseStartedAtMs: number | null,
): number {
  if (phaseStartedAtMs === null) {
    return 0
  }

  return Math.max(0, nowMs - phaseStartedAtMs)
}

function createDebugInfo(
  metrics: FrameMetrics | null,
  config: RepDetectionConfig,
  state: InternalState,
): RepDetectionDebugInfo {
  const timestampMs = metrics?.timestampMs ?? null
  const depthMetric = metrics ? getEffectiveDepthMetric(metrics) : { value: null, mode: null as DepthMode }
  const hipDepthDelta =
    depthMetric.value !== null && state.previousHipDepth !== null
      ? depthMetric.value - state.previousHipDepth
      : null
  const msSinceLastRep =
    timestampMs !== null && state.lastRepTimestampMs !== null
      ? timestampMs - state.lastRepTimestampMs
      : null

  return {
    timestampMs,
    averageVisibility: metrics?.averageVisibility ?? null,
    kneeAngleDeg: metrics?.averageKneeAngleDeg ?? null,
    hipDepth: depthMetric.value,
    hipDepthMode: depthMetric.mode,
    previousHipDepth: state.previousHipDepth,
    hipDepthDelta,
    phaseDurationMs:
      timestampMs !== null
        ? getPhaseDurationMs(timestampMs, state.phaseStartedAtMs)
        : 0,
    msSinceLastRep,
    transitionReason: state.transitionReason,
    thresholds: {
      descendingKneeAngleDeg: config.descendingKneeAngleDeg,
      bottomKneeAngleDeg: config.bottomKneeAngleDeg,
      ascendingKneeAngleDeg: config.ascendingKneeAngleDeg,
      standingKneeAngleDeg: config.standingKneeAngleDeg,
      descendingHipDepth: getThresholdValue(
        config.descendingHipDepth,
        depthMetric.mode,
      ),
      bottomHipDepth: getThresholdValue(config.bottomHipDepth, depthMetric.mode),
      ascendingHipDepth: getThresholdValue(
        config.ascendingHipDepth,
        depthMetric.mode,
      ),
      standingHipDepth: getThresholdValue(
        config.standingHipDepth,
        depthMetric.mode,
      ),
      depthDeltaEpsilon: getThresholdValue(
        config.depthDeltaEpsilon,
        depthMetric.mode,
      ),
    },
  }
}

function createSnapshot(
  metrics: FrameMetrics | null,
  config: RepDetectionConfig,
  state: InternalState,
): RepDetectionSnapshot {
  return {
    phase: state.phase,
    repCount: state.repCount,
    lastRepTimestampMs: state.lastRepTimestampMs,
    lastTransitionTimestampMs: state.lastTransitionTimestampMs,
    debug: createDebugInfo(metrics, config, state),
  }
}

export class RepStateMachine {
  private readonly config: RepDetectionConfig
  private state: InternalState

  constructor(config?: Partial<RepDetectionConfig>) {
    this.config = resolveRepDetectionConfig(config)
    this.state = { ...DEFAULT_INTERNAL_STATE }
  }

  reset() {
    this.state = { ...DEFAULT_INTERNAL_STATE }

    return this.getSnapshot(null)
  }

  getSnapshot(metrics: FrameMetrics | null) {
    return createSnapshot(metrics, this.config, this.state)
  }

  update(metrics: FrameMetrics | null): RepDetectionSnapshot {
    if (!metrics) {
      this.state.previousHipDepth = null
      this.state.transitionReason = 'no_frame_metrics'
      return this.getSnapshot(metrics)
    }

    const { config } = this
    const nowMs = metrics.timestampMs
    const phaseDurationMs = getPhaseDurationMs(nowMs, this.state.phaseStartedAtMs)
    const depthMetric = getEffectiveDepthMetric(metrics)
    const hipDepth = depthMetric.value
    const depthMode = depthMetric.mode
    const kneeAngle = metrics.averageKneeAngleDeg
    const averageVisibility = metrics.averageVisibility

    const descendingHipDepthThreshold = getThresholdValue(
      config.descendingHipDepth,
      depthMode,
    )
    const bottomHipDepthThreshold = getThresholdValue(
      config.bottomHipDepth,
      depthMode,
    )
    const ascendingHipDepthThreshold = getThresholdValue(
      config.ascendingHipDepth,
      depthMode,
    )
    const standingHipDepthThreshold = getThresholdValue(
      config.standingHipDepth,
      depthMode,
    )
    const depthDeltaEpsilon = getThresholdValue(
      config.depthDeltaEpsilon,
      depthMode,
    )

    const hipDepthDelta =
      hipDepth !== null && this.state.previousHipDepth !== null
        ? hipDepth - this.state.previousHipDepth
        : null

    const hasReliableMetrics =
      metrics.poseDetected &&
      averageVisibility !== null &&
      averageVisibility >= config.minPoseVisibility &&
      kneeAngle !== null &&
      hipDepth !== null &&
      descendingHipDepthThreshold !== null &&
      bottomHipDepthThreshold !== null &&
      ascendingHipDepthThreshold !== null &&
      standingHipDepthThreshold !== null &&
      depthDeltaEpsilon !== null

    if (!hasReliableMetrics) {
      this.state.previousHipDepth = hipDepth
      this.state.transitionReason = 'insufficient_pose_confidence_or_metrics'
      return this.getSnapshot(metrics)
    }

    const msSinceLastRep =
      this.state.lastRepTimestampMs === null
        ? Number.POSITIVE_INFINITY
        : nowMs - this.state.lastRepTimestampMs

    const isMovingDown =
      hipDepthDelta !== null && hipDepthDelta >= depthDeltaEpsilon
    const isMovingUp =
      hipDepthDelta !== null && hipDepthDelta <= -depthDeltaEpsilon

    const isStandingSignal =
      kneeAngle >= config.standingKneeAngleDeg &&
      hipDepth <= standingHipDepthThreshold
    const isDescendingSignal =
      kneeAngle <= config.descendingKneeAngleDeg &&
      hipDepth >= descendingHipDepthThreshold &&
      (this.state.phase === 'idle' ? true : isMovingDown || hipDepth >= bottomHipDepthThreshold)
    const isBottomSignal =
      kneeAngle <= config.bottomKneeAngleDeg &&
      hipDepth >= bottomHipDepthThreshold
    const isAscendingSignal =
      kneeAngle >= config.ascendingKneeAngleDeg &&
      hipDepth <= ascendingHipDepthThreshold &&
      isMovingUp

    const transitionTo = (
      nextPhase: SquatPhase,
      reason: string,
      countRep = false,
    ) => {
      this.state.phase = nextPhase
      this.state.phaseStartedAtMs = nowMs
      this.state.lastTransitionTimestampMs = nowMs
      this.state.transitionReason = reason

      if (countRep) {
        this.state.repCount += 1
        this.state.lastRepTimestampMs = nowMs
      }
    }

    switch (this.state.phase) {
      case 'idle':
        if (isDescendingSignal && msSinceLastRep >= config.minRepIntervalMs) {
          transitionTo('descending', 'detected_descent_start')
        } else {
          this.state.transitionReason = 'waiting_for_descent'
        }
        break
      case 'descending':
        if (
          isBottomSignal &&
          phaseDurationMs >= config.minPhaseDurationMs
        ) {
          transitionTo('bottom', 'detected_bottom_position')
        } else if (isStandingSignal) {
          transitionTo('idle', 'returned_to_standing_before_bottom')
        } else {
          this.state.transitionReason = 'continuing_descent'
        }
        break
      case 'bottom':
        if (
          isAscendingSignal &&
          phaseDurationMs >= config.minBottomHoldMs
        ) {
          transitionTo('ascending', 'detected_ascent_start')
        } else {
          this.state.transitionReason = 'holding_bottom'
        }
        break
      case 'ascending':
        if (
          isStandingSignal &&
          phaseDurationMs >= config.minPhaseDurationMs &&
          msSinceLastRep >= config.minRepIntervalMs
        ) {
          transitionTo('complete', 'completed_rep', true)
        } else if (isBottomSignal && !isMovingUp) {
          transitionTo('bottom', 'dropped_back_to_bottom')
        } else {
          this.state.transitionReason = 'continuing_ascent'
        }
        break
      case 'complete':
        if (
          isStandingSignal &&
          phaseDurationMs >= config.minCompleteHoldMs
        ) {
          transitionTo('idle', 'ready_for_next_rep')
        } else {
          this.state.transitionReason = 'debouncing_completed_rep'
        }
        break
    }

    this.state.previousHipDepth = hipDepth

    return this.getSnapshot(metrics)
  }
}

export function createRepStateMachine(config?: Partial<RepDetectionConfig>) {
  return new RepStateMachine(config)
}

export { DEFAULT_REP_DETECTION_CONFIG }
