# Render Overhaul P2 Codex Brief — Cold Paths, Triangle Diet, Sync Slicing

Context: P0+P1 (`docs/plans/render-overhaul-p0-p1-codex-brief.md`) landed in `80ab529b0e` and passed every merge gate on
real GPU (2026-08-16, Brave/WebGPU, bltz-blip-72 spectate): tab memory 1.65 GB after 10 min (gate 3.5 GB, baseline 5.8
GB), `updateTexture` absent from steady-state windows (baseline ~150 ms/s), warm-path `critical terrain pages took 0ms`
on every chunk crossing, catch-ups converge in 100–130 ms sliced wall time, heap 727→747 MB over a 35 s recorder run.
Baseline for this brief = `feat/sync-s4-deletions` at `0d88573396` (includes the spectator/sync hardening commit).
Companion: `client/apps/game/src/three/GRAPHICS_OPTIMIZATION_PLAN.md` (June plan) — where an item overlaps, the June
detail is authoritative on mechanism. KISS applies; every deliverable lands with its measurement gate or it doesn't
land. AGENTS.md Engineering Principles govern: fix classes at chokepoints, never instances at call sites. Do NOT start
Part III (Quality/Battery settings) — it lands only after this brief's gates are green.

Measurement protocol: identical to P0+P1 brief (recorder `Ctrl+Shift+R`/`Ctrl+Shift+S`, `[WorldmapPerf]` +
`[GpuBackendPerf]` console lines, Chrome task manager after 10 min). Report before/after triples per deliverable.

## P2 items (ranked)

1. **Cold terrain-window build < 1 s.** Owner-flagged. Evidence:
   `[WorldmapPerf] visual window rebuild took 3019ms (retention=0ms, criticalPages=3018ms, composite=1ms, critical=1, pages=16)`
   on cold entry — hidden by the loading gate today, but the same cold path runs on warps to unexplored regions, where
   it becomes ~3 s of visible terrain pop-in. Mechanism: `buildCriticalVisualTerrainPages` (`worldmap.tsx:5179`) builds
   the critical pages **sequentially** — each `buildAndApplyVisualTerrainPage` awaits `prepareVisualTerrainPage` then
   the queued commit before the next page starts, ~190 ms/page × 16. Levers, in order of preference:
   - Overlap the prepares: run N page prepares concurrently (prepare is already async and worker-backed); commits stay
     serialized through the frame-budget queue. Bound N via the existing `prefetch.maxConcurrent` policy knob — no new
     config.
   - Pre-warm warp destinations: fast-travel knows the target chunk before the camera moves — push the destination's
     critical pages through the existing prefetch lane (`worldmap.tsx:5059` pattern) while the warp transition plays.
   - Only if the above two miss the gate: profile inside `prepareVisualTerrainPage` and trim the top cost.
   - Gate: cold-entry `criticalPages` component < 1000 ms; warp to an unexplored region either reports < 300 ms for its
     critical pages or shows no visible terrain pop-in after the transition overlay drops (owner visual check).

2. **Zoom-out triangle diet.** Evidence: recorder max 18.75 M triangles at max zoom-out vs 5.26 M session average — max
   zoom-out draws ~5× the typical scene and correlates with the fps dips. The bulk is forest/tree biome instances that
   are sub-pixel at that distance. Direction: distance-gated instance thinning or a low-poly LOD swap for the heaviest
   biome models at far zoom — June plan Phase 5/6 mechanisms apply; keep it at the `InstancedBiome` chokepoint (one
   policy, not per-model hacks). No visual change at default play zooms.
   - Gate: max-zoom-out triangles ≤ 9 M (≥ 50% cut vs 18.75 M baseline); no visible difference in before/after
     screenshots at the default and close zoom levels; recorder fps min at max zoom-out reported before/after.

3. **Sync apply slicing (sync×render).** Evidence: `GameSyncMetrics.maxBatchApplyDurationMs = 297ms` — a single
   main-thread task during snapshot recovery, the prime suspect for the recorder's fps min of 2.7. Two chokepoints:
   - Client fan-out: army-manager runs `refreshVisibleArmyCollection()` + `updateVisibleArmyBuffers()` per projection
     change (`army-manager.ts:917`, `1644`, `2130`, plus the callbacks at `1536`/`1539`). Coalesce to a per-frame
     dirty-set flush: changes mark a dirty set; one flush applies them before render. Structure equivalent if the same
     pattern exists there.
   - Core batch apply: `game-sync-runtime.ts` applies a whole snapshot page in one synchronous task. Slice the apply
     loop with a time budget (yield between slices) so no single task exceeds ~50 ms; the existing metrics line is the
     measurement.
   - Gate: `maxBatchApplyDurationMs` < 100 ms across entry + a 10-minute session; zero remaining per-change
     `refreshVisibleArmyCollection` call sites (single flush chokepoint); recorder fps min during entry recovery
     reported before/after.

4. **Warp-travel resume race.** Evidence (twice per session, on hex→map return):
   `Failed to update visible chunks while resuming worldmap scene: Error: World map did not finish its initial interactive refresh`
   at `worldmap.tsx:4342` ← `refreshWarpTravelScene` (`worldmap.tsx:4220`) — `updateVisibleChunks(true)` returns `false`
   when a refresh is already in flight, and resume treats that as fatal. Fix the class: resume should join the in-flight
   refresh (await the pending promise) instead of throwing on the busy signal. It currently recovers by accident; make
   it recover by design.
   - Gate: 10 hex↔map round trips (mixed fast/slow) with zero console errors and correct chunk state after each.

5. **Residual heap growth hunt.** Evidence: recorder `growthMBPerSecond = 0.53` in steady play (spikes during chunk
   loads are fine — GC reclaims them). Not dangerous, but it's the last standing memory signal. Method: three-snapshot
   heap diff in DevTools (idle on worldmap, then a pan loop), identify the top retained-growth class, fix it at its
   chokepoint. June plan Phase 3 (allocation diet) and Phase 4 (session-lifetime growth) list the known suspects — check
   those first before profiling blind.
   - Gate: recorder `growthMBPerSecond` < 0.1 idle and < 0.3 during active panning over a 60 s run.

## Out of scope

- Part III Quality/Battery settings (fps cap, temporal levers) — separate brief after P2 gates are green.
- Torii `SubscribeEntities` HTTP2 reconnect after background idle — sync workstream, tracked separately.
- June Phase 5.2–5.5 asset residency — backlog; the 2 GB tab-memory target is already met.

## Checks

- `pnpm test` + `pnpm typecheck` green in `client/apps/game`; `packages/core` tests green for item 3.
- `pnpm run format` + `pnpm run knip` green at root.
- Measurement protocol before/after in every PR; a gate that regresses blocks merge.
- No new settings, flags, or abstraction layers; reuse the frame-budget queue and existing policy knobs.
