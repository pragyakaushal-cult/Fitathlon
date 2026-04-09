import type { AssessmentResults } from '@/features/form-check/types'
import { RecommendationList } from './RecommendationList'
import { ScoreCard } from './ScoreCard'
import './results.css'

interface ResultsScreenProps {
  results: AssessmentResults | null
  onRestart: () => void
  title?: string
}

function formatFatigueTrend(fatigueTrend: AssessmentResults['fatigueTrend']) {
  switch (fatigueTrend) {
    case 'slight-drop':
      return 'Slight drop'
    case 'moderate-drop':
      return 'Moderate drop'
    case 'stable':
    default:
      return 'Stable'
  }
}

function getPostureTone(postureScore: number) {
  if (postureScore >= 80) {
    return 'good' as const
  }

  if (postureScore >= 60) {
    return 'neutral' as const
  }

  return 'warning' as const
}

export function ResultsScreen({
  results,
  onRestart,
  title = 'Three-squat summary',
}: ResultsScreenProps) {
  if (!results) {
    return (
      <article className="card">
        <div className="card-header">
          <p className="section-label">Results</p>
          <h2>No assessment data yet</h2>
        </div>
        <p className="results-screen__empty-copy">
          Complete a full 3-squat assessment to generate your coaching summary.
        </p>
        <button
          type="button"
          className="results-screen__restart-button"
          onClick={onRestart}
        >
          Restart form check
        </button>
      </article>
    )
  }

  return (
    <article className="card">
      <div className="card-header">
        <p className="section-label">Results</p>
        <h2>{title}</h2>
      </div>

      <div className="results-screen__grid">
        <ScoreCard
          label="Reps completed"
          value={`${results.repsCompleted}/${results.targetReps}`}
          subtitle="Valid reps counted"
        />
        <ScoreCard
          label="Posture score"
          value={results.postureScore}
          subtitle="Rule-based form quality"
          tone={getPostureTone(results.postureScore)}
        />
        <ScoreCard
          label="Movement score"
          value={results.movementScore}
          subtitle="Consistency across reps"
          tone={results.movementScore >= 75 ? 'good' : 'neutral'}
        />
        <ScoreCard
          label="Fatigue trend"
          value={formatFatigueTrend(results.fatigueTrend)}
          subtitle="Trend across the set"
          tone={results.fatigueTrend === 'stable' ? 'good' : 'warning'}
        />
      </div>

      <RecommendationList recommendations={results.topRecommendations} />

      <div className="results-screen__actions">
        <button
          type="button"
          className="results-screen__restart-button"
          onClick={onRestart}
        >
          Restart form check
        </button>
      </div>
    </article>
  )
}
