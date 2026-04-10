# Worldmap Fixed Zoom PTD / TDD

## Status

- Status: Proposed for implementation
- Scope: `client/apps/game/src/three/scenes/worldmap.tsx` and the worldmap zoom helper seams
- Primary goal: replace continuous worldmap zoom with three fixed camera profiles that do not move the worldmap target

## Problem Statement

The current worldmap zoom path is more complex than the rest of the worldmap rendering model.

Today:

1. Wheel, minimap zoom, and keyboard shortcuts all feed a shared zoom coordinator.
2. The coordinator owns target distance and an anchor world point.
3. During zoom, the coordinator can move both `controls.object.position` and `controls.target`.
4. Worldmap chunk authority is resolved from the camera ground intersection, which collapses to `controls.target`.
5. Every controls change can schedule chunk refresh work once the refresh planner decides it is safe to do so.

This creates two classes of problems:

- UX instability
  - zoom can feel slippery because the focus point shifts during wheel gestures
  - minimap drag/tween movement and zoom can fight over camera ownership
  - the worldmap uses three semantic camera bands, but runtime zoom still passes through many intermediate distances
- worldmap safety risk
  - zoom can move `controls.target`, which means zoom can indirectly affect chunk authority
  - even when render bounds do not resize, a zoom gesture can still schedule same-chunk refresh or cross-area chunk work

The user-reported direction is to use three fixed zoom levels and cycle between them.

## Findings From The Trace

### Stable facts

1. Chunk geometry is fixed.
   - `stride = 24`
   - `renderSize = 48 x 48`
   - zoom does not change those values at runtime

2. The worldmap camera profiles are already discrete.
   - `Close = distance 10, angle 42`
   - `Medium = distance 20, angle 52`
   - `Far = distance 40, angle 58`

3. Initial worldmap entry applies the full profile.
   - both the distance and the tilt are applied on first alignment

4. Runtime zoom does not keep applying the full profile.
   - the current zoom path continuously changes distance
   - the scene mostly treats the camera profile as distance-only after initial setup

5. Chunk authority is target-driven.
   - worldmap chunk resolution is based on the camera ground intersection
   - on this scene, that ground intersection resolves to `controls.target`

### Most important implication

If worldmap zoom stops moving `controls.target`, zoom stops participating in chunk selection.

That does not remove all chunk work, but it removes the most direct path where zoom itself can cause chunk authority
churn.

## Goals

### User goals

- Wheel zoom should feel intentional instead of slippery.
- Minimap zoom should match keyboard zoom and use the same three levels.
- The worldmap should always settle on one of the three intended camera framings.
- Zoom should stop creating chunk-selection surprises during the gesture.

### Engineering goals

- Zoom must not move `controls.target`.
- Zoom entry points must all map to `Close`, `Medium`, or `Far`.
- The three camera profiles must apply both distance and angle.
- Existing refresh hardening should keep working while the interaction model becomes simpler.
- The code should read as fixed-profile camera orchestration, not as a partially continuous zoom system.

## Non-goals

- Rebuilding non-worldmap scenes.
- Redesigning worldmap chunk sizes or Torii fetch area sizes.
- Removing the existing refresh hardening in this pass.
- Reworking minimap drag behavior beyond making zoom consistent with the new model.

## Proposed Behavior

### Zoom model

Worldmap zoom becomes band-stepped:

- wheel up: step one band closer
- wheel down: step one band farther
- minimap zoom in/out: same one-band step
- keyboard `1/2/3`: snap directly to `Close`, `Medium`, `Far`

### Camera ownership

Zoom changes only the camera pose around the current target.

It does **not** move `controls.target`.

This means:

- panning and explicit camera movement still own `controls.target`
- zoom only changes camera height and depth from the target according to the selected profile

### Runtime state

The worldmap keeps its local zoom publication layer so listeners still observe:

- stable camera band
- transition status

But the actual movement comes from fixed-profile camera transitions rather than continuous dolly math.

## Architecture

## 1. Stepped worldmap wheel policy

Introduce a focused helper that converts normalized wheel input into band steps.

Responsibilities:

- accumulate trackpad deltas until they cross a threshold
- detect direction changes and reset accumulation cleanly
- step to adjacent bands only
- clamp at `Close` and `Far`

This keeps wheel handling deterministic while still supporting both mouse wheel and trackpad input.

## 2. Fixed-profile worldmap camera changes

Worldmap camera changes should use the existing camera profiles as the source of truth:

- `resolveWorldmapCameraViewProfile(CameraView.Close)`
- `resolveWorldmapCameraViewProfile(CameraView.Medium)`
- `resolveWorldmapCameraViewProfile(CameraView.Far)`

Every zoom transition must apply:

- profile distance
- profile angle

Every transition should animate the camera to:

- same `controls.target`
- new camera position computed from the selected profile

## 3. Coordinator becomes publication, not movement ownership

The existing `WorldmapZoomCoordinator` remains useful for:

- stable band publication
- transition status
- zoom snapshot reporting to the rest of the worldmap

But it should no longer be the system that physically moves the camera every frame.

Instead:

1. a fixed-profile transition starts
2. the coordinator is told which band is now targeted
3. the scene animation moves the camera around the existing target
4. the coordinator samples the live camera distance and resolves stable band / idle status

## 4. Refresh behavior

The refresh planner stays in place, but the new model changes what it sees:

- no arbitrary target drift from zoom
- only three intended target distances
- zoom work settles after one of three profile transitions instead of after continuous arbitrary distances

Expected result:

- fewer zoom-driven force refreshes
- fewer chances for zoom to coincide with chunk authority changes
- chunk refresh work becomes easier to reason about in tests

## Implementation Plan

### Step 1. Add the stepped zoom helper

Create a worldmap-local helper for wheel accumulation and band stepping.

### Step 2. Change worldmap wheel and minimap zoom entry points

Replace continuous zoom intents with band-step requests.

### Step 3. Make worldmap `changeCameraView()` use fixed profiles

Use the full profile through the existing scene camera transition path.

### Step 4. Stop worldmap per-frame zoom from mutating camera position

Keep only state publication and settle detection.

### Step 5. Tighten worldmap zoom bounds

The worldmap max zoom distance should match the far profile instead of extending beyond it.

### Step 6. Update UX changelog entry

Add a new entry to `latest-features.ts` describing the simplified fixed-profile zoom behavior.

## TDD Plan

## Red phase

Add failing tests for the intended behavior:

1. stepped wheel policy
   - one full wheel step from medium zooms to far
   - repeated same-direction input clamps at far
   - opposite direction resets accumulation and steps back toward medium / close
   - sub-threshold trackpad deltas do not change the band

2. worldmap wiring
   - worldmap wheel path steps between camera bands instead of applying continuous delta intents
   - minimap zoom uses the same directional step path
   - worldmap no longer resolves wheel cursor anchors for zoom
   - worldmap max zoom distance is the far profile distance, not a fourth implicit zoom level

3. coordinator publication behavior
   - `snap_to_band` still updates target distance and status
   - live distance sampling settles to the selected band without moving camera ownership itself

## Green phase

Implement only enough production code to satisfy those tests:

- stepped wheel helper
- worldmap zoom entrypoint rewrite
- fixed-profile `changeCameraView()` usage
- state-only worldmap zoom sampling

## Refactor phase

Once green:

- simplify now-unused anchor-specific wheel code
- remove dead scratch objects and helper methods
- rename helpers so the top-level worldmap flow reads like intent

## Test Matrix

### Unit tests

- stepped zoom helper tests
- worldmap zoom coordinator tests updated for publication-only behavior
- worldmap source wiring tests

### Focused integration tests

- worldmap refresh planner tests stay green
- worldmap chunk transition tests stay green

### Manual verification

1. Enter worldmap and confirm initial zoom is medium.
2. Mouse wheel cycles `Medium -> Far -> Medium -> Close`.
3. Minimap wheel does the same.
4. Keyboard `1/2/3` still maps to the same profiles.
5. Zooming does not move the viewed tile under the camera target.
6. Rapid zooming near chunk boundaries does not change authority unless the player pans.

## Risks

### Risk: trackpad feels too coarse

Mitigation:

- keep wheel accumulation so small deltas still coalesce into one intentional step
- tune threshold using the existing normalized wheel units

### Risk: existing tests assume continuous zoom ownership

Mitigation:

- update tests to assert the intended fixed-profile model explicitly

### Risk: refresh timing changes uncover old same-chunk bugs

Mitigation:

- keep latest-wins refresh hardening in place for this pass
- do not combine this change with chunk-policy rewrites

## Success Criteria

The implementation is complete when:

1. worldmap zoom always settles on `Close`, `Medium`, or `Far`
2. zoom no longer moves `controls.target`
3. wheel, minimap zoom, and keyboard shortcuts all use the same stepped model
4. the targeted tests pass
5. the repo-required checks pass
6. the final code reads like fixed-profile camera orchestration rather than anchor-driven continuous zoom
