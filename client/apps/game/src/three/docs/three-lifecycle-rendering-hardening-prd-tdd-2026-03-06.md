# PRD + TDD: Three Lifecycle and Rendering Hardening

## Overview

- Feature: Hardening pass for scene transitions, renderer teardown safety, worldmap timeout cleanup, and rendering
  consistency in `client/apps/game/src/three`.
- Status: Draft v0.1
- Owner: Three / Client Runtime Team
- Created: 2026-03-06
- Last Updated: 2026-03-06

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                          |
| ------ | ---------------- | ------ | --------------------------------------------------------------------------------------------------------------- |
| U1     | 2026-03-06 00:00 | Codex  | Initial PRD+TDD created from deep code review of `src/three`, focused on runtime lifecycle and render pipeline. |

## Executive Summary

The `src/three` module has good policy coverage in parts of worldmap chunking, but several high-leverage runtime paths
still assume the happy path:

1. Scene transitions assume `setup()` succeeds and do not recover cleanly when it fails.
2. Renderer startup launches async environment work that can complete after teardown.
3. Worldmap leaves a UI-affecting follow-camera timeout alive across scene switch/destroy.
4. The renderer and post stack both perform tone mapping, producing inconsistent image output.

These issues are not isolated. They are all manifestations of the same larger gap: **lifecycle ownership is not
consistently enforced across async work, teardown, and post-processing policy**.

This PRD defines a test-first hardening iteration that fixes those paths without broad architecture churn.

## Problem Statement

The Three.js runtime currently exposes correctness and stability risk in four places:

1. A scene transition failure can leave the previous scene torn down and the next scene only partially initialized.
2. Startup-time async environment loading can outlive the renderer and mutate disposed scene state.
3. A worldmap-originated delayed callback can mutate shared UI state after the scene is inactive.
4. Tone mapping is applied twice on MID/HIGH, making the visual pipeline harder to reason about and tune.

The impact is user-visible instability first, maintainability risk second:

1. Blank or partially broken scenes after rare setup failures.
2. Late writes into destroyed renderer/scenes during fast navigation.
3. Incorrect HUD/UI follow-state after scene changes.
4. Washed contrast, unpredictable bloom response, and inconsistent color tuning.

## Current Findings

### F1: Scene setup failure leaves scene ownership in an invalid state

Evidence:

1. `SceneManager.startPendingTransition()` switches off the previous scene before the next scene is ready:
   `client/apps/game/src/three/scene-manager.ts:68`.
2. `SceneManager.completeTransition()` sets `currentScene` before awaiting `scene.setup()`:
   `client/apps/game/src/three/scene-manager.ts:88`.
3. `moveCameraForScene()` and `fadeIn()` still run in `finally`, even if setup throws:
   `client/apps/game/src/three/scene-manager.ts:95`.

Risk:

1. A transient exception in scene setup can leave the app faded into a half-initialized scene with no valid fallback.
2. Recovery becomes manual because the old scene was already switched off.

Root cause: scene ownership is committed before setup success is known.

### F2: Async environment loading is not teardown-safe

Evidence:

1. `GameRenderer.applyEnvironment()` starts async HDR loading and unconditionally applies the result in `.then(...)`:
   `client/apps/game/src/three/game-renderer.ts:983`.
2. `setEnvironmentFromTarget()` writes directly into both scenes and swaps renderer-owned targets:
   `client/apps/game/src/three/game-renderer.ts:995`.
3. `destroy()` disposes renderer, scenes, and environment target, but does not cancel or guard the in-flight async path:
   `client/apps/game/src/three/game-renderer.ts:1324`.

Risk:

1. Fast route changes or renderer recreation can trigger late writes into disposed scene objects.
2. GPU resources can be revived or re-retained after teardown.

Root cause: startup async work has no lifecycle authority or cancellation.

### F3: Worldmap follow-camera timeout survives switch-off/destroy

Evidence:

1. `focusCameraOnEvent()` schedules a timeout that mutates `useUIStore` three seconds later:
   `client/apps/game/src/three/scenes/worldmap.tsx:1194`.
2. `onSwitchOff()` does not clear `followCameraTimeout`: `client/apps/game/src/three/scenes/worldmap.tsx:2372`.
3. `destroy()` does not clear `followCameraTimeout` either: `client/apps/game/src/three/scenes/worldmap.tsx:5073`.

Risk:

1. An inactive worldmap scene can reset follow-state after the user has switched scenes.
2. A stale timeout can override newer follow-state written by later interactions.

