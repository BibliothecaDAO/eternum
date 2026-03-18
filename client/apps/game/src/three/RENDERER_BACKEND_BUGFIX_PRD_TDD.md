# Renderer Backend Bugfix PRD + TDD

Status: Draft
Date: 2026-03-18
Scope: `client/apps/game/src/three`
Primary surfaces: WebGPU post-processing runtime, renderer backend GPU resource management, game renderer lifecycle safety

## 1. Summary

This document captures concrete bugs and correctness issues found in the renderer backend, post-processing, and game renderer lifecycle code. Each issue is isolated, reproducible from the source, and fixable without architectural changes.

The bugs fall into three independent categories:

- interface contract violations in the WebGPU post-processing runtime
- GPU memory leaks in the WebGL renderer backend's HDR environment pipeline
- promise and null-safety hazards in the game renderer lifecycle

All three stages can be delivered in parallel. Every fix is scoped to the minimum change required to restore correctness.

## 2. Problem Statement

### 2.1 WebGPU post-processing signature and tone mapping parity

The `WebGPUPostProcessRuntime` class violates its own interface contract and silently maps a tone mapping mode incorrectly, causing cross-backend visual inconsistency.

### 2.2 GPU memory leaks on HDR load failure

The WebGL renderer backend leaks GPU render targets when HDR environment map loading fails, and shares a module-level cache across renderer instances in ways that produce undefined GPU behavior under HMR or concurrent instantiation.

### 2.3 Game renderer lifecycle hazards

The game renderer has two lifecycle bugs: a promise that hangs forever on destroy, and a null dereference path when the WebGPU backend's optional `renderer` property is force-cast to non-optional before initialization completes.

## 3. Goals

### 3.1 Product goals

- eliminate silent rendering size mismatches between the WebGPU renderer output and its post-processing pipeline
- ensure tone mapping mode `"neutral"` produces visually consistent results across WebGL and WebGPU backends
- prevent GPU memory leaks during HDR environment loading failures
- make rapid mount/unmount cycles safe without leaking promises or GPU resources
- prevent runtime crashes when the WebGPU backend is selected but initialization leaves `renderer` undefined

### 3.2 Technical goals

- make `WebGPUPostProcessRuntime.setSize()` conform to `RendererPostProcessRuntime.setSize(width, height)`
- add a distinct `NeutralToneMapping` mapping for the `"neutral"` mode in both WebGPU code paths
- dispose `fallbackTarget` in the `catch` block of `applyEnvironment`
- clear `cachedHDRTarget` when the owning `WebGLRendererBackend` is disposed
- reject the `waitForLabelRendererElement` promise when `isDestroyed` is detected
- add a null guard in `setupRendererGUI` before accessing `this.renderer`

## 4. Non-goals

- changing the WebGL post-processing pipeline
- redesigning the renderer backend abstraction layer
- adding new post-processing effects or tone mapping modes
- changing the HDR environment map loading strategy beyond leak prevention
- modifying the label renderer element lookup mechanism beyond promise safety

## 5. Success Metrics

### 5.1 Correctness metrics

- `WebGPUPostProcessRuntime.setSize(w, h)` passes width and height through to the underlying post-processing pipeline
- `"neutral"` tone mapping mode produces distinct output from `"aces-filmic"` on the WebGPU path
- no leaked `WebGLRenderTarget` after `loadCachedEnvironmentMap` throws
- no stale `cachedHDRTarget` referencing a disposed renderer's GPU context
- `waitForLabelRendererElement` rejects with a descriptive error when `isDestroyed` becomes true
- `setupRendererGUI` does not throw when `this.renderer` is undefined

### 5.2 Regression metrics

- all existing renderer backend tests continue to pass
- no visual changes on the WebGL path for non-neutral tone mapping modes
- no behavior change in `waitForLabelRendererElement` when `isDestroyed` is false

## 6. Rollout Stages

