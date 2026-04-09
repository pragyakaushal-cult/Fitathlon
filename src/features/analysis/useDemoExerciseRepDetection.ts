import { useEffect, useState } from 'react'
import type { DemoExerciseAssessmentPreset } from '@/features/exercises/demoAssessment'
import type { SquatPhase } from './repStateMachine'
import type { FrameMetrics } from './types'

interface DemoRepState {
  phase: SquatPhase
  repCount: number
  lastMetric: number | null
  lastRepTimestampMs: number | null
  holdStartedAtMs: number | null
}

interface UseDemoExerciseRepDetectionOptions {
  frameMetrics: FrameMetrics | null
  enabled?: boolean
  preset: DemoExerciseAssessmentPreset | null
}

interface UseDemoExerciseRepDetectionReturn {
  phase: SquatPhase
  repCount: number
  reset: () => void
}

const DEFAULT_STATE: DemoRepState = {
  phase: 'idle',
  repCount: 0,
  lastMetric: null,
  lastRepTimestampMs: null,
  holdStartedAtMs: null,
}

function getMetricForPreset(
  preset: DemoExerciseAssessmentPreset,
  frameMetrics: FrameMetrics,
) {
  switch (preset.repTracking.kind) {
    case 'knee-cycle':
      return frameMetrics.minKneeAngleDeg ?? frameMetrics.averageKneeAngleDeg
    case 'elbow-cycle':
      return frameMetrics.averageElbowAngleDeg
    case 'torso-cycle':
      return frameMetrics.torsoLeanDeg
    default:
      return null
  }
}

function isReliableFrame(
  frameMetrics: FrameMetrics,
  minPoseVisibility = 0.45,
) {
  return (
    frameMetrics.poseDetected &&
    frameMetrics.averageVisibility !== null &&
    frameMetrics.averageVisibility >= minPoseVisibility
  )
}