Root cause: timeout lifecycle is not included in shared scene teardown.

### F4: Tone mapping is applied twice in the MID/HIGH render pipeline

Evidence:

1. Renderer-level ACES tone mapping is always enabled: `client/apps/game/src/three/game-renderer.ts:341`.
2. A post-processing `ToneMappingEffect` is also always created when post-processing is enabled:
   `client/apps/game/src/three/game-renderer.ts:847`.

Risk:

1. Contrast and highlight response are compressed twice.
2. Bloom thresholds and grading become harder to tune consistently across tiers.

Root cause: tone mapping policy is split across the WebGL renderer and the composer stack instead of having one
authoritative stage.

### F5: Test coverage misses the exact failure modes above

Evidence:

1. `scene-manager.test.ts` covers superseded transitions but not setup failure recovery.
2. `game-renderer.lifecycle.test.ts` exists, but there is no teardown-safe async environment completion case.
3. Worldmap lifecycle tests do not assert timeout cleanup for delayed UI state changes.
4. There is no render-policy test asserting a single authoritative tone-mapping path.

Risk:

1. These failures can regress silently because current tests skew toward success-path orchestration.

## Goals

1. Make scene transitions recoverable when target setup fails.
2. Ensure no async renderer startup work can mutate state after destroy.
3. Guarantee worldmap timers are owned by the active scene lifecycle.
4. Make tone mapping single-path and policy-driven.
5. Add deterministic tests that lock these behaviors before implementation.

## Non-Goals

1. Full scene-manager rewrite.
2. New rendering features, shaders, or art-direction changes.
3. Broad worldmap architecture changes outside timeout/lifecycle cleanup.
4. Reworking the entire post-processing stack beyond tone-mapping authority.
5. Refactors outside `client/apps/game/src/three`.

## Scope

### In Scope

1. `client/apps/game/src/three/scene-manager.ts`
2. `client/apps/game/src/three/game-renderer.ts`
3. `client/apps/game/src/three/game-renderer-policy.ts`
4. `client/apps/game/src/three/scenes/worldmap.tsx`
5. New or expanded tests under:
   1. `client/apps/game/src/three/*.test.ts`
   2. `client/apps/game/src/three/scenes/*.test.ts`

### Out of Scope

1. `hexception` gameplay behavior changes unrelated to lifecycle correctness.
2. Asset content changes.
3. Dojo/Torii transport changes.
4. HUD redesign.

## Requirements

### Functional Requirements

| ID   | Requirement                                                                                                                           | Priority |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| FR-1 | `SceneManager` must not commit `currentScene` until target `setup()` succeeds.                                                        | P0       |
| FR-2 | If target scene setup fails, the transition must not fade in as if setup succeeded.                                                   | P0       |
| FR-3 | A failed scene transition must leave the app in a recoverable state with a deterministic fallback strategy.                           | P0       |
| FR-4 | Async environment loading must no-op after `GameRenderer.destroy()` and must not reattach disposed targets.                           | P0       |
| FR-5 | Worldmap `followCameraTimeout` must be cleared on both `onSwitchOff()` and `destroy()`.                                               | P0       |
| FR-6 | There must be one authoritative tone-mapping stage in MID/HIGH: either renderer-level or composer-level, but not both simultaneously. | P1       |
| FR-7 | Each of the four findings must be protected by deterministic tests written before production changes.                                 | P0       |

### Non-Functional Requirements

| ID    | Requirement                                                                                         | Priority |
| ----- | --------------------------------------------------------------------------------------------------- | -------- |
| NFR-1 | No new lifecycle fix may rely on arbitrary wall-clock sleeps in tests.                              | P0       |
| NFR-2 | Teardown-safe async guards must add negligible startup overhead.                                    | P0       |
| NFR-3 | Scene transition hardening must not regress existing rapid-toggle serialization behavior.           | P0       |
| NFR-4 | Rendering policy changes must preserve existing LOW-tier behavior.                                  | P1       |
| NFR-5 | New tests must be stable under jsdom/unit execution without requiring real WebGL output validation. | P0       |

## Invariants

1. `currentScene` only changes after the target scene is successfully ready for use.
2. No async callback may mutate renderer-owned state after `destroy()`.
3. Scene-local timers must be cleared by scene lifecycle teardown.
4. Tone mapping runs in exactly one place per render path.

## Proposed Design

### D1: Transition commit after successful setup only

Applies to: F1

Change:

1. In `completeTransition()`, defer `_updateCurrentScene(sceneName)` until after `await scene.setup()` succeeds.
2. Introduce an explicit failure finalize path:
   1. Do not call `moveCameraForScene()` on failure.
   2. Do not call `fadeIn()` on failure.
   3. Clear `transitionInProgress`.
3. Decide fallback behavior explicitly:
   1. Preferred: keep previous scene active until new setup succeeds.
   2. Acceptable fallback: if previous scene was already switched off, restore authoritative scene state before
      returning.

Recommended implementation direction:

1. Move `previousScene?.onSwitchOff()` later, after successful target setup, if scene setup does not require exclusive
   ownership.
2. If that ordering is not possible, store `previousSceneName` and define explicit recovery semantics in the failure
   branch.

Why:

1. The current flow treats setup failure as a log-only event, but lifecycle ownership has already changed.
2. This is a correctness bug, not just a UX issue.

### D2: Renderer lifecycle token or destroyed-guard for environment load completion

Applies to: F2

Change:

1. Add a lifecycle guard for async environment application:
   1. Minimal option: check `this.isDestroyed` inside the `.then(...)` before calling `setEnvironmentFromTarget(...)`.
   2. Stronger option: issue a monotonic renderer lifecycle token and capture it in `applyEnvironment()`.
2. `setEnvironmentFromTarget()` should early-return when renderer is destroyed.
3. Dispose or ignore late-created non-cached targets that arrive after destroy.

Recommended implementation direction:

1. Add `const environmentLoadToken = ++this.environmentLoadToken`.
2. In resolution path, require:
   1. `!this.isDestroyed`
   2. `environmentLoadToken === this.environmentLoadToken`
3. On `destroy()`, increment the token so all pending completions are invalidated.

Why:

1. This pattern matches existing chunk ownership/token hardening already used elsewhere in `src/three`.
2. It prevents late writes without forcing broad loader cancellation machinery.

### D3: Shared timeout cleanup helper in worldmap lifecycle

Applies to: F3

Change:

1. Extract a small helper such as `clearFollowCameraTimeout()`.
2. Call it from:
   1. `focusCameraOnEvent()` before scheduling a new timeout.
   2. `onSwitchOff()`.
   3. `destroy()`.
3. Optional: also reset `useUIStore` follow-state during switch-off if worldmap is the owner of that state.

Why:

1. The timeout is scene-owned behavior but currently outlives the scene.
2. A shared helper reduces future teardown drift.

### D4: Single authoritative tone-mapping policy

Applies to: F4

Decision:

1. Pick one tone-mapping path for MID/HIGH and remove the other from those paths.

Recommended choice:

1. Keep post-processing tone mapping for MID/HIGH.
2. Set renderer tone mapping to `NoToneMapping` when post-processing tone mapping is active.
3. Preserve renderer-level tone mapping only for paths that skip composer tone mapping.

Why:

1. The composer already owns other color grading decisions.
2. Keeping tone mapping in the post stack centralizes exposure/grade behavior into one policy surface.

Implementation notes:

1. Encode this as policy, not an ad hoc if-statement.
2. Add a small pure helper if necessary so tests can assert the intended rendering mode by graphics tier.

## TDD Operating Model (Mandatory)

### Iron Rule

No production change without a failing test first.

### Per-Slice Protocol

1. RED
   1. Add one minimal failing test for one behavior.
   2. Confirm it fails for the intended reason.
2. GREEN
   1. Implement the smallest fix that satisfies the spec.
   2. Re-run the targeted test.
3. REFACTOR
   1. Extract helpers only after green.
   2. Re-run the affected cluster.

## Test Plan

### T1: Scene setup failure recovery

Target file:

1. `client/apps/game/src/three/scene-manager.test.ts`

New test cases:

1. When target `setup()` rejects, `currentScene` remains the previous successful scene.
2. When target `setup()` rejects, `fadeIn()` is not called for the failed transition.
3. When target `setup()` rejects, scene manager can still process a later valid transition successfully.

Test shape:

1. Stub transition manager.
2. Create one healthy scene and one failing scene.
3. Drive `switchScene()` and resolve the fade callback manually.

### T2: Async environment completion after destroy

Target file:

1. `client/apps/game/src/three/game-renderer.lifecycle.test.ts`

New test cases:

1. Destroying renderer before environment promise settles prevents `setEnvironmentFromTarget()` from running.
2. A superseded environment load completion cannot replace a newer environment target.

Test shape:

1. Stub `loadCachedEnvironmentMap()` to return a deferred promise.
2. Call `applyEnvironment()`, then `destroy()`, then resolve the promise.
3. Assert no scene mutation or target swap occurs after destroy.

