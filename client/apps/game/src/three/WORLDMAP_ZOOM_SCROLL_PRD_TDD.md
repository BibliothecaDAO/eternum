# Worldmap Zoom Scroll Overhaul PRD + TDD

Status: Draft
Date: 2026-03-15
Scope: `client/apps/game/src/three`
Primary surfaces: world map wheel/trackpad zoom, close/medium/far camera transitions, chunk refresh scheduling, view-driven label/shadow behavior

## 1. Summary

The current world map zoom behavior is built around three semantic views:

- Close
- Medium
- Far

The product intent is sound, but the current interaction model feels glitchy and stuttery because:

- wheel input is artificially limited to one step per gesture
- camera transitions emit too many control-change events while animating
- downstream scene systems do expensive work during those in-between frames
- the optional smooth zoom path is not state-safe relative to the existing close/medium/far policies

This document defines the product requirements, technical design, rollout plan, and strict test-driven delivery plan for a zoom overhaul that preserves the three-view model while making scroll behavior feel smooth, predictable, and performant.

## 2. Problem Statement

### 2.1 User problem

When a player scrolls between close, medium, and far on the world map:

- the response feels sticky or bursty rather than fluid
- transitions can visually pop or stutter
- repeated scroll input can feel ignored mid-gesture
- camera movement can trigger more scene work than is necessary while the camera is still settling

### 2.2 Current implementation issues

The current implementation has five core issues:

1. The wheel handler only allows one discrete step per gesture window.
2. Programmatic camera transitions fire repeated `controls.change` cascades.
3. Those change cascades schedule chunk refresh work while the scripted zoom is still in flight.
4. The system mixes discrete camera-view semantics with an incomplete continuous zoom mode.
5. Fog and other distance-sensitive visuals are updated by more than one owner.

## 3. Goals

### 3.1 Product goals

- Preserve the close, medium, and far semantic views.
- Make scroll input feel responsive on both mouse wheel and trackpad.
- Eliminate perceived stutter during close/medium/far transitions.
- Prevent ignored scroll bursts during active zoom gestures.
- Keep labels, shadows, fog, and minimap behavior visually stable during zoom.
- Reduce unnecessary chunk-refresh churn during scripted zoom.

### 3.2 Technical goals

- Ensure only one authoritative zoom transition pipeline exists.
- Ensure camera movement notifies downstream systems at a controlled cadence.
- Ensure expensive worldmap refresh work happens only when the scene actually needs it.
- Keep view-driven systems synchronized with actual camera distance.
- Add instrumentation so regressions are measurable, not anecdotal.

## 4. Non-goals

- Replacing close/medium/far with unconstrained free zoom in the first rollout.
- Reworking pan traversal or chunk geometry policy beyond what zoom stability requires.
- Rewriting label rendering architecture in this project.
- Replacing `MapControls`.
- Retuning the entire renderer/post-processing stack outside zoom-adjacent issues.

## 5. Product Requirements

### 5.1 Interaction model

The user must be able to:

- scroll from close to medium to far without dropped or ignored intent
- reverse direction immediately without waiting for a gesture timeout to expire
- reach the next semantic view with a single deliberate wheel notch
- perform a faster multi-step transition with sustained wheel or trackpad input
- use keyboard shortcuts `1`, `2`, and `3` to jump directly to close, medium, and far

### 5.2 Behavior requirements

- Scroll input must accumulate intent rather than hard-stop after one step.
- The active semantic view must remain derivable from actual camera distance.
- Scroll during an in-flight scripted transition must either:
  - retarget the current transition cleanly, or
  - queue the next target view cleanly.
- The camera must never visibly overshoot and snap back.
- The scene must not dispatch redundant control-change notifications for the same frame.
- Chunk refresh work must not run repeatedly just because a scripted camera tween is still progressing.

### 5.3 Visual requirements

- Labels must update at the correct semantic band without flicker.
- Shadow mode changes must happen at stable band boundaries.
- Fog must not pop because multiple systems are fighting over near/far during zoom.
- Minimap camera indicators must remain in sync with the real camera target and distance.

### 5.4 Performance requirements

For a single close -> medium or medium -> far transition:

- control-change fanout should be bounded to one downstream notification per animation frame at most
- chunk refresh should execute at most once after settle unless a real chunk boundary or recovery condition is crossed
- there should be no repeated refresh loop caused solely by the scripted zoom

For a sustained scroll gesture:

- input processing must remain responsive while the camera is moving
- no frame should trigger duplicate label/refresh scheduling from both manual and control-native events

## 6. Success Metrics

### 6.1 Quantitative metrics

