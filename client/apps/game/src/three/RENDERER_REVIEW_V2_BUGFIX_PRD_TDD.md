# Renderer Review V2 Bugfix PRD + TDD

Status: Draft
Date: 2026-03-19
Scope: `client/apps/game/src/three`
Primary surfaces: renderer init/destroy lifecycle, WebGL post-processing ownership, shared renderer resources, WebGPU diagnostics, renderer-adjacent test quality

## 1. Summary

This document captures the second batch of issues found during a comprehensive renderer review of `client/apps/game/src/three`. These issues are distinct from the five existing bugfix streams and were verified against the current source at commit `015eb3357d`.

The review found six net-new issues grouped into five delivery stages:

- `initScene()` resumes after `await this.backendInitializationPromise` even if the renderer was destroyed during the wait, allowing GUI/listener/canvas setup to run on a dead instance
- `WebGLPostProcessRuntime.removeComposerPass()` mutates `composer.passes` directly instead of calling `EffectComposer.removePass()`, bypassing library cleanup semantics
- `GameRenderer.destroy()` clears `labelRendererElement` children but keeps `labelRenderer` and `labelRendererElement` strongly referenced
- the shared contact-shadow singleton caches GPU resources forever and has no disposal path
- the WebGPU no-op post-process controller silently drops weather color-grade updates with no diagnostics trail
- five priority tests provide weak signal because they either scan source text or assert locally re-created logic instead of runtime behavior

These stages are intentionally ordered so the highest-risk lifecycle and GPU ownership fixes land before the test-quality cleanup that should validate them behaviorally.

## 2. Problem Statement

### 2.1 `initScene()` does work after destroy

In `game-renderer.ts:762`, `initScene()` awaits `this.backendInitializationPromise` and then immediately continues into GUI setup, event-listener registration, DOM mutation, and interval creation. If `destroy()` runs while the backend promise is still pending, the instance is marked destroyed, but `initScene()` still resumes and recreates state on that dead instance.

That creates a bad race: the canvas can be reattached after teardown, controls/listeners can be rebound, and the animation loop can be restarted or kept reachable even though the owner already disposed the renderer. This is a lifecycle leak, not just an aesthetic issue.

### 2.2 Composer pass removal bypasses library cleanup

In `webgl-postprocess-runtime.ts:225-235`, `removeComposerPass()` reaches into `this.composer.passes` and manually `splice()`s the pass out of the array. `EffectComposer` exposes a public `removePass()` API specifically so pass bookkeeping stays consistent.

Manual array mutation skips composer-owned removal behavior. The likely fallout is stale `renderToScreen` bookkeeping and resources owned by the removed pass not being fully released. In practice, this is exactly the kind of "looks fine in tests, leaks in production" code path that renderer code needs to avoid.

### 2.3 CSS2D renderer references survive destroy

In `game-renderer.ts:1430-1432`, destroy currently does:

```typescript
if (this.labelRendererElement) {
  this.labelRendererElement.replaceChildren();
}
```

This empties the DOM node but leaves both `this.labelRenderer` and `this.labelRendererElement` reachable from the `GameRenderer` instance. That means the renderer-side label graph can stay retained until the entire `GameRenderer` object is garbage-collected, rather than being explicitly broken during destroy.

The existing renderer-backend lifecycle doc already covered the unresolved `waitForLabelRendererElement()` promise on destroy. This is a different leak: the promise can now resolve/reject correctly and we can still retain the label renderer tree longer than necessary.

### 2.4 Contact shadow singleton has no disposal path

`utils/contact-shadow.ts:8,44-69` caches a singleton `geometry` + `material` pair, including a lazily created `CanvasTexture`, in module scope:

```typescript
let cachedResources: ContactShadowResources | null = null;

export function getContactShadowResources(): ContactShadowResources {
  if (cachedResources) {
    return cachedResources;
  }
  // create geometry/material/texture
  cachedResources = { geometry, material };
  return cachedResources;
}
```

Because the cache never resets, those GPU resources survive for the lifetime of the module, even after the owning renderer instance is destroyed. Since both `GameRenderer` and `ArmyModel` consume this helper, the leak is shared and persistent.

