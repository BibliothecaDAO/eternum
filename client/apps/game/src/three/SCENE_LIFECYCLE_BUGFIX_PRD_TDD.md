# Scene Lifecycle Bugfix PRD + TDD

Status: Draft
Date: 2026-03-18
Scope: `client/apps/game/src/three`
Primary surfaces: HexagonScene lifecycle cleanup, HexceptionScene subscription management, WorldmapScene timer and effect teardown, manager cleanup ordering

## 1. Summary

This document catalogs memory leaks, dangling timers, and lifecycle cleanup bugs across the scene and manager implementations, and converts them into a staged delivery plan with product requirements, technical design, file-level scope, and test-first implementation steps.

The core conclusion from the review is:

- multiple scene classes leave timers, subscriptions, textures, or manager references alive after destruction
- these leaks compound during scene switches, realm visits, and hot-reload cycles
- the fixes are surgical and low-risk: each targets a specific resource lifecycle gap
- no architectural changes are needed — the existing destroy/cleanup seams are correct, they just have gaps

The plan below uses a milestone approach so that each stage:

- ships a measurable improvement
- touches a single scene or manager file to limit blast radius
- adds tests before behavior changes
- can be verified with browser DevTools memory snapshots

## 2. Problem Statement

Scene implementations in the Three.js layer have accumulated lifecycle gaps where resources are created but not fully released on teardown. These bugs cause GPU memory leaks, dangling timer callbacks that fire on disposed objects, subscription accumulation across scene switches, and stale closure references that prevent garbage collection.

### 2.1 Untracked timers fire on destroyed scenes

`HexagonScene.shouldTriggerLightningAtCycleProgress()` schedules a `setTimeout` whose handle is never stored. If the scene is destroyed within the 2000ms window, the callback fires `startLightningSequence()` on disposed Three.js objects, risking WebGL errors or silent corruption.

Similarly, `WorldmapScene.followCameraTimeout` is only cleared when a new follow starts, not during `onSwitchOff()` or `destroy()`. The closure holds a reference to the destroyed scene, preventing garbage collection.

### 2.2 GPU textures leak on every teardown

`HexagonScene.createGroundMesh()` loads a `Texture` via `TextureLoader` and assigns it to a `MeshStandardMaterial`. In `destroy()`, `material.dispose()` is called, but Three.js `MeshStandardMaterial.dispose()` does NOT auto-dispose its map textures. The GPU texture leaks on every scene teardown and reconstruction cycle.

### 2.3 Subscriptions accumulate across realm switches

`HexceptionScene.setup()` calls `worldUpdateListener.Buildings.onBuildingUpdate(...)` on every realm switch. The underlying `defineComponentSystem` call registers a new system handler each time, but no mechanism exists to unregister the previous one. Each realm visit accumulates a live subscription that continues to fire callbacks.

### 2.4 Travel effects and their timeouts survive scene switch-off

`WorldmapScene.travelEffects` and `travelEffectsByEntity` maps hold cleanup functions with internal `maxLifetimeTimeout` handles (up to 90 seconds). These are not cancelled during `onSwitchOff()`, so callbacks fire on destroyed managers after scene teardown.

### 2.5 Manager disposal ordering causes leaked listeners

`ArmyManager.destroy()` calls `unsubscribeVisibility` after several disposal calls that could throw. If any earlier disposal throws, the visibility listener is never unsubscribed. The interval in `WeatherManager.addGUIControls` overwrites `guiStatusIntervalId` without clearing the previous one, leaking intervals on hot-reload.

### 2.6 Debug logging in production

`HexagonScene.getHexagonCoordinates()` contains a `console.log("row", row, col)` that fires on every click/raycast in production builds.

## 3. Goals

### 3.1 Product goals

- eliminate GPU memory growth during repeated scene switches
- prevent WebGL errors and silent corruption from callbacks firing on disposed objects
- stop subscription accumulation during realm switching in hexception
- remove production debug logging noise

### 3.2 Technical goals

