import type {
  LandmarkLike,
  NamedSquatLandmarks,
  Point2D,
  PoseLandmarksInput,
} from './types'

export const POSE_LANDMARK_INDEX = {
  leftShoulder: 11,
  rightShoulder: 12,
  leftHip: 23,
  rightHip: 24,
  leftKnee: 25,
  rightKnee: 26,
  leftAnkle: 27,
  rightAnkle: 28,
} as const

function isFiniteNumber(value: number) {
  return Number.isFinite(value)
}

export function toPoint2D(point: LandmarkLike | null | undefined): Point2D | null {
  if (!point) {
    return null
  }

  if (!isFiniteNumber(point.x) || !isFiniteNumber(point.y)) {
    return null
  }

  return {
    x: point.x,
    y: point.y,
  }
}

export function distanceBetweenPoints(
  firstPoint: Point2D | null,
  secondPoint: Point2D | null,
): number | null {
  if (!firstPoint || !secondPoint) {
    return null
  }

  return Math.hypot(
    secondPoint.x - firstPoint.x,
    secondPoint.y - firstPoint.y,
  )
}

export function midpoint(
  firstPoint: Point2D | null,
  secondPoint: Point2D | null,
): Point2D | null {
  if (!firstPoint || !secondPoint) {
    return null
  }

  return {
    x: (firstPoint.x + secondPoint.x) / 2,
    y: (firstPoint.y + secondPoint.y) / 2,
  }
}

export function angleBetweenThreePoints(
  firstPoint: Point2D | null,
  vertexPoint: Point2D | null,
  thirdPoint: Point2D | null,
): number | null {
  if (!firstPoint || !vertexPoint || !thirdPoint) {
    return null
  }

  const vectorA = {
    x: firstPoint.x - vertexPoint.x,
    y: firstPoint.y - vertexPoint.y,
  }
  const vectorB = {
    x: thirdPoint.x - vertexPoint.x,
    y: thirdPoint.y - vertexPoint.y,
  }

  const magnitudeA = Math.hypot(vectorA.x, vectorA.y)
  const magnitudeB = Math.hypot(vectorB.x, vectorB.y)

  if (magnitudeA === 0 || magnitudeB === 0) {
    return null
  }

  const dotProduct = vectorA.x * vectorB.x + vectorA.y * vectorB.y
  const cosine = dotProduct / (magnitudeA * magnitudeB)
  const clampedCosine = Math.min(1, Math.max(-1, cosine))

  return (Math.acos(clampedCosine) * 180) / Math.PI
}

export function torsoLeanRelativeToVertical(
  hipCenter: Point2D | null,
  shoulderCenter: Point2D | null,
): number | null {
  if (!hipCenter || !shoulderCenter) {
    return null
  }

  const torsoVector = {
    x: shoulderCenter.x - hipCenter.x,
    y: shoulderCenter.y - hipCenter.y,
  }

  const magnitude = Math.hypot(torsoVector.x, torsoVector.y)

  if (magnitude === 0) {
    return null
  }

  const verticalUp = { x: 0, y: -1 }
  const dotProduct = torsoVector.x * verticalUp.x + torsoVector.y * verticalUp.y
  const cosine = dotProduct / magnitude
  const clampedCosine = Math.min(1, Math.max(-1, cosine))

  return (Math.acos(clampedCosine) * 180) / Math.PI
}

export function hipDepthRelativeToBaseline(
  hipCenter: Point2D | null,
  standingHipCenterY: number,
  normalizationLength?: number,
): { depthPx: number | null; depthNormalized: number | null } {
  if (!hipCenter || !isFiniteNumber(standingHipCenterY)) {
    return {
      depthPx: null,
      depthNormalized: null,
    }
  }

  const depthPx = hipCenter.y - standingHipCenterY
  const depthNormalized =
    normalizationLength && normalizationLength > 0
      ? depthPx / normalizationLength
      : null

  return {
    depthPx,
    depthNormalized,
  }
}

export function leftRightSymmetryScore(
  leftValue: number | null,
  rightValue: number | null,
  tolerance = 12,
): number | null {
  if (
    leftValue === null ||
    rightValue === null ||
    !isFiniteNumber(leftValue) ||
    !isFiniteNumber(rightValue)
  ) {
    return null
  }

  if (tolerance <= 0) {
    return leftValue === rightValue ? 100 : 0
  }

  const difference = Math.abs(leftValue - rightValue)
  const normalizedDifference = Math.min(1, difference / tolerance)

  return Math.max(0, 100 - normalizedDifference * 100)
}

export function averageVisibility(
  landmarks: Array<LandmarkLike | null | undefined>,
): number | null {
  const visibilityValues = landmarks
    .map((landmark) => landmark?.visibility)
    .filter(
      (visibility): visibility is number =>
        typeof visibility === 'number' && Number.isFinite(visibility),
    )

  if (visibilityValues.length === 0) {
    return null
  }

  const total = visibilityValues.reduce((sum, visibility) => sum + visibility, 0)

  return total / visibilityValues.length
}

export function mapSquatLandmarks(
  landmarks: PoseLandmarksInput | null | undefined,
): NamedSquatLandmarks {
  const safeLandmarks = landmarks ?? []

  return {
    leftShoulder: safeLandmarks[POSE_LANDMARK_INDEX.leftShoulder] ?? null,
    rightShoulder: safeLandmarks[POSE_LANDMARK_INDEX.rightShoulder] ?? null,
    leftHip: safeLandmarks[POSE_LANDMARK_INDEX.leftHip] ?? null,
    rightHip: safeLandmarks[POSE_LANDMARK_INDEX.rightHip] ?? null,
    leftKnee: safeLandmarks[POSE_LANDMARK_INDEX.leftKnee] ?? null,
    rightKnee: safeLandmarks[POSE_LANDMARK_INDEX.rightKnee] ?? null,
    leftAnkle: safeLandmarks[POSE_LANDMARK_INDEX.leftAnkle] ?? null,
    rightAnkle: safeLandmarks[POSE_LANDMARK_INDEX.rightAnkle] ?? null,
  }
}