### 2.5 WebGPU weather modulation disappears silently

In `webgpu-postprocess-runtime.ts:37-40`, the WebGPU runtime exposes:

```typescript
const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {},
  setVignette: () => {},
};
```

And in `setPlan()` (`webgpu-postprocess-runtime.ts:71-83`) it returns that controller to callers. The game renderer uses the controller to apply dynamic weather modulation. On the WebGPU path, those calls become silent no-ops. There is no console signal, diagnostics breadcrumb, or one-time warning explaining that the weather post-processing path is currently unsupported.

The result is poor debuggability: developers see weather state update correctly elsewhere, but the image never changes and the renderer emits no trail explaining why.

### 2.6 Priority tests currently validate text, not behavior

Five renderer-adjacent tests are high-priority cleanup candidates:

| File | Current issue |
| --- | --- |
| `client/apps/game/src/three/scenes/hexagon-scene-stage0-lifecycle.test.ts` | includes a pure no-op test (`lines 139-151`) that only assigns a field in local state; the file also recreates logic instead of hitting production seams |
| `client/apps/game/src/three/game-renderer.prewarm.test.ts` | scans `game-renderer.ts` source for method names instead of asserting runtime prewarm calls |
| `client/apps/game/src/three/game-renderer.fast-travel-registration.test.ts` | validates imports, fields, and branch text via regex rather than actual scene registration/routing behavior |
| `client/apps/game/src/three/scene-route-policy.test.ts` | mixes useful pure-function coverage with a source scan for renderer wiring |
| `client/apps/game/src/three/perf/worldmap-render-diagnostics.wiring.test.ts` | reads six source files and asserts instrumentation text exists instead of observing diagnostics calls at runtime |

These tests can all pass while the live behavior is broken. That is acceptable only as temporary scaffolding; it should not remain the long-term test boundary for renderer work.

## 3. Goals

### 3.1 Product goals

- prevent dead `GameRenderer` instances from recreating DOM and listeners after teardown
- ensure post-processing pass removal uses the renderer library's supported lifecycle path
- release renderer-owned label and contact-shadow resources during destroy
- make missing WebGPU weather post-processing visible in logs during debugging
- improve confidence in renderer regressions by replacing weak tests with behavioral ones

### 3.2 Technical goals

- add an `isDestroyed` guard immediately after `await this.backendInitializationPromise`
- replace manual pass-array mutation with `EffectComposer.removePass()`
- null out `labelRenderer` and `labelRendererElement` after DOM cleanup
- add `disposeContactShadowResources()` and call it from `GameRenderer.destroy()`
- add a one-time debug warning when the WebGPU no-op controller receives color-grade updates
- remove the no-op lifecycle assertion and convert four source-scanning tests to behavioral coverage

## 4. Non-goals

- redesigning the full `GameRenderer` initialization pipeline
- rewriting WebGL or WebGPU post-processing architecture
- adding feature parity for weather post-processing on WebGPU in this stream
- converting every source-scanning test under `src/three` in one pass
- introducing a generalized renderer resource reference-counting system

## 5. Success Metrics

### 5.1 Correctness metrics

- `initScene()` returns immediately when `destroy()` completed during backend initialization wait
- no GUI controls, listeners, canvas append, or cleanup intervals are created after that destroy race
- removing a WebGL post-process pass routes through `EffectComposer.removePass()`
- `GameRenderer.destroy()` breaks references to both the CSS2D renderer instance and its host element
- contact-shadow geometry, material map, and material are disposed and the singleton cache is cleared
- the first WebGPU weather color-grade no-op emits one debug breadcrumb and later calls stay silent
- the five priority tests assert behavior rather than source text or locally recreated logic

### 5.2 Regression metrics

- `initScene()` still proceeds normally when the renderer is alive
- WebGL post-processing pass order and visible output remain unchanged
- existing label teardown behavior (`replaceChildren()`) still occurs before references are cleared
- shared contact shadows still render correctly on a fresh renderer after prior teardown
- WebGPU post-processing remains otherwise behaviorally identical

