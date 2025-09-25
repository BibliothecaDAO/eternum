# Three.js Optimization Assessment

## Rendering Pipeline
- Depth and stencil buffers are disabled for MID/HIGH presets, so depth testing collapses and overdraw spikes; see `client/apps/game/src/three/game-renderer.ts:200`. Keep depth/stencil on by default and only downgrade for truly low tiers.
- Frame throttling still runs at ~120 FPS because `frameTime` is set to `1000 / 120` despite the 30 FPS comment; see `client/apps/game/src/three/game-renderer.ts:692`. Use the intended target (e.g. `1000 / 30`) or expose a setting.
- DPI handling either hard-caps at 0.75 or pushes full device DPR (often >3), which alternates between blurry and fill-rate bound; see `client/apps/game/src/three/game-renderer.ts:206`. Clamp to a saner range or adapt per graphics tier.
- The full EffectComposer stack (tone mapping, FXAA, bloom, vignette) stays active even on LOW; see `client/apps/game/src/three/game-renderer.ts:486`. Bypass the composer or selectively disable passes on lower profiles to free GPU budget.

## Resource & State Management
- Window/document listeners are registered with inline handlers or `.bind(...)`, then removed with new references, so every teardown leaks listeners; see `client/apps/game/src/three/game-renderer.ts:380`, `client/apps/game/src/three/game-renderer.ts:425`, and `client/apps/game/src/three/game-renderer.ts:779`. Store the callbacks/unsubscribers and clear them in `destroy()`.
- Multiple `useUIStore.subscribe` calls ignore the unsubscribe handle, pinning the scene in memory and replaying callbacks after disposal; see `client/apps/game/src/three/game-renderer.ts:380` and `client/apps/game/src/three/scenes/worldmap.tsx:203`. Retain the disposers and invoke them on teardown.
- The Stats panel DOM node is appended but never removed, so hot reload piles up overlays; see `client/apps/game/src/three/game-renderer.ts:219`. Remove `stats.dom` during cleanup.
- `applyEnvironment` creates PMREM resources and HDR textures without disposing them; see `client/apps/game/src/three/game-renderer.ts:626`. Dispose the generator and intermediate textures once the env map is baked.
- MatrixPool grows monotonically because nothing ever calls `clear()` when leaving the world map; compare `client/apps/game/src/three/utils/matrix-pool.ts:47` with the lack of cleanup in `client/apps/game/src/three/scenes/worldmap.tsx:2110`. Release pooled matrices when caches are cleared or the scene is destroyed.

## Geometry & Instancing
- `InstancedBiome.updateAnimations` loops every instance each tick and calls `setMorphAt`, forcing full morph texture uploads per frame; see `client/apps/game/src/three/managers/instanced-biome.tsx:185`. Move animation into the shader (per-instance phase offsets) or drastically lower the update frequency.
- `InstancedBiome.needsUpdate` permanently disables frustum culling and recomputes bounding spheres, so every instanced mesh draws regardless of visibility; see `client/apps/game/src/three/managers/instanced-biome.tsx:151`. Keep culling on with cached bounds per chunk.
- Cloning `instanceMatrix` for caching allocates large buffers every update; see `client/apps/game/src/three/managers/instanced-biome.tsx:103`. Reuse typed arrays or share attributes to reduce GC churn.

## Scene Streaming & Chunks
- `updateHexagonGrid` performs heavy biome classification on the main thread and only yields once per large batch; see `client/apps/game/src/three/scenes/worldmap.tsx:1461`. Split work across more animation frames or ship it to a worker to avoid the visible hitches.
- Chunk switches run manager updates sequentially, which often exceeds a frame budget; see `client/apps/game/src/three/scenes/worldmap.tsx:1862`. Consider batching with controlled parallelism or double-buffering visible data.
- Cached matrices are deleted but not returned to the pool until GC, causing peak memory spikes; see `client/apps/game/src/three/scenes/worldmap.tsx:1767`. Release buffers to the pool immediately after chunk eviction.

## Diagnostics & Logging
- High-frequency logs remain in production paths (chunk loading, combat arrows, biome stats), e.g. `client/apps/game/src/three/scenes/worldmap.tsx:377`. Guard them behind a debug flag to avoid CPU thrash.
- `performance.memory` access will spam warnings on non-Chromium browsers; see `client/apps/game/src/three/utils/memory-monitor.ts:66`. Add capability checks or graceful fallbacks.

## Opportunities
- Draco decoder is fetched from Google on every cold start; see `client/apps/game/src/three/utils/utils.ts:15`. Bundle a local decoder to eliminate network latency.
- Moving the animation loop to `renderer.setAnimationLoop` prepares the app for WebXR/VR extensions with minimal changes.

## Suggested Next Steps
1. Fix the renderer configuration (depth buffer, frame cap, adaptive post-processing) and re-profile GPU timings.
2. Audit every subscription and listener, add proper disposers, and confirm via a hot-reload cycle that no duplicate handlers remain.
3. Trim logging, batch `updateHexagonGrid`, and profile again—if spikes persist, prototype a worker-based chunk builder.
