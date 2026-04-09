import { useEffect, useRef, useState } from 'react'
import { drawPose } from './drawPose'
import type { PoseInferenceResult } from './types'

interface PoseCanvasOverlayProps {
  result: PoseInferenceResult | null
  videoRef: React.RefObject<HTMLVideoElement | null>
  containerRef: React.RefObject<HTMLDivElement | null>
  mirrored?: boolean
}

interface OverlaySize {
  width: number
  height: number
}

const canvasStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  width: '100%',
  height: '100%',
  pointerEvents: 'none',
}

export function PoseCanvasOverlay({
  result,
  videoRef,
  containerRef,
  mirrored = false,
}: PoseCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastDrawnTimestampRef = useRef<number | null>(null)
  const lastDrawSignatureRef = useRef<string>('')
  const lastHadPoseRef = useRef(false)
  const [overlaySize, setOverlaySize] = useState<OverlaySize>({
    width: 0,
    height: 0,
  })

  useEffect(() => {
    const containerElement = containerRef.current

    if (!containerElement) {
      return
    }

    const updateSize = () => {
      const nextWidth = containerElement.clientWidth
      const nextHeight = containerElement.clientHeight

      setOverlaySize((currentSize) => {
        if (
          currentSize.width === nextWidth &&
          currentSize.height === nextHeight
        ) {
          return currentSize
        }

        return {
          width: nextWidth,
          height: nextHeight,
        }
      })
    }

    updateSize()

    const resizeObserver = new ResizeObserver(() => {
      updateSize()
    })

    resizeObserver.observe(containerElement)

    return () => {
      resizeObserver.disconnect()
    }
  }, [containerRef])

  useEffect(() => {
    const canvasElement = canvasRef.current
    const videoElement = videoRef.current

    if (!canvasElement) {
      return
    }

    const hasPose = !!result?.primaryLandmarks?.length
    const drawTimestamp = result?.timestampMs ?? null
    const videoWidth = videoElement?.videoWidth ?? 0
    const videoHeight = videoElement?.videoHeight ?? 0
    const drawSignature = [
      overlaySize.width,
      overlaySize.height,
      videoWidth,
      videoHeight,
      mirrored ? 'm' : 'n',
    ].join(':')

    const shouldDraw =
      drawSignature !== lastDrawSignatureRef.current ||
      drawTimestamp !== lastDrawnTimestampRef.current ||
      hasPose !== lastHadPoseRef.current

    if (!shouldDraw) {
      return
    }

    drawPose({
      canvas: canvasElement,
      result,
      videoWidth,
      videoHeight,
      overlayWidth: overlaySize.width,
      overlayHeight: overlaySize.height,
      mirrored,
    })

    lastDrawSignatureRef.current = drawSignature
    lastDrawnTimestampRef.current = drawTimestamp
    lastHadPoseRef.current = hasPose
  }, [mirrored, overlaySize.height, overlaySize.width, result, videoRef])

  return <canvas ref={canvasRef} style={canvasStyle} aria-hidden="true" />
}
