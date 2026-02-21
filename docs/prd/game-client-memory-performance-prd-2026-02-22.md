# Game Client Memory + Runtime Performance PRD (Heap Snapshot: February 22, 2026)

## 1. Summary

This PRD defines a focused performance program for the game client to reduce memory retention, garbage collection churn, and runtime slowdowns observed in production-like sessions.

The plan is driven by a heap snapshot captured on **February 22, 2026** (`Heap-20260222T000722.heapsnapshot`, 174 MB) and repository-verified loading patterns. The core issue is not detached DOM leaks; it is large, eagerly loaded data plus repeated object/schema allocation and refresh-path retention.

## 2. Problem Statement

Users experience degradation over session time, including:

- Increased UI latency and frame instability
- Longer GC pauses and interaction jank
- Slowdown that worsens after gameplay/data refresh cycles

Current loading and caching patterns keep large JSON structures and related runtime objects alive longer than necessary, and some store refresh paths can retain stale data.

## 3. Goals

1. Reduce steady-state JS heap size during normal gameplay sessions.
2. Reduce GC pressure caused by repeated schema/object allocation.
3. Ensure data stores do not grow from stale entities across refreshes.
4. Isolate heavy admin/prediction-market manifests from normal play paths.
5. Establish measurable performance gates in CI/release validation.

## 4. Non-Goals (V1)

- Rewriting the rendering pipeline.
- Replacing major third-party dependencies (e.g., Zod, Dojo SDK) globally.
- Re-architecting gameplay systems.
- Browser-extension-specific memory behavior elimination.

## 5. Users and Impact

- Active players in `/play/*`: lower stutter, more stable long sessions.
- Power users (frequent tab/context switches): less cumulative slowdown.
- Engineering: faster root-cause detection via better metrics and regression gates.

## 6. Current-State Findings (Heap + Repo Verified)

### 6.1 Heap snapshot highlights

From `Heap-20260222T000722.heapsnapshot`:

- `node_count`: 2,110,769
- `edge_count`: 9,308,869
- Largest retained categories by self-size:
  - `native`: 79.27 MiB
  - `code`: 25.36 MiB
  - `string`: 12.91 MiB
  - `closure`: 12.72 MiB
  - `object`: 11.73 MiB
- `system / ExternalStringData`: **73.08 MiB** (877 nodes)
- `closure:native_bind`: **378,393 objects**

The closure/object graph strongly indicates heavy runtime churn from bound methods and schema-like objects.

### 6.2 `realms.json` signature appears directly in heap

Observed repeated strings in heap:

- `"Your journey awaits..."` (~8001)
- `"Rivers"`, `"Cities"`, `"Harbors"`, `"Regions"`, `"Order"` (each ~8001)

Repo verification:

- `client/public/jsons/realms.json` is ~6.2 MB and 8000 entries.
- Eager imports in runtime paths:
  - `client/apps/game/src/three/managers/player-data-store.ts:5`
  - `packages/core/src/stores/map-data-store.ts:28`

### 6.3 Manifest-heavy eager imports

Admin utility imports 5 manifests at module load:

- `client/apps/game/src/ui/features/admin/utils/manifest-loader.ts:1`

Manifest source sizes:

- `contracts/game/manifest_mainnet.json` ~827 KB
- `contracts/game/manifest_slot.json` ~821 KB
- `contracts/game/manifest_local.json` ~450 KB
- `contracts/game/manifest_sepolia.json` ~453 KB
- `contracts/game/manifest_slottest.json` ~450 KB

Prediction market modules also eagerly import chain manifests:

- `client/apps/game/src/pm/prediction-market-config.ts:2`
- `client/apps/game/src/pm/hooks/dojo/dojo-config.tsx:3`

### 6.4 Refresh-path retention risk in map store

`MapDataStore.fetchAndStoreMapData()` repopulates maps but does not clear all caches before insert:

- writes at `packages/core/src/stores/map-data-store.ts:456`, `:502`, `:511`

If entity ids churn or stale rows remain absent in a subsequent fetch, stale entries can persist in memory.

### 6.5 Detached DOM is not primary issue

Detached-node signal in snapshot is low (~30 matches), so main remediation should target data/object retention and load boundaries.

