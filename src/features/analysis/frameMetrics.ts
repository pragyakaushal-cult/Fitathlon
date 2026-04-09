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
  const leftElbow = toPoint2D(mappedLandmarks.leftElbow)
  const rightElbow = toPoint2D(mappedLandmarks.rightElbow)
  const leftWrist = toPoint2D(mappedLandmarks.leftWrist)
  const rightWrist = toPoint2D(mappedLandmarks.rightWrist)
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
  const leftElbowAngleDeg = angleBetweenThreePoints(
    leftShoulder,
    leftElbow,
    leftWrist,
  )
  const rightElbowAngleDeg = angleBetweenThreePoints(
    rightShoulder,
    rightElbow,
    rightWrist,
  )
  const averageKneeAngleDeg =
    leftKneeAngleDeg !== null && rightKneeAngleDeg !== null
      ? (leftKneeAngleDeg + rightKneeAngleDeg) / 2
      : leftKneeAngleDeg ?? rightKneeAngleDeg
  const validKneeAngles = [leftKneeAngleDeg, rightKneeAngleDeg].filter(
    (angle): angle is number => angle !== null && Number.isFinite(angle),
  )
  const minKneeAngleDeg =
    validKneeAngles.length > 0 ? Math.min(...validKneeAngles) : null
  const averageElbowAngleDeg =
    leftElbowAngleDeg !== null && rightElbowAngleDeg !== null
      ? (leftElbowAngleDeg + rightElbowAngleDeg) / 2
      : leftElbowAngleDeg ?? rightElbowAngleDeg
  const torsoLength = distanceBetweenPoints(hipCenter, shoulderCenter)
  const leftWristOverShoulderNormalized =
    leftShoulder !== null &&
    leftWrist !== null &&
    torsoLength !== null &&
    torsoLength > 0
      ? (leftShoulder.y - leftWrist.y) / torsoLength
      : null
  const rightWristOverShoulderNormalized =
    rightShoulder !== null &&
    rightWrist !== null &&
    torsoLength !== null &&
    torsoLength > 0
      ? (rightShoulder.y - rightWrist.y) / torsoLength
      : null
  const validWristOverShoulderValues = [
    leftWristOverShoulderNormalized,
    rightWristOverShoulderNormalized,
  ].filter((value): value is number => value !== null && Number.isFinite(value))
  const averageWristOverShoulderNormalized =
    validWristOverShoulderValues.length === 2
      ? (validWristOverShoulderValues[0] + validWristOverShoulderValues[1]) / 2
      : validWristOverShoulderValues[0] ?? null
  const minWristOverShoulderNormalized =
    validWristOverShoulderValues.length > 0
      ? Math.min(...validWristOverShoulderValues)
      : null
  const torsoLeanDeg = torsoLeanRelativeToVertical(hipCenter, shoulderCenter)
  const bodyLineAngleDeg = angleBetweenThreePoints(
    shoulderCenter,
    hipCenter,
    ankleCenter,
  )
  const shoulderToAnkleDistance = distanceBetweenPoints(
    shoulderCenter,
    ankleCenter,
  )
  const shoulderAnkleMidpoint = midpoint(shoulderCenter, ankleCenter)
  const bodyLineOffsetNormalized =
    hipCenter !== null &&
    shoulderAnkleMidpoint !== null &&
    shoulderToAnkleDistance !== null &&
    shoulderToAnkleDistance > 0
      ? (hipCenter.y - shoulderAnkleMidpoint.y) / shoulderToAnkleDistance
      : null

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
      mappedLandmarks.leftElbow,
      mappedLandmarks.rightElbow,
      mappedLandmarks.leftWrist,
      mappedLandmarks.rightWrist,
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
    minKneeAngleDeg,
    leftElbowAngleDeg,
    rightElbowAngleDeg,
    averageElbowAngleDeg,
    elbowSymmetryScore: leftRightSymmetryScore(
      leftElbowAngleDeg,
      rightElbowAngleDeg,
      18,
    ),
    leftWristOverShoulderNormalized,
    rightWristOverShoulderNormalized,
    averageWristOverShoulderNormalized,
    minWristOverShoulderNormalized,
    torsoLeanDeg,
    bodyLineAngleDeg,
    bodyLineOffsetNormalized,
    hipDepthPx: hipDepth.depthPx,
    hipDepthNormalized: hipDepth.depthNormalized,
    symmetryScore: leftRightSymmetryScore(leftKneeAngleDeg, rightKneeAngleDeg),
    hipCenter,
    shoulderCenter,
    ankleCenter,
  }
}
