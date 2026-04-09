# Cult Copilot

Cult Copilot is a browser-based workout tracking app built with React,
TypeScript, Vite, and MediaPipe Pose Landmarker. It started as a squat-focused
form checker and has been extended into a broader multi-workout experience with
camera setup, pose overlay, live posture coaching, a premium dark UI, and a
toggle between `Studio` and `Night` display modes.

This repository currently delivers two levels of tracking:

- Full scored assessment for all `squat-profile` exercises:
  calibration, rep detection, live cues, posture scoring, and results.
- Live posture coaching for `lunge`, `hinge`, `push`, `pull`, and `core`
  profiles using profile-specific warning rules and pose visibility checks.

For product usage instructions, see [USER_MANUAL.md](./USER_MANUAL.md).

## What Has Been Done In This Build

This project has been upgraded from a single squat-only prototype into a more
complete demo-ready product. The main work completed in this repository is:

- Renamed the project branding to `Cult Copilot`.
- Kept the working browser-based pose tracking pipeline intact.
- Extended the UI from a squat-only flow into a multi-workout selection flow.
- Added lower-body and upper-body workout categories.
- Added exercise families and a reusable workout catalog.
- Preserved the full squat calibration and scoring experience.
- Added live coaching profiles for non-squat workout families.
- Expanded frame metrics beyond squat-only geometry.
- Added more posture warning types for push, pull, hinge, lunge, and core work.
- Improved the hero, cards, camera surface, overlay, and results UI.
- Added a premium dark visual system.
- Added a `Studio / Night` theme toggle with persistence.
- Fixed the MediaPipe packet timestamp mismatch issue by switching pose
  inference to a strictly increasing timestamp source.
- Verified the app with `npm run build` and `npm run lint`.

## Current Product Scope

### Main Experience

- Guided single-page flow
- Browser webcam access
- MediaPipe pose inference
- Pose skeleton overlay
- Live status pills for camera, pose engine, and subject detection
- Workout selection by category and family
- Theme toggle in the home hero

### Squat-Profile Experience

Exercises mapped to the `squat` analysis profile currently get:

- Camera setup step
- Standing baseline calibration
- Rep-state detection
- Live posture warnings during assessment
- 3-rep assessment session
- Posture score
- Movement score
- Fatigue trend
- Top recommendations
- Results screen

### Non-Squat Live Coaching Experience

Exercises mapped to `lunge`, `hinge`, `push`, `pull`, or `core` currently get:

- Camera setup
- Pose overlay
- Visibility confidence
- Person detected / lost status
- Live posture score
- Profile-specific warning messages
- Family-level coaching cues

They do not yet get the same rep-counted results workflow as squat-profile
movements.

## Supported Workouts

### Lower Body

#### Squats

- Bodyweight Squat
- Air Squat
- Goblet Squat
- Barbell Back Squat
- Front Squat
- Sumo Squat
- Overhead Squat
- Pulse Squats

#### Lunges

- Forward Lunge
- Reverse Lunge
- Walking Lunges
- Side Lunges
- Curtsy Lunges
- Bulgarian Split Squat

#### Glutes / Hips

- Hip Thrust
- Glute Bridge
- Single-leg Glute Bridge
- Step-ups
- Box Squats

#### Deadlifts / Hinge

- Conventional Deadlift
- Romanian Deadlift
- Sumo Deadlift
- Single-leg Deadlift

#### Functional Lower Body

- Jump Squats
- Box Jumps
- Kettlebell Swings
- Wall Balls

### Upper Body

#### Push

- Push-ups
- Incline Push-ups
- Decline Push-ups
- Bench Press
- Dumbbell Chest Press
- Shoulder Press
- Arnold Press
- Pike Push-ups
- Tricep Dips
- Bench Dips
- Overhead Tricep Extension

#### Pull

- Pull-ups
- Chin-ups
- Assisted Pull-ups
- Lat Pulldown
- Seated Row
- Bent-over Row
- One-arm Dumbbell Row
- Face Pulls
- Reverse Fly

#### Core

- Plank
- Side Plank
- Mountain Climbers
- Bicycle Crunches
- Leg Raises
- Hanging Leg Raises
- Russian Twists
- Dead Bug

## Analysis Profiles And Live Warning Coverage

The app uses analysis profiles instead of a single one-size-fits-all warning
engine.

### Squat Profile

- Knee collapse
- Excessive torso lean
- Insufficient depth
- Left-right asymmetry

