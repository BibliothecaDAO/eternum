# Worldmap Zoom Scroll Rebuild PRD / TDD

## Status

- Status: Proposed
- Scope: `client/apps/game/src/three/scenes/worldmap.tsx` and shared worldmap zoom seams
- Primary goal: rebuild worldmap zoom as a single, predictable system instead of a stack of partially overlapping
  handlers

## Why This Exists

The current zoom stack is glitchy because it has multiple competing owners:

1. `MapControls` changes camera distance directly.
2. Worldmap wheel intent can also request semantic view changes.
3. `HexagonScene` derives `currentCameraView` from live distance while also storing `targetCameraView`.
4. `GameRenderer` requests chunk refreshes on control changes.
5. `WorldmapScene` has a second zoom-refresh policy plus hardening/self-heal behavior.

This creates visible instability:

- camera movement and semantic view changes are not governed by one state machine
- expensive refresh work can trigger during transition frames
- labels, highlights, shadows, contact shadows, and fog can flip mid-zoom
- minimap scale reacts to the same distance jitter the user sees in the world
- hardening exists partly to recover from zoom/refresh instability rather than rare faults

This document defines the optimal rebuild from first principles.

## First Principles

1. Zoom must have one owner.
2. Camera distance is the source of truth.
3. Semantic views are derived presentation bands, not primary state.
4. Every zoom entry point must go through the same pipeline.
5. Expensive scene refresh must be owned by Worldmap, not split across renderer and scene layers.
6. Continuous visual effects should scale continuously with zoom.
7. Discrete presentation changes should happen only when stable, not on every transient threshold crossing.
8. Hardening should detect real faults, not mask normal zoom behavior.

## Product Goals

### User goals

- Zoom feels smooth on mouse wheel, trackpad, minimap wheel, and keyboard shortcuts.
- The zoom focus point stays stable instead of appearing to slide.
- Labels, hover visuals, and shadows do not pop or flap while zooming.
- Zooming does not trigger terrain flicker, delayed chunk swaps, or self-heal refresh loops.
- Minimap scale and camera marker feel stable and coherent with the main camera.

### Engineering goals

- One worldmap zoom pipeline with explicit ownership.
- One refresh planner for pan/zoom driven chunk work.
- Deterministic tests around distance, presentation bands, and refresh timing.
- Reduced need for force-refresh and terrain recovery during normal use.

## Non-goals

- Rebuilding `HexceptionScene` zoom in the first pass.
- Reworking unrelated worldmap chunking policy.
- Large visual redesign of labels or shadows beyond what is required for zoom stability.
- Removing all hardening code immediately. Some stays until rollout proves it is no longer needed.

## Current-State Diagnosis

### Input layer

- Canvas wheel has two modes: smooth `MapControls` zoom and stepped semantic view changes.
- Minimap wheel bypasses the stepped pipeline when smooth zoom is enabled and directly mutates camera distance.
- Keyboard `1/2/3` and GUI controls call `changeCameraView()` directly.

### Camera layer

- `targetCameraView` is imperative state.
- `currentCameraView` is derived from actual distance with hysteresis.
- Smooth zoom can move distance without updating target view state.
- Scripted zoom emits control changes during transition frames.

### Side-effect layer

Distance or resolved view currently affects:

- clip planes
- fog on/off and fog range
- outline opacity
- directional shadow enablement
- contact shadow fallbacks for armies, structures, and chests
- hover/highlight tuning
- label transition states
- animation visibility distance
- UI store `cameraDistance`
- minimap scale
- chunk refresh and forced refresh planning
- visibility manager dirtiness

### Chunking layer

- `GameRenderer` requests a worldmap chunk refresh on every controls change.
- `WorldmapScene` also computes its own zoom-refresh plan.
- Zoom hardening adds latest-wins refresh execution and self-heal recovery because normal zoom/refresh sequencing is not
  trusted.

## Product Requirements

### Functional requirements

