# Renderer Review Bugfix PRD + TDD

Status: Draft
Date: 2026-03-18
Scope: `client/apps/game/src/three`
Primary surfaces: game renderer lifecycle, canvas management, scene animation loop, WebGPU prewarm policy, weather post-processing, diagnostics state, renderer backend initialization

## 1. Summary

This document captures bugs and inconsistencies found during a comprehensive deep review of the `three/` rendering subsystem. Each issue has been verified against the current source at commit `4fc8c52c7`. The bugs fall into five independent stages ordered by severity and user impact.

The core findings are:

- the hover-hex material `setTime` still triggers a full 128x128 CPU texture redraw every call despite the texture computation never reading the `time` uniform — wasting ~1M pixel ops/sec (cross-referenced with PERFORMANCE_HOTPATH_BUGFIX_PRD_TDD.md Stage 0, still unfixed)
- the canvas duplicate-removal check in `initScene` assigns the `id` to the new element before searching for an existing one, so the old canvas from a prior instance is never found or removed
- the `animate()` loop falls through to updating and rendering the hexception scene when no scene is active (during startup, transitions, or after failed setup)
- `requestRendererScenePrewarm` extracts `compileAsync` from the renderer as an unbound function reference, losing `this` context on real WebGPU renderer instances
- weather post-processing base values are captured using a fragile `saturation === 0` sentinel that breaks when saturation is legitimately zero or after GUI adjustment
- two diagnostics setters mutate module state in-place while all other setters replace the state object immutably
- the WebGPU fallback path in `renderer-backend-loader` records `initTimeMs: 0` for diagnostics, masking the actual initialization time
- `setPixelRatio` and `setSize` are called twice during WebGPU backend initialization (once in the factory, once in `initialize()`)

## 2. Problem Statement

### 2.1 Canvas duplicate-removal ordering

In `game-renderer.ts:766-773`, the `id` attribute is assigned to the new canvas element before the code searches for an existing canvas by that same id. If a previous `GameRenderer` instance left a canvas in the DOM (e.g., after incomplete cleanup during navigation), the `getElementById` call finds the new element (which now bears the id) rather than the old one. The old canvas remains in the DOM, causing a memory leak and potential rendering conflicts when both are visible.

### 2.2 Animate loop scene fallthrough

In `game-renderer.ts:1279-1287`, the scene update/render logic uses an `if/else if/else` chain where the `else` branch unconditionally updates `hexceptionScene`. When `sceneManager.getCurrentScene()` returns `undefined` — which happens during startup before the first scene transition completes (line 842 starts `animate()` immediately), during async transitions, or after a failed `setup()` — the hexception scene is updated and rendered even though it has not been initialized. This can produce visual artifacts or errors from uninitialized state.

### 2.3 Unbound `compileAsync` in scene prewarm

In `webgpu-postprocess-policy.ts:76-84`, the `compileAsync` method is extracted from the renderer as a plain property reference and called without binding:

```typescript
const compileAsync = (renderer as ...)?.compileAsync;
await compileAsync(scene, camera);
```

For real WebGPU renderer instances (class instances), `compileAsync` accesses `this` internally to reach the backend. Calling it unbound will throw at runtime. The test does not catch this because it uses a plain mock object where `this` binding is irrelevant.

### 2.4 Weather base-value capture sentinel

In `game-renderer.ts:1151-1157`, base post-processing values are captured using `if (this.basePostProcessingValues.saturation === 0)`. This sentinel has two failure modes:

1. If `postProcessingConfig.saturation` is legitimately `0.0` (neutral saturation), the condition is true on every frame, and base values are re-captured every call — wasting work and preventing the baseline from being locked.
2. After GUI adjustment changes `postProcessingConfig.saturation` to a non-zero value, the condition becomes false, and the new user-adjusted saturation is never saved as the baseline. Weather modulation is then applied relative to the original value rather than the user's adjustment.

### 2.5 Diagnostics state mutation inconsistency

In `renderer-diagnostics.ts:111-118`, `setRendererDiagnosticCapabilities` and `setRendererDiagnosticDegradations` mutate `rendererDiagnosticsState` in-place:

```typescript
rendererDiagnosticsState.capabilities = { ...capabilities };
rendererDiagnosticsState.degradations = degradations.map(...);
```

