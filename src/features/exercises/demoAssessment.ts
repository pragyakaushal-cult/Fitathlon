import type { PostureWarning, PostureWarningKey } from '@/features/analysis/feedback'
import type { PostureRuleConfig } from '@/features/analysis/postureRules'
import type { RepDetectionConfig } from '@/features/analysis/config'
import type { PostureScoreWeights } from '@/features/analysis/scoring'
import type { ExerciseId } from './config'

export type DemoExerciseId =
  | 'bodyweight_squat'
  | 'sumo_squat'
  | 'forward_lunge'
  | 'conventional_deadlift'
  | 'push_ups'
  | 'shoulder_press'
  | 'arnold_press'
  | 'plank'

export type DemoRepTrackingKind =
  | 'existing-squat'
  | 'knee-cycle'
  | 'torso-cycle'
  | 'elbow-cycle'
  | 'press-cycle'
  | 'hold'

export interface DemoRepTrackingConfig {
  kind: DemoRepTrackingKind
  startThreshold?: number
  bottomThreshold?: number
  riseThreshold?: number
  completeThreshold?: number
  topReachThreshold?: number
  resetReachThreshold?: number
  minDelta?: number
  minPoseVisibility?: number
  minRepIntervalMs?: number
  holdMs?: number
  stableOffsetThreshold?: number
  releaseOffsetThreshold?: number
}

export interface DemoExerciseAssessmentPreset {
  id: DemoExerciseId
  label: string
  requiresCalibration: boolean
  trackingSummary: string
  assessmentIntro: string
  idleCue: string
  resultTitle: string
  repTracking: DemoRepTrackingConfig
  ruleConfig?: Partial<PostureRuleConfig>
  scoreWeights?: Partial<PostureScoreWeights>
  warningOverrides?: Partial<
    Record<PostureWarningKey, Partial<PostureWarning>>
  >
  repConfig?: Partial<RepDetectionConfig>
}

export const DEMO_EXERCISE_PRESETS: Record<
  DemoExerciseId,
  DemoExerciseAssessmentPreset