1. Worldmap zoom must be continuous by default.
2. All zoom inputs must route through one `WorldmapZoomCoordinator`.
3. The coordinator must own target distance and transition status for worldmap.
4. The camera must zoom around an explicit anchor:
   - cursor ground intersection for canvas wheel
   - world center of minimap interaction for minimap zoom
   - current screen center ground intersection for keyboard shortcuts
5. Worldmap semantic bands (`Close`, `Medium`, `Far`) must be derived from actual distance and exposed as presentation
   state only.
6. Expensive chunk refresh must not be triggered directly by `GameRenderer` for worldmap camera changes.
7. Chunk refresh must be scheduled by a worldmap-local planner that can distinguish:
   - cheap visual camera motion
   - zoom that changes render relevance
   - zoom settle
   - chunk switch
8. Discrete presentation listeners must observe stable band changes, not every transient distance fluctuation.
9. Minimap and UI camera state must update from the same stable camera snapshot pipeline.
10. Zoom must be cancellable and latest-wins when new input arrives mid-transition.

### UX requirements

1. Zoom-in and zoom-out feel symmetric.
2. Trackpad scroll does not overshoot or stall because of wheel delta variance.
3. Mouse wheel and minimap wheel produce the same distance response curve.
4. Keyboard shortcuts still support quick jumps to coarse zoom bands.
5. Band changes feel intentional:
   - no label pop-flapping around thresholds
   - no repeated shadow/contact-shadow toggling during one gesture

### Performance requirements

1. Normal zoom gestures should not trigger more than one expensive refresh on settle unless chunk boundaries or forced
   thresholds require it.
2. No terrain self-heal refresh should occur during a 5 minute zoom stress pass.
3. Zoom should not cause repeated chunk switch thrash near band thresholds.

## Target Experience

### Core behavior

- Wheel input changes target distance continuously.
- The camera eases toward target distance with a stable anchor.
- Continuous policies update every frame from live distance.
- Discrete band policies update only when band resolution is stable.
- Chunk refresh happens through one planner that batches camera motion into one refresh decision.

### Interaction model

- Mouse wheel / trackpad pinch: continuous zoom
- Minimap wheel: continuous zoom using same distance curve
- Keyboard `1/2/3`: snap target distance to preset band distances through the same coordinator
- Future UI zoom buttons: same coordinator

## Proposed Architecture

## Zoom ownership

Create a worldmap-owned zoom subsystem. `MapControls` keeps pan and damping, but worldmap zoom ownership moves out of
native `MapControls` zoom.

### Rule

- Worldmap: `controls.enableZoom = false`
- Worldmap zoom: owned by `WorldmapZoomCoordinator`
- Other scenes: unchanged for now

This removes hidden dolly behavior and makes every zoom entry point use the same solver.

## New state model

```ts
type WorldmapZoomBand = CameraView.Close | CameraView.Medium | CameraView.Far;

interface WorldmapZoomState {
  actualDistance: number;
  targetDistance: number;
  minDistance: number;
  maxDistance: number;
  status: "idle" | "zooming";
  activeGestureId: number | null;
  anchorMode: "cursor" | "screen_center" | "world_point";
  anchorWorldPoint: Vector3 | null;
  resolvedBand: WorldmapZoomBand;
  stableBand: WorldmapZoomBand;
}
```

### Definitions

- `actualDistance`: measured camera-to-target distance this frame
- `targetDistance`: desired distance after current input
- `resolvedBand`: band from live distance with hysteresis
- `stableBand`: band used for discrete presentation listeners after settle confirmation

`stableBand` is the key separation. It prevents label/shadow policy churn while zoom is still moving.

## Proposed modules

Create a new folder:

`client/apps/game/src/three/scenes/worldmap-zoom/`

Suggested files:

- `worldmap-zoom-coordinator.ts`
- `worldmap-zoom-input-normalizer.ts`
- `worldmap-zoom-anchor-solver.ts`
- `worldmap-zoom-band-policy.ts`
- `worldmap-zoom-refresh-planner.ts`
- `worldmap-zoom-telemetry.ts`
- `worldmap-zoom-types.ts`