Every other setter in this module replaces the state object via spread (`rendererDiagnosticsState = { ...rendererDiagnosticsState, ... }`). The inconsistency means code that holds a reference to the old state object will see unexpected mutations from these two setters but not from any others.

### 2.6 Fallback initTimeMs always zero

In `renderer-backend-loader.ts:54-59`, when WebGPU initialization fails and falls back to legacy WebGL, `createRendererInitDiagnostics` is called without providing `initTimeMs`. The factory function defaults to `0`. The actual time spent initializing the legacy backend is lost. The test at line 63 asserts `initTimeMs: 0`, locking in the broken behavior.

### 2.7 Duplicate setPixelRatio/setSize in WebGPU init

In `webgpu-renderer-backend.ts`, `createDefaultWebGPURenderer` (lines 90-91) calls `setPixelRatio` and `setSize`, and then `initialize()` (lines 262-263) calls them again on the same renderer before `init()`. This is wasted work and creates two divergable call sites.

## 3. Goals

### 3.1 Product goals

- prevent canvas memory leaks on navigation cycles
- eliminate visual artifacts from rendering an uninitialized scene during startup
- ensure WebGPU scene prewarm compilation works on real renderer instances
- make weather post-processing modulation stable after GUI adjustments
- maintain consistent diagnostics state mutation patterns
- provide accurate initialization timing on fallback paths
- remove redundant initialization calls in WebGPU boot

### 3.2 Technical goals

- reorder canvas id assignment and duplicate check in `initScene`
- add a scene guard in `animate()` before the update/render block
- bind `compileAsync` to the renderer before calling it
- replace the `saturation === 0` sentinel with a dedicated `initialized` flag
- make all diagnostics setters use immutable state replacement
- capture and forward `initTimeMs` on the fallback path
- remove duplicate `setPixelRatio`/`setSize` call in `initialize()`

## 4. Non-goals

- redesigning the canvas lifecycle or adopting off-screen canvas
- changing the scene transition state machine
- modifying the Three.js WebGPU renderer prewarm API
- overhauling the weather system architecture
- replacing the diagnostics module with a reactive state library
- changing the WebGPU renderer factory interface

## 5. Success Metrics

### 5.1 Correctness metrics

- `getElementById("main-canvas")` finds and removes the old canvas before the new one claims the id
- `animate()` does not call `hexceptionScene.update()` when `getCurrentScene()` is `undefined`
- `requestRendererScenePrewarm` calls `compileAsync` with correct `this` binding
- weather base values are captured exactly once and not re-captured on subsequent calls or after GUI changes
- all diagnostics setters produce a new state object reference
- fallback `initTimeMs` reflects the actual legacy backend initialization time
- `setPixelRatio`/`setSize` are called exactly once during WebGPU initialization

### 5.2 Regression metrics

- no visual changes to existing scene rendering
- no behavior change in `animate()` when a scene IS active
- no change to prewarm behavior when renderer is undefined (still no-ops)
- existing weather modulation visual output is preserved
- diagnostics window updates still fire on every setter call

## 6. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | Game renderer lifecycle safety | Fix canvas leak and animate fallthrough |
| 1 | WebGPU prewarm binding | Fix unbound compileAsync call |
| 2 | Weather post-processing stability | Fix base-value capture sentinel |
| 3 | Diagnostics and metrics fidelity | Fix state mutation inconsistency and initTimeMs |
| 4 | WebGPU init deduplication | Remove redundant setPixelRatio/setSize |

### Delivery Tracker

- [x] Stage 0: Game renderer lifecycle safety
- [x] Stage 1: WebGPU prewarm binding
- [x] Stage 2: Weather post-processing stability
- [x] Stage 3: Diagnostics and metrics fidelity
- [x] Stage 4: WebGPU init deduplication

### Dependencies between stages

- All stages are independent — they touch different functions and files
- Stage 0 is highest priority (user-visible canvas leak and startup artifacts)
- Stage 1 is high priority (runtime crash on real WebGPU devices)
- Stage 2 is medium priority (visual drift after GUI interaction)
- Stage 3 is lower priority (metrics and code consistency)
- Stage 4 is lowest priority (performance polish)

## 7. Detailed Stages

### 7.1 Stage 0: Game Renderer Lifecycle Safety

#### Objective

Fix the canvas duplicate-removal ordering bug and the animate loop scene fallthrough to prevent canvas memory leaks and startup rendering artifacts.

#### Bug 0a: Canvas id assigned before duplicate check