## 7. Product Requirements

### 7.1 Functional requirements

1. Gameplay path must not eagerly load full realm metadata payload when only realm name lookup is required.
2. Map/player data stores must rebuild caches from a clean state on full refresh.
3. Admin manifest payloads must be lazily loaded only when needed.
4. Prediction-market manifests must load only for the active chain and only where required.
5. Schema/object creation in hot paths must be hoisted/memoized to avoid repeated binding churn.

### 7.2 Non-functional requirements

1. No gameplay regression in structure/realm naming.
2. No data consistency regression after cache clearing on refresh.
3. No route-level breakage for `/factory` and prediction-market features.
4. Performance telemetry must support before/after comparisons.

## 8. Success Metrics

### 8.1 Heap and memory

1. 15-minute gameplay session heap growth reduced by >= 30% versus baseline.
2. 30-minute idle+interaction plateau: no unbounded monotonic growth after first stabilization window.
3. External string memory reduced by >= 25% in equivalent snapshots.

### 8.2 Runtime smoothness

1. Long-task count (>= 50 ms) reduced by >= 25% during standard interaction script.
2. GC-related interaction spikes (proxy via long tasks + frame drops) reduced by >= 20%.

### 8.3 Bundle/load boundaries

1. Admin manifests absent from baseline `/play/*` load graph.
2. Only active-chain prediction-market manifest loaded per session unless explicitly switched.

## 9. Technical Design

### 9.1 Realm metadata right-sizing

#### Current

- Full `realms.json` object imported for simple `id -> name` lookup.

#### Design

1. Introduce a compact realm-name index artifact (`realm-names.json` or generated TS map) containing only required fields.
2. Replace full-data imports in:
   - `client/apps/game/src/three/managers/player-data-store.ts`
   - `packages/core/src/stores/map-data-store.ts`
3. Keep full metadata available only in features that truly require attributes.

#### Notes

- This is expected to remove repeated attribute string retention from baseline runtime.

### 9.2 MapDataStore refresh correctness

#### Current

- Fetch path sets into maps without clearing all relevant maps first.

#### Design

1. In `fetchAndStoreMapData()`, clear and rebuild:
   - `structuresMap`
   - `armiesMap`
   - `addressToNameMap`
   - `entityToEntityIdMap`
   - `hyperstructureRealmCountMap`
2. Preserve refresh atomicity (build temp maps, swap in commit step if needed).
3. Add regression tests for stale-entry removal semantics.

### 9.3 Manifest loading boundaries

#### Current

- Admin utility eagerly imports all chain manifests.
- Prediction-market modules import both chain manifests upfront.

#### Design

1. Replace static imports with dynamic loader per requested chain.
2. Keep manifest parsing/stringification inside admin route boundary.
3. Ensure `/play/*` and landing paths cannot accidentally include admin manifests.
4. For PM config, load only selected chain manifest via lazy function.

### 9.4 Schema/object churn containment

#### Current signal

- Very high `native_bind` and schema-like object counts.

#### Design

1. Audit hot paths for repeated schema construction inside render/effect loops.
2. Hoist schema definitions to module scope or singleton caches.
3. Replace repeated `.bind(...)` allocations in loops with stable callbacks where practical.
4. Instrument allocation-heavy paths for targeted iteration.

## 10. Implementation Plan (Phased)

### Phase 0: Baseline + instrumentation (1-2 days)

1. Add repeatable profiling script and test scenario.
2. Capture baseline metrics:
   - heap snapshots (start, +10m, +30m)
   - long-task count
   - bundle analyzer for `/play/*` and `/factory`
3. Publish baseline report artifact.

### Phase 1: Safe memory wins (2-3 days)

1. Replace full realm metadata import with compact map in game runtime stores.
2. Fix `MapDataStore` refresh to clear/rebuild maps.
3. Add unit tests for refresh semantics and realm-name parity.

### Phase 2: Code-splitting manifests (2-3 days)

1. Refactor admin manifest-loader to on-demand chain import.
2. Refactor PM manifest loading to active-chain-only dynamic import.
3. Validate chunk boundaries via bundle analyzer.

### Phase 3: Churn/hot-path cleanup (3-5 days)