## 6. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | `initScene()` destruction guard | Prevent dead renderer instances from resuming setup |
| 1 | EffectComposer pass removal | Use supported composer removal lifecycle |
| 2 | Renderer resource disposal | Break CSS2D references and dispose shared contact-shadow cache |
| 3 | WebGPU weather diagnostics | Expose missing weather modulation with one-time debug logging |
| 4 | Test quality improvements | Replace weak renderer-adjacent tests with behavioral coverage |

### Delivery Tracker

- [x] Stage 0: `initScene()` destruction guard
- [x] Stage 1: EffectComposer pass removal
- [x] Stage 2: Renderer resource disposal
- [x] Stage 3: WebGPU weather diagnostics
- [x] Stage 4: Test quality improvements

### Dependencies between stages

- Stages 0 through 3 are code-independent and can land separately
- Stage 2 should be validated after Stage 0 because both touch renderer teardown semantics
- Stage 4 depends only weakly on Stages 0 through 3, but it is safest to convert the tests after the runtime behavior is fixed so the new assertions target stable behavior

## 7. Detailed Stages

### 7.1 Stage 0: `initScene()` Destruction Guard

#### Objective

Stop `initScene()` from mutating the DOM or re-registering listeners when the renderer was destroyed while waiting for backend initialization.

#### Bug 0a: Missing `isDestroyed` check after backend await

**Location:** `client/apps/game/src/three/game-renderer.ts`, line 762

**Current code:**

```typescript
async initScene() {
  await this.backendInitializationPromise;
  this.setupGUIControls();
  this.setupListeners();

  document.body.style.background = "black";
  const existingCanvas = document.getElementById("main-canvas");
  // ...
}
```

If `destroy()` runs while `backendInitializationPromise` is unresolved, the method still resumes into `setupGUIControls()`, `setupListeners()`, body-style mutation, canvas append, cleanup interval setup, and the rest of scene boot. The instance is logically dead, but the side effects still occur.

**Fix:** Guard immediately after the await:

```typescript
async initScene() {
  await this.backendInitializationPromise;
  if (this.isDestroyed) {
    return;
  }

  this.setupGUIControls();
  this.setupListeners();
  // ...
}
```

This is the correct seam because it stops all downstream init work with a single branch at the moment the async race resolves.

#### Files to change

- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/game-renderer.lifecycle.test.ts`

#### TDD plan

Write tests first:

1. add a test that keeps `backendInitializationPromise` pending, calls `destroy()`, then resolves the promise and verifies `setupGUIControls()` and `setupListeners()` were not called
2. add a test that verifies no new canvas is appended after the promise resolves on a destroyed instance
3. add a test that verifies no cleanup interval is registered in the destroyed-after-await path
4. add a regression test that when `isDestroyed` is false, `initScene()` still performs the normal setup path

Implementation steps:

1. add `if (this.isDestroyed) return;` immediately after the backend await
2. keep the rest of `initScene()` unchanged so the fix remains minimal and localized
3. verify any pending lifecycle tests still pass with the new early-return path

Exit criteria:

- dead instances never re-run init side effects after backend initialization finishes
- live instances still initialize normally
- `pnpm --dir client/apps/game test -- src/three/game-renderer.lifecycle.test.ts` passes

### 7.2 Stage 1: EffectComposer Pass Removal

#### Objective

Use the official composer API for pass removal so post-processing teardown follows library-managed cleanup and bookkeeping rules.

#### Bug 1a: Manual `passes.splice()` bypasses `EffectComposer.removePass()`

**Location:** `client/apps/game/src/three/webgl-postprocess-runtime.ts`, lines 225-235

**Current code:**

```typescript
private removeComposerPass(pass: unknown): void {
  const passes = (this.composer as unknown as { passes?: unknown[] }).passes;
  if (!passes) {
    return;
  }

  const index = passes.indexOf(pass);
  if (index !== -1) {
    passes.splice(index, 1);
  }
}
```

This treats the composer internals as a plain array. That works only if the array shape never changes and if no removal side effects are required. `EffectComposer` already exposes `removePass()` because those assumptions are not safe.

**Fix:** Import `Pass` from `postprocessing` and delegate to the composer:

```typescript
import {
  EffectComposer,
  EffectPass,
  Pass,
  RenderPass,
  // ...
} from "postprocessing";