- every `setTimeout`/`setInterval` handle is stored in a class field and cleared in the appropriate cleanup method
- every GPU texture created by a scene is explicitly disposed in `destroy()`
- every subscription registered in `setup()` is unregistered before re-registration and in `destroy()`
- manager `destroy()` methods handle errors in earlier disposal steps without skipping later cleanup
- no `console.log` calls remain in production click/raycast paths

## 4. Non-goals

- rewriting scene lifecycle architecture
- adding new manager abstractions or base class changes
- changing rendering behavior, visual output, or gameplay
- refactoring the `WorldUpdateListener` subscription API beyond what is needed for the immediate leak fix

## 5. Architecture Assessment

The existing scene lifecycle architecture is sound:

- `HexagonScene` has `cleanupLightning()` and `destroy()` with proper disposal sequencing
- `HexceptionScene` has `onSwitchOff()` for scene-switch cleanup and `destroy()` for full teardown
- `WorldmapScene` has `onSwitchOff()` with transition token invalidation and `destroy()` calling `onSwitchOff()` first
- managers have `dispose()` or `destroy()` methods

The bugs are gaps in these existing seams, not missing seams. Each fix adds the missing cleanup call to the correct existing method.

## 6. Success Metrics

### 6.1 Memory metrics

- GPU memory (measured via `performance.memory` or Chrome DevTools GPU tab) does not grow across 10 repeated scene switch cycles
- heap snapshot diff across scene switch cycles shows no retained `Texture`, `CSS2DObject`, or scene closure references

### 6.2 Correctness metrics

- no WebGL warnings or errors in console during rapid scene switching
- no `console.log("row", ...)` output in production builds
- building update callbacks do not fire for previously-visited realms after switching to a new realm

### 6.3 Stability metrics

- no uncaught exceptions during `destroy()` calls
- `ArmyManager.destroy()` completes fully even when individual disposal steps throw

## 7. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | HexagonScene Lifecycle Leaks | Fix dangling timer, texture leak, remove debug log |
| 1 | HexceptionScene Subscription Leaks | Fix building subscription accumulation, add label disposal |
| 2 | WorldmapScene Timer and Effect Cleanup | Fix follow timeout, travel effect timeouts, manager disposal |
| 3 | Manager Cleanup Ordering | Fix interval overwrite, reorder army manager disposal |

### Delivery Tracker

- [x] Stage 0: HexagonScene Lifecycle Leaks
- [x] Stage 1: HexceptionScene Subscription Leaks
- [x] Stage 2: WorldmapScene Timer and Effect Cleanup
- [x] Stage 3: Manager Cleanup Ordering

### Dependencies

- Stages 0, 1, 2, and 3 are independent — they touch different scene/manager files
- Stages 0 and 1 should ship first (most impactful leaks: GPU texture and subscription accumulation)
- Stage 2 should follow (worldmap cleanup is less critical since scene switches are less frequent)
- Stage 3 can ship in any order

## 8. Detailed Stages

### 8.1 Stage 0: HexagonScene Lifecycle Leaks

#### Objective

Fix three lifecycle issues in `HexagonScene`: an untracked lightning timer, an undisposed ground mesh texture, and a debug log statement in production code.

#### Bug 0a: Untracked `setTimeout` in `shouldTriggerLightningAtCycleProgress`

**Location:** `client/apps/game/src/three/scenes/hexagon-scene.ts`, line 1224

**Problem:** `shouldTriggerLightningAtCycleProgress()` calls `setTimeout(() => this.startLightningSequence(), 2000)` but the returned handle is never stored. `cleanupLightning()` clears `this.lightningSequenceTimeout` but not this separate timer. If the scene is destroyed within the 2000ms window, `startLightningSequence()` fires on disposed Three.js objects (lights, thunderbolt manager).

**Fix:** Add a class field `private lightningTriggerTimeout: ReturnType<typeof setTimeout> | null = null`. Store the `setTimeout` handle in it. Clear it in `cleanupLightning()` alongside the existing `lightningSequenceTimeout` cleanup.

