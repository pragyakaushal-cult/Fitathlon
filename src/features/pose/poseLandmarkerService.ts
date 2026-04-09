import {
  FilesetResolver,
  PoseLandmarker,
  type NormalizedLandmark,
  type PoseLandmarkerResult,
} from '@mediapipe/tasks-vision'
import type {
  PoseInferenceResult,
  PoseLandmarkerConfig,
  PoseVisibilitySummary,
} from './types'

const TASKS_VISION_VERSION = '0.10.34'

export const DEFAULT_WASM_ROOT =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VISION_VERSION}/wasm`

export const RECOMMENDED_LOCAL_MODEL_PATH = '/models/pose_landmarker_lite.task'

export const DEFAULT_REMOTE_MODEL_PATH =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task'

export const DEFAULT_POSE_LANDMARKER_CONFIG: PoseLandmarkerConfig = {
  wasmRoot: DEFAULT_WASM_ROOT,
  modelAssetPath: DEFAULT_REMOTE_MODEL_PATH,
  delegate: 'CPU',
  numPoses: 1,
  minPoseDetectionConfidence: 0.5,
  minPosePresenceConfidence: 0.5,
  minTrackingConfidence: 0.5,
}

const visionFilesetCache = new Map<
  string,
  ReturnType<typeof FilesetResolver.forVisionTasks>
>()

function sanitizeVisibility(value: number | undefined) {
  if (!Number.isFinite(value)) {
    return 0
  }

  const numericValue = value ?? 0

  return Math.min(1, Math.max(0, numericValue))
}

function summarizePoseVisibility(
  landmarks: NormalizedLandmark[],
): PoseVisibilitySummary {
  if (landmarks.length === 0) {
    return {
      averageVisibility: 0,
      minVisibility: 0,
      maxVisibility: 0,
      landmarkCount: 0,
    }
  }

  const visibilityValues = landmarks.map((landmark) =>
    sanitizeVisibility(landmark.visibility),
  )

  const totalVisibility = visibilityValues.reduce(
    (total, visibility) => total + visibility,
    0,
  )

  return {
    averageVisibility: totalVisibility / visibilityValues.length,
    minVisibility: Math.min(...visibilityValues),
    maxVisibility: Math.max(...visibilityValues),
    landmarkCount: visibilityValues.length,
  }
}

function buildPoseInferenceResult(
  rawResult: PoseLandmarkerResult,
  timestampMs: number,
  videoTimeS: number,
  inferenceDurationMs: number,
): PoseInferenceResult {
  const poseVisibility = rawResult.landmarks.map((poseLandmarks) =>
    summarizePoseVisibility(poseLandmarks),
  )

  return {
    rawResult,
    landmarks: rawResult.landmarks,
    worldLandmarks: rawResult.worldLandmarks,
    poseCount: rawResult.landmarks.length,
    primaryLandmarks: rawResult.landmarks[0] ?? null,
    primaryWorldLandmarks: rawResult.worldLandmarks[0] ?? null,
    poseVisibility,
    primaryPoseVisibility: poseVisibility[0] ?? null,
    timestampMs,
    videoTimeS,
    inferenceDurationMs,
  }
}

function resolveConfig(
  config?: Partial<PoseLandmarkerConfig>,
): PoseLandmarkerConfig {
  return {
    ...DEFAULT_POSE_LANDMARKER_CONFIG,
    ...config,
  }
}

function getConfigKey(config: PoseLandmarkerConfig) {
  return JSON.stringify(config)
}

function getVisionFileset(wasmRoot: string) {
  const existingFilesetPromise = visionFilesetCache.get(wasmRoot)

  if (existingFilesetPromise) {
    return existingFilesetPromise
  }

  const nextFilesetPromise = FilesetResolver.forVisionTasks(wasmRoot)
  visionFilesetCache.set(wasmRoot, nextFilesetPromise)

  return nextFilesetPromise
}

function createInitializationError(
  error: unknown,
  config: PoseLandmarkerConfig,
) {
  const baseMessage =
    error instanceof Error
      ? error.message
      : 'Unknown Pose Landmarker initialization failure.'

  return new Error(
    [
      'Failed to initialize MediaPipe Pose Landmarker.',
      `modelAssetPath=${config.modelAssetPath}`,
      `wasmRoot=${config.wasmRoot}`,
      baseMessage,
    ].join(' '),
  )
}

class PoseLandmarkerService {
  private landmarker: PoseLandmarker | null = null
  private landmarkerConfigKey: string | null = null
  private initializationPromise: Promise<PoseLandmarker> | null = null

  async initialize(
    config?: Partial<PoseLandmarkerConfig>,
  ): Promise<PoseLandmarker> {
    const resolvedConfig = resolveConfig(config)
    const nextConfigKey = getConfigKey(resolvedConfig)

    if (this.landmarker && this.landmarkerConfigKey === nextConfigKey) {
      return this.landmarker
    }

    if (
      this.initializationPromise &&
      this.landmarkerConfigKey === nextConfigKey
    ) {
      return this.initializationPromise
    }

    if (this.landmarker) {
      this.landmarker.close()
      this.landmarker = null
    }

    this.landmarkerConfigKey = nextConfigKey
    this.initializationPromise = (async () => {
      try {
        const vision = await getVisionFileset(resolvedConfig.wasmRoot)
        const landmarker = await PoseLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: resolvedConfig.modelAssetPath,
            delegate: resolvedConfig.delegate,
          },
          runningMode: 'VIDEO',
          numPoses: resolvedConfig.numPoses,
          minPoseDetectionConfidence:
            resolvedConfig.minPoseDetectionConfidence,
          minPosePresenceConfidence:
            resolvedConfig.minPosePresenceConfidence,
          minTrackingConfidence: resolvedConfig.minTrackingConfidence,
          outputSegmentationMasks: false,
        })

        this.landmarker = landmarker
        return landmarker
      } catch (error) {
        this.landmarkerConfigKey = null
        throw createInitializationError(error, resolvedConfig)
      } finally {
        this.initializationPromise = null
      }
    })()

    return this.initializationPromise
  }

  async detectForVideo(
    videoElement: HTMLVideoElement,
    timestampMs: number,
    config?: Partial<PoseLandmarkerConfig>,
  ): Promise<PoseInferenceResult> {
    const landmarker = await this.initialize(config)
    const startedAt = performance.now()
    const rawResult = landmarker.detectForVideo(videoElement, timestampMs)
    const inferenceDurationMs = performance.now() - startedAt

    return buildPoseInferenceResult(
      rawResult,
      timestampMs,
      videoElement.currentTime,
      inferenceDurationMs,
    )
  }

  close() {
    if (this.landmarker) {
      this.landmarker.close()
      this.landmarker = null
    }

    this.landmarkerConfigKey = null
    this.initializationPromise = null
  }
}

export const poseLandmarkerService = new PoseLandmarkerService()