export function useDemoExerciseRepDetection({
  frameMetrics,
  enabled = true,
  preset,
}: UseDemoExerciseRepDetectionOptions): UseDemoExerciseRepDetectionReturn {
  const [state, setState] = useState(DEFAULT_STATE)

  useEffect(() => {
    if (
      !enabled ||
      !preset ||
      preset.repTracking.kind === 'existing-squat'
    ) {
      const resetTimer = window.setTimeout(() => {
        setState(DEFAULT_STATE)
      }, 0)

      return () => {
        window.clearTimeout(resetTimer)
      }
    }

    if (!frameMetrics) {
      const idleTimer = window.setTimeout(() => {
        setState((currentState) => ({
          ...currentState,
          phase: currentState.repCount > 0 ? currentState.phase : 'idle',
          lastMetric: null,
          holdStartedAtMs: null,
        }))
      }, 0)

      return () => {
        window.clearTimeout(idleTimer)
      }
    }

    const updateTimer = window.setTimeout(() => {
      const nowMs = frameMetrics.timestampMs
      const minPoseVisibility = preset.repTracking.minPoseVisibility ?? 0.45

      setState((currentState) => {
        if (!isReliableFrame(frameMetrics, minPoseVisibility)) {
          return {
            ...currentState,
            phase: 'idle',
            lastMetric: null,
            holdStartedAtMs: null,
          }
        }

        if (preset.repTracking.kind === 'hold') {
          const offset = Math.abs(frameMetrics.bodyLineOffsetNormalized ?? 1)
          const stableOffsetThreshold =
            preset.repTracking.stableOffsetThreshold ?? 0.03
          const releaseOffsetThreshold =
            preset.repTracking.releaseOffsetThreshold ?? 0.05
          const holdMs = preset.repTracking.holdMs ?? 3000
          const minRepIntervalMs = preset.repTracking.minRepIntervalMs ?? holdMs
          const shouldersStable =
            frameMetrics.elbowSymmetryScore === null ||
            frameMetrics.elbowSymmetryScore >= 70

          const isStable = offset <= stableOffsetThreshold && shouldersStable
          const shouldRelease =
            offset >= releaseOffsetThreshold || !shouldersStable

          if (!isStable && shouldRelease) {
            return {
              ...currentState,
              phase: 'idle',
              holdStartedAtMs: null,
            }
          }

          if (!isStable) {
            return currentState
          }

          const holdStartedAtMs = currentState.holdStartedAtMs ?? nowMs
          const enoughGap =
            currentState.lastRepTimestampMs === null ||
            nowMs - currentState.lastRepTimestampMs >= minRepIntervalMs

          if (enoughGap && nowMs - holdStartedAtMs >= holdMs) {
            return {
              ...currentState,
              phase: 'holding',
              repCount: currentState.repCount + 1,
              lastRepTimestampMs: nowMs,
              holdStartedAtMs: nowMs,
            }
          }

          return {
            ...currentState,
            phase: 'holding',
            holdStartedAtMs,
          }
        }

        if (preset.repTracking.kind === 'press-cycle') {
          const elbowAngle = frameMetrics.averageElbowAngleDeg
          const overheadReach =
            frameMetrics.minWristOverShoulderNormalized ??
            frameMetrics.averageWristOverShoulderNormalized

          if (elbowAngle === null || overheadReach === null) {
            return {
              ...currentState,
              phase: 'idle',
              lastMetric: null,
            }
          }

          const lastMetric = currentState.lastMetric
          const delta = lastMetric === null ? 0 : elbowAngle - lastMetric
          const minDelta = preset.repTracking.minDelta ?? 0.5
          const minRepIntervalMs = preset.repTracking.minRepIntervalMs ?? 900
          const startThreshold = preset.repTracking.startThreshold ?? 118
          const topThreshold = preset.repTracking.bottomThreshold ?? 156
          const descentThreshold = preset.repTracking.riseThreshold ?? 136
          const resetThreshold = preset.repTracking.completeThreshold ?? 114
          const topReachThreshold = preset.repTracking.topReachThreshold ?? 0.05
          const resetReachThreshold =
            preset.repTracking.resetReachThreshold ?? 0.03
          const enoughRepGap =
            currentState.lastRepTimestampMs === null ||
            nowMs - currentState.lastRepTimestampMs >= minRepIntervalMs

          let nextPhase = currentState.phase
          let nextRepCount = currentState.repCount
          let nextLastRepTimestampMs = currentState.lastRepTimestampMs

          if (
            currentState.phase === 'idle' &&
            elbowAngle >= startThreshold &&
            delta >= minDelta
          ) {
            nextPhase = 'ascending'
          } else if (
            currentState.phase === 'ascending' &&
            elbowAngle >= topThreshold &&
            overheadReach >= topReachThreshold
          ) {
            nextPhase = 'bottom'
          } else if (
            (currentState.phase === 'bottom' ||
              currentState.phase === 'ascending') &&
            elbowAngle <= descentThreshold &&
            delta <= -minDelta
          ) {
            nextPhase = 'descending'
          } else if (
            currentState.phase === 'descending' &&
            elbowAngle <= resetThreshold &&
            overheadReach <= resetReachThreshold &&
            enoughRepGap
          ) {
            nextPhase = 'complete'
            nextRepCount += 1
            nextLastRepTimestampMs = nowMs
          } else if (
            currentState.phase === 'complete' &&
            elbowAngle <= resetThreshold + 4
          ) {
            nextPhase = 'idle'
          }

          return {
            phase: nextPhase,
            repCount: nextRepCount,
            lastMetric: elbowAngle,
            lastRepTimestampMs: nextLastRepTimestampMs,
            holdStartedAtMs: null,
          }
        }

        const metric = getMetricForPreset(preset, frameMetrics)

        if (metric === null) {
          return {
            ...currentState,
            phase: 'idle',
            lastMetric: null,
          }
        }

        const lastMetric = currentState.lastMetric
        const delta = lastMetric === null ? 0 : metric - lastMetric
        const minDelta = preset.repTracking.minDelta ?? 0.4
        const minRepIntervalMs = preset.repTracking.minRepIntervalMs ?? 800
        const startThreshold = preset.repTracking.startThreshold ?? 0
        const bottomThreshold = preset.repTracking.bottomThreshold ?? 0
        const riseThreshold = preset.repTracking.riseThreshold ?? 0
        const completeThreshold = preset.repTracking.completeThreshold ?? 0
        const isTorsoCycle = preset.repTracking.kind === 'torso-cycle'
        const isAngleCycle =
          preset.repTracking.kind === 'knee-cycle' ||
          preset.repTracking.kind === 'elbow-cycle'

        const enoughRepGap =
          currentState.lastRepTimestampMs === null ||
          nowMs - currentState.lastRepTimestampMs >= minRepIntervalMs

        let nextPhase = currentState.phase
        let nextRepCount = currentState.repCount
        let nextLastRepTimestampMs = currentState.lastRepTimestampMs

        if (isAngleCycle) {
          if (
            currentState.phase === 'idle' &&
            metric <= startThreshold &&
            delta <= -minDelta
          ) {
            nextPhase = 'descending'
          } else if (
            currentState.phase === 'descending' &&
            metric <= bottomThreshold
          ) {
            nextPhase = 'bottom'
          } else if (
            (currentState.phase === 'bottom' ||
              currentState.phase === 'descending') &&
            metric >= riseThreshold &&
            delta >= minDelta
          ) {
            nextPhase = 'ascending'
          } else if (
            currentState.phase === 'ascending' &&
            metric >= completeThreshold &&
            enoughRepGap
          ) {
            nextPhase = 'complete'
            nextRepCount += 1
            nextLastRepTimestampMs = nowMs
          } else if (
            currentState.phase === 'complete' &&
            metric >= completeThreshold - 2
          ) {
            nextPhase = 'idle'
          }
        }

        if (isTorsoCycle) {
          if (
            currentState.phase === 'idle' &&
            metric >= startThreshold &&
            delta >= minDelta
          ) {
            nextPhase = 'descending'
          } else if (
            currentState.phase === 'descending' &&
            metric >= bottomThreshold
          ) {
            nextPhase = 'bottom'
          } else if (
            (currentState.phase === 'bottom' ||
              currentState.phase === 'descending') &&
            metric <= riseThreshold &&
            delta <= -minDelta
          ) {
            nextPhase = 'ascending'
          } else if (
            currentState.phase === 'ascending' &&
            metric <= completeThreshold &&
            enoughRepGap
          ) {
            nextPhase = 'complete'
            nextRepCount += 1
            nextLastRepTimestampMs = nowMs
          } else if (
            currentState.phase === 'complete' &&
            metric <= completeThreshold + 2
          ) {
            nextPhase = 'idle'
          }
        }

        return {
          phase: nextPhase,
          repCount: nextRepCount,
          lastMetric: metric,
          lastRepTimestampMs: nextLastRepTimestampMs,
          holdStartedAtMs: null,
        }
      })
    }, 0)

    return () => {
      window.clearTimeout(updateTimer)
    }
  }, [enabled, frameMetrics, preset])

  const reset = () => {
    setState(DEFAULT_STATE)
  }

  return {
    phase: state.phase,
    repCount: state.repCount,
    reset,
  }
}