**Location:** `client/apps/game/src/three/game-renderer.ts`, lines 766-776

**Current code:**
```typescript
this.renderer.domElement.id = "main-canvas";  // assigns id to new canvas

const existingCanvas = document.getElementById("main-canvas");  // finds new canvas, not old
if (existingCanvas) {
  existingCanvas.remove();  // removes the new canvas it just created
}

document.body.appendChild(this.renderer.domElement);
```

When a previous `GameRenderer` instance's canvas is still in the DOM (the prior instance wasn't `destroy()`ed cleanly or the component unmounted without cleanup), the new element claims the id first, so `getElementById` either finds the new element itself (if already connected) or misses the old one (if it retained the id from its own assignment). The old canvas leaks.

**Fix:** Search for and remove the existing canvas BEFORE assigning the id to the new element:

```typescript
// Remove stale canvas from a previous instance BEFORE claiming the id
const existingCanvas = document.getElementById("main-canvas");
if (existingCanvas) {
  console.warn("[GameRenderer] Found existing canvas, removing it to prevent memory leak");
  existingCanvas.remove();
}

this.renderer.domElement.id = "main-canvas";
document.body.appendChild(this.renderer.domElement);
```

#### Bug 0b: `animate()` falls through to hexception when no scene is active

**Location:** `client/apps/game/src/three/game-renderer.ts`, lines 1279-1297

**Current code:**
```typescript
const isWorldMap = this.sceneManager?.getCurrentScene() === SceneName.WorldMap;
const isFastTravel = this.sceneManager?.getCurrentScene() === SceneName.FastTravel && Boolean(this.fastTravelScene);
if (isWorldMap) {
  this.worldmapScene.update(deltaTime);
} else if (isFastTravel && this.fastTravelScene) {
  this.fastTravelScene.update(deltaTime);
} else {
  this.hexceptionScene.update(deltaTime);  // runs when getCurrentScene() is undefined
}
```

The `else` branch catches every state that isn't `WorldMap` or `FastTravel`, including `undefined`. During startup (lines 839-842 call `prepareScenes()`, `handleURLChange()`, then `animate()` synchronously — but the first scene transition is async involving fade-out and setup), the scene is `undefined` for multiple frames.

**Fix:** Add an early guard for the undefined-scene case:

```typescript
const currentScene = this.sceneManager?.getCurrentScene();
if (!currentScene) {
  // No scene active yet (startup, transition, or failed setup).
  // Still render HUD and overlays, but skip game scene update/render.
  this.hudScene.update(deltaTime, cycleProgress);
  renderRendererBackendFrame(this.backend, {
    mainCamera: this.camera,
    mainScene: this.hexceptionScene.getScene(), // empty scene as placeholder
    overlayPasses: [{
      camera: this.hudScene.getCamera(),
      name: "hud",
      scene: this.hudScene.getScene(),
    }],
    sceneName: undefined,
  });
  return;
}
```

Alternatively, a simpler approach if full HUD rendering during transition is not needed:

```typescript
const currentScene = this.sceneManager?.getCurrentScene();
if (!currentScene) return; // skip frame entirely, transition overlay covers the gap
```

The appropriate approach depends on whether the fade overlay needs the HUD to render during transitions. Verify with the transition manager's fade behavior.

#### Files to change

- `client/apps/game/src/three/game-renderer.ts`

#### TDD plan

Write tests first:

1. add a test that verifies `getElementById("main-canvas")` is called before `this.renderer.domElement.id` is set — use a spy on `document.getElementById` and verify the canvas element does not yet have the id when the spy fires
2. add a test that when a stale canvas with `id="main-canvas"` exists in the DOM, `initScene` removes it before appending the new one
3. add a test that when `sceneManager.getCurrentScene()` returns `undefined`, `hexceptionScene.update()` is NOT called during `animate()`
4. add a test that when `sceneManager.getCurrentScene()` returns `SceneName.Hexception`, `hexceptionScene.update()` IS called (regression guard)
5. add a test that when `sceneManager.getCurrentScene()` returns `SceneName.WorldMap`, `worldmapScene.update()` is called and `hexceptionScene.update()` is not

Implementation steps:

1. in `initScene`, move the `getElementById` check and `remove()` before the `id` assignment
2. in the `animate()` method, add a guard checking `currentScene` before the scene update/render block
3. decide whether to skip the frame entirely or render a minimal pipeline during the undefined-scene window

