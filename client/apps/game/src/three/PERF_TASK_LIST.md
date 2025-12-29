# Performance Task List and Rollout Plan

Scope: Three.js client in `client/apps/game/src/three`

## Findings Summary (from audit)

- Hover picking uses per-mousemove raycast over instanced hex mesh (O(n_hexes))
- Label visibility updates do full DOM add/remove pass on camera change (O(n_labels))
- Centralized visibility beginFrame is called multiple times per frame
- Biome morph animation writes full morph texture each update (O(n_instances \* morphTargets))
- Visibility cache uses string keys with per-call allocations
- FX system runs per-instance rAF loops for troop diff, plus per-frame DOM text updates
- Small per-frame allocations in day/night and HUD update loops

## Task List

1. Replace hover raycast with analytic picking (or GPU picking) - Complete
   - Impact: High CPU reduction during mousemove
   - Complexity: Medium
   - Files: `scenes/hexagon-scene.ts`, `managers/interactive-hex-manager.ts`, `utils/utils.ts`
   - Notes: Implemented analytic ray-plane picking with raycast fallback for edge cases

2. Reduce label DOM churn during camera movement - Complete
   - Impact: High main-thread stability while panning
   - Complexity: Medium
   - Files: `managers/army-manager.ts`, `managers/structure-manager.ts`
   - Plan: throttled visibility refreshes to reduce per-frame churn during camera movement

3. Ensure CentralizedVisibilityManager beginFrame runs once per frame - Complete
   - Impact: Medium CPU improvement, better cache reuse
   - Complexity: Low
   - Files: `scenes/worldmap.tsx`, `scenes/hexagon-scene.ts`, `utils/centralized-visibility-manager.ts`
   - Plan: beginFrame is now called once at the start of scene update

4. Biome animation scalability (morph texture updates)
   - Impact: High CPU/GPU reduction at scale
   - Complexity: High
   - Files: `managers/instanced-biome.tsx`, `managers/instanced-model.tsx`
   - Plan: shader-driven animation with time uniform + per-instance phase, LOD by distance

5. Visibility cache key allocations
   - Impact: Medium GC reduction in label-heavy scenes
   - Complexity: Medium
   - Files: `utils/centralized-visibility-manager.ts`
   - Plan: use WeakMap keyed by Box3/Sphere/Vector3 or stable numeric ids

6. FX system consolidation
   - Impact: Medium CPU reduction during combat spikes
   - Complexity: Medium
   - Files: `managers/fx-manager.ts`
   - Plan:
     - Move TroopDiffFXInstance off per-instance rAF into FXManager.update
     - Throttle label text updates to 2-4 Hz or CSS animation
     - Consider migrating common FX to BatchedFXSystem to reduce draw calls

7. Micro allocations in hot loops
   - Impact: Low but steady GC reduction
   - Complexity: Low
   - Files: `effects/day-night-cycle.ts`, `scenes/hud-scene.ts`
   - Plan: reuse scratch Vector3s in update paths

## Rollout Plan

Phase 0 - Baseline + instrumentation (0.5 day)

- Capture baseline: hover + pan + combat spike
- Log: `renderer.info.render.calls`, `triangles`, `textures`
- Record main thread and GC in Chrome Performance
- Define target budgets (16 ms frame, <2 ms hover, no GC spikes during pan)

Phase 1 - Quick wins (1-2 days)

- Task 3: single beginFrame per tick
- Task 6a/6b: consolidate troop diff updates, throttle label text updates
- Task 7: reuse scratch vectors in day/night + HUD
- Verify: reduced scripting time during idle and hover

Phase 2 - Mid-size optimizations (2-4 days)

- Task 2: label visibility diff and reduced DOM add/remove
- Task 5: visibility cache without string keys
- Task 1: analytic hover picking (if flat grid)
- Verify: stable frame time while panning; hover cost <1 ms at 2k hexes

Phase 3 - Larger refactors (1-2 weeks)

- Task 4: shader-driven biome animation + distance LOD
- Task 6c: migrate common FX to BatchedFXSystem
- Verify: lower draw calls; reduced CPU/GPU cost at 5k+ instances

## Success Criteria

- Main thread stays under 16 ms for pan + hover at target object counts
- No visible input latency while hovering/panning
- No recurrent GC spikes during camera movement
- FX spikes do not cause frame hitches during combat