> = {
  bodyweight_squat: {
    id: 'bodyweight_squat',
    label: 'Bodyweight Squat',
    requiresCalibration: true,
    trackingSummary:
      'Personal baseline calibration, squat rep counting, depth scoring, and rep-level coaching.',
    assessmentIntro:
      'Track full squat reps with depth, torso position, and knee control coaching.',
    idleCue:
      'Sit down under control, reach depth, and stand tall to complete each squat rep.',
    resultTitle: 'Bodyweight squat summary',
    repTracking: {
      kind: 'existing-squat',
    },
    repConfig: {
      descendingKneeAngleDeg: 158,
      bottomKneeAngleDeg: 108,
      ascendingKneeAngleDeg: 126,
      standingKneeAngleDeg: 166,
    },
    ruleConfig: {
      squatTorsoLeanWarningDeg: 34,
      squatKneeCollapseRatioThreshold: 0.74,
      squatInsufficientDepthNormalized: 0.2,
    },
    scoreWeights: {
      kneeCollapse: 34,
      insufficientDepth: 28,
      excessiveTorsoLean: 26,
      leftRightAsymmetry: 18,
    },
    warningOverrides: {
      insufficientDepth: {
        title: 'Hit parallel',
        message: 'The squat is stopping short of your working depth.',
        recommendation: 'Sit slightly deeper before driving back up.',
      },
    },
  },
  sumo_squat: {
    id: 'sumo_squat',
    label: 'Sumo Squat',
    requiresCalibration: true,
    trackingSummary:
      'Wide-stance squat assessment with calibration, rep counting, depth tracking, and stance-specific coaching.',
    assessmentIntro:
      'Track sumo squat reps with wide-stance depth, knee control, and upright torso coaching.',
    idleCue:
      'Sit between the hips, reach depth under control, and stand tall to complete each rep.',
    resultTitle: 'Sumo squat summary',
    repTracking: {
      kind: 'existing-squat',
    },
    repConfig: {
      descendingKneeAngleDeg: 166,
      bottomKneeAngleDeg: 124,
      ascendingKneeAngleDeg: 138,
      standingKneeAngleDeg: 162,
      descendingHipDepth: {
        normalized: 0.04,
        absolute: 0.04,
      },
      bottomHipDepth: {
        normalized: 0.1,
        absolute: 0.1,
      },
      ascendingHipDepth: {
        normalized: 0.08,
        absolute: 0.08,
      },
      standingHipDepth: {
        normalized: 0.03,
        absolute: 0.03,
      },
      depthDeltaEpsilon: {
        normalized: 0.004,
        absolute: 0.004,
      },
      minRepIntervalMs: 700,
    },
    ruleConfig: {
      squatTorsoLeanWarningDeg: 32,
      squatKneeCollapseRatioThreshold: 0.76,
      squatInsufficientDepthNormalized: 0.16,
    },
    scoreWeights: {
      kneeCollapse: 34,
      insufficientDepth: 26,
      excessiveTorsoLean: 24,
      leftRightAsymmetry: 20,
    },
    warningOverrides: {
      insufficientDepth: {
        title: 'Sit deeper into the stance',
        message: 'The rep is stopping short for your sumo squat depth.',
        recommendation: 'Sit between the hips a little deeper before standing up.',
      },
      kneeCollapse: {
        title: 'Track the knees over the toes',
        message: 'The knees are drifting inward during the sumo squat.',
        recommendation: 'Push the knees out and keep the stance active through the floor.',
      },
    },
  },
  forward_lunge: {
    id: 'forward_lunge',
    label: 'Forward Lunge',
    requiresCalibration: false,
    trackingSummary:
      'Forward-lunge rep detection with split-stance balance, knee tracking, and torso control feedback.',
    assessmentIntro:
      'Track forward lunges with front-knee control, split stance balance, and return-to-stand rep counting.',
    idleCue:
      'Step into the lunge, control the bottom, and return fully upright to finish each rep.',
    resultTitle: 'Forward lunge summary',
    repTracking: {
      kind: 'knee-cycle',
      startThreshold: 146,
      bottomThreshold: 108,
      riseThreshold: 124,
      completeThreshold: 154,
      minDelta: 0.45,
      minPoseVisibility: 0.45,
      minRepIntervalMs: 850,
    },
    ruleConfig: {
      lungeTorsoLeanWarningDeg: 30,
      lungeKneeCollapseRatioThreshold: 0.73,
      lungeDepthKneeAngleDeg: 110,
      lungeAsymmetryScoreThreshold: 72,
    },
    scoreWeights: {
      kneeCollapse: 34,
      excessiveTorsoLean: 26,
      insufficientDepth: 24,
      leftRightAsymmetry: 24,
    },
    warningOverrides: {
      kneeCollapse: {
        title: 'Track the front knee',
        message: 'The front knee is collapsing inward during the lunge.',
        recommendation: 'Keep the front knee stacked over the middle toes.',
      },
      leftRightAsymmetry: {
        title: 'Stay centered',
        message: 'Your split stance is shifting unevenly side to side.',
        recommendation: 'Keep the ribcage centered over the hips on the way down.',
      },
    },
  },
  conventional_deadlift: {
    id: 'conventional_deadlift',
    label: 'Conventional Deadlift',
    requiresCalibration: false,
    trackingSummary:
      'Deadlift rep detection with hinge depth, knee-drive control, and spinal position coaching.',
    assessmentIntro:
      'Track deadlift-style reps by monitoring hinge depth, return to stand, and balance through the pull.',
    idleCue:
      'Push the hips back, hinge into the rep, then stand tall to complete each deadlift.',
    resultTitle: 'Conventional deadlift summary',
    repTracking: {
      kind: 'torso-cycle',
      startThreshold: 24,
      bottomThreshold: 54,
      riseThreshold: 38,
      completeThreshold: 16,
      minDelta: 0.4,
      minPoseVisibility: 0.45,
      minRepIntervalMs: 900,
    },
    ruleConfig: {
      hingeMinTorsoLeanDeg: 30,
      hingeExcessiveKneeDriveDeg: 128,
      hingeAsymmetryScoreThreshold: 74,
    },
    scoreWeights: {
      insufficientHipHinge: 36,
      excessiveKneeDrive: 28,
      excessiveTorsoLean: 18,
      leftRightAsymmetry: 20,
    },
    warningOverrides: {
      insufficientHipHinge: {
        title: 'Hinge deeper',
        message: 'The rep is staying too upright for a deadlift pattern.',
        recommendation: 'Push the hips back more before you stand up.',
      },
      excessiveKneeDrive: {
        title: 'Don’t squat the pull',
        message: 'Your knees are driving forward instead of loading the hinge.',
        recommendation: 'Keep a soft knee bend and load more through the hips.',
      },
    },
  },
  push_ups: {
    id: 'push_ups',
    label: 'Push-ups',
    requiresCalibration: false,
    trackingSummary:
      'Push-up rep detection with elbow depth, trunk line, and shoulder symmetry coaching.',
    assessmentIntro:
      'Track push-up reps with chest-depth control, a stable body line, and balanced shoulder mechanics.',
    idleCue:
      'Lower under control, reach depth, and press back to a strong plank to complete each rep.',
    resultTitle: 'Push-up summary',
    repTracking: {
      kind: 'elbow-cycle',
      startThreshold: 146,
      bottomThreshold: 90,
      riseThreshold: 112,
      completeThreshold: 154,
      minDelta: 0.45,
      minPoseVisibility: 0.45,
      minRepIntervalMs: 800,
    },
    ruleConfig: {
      pushDepthElbowAngleDeg: 108,
      pushHipDropThreshold: 0.035,
      pushHipPikeThreshold: 0.035,
      pushShoulderInstabilityThreshold: 76,
    },
    scoreWeights: {
      insufficientRangeOfMotion: 34,
      hipDrop: 32,
      hipPike: 28,
      shoulderInstability: 22,
    },
    warningOverrides: {
      insufficientRangeOfMotion: {
        title: 'Lower deeper',
        message: 'The push-up is staying short and not reaching working depth.',
        recommendation: 'Lower further before pressing back to the top.',
      },
      shoulderInstability: {
        title: 'Press evenly',
        message: 'One side is pressing differently from the other.',
        recommendation: 'Keep both hands pressing the floor evenly through the rep.',
      },
    },
  },
  shoulder_press: {
    id: 'shoulder_press',
    label: 'Shoulder Press',
    requiresCalibration: false,
    trackingSummary:
      'Strict shoulder-press rep detection with overhead lockout, torso stack, and leg-drive checks.',
    assessmentIntro:
      'Track shoulder press reps with clean overhead lockout, even arm drive, and strict torso control.',
    idleCue:
      'Start with the hands near shoulder height, press overhead to lockout, then lower under control to finish each rep.',
    resultTitle: 'Shoulder press summary',
    repTracking: {
      kind: 'press-cycle',
      startThreshold: 118,
      bottomThreshold: 156,
      riseThreshold: 136,
      completeThreshold: 114,
      topReachThreshold: 0.05,
      resetReachThreshold: 0.03,
      minDelta: 0.6,
      minPoseVisibility: 0.45,
      minRepIntervalMs: 900,
    },
    ruleConfig: {
      pushEvaluationMode: 'vertical',
      pushVerticalLockoutElbowAngleDeg: 154,
      pushVerticalReachThreshold: 0.05,
      pushVerticalTorsoLeanWarningDeg: 24,
      pushVerticalKneeDriveAngleDeg: 150,
      pushShoulderInstabilityThreshold: 74,
    },
    scoreWeights: {
      insufficientRangeOfMotion: 36,
      excessiveTorsoLean: 28,
      excessiveKneeDrive: 26,
      shoulderInstability: 22,
    },
    warningOverrides: {
      insufficientRangeOfMotion: {
        title: 'Press to lockout',
        message: 'The press is finishing short and not getting fully overhead.',
        recommendation:
          'Stack the wrists over the shoulders before lowering the rep.',
      },
      excessiveTorsoLean: {
        title: 'Stay stacked',
        message: 'You are leaning back to finish the press.',
        recommendation:
          'Brace the ribcage and press straight up instead of arching back.',
      },
      excessiveKneeDrive: {
        title: 'Keep it strict',
        message: 'The knees are dipping to help the press.',
        recommendation:
          'Stay tall and drive with the shoulders instead of turning it into a push press.',
      },
      shoulderInstability: {
        title: 'Drive both arms evenly',
        message: 'One arm is locking out differently from the other.',
        recommendation:
          'Slow the tempo and keep both elbows extending together overhead.',
      },
    },
  },
  arnold_press: {
    id: 'arnold_press',
    label: 'Arnold Press',
    requiresCalibration: false,
    trackingSummary:
      'Arnold-press rep detection with overhead lockout, controlled rotation, and strict standing posture checks.',
    assessmentIntro:
      'Track Arnold press reps with a smooth press overhead, even lockout, and stable standing posture.',
    idleCue:
      'Rotate and press overhead, finish tall at lockout, then return under control to start the next rep.',
    resultTitle: 'Arnold press summary',
    repTracking: {
      kind: 'press-cycle',
      startThreshold: 116,
      bottomThreshold: 154,
      riseThreshold: 134,
      completeThreshold: 112,
      topReachThreshold: 0.04,
      resetReachThreshold: 0.04,
      minDelta: 0.55,
      minPoseVisibility: 0.45,
      minRepIntervalMs: 900,
    },
    ruleConfig: {
      pushEvaluationMode: 'vertical',
      pushVerticalLockoutElbowAngleDeg: 150,
      pushVerticalReachThreshold: 0.04,
      pushVerticalTorsoLeanWarningDeg: 24,
      pushVerticalKneeDriveAngleDeg: 150,
      pushShoulderInstabilityThreshold: 74,
    },
    scoreWeights: {
      insufficientRangeOfMotion: 34,
      excessiveTorsoLean: 28,
      excessiveKneeDrive: 24,
      shoulderInstability: 24,
    },
    warningOverrides: {
      insufficientRangeOfMotion: {
        title: 'Finish the rotation',
        message:
          'The press is not reaching a clean overhead finish position.',
        recommendation:
          'Rotate through smoothly and finish with both hands fully overhead.',
      },
      excessiveTorsoLean: {
        title: 'Stack over the hips',
        message: 'The trunk is leaning back to finish the Arnold press.',
        recommendation:
          'Keep the ribs down and press overhead without arching through the back.',
      },
      excessiveKneeDrive: {
        title: 'No leg dip',
        message: 'Your knees are helping the press too much.',
        recommendation:
          'Keep the legs quiet so the shoulders and triceps do the work.',
      },
      shoulderInstability: {
        title: 'Sync the arms',
        message: 'The two arms are not rotating and locking out evenly.',
        recommendation:
          'Slow down and keep both elbows and wrists moving together.',
      },
    },
  },
  plank: {
    id: 'plank',
    label: 'Plank',
    requiresCalibration: false,
    trackingSummary:
      'Timed plank hold scoring with trunk-line stability, hip position, and shoulder control feedback.',
    assessmentIntro:
      'Track plank holds by counting stable hold segments while coaching hip line and shoulder balance.',
    idleCue:
      'Hold one strong line from shoulders to ankles. Each stable hold segment counts toward the target.',
    resultTitle: 'Plank summary',
    repTracking: {
      kind: 'hold',
      holdMs: 3000,
      minPoseVisibility: 0.45,
      minRepIntervalMs: 2800,
      stableOffsetThreshold: 0.03,
      releaseOffsetThreshold: 0.05,
    },
    ruleConfig: {
      coreHipDropThreshold: 0.03,
      coreHipPikeThreshold: 0.03,
      coreShoulderInstabilityThreshold: 76,
    },
    scoreWeights: {
      hipDrop: 34,
      hipPike: 30,
      shoulderInstability: 24,
    },
    warningOverrides: {
      hipDrop: {
        title: 'Brace the midline',
        message: 'The plank is sagging through the hips.',
        recommendation: 'Pull the ribs in and keep the hips level.',
      },
      hipPike: {
        title: 'Flatten the line',
        message: 'The hips are drifting too high out of the plank.',
        recommendation: 'Bring the hips back in line with the shoulders and ankles.',
      },
    },
  },
}

export function getDemoExercisePreset(
  exerciseId: ExerciseId | null | undefined,
): DemoExerciseAssessmentPreset | null {
  if (!exerciseId) {
    return null
  }

  return DEMO_EXERCISE_PRESETS[exerciseId as DemoExerciseId] ?? null
}
