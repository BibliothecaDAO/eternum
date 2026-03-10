# Three.js Perf and Dedupe Refactor PRD + TDD

## Context

The `client/apps/game/src/three` subsystem had several verified hot-path costs and duplicated subsystems:

1. `StructureManager` used a spatial index but still resolved IDs through linear scans.
2. `ArmyManager` performed repeated full instanced-buffer uploads during attached-army owner sync.
3. `WorldmapScene` invalidated terrain caches by scanning cached chunk keys and re-ran full terrain-count scans during spectator hydration polling.
4. `WorldmapScene` duplicated attached-army ownership indexes already maintained by `ArmyManager`.
5. `StructureManager` kept separate base-model and cosmetic-model render-prep paths that had already drifted.
6. Visibility work was split across `FrustumManager` and `CentralizedVisibilityManager`.

## Goals

1. Make structure lookup by entity ID O(1).
2. Batch attached-army owner refreshes so one structure update causes one visible upload pass.
3. Replace cached-chunk invalidation scans with bounded overlap derivation.
4. Cache terrain-count snapshots so spectator hydration does not rescan unchanged render windows.
5. Remove duplicate worldmap attached-army ownership indexes.
6. Share structure render preparation across base and cosmetic paths.
7. Prefer centralized visibility when it is available.

## Non-Goals

1. Rewriting the worldmap renderer.
2. Changing the terrain cache format.
3. Removing `FrustumManager` from every remaining call site.
4. Full benchmark work in this change.

## Acceptance Criteria

1. `StructureManager.getStructureByEntityId()` is backed by a direct entity index.
2. `ArmyManager.syncAttachedArmiesOwnerForStructure()` batches visible uploads.
3. `WorldmapScene` no longer declares or maintains local attached-army ownership indexes.
4. Base and cosmetic structure render paths use shared preparation logic.
5. Chunk-cache invalidation derives a constant-size overlap neighborhood from render-size/stride math.
6. Terrain-count lookups are cached and reused until terrain-relevant state changes.
7. Targeted regression tests pass.
8. TypeScript check passes.

## TDD Plan

### Red

1. Add regression tests for:
   - direct structure entity indexing
   - batched army owner-sync uploads
   - bounded chunk-overlap derivation
   - worldmap owner-index dedupe
   - shared structure render preparation
   - terrain-count snapshot caching

### Green

1. Implement direct `structuresById` indexing in `StructureManager`.
2. Batch visible owner-refresh work in `ArmyManager`.
3. Add `getPotentialChunkKeysContainingHexInRenderBounds()` in `chunk-geometry.ts`.
4. Replace worldmap-local army ownership indexes with `ArmyManager` lookups.
5. Extract shared structure render-prep into one helper.
6. Add terrain-count snapshot caching in `WorldmapScene`.
7. Prefer `CentralizedVisibilityManager` in points/label visibility plumbing.

### Refactor / Verify

Run:

```bash
pnpm --dir client/apps/game test \
  src/three/managers/army-manager-performance-regression.test.ts \
  src/three/managers/structure-manager.performance-regression.test.ts \
  src/three/managers/structure-manager.lifecycle.test.ts \
  src/three/utils/chunk-geometry.test.ts \
  src/three/scenes/worldmap-structure-owner-indexing.test.ts \
  src/three/scenes/worldmap-performance-regression.test.ts \
  src/three/scenes/worldmap-cache-safety.test.ts \
  src/three/scenes/worldmap-chunk-neighbors.test.ts \
  src/three/scenes/worldmap-attached-army-owner-sync.test.ts \
  src/three/scenes/worldmap-attached-army-owner-sync-wiring.test.ts \
  src/three/scenes/worldmap-runtime-lifecycle.test.ts \
  src/three/managers/army-manager-owner-sync-wiring.test.ts
```

Then:

```bash
pnpm --dir client/apps/game exec tsc --noEmit --pretty false
```