#### Bug 0b: Ground mesh texture never disposed

**Location:** `client/apps/game/src/three/scenes/hexagon-scene.ts`, lines 940-949 (creation) and 1275-1284 (disposal)

**Problem:** `createGroundMesh()` creates a `Texture` via `new TextureLoader().load(...)` and passes it as the `map` property of a `MeshStandardMaterial`. In `destroy()`, `material.dispose()` is called but Three.js `MeshStandardMaterial.dispose()` does NOT auto-dispose its textures — it only frees the material's internal WebGL program. The GPU texture leaks on every teardown.

**Fix:** Add a class field `private groundMeshTexture: Texture | null = null`. Store the texture reference after creation. In `destroy()`, before or after disposing the material, call `this.groundMeshTexture?.dispose()` and null the field.

#### Bug 0c: Debug `console.log` in production click handler

**Location:** `client/apps/game/src/three/scenes/hexagon-scene.ts`, line 777

**Problem:** `console.log("row", row, col)` fires on every click/raycast intersection in `getHexagonCoordinates()`. This is debug noise in production.

**Fix:** Remove the line.

#### Files to change

- `client/apps/game/src/three/scenes/hexagon-scene.ts`

#### TDD plan

Write tests first:

1. **Lightning trigger timer cleanup test:** Construct a minimal `HexagonScene` test double. Call `shouldTriggerLightningAtCycleProgress` with a progress value that triggers the `setTimeout` path (cycleProgress < 20, lastLightningTriggerProgress !== 0). Verify that calling `cleanupLightning()` before the timeout fires prevents `startLightningSequence()` from executing. After cleanup, advance fake timers past 2000ms and assert `startLightningSequence` was not called.

2. **Ground texture disposal test:** Construct a scene and trigger `createGroundMesh()`. Verify that `destroy()` calls `dispose()` on the texture object. Use a spy on the texture's `dispose` method to confirm it is invoked during teardown.

3. **No console.log in getHexagonCoordinates:** Call `getHexagonCoordinates()` with valid inputs. Spy on `console.log` and assert it is not called.

Implementation steps:

1. Add `private lightningTriggerTimeout: ReturnType<typeof setTimeout> | null = null` field
2. Store the `setTimeout` return value: `this.lightningTriggerTimeout = setTimeout(...)`
3. In `cleanupLightning()`, add:
   ```typescript
   if (this.lightningTriggerTimeout) {
     clearTimeout(this.lightningTriggerTimeout);
     this.lightningTriggerTimeout = null;
   }
   ```
4. Add `private groundMeshTexture: Texture | null = null` field
5. In `createGroundMesh()`, store texture: `this.groundMeshTexture = texture`
6. In `destroy()`, inside the ground mesh disposal block, add `this.groundMeshTexture?.dispose(); this.groundMeshTexture = null;`
7. Remove `console.log("row", row, col)` at line 777

Exit criteria:

- fake-timer test proves lightning callback does not fire after cleanup
- spy test proves texture `.dispose()` is called during `destroy()`
- console.log spy test proves no logging during `getHexagonCoordinates`
- manual test: switch scenes 10 times, GPU memory does not grow monotonically

### 8.2 Stage 1: HexceptionScene Subscription Leaks

#### Objective

Fix subscription accumulation during realm switches and ensure `HexHoverLabel` resources are fully released on destroy.

#### Bug 1a: Building update subscription re-registered without unsubscribing

**Location:** `client/apps/game/src/three/scenes/hexception.tsx`, lines 451-460

**Problem:** `setup()` calls `this.worldUpdateListener.Buildings.onBuildingUpdate(...)` on every realm switch. The underlying implementation calls `defineComponentSystem()` which registers a new system handler. The `onBuildingUpdate` method does not return an unsubscribe handle, and no mechanism exists to unregister the previous handler. Each realm visit accumulates a live subscription.

**Fix:** This requires a two-part change:
1. Modify `WorldUpdateListener.setupSystem()` and the `onBuildingUpdate` method to return an unsubscribe function (or accept a subscription token that can be replaced).
2. In `HexceptionScene`, capture the unsubscribe handle, call it before re-registration in `setup()`, and call it in `destroy()`.