### T3: Worldmap follow timeout cleanup

Target file:

1. `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`

New test cases:

1. `onSwitchOff()` clears `followCameraTimeout`.
2. `destroy()` clears `followCameraTimeout`.
3. A cleared timeout cannot later write `setIsFollowingArmy(false)` or `setFollowingArmyMessage(null)`.

Test shape:

1. Use fake timers.
2. Trigger `focusCameraOnEvent()` or a seam/helper around it.
3. Switch off/destroy, advance timers, assert no stale store mutation.

### T4: Tone-mapping authority

Target file:

1. `client/apps/game/src/three/game-renderer-policy.test.ts` or new targeted policy test file

New test cases:

1. MID/HIGH with post-processing enabled resolves exactly one tone-mapping authority.
2. LOW preserves current no-post-processing behavior.
3. Renderer tone-mapping mode and composer tone-mapping plan do not conflict.

Test shape:

1. Prefer pure policy helper tests over imperative WebGL setup.
2. Assert plan outputs, not pixels.

## Milestones

### M0: Spec Baseline (0.5 day)

Objective:

1. Lock the four failure modes in tests before any implementation.

Deliverables:

1. New failing tests for T1-T4.
2. Baseline behavior matrix recorded in this document.

Exit criteria:

1. All new tests fail first for the intended reason.

### M1: Scene Transition Recovery (0.5-1 day)

Objective:

1. Fix F1 without regressing existing rapid-transition serialization.

Deliverables:

1. Safe transition commit ordering.
2. Explicit failure finalize behavior.
3. Green T1 + existing `scene-manager` regression suite.

Exit criteria:

1. Failed target setup no longer corrupts authoritative scene state.

### M2: Renderer Async Lifecycle Safety (0.5-1 day)

Objective:

1. Make environment application lifecycle-safe.

Deliverables:

1. Environment lifecycle token or destroyed-guard.
2. Teardown-safe environment apply path.
3. Green T2 + existing `game-renderer` lifecycle suite.

Exit criteria:

1. No late environment mutation after destroy.

### M3: Worldmap Timer Ownership (0.5 day)

Objective:

1. Bring follow-camera timeout under normal scene teardown ownership.

Deliverables:

1. Shared timeout clear helper.
2. Cleanup wired into `onSwitchOff()` and `destroy()`.
3. Green T3 + relevant worldmap lifecycle tests.

Exit criteria:

1. Inactive worldmap cannot mutate follow-state later.

### M4: Render Policy Consolidation (0.5-1 day)

Objective:

1. Collapse tone mapping to one authority without changing LOW-tier behavior.

Deliverables:

1. Pure render-policy helper or equivalent tests.
2. Single-path tone-mapping implementation.
3. Green T4 + targeted renderer policy tests.

Exit criteria:

1. Exactly one tone-mapping stage is active per supported render path.

## Acceptance Criteria

1. A failing scene setup does not update `currentScene`, does not fade in, and does not block later valid transitions.
2. Destroying `GameRenderer` before HDR completion prevents all late environment application side effects.
3. Switching off or destroying worldmap cancels pending follow-camera timeout behavior.
4. MID/HIGH tone mapping is configured in exactly one pipeline stage.
5. All new tests pass and existing touched-area tests remain green.

## Risks and Tradeoffs

1. Reordering scene switch-off relative to setup may expose hidden assumptions inside scene setup routines.
2. A minimal `isDestroyed` guard is fast, but a token-based approach is more robust if startup work can overlap.
3. Moving tone mapping to one authority may slightly change final image output and require minor rebalance of bloom or
   exposure defaults.

## Rollout Strategy

1. Land M1-M3 before M4 if the team wants correctness fixes separated from visual pipeline changes.
2. If desired, keep the tone-mapping change behind a temporary debug toggle for fast visual comparison during review.

## Open Questions

1. Can scene setup safely run before previous scene `onSwitchOff()`, or does setup depend on exclusive ownership today?
2. Should worldmap teardown also clear follow-state immediately, or only cancel future timeout writes?
3. Does the team want post-processing to remain the long-term owner of color grading and tone mapping, or should that
   move back to renderer-level policy?

## Suggested Implementation Order

1. T1/M1: transition recovery.
2. T2/M2: renderer async teardown safety.
3. T3/M3: worldmap timer cleanup.
4. T4/M4: tone-mapping authority.

This order fixes correctness first and keeps the render-policy change isolated last.
