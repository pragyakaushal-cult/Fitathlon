# Cult Copilot

Browser-based squat form check MVP for the web.

## Stack

- React for UI composition
- TypeScript for safer browser, geometry, and vision code
- Vite for a fast local dev loop
- MediaPipe Pose Landmarker Tasks API for pose inference in the browser
- Canvas overlay for skeleton rendering

## Quick Start

```bash
npm install
npm run dev
```

For mobile testing on the same network:

```bash
npm run dev:host
```

## Scripts

- `npm run dev` starts the Vite dev server
- `npm run dev:host` exposes the dev server on your local network
- `npm run build` runs TypeScript build checks and creates a production bundle
- `npm run typecheck` runs the TypeScript project build without bundling
- `npm run lint` runs ESLint
- `npm run preview` previews the production build locally

## Recommended Architecture

```text
src/
  app/                  # top-level app shell and route-free page composition
  components/           # reusable UI and camera / overlay primitives
  features/             # guided flow and results experience
  hooks/                # React hooks for camera, pose loop, sizing, debug state
  lib/
    geometry/           # framework-agnostic math utilities
    mediapipe/          # pose landmarker setup and inference helpers
  styles/               # global styles only
  types/                # shared TypeScript domain types
```

## Current Phase

Phase 1 sets up the project shell only. Camera access, pose inference, squat logic, and results scoring will be added in later phases.