| Stage | Name | Primary outcome |
| --- | --- | --- |
| 0 | WebGPU post-processing signature parity | Fix interface contract violation and tone mapping inconsistency |
| 1 | GPU memory leak on HDR load error | Prevent GPU resource leaks in environment map loading |
| 2 | Game renderer lifecycle safety | Fix hanging promise and null dereference on WebGPU path |

### Delivery Tracker

- [x] Stage 0: WebGPU post-processing signature parity
- [x] Stage 1: GPU memory leak on HDR load error
- [x] Stage 2: Game renderer lifecycle safety

### Dependencies between stages

- Stage 0 has no dependencies (pure type/contract fixes)
- Stage 1 has no dependencies (independent GPU resource management)
- Stage 2 has no dependencies (independent lifecycle fixes)
- All stages can be done in parallel

## 7. Detailed Stages

### 7.1 Stage 0: WebGPU Post-Processing Signature Parity

#### Objective

Fix the `setSize()` signature mismatch and the `"neutral"` tone mapping silent fallback in the WebGPU code paths.

#### Bug 0a: `WebGPUPostProcessRuntime.setSize()` signature mismatch

**Location:** `client/apps/game/src/three/webgpu-postprocess-runtime.ts`, line 99

**Interface contract:** `RendererPostProcessRuntime` (defined in `renderer-backend-v2.ts`, line 102) declares:
```typescript
setSize(width: number, height: number): void;
```

**Actual implementation:**
```typescript
setSize(): void {
  this.postProcessing.needsUpdate = true;
}
```

The implementation accepts zero parameters. When callers pass `width` and `height` (as in `webgpu-renderer-backend.ts`, lines 234 and 308), the values are silently ignored. This causes the post-processing pipeline's internal render targets to remain at whatever size they were initialized with, creating a size mismatch between the renderer output and the post-processing input after any resize event.

**Root cause:** The `WebGPUPostProcessing` wrapper from Three.js does not expose a `setSize()` method — setting `needsUpdate = true` is the intended mechanism to trigger internal reallocation. However, the implementation should still accept and forward the width/height parameters to maintain interface compliance and allow future use if Three.js adds explicit sizing support.

#### Bug 0b: `"neutral"` tone mapping silently maps to ACES-Filmic

**Locations:**
- `client/apps/game/src/three/webgpu-renderer-backend.ts`, lines 175-187 (`resolveRendererToneMapping`)
- `client/apps/game/src/three/webgpu-postprocess-runtime.ts`, lines 140-153 (`resolveRendererToneMapping`)

**Both functions contain:**
```typescript
case "aces-filmic":
case "neutral":
default:
  return ACESFilmicToneMapping;
```

The `"neutral"` case falls through to `ACESFilmicToneMapping`. The WebGL post-processing path (`webgl-postprocess-runtime.ts`, line 244) correctly handles this:
```typescript
case "neutral":
  return ToneMappingMode.NEUTRAL;
```

Three.js provides `NeutralToneMapping` (exported from `"three"` since r162). The WebGPU paths should use it instead of falling through to ACES-Filmic.

#### Files to change

- `client/apps/game/src/three/webgpu-postprocess-runtime.ts`
- `client/apps/game/src/three/webgpu-renderer-backend.ts`

#### TDD plan

Write tests first:

1. `WebGPUPostProcessRuntime.setSize(w, h)` accepts two numeric parameters and marks `needsUpdate = true`
2. `resolveRendererToneMapping("neutral")` in `webgpu-postprocess-runtime.ts` returns `NeutralToneMapping`, not `ACESFilmicToneMapping`
3. `resolveRendererToneMapping("neutral")` in `webgpu-renderer-backend.ts` returns `NeutralToneMapping`, not `ACESFilmicToneMapping`
4. `resolveRendererToneMapping("aces-filmic")` still returns `ACESFilmicToneMapping` in both files (regression guard)

Implementation steps:

1. Update `WebGPUPostProcessRuntime.setSize()` signature to `setSize(width: number, height: number): void` — accept the parameters even if the current Three.js wrapper only needs `needsUpdate`
2. Import `NeutralToneMapping` from `"three"` in both `webgpu-postprocess-runtime.ts` and `webgpu-renderer-backend.ts`
3. Add a distinct `case "neutral": return NeutralToneMapping;` in both `resolveRendererToneMapping` functions, removing the fall-through from `"neutral"` to `"aces-filmic"`

