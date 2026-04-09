# Cult Copilot User Manual

This manual explains how to run and use Cult Copilot as it exists in the
current codebase.

## 1. What This App Is

Cult Copilot is a browser-based workout tracking app that uses your webcam and
MediaPipe pose detection to monitor body position, show a pose overlay, and
surface form guidance while you exercise.

It supports multiple workouts, but not all workouts behave the same way yet:

- `squat-profile` exercises have the complete scored flow.
- `lunge`, `hinge`, `push`, `pull`, and `core` exercises use live posture
  coaching and on-screen warning cues.

## 2. What You Need

- A laptop or desktop with a webcam, or a browser-enabled device with camera
  access
- A modern browser
- Enough space to keep your full body visible
- Reasonable lighting so shoulders, hips, knees, and ankles stay detectable

## 3. How To Start The App

From the project root:

```bash
npm install
npm run dev
```

Open:

- `http://localhost:5173`
- `http://127.0.0.1:5173`

If you want to test from a phone or another device on the same Wi-Fi network:

```bash
npm run dev:host
```

Then use the network URL printed by Vite.

## 4. Home Screen Overview

When the app loads, you will see:

- The `Cult Copilot` hero section
- A `Studio / Night` display toggle
- Status pills for:
  camera status, pose status, person detection, and current workout
- The stepper that shows where you are in the flow
- The live camera card
- The right-side workflow panel

## 5. Theme Toggle

The app includes two display modes:

- `Studio mode`
- `Night mode`

How it works:

- The toggle is shown in the top-right of the hero area.
- Clicking the toggle switches the UI palette instantly.
- The selection is saved in `localStorage`.
- When you refresh the page, the app restores the last selected mode.

## 6. Camera Setup Rules

For the best tracking quality:

- Keep your full body inside the frame
- Keep shoulders, hips, knees, and ankles visible
- Avoid cropped feet or knees
- Use even lighting
- Move away from cluttered backgrounds if the overlay becomes unstable

For squat-profile movements, a side or slight side angle works best.

## 7. Status Indicators

The app shows real-time status pills.

### Camera Status

- `requesting` means the browser is asking for permission
- `ready` means the webcam is running
- `error` means camera access failed

### Pose Status

- `initializing` means the pose model is starting
- `running` means pose inference is active
- `error` means the pose model failed

### Person Status

- `detected` means a person is currently tracked
- `lost` means tracking was active but is now unstable or off-frame
- `not-detected` means no valid person is currently visible

## 8. Step-By-Step: Using A Workout

### Step 1: Choose Workout

1. Click `Choose workout`.
2. Select a body area:
   `Lower body` or `Upper body`
3. Select an exercise from the family list.

### Step 2: Confirm Camera Readiness

Before continuing:

- Camera should be `ready`
- Pose should be `running`
- Person should be `detected`

If those are not ready, do not continue yet.

### Step 3A: Squat-Profile Exercise Flow

The following exercises currently enter the full scored workflow:

- Bodyweight Squat
- Air Squat
- Goblet Squat
- Barbell Back Squat
- Front Squat
- Sumo Squat
- Overhead Squat
- Pulse Squats
- Box Squats
- Jump Squats
- Box Jumps
- Wall Balls

How to use the full scored flow:

1. Go to camera setup.
2. Make sure tracking is stable.
3. Continue to `Calibration`.
4. Stand upright and still.
5. Click `Capture baseline`.
6. Once baseline is captured, click `Start 3-rep test`.
7. Perform 3 controlled reps.
8. Read the live coaching warning if one appears.
9. After 3 reps, the app moves to the results screen.

### Step 3B: Live Coaching Exercise Flow

These profiles currently use live coaching instead of the 3-rep results flow:

- `lunge`
- `hinge`
- `push`
- `pull`
- `core`

How to use live coaching mode:

1. Choose an exercise.
2. Finish camera setup.
3. Click `Start live tracking`.
4. Move slowly enough for the pose overlay to stay stable.
5. Watch the live warning box for form guidance.
6. Use the metrics and status cards to monitor tracking quality.