### Responsibilities

#### `worldmap-zoom-coordinator.ts`

- own zoom state
- accept intents from wheel/minimap/keyboard
- clamp and ease target distance
- solve anchored camera/target updates
- emit stable snapshots to worldmap

#### `worldmap-zoom-input-normalizer.ts`

- normalize wheel deltas across mouse/trackpad modes
- classify gesture direction and magnitude
- provide consistent zoom velocity curve

#### `worldmap-zoom-anchor-solver.ts`

- resolve ground intersection anchor
- preserve anchor under zoom
- compute next camera position and target
- clamp to navigation bounds if needed

#### `worldmap-zoom-band-policy.ts`

- derive `resolvedBand`
- derive `stableBand`
- enforce hysteresis and settle windows

#### `worldmap-zoom-refresh-planner.ts`

- decide whether camera changes require:
  - no refresh
  - debounced refresh
  - forced refresh
  - chunk switch
- consolidate what is currently split across renderer and worldmap zoom refresh logic

#### `worldmap-zoom-telemetry.ts`

- count zoom gestures, retargets, settles, refreshes, forced refreshes, anchor failures, band flips, and self-heal
  events

## Input Pipeline

### 1. Zoom intent normalization

All entry points become intents:

```ts
type ZoomIntent =
  | { type: "continuous_delta"; delta: number; anchor: ZoomAnchorInput }
  | { type: "snap_to_distance"; distance: number; anchor: ZoomAnchorInput }
  | { type: "snap_to_band"; band: CameraView; anchor: ZoomAnchorInput };
```

### 2. Target distance resolution

- Apply normalized zoom delta to `targetDistance`
- Clamp to min/max
- Preserve latest-wins semantics

### 3. Camera solve

- Find anchor point on ground
- Move camera along zoom ray
- Adjust controls target to keep anchor stable
- Mark zoom status as `zooming`

### 4. Stable snapshot publish

Worldmap receives a single camera snapshot per frame:

```ts
interface WorldmapCameraSnapshot {
  actualDistance: number;
  targetDistance: number;
  resolvedBand: CameraView;
  stableBand: CameraView;
  status: "idle" | "zooming";
  targetHex: { col: number; row: number };
}
```

## Presentation Policy

## Continuous policies

These should update every frame from `actualDistance`:

- clip planes
- fog range
- outline opacity
- minimap scale
- UI camera distance

These are naturally continuous and should not rely on semantic view changes.

## Stable-band policies

These should update from `stableBand`, not live distance:

- label transition presets
- hover/highlight tuning
- directional shadow enablement
- contact shadow fallback toggles
- army/structure/chest presentation band listeners

### Stable-band rule

A band becomes stable only when one of these is true:

1. camera distance settles within epsilon of target distance for N frames
2. a snap-to-band action completes
3. continuous zoom pauses for a short settle timeout

This removes mid-gesture flapping.

## Refresh Ownership

## Required rebuild

`GameRenderer` must stop calling `worldmapScene.requestChunkRefresh()` directly on worldmap controls changes.

Instead:

- `GameRenderer` notifies the active scene that controls changed
- `WorldmapScene` forwards the camera snapshot into `WorldmapZoomRefreshPlanner`
- planner decides whether to schedule refresh work

### Refresh planner rules

1. Panning still schedules normal debounced refresh.
2. Continuous zoom does not trigger repeated heavy refresh during every frame.
3. If zoom changes render relevance materially, record one pending refresh.
4. When zoom settles, flush exactly one refresh with the strongest required force.
5. Chunk switching remains authoritative when the ground focus point crosses chunk boundaries.

### Refresh levels

```ts
type ZoomRefreshLevel = "none" | "debounced" | "forced";
```

The planner must aggregate multiple zoom frames into one pending refresh outcome.

## Camera Bands

Retain coarse band semantics for gameplay readability, but treat them as presentation presets:

- `Close`: target distance `10`
- `Medium`: target distance `20`
- `Far`: target distance `40`

These remain useful for shortcuts and tuning, but they are no longer the core state machine.

## Rollout Plan

## Phase 0: Instrument current behavior

Add telemetry before behavior changes:

- refreshes per zoom gesture
- forced refreshes per zoom gesture
- self-heal count
- band transitions per gesture
- label transition count per gesture
- shadow mode toggles per gesture

Exit criteria:

- baseline captured from manual zoom stress passes

## Phase 1: Extract zoom math and state

- add new zoom module folder
- implement distance normalization, band policy, and anchor solver as pure functions
- keep old runtime wiring temporarily

Exit criteria:

- pure unit tests pass
- existing behavior reproduced in harness-level tests

## Phase 2: Move worldmap zoom ownership to coordinator

- disable `MapControls` zoom for worldmap
- route canvas wheel, minimap wheel, and shortcuts into coordinator
- keep pan ownership in `MapControls`

Exit criteria:

- all worldmap zoom entry points use the same coordinator
- no direct camera distance mutations remain outside the coordinator

## Phase 3: Separate continuous and stable-band policies

- move fog/clip/outline/minimap scale to continuous distance snapshots
- move label/shadow/highlight/contact-shadow listeners to `stableBand`

Exit criteria:

- no listener depends on transient band changes during one gesture

## Phase 4: Consolidate refresh ownership

- remove direct worldmap refresh requests from `GameRenderer`
- replace current deferred zoom refresh logic with the new planner
- keep hardening but measure reduced activation

Exit criteria:

- one refresh planner governs zoom-driven refresh work
- refreshes per gesture drop to target range

## Phase 5: Retire compensating complexity

- simplify old wheel gesture state
- remove obsolete stepped zoom machinery if redundant
- evaluate whether self-heal thresholds can be relaxed

Exit criteria:

- no stale redundant zoom state remains
- hardening triggers only in fault scenarios

## Detailed TDD Plan

## Unit tests

### `worldmap-zoom-input-normalizer.test.ts`

- normalizes line/page/pixel wheel deltas consistently
- distinguishes trackpad micro-scroll from large wheel steps
- preserves direction correctly
- clamps pathological deltas

### `worldmap-zoom-band-policy.test.ts`

- resolves bands from distance with hysteresis
- does not flap around thresholds
- promotes `resolvedBand` to `stableBand` only after settle
- preserves `stableBand` while active zoom crosses and recrosses thresholds

### `worldmap-zoom-anchor-solver.test.ts`

- zoom in preserves cursor anchor within tolerance
- zoom out preserves cursor anchor within tolerance
- falls back to screen-center anchor when cursor ray fails
- clamps within navigation bounds

### `worldmap-zoom-refresh-planner.test.ts`

- pan-only motion requests debounced refresh
- continuous zoom within same render relevance defers heavy refresh
- large zoom delta schedules one pending forced refresh
- multiple frames collapse into one final refresh decision
- chunk switch beats generic zoom refresh

### `worldmap-zoom-coordinator.test.ts`

- latest intent wins during active zoom
- snap-to-band uses same target distance pipeline
- zoom settles to expected target distance
- emits stable snapshots in the expected order

## Integration tests

### `worldmap-zoom-wiring.test.ts`

- wheel, minimap, and keyboard all call the coordinator
- no worldmap zoom path mutates camera distance directly outside coordinator
- no worldmap zoom path routes through `MapControls` dolly logic

### `worldmap-presentation-band-wiring.test.ts`

- hover/highlight managers subscribe to `stableBand`
- fog/minimap scale subscribe to continuous distance snapshot
- army/structure/chest shadow toggles change only on stable-band updates

### `worldmap-refresh-ownership.test.ts`

- `GameRenderer` does not directly request worldmap chunk refresh on controls change
- worldmap refresh goes through planner
- only one refresh is flushed on zoom settle

### `worldmap-zoom-self-heal-regression.test.ts`