Exit criteria:

- `setSize` conforms to the `RendererPostProcessRuntime` interface with explicit `(width, height)` parameters
- `"neutral"` tone mapping produces `NeutralToneMapping` on the WebGPU path, matching the WebGL path's behavior
- no change to `"aces-filmic"`, `"linear"`, `"reinhard"`, or `"cineon"` behavior

### 7.2 Stage 1: GPU Memory Leak on HDR Load Error

#### Objective

Prevent GPU render target leaks when HDR environment map loading fails and eliminate cross-instance cache contamination.

#### Bug 1a: `fallbackTarget` GPU memory leak on HDR load error

**Location:** `client/apps/game/src/three/renderer-backend.ts`, lines 169-190 (`applyEnvironment` method)

**Code path:**
```typescript
async applyEnvironment(targets: RendererEnvironmentTargets): Promise<void> {
  const pmremGenerator = new PMREMGenerator(this.renderer);
  pmremGenerator.compileEquirectangularShader();

  const fallbackTarget = pmremGenerator.fromScene(new RoomEnvironment());
  this.setEnvironmentFromTarget(fallbackTarget, targets);

  try {
    const target = await this.loadCachedEnvironmentMap(pmremGenerator);
    if (this.isDisposed) {
      if (target !== cachedHDRTarget) {
        target.dispose();
      }
      return;
    }
    this.setEnvironmentFromTarget(target, targets);
  } catch (error) {
    console.error("Failed to load HDR environment map", error);
  } finally {
    pmremGenerator.dispose();
  }
}
```

When `loadCachedEnvironmentMap` throws, `setEnvironmentFromTarget(target, targets)` never runs. The `fallbackTarget` was set as `this.environmentTarget` by the earlier `setEnvironmentFromTarget(fallbackTarget, targets)` call, so it is tracked. However, when the HDR load succeeds on a subsequent call or on a different instance, `setEnvironmentFromTarget` will dispose the old `environmentTarget` only if it differs from `cachedHDRTarget`. The real leak scenario is: if the HDR load fails and then `applyEnvironment` is never called again, the `fallbackTarget` persists as `this.environmentTarget` for the backend's lifetime. On `dispose()`, the backend does check `this.environmentTarget !== cachedHDRTarget` before disposing, so the fallback is disposed on backend teardown. The more critical issue is the interaction with Bug 1b below.

**Fix:** In the `catch` block, explicitly check whether `this.environmentTarget` is the `fallbackTarget` and whether it should be disposed or retained. Add a comment clarifying the ownership contract.

#### Bug 1b: Module-level HDR PMREM cache tied to first renderer context

**Location:** `client/apps/game/src/three/renderer-backend.ts`, lines 97-98

```typescript
let cachedHDRTarget: WebGLRenderTarget | null = null;
let cachedHDRPromise: Promise<WebGLRenderTarget> | null = null;
```

These module-level variables cache the PMREM-processed HDR environment map across all `WebGLRendererBackend` instances. If two instances are created concurrently (common during HMR hot-reload or test runners), the `WebGLRenderTarget` created by the first instance's `PMREMGenerator` is used with the second instance's `WebGLRenderer`. Using a `WebGLRenderTarget` across different `WebGLRenderer` contexts is undefined behavior — the underlying GL textures belong to the first context.

Additionally, when the first backend is disposed, `cachedHDRTarget` is not cleared. The second backend (or a new backend created after HMR) will find a stale `cachedHDRTarget` pointing to a disposed GPU resource.

**Fix:** Clear `cachedHDRTarget` and `cachedHDRPromise` when the owning backend is disposed. Consider associating the cache with a specific renderer instance rather than module scope, or at minimum null out the module cache in `dispose()` when `this.environmentTarget === cachedHDRTarget`.

#### Files to change

- `client/apps/game/src/three/renderer-backend.ts`

#### TDD plan