private removeComposerPass(pass: unknown): void {
  this.composer.removePass(pass as Pass);
}
```

That keeps ownership and cleanup logic inside the library instead of duplicating it at the call site.

#### Files to change

- `client/apps/game/src/three/webgl-postprocess-runtime.ts`
- `client/apps/game/src/three/webgl-postprocess-runtime.test.ts`

#### TDD plan

Write tests first:

1. extend the mocked `EffectComposer` in `webgl-postprocess-runtime.test.ts` to expose `removePass`
2. add a test that verifies removing an effect pass calls `composer.removePass()` exactly once with the pass instance
3. add a regression test that removing a missing or already-removed pass does not throw
4. add a regression test that normal rendering still uses the composer after pass removal support is added

Implementation steps:

1. import `Pass` alongside the existing postprocessing types
2. replace the manual pass-array mutation with `this.composer.removePass(pass as Pass)`
3. keep runtime behavior otherwise unchanged

Exit criteria:

- pass removal routes through the public composer API
- the runtime no longer reaches into `composer.passes`
- `pnpm --dir client/apps/game test -- src/three/webgl-postprocess-runtime.test.ts` passes

### 7.3 Stage 2: Renderer Resource Disposal

#### Objective

Tighten renderer teardown by releasing CSS2D renderer references and disposing the shared contact-shadow cache.

#### Bug 2a: `labelRenderer` and host element stay reachable after destroy

**Location:** `client/apps/game/src/three/game-renderer.ts`, lines 1430-1432

**Current code:**

```typescript
if (this.labelRendererElement) {
  this.labelRendererElement.replaceChildren();
}
```

This clears DOM children but does not break the `GameRenderer` references that retain the CSS2D renderer and its root element. Since the class uses definite-assignment fields (`private labelRenderer!: CSS2DRenderer;` and `private labelRendererElement!: HTMLDivElement;`), explicit teardown should mirror that ownership rather than rely on eventual whole-object collection.

**Fix:** Clear the node, then break the references:

```typescript
if (this.labelRendererElement) {
  this.labelRendererElement.replaceChildren();
  this.labelRenderer = undefined!;
  this.labelRendererElement = undefined!;
}
```

#### Bug 2b: Shared contact-shadow cache is never disposed

**Locations:**

- `client/apps/game/src/three/utils/contact-shadow.ts`, lines 8 and 44-69
- `client/apps/game/src/three/game-renderer.ts`, destroy path

**Current code in helper:**

```typescript
let cachedResources: ContactShadowResources | null = null;

export function getContactShadowResources(): ContactShadowResources {
  if (cachedResources) {
    return cachedResources;
  }
  // allocate geometry/material/texture once
  cachedResources = { geometry, material };
  return cachedResources;
}
```

The singleton owns GPU-backed objects but exposes no disposal entry point. Once allocated, the cache lives until module unload.

**Fix:** Add explicit cache disposal and call it from `GameRenderer.destroy()`:

```typescript
export function disposeContactShadowResources(): void {
  if (!cachedResources) {
    return;
  }

  cachedResources.geometry.dispose();
  cachedResources.material.map?.dispose();
  cachedResources.material.dispose();
  cachedResources = null;
}
```

Then in `GameRenderer.destroy()`:

```typescript
disposeContactShadowResources();
```

This makes the cache lifecycle explicit. If future multi-renderer support requires concurrent instances, that can evolve into reference counting later; for the current single-renderer lifecycle, explicit destroy is the right fix.

#### Files to change

- `client/apps/game/src/three/game-renderer.ts`
- `client/apps/game/src/three/game-renderer.lifecycle.test.ts`
- `client/apps/game/src/three/utils/contact-shadow.ts`
- `client/apps/game/src/three/utils/contact-shadow.test.ts`

#### TDD plan

Write tests first:

1. extend `game-renderer.lifecycle.test.ts` to verify `destroy()` clears `labelRendererElement` children and then sets both renderer references to `undefined`
2. add a test that `destroy()` invokes `disposeContactShadowResources()` exactly once
3. add a focused `contact-shadow` helper test that allocates cached resources, calls `disposeContactShadowResources()`, and verifies geometry/material/map disposal plus cache reset
4. add a regression test that `getContactShadowResources()` can allocate again after disposal and returns fresh objects
5. verify repeated `destroy()` remains idempotent when contact-shadow disposal already ran

Implementation steps:

1. add `disposeContactShadowResources()` to `utils/contact-shadow.ts`
2. import and call it from `GameRenderer.destroy()`
3. break `labelRenderer` / `labelRendererElement` references after `replaceChildren()`

Exit criteria:

- CSS2D renderer references are broken during destroy
- contact-shadow resources are explicitly disposed and re-creatable
- `pnpm --dir client/apps/game test -- src/three/game-renderer.lifecycle.test.ts`
- `pnpm --dir client/apps/game test -- src/three/utils/contact-shadow.test.ts`

### 7.4 Stage 3: WebGPU Weather Diagnostics

#### Objective

Add a lightweight diagnostics breadcrumb so developers can see that WebGPU weather color grading is currently unsupported instead of failing silently.

#### Bug 3a: WebGPU no-op controller drops weather updates with zero trace

**Location:** `client/apps/game/src/three/webgpu-postprocess-runtime.ts`, lines 37-40 and 71-83

**Current code:**

```typescript
const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {},
  setVignette: () => {},
};

