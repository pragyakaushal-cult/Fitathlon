import {
  angleBetweenThreePoints,
  averageVisibility,
  distanceBetweenPoints,
  hipDepthRelativeToBaseline,
  leftRightSymmetryScore,
  mapSquatLandmarks,
  midpoint,
  toPoint2D,
  torsoLeanRelativeToVertical,
} from './geometry'
import type {
  FrameMetrics,
  PoseLandmarksInput,
  SquatBaseline,
} from './types'

export interface CreateFrameMetricsOptions {
  landmarks: PoseLandmarksInput | null | undefined
  timestampMs: number
  baseline?: SquatBaseline | null
}

export function createSquatBaseline(
  landmarks: PoseLandmarksInput | null | undefined,
): SquatBaseline | null {
  const mappedLandmarks = mapSquatLandmarks(landmarks)
  const hipCenter = midpoint(
    toPoint2D(mappedLandmarks.leftHip),
    toPoint2D(mappedLandmarks.rightHip),
  )
  const shoulderCenter = midpoint(
    toPoint2D(mappedLandmarks.leftShoulder),
    toPoint2D(mappedLandmarks.rightShoulder),
  )
  const ankleCenter = midpoint(
    toPoint2D(mappedLandmarks.leftAnkle),
    toPoint2D(mappedLandmarks.rightAnkle),
  )

  if (!hipCenter || !shoulderCenter || !ankleCenter) {
    return null
  }

  const torsoLength = distanceBetweenPoints(hipCenter, shoulderCenter)
  const hipToAnkleLength = distanceBetweenPoints(hipCenter, ankleCenter)

  if (!torsoLength || !hipToAnkleLength) {
    return null
  }

  return {
    standingHipCenterY: hipCenter.y,
    standingShoulderCenterY: shoulderCenter.y,
    torsoLength,
    hipToAnkleLength,
  }
}

export function createFrameMetrics({
  landmarks,
  timestampMs,
  baseline,
}: CreateFrameMetricsOptions): FrameMetrics {
  const mappedLandmarks = mapSquatLandmarks(landmarks)

  const leftShoulder = toPoint2D(mappedLandmarks.leftShoulder)
  const rightShoulder = toPoint2D(mappedLandmarks.rightShoulder)
  const leftHip = toPoint2D(mappedLandmarks.leftHip)
  const rightHip = toPoint2D(mappedLandmarks.rightHip)
  const leftKnee = toPoint2D(mappedLandmarks.leftKnee)
  const rightKnee = toPoint2D(mappedLandmarks.rightKnee)
  const leftAnkle = toPoint2D(mappedLandmarks.leftAnkle)
  const rightAnkle = toPoint2D(mappedLandmarks.rightAnkle)

  const hipCenter = midpoint(leftHip, rightHip)
  const shoulderCenter = midpoint(leftShoulder, rightShoulder)
  const ankleCenter = midpoint(leftAnkle, rightAnkle)

  const leftKneeAngleDeg = angleBetweenThreePoints(leftHip, leftKnee, leftAnkle)
  const rightKneeAngleDeg = angleBetweenThreePoints(
    rightHip,
    rightKnee,
    rightAnkle,
  )
  const averageKneeAngleDeg =
    leftKneeAngleDeg !== null && rightKneeAngleDeg !== null
      ? (leftKneeAngleDeg + rightKneeAngleDeg) / 2
      : leftKneeAngleDeg ?? rightKneeAngleDeg
  const torsoLeanDeg = torsoLeanRelativeToVertical(hipCenter, shoulderCenter)

  const hipDepth = baseline
    ? hipDepthRelativeToBaseline(
        hipCenter,
        baseline.standingHipCenterY,
        baseline.hipToAnkleLength,
      )
    : { depthPx: null, depthNormalized: null }

  return {
    timestampMs,
    poseDetected: !!landmarks && landmarks.length > 0,
    averageVisibility: averageVisibility([
      mappedLandmarks.leftShoulder,
      mappedLandmarks.rightShoulder,
      mappedLandmarks.leftHip,
      mappedLandmarks.rightHip,
      mappedLandmarks.leftKnee,
      mappedLandmarks.rightKnee,
      mappedLandmarks.leftAnkle,
      mappedLandmarks.rightAnkle,
    ]),
    leftKneeAngleDeg,
    rightKneeAngleDeg,
    averageKneeAngleDeg,
    torsoLeanDeg,
    hipDepthPx: hipDepth.depthPx,
    hipDepthNormalized: hipDepth.depthNormalized,
    symmetryScore: leftRightSymmetryScore(leftKneeAngleDeg, rightKneeAngleDeg),
    hipCenter,
    shoulderCenter,
    ankleCenter,
  }
}