Write tests first:

1. When `loadCachedEnvironmentMap` rejects, `fallbackTarget` remains as `this.environmentTarget` and is disposed on backend `dispose()` — no orphaned GPU resource
2. When a `WebGLRendererBackend` that owns `cachedHDRTarget` is disposed, `cachedHDRTarget` is set to `null`
3. A second `WebGLRendererBackend` created after the first is disposed does not use the stale `cachedHDRTarget`
4. When `loadCachedEnvironmentMap` rejects, `pmremGenerator` is still disposed (existing `finally` block — regression guard)

Implementation steps:

1. In the `catch` block of `applyEnvironment`, add explicit handling for the `fallbackTarget` lifecycle — document that it remains as `this.environmentTarget` and will be cleaned up on `dispose()`
2. In `dispose()`, after checking and disposing `this.environmentTarget`, clear `cachedHDRTarget` if it matches `this.environmentTarget`
3. Also clear `cachedHDRPromise` in `dispose()` to prevent a pending promise from resolving with a target bound to a disposed context

Exit criteria:

- no leaked `WebGLRenderTarget` after HDR load failure followed by backend disposal
- `cachedHDRTarget` is null after the owning backend is disposed
- a fresh backend created after disposal performs a clean HDR load instead of reusing stale GPU resources

### 7.3 Stage 2: Game Renderer Lifecycle Safety

#### Objective

Fix the hanging promise in `waitForLabelRendererElement` and the null dereference in `setupRendererGUI` on the WebGPU path.

#### Bug 2a: `waitForLabelRendererElement` promise never resolves/rejects on destroy

**Location:** `client/apps/game/src/three/game-renderer.ts`, lines 317-343

```typescript
private async waitForLabelRendererElement(): Promise<HTMLDivElement> {
  return new Promise((resolve) => {
    const WARN_AFTER_ATTEMPTS = 300;
    let attempts = 0;

    const checkElement = () => {
      if (this.isDestroyed) {
        return;  // <-- bails out without resolving or rejecting
      }

      const element = document.getElementById("labelrenderer") as HTMLDivElement | null;
      if (element) {
        resolve(element);
        return;
      }

      attempts++;
      if (attempts === WARN_AFTER_ATTEMPTS) {
        console.warn("...");
      }

      requestAnimationFrame(checkElement);
    };

    checkElement();
  });
}
```

When `this.isDestroyed` becomes true mid-poll, the `checkElement` callback bails with a bare `return`. The promise is never resolved or rejected. The promise object and its closure (which captures `this`) persist in memory indefinitely. On rapid mount/unmount cycles (e.g., navigating away from the game and back quickly), each cycle leaks one promise and one closure referencing the `GameRenderer` instance.

**Fix:** Reject the promise when `isDestroyed` is detected:
```typescript
if (this.isDestroyed) {
  reject(new Error("GameRenderer destroyed while waiting for label renderer element"));
  return;
}
```

The caller should handle this rejection gracefully (it already has a `catch` path at the call site).

#### Bug 2b: Race condition — `setupRendererGUI` accesses `this.renderer` before assignment on WebGPU path

**Locations:**
- `client/apps/game/src/three/game-renderer.ts`, line 109: `private renderer!: RendererSurfaceLike;` (non-null assertion)
- `client/apps/game/src/three/game-renderer.ts`, line 289: `this.renderer, "toneMapping"` (dereference)
- `client/apps/game/src/three/game-renderer.ts`, lines 756-758: `initScene` awaits `backendInitializationPromise` then calls `setupGUIControls` which calls `setupRendererGUI`

The `RendererBackendV2` interface (in `renderer-backend-v2.ts`, line 44) declares `renderer` as optional:
```typescript
readonly renderer?: RendererSurfaceLike;
```

However, in `game-renderer.ts` line 398, the backend is force-cast:
```typescript
const backend = result.backend as RendererBackendV2 & { renderer: RendererSurfaceLike; dispose?: () => void };
```