setPlan(plan: RendererPostProcessPlan): RendererPostProcessController {
  this.plan = { ... };
  this.rebuildOutputNode();

  return NOOP_POST_PROCESS_CONTROLLER;
}
```

On WebGPU, the runtime accepts the plan but returns a controller that silently discards later `setColorGrade()` calls. Weather modulation depends on those calls. The absence of any breadcrumb makes this look like a bug elsewhere in the weather stack.

**Fix:** Add a module-scoped one-time warning for `setColorGrade()`:

```typescript
let weatherNoopWarned = false;

const NOOP_POST_PROCESS_CONTROLLER: RendererPostProcessController = {
  setColorGrade: () => {
    if (!weatherNoopWarned) {
      weatherNoopWarned = true;
      console.debug("[WebGPUPostProcessRuntime] Weather color grading is not implemented on this controller");
    }
  },
  setVignette: () => {},
};
```

`console.debug` is the right level here: it is useful during renderer debugging, but not a user-facing warning. The guard ensures it only appears once per module load.

#### Files to change

- `client/apps/game/src/three/webgpu-postprocess-runtime.ts`
- `client/apps/game/src/three/webgpu-postprocess-runtime.test.ts`

#### TDD plan

Write tests first:

1. add a test that obtains the controller from `setPlan()`, calls `setColorGrade()` multiple times, and verifies `console.debug` fires exactly once
2. add a regression test that repeated `setVignette()` calls do not emit debug output
3. add a regression test that the runtime still renders normally after the warning path is added
4. isolate module state in the test (`vi.resetModules()` or equivalent) so the one-time flag is deterministic

Implementation steps:

1. add a module-scoped `weatherNoopWarned` flag
2. implement the guarded `console.debug()` in `setColorGrade()`
3. leave `setVignette()` silent unless a concrete unsupported-vignette diagnostic is later needed

Exit criteria:

- the first dropped weather color-grade update emits a single debug breadcrumb
- subsequent updates stay quiet
- `pnpm --dir client/apps/game test -- src/three/webgpu-postprocess-runtime.test.ts` passes

### 7.5 Stage 4: Test Quality Improvements

#### Objective

Replace the highest-priority weak renderer tests with behavioral coverage that fails for real regressions.

#### Bug 4a: Priority tests assert implementation text or synthetic local logic

**Locations:**

- `client/apps/game/src/three/scenes/hexagon-scene-stage0-lifecycle.test.ts`
- `client/apps/game/src/three/game-renderer.prewarm.test.ts`
- `client/apps/game/src/three/game-renderer.fast-travel-registration.test.ts`
- `client/apps/game/src/three/scene-route-policy.test.ts`
- `client/apps/game/src/three/perf/worldmap-render-diagnostics.wiring.test.ts`

**Current state:**

The problem is not that these tests are incomplete. The problem is that several of them can succeed without executing the production behavior at all. The most obvious case is `hexagon-scene-stage0-lifecycle.test.ts:139-151`, which only assigns a mock texture into a local object and asserts the assignment happened. That is a pure no-op test.

The four source-scanning tests are similar in spirit: they verify that certain strings exist in source files. That protects naming and text layout, not behavior.

**Fix:** Convert each file to runtime assertions:

| File | Behavioral replacement |
| --- | --- |
| `scenes/hexagon-scene-stage0-lifecycle.test.ts` | delete the no-op `groundMeshTexture` assignment test; keep only assertions that hit production seams or extracted helpers with real disposal/timer side effects |
| `game-renderer.prewarm.test.ts` | execute renderer setup or a focused helper seam and assert `requestRendererScenePrewarm()` is called for the expected scene surfaces |
| `game-renderer.fast-travel-registration.test.ts` | instantiate a harnessed `GameRenderer` with fast travel enabled/disabled and assert scene-manager registration, route gating, and render/update behavior |
| `scene-route-policy.test.ts` | keep the pure resolver tests, replace the renderer wiring scan with a behavioral test around route handling through the navigation boundary |
| `perf/worldmap-render-diagnostics.wiring.test.ts` | mock diagnostics recorders and exercise worldmap/manager seams to observe counters and timers being emitted at runtime |

Where a test is currently blocked by missing seams, extract a small helper or inject a dependency. Do not replace one source scan with another source scan.

#### Files to change

- `client/apps/game/src/three/scenes/hexagon-scene-stage0-lifecycle.test.ts`
- `client/apps/game/src/three/game-renderer.prewarm.test.ts`
- `client/apps/game/src/three/game-renderer.fast-travel-registration.test.ts`
- `client/apps/game/src/three/scene-route-policy.test.ts`
- `client/apps/game/src/three/perf/worldmap-render-diagnostics.wiring.test.ts`
- small harness/helper files only if needed to expose production seams

#### TDD plan

Write tests first in the sense of replacing the weak assertion with a behavioral one before deleting the old coverage:

1. remove the pure no-op lifecycle test only after the remaining file has at least one real production-seam assertion covering the underlying contract
2. replace `game-renderer.prewarm.test.ts` regex checks with invocation assertions around the live renderer/harness path
3. replace `game-renderer.fast-travel-registration.test.ts` regex checks with enable/disable and route-resolution behavior
4. replace the wiring scan in `scene-route-policy.test.ts` with a route-handling behavior test
5. replace source scans in `worldmap-render-diagnostics.wiring.test.ts` with runtime recorder assertions, even if that requires a small injectable diagnostics seam

Implementation steps:

1. delete lines 139-151 in `hexagon-scene-stage0-lifecycle.test.ts`
2. remove `readFileSync`-driven assertions from the four priority source-scanning tests
3. add or reuse harnesses instead of reading source files from disk
4. keep the scope intentionally narrow to these five files; the broader source-scan cleanup remains a separate initiative

Exit criteria:

- none of the five priority tests depend on source-text scanning
- the no-op lifecycle assertion is removed
- each replacement test fails if the underlying runtime behavior regresses
- `pnpm --dir client/apps/game test -- src/three/game-renderer.prewarm.test.ts`
- `pnpm --dir client/apps/game test -- src/three/game-renderer.fast-travel-registration.test.ts`
- `pnpm --dir client/apps/game test -- src/three/scene-route-policy.test.ts`
- `pnpm --dir client/apps/game test -- src/three/perf/worldmap-render-diagnostics.wiring.test.ts`
- `pnpm --dir client/apps/game test -- src/three/scenes/hexagon-scene-stage0-lifecycle.test.ts`

## 8. Testing Strategy Summary

Every stage should follow the same delivery pattern:

1. replace the weakest assertion first with a failing behavioral test
2. implement the minimum code change that satisfies the new behavior
3. run the targeted suite for the touched area
4. rerun adjacent lifecycle/post-process tests when the change touches shared renderer seams

Required test commands per stage:

- Stage 0: `pnpm --dir client/apps/game test -- src/three/game-renderer.lifecycle.test.ts`
- Stage 1: `pnpm --dir client/apps/game test -- src/three/webgl-postprocess-runtime.test.ts`
- Stage 2: `pnpm --dir client/apps/game test -- src/three/game-renderer.lifecycle.test.ts` and `pnpm --dir client/apps/game test -- src/three/utils/contact-shadow.test.ts`
- Stage 3: `pnpm --dir client/apps/game test -- src/three/webgpu-postprocess-runtime.test.ts`
- Stage 4: run the five priority files listed in Stage 4, plus any small harness/helper suites introduced to support them

Recommended broader regression pass after all stages:

- `pnpm --dir client/apps/game test -- src/three/game-renderer.runtime.test.ts`
- `pnpm --dir client/apps/game test -- src/three/game-renderer.backend.test.ts`
- `pnpm --dir client/apps/game test -- src/three/renderer-backend-compat.test.ts`

## 9. Risks and Mitigations

- Risk: returning early from `initScene()` could skip cleanup that some callers assumed would always run.
  Mitigation: the guard is placed before any new setup work occurs. A destroyed renderer should not proceed with init side effects; that is the correct contract.

- Risk: `EffectComposer.removePass()` semantics may differ slightly from direct array mutation in existing mocks.
  Mitigation: update the test mock to model the public API rather than internals. The production runtime should follow the library contract, not the current mock.

- Risk: disposing the shared contact-shadow cache in `GameRenderer.destroy()` could be too aggressive if multiple live renderer instances are introduced later.
  Mitigation: the current app model is a single active renderer. If concurrent instances become real, this helper can evolve into ref-counting in a follow-up without invalidating the explicit disposal seam added here.

- Risk: a one-time `console.debug()` could become noisy in watch mode if modules are frequently reloaded.
  Mitigation: the log level is `debug`, not `warn`, and the module-scoped guard still limits it to once per module instantiation.

- Risk: converting source-scanning tests to behavioral tests may require exposing small seams that slightly reshape code.
  Mitigation: prefer tiny harness/helper extractions at existing call boundaries. Do not broaden Stage 4 into a general test-framework refactor.

## 10. Cross-References

This document is intentionally separate from the five existing bugfix PRDs:

- `RENDERER_REVIEW_BUGFIX_PRD_TDD.md` covered canvas-id ordering, animate fallthrough, prewarm `compileAsync` binding, weather baseline capture, diagnostics immutability, fallback timing, and duplicate WebGPU sizing. It did not cover post-await destroy races, composer removal semantics, CSS2D/contact-shadow disposal, or WebGPU weather diagnostics.
- `RENDERER_BACKEND_BUGFIX_PRD_TDD.md` Stage 2 covered `waitForLabelRendererElement()` never settling on destroy and GUI access before renderer assignment. It did not cover `initScene()` resuming after backend await or renderer-owned reference clearing in destroy.
- `SCENE_LIFECYCLE_BUGFIX_PRD_TDD.md` covered scene-owned timers, subscriptions, manager disposal, and scene-side label cleanup. It did not cover renderer-owned CSS2D teardown or module-scoped contact-shadow disposal.
- `PERFORMANCE_HOTPATH_BUGFIX_PRD_TDD.md` covered hot-path waste and visual correctness, not post-processing teardown or renderer diagnostics breadcrumbs.
- `CHUNKING_STREAMING_BUGFIX_PRD_TDD.md` covers traversal/chunking behavior only.

### Existing coverage boundary confirmed

The six issues in this document were checked against all five existing PRDs and are not duplicates. The closest adjacent existing items are:

- backend lifecycle promise settlement on destroy (`RENDERER_BACKEND`), which is adjacent to but distinct from Stage 0 here
- scene-owned hover-label disposal (`SCENE_LIFECYCLE`), which is adjacent to but distinct from Stage 2 here
- broad source-scan debt called out as systemic in the earlier renderer review, whereas Stage 4 here narrows that debt into five immediately actionable files

### Test suite scope boundary

This document does not attempt to eliminate all source-scanning tests under `src/three`. It prioritizes the five highest-signal files closest to renderer lifecycle, routing, and diagnostics behavior. The wider test-suite cleanup remains a separate initiative after these targeted replacements land.