Exit criteria:

- stale canvases are correctly identified and removed on re-initialization
- no hexception scene updates occur when no scene is active
- existing scene routing behavior is preserved when a scene IS active
- `pnpm --dir client/apps/game test -- src/three/game-renderer` passes

### 7.2 Stage 1: WebGPU Prewarm Binding

#### Objective

Fix the unbound `compileAsync` call in `requestRendererScenePrewarm` that will throw on real WebGPU renderer class instances.

#### Bug 1a: `compileAsync` extracted without `this` binding

**Location:** `client/apps/game/src/three/webgpu-postprocess-policy.ts`, lines 76-84

**Current code:**
```typescript
export async function requestRendererScenePrewarm(
  renderer: RendererSurfaceLike | undefined,
  scene: Object3D,
  camera: Camera,
): Promise<void> {
  const compileAsync = (renderer as RendererSurfaceLike & {
    compileAsync?: (scene: Object3D, camera: Camera) => Promise<void>;
  } | undefined)?.compileAsync;

  if (typeof compileAsync !== "function") {
    return;
  }

  await compileAsync(scene, camera);  // unbound — `this` is undefined inside
}
```

The `compileAsync` method is extracted as a plain function reference. When called without the renderer as `this`, any internal `this.backend` or `this.renderer` access within the Three.js implementation will throw `TypeError: Cannot read properties of undefined`.

Tests pass because mocks use plain objects (`{ compileAsync: vi.fn() }`) where `this` binding is irrelevant.

**Fix:** Call the method through the renderer object directly:

```typescript
export async function requestRendererScenePrewarm(
  renderer: RendererSurfaceLike | undefined,
  scene: Object3D,
  camera: Camera,
): Promise<void> {
  const rendererWithCompile = renderer as RendererSurfaceLike & {
    compileAsync?: (scene: Object3D, camera: Camera) => Promise<void>;
  } | undefined;

  if (typeof rendererWithCompile?.compileAsync !== "function") {
    return;
  }

  await rendererWithCompile.compileAsync(scene, camera);
}
```

#### Files to change

- `client/apps/game/src/three/webgpu-postprocess-policy.ts`

#### TDD plan

Write tests first:

1. add a test that creates a mock renderer as a class instance (using `Object.create` with a prototype method) where `compileAsync` reads `this.backend` — verify that `requestRendererScenePrewarm` does not throw and `compileAsync` receives the correct `this`
2. add a test that verifies `requestRendererScenePrewarm` still no-ops when `renderer` is `undefined` (regression guard)
3. add a test that verifies `requestRendererScenePrewarm` still no-ops when `compileAsync` is not present on the renderer (regression guard)
4. add a test that verifies the scene and camera are passed through correctly

Implementation steps:

1. replace the function-extraction pattern with a method call through the typed renderer reference
2. update the test mock if needed to verify the binding behavior

Exit criteria:

- `compileAsync` is called with correct `this` binding on class-based renderer instances
- no behavioral change for undefined or non-WebGPU renderers
- `pnpm --dir client/apps/game test -- src/three/webgpu-postprocess-policy.test.ts` passes

### 7.3 Stage 2: Weather Post-Processing Stability

#### Objective

Replace the fragile `saturation === 0` sentinel for weather base-value capture with a dedicated `initialized` flag that is set exactly once and is not affected by GUI changes.

#### Bug 2a: Weather base values re-captured or never updated after GUI change

**Location:** `client/apps/game/src/three/game-renderer.ts`, lines 1151-1157

**Current code:**
```typescript
if (this.basePostProcessingValues.saturation === 0 && this.postProcessingConfig) {
  this.basePostProcessingValues.saturation = this.postProcessingConfig.saturation;
  this.basePostProcessingValues.contrast = this.postProcessingConfig.contrast;
  this.basePostProcessingValues.brightness = this.postProcessingConfig.brightness;
  this.basePostProcessingValues.vignetteDarkness = this.postProcessingConfig.vignette.darkness;
}
```

The `saturation === 0` check is used as a proxy for "not yet initialized." This fails when:

1. `postProcessingConfig.saturation` is legitimately `0.0` — the condition remains true every frame, re-capturing values every call
2. after a GUI slider adjusts saturation away from 0 — the condition becomes false, and the updated value from the GUI is never saved as the new baseline. Weather modulation is then applied relative to the stale original, not the user's adjustment