- repeated zoom stress does not trigger terrain self-heal or offscreen recovery in nominal conditions

## Runtime / harness tests

### Camera stability harness

- repeated zoom-in/out cycles preserve anchor within configured tolerance
- no oscillation around settled target distance
- no extra band flips after settle

### Chunk stability harness

- rapid zoom in/out within same chunk does not produce repeated forced refresh loops
- chunk switch during zoom converges once and stays stable

## Browser validation

Manual acceptance pass:

1. Mouse wheel zoom over terrain center
2. Mouse wheel zoom over terrain edge
3. Trackpad pinch / high-frequency wheel
4. Minimap wheel zoom
5. Keyboard `1/2/3`
6. Zoom while panning
7. Zoom near chunk boundary
8. Zoom with labels visible
9. Zoom during storm/night lighting

## Acceptance Criteria

### UX acceptance

- No visible label pop-flapping during a single zoom gesture
- No repeated shadow/contact-shadow toggles during one continuous gesture
- Minimap scale tracks smoothly without noticeable jitter
- Keyboard band snaps feel consistent with wheel zoom end states

### Engine acceptance

- Exactly one owner of worldmap zoom distance
- Exactly one owner of zoom-driven refresh planning
- No direct worldmap camera distance writes outside the coordinator
- No direct worldmap refresh request from `GameRenderer` on controls change

### Stability acceptance

- `terrain_self_heal` and `offscreen_chunk` recoveries do not trigger in nominal zoom stress runs
- refresh count per zoom gesture is materially lower than baseline
- stable-band transitions per gesture are bounded and intentional

## File-Level Implementation Plan

### Modify

- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/hexagon-scene.ts`

### Add

- `client/apps/game/src/three/scenes/worldmap-zoom/worldmap-zoom-types.ts`
- `client/apps/game/src/three/scenes/worldmap-zoom/worldmap-zoom-input-normalizer.ts`
- `client/apps/game/src/three/scenes/worldmap-zoom/worldmap-zoom-anchor-solver.ts`
- `client/apps/game/src/three/scenes/worldmap-zoom/worldmap-zoom-band-policy.ts`
- `client/apps/game/src/three/scenes/worldmap-zoom/worldmap-zoom-refresh-planner.ts`
- `client/apps/game/src/three/scenes/worldmap-zoom/worldmap-zoom-coordinator.ts`
- focused tests for each new module

### Likely delete or retire later

- redundant stepped-wheel gesture state in current worldmap zoom handling
- duplicate refresh/deferred refresh logic once planner fully replaces it

## Risks

1. Turning off `MapControls` zoom for worldmap changes trackpad feel if input normalization is poor.
2. Anchor preservation can feel worse than current center-zoom if edge cases are not clamped correctly.
3. Moving listeners from live band to stable band can expose assumptions in label/shadow managers.
4. Refresh planner changes can interact with shortcut navigation and chunk hysteresis.

## Risk Mitigations

- keep a temporary feature flag during rollout
- ship telemetry first
- land the rebuild in phases with test coverage before behavior switches
- preserve current band distances until the new system is stable

## Open Questions

1. Should keyboard `1/2/3` snap instantly or ease using the same coordinator timing curve?
   - Recommendation: ease using the same coordinator so all side effects stay unified.
2. Should stable-band commit require a time threshold, frame threshold, or both?
   - Recommendation: both. Use an epsilon distance check plus a short settle timeout.
3. Should minimap wheel zoom anchor to minimap center or underlying hovered hex?
   - Recommendation: anchor to minimap center for deterministic behavior.

## Recommended Final Shape

The optimal end state is:

- one worldmap zoom coordinator
- one camera snapshot pipeline
- continuous zoom distance as the only authority
- stable-band listeners for discrete presentation
- one worldmap refresh planner
- hardening retained only as a fault detector, not as normal control flow

If we implement to this shape, zoom becomes testable, understandable, and materially less glitch-prone under real player
input.
