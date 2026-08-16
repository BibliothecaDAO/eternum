# Render Overhaul P0+P1 Codex Brief — Re-baseline + Big Levers

Context: S5 Render Overhaul audit (owner-ratified 2026-08-15, artifact
https://claude.ai/code/artifact/2864d00d-f91f-420b-9f87-6f26c52a550d). Companion:
`client/apps/game/src/three/GRAPHICS_OPTIMIZATION_PLAN.md` (June 2026 deep review, 184 verified findings) — read it; its
line numbers predate S4 but the findings are precise. Where a P1 item overlaps a June item (pool caps = its 4.3,
interactive-hex = its 6.5, partial uploads = its 6.3 class), the June detail is authoritative on mechanism. Baseline =
`feat/sync-s4-deletions` plus the Aug 15 perf commits (partial instance-buffer uploads, shadow-intensity policy,
matrix-pool budget, spectator session module) — do not start until those are committed. KISS applies; every deliverable
lands with its measurement gate or it doesn't land. AGENTS.md Engineering Principles govern: fix classes at chokepoints,
never instances at call sites.

## Measurement protocol (used by every gate)

In a dev session on the worldmap with `?dev=1`:

1. `Ctrl+Shift+R` → play/browse 60s (include two max-zoom round-trips + two chunk-crossing pans) → `Ctrl+Shift+S`, keep
   the JSON (fps min/avg, heap start/end, geometry/texture deltas).
2. Console: collect all `[WorldmapPerf]` and `[GpuBackendPerf]` lines from the run.
3. Chrome task manager (Shift+Esc): tab memory after 10 min.

Report before/after triples per deliverable in the PR description. The recorder and backend timers already exist
(`stats-recorder.ts`, `webgpu-renderer-backend.ts` `instrumentWebGpuBackendHotPaths`).

## P0 — Re-baseline

1. **three r182 → r184.** Bump `three` in `client/apps/game/package.json`, fix compile breaks only (no opportunistic
   refactors). Upstream r184 eliminates per-frame object allocation (~240–500k objects/s at our scene shape) — this is
   the point of the bump.
   - Checks: `pnpm test` green in `client/apps/game` (renderer suites especially `src/three/**`), typecheck green, game
     boots on worldmap + hexception + fast-travel, WebGPU AND forced-WebGL fallback
     (`VITE_PUBLIC_RENDERER_BUILD_MODE=experimental-webgpu-force-webgl`) both render.
   - Gate: measurement protocol run; report heap sawtooth (max−min over 60s) vs baseline (~275 MB) and fps min.
2. **Tracing off in prod.** Verify `VITE_TRACING_ENABLED` is unset/false in every production build path (vercel.json,
   deploy env, `.env.production`). The OpenTelemetry `ZoneContextManager` wraps the entire event loop
   (`src/tracing/tracer.ts:131`) — it must never ship enabled to players.
   - Gate: `pnpm build` output contains no active zone patching at boot (verify via a preview-build console: no
     `@opentelemetry_context-zone` frames in a stack sampled from DevTools).
3. **Texture-upload attribution.** Extend `instrumentWebGpuBackendHotPaths` so `updateTexture` logs the texture's
   `name`/dimensions once per distinct texture per report window. Baseline shows ~150 ms/s across 70–80 calls — we need
   the offender names before P1.2.
   - Gate: one console line naming the top texture(s) by accumulated ms. No behavior change.
4. **`uv` mismatch fix.** `THREE.AttributeNode: Vertex attribute "uv" not found on geometry` fires on every shader build
   of one transparent worldmap object (renders in `_renderTransparents`). Hunt: break on that warn in DevTools, walk up
   to the `RenderObject` and read `object.name`/material. Fix by removing the uv-sampling node from that material or
   adding the missing uv attribute — whichever is the smaller change.
   - Gate: warning gone across entry + zoom round-trip.

## P1 — Big levers

5. **KTX2 texture pipeline.** All 120 GLBs under `client/public/models` carry uncompressed PNG/JPG textures (zero KTX2
   in the repo; 43 MB `cosmetics/low-res/0x1011401.glb` is the outlier to audit first).
   - Build step: `gltf-transform` script (new `client/apps/game/scripts/compress-models.mjs` or repo-level tool): ETC1S
     for albedo/emissive, UASTC for normal/ORM, resize anything above 1024px unless flagged hero. Committed outputs
     replace the originals (keep originals retrievable via git history; no dual shipping).
   - Loader: wire `KTX2Loader` (with basis transcoder assets served locally, not CDN) into the GLTF loading path; verify
     WebGPU picks compressed formats (BC on desktop, ASTC mobile).
   - Gate: tab memory after 10 min on worldmap < 3.5 GB (baseline ~5.8 GB); no visible quality regression on the top-10
     landmarks at Close view (before/after screenshots in PR); model payload size reported (target: `public/models`
     under 80 MB).
6. **Texture churn fix.** Using P0.3's attribution: make every per-frame-updating canvas/data texture dirty-flagged —
   upload only when content actually changed. If the offenders are the entity-label canvases, batch them into one
   `DataArrayTexture` with per-layer `addLayerUpdate` uploads instead of N standalone textures.
   - Gate: `[GpuBackendPerf]` updateTexture accumulated time < 15 ms/s in steady play (baseline ~150 ms/s).
7. **Frame-budget scheduler for chunk-derived work.** Generalize the rAF-yield seed in
   `worldmap.tsx buildCriticalVisualTerrainPages`: one shared time-sliced queue (~6 ms/frame budget, priority lanes
   critical > visible > prefetch) that ALL chunk-derived work rides — terrain page builds, army/structure catch-up
   instantiation (`worldmap-critical-manager-catchup-runtime.ts`, `army-manager.ts` `ensureArmyPresentation` bursts,
   structure equivalent), label creation. Entry runs the same queue behind the loading gate with a raised budget (~24
   ms/frame) so the gate's progress bar stays honest.
   - Keep it ONE queue with lanes, not per-manager queues (KISS; single place to reason about starvation).
   - Gate: catch-up logs report sliced wall-clock convergence latency and are not compared with the old <100 ms blocking
     threshold; entry critical-page line < 1 s; no missing or flickering armies/structures after a fast pan (visual
     check + existing manager tests green).

## Checks

- `pnpm test` + `pnpm typecheck` green in `client/apps/game`; touched-package tests green.
- Measurement protocol before/after in every PR; a gate that regresses blocks merge.
- No new settings, flags, or abstraction layers beyond the single work queue in item 7.
