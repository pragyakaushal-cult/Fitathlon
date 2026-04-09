import { useEffect, useMemo, useRef, useState } from 'react'
import { createDebugLogger } from '@/lib/debug/logger'
import { resolveRepDetectionConfig, type RepDetectionConfig } from './config'
import {
  createRepStateMachine,
  type RepDetectionSnapshot,
  type SquatPhase,
} from './repStateMachine'
import type { FrameMetrics } from './types'

export interface UseRepDetectionOptions {
  frameMetrics: FrameMetrics | null
  enabled?: boolean
  debug?: boolean
  config?: Partial<RepDetectionConfig>
}

export interface UseRepDetectionReturn {
  phase: SquatPhase
  repCount: number
  debug: RepDetectionSnapshot['debug']
  snapshot: RepDetectionSnapshot
  reset: () => void
}

export function useRepDetection({
  frameMetrics,
  enabled = true,
  debug = false,
  config,
}: UseRepDetectionOptions): UseRepDetectionReturn {
  const resolvedConfig = useMemo(
    () => resolveRepDetectionConfig(config),
    [config],
  )
  const machine = useMemo(
    () => createRepStateMachine(resolvedConfig),
    [resolvedConfig],
  )
  const logDebug = useMemo(() => createDebugLogger('rep-fsm', debug), [debug])
  const machineRef = useRef(machine)
  const lastDebugSnapshotRef = useRef<RepDetectionSnapshot | null>(null)
  const [snapshot, setSnapshot] = useState(() => machine.getSnapshot(null))

  useEffect(() => {
    machineRef.current = machine

    const resetTimer = window.setTimeout(() => {
      setSnapshot(machine.getSnapshot(null))
    }, 0)

    return () => {
      window.clearTimeout(resetTimer)
    }
  }, [machine])

  useEffect(() => {
    if (!enabled) {
      const stopTimer = window.setTimeout(() => {
        setSnapshot(machineRef.current.reset())
      }, 0)

      return () => {
        window.clearTimeout(stopTimer)
      }
    }

    if (!frameMetrics) {
      return
    }

    const updateTimer = window.setTimeout(() => {
      const nextSnapshot = machineRef.current.update(frameMetrics)
      const previousSnapshot = lastDebugSnapshotRef.current

      if (
        previousSnapshot === null ||
        previousSnapshot.phase !== nextSnapshot.phase ||
        previousSnapshot.repCount !== nextSnapshot.repCount
      ) {
        logDebug('rep_state_update', {
          phase: nextSnapshot.phase,
          repCount: nextSnapshot.repCount,
          transitionReason: nextSnapshot.debug.transitionReason,
          timestampMs: nextSnapshot.debug.timestampMs,
        })
      }

      lastDebugSnapshotRef.current = nextSnapshot
      setSnapshot(nextSnapshot)
    }, 0)

    return () => {
      window.clearTimeout(updateTimer)
    }
  }, [enabled, frameMetrics, logDebug])

  const reset = () => {
    setSnapshot(machineRef.current.reset())
  }

  return {
    phase: snapshot.phase,
    repCount: snapshot.repCount,
    debug: snapshot.debug,
    snapshot,
    reset,
  }
}