If modifying `WorldUpdateListener` is out of scope for this stage, an alternative defensive fix is to add a guard boolean `private buildingUpdateSubscribed = false` in `HexceptionScene` that prevents re-registration. This stops the accumulation but means the callback still points to the old realm coordinates. The proper fix requires the unsubscribe mechanism.

**Recommended approach:** Add an `unsubscribe` return value to `setupSystem` by capturing the subscription object from `defineComponentSystem` and returning a cleanup function. Then capture and manage it in `HexceptionScene`.

#### Bug 1b: `HexHoverLabel` not disposed in `destroy()`

**Location:** `client/apps/game/src/three/scenes/hexception.tsx`, line 176 (creation), line 507 (destroy calls `clearHoverLabel()`)

**Problem:** `HexHoverLabel` is constructed in the constructor and `clearHoverLabel()` (which calls `.clear()`) is called in `destroy()`. The `clear()` method does remove the `CSS2DObject` from the scene and detach the DOM element. However, no explicit `dispose()` is called, and if the label was never shown (no `update()` call), `clear()` is a no-op since `this.label` is null. Additionally, the `HexHoverLabel` instance itself remains referenced.

**Fix:** Add a `dispose()` method to `HexHoverLabel` that calls `clear()` and nulls internal references. Call `this.hoverLabelManager.dispose()` in `HexceptionScene.destroy()` after `clearHoverLabel()`. While `clear()` currently handles the active case, having an explicit `dispose()` makes the lifecycle contract clear and handles future additions to `HexHoverLabel`.

#### Files to change

- `client/apps/game/src/three/scenes/hexception.tsx`
- `client/apps/game/src/three/utils/labels/hex-hover-label.ts`
- `packages/core/src/systems/world-update-listener.ts` (for unsubscribe mechanism)

#### TDD plan

Write tests first:

1. **Subscription accumulation test:** Create a test that simulates calling `setup()` twice with different realm coordinates. Assert that after the second `setup()`, only one building update subscription is active. The first subscription's callback should not fire when a building update occurs on the old coordinates.

2. **Subscription cleanup on destroy test:** Register a building update subscription via `setup()`, then call `destroy()`. Assert that the subscription callback no longer fires for building updates.

3. **HexHoverLabel dispose test:** Create a `HexHoverLabel`, call `update()` to create a label, then call `dispose()`. Assert that the CSS2DObject is removed from the scene and the DOM element is detached. Create a second label, never call `update()`, then call `dispose()`. Assert no errors.

4. **HexHoverLabel clear idempotency test:** Call `clear()` multiple times in sequence. Assert no errors and the label remains in a clean state.

Implementation steps:

1. In `world-update-listener.ts`, modify `setupSystem()` to capture the subscription from `defineComponentSystem` and return an unsubscribe function
2. Update `onBuildingUpdate` to return the unsubscribe function from `setupSystem()`
3. In `hexception.tsx`, add a field `private buildingUpdateUnsubscribe: (() => void) | null = null`
4. In `setup()`, call `this.buildingUpdateUnsubscribe?.()` before calling `onBuildingUpdate`, then store the new unsubscribe handle
5. In `destroy()`, call `this.buildingUpdateUnsubscribe?.()` and null the field
6. Add `dispose()` method to `HexHoverLabel` that calls `clear()` and sets internal state to signal disposed
7. Call `this.hoverLabelManager.dispose()` in `HexceptionScene.destroy()`

Exit criteria:

- test proves only one active subscription exists after multiple `setup()` calls
- test proves subscription is cleaned up on `destroy()`
- test proves `HexHoverLabel.dispose()` removes all CSS2D and DOM references
- manual test: switch between 5 different realms, heap snapshot shows no subscription accumulation

### 8.3 Stage 2: WorldmapScene Timer and Effect Cleanup

#### Objective

Fix dangling timers and undisposed managers in the worldmap scene teardown path.