**Fix:** Add a dedicated initialization flag:

```typescript
// In the class properties:
private weatherBaseValuesInitialized = false;

// In updateWeatherPostProcessing():
if (!this.weatherBaseValuesInitialized && this.postProcessingConfig) {
  this.basePostProcessingValues.saturation = this.postProcessingConfig.saturation;
  this.basePostProcessingValues.contrast = this.postProcessingConfig.contrast;
  this.basePostProcessingValues.brightness = this.postProcessingConfig.brightness;
  this.basePostProcessingValues.vignetteDarkness = this.postProcessingConfig.vignette.darkness;
  this.weatherBaseValuesInitialized = true;
}
```

#### Files to change

- `client/apps/game/src/three/game-renderer.ts`

#### TDD plan

Write tests first:

1. add a test that verifies base values are captured on the first call to `updateWeatherPostProcessing` regardless of the initial saturation value (including `0.0`)
2. add a test that verifies base values are NOT re-captured on subsequent calls — change `postProcessingConfig.saturation` between calls and verify the base value is unchanged
3. add a test that verifies weather modulation is applied relative to the captured baseline, not the current config value (regression guard for the modulation math)

Implementation steps:

1. add `private weatherBaseValuesInitialized = false` to the `GameRenderer` class
2. replace the `saturation === 0` check with `!this.weatherBaseValuesInitialized`
3. set `this.weatherBaseValuesInitialized = true` after capturing base values
4. reset the flag in `destroy()` if the weather system needs re-initialization on remount

Exit criteria:

- base values are captured exactly once, regardless of saturation value
- GUI adjustments to saturation do not affect the captured baseline
- weather modulation produces consistent results across frames
- `pnpm --dir client/apps/game test -- src/three/game-renderer` passes

### 7.4 Stage 3: Diagnostics and Metrics Fidelity

#### Objective

Fix two independent issues: make all diagnostics setters use consistent immutable state replacement, and capture actual `initTimeMs` on the fallback path.

#### Bug 3a: In-place mutation in diagnostics setters

**Location:** `client/apps/game/src/three/renderer-diagnostics.ts`, lines 111-118

**Current code:**
```typescript
export function setRendererDiagnosticCapabilities(capabilities: RendererBackendCapabilities): void {
  rendererDiagnosticsState.capabilities = { ...capabilities };  // mutates in-place
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticDegradations(degradations: RendererFeatureDegradation[]): void {
  rendererDiagnosticsState.degradations = degradations.map((d) => ({ ...d }));  // mutates in-place
  syncRendererDiagnosticsWindow();
}
```

Every other setter in this module (`markRendererDiagnosticDeviceLost` at line 92, `recordRendererDiagnosticUncapturedError` at line 104, `syncRendererBackendDiagnostics` at line 79) replaces the entire state object:

```typescript
rendererDiagnosticsState = {
  ...rendererDiagnosticsState,
  // updated fields
};
```

The in-place mutation means any code holding a reference to the old state object will see capabilities or degradations change unexpectedly, while all other fields are immutable-by-convention.

**Fix:** Use the same immutable replacement pattern:

```typescript
export function setRendererDiagnosticCapabilities(capabilities: RendererBackendCapabilities): void {
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    capabilities: { ...capabilities },
  };
  syncRendererDiagnosticsWindow();
}

export function setRendererDiagnosticDegradations(degradations: RendererFeatureDegradation[]): void {
  rendererDiagnosticsState = {
    ...rendererDiagnosticsState,
    degradations: degradations.map((d) => ({ ...d })),
  };
  syncRendererDiagnosticsWindow();
}
```

#### Bug 3b: Fallback `initTimeMs` hardcoded to 0

**Location:** `client/apps/game/src/three/renderer-backend-loader.ts`, lines 52-59

**Current code:**
```typescript
const legacy = await input.legacyFactory();
incrementRendererDiagnosticError("fallbacks");
const diagnostics = createRendererInitDiagnostics({
  activeMode: "legacy-webgl",
  buildMode: input.options.envBuildMode,
  fallbackReason: "experimental-init-error",
  requestedMode,
});
```

`createRendererInitDiagnostics` defaults `initTimeMs` to `0` when not provided. The actual time spent in `legacyFactory()` and the preceding failed WebGPU init attempt are both lost. The test at line 63 asserts `initTimeMs: 0`, encoding the broken behavior as the expected result.

