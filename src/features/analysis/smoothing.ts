import type { SmoothingBuffer } from './types'

function clampWindowSize(windowSize: number) {
  return Math.max(1, Math.floor(windowSize))
}

export function createSmoothingBuffer(windowSize: number): SmoothingBuffer {
  return {
    windowSize: clampWindowSize(windowSize),
    values: [],
  }
}

export function pushSmoothedValue(
  buffer: SmoothingBuffer,
  nextValue: number | null,
): number | null {
  if (nextValue === null || !Number.isFinite(nextValue)) {
    return null
  }

  buffer.values.push(nextValue)

  if (buffer.values.length > buffer.windowSize) {
    buffer.values.shift()
  }

  return movingAverage(buffer.values)
}

export function movingAverage(values: number[]): number | null {
  const validValues = values.filter(Number.isFinite)

  if (validValues.length === 0) {
    return null
  }

  const sum = validValues.reduce((total, value) => total + value, 0)

  return sum / validValues.length
}

export function smoothSeries(values: Array<number | null>, windowSize: number) {
  const buffer = createSmoothingBuffer(windowSize)

  return values.map((value) => pushSmoothedValue(buffer, value))
}

export function exponentialSmoothing(
  previousValue: number | null,
  nextValue: number | null,
  alpha = 0.35,
): number | null {
  if (nextValue === null || !Number.isFinite(nextValue)) {
    return previousValue
  }

  if (previousValue === null || !Number.isFinite(previousValue)) {
    return nextValue
  }

  const clampedAlpha = Math.min(1, Math.max(0, alpha))

  return previousValue + clampedAlpha * (nextValue - previousValue)
}