- `controls.change` events per close/medium/far transition reduced materially from current baseline
- `requestChunkRefresh()` invocations per settled transition reduced to the minimum necessary
- `updateVisibleChunks()` executions during a no-boundary view transition reduced to 0 or 1
- no repeated forced refreshes caused only by intermediate zoom distance drift

### 6.2 Qualitative metrics

- scroll feels immediate, not sticky
- repeated wheel input feels honored, not swallowed
- close/medium/far transitions feel intentional rather than glitchy
- no visible label or fog popping during the transition

## 7. Current-State Diagnosis

### 7.1 Input quantization

Today the worldmap wheel handler:

- normalizes the wheel delta
- allows only one `stepCameraView()` call per gesture window
- suppresses additional steps until the short timeout resets

This creates an interaction that is especially poor on trackpads, where one user gesture often emits multiple small wheel events.

### 7.2 Event fanout during camera tween

The base camera animation path currently:

- animates camera position and camera target separately
- attaches `onUpdate` to both animations
- calls a helper that triggers control updates and control-change notifications

This creates a high probability of duplicate downstream work during the same visual transition.

### 7.3 Expensive downstream work on every change

The current control-change path fans out into:

- label dirtying
- chunk refresh requests
- frustum invalidation
- centralized visibility invalidation
- minimap synchronization

That fanout is appropriate for organic pan movement, but it is too expensive for every in-between frame of a scripted close/medium/far camera tween.

### 7.4 Incomplete smooth zoom mode

The optional smooth zoom mode currently changes the camera distance continuously, but much of the renderer still keys behavior from discrete `currentCameraView` values. That means simply enabling continuous zoom by default would risk desynchronizing:

- labels
- shadow policy
- animation distance policy
- hover/readability behavior

### 7.5 Multiple owners for distance visuals

Distance-adjacent visuals are currently influenced by more than one system, especially fog. During zoom transitions this can produce visual instability even if raw frame time is acceptable.

## 8. Proposed Product Design

### 8.1 Design principles

- Keep the player-facing model simple: close, medium, far.
- Make the input model continuous enough to feel smooth.
- Make semantic band transitions explicit and stable.
- Separate cheap per-frame camera updates from expensive scene refresh work.
- Derive renderer policies from camera distance through one source of truth.

### 8.2 Zoom behavior model

The system will support two internal concepts:

- `targetDistance`: the continuously updated zoom intent
- `resolvedView`: the semantic band derived from distance using hysteresis

The user still perceives close/medium/far, but input no longer depends on a one-step gesture lock.

### 8.3 Proposed semantic distance bands

Initial rollout should preserve the current target distances:

- Close: `10`
- Medium: `20`
- Far: `40`

But the system should also define hysteresis thresholds around them so the active view does not flap when distance is near a boundary.

Example initial thresholds:

- Close <-> Medium boundary centered near `15`
- Medium <-> Far boundary centered near `30`
- hysteresis width of `2` to `4` distance units per boundary

Exact values must be tuned under telemetry.

### 8.4 Proposed interaction rules

- Wheel or trackpad input updates zoom intent immediately.
- If the user is in discrete-snap mode, intent resolves to the nearest semantic target view.
- If the user keeps scrolling during a transition, the transition retargets instead of waiting for a timeout reset.
- Keyboard shortcuts set the resolved target view directly.
- Minimap zoom buttons use the same underlying controller, not a parallel zoom path.

## 9. Technical Design

### 9.1 New zoom controller seam

Introduce a dedicated policy/controller module in `scenes/`, for example:

- `worldmap-zoom-controller.ts`

Responsibilities:

- normalize wheel intent
- convert intent into target distance or target view
- apply hysteresis when deriving `resolvedView`
- decide whether input retargets the current transition or starts a new one
- expose stable hooks for:
  - `nextTargetDistance`
  - `nextResolvedView`
  - `shouldRequestExpensiveRefresh`
  - `shouldCommitViewChange`

This module should be pure and heavily unit tested.

### 9.2 Camera transition ownership

The scripted camera transition path in `HexagonScene` must become single-owner:

- one tween/timeline controls both camera position and target
- one `onUpdate` path publishes camera movement
- one downstream notification is emitted per frame at most

No code path should manually dispatch a second control-change event if `MapControls.update()` already emits one for the same movement.

### 9.3 Transition lifecycle

Add a notion of scripted zoom transition state:

- `idle`
- `transitioning`
- `settling`

While `transitioning`:

- frustum and visibility may be marked dirty cheaply
- chunk refresh requests should be suppressed, coalesced, or deferred unless a hard boundary is crossed
- label dirtying should happen once per frame maximum

At `settling` or transition completion:

- commit any deferred chunk refresh
- commit any semantic view change side effects
- flush telemetry

### 9.4 View resolution model

`currentCameraView` should no longer be treated as independent state that can drift away from camera distance.

Instead:

- actual camera distance is the physical source of truth
- `resolvedView` is derived from distance using hysteresis
- side effects that depend on semantic bands subscribe to `resolvedView` changes

That keeps:

- labels
- shadows
- animation visibility thresholds
- hover presentation

consistent with the real camera position.

### 9.5 Refresh scheduling policy

Separate refresh work into two buckets:

#### Cheap per-frame work

- frustum dirty
- visibility dirty
- minimap target update

#### Expensive settled work

- `requestChunkRefresh()`
- `updateVisibleChunks()`
- heavy label/manager work driven by chunk or band changes

The default policy for scripted close/medium/far transitions should be:

- allow cheap per-frame work
- defer expensive work until settle
- escalate immediately only if:
  - the active chunk boundary changes
  - a hard recovery condition is detected
  - a view-band side effect requires immediate commit

### 9.6 Visual ownership cleanup

Distance-sensitive visuals need one owner per concern:

- camera clip planes: camera-distance system
- fog near/far: camera-distance system
- fog color and lighting tint: day/night system
- shadow enable/disable: semantic view policy

This prevents the current "fight" between day/night updates and zoom-distance updates.

### 9.7 Minimap and alternate zoom sources

The minimap zoom bridge and any future zoom controls must route through the same controller logic as mouse/trackpad scroll. No alternative path should mutate camera distance directly without updating:

- target distance
- resolved view
- deferred refresh state

## 10. Delivery Plan

Implementation tracking:

- [x] Phase 0: Instrumentation and baselines
- [x] Phase 1: Camera transition cleanup
- [x] Phase 2: Input model overhaul
- [x] Phase 3: Refresh scheduling and state unification
- [ ] Phase 4: Visual cleanup

### Phase 0: Instrumentation and baselines

Deliverables:

- counters for:
  - `controls.change`
  - `requestChunkRefresh()`
  - `updateVisibleChunks()`
  - view transitions started/completed/cancelled
- telemetry summary for a close -> medium -> far interaction sequence

Purpose:

- establish baseline event and refresh volume before behavior changes

### Phase 1: Camera transition cleanup

Deliverables:

- single-owner scripted camera tween path
- duplicate control-change dispatch removed
- transition lifecycle state added

Purpose:

- eliminate redundant event storms before changing the input model

### Phase 2: Input model overhaul

Deliverables:

- wheel intent accumulation
- removal of one-step-per-gesture lock
- retargetable transitions
- band hysteresis

Purpose:

- make scroll feel responsive and predictable

### Phase 3: Refresh scheduling and state unification

Deliverables:

- deferred expensive refresh policy during scripted zoom
- `resolvedView` derived from actual distance
- minimap and keyboard paths routed through same controller

Purpose:

- reduce stutter caused by scene work during transition

### Phase 4: Visual cleanup

Deliverables:

- fog ownership cleanup
- view-band visual transitions stabilized

Purpose:

- remove visual popping that can still read as "glitch"

## 11. TDD Strategy

This project must follow a strict test-first rollout:

- no production behavior change before a failing test exists
- tests must fail for the intended reason
- implementation must be the minimum code to make that test pass
- each phase ships only after targeted tests and relevant surrounding tests pass

## 12. Proposed Test Suites

### 12.1 New pure-policy test suite

Add:

- `client/apps/game/src/three/scenes/worldmap-zoom-controller.test.ts`

Covers:

- wheel delta accumulation
- step resolution for mouse wheel
- sustained scroll retargeting
- reverse-direction retargeting
- distance-to-view hysteresis
- settle/defer refresh decisions

### 12.2 Hexagon scene animation tests

Add:

- `client/apps/game/src/three/scenes/hexagon-scene.camera-transition.test.ts`

Covers:

- camera position and target update through one transition owner
- only one downstream movement notification per frame
- transition retargeting cancels or supersedes the previous scripted zoom cleanly

### 12.3 Worldmap scheduler and wiring tests

Extend:

- `client/apps/game/src/three/scenes/worldmap-refresh-scheduler.wiring.test.ts`
- `client/apps/game/src/three/scenes/worldmap-chunk-transition.test.ts`
- `client/apps/game/src/three/scenes/worldmap-zoom-hardening.test.ts`

Covers:

- scripted zoom does not spam expensive refresh
- refresh is deferred until settle when no chunk boundary changes
- forced refresh still occurs when hard thresholds require it
- telemetry counters reset and record correctly

