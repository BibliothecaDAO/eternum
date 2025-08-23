# ThreeJS Memory Hotspots & Task List

This document captures the main sources of memory usage observed in `client/apps/game/src/three` (current heap ~600MB) and a prioritized task list to reduce it.

## Summary

- Biggest drivers: eager morph allocation for instanced meshes (biomes/structures/armies) and unbounded cached chunk matrices.
- Additional contributors: many CSS2D labels kept live, high postprocessing buffers (GPU), high default instance caps.

## Hotspots (Ranked)

1) Eager morph allocation in instanced meshes (heap)
- Where: `managers/instanced-biome.tsx`, `managers/instanced-model.tsx`, `managers/army-model.ts`.
- Pattern: `for (i < count) tmp.setMorphAt(i, ...)` done at load time for large `count`/`MAX_INSTANCES` (e.g., 1000–2640), then `count = 0`.
- Impact: Creates large per-mesh DataTextures/typed arrays (morphTexture) up-front even if only a fraction of instances are visible.

2) Unbounded chunk matrix cache (heap growth while roaming)
- Where: `scenes/worldmap.tsx` → `cachedMatrices: Map<string, Map<string, { matrices: InstancedBufferAttribute; count: number }>>`.
- Pattern: `getMatricesAndCount()` clones `instanceMatrix` per biome per chunk and stores it; cache doesn’t enforce an LRU/size cap.
- Impact: Accumulates many large `Float32Array`s over time, grows with exploration.

3) CSS2D label DOM overhead (heap + GC)
- Where: `utils/labels/*` + managers (armies/structures/quests/chests).
- Pattern: Many DOM subtrees with images/text; frequent expand/collapse without pooling.
- Impact: Adds steady heap usage and GC churn at scale.

4) Postprocessing/composer render targets (GPU memory)
- Where: `game-renderer.ts` (EffectComposer, HalfFloatType, Bloom with mipmapBlur).
- Note: Mostly GPU memory (not reflected in `performance.memory.usedJSHeapSize`), but relevant for overall footprint and stability.

5) High default instance caps & typed arrays
- Where: `constants/army-constants.ts` (`MAX_INSTANCES = 1000`), biome `maxInstances = renderChunkSize.width * height` (currently 60×44=2640).
- Impact: Larger default typed arrays (e.g., `Float32Array` for instance colors/matrices) than required by typical visibility.

## Recommendations (Quick Wins)

- Lazy morph allocation: Only call `setMorphAt` for active/new instances; avoid upfront loops to `MAX_INSTANCES`/`count`.
- Disable morph on world map: If biomes don’t need animation morphs there, skip morph setup entirely.
- Cap cachedMatrices with LRU: Keep current + neighbors (or a fixed N) and evict older chunk keys.
- Reduce instance caps: Lower `MAX_INSTANCES` and biome `maxInstances`; or grow capacity dynamically.
- Pool/reuse CSS2D labels: Recycle DOM nodes instead of rebuilding/remounting.
- Composer tuning (GPU): On Mid/Low settings, reduce pixel ratio, consider `UnsignedByteType`, and disable `mipmapBlur`.

## Task List (Prioritized)

- [ ] P0 — Lazy morph allocation for biomes
  - Files: `managers/instanced-biome.tsx`, `scenes/hexagon-scene.ts`.
  - Change: Don’t pre-run `setMorphAt` for `count` at load time. Introduce per-mesh `morphCapacity` and grow on demand (e.g., double capacity when needed). If world map doesn’t need morphs, disable entirely.
  - Acceptance: Morph DataTextures only sized to active instances; heap drops significantly at startup.

- [ ] P0 — Lazy morph allocation for structures and armies
  - Files: `managers/instanced-model.tsx`, `managers/army-model.ts`.
  - Change: Same lazy pattern; avoid initializing morphs and large `instanceColor` arrays for all `MAX_INSTANCES` upfront.
  - Acceptance: Instantiate morph/capacity only as entities become visible; no visual regressions.

- [ ] P0 — Add LRU to `cachedMatrices` (chunk matrices)
  - Files: `scenes/worldmap.tsx`.
  - Change: Wrap `cachedMatrices` in an LRU (e.g., cap ~9–12 chunk keys: current + 8 neighbors). On eviction, drop references so arrays GC. Ensure cache invalidation paths call eviction.
  - Acceptance: Heap remains stable while panning across many chunks.

- [ ] P1 — Reduce instance caps to realistic maxima
  - Files: `constants/army-constants.ts`, `scenes/hexagon-scene.ts`.
  - Change: Lower `MAX_INSTANCES` (e.g., 300–500), set biome `maxInstances` to visible viewport + margin, not full render grid.
  - Acceptance: No “out of instances” in typical play; lower base typed array sizes.

- [ ] P1 — Pool & reuse CSS2D labels
  - Files: `utils/labels/*`, managers.
  - Change: Implement `LabelPool` to recycle `CSS2DObject` + DOM trees; reset content on reuse. Cull/pool off-screen.
  - Acceptance: Fewer DOM allocations; reduced GC churn during heavy UI updates.

- [ ] P1 — Composer buffers tuned by graphics setting (GPU)
  - Files: `game-renderer.ts`.
  - Change: On Mid/Low, set `frameBufferType` to `UnsignedByteType`, lower `renderer.setPixelRatio`, disable `bloom.mipmapBlur`.
  - Acceptance: Lower GPU memory; visual parity acceptable at lower settings.

- [ ] P2 — Audit/strengthen disposal paths
  - Files: Managers and scenes `destroy()/dispose()` paths.
  - Change: Ensure morph textures, materials, geometries, textures, and listeners are disposed/removed consistently.
  - Acceptance: No retained nodes/resources post scene switch; heap stabilizes after destroy.

- [ ] P2 — MemoryMonitor enhancements
  - Files: `utils/memory-monitor.ts`.
  - Change: Add per-resource counters (by model/biome), log before/after on key operations (chunk switch, model load), expose a quick HUD toggle.
  - Acceptance: Clear visibility into which changes reduce heap.

## Measurement Plan

- Use built-in `MemoryMonitor` HUD (already integrated) to capture baseline and deltas:
  - Record heap at: initial load, post first chunk load, after 5+ chunk moves, after heavy army/structure visibility changes.
  - Compare before/after each P0/P1 change.

## File Reference (for implementers)

- Eager morph allocation: `managers/instanced-biome.tsx`, `managers/instanced-model.tsx`, `managers/army-model.ts`.
- Biome maxInstances: `scenes/hexagon-scene.ts` (`loadBiomeModels`).
- Chunk matrix caching: `scenes/worldmap.tsx` (`cachedMatrices`, `cacheMatricesForChunk`, `applyCachedMatricesForChunk`, eviction strategy).
- CSS2D labels: `utils/labels/*` + usages in managers.
- Composer settings: `game-renderer.ts`.

---

Notes
- There is an existing `THREEJS_MEMORY_OPTIMIZATIONS.md` with a broader roadmap; this document complements it with specific hotspots and actionable tasks tied to current code.

