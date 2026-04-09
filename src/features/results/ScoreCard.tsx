import type { ReactNode } from 'react'

type ScoreTone = 'neutral' | 'good' | 'warning'

interface ScoreCardProps {
  label: string
  value: string | number
  subtitle?: ReactNode
  tone?: ScoreTone
}

export function ScoreCard({
  label,
  value,
  subtitle,
  tone = 'neutral',
}: ScoreCardProps) {
  return (
    <article className={`results-score-card results-score-card--${tone}`}>
      <p className="results-score-card__label">{label}</p>
      <p className="results-score-card__value">{value}</p>
      {subtitle ? <p className="results-score-card__subtitle">{subtitle}</p> : null}
    </article>
  )
}