#### Bug 2a: `followCameraTimeout` not cleared in `onSwitchOff()`/`destroy()`

**Location:** `client/apps/game/src/three/scenes/worldmap.tsx`, line 557 (declaration), line 1347 (usage)

**Problem:** `followCameraTimeout` is a `setTimeout` handle set when following an army. It is only cleared when a new follow starts (line 1343-1345). If the scene is destroyed or switched off while a follow timeout is pending, the closure reference to the scene prevents garbage collection, and the callback fires on destroyed UI store state.

**Fix:** Clear `this.followCameraTimeout` in `onSwitchOff()`. Since `destroy()` calls `onSwitchOff()` first, this covers both paths.

#### Bug 2b: `travelEffects` and internal `maxLifetimeTimeout`s not cancelled on `onSwitchOff()`

**Location:** `client/apps/game/src/three/scenes/worldmap.tsx`, lines 607-609 (maps), line 1860 (maxLifetimeTimeout)

**Problem:** `travelEffects` is a `Map<string, () => void>` where each value is a cleanup function. `travelEffectsByEntity` maps entity IDs to cleanup metadata. Each travel effect also has an internal `maxLifetimeTimeout` (up to `MAX_TRAVEL_EFFECT_LIFETIME_MS`, which can be 90 seconds). None of these are cancelled during `onSwitchOff()`. If scene switches happen mid-travel, the timeout callbacks fire on destroyed managers.

**Fix:** In `onSwitchOff()`, iterate `travelEffects` and call each cleanup function, then clear both maps. The cleanup functions internally clear their own timeouts (both `delayedCleanupTimeout` and `maxLifetimeTimeout` via closure references). If the cleanup functions do not cancel `maxLifetimeTimeout`, the timeout handle must also be tracked and cleared.

#### Bug 2c: `hoverLabelManager` and `selectedHexManager` never disposed in `destroy()`

**Location:** `client/apps/game/src/three/scenes/worldmap.tsx`, line 802 (hoverLabelManager creation), line 1065 (selectedHexManager creation)

**Problem:** `HoverLabelManager` has no `dispose()` or `destroy()` method at all. `SelectedHexManager` has a `dispose()` method (which disposes its particle system), but it is never called in the worldmap `destroy()` path. Both managers hold Three.js resources that leak.

**Fix:**
1. Add a `dispose()` method to `HoverLabelManager` that cleans up any held label references and removes them from the scene
2. Call `this.hoverLabelManager.dispose()` in `WorldmapScene.destroy()`
3. Call `this.selectedHexManager.dispose()` in `WorldmapScene.destroy()`

#### Files to change

- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/managers/hover-label-manager.ts`

#### TDD plan

Write tests first:

1. **followCameraTimeout cleared on switchOff test:** Set `followCameraTimeout` to a pending timeout. Call `onSwitchOff()`. Advance fake timers. Assert the callback does not fire and `followCameraTimeout` is null.

2. **travelEffects cleaned up on switchOff test:** Register travel effects in the `travelEffects` map. Call `onSwitchOff()`. Assert all cleanup functions were called and both maps are empty. Advance fake timers past `MAX_TRAVEL_EFFECT_LIFETIME_MS` and assert no callbacks fire.

3. **selectedHexManager disposed in destroy test:** Spy on `SelectedHexManager.dispose()`. Call `destroy()`. Assert the spy was called.

4. **hoverLabelManager disposed in destroy test:** Add a `dispose()` method to `HoverLabelManager`. Spy on it. Call `destroy()`. Assert the spy was called.

5. **Idempotent switchOff test:** Call `onSwitchOff()` twice in sequence. Assert no errors on the second call (all maps already cleared, all timeouts already cancelled).

Implementation steps:

1. In `onSwitchOff()`, add after existing cleanup:
   ```typescript
   if (this.followCameraTimeout) {
     clearTimeout(this.followCameraTimeout);
     this.followCameraTimeout = null;
   }
   ```
2. In `onSwitchOff()`, add travel effect cleanup:
   ```typescript
   this.travelEffects.forEach((cleanup) => cleanup());
   this.travelEffects.clear();
   this.travelEffectsByEntity.clear();
   ```
3. Add `dispose()` to `HoverLabelManager` that hides all labels and releases references
4. In `destroy()`, before `super.destroy()`, add:
   ```typescript
   this.hoverLabelManager.dispose();
   this.selectedHexManager.dispose();
   ```

Exit criteria:

- fake-timer tests prove no callbacks fire after switchOff/destroy
- spy tests prove both managers are disposed
- idempotent switchOff test passes
- manual test: switch between worldmap and hexception 10 times, no console errors, heap does not grow

### 8.4 Stage 3: Manager Cleanup Ordering

#### Objective

Fix interval leak in `WeatherManager` and improve error resilience in `ArmyManager.destroy()`.

#### Bug 3a: `WeatherManager.guiStatusIntervalId` overwritten without clearing previous

**Location:** `client/apps/game/src/three/managers/weather-manager.ts`, lines 555-561

**Problem:** `addGUIControls()` sets `this.guiStatusIntervalId = setInterval(...)` without first clearing any existing interval. If `addGUIControls()` is called more than once (e.g., during hot-reload or GUI reconstruction), the previous interval handle is overwritten and the old interval runs indefinitely.

The `dispose()` method (lines 604-607) correctly clears the interval, but it only clears the last-stored handle.

**Fix:** At the top of the `setInterval` assignment in `addGUIControls()`, clear any existing interval:
```typescript
if (this.guiStatusIntervalId) {
  clearInterval(this.guiStatusIntervalId);
}
this.guiStatusIntervalId = setInterval(...);
```

#### Bug 3b: `ArmyManager.unsubscribeVisibility` called after disposals that could throw

**Location:** `client/apps/game/src/three/managers/army-manager.ts`, lines 3001-3028

**Problem:** `destroy()` calls `this.armyModel.dispose()`, `this.playerIndicatorManager.dispose()`, `this.fxManager.destroy()`, and other operations before reaching `this.unsubscribeVisibility()` at line 3025. If any of those earlier calls throw, the visibility listener is never unsubscribed, causing a permanent leak.

**Fix:** Move `unsubscribeVisibility` to the top of `destroy()`, before any disposal calls that could throw. Visibility unsubscription is a lightweight operation that does not depend on other disposal state.

#### Files to change

- `client/apps/game/src/three/managers/weather-manager.ts`
- `client/apps/game/src/three/managers/army-manager.ts`

#### TDD plan

Write tests first:

1. **WeatherManager interval not leaked on re-add test:** Call `addGUIControls()` twice. Assert that only one active interval exists (the first was cleared before the second was started). Use a spy on `clearInterval` to verify the old handle was cleared.

2. **WeatherManager dispose clears interval test:** Call `addGUIControls()`, then `dispose()`. Assert `clearInterval` was called with the correct handle.

3. **ArmyManager unsubscribe runs despite earlier throw test:** Create an `ArmyManager` with a mock `armyModel` whose `dispose()` throws. Call `destroy()`. Assert that `unsubscribeVisibility` was still called despite the throw.

4. **ArmyManager unsubscribe runs first test:** Spy on both `unsubscribeVisibility` and `armyModel.dispose()`. Call `destroy()`. Assert that `unsubscribeVisibility` was called before `armyModel.dispose()`.

Implementation steps:

1. In `weather-manager.ts`, add guard before `setInterval` in `addGUIControls()`:
   ```typescript
   if (this.guiStatusIntervalId) {
     clearInterval(this.guiStatusIntervalId);
     this.guiStatusIntervalId = undefined;
   }
   ```
2. In `army-manager.ts`, move the `unsubscribeVisibility` block from lines 3025-3028 to the very top of `destroy()`, before any other disposal calls

Exit criteria:

- spy test proves interval is cleared before re-assignment
- mock-throw test proves visibility unsubscribe runs even when earlier disposals fail
- ordering test proves unsubscribe runs first
- manual test: hot-reload with GUI controls open, verify no interval accumulation via DevTools timer count

## 9. Test Strategy

The implementation should remain test-first throughout.

### 9.1 Core testing principles

- no production behavior change without a failing test first
- keep tests focused on the specific lifecycle gap being fixed
- use fake timers (`vi.useFakeTimers()` or `jest.useFakeTimers()`) for all timeout/interval assertions
- use spies to verify disposal calls without requiring full Three.js rendering

### 9.2 Test categories

- lifecycle tests:
  - timer cleanup on destroy
  - texture disposal on destroy
  - subscription cleanup on destroy and re-setup
- ordering tests:
  - unsubscribe before re-registration
  - critical cleanup before fallible disposal
- idempotency tests:
  - double-destroy safety
  - double-switchOff safety
  - re-adding GUI controls

### 9.3 Manual validation checklist

- switch between hexception and worldmap scenes 10 times rapidly
  - GPU memory (Chrome DevTools > Performance > Memory) should plateau, not grow
  - no WebGL errors in console
- visit 5 different realms in hexception
  - building update callbacks should not fire for previously-visited realms
  - no `console.log("row", ...)` output
- start army travel on worldmap, switch to hexception before travel completes
  - no console errors from travel effect callbacks firing on disposed managers
- open and close debug GUI controls multiple times
  - DevTools timer count should not increase

## 10. Risks and Mitigations

### 10.1 Risk: `defineComponentSystem` does not support unsubscription

Mitigation:

- check if the underlying `world.registerSystem` or equivalent returns a disposer
- if not, implement a wrapper that tracks the system ID and can remove it
- fallback: use a guard boolean to prevent re-registration (stops accumulation but keeps stale callback)

### 10.2 Risk: travel effect cleanup functions have side effects beyond timer clearing

Mitigation:

- audit each cleanup function to ensure calling it during switchOff is safe
- the cleanup functions already handle the "early cleanup" case since they are designed to be called from entity arrival events

### 10.3 Risk: moving `unsubscribeVisibility` to top of `destroy()` changes observable behavior

Mitigation:

- visibility unsubscription is a read-only detach operation with no dependencies on other disposal state
- verify by checking what `unsubscribeVisibility` does — it should be a simple event listener removal

### 10.4 Risk: `HoverLabelManager` has no dispose method and may have hidden state

Mitigation:

- audit `HoverLabelManager` implementation to understand all held resources
- the manager currently has no dispose/destroy method, so adding one is additive and cannot regress existing behavior

## 11. Recommended Delivery Order

If the team wants the best risk-adjusted milestone path, implement in this order:

1. Stage 0: HexagonScene Lifecycle Leaks (highest impact: GPU texture leak on every teardown)
2. Stage 1: HexceptionScene Subscription Leaks (high impact: accumulation on every realm visit)
3. Stage 2: WorldmapScene Timer and Effect Cleanup (medium impact: less frequent scene switches)
4. Stage 3: Manager Cleanup Ordering (lower impact: primarily affects hot-reload and error resilience)

Stages 0 and 1 address leaks that grow with normal gameplay usage. Stages 2 and 3 address leaks that require specific timing or error conditions to manifest.

## 12. Open Questions

- Does `defineComponentSystem` in `@dojoengine/react` support returning an unsubscribe handle, or does the world object expose a system removal API? This determines whether Bug 1a requires a wrapper or can use an existing mechanism.
- Should travel effect cleanup in `onSwitchOff()` call the cleanup functions synchronously, or should it only clear the timeout handles and let the effects expire naturally? Synchronous cleanup is safer but may trigger visual artifacts if the scene is being switched to a temporary overlay.
- Is `HoverLabelManager` expected to gain Three.js resources in the future? If so, the `dispose()` method should be added proactively even if the current implementation is lightweight.
- Should `HexagonScene.shouldTriggerLightningAtCycleProgress` use a cancellation token pattern instead of storing yet another timeout handle, to align with the transition token pattern used in worldmap?
