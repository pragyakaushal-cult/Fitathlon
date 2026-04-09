interface RecommendationListProps {
  recommendations: string[]
  title?: string
}

export function RecommendationList({
  recommendations,
  title = 'Top recommendations',
}: RecommendationListProps) {
  const safeRecommendations =
    recommendations.length > 0
      ? recommendations
      : ['Form looked stable across the set.']

  return (
    <section className="results-recommendations">
      <h3 className="results-recommendations__title">{title}</h3>
      <ol className="results-recommendations__list">
        {safeRecommendations.map((recommendation) => (
          <li key={recommendation}>{recommendation}</li>
        ))}
      </ol>
    </section>
  )
}