1. Identify high-frequency schema creation points.
2. Hoist/memoize schema and bound callback creation.
3. Re-profile and compare snapshot/object counts.

### Phase 4: Harden + rollout (1-2 days)

1. Add performance regression checks to CI/release checklist.
2. Stage rollout with telemetry checkpoints.
3. Document operational dashboard and thresholds.

## 11. Testing Strategy

### 11.1 Unit tests

1. Realm lookup source returns same names as previous behavior for representative IDs.
2. `MapDataStore.refresh()` removes stale structures/armies/hyperstructure counts when absent in next fetch.
3. Manifest loader returns valid manifest JSON for each chain via lazy path.

### 11.2 Integration tests

1. Enter `/play/*`, run interactions, verify functionality parity.
2. Enter `/factory`, verify manifest display/action flows still work.
3. Switch PM chain context and verify active manifest resolution.

### 11.3 Performance tests

1. Scripted 15/30-minute scenario with periodic interactions.
2. Capture heap snapshots and compare against baseline thresholds.
3. Validate long-task count and frame stability trend.

## 12. Telemetry and Observability

1. Add lightweight counters for map sizes after refresh.
2. Emit periodic memory samples (`performance.memory` where supported).
3. Track long-task entries through PerformanceObserver.
4. Persist profile artifacts for build-to-build comparisons.

## 13. Risks and Mitigations

1. **Risk:** Clearing maps could briefly expose empty reads during refresh.
   - **Mitigation:** Build temp maps and swap atomically.
2. **Risk:** Dynamic imports introduce route-level latency.
   - **Mitigation:** Preload on route intent/hover where needed.
3. **Risk:** Realm-name source drift between artifacts.
   - **Mitigation:** Generate compact map from canonical source in build step.
4. **Risk:** Some churn originates in third-party libs.
   - **Mitigation:** Prioritize app-owned hot paths first; isolate vendor-heavy modules behind lazy boundaries.

## 14. Rollout Plan

1. Internal canary with performance dashboard (24-48h).
2. Expand to full user traffic if metrics stay within thresholds.
3. Keep rollback toggle for manifest/realm source path if regression occurs.

## 15. Release Readiness Checklist

1. Heap-growth and long-task targets met in staging profiles.
2. `/play/*` baseline chunk excludes admin manifest payloads.
3. Map refresh stale-entry tests passing.
4. Functional parity verified for player/structure naming and admin tools.
5. Engineering sign-off on profile artifact comparisons.

## 16. Initial Backlog

1. Build compact realm-name artifact and wire into game runtime stores.
2. Patch `MapDataStore.fetchAndStoreMapData()` to clear/rebuild maps.
3. Refactor admin `manifest-loader` to lazy chain imports.
4. Refactor PM manifest imports to active-chain-only dynamic loading.
5. Add performance scenario script + documentation.
6. Add CI perf guardrails for memory/chunk regressions.

## 17. Open Decisions

1. Should compact realm-name data be JSON asset or generated TS module?
2. Should map refresh use full atomic swap or synchronized in-place clear/repopulate?
3. Which exact telemetry sink should store profile artifacts for historical comparison?
4. Should PM manifest loading include prefetch on known chain at app bootstrap?

## 18. Appendix: Evidence References

- Heap snapshot file: `/Users/os/Downloads/Heap-20260222T000722.heapsnapshot`
- Runtime realms imports:
  - `client/apps/game/src/three/managers/player-data-store.ts:5`
  - `packages/core/src/stores/map-data-store.ts:28`
- Map refresh write path:
  - `packages/core/src/stores/map-data-store.ts:388`
  - `packages/core/src/stores/map-data-store.ts:456`
  - `packages/core/src/stores/map-data-store.ts:502`
  - `packages/core/src/stores/map-data-store.ts:511`
- Admin manifest eager imports:
  - `client/apps/game/src/ui/features/admin/utils/manifest-loader.ts:1`
- PM manifest eager imports:
  - `client/apps/game/src/pm/prediction-market-config.ts:2`
  - `client/apps/game/src/pm/hooks/dojo/dojo-config.tsx:3`
- Route boundaries:
  - `client/apps/game/src/app.tsx:19`
  - `client/apps/game/src/app.tsx:64`