**Fix:** Capture the start time before `legacyFactory()` and forward it:

```typescript
const legacyStart = performance.now();
const legacy = await input.legacyFactory();
const legacyInitTimeMs = performance.now() - legacyStart;
incrementRendererDiagnosticError("fallbacks");
const diagnostics = createRendererInitDiagnostics({
  activeMode: "legacy-webgl",
  buildMode: input.options.envBuildMode,
  fallbackReason: "experimental-init-error",
  requestedMode,
  initTimeMs: legacyInitTimeMs,
});
```

#### Files to change

- `client/apps/game/src/three/renderer-diagnostics.ts`
- `client/apps/game/src/three/renderer-backend-loader.ts`
- `client/apps/game/src/three/renderer-backend-loader.test.ts` (update `initTimeMs: 0` assertion)

#### TDD plan

Write tests first:

1. add a test that calls `setRendererDiagnosticCapabilities`, captures the state reference before and after, and verifies they are different object references
2. add the same test for `setRendererDiagnosticDegradations`
3. add a test that verifies existing setter `markRendererDiagnosticDeviceLost` also produces a new reference (regression guard confirming the pattern holds)
4. add a test for `initRendererBackendWithFallback` that verifies `diagnostics.initTimeMs` is greater than 0 when the legacy factory takes measurable time (use a mock that delays)
5. update the existing test assertion from `initTimeMs: 0` to `expect.any(Number)` or a timing range

Implementation steps:

1. in `renderer-diagnostics.ts`, replace in-place mutations with full state replacement in both `setRendererDiagnosticCapabilities` and `setRendererDiagnosticDegradations`
2. in `renderer-backend-loader.ts`, add `performance.now()` timing around the legacy factory call and forward `initTimeMs`
3. update the test expectation to accept a non-zero timing value

Exit criteria:

- all diagnostics setters produce new state object references
- fallback `initTimeMs` reflects actual initialization time
- `pnpm --dir client/apps/game test -- src/three/renderer-diagnostics.test.ts` passes
- `pnpm --dir client/apps/game test -- src/three/renderer-backend-loader.test.ts` passes

### 7.5 Stage 4: WebGPU Init Deduplication

#### Objective

Remove the duplicate `setPixelRatio` and `setSize` calls during WebGPU backend initialization to eliminate redundant GPU surface reconfiguration and reduce the number of divergable call sites.

#### Bug 4a: setPixelRatio/setSize called in both factory and initialize

**Locations:**
- `client/apps/game/src/three/webgpu-renderer-backend.ts`, lines 90-91 (in `createDefaultWebGPURenderer`)
- `client/apps/game/src/three/webgpu-renderer-backend.ts`, lines 262-263 (in `initialize()`)

**Current code in factory (lines 90-91):**
```typescript
renderer.setPixelRatio(input.pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
```

**Current code in initialize() (lines 262-263):**
```typescript
createdRenderer.renderer.setPixelRatio(options.pixelRatio);
createdRenderer.renderer.setSize(window.innerWidth, window.innerHeight);
```

Both call sites apply identical pixel ratio and window dimensions. `setSize` on a WebGPU renderer triggers surface reconfiguration, which is not cheap. The factory call is immediately followed by `initialize()` calling it again.

**Fix:** Remove the calls from the factory (`createDefaultWebGPURenderer`), keeping them only in `initialize()` where they run just before `renderer.init()`. The factory should focus on renderer construction and configuration properties (shadows, tone mapping, etc.) while `initialize()` handles surface sizing.

```typescript
// In createDefaultWebGPURenderer — remove lines 90-91:
// renderer.setPixelRatio(input.pixelRatio);   // REMOVE
// renderer.setSize(window.innerWidth, window.innerHeight);  // REMOVE
renderer.autoClear = false;
// ... rest of configuration
```

#### Files to change

- `client/apps/game/src/three/webgpu-renderer-backend.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.test.ts` (update call count assertions if any)

#### TDD plan

Write tests first:

1. add a test that verifies `setPixelRatio` is called exactly once during the full `initialize()` flow (regression guard against double-call)
2. add a test that verifies `setSize` is called exactly once with `window.innerWidth` and `window.innerHeight` during `initialize()`
3. add a test that verifies a custom `createRenderer` factory that does NOT call `setPixelRatio`/`setSize` still produces a correctly sized renderer after `initialize()` (proving `initialize()` is sufficient)

