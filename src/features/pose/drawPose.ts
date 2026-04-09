import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import { POSE_CONNECTIONS, POSE_DRAW_STYLE, POSE_VISIBILITY_THRESHOLD } from './constants'
import type { PoseInferenceResult } from './types'

interface CoverLayout {
  drawWidth: number
  drawHeight: number
  offsetX: number
  offsetY: number
}

interface CanvasSizeOptions {
  canvas: HTMLCanvasElement
  width: number
  height: number
  dpr?: number
}

interface DrawPoseOptions {
  canvas: HTMLCanvasElement
  result: PoseInferenceResult | null
  videoWidth: number
  videoHeight: number
  overlayWidth: number
  overlayHeight: number
  mirrored?: boolean
}

interface CanvasPoint {
  x: number
  y: number
}

function getCoverLayout(
  videoWidth: number,
  videoHeight: number,
  overlayWidth: number,
  overlayHeight: number,
): CoverLayout {
  const scale = Math.max(overlayWidth / videoWidth, overlayHeight / videoHeight)
  const drawWidth = videoWidth * scale
  const drawHeight = videoHeight * scale

  return {
    drawWidth,
    drawHeight,
    offsetX: (overlayWidth - drawWidth) / 2,
    offsetY: (overlayHeight - drawHeight) / 2,
  }
}

function getLandmarkPoint(
  landmark: NormalizedLandmark,
  layout: CoverLayout,
): CanvasPoint {
  return {
    x: layout.offsetX + landmark.x * layout.drawWidth,
    y: layout.offsetY + landmark.y * layout.drawHeight,
  }
}

function isLandmarkVisible(landmark: NormalizedLandmark) {
  return (landmark.visibility ?? 0) >= POSE_VISIBILITY_THRESHOLD
}

function clearCanvas(
  context: CanvasRenderingContext2D,
  overlayWidth: number,
  overlayHeight: number,
  dpr: number,
) {
  context.setTransform(dpr, 0, 0, dpr, 0, 0)
  context.clearRect(0, 0, overlayWidth, overlayHeight)
}

function drawConnectors(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  layout: CoverLayout,
) {
  context.strokeStyle = POSE_DRAW_STYLE.connectorColor
  context.lineWidth = POSE_DRAW_STYLE.connectorWidth
  context.lineCap = 'round'
  context.lineJoin = 'round'

  for (const connection of POSE_CONNECTIONS) {
    const startLandmark = landmarks[connection.start]
    const endLandmark = landmarks[connection.end]

    if (!startLandmark || !endLandmark) {
      continue
    }

    if (!isLandmarkVisible(startLandmark) || !isLandmarkVisible(endLandmark)) {
      continue
    }

    const startPoint = getLandmarkPoint(
      startLandmark,
      layout,
    )
    const endPoint = getLandmarkPoint(endLandmark, layout)

    context.beginPath()
    context.moveTo(startPoint.x, startPoint.y)
    context.lineTo(endPoint.x, endPoint.y)
    context.stroke()
  }
}

function drawLandmarks(
  context: CanvasRenderingContext2D,
  landmarks: NormalizedLandmark[],
  layout: CoverLayout,
) {
  for (const landmark of landmarks) {
    if (!isLandmarkVisible(landmark)) {
      continue
    }

    const point = getLandmarkPoint(landmark, layout)

    context.beginPath()
    context.arc(point.x, point.y, POSE_DRAW_STYLE.landmarkRadius, 0, Math.PI * 2)
    context.fillStyle = POSE_DRAW_STYLE.landmarkFill
    context.fill()
    context.lineWidth = POSE_DRAW_STYLE.landmarkStrokeWidth
    context.strokeStyle = POSE_DRAW_STYLE.landmarkStroke
    context.stroke()
  }
}

export function resizeCanvasToDisplaySize({
  canvas,
  width,
  height,
  dpr = window.devicePixelRatio || 1,
}: CanvasSizeOptions) {
  const displayWidth = Math.max(1, Math.floor(width))
  const displayHeight = Math.max(1, Math.floor(height))
  const pixelWidth = Math.max(1, Math.floor(displayWidth * dpr))
  const pixelHeight = Math.max(1, Math.floor(displayHeight * dpr))

  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }

  return {
    dpr,
    displayWidth,
    displayHeight,
  }
}

export function drawPose({
  canvas,
  result,
  videoWidth,
  videoHeight,
  overlayWidth,
  overlayHeight,
  mirrored = false,
}: DrawPoseOptions) {
  const context = canvas.getContext('2d')

  if (!context || overlayWidth <= 0 || overlayHeight <= 0) {
    return
  }

  const { dpr } = resizeCanvasToDisplaySize({
    canvas,
    width: overlayWidth,
    height: overlayHeight,
  })

  clearCanvas(context, overlayWidth, overlayHeight, dpr)

  if (
    !result ||
    !result.primaryLandmarks ||
    result.primaryLandmarks.length === 0 ||
    videoWidth <= 0 ||
    videoHeight <= 0
  ) {
    return
  }

  context.save()

  if (mirrored) {
    context.translate(overlayWidth, 0)
    context.scale(-1, 1)
  }

  const layout = getCoverLayout(
    videoWidth,
    videoHeight,
    overlayWidth,
    overlayHeight,
  )

  drawConnectors(
    context,
    result.primaryLandmarks,
    layout,
  )
  drawLandmarks(
    context,
    result.primaryLandmarks,
    layout,
  )

  context.restore()
}