## 9. Workout Families And Supported Exercises

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

## 10. What The App Tracks On Screen

The left-side camera panel includes:

- Webcam preview
- Pose skeleton overlay
- Status pills
- Visibility score
- Current mode
- Current warning message
- Metric cards

Metric cards currently include:

- Workout
- Mode
- Camera
- Pose
- Person tracking
- Average visibility
- Knee angle
- Hip depth or posture score

## 11. Warning Types By Profile

### Squat

- Drive knees out
- Keep chest up
- Squat deeper
- Balance both sides

### Lunge

- Keep chest up
- Drive knees out
- Squat deeper
- Balance both sides

### Hinge

- Push hips back
- Soften the knees
- Balance both sides

### Push

- Use more range
- Keep hips up
- Lower the hips
- Even out the shoulders

### Pull

- Use more range
- Keep chest up
- Even out the shoulders
- Balance both sides

### Core

- Keep hips up
- Lower the hips
- Even out the shoulders

## 12. Buttons And Controls

### Main Flow Buttons

- `Choose workout`
- `Change body area`
- `Back`
- `Continue to calibration`
- `Start live tracking`
- `Capture baseline`
- `Start 3-rep test`
- `Change exercise`
- `Recalibrate`
- `Reset session`
- `Restart form check`

### Camera Toolbar Buttons

- `Start camera`
- `Stop camera`
- `Retry camera`

Use `Retry camera` if the webcam permission or stream setup fails.

## 13. Squat Results Screen

For squat-profile exercises, the results screen summarizes:

- Posture score
- Movement score
- Fatigue trend
- Recommendation list

This screen currently belongs only to the squat-profile assessment flow.

## 14. Best Practices For Better Tracking

- Wear clothing that does not fully hide body joints
- Keep your body centered
- Avoid moving too close to the camera
- Use steady, controlled reps
- Avoid fast twisting movements when you need stable tracking
- Recalibrate if the squat baseline was captured in a poor posture

## 15. Troubleshooting

### Problem: Camera Does Not Start

Try:

- Allow camera access in the browser
- Close other apps already using the webcam
- Click `Retry camera`
- Refresh the page

### Problem: Person Is Not Detected

Try:

- Step backward
- Improve lighting
- Keep your full body visible
- Avoid standing too close to the frame edge

### Problem: Pose Overlay Feels Unstable

Try:

- Reduce fast movement
- Use a cleaner background
- Improve lighting
- Keep feet, knees, hips, and shoulders visible

### Problem: Squat Calibration Does Not Capture

Try:

- Stand still
- Face the camera at a clean side-ish angle
- Wait for stable visibility
- Make sure the person status is `detected`

### Problem: Warning Messages Keep Changing

This usually means:

- the pose model is losing joint confidence
- your body is partly out of frame
- the exercise is moving too fast for clean webcam tracking

## 16. Current Limitations

- Full scored rep assessment is currently available only for squat-profile
  exercises.
- Other exercise families currently use live coaching rather than scored final
  reports.
- There is no backend, login, or session history yet.
- Tracking quality depends on camera angle, visibility, lighting, and the
  suitability of the movement for 2D webcam pose tracking.

## 17. Recommended Demo Flow

If you are showing this project in a hackathon or live demo:

1. Start in `Studio` or `Night` mode depending on the screen.
2. Show workout selection first.
3. Demonstrate that the app supports multiple workout families.
4. Use a squat-profile workout for the full scoring demo.
5. Show one non-squat workout to demonstrate live coaching coverage.
6. Highlight the real-time status pills, overlay, and posture warnings.
7. End with the squat results screen.

## 18. Summary

Cult Copilot is currently strongest as:

- a multi-workout camera-based form tracking demo
- a fully functional squat assessment experience
- a polished premium frontend for live pose coaching

It is not yet a fully scored rep-by-rep assessment system for every supported
exercise, but it does provide profile-based live coaching beyond squats.