### 12.4 Worldmap runtime behavior tests

Add or extend:

- `client/apps/game/src/three/scenes/worldmap-test-harness.ts`
- `client/apps/game/src/three/scenes/worldmap-test-harness.test.ts`

Covers:

- close -> medium -> far interaction path
- scroll during in-flight transition retargets correctly
- keyboard `1/2/3` remains deterministic
- minimap zoom uses the same controller semantics

### 12.5 Visual policy tests

Add:

- `client/apps/game/src/three/scenes/worldmap-view-resolution-policy.test.ts`

Covers:

- band transitions fire exactly once when crossing a hysteresis boundary
- labels and shadows receive stable semantic view updates
- fog policy ownership decisions are deterministic

## 13. Red-Green Sequence

### Step A: Input policy

Write failing tests for:

- "allows sustained wheel intent to advance more than one view without waiting for gesture reset"
- "retargets scripted zoom when wheel direction reverses mid-transition"
- "does not flap resolved view near band boundaries"

Then implement the pure zoom controller.

### Step B: Transition dispatch

Write failing tests for:

- "emits one camera-movement notification per animation frame"
- "does not manually duplicate control-change dispatch when controls already emit change"

Then refactor the camera tween path.

### Step C: Refresh deferral

Write failing tests for:

- "defers expensive chunk refresh during scripted zoom when chunk does not change"
- "executes one refresh on settle"
- "still forces refresh when hard zoom threshold or boundary crossing requires it"

Then implement deferred scheduling.

### Step D: View resolution

Write failing tests for:

- "derives close/medium/far from distance with hysteresis"
- "updates dependent systems only when resolved view changes"

Then unify state.

### Step E: Visual ownership

Write failing tests for:

- "camera-distance fog near/far is not overwritten by day/night update during zoom"
- "day/night still controls fog color while camera-distance controls range"

Then split ownership cleanly.

## 14. Acceptance Criteria

The overhaul is complete when all of the following are true:

- scrolling between close, medium, and far feels responsive on wheel and trackpad
- repeated scroll input during an active transition is honored cleanly
- no duplicate control-change storm occurs during scripted zoom
- chunk refresh is deferred/coalesced for scripted zoom unless a real boundary or recovery condition demands otherwise
- labels, shadows, and minimap stay in sync with semantic view changes
- fog does not visibly pop because of conflicting updates
- all new and modified tests pass
- baseline telemetry shows materially lower change/refresh churn per transition

## 15. Manual QA Matrix

Required manual checks after automated green:

1. Mouse wheel:
   - close -> medium
   - medium -> far
   - far -> medium
   - rapid repeated wheel notches
2. Trackpad:
   - slow two-finger scroll
   - sustained scroll burst
   - reverse direction mid-transition
3. Keyboard:
   - `1`, `2`, `3` direct jumps
   - jump while another transition is in flight
4. Minimap:
   - zoom buttons or wheel bridge preserve same semantics
5. Visual:
   - labels
   - shadows
   - fog
   - minimap camera ring
6. Performance:
   - monitor telemetry counters and frame stability during repeated zoom changes

## 16. Rollout and Guardrails

- Ship behind the existing zoom hardening scaffolding or a dedicated worldmap zoom flag first.
- Capture before/after telemetry in development.
- Roll out in phases rather than combining input, scheduler, and visual ownership changes in one PR.
- Do not enable unrestricted continuous zoom in production until semantic view derivation is unified.

## 17. Risks

- If view derivation is not unified, labels and shadows can drift out of sync with actual distance.
- If refresh deferral is too aggressive, chunk updates can appear late after zoom settle.
- If hysteresis is too wide, the system can feel sluggish crossing band boundaries.
- If hysteresis is too narrow, view-dependent systems can flap.
- If fog ownership is split incorrectly, either distance depth cues or day/night visuals will regress.

## 18. Open Questions

- Should the first rollout keep hard snap-to-band behavior, or allow a visibly continuous interpolation while still snapping semantics underneath?
- Should wheel and trackpad use the same threshold policy, or should they be classified separately?
- Should the first rollout defer all expensive refresh until settle, or allow one mid-transition refresh when the target band changes by two levels?
- Do we want direct user-facing settings for "smooth zoom" after the view-state model is fixed, or should one model replace the toggle entirely?

## 19. Recommended First PR Slice

The first implementation PR should be intentionally narrow:

- add telemetry baselines
- refactor scripted camera transition to a single update owner
- remove duplicate control-change dispatch
- add failing tests first for duplicate notification and transition retargeting behavior

This slice should deliver immediate smoothness gains without yet changing the public close/medium/far product model.