Implementation steps:

1. remove `setPixelRatio` and `setSize` calls from `createDefaultWebGPURenderer`
2. verify that `initialize()` still applies these settings before `renderer.init()`
3. update any test assertions that check for specific call counts on these methods

Exit criteria:

- `setPixelRatio` and `setSize` are called exactly once during initialization
- no visual change to the rendered output
- `pnpm --dir client/apps/game test -- src/three/webgpu-renderer-backend.test.ts` passes

## 8. Testing Strategy Summary

Every stage should follow the same delivery pattern:

1. add the smallest failing tests that define the target behavior
2. implement the fix at the existing seam
3. verify no regressions in related tests
4. run targeted tests for touched files

Required test commands per stage:

- Stage 0: `pnpm --dir client/apps/game test -- src/three/game-renderer.test.ts` and `pnpm --dir client/apps/game test -- src/three/game-renderer.lifecycle.test.ts`
- Stage 1: `pnpm --dir client/apps/game test -- src/three/webgpu-postprocess-policy.test.ts`
- Stage 2: `pnpm --dir client/apps/game test -- src/three/game-renderer.test.ts`
- Stage 3: `pnpm --dir client/apps/game test -- src/three/renderer-diagnostics.test.ts` and `pnpm --dir client/apps/game test -- src/three/renderer-backend-loader.test.ts`
- Stage 4: `pnpm --dir client/apps/game test -- src/three/webgpu-renderer-backend.test.ts`

## 9. Risks and Mitigations

- Risk: The canvas ordering fix may interact with HMR if Vite's module replacement triggers `initScene` while the previous canvas is being torn down asynchronously.
  Mitigation: The fix uses synchronous `getElementById` + `remove()` which completes before the new canvas is appended. No async gap exists for HMR to race against.

- Risk: Guarding `animate()` against undefined scenes may cause blank frames during the first scene transition.
  Mitigation: The transition manager's fade overlay covers the gap. If the HUD must render during transitions, use the minimal pipeline approach (render HUD overlay only) rather than skipping the frame entirely.

- Risk: Binding `compileAsync` may not be sufficient if the method is an arrow function on the prototype (arrow functions ignore `this` rebinding).
  Mitigation: Three.js uses standard prototype methods, not arrow functions. The method-call pattern (`renderer.compileAsync(...)`) correctly provides `this`. Verify against the Three.js source for the project's pinned version.

- Risk: Adding a `weatherBaseValuesInitialized` flag introduces state that must be reset if the weather system needs re-initialization.
  Mitigation: Reset the flag in `destroy()`. The flag is simple boolean state with clear lifecycle semantics.

- Risk: Making diagnostics setters immutable may break code that caches and mutates the state object.
  Mitigation: `snapshotRendererDiagnostics()` already spreads capabilities/degradations on read. No caller should be mutating the module state directly — the setters are the only write path.

- Risk: Removing `setPixelRatio`/`setSize` from the factory may break custom factory functions passed via dependency injection in tests.
  Mitigation: Tests that provide custom `createRenderer` factories should set these properties in `initialize()`, not the factory. Update test mocks accordingly.

## 10. Cross-References

This document addresses issues NOT covered by existing PRDs:

- **PERFORMANCE_HOTPATH_BUGFIX_PRD_TDD.md Stage 0** (hover-hex `setTime`): still unfixed as of this writing, tracked separately in that document
- **RENDERER_BACKEND_BUGFIX_PRD_TDD.md**: fully complete and can be retired
- **SCENE_LIFECYCLE_BUGFIX_PRD_TDD.md**: all stages implemented but trackers unchecked — update trackers
- **CHUNKING_STREAMING_BUGFIX_PRD_TDD.md Stage 1**: redundant `waitForStructureHydrationIdle` in `prewarmChunkAssets` — still unfixed, tracked separately

### Test Suite Systemic Issues (out of scope for this PRD)

The review identified two systemic test quality issues that warrant separate attention:

1. **52 test files use source-text scanning** (`readFileSync` + regex) instead of behavioral tests — ~184 assertions that check identifier presence in source code rather than executing and verifying behavior
2. **`worldmap-hydration-idle-safety.test.ts`** tests a locally-defined stub instead of the production `waitForStructureHydrationIdle`/`waitForTileHydrationIdle` functions

These should be addressed in a dedicated test quality improvement initiative, not as part of this bugfix delivery.