### Lunge Profile

- Excessive torso lean
- Knee collapse
- Insufficient depth
- Left-right asymmetry

### Hinge Profile

- Insufficient hip hinge
- Excessive knee drive
- Left-right asymmetry

### Push Profile

- Insufficient range of motion
- Hip drop
- Hip pike
- Shoulder instability

### Pull Profile

- Insufficient range of motion
- Excessive torso lean
- Shoulder instability
- Left-right asymmetry

### Core Profile

- Hip drop
- Hip pike
- Shoulder instability

## UI And UX Improvements Added

The current UI is no longer a plain prototype shell. The work completed here
includes:

- Premium dark styling with an editorial display font and a cleaner body font
- Refined app shell and hero layout
- Richer camera card styling
- Stronger status pill system
- Improved workout picker
- Better metrics cards
- More polished results presentation
- Ambient background motion
- Subtle surface rise and reveal animations
- Camera-stage sheen motion
- Theme toggle with `Studio` and `Night` modes
- Persistent theme preference using `localStorage`

## Stability Fixes

The MediaPipe graph issue below was fixed in this repo:

- `INVALID_ARGUMENT: CalculatorGraph::Run() failed: Packet timestamp mismatch`

Root cause:

- Pose inference timestamps were not guaranteed to be monotonically increasing.

Fix applied:

- Pose inference now uses a strictly increasing timestamp generator before each
  `detectForVideo` call.

## Tech Stack

- React 19
- TypeScript
- Vite
- MediaPipe Tasks Vision (`@mediapipe/tasks-vision`)
- ESLint

## Getting Started

Install dependencies:

```bash
npm install
```

Start the local development server:

```bash
npm run dev
```

Open the local app in the browser:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

To test on another device on the same network:

```bash
npm run dev:host
```

## Available Scripts

- `npm run dev` starts the Vite development server
- `npm run dev:host` starts Vite on the local network
- `npm run build` runs TypeScript build checks and creates a production bundle
- `npm run typecheck` runs TypeScript project checks without bundling
- `npm run lint` runs ESLint
- `npm run preview` serves the production build locally

## High-Level User Flow

1. Open the app.
2. Choose a workout category.
3. Choose an exercise.
4. Allow camera access.
5. Wait until camera, pose, and person detection are ready.
6. For squat-profile exercises:
   capture baseline, perform the 3-rep test, then review results.
7. For other profiles:
   continue into live tracking and follow posture warnings on screen.

## Important Files

### App Flow

- `src/features/form-check/FormCheckFlow.tsx`
- `src/features/form-check/FormCheckFlow.css`

### Camera

- `src/features/camera/useWebcam.ts`
- `src/features/camera/WebcamView.tsx`
- `src/features/camera/WebcamView.css`

### Pose Inference

- `src/features/pose/usePoseLandmarker.ts`
- `src/features/pose/PoseCanvasOverlay.tsx`

### Analysis

- `src/features/analysis/frameMetrics.ts`
- `src/features/analysis/profiles.ts`
- `src/features/analysis/postureRules.ts`
- `src/features/analysis/feedback.ts`
- `src/features/analysis/useRepDetection.ts`
- `src/features/analysis/repStateMachine.ts`

### Workout Catalog

- `src/features/exercises/config.ts`

### Squat Assessment

- `src/features/form-check/useCalibration.ts`
- `src/features/form-check/useAssessmentSession.ts`

### Results

- `src/features/results/ResultsScreen.tsx`
- `src/features/results/results.css`

### Global Styling

- `src/styles/global.css`
- `src/app/app.css`

## Current Limitations

- Full rep-counted assessment is currently tied to `squat-profile` exercises.
- Other workout families currently use live coaching rather than final scored
  assessment screens.
- Accuracy depends heavily on camera angle, lighting, full-body visibility, and
  exercise suitability for 2D webcam pose estimation.
- This is still a frontend/browser MVP with no backend persistence, auth, or
  user accounts.

## Validation

The current codebase has been validated with:

```bash
npm run build
npm run lint
```

## Suggested Next Product Steps

- Add rep-state machines for lunge, hinge, push, pull, and core exercises
- Add per-family assessment sessions and results screens
- Tune rule thresholds using recorded workout samples
- Add session history and persistence
- Add onboarding and camera-angle guidance per exercise family
- Add mobile-specific layout tuning for recording and demo use