For the WebGPU backend (`webgpu-renderer-backend.ts`, line 209), `renderer` is a getter that returns the internal `renderer` variable, which starts as `undefined` and is only assigned after `initialize()` succeeds (line 272). If `initialize()` throws and the loader falls back to the legacy backend, the cast at line 398 would be on the fallback backend which does have a renderer. However, if the WebGPU backend is used directly (without the loader's fallback logic) and initialization fails partially, `this.renderer` on the `GameRenderer` would be `undefined`, and `setupRendererGUI` at line 289 would dereference `undefined.toneMapping`.

**Fix:** Add a defensive null guard in `setupRendererGUI`:
```typescript
private setupRendererGUI() {
  if (!this.renderer) {
    return;
  }
  // ... existing GUI setup
}
```

#### Files to change

- `client/apps/game/src/three/game-renderer.ts`

#### TDD plan

Write tests first:

1. `waitForLabelRendererElement` rejects with an error when `isDestroyed` is set before the element is found
2. `waitForLabelRendererElement` still resolves normally when the element exists and `isDestroyed` is false (regression guard)
3. `setupRendererGUI` does not throw when `this.renderer` is `undefined`
4. `setupRendererGUI` still sets up GUI controls when `this.renderer` is defined (regression guard)

Implementation steps:

1. Change the `waitForLabelRendererElement` promise constructor to accept both `resolve` and `reject`, and call `reject` with a descriptive error when `isDestroyed` is true
2. Ensure the caller of `waitForLabelRendererElement` handles the rejection (log a warning and return, do not re-throw)
3. Add a null guard at the top of `setupRendererGUI` — return early if `this.renderer` is falsy
4. Optionally log a diagnostic warning when the null guard fires, to aid debugging

Exit criteria:

- no hanging promises from `waitForLabelRendererElement` after `GameRenderer` destruction
- no `TypeError: Cannot read properties of undefined (reading 'toneMapping')` on the WebGPU path
- no behavior change in normal (non-error) code paths

## 8. Testing Strategy Summary

Every stage should follow the same delivery pattern:

1. add the smallest failing tests that define the target behavior
2. implement the fix behind the existing seam
3. verify no regressions in existing renderer backend tests
4. run targeted tests for touched files

Required recurring test commands:

- `pnpm --dir client/apps/game test -- src/three/webgpu-renderer-backend.test.ts`
- `pnpm --dir client/apps/game test -- src/three/renderer-backend-loader.test.ts`

Add stage-specific targeted commands as each fix lands:

- Stage 0: `pnpm --dir client/apps/game test -- src/three/webgpu-postprocess-runtime.test.ts`
- Stage 1: `pnpm --dir client/apps/game test -- src/three/renderer-backend.test.ts`
- Stage 2: `pnpm --dir client/apps/game test -- src/three/game-renderer.test.ts`

## 9. Risks and Mitigations

- Risk: Changing `setSize()` signature may break downstream callers that rely on zero-parameter behavior.
  Mitigation: The implementation still only uses `needsUpdate = true` internally. The signature change is purely additive and matches the interface contract. No callers depend on the zero-parameter form.

- Risk: Importing `NeutralToneMapping` from `"three"` may fail if the project's Three.js version predates its introduction (r162).
  Mitigation: The project already imports other tone mapping constants from `"three"`. Verify the Three.js version supports `NeutralToneMapping` before landing.

- Risk: Clearing `cachedHDRTarget` on dispose may cause redundant HDR loads if multiple backends share the module.
  Mitigation: This is the correct trade-off — a redundant load is safe, while using a stale GPU resource is undefined behavior. The cache is a performance optimization, not a correctness requirement.

- Risk: Rejecting the `waitForLabelRendererElement` promise may surface unhandled rejection warnings if the caller does not have a `.catch()`.
  Mitigation: Verify the call site handles rejections before landing. Add a `.catch()` if missing.

- Risk: The null guard in `setupRendererGUI` masks a deeper initialization ordering issue.
  Mitigation: The guard is a safety net, not a fix for the ordering. The underlying cast at line 398 should also be audited in a follow-up to ensure it only runs when `renderer` is guaranteed defined.
