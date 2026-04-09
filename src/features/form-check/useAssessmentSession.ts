import type {
  PostureFeedback,
  PostureWarningKey,
} from '@/features/analysis/feedback'
import type { SquatPhase } from '@/features/analysis/repStateMachine'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AssessmentRepSummary,
  AssessmentResults,
  AssessmentSessionState,
  FatigueTrend,
} from './types'

export interface UseAssessmentSessionOptions {
  repCount: number
  phase: SquatPhase
  postureFeedback: PostureFeedback | null
  timestampMs: number | null
  targetReps: number
}

export interface UseAssessmentSessionReturn extends AssessmentSessionState {
  startSession: (initialRepCount?: number) => void
  resetSession: () => void
}

interface RepAccumulator {
  lowestScore: number
  warningCounts: Map<PostureWarningKey, number>
  recommendationCounts: Map<string, number>
  seenSignal: boolean
}

function createEmptyAccumulator(): RepAccumulator {
  return {
    lowestScore: 100,
    warningCounts: new Map<PostureWarningKey, number>(),
    recommendationCounts: new Map<string, number>(),
    seenSignal: false,
  }
}

function incrementMapCount<K>(map: Map<K, number>, key: K) {
  map.set(key, (map.get(key) ?? 0) + 1)
}

function deriveFatigueTrend(repSummaries: AssessmentRepSummary[]): FatigueTrend {
  if (repSummaries.length < 2) {
    return 'stable'
  }

  const firstScore = repSummaries[0].postureScore
  const lastScore = repSummaries[repSummaries.length - 1].postureScore
  const drop = firstScore - lastScore

  if (drop >= 10) {
    return 'moderate-drop'
  }

  if (drop >= 4) {
    return 'slight-drop'
  }

  return 'stable'
}

function buildAssessmentResults(
  repSummaries: AssessmentRepSummary[],
  targetReps: number,
): AssessmentResults | null {
  if (repSummaries.length === 0) {
    return null
  }

  const totalPostureScore = repSummaries.reduce(
    (sum, repSummary) => sum + repSummary.postureScore,
    0,
  )
  const postureScore = Math.round(totalPostureScore / repSummaries.length)
  const repScores = repSummaries.map((repSummary) => repSummary.postureScore)
  const scoreSpread = Math.max(...repScores) - Math.min(...repScores)
  const movementScore = Math.max(0, Math.round(100 - scoreSpread * 2.5))

  const recommendationCounts = new Map<string, number>()

  repSummaries.forEach((repSummary) => {
    repSummary.recommendations.forEach((recommendation) => {
      incrementMapCount(recommendationCounts, recommendation)
    })
  })

  const topRecommendations = [...recommendationCounts.entries()]
    .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])
    .slice(0, 3)
    .map(([recommendation]) => recommendation)

  return {
    repsCompleted: repSummaries.length,
    targetReps,
    postureScore,
    movementScore,
    fatigueTrend: deriveFatigueTrend(repSummaries),
    topRecommendations:
      topRecommendations.length > 0
        ? topRecommendations
        : ['Form looked stable across the set.'],
    repSummaries,
  }
}

export function useAssessmentSession({
  repCount,
  phase,
  postureFeedback,
  timestampMs,
  targetReps,
}: UseAssessmentSessionOptions): UseAssessmentSessionReturn {
  const [status, setStatus] = useState<'idle' | 'running' | 'complete'>('idle')
  const [repSummaries, setRepSummaries] = useState<AssessmentRepSummary[]>([])
  const [currentRepLowestScore, setCurrentRepLowestScore] = useState<number | null>(
    null,
  )
  const lastSeenRepCountRef = useRef(0)
  const accumulatorRef = useRef<RepAccumulator>(createEmptyAccumulator())

  const startSession = useCallback((initialRepCount = 0) => {
    lastSeenRepCountRef.current = initialRepCount
    accumulatorRef.current = createEmptyAccumulator()
    setRepSummaries([])
    setCurrentRepLowestScore(null)
    setStatus('running')
  }, [])

  const resetSession = useCallback(() => {
    lastSeenRepCountRef.current = 0
    accumulatorRef.current = createEmptyAccumulator()
    setRepSummaries([])
    setCurrentRepLowestScore(null)
    setStatus('idle')
  }, [])

  useEffect(() => {
    if (status !== 'running' || !postureFeedback) {
      return
    }

    const isRepActive =
      phase === 'descending' ||
      phase === 'bottom' ||
      phase === 'ascending' ||
      phase === 'holding' ||
      phase === 'complete'

    if (!isRepActive) {
      return
    }

    const accumulator = accumulatorRef.current

    accumulator.seenSignal = true
    accumulator.lowestScore = Math.min(
      accumulator.lowestScore,
      postureFeedback.postureScore,
    )
    setCurrentRepLowestScore(Math.round(accumulator.lowestScore))

    postureFeedback.triggeredWarnings.forEach((warning) => {
      incrementMapCount(accumulator.warningCounts, warning.key)
    })
    postureFeedback.recommendationStrings.forEach((recommendation) => {
      incrementMapCount(accumulator.recommendationCounts, recommendation)
    })
  }, [phase, postureFeedback, status])

  useEffect(() => {
    if (status !== 'running' || repCount <= lastSeenRepCountRef.current) {
      return
    }

    const nextSummaries: AssessmentRepSummary[] = []
    const completedAtMs = timestampMs ?? Date.now()

    while (
      lastSeenRepCountRef.current < repCount &&
      repSummaries.length + nextSummaries.length < targetReps
    ) {
      const accumulator = accumulatorRef.current
      const warningKeys = [...accumulator.warningCounts.entries()]
        .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])
        .map(([warningKey]) => warningKey)
      const recommendations = [...accumulator.recommendationCounts.entries()]
        .sort((leftEntry, rightEntry) => rightEntry[1] - leftEntry[1])
        .map(([recommendation]) => recommendation)

      nextSummaries.push({
        repNumber: repSummaries.length + nextSummaries.length + 1,
        postureScore: accumulator.seenSignal
          ? Math.round(accumulator.lowestScore)
          : postureFeedback?.postureScore ?? 100,
        warningKeys,
        recommendations:
          recommendations.length > 0
            ? recommendations
            : postureFeedback?.recommendationStrings ?? [],
        completedAtMs,
      })

      accumulatorRef.current = createEmptyAccumulator()
      lastSeenRepCountRef.current += 1
    }

    if (nextSummaries.length === 0) {
      return
    }

    const commitTimer = window.setTimeout(() => {
      setRepSummaries((currentSummaries) => {
        const combinedSummaries = [...currentSummaries, ...nextSummaries]

        if (combinedSummaries.length >= targetReps) {
          setStatus('complete')
        }

        return combinedSummaries
      })
    }, 0)

    return () => {
      window.clearTimeout(commitTimer)
    }
  }, [phase, postureFeedback, repCount, repSummaries.length, status, targetReps, timestampMs])

  const results = useMemo(
    () => buildAssessmentResults(repSummaries, targetReps),
    [repSummaries, targetReps],
  )

  return {
    status,
    targetReps,
    completedReps: repSummaries.length,
    remainingReps: Math.max(0, targetReps - repSummaries.length),
    repSummaries,
    results,
    isComplete: status === 'complete',
    currentRepLowestScore: status === 'running' ? currentRepLowestScore : null,
    startSession,
    resetSession,
  }
}
