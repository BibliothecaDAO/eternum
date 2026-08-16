# Render Overhaul P3 Codex Brief — Warm-up, Battery Mode, Draw-Call Diet, Cleanup

Context: P0+P1 (`80ab529b0e`) and P2 (`7b06eb12ee`) landed and passed every gate on real GPU (2026-08-16): tab
memory 1.86 GB stable after 1 h (baseline 5.8 GB), steady-state heap growth 0.02 MB/s (was 0.53), zero
texture/program churn in steady play, max zoom-out triangles 7.8 M (was 18.75 M), cold terrain 979 ms, warm 0 ms,
`maxBatchApplyDurationMs` 9.2 ms (was 297 ms). This brief is the closing batch: the last user-felt hitch, the
owner-ratified video-settings endgame, the June-plan remainder, and the cleanup that the endgame unlocks. Baseline =
`feat/sync-s4-deletions` at `7b06eb12ee`.

Companion: `client/apps/game/src/three/GRAPHICS_OPTIMIZATION_PLAN.md` (June plan) — authoritative on mechanism where an
item overlaps, but its line numbers predate S4/P2: **verify every anchor before editing**. KISS applies; every
deliverable lands with its measurement gate or it doesn't land. AGENTS.md Engineering Principles govern: fix classes at
chokepoints, never instances at call sites.

Measurement protocol: identical to the P0+P1 brief (recorder `Ctrl+Shift+R`/`Ctrl+Shift+S`, `[WorldmapPerf]` +
`[GpuBackendPerf]` console lines, Chrome/Brave task manager). Report before/after triples per deliverable.

## P3 items (ranked)

### 1. Pipeline warm-up (kills the two remaining user-felt freezes)

Evidence: the first max zoom-in and the first switch to local view each freeze once per session (owner-confirmed
first-only, so it is compile, not upload). `[GpuBackendPerf]` shows the burst on first hexception entry:
`createRenderPipeline 18x + createProgram 12x + createBindings 195x` in one window; recorder fps min 3.1 is this
moment. Repeat crossings are smooth — the pipelines just need to exist before the player gets there.

- Mechanism: three r184 `WebGPURenderer` exposes `compileAsync(scene, camera)`; the codebase already uses it in the
  postprocess policy (`three/webgpu-postprocess-policy.test.ts` documents the contract). During the worldmap loading
  gate (before `hasInitialized` flips), run `compileAsync` with the camera at a close-view pose so the close-zoom
  material/shadow variants compile behind the gate. Warm hexception during its first scene-transition overlay (not at
  bootstrap — see item 4.d), same mechanism.
- Shadow-pass variants compile when the shadow map renders: if `compileAsync` alone doesn't cover them, render 1–2
  warm-up frames to the (still-hidden) canvas at the close-view pose behind the gate. Prefer the smaller change.
- Gate: a session including the FIRST max zoom-in and FIRST local switch shows recorder fps min > 20 and no
  `[GpuBackendPerf]` pipeline/program burst outside loading/transition windows. Owner feel-check: no freeze on either
  first.

### 2. Quality/Battery video settings (Part III — owner-ratified design, quoted rules are law)

The rules, verbatim from the owner ruling: **no auto/adaptive anything, anywhere.** Two modes only, **Quality**
(default) and **Battery**. The law: *"Battery changes when/how often work happens, never what pixels look like."*
Temporal levers only. Forbidden in Battery: DPR drops, `maxVisible*` caps, shadow/effect removal — anything a
screenshot could detect. The tier system dies entirely.

- a. **Delete the tier system.** `three/utils/quality-controller.ts` (704 lines) is deleted, not repaired — this
  supersedes June 6.4. The `GraphicsSettings` enum lives in `@/ui/config`; there are ~138 non-test references across
  `renderer-display-runtime.ts`, `renderer-effects-runtime.ts`, `renderer-effects-bridge-runtime.ts`,
  `game-renderer.ts`, `game-renderer-runtime-assembly.ts`, `renderer-scene-orchestration.ts`, `worldmap.tsx`,
  `hexagon-scene.ts`, `instanced-biome.tsx`, and the two settings UIs. Every tier-keyed table (effects strength, DPR,
  etc.) collapses to its HIGH-equivalent value for everyone — visuals are never a setting again. Replace the enum with
  one `RenderProfile` object: `{ mode: "quality" | "battery" }` plus the derived pacing constants, one module, no
  layers.
- b. **Battery levers** (each must be invisible in a still screenshot — that is the acceptance test):
  - Frame pacing at the single rAF chokepoint (`game-renderer.ts:515` / `renderer-animation-runtime.ts`): while
    input-idle (no camera motion, no pointer interaction for ~2 s) render at 30 fps; return to full rate on
    interaction. No intermediate states, no heuristics beyond the idle timer.
  - Distance-gated animation sampling: widen the existing animation bucket strides/intervals (`instanced-biome.tsx`
    already has the bucket machinery) for instances beyond close view. Temporal only — weights still land on the same
    values, just sampled less often.
  - On-change shadow refresh: re-render the shadow map when sun/content/camera-cell changes rather than every frame.
    Build it as the shared policy in both modes if the visual result is identical; Battery merely lowers the refresh
    floor. (This lever is also the fix surface for item 5.)
  - Narrow prefetch: reduce the directional prefetch ring via the existing `prefetch` policy knobs in
    `worldmap-chunk-policy.ts`. Fewer pages warmed, nothing looks different.
- c. **Settings UI**: the tier button rows in `ui/modules/settings/settings.tsx` and
  `ui/features/landing/components/landing-settings.tsx` become a single Quality/Battery toggle. Migration: read the
  old `GRAPHICS_SETTING` localStorage key once, map anything to Quality, write the new key, delete the old one.
- Gate: (1) pixel-identical screenshots Quality vs Battery on the same still scene (the law, made testable);
  (2) idle-worldmap tab CPU in the task manager reported for both modes — expect a large Battery reduction (the render
  loop currently burns ~60–76 % of a core uncapped); (3) `grep` zero remaining `GraphicsSettings`/`GRAPHICS_SETTING`/
  `quality-controller` references outside the June plan document; (4) recorder run in Battery shows paced fps without
  hitches on interaction resume.

### 3. Draw-call diet (June Phase 6 remainder; verify anchors first)

Evidence: draws average 189 but peak 260 in ordinary play; the June audit found three structural offenders. Behavior
and pixels unchanged for all three.

- a. **Shared label materials** — `compact-entity-label-renderer.ts:124` allocates one transparent
  `MeshBasicMaterial` per visible label (a draw call each, plus material churn). Share one material per texture
  cacheKey and dispose it with the texture in `releaseTexture`. Also stop copying the camera quaternion into every
  label mesh unconditionally per frame — copy on camera change. The texture-atlas batch is explicitly OUT of scope.
- b. **Fast-travel grid merge** — June found 324 `LineSegments` in 324 Groups for a static hex outline grid. The file
  has drifted since S4: verify the current shape in `scenes/fast-travel.ts` first; if S4 already merged it, close this
  as done in the PR note. Otherwise bake one merged `BufferGeometry`/single `LineSegments`, translate on chunk
  crossing.
- c. **Incremental PathRenderer** — `managers/path-renderer.ts` gained a dirty-flag deferred rebuild (line ~63), but
  the rebuild itself still disposes and reallocates every batch geometry/material on any single path change (fires per
  army movement start, including other players'). Preallocate per-displayState buffers at `config.maxSegments`, write
  sub-ranges with `addUpdateRange` + `setDrawRange`, cache the 4 materials.
- Gate: draw-call count (recorder/HUD) before/after in a label-heavy view and in fast-travel view; no visual change.

### 4. Asset residency remainder (June Phase 5.2/5.3/5.4; ownership rule applies)

The rule that governs all three (June Phase 5, verbatim): *cache owns geometry/textures; consumers own clones of
materials they tint.* The audit found both directions violated — these fixes also close latent double-dispose bugs.

- a. **Cosmetics preload double-copy** — `cosmetics/asset-cache.ts` (`preloadAllCosmeticAssets`, line ~162): preload
  parses and permanently retains a second copy of every army/structure GLB; its dispose path never frees GLTF
  geometries/embedded textures and is never invoked. Reuse the same cache entry for preload and runtime, implement
  real disposal, call it at renderer teardown, and stop consumers disposing cache-owned geometry (verify the June
  anchors in `structure-manager.ts` / `army-model.ts` — they have moved).
- b. **Lazy, deduped BuildingPreview** — `managers/building-preview.ts` is constructed in HexceptionScene's
  constructor and re-parses the building catalog HexceptionScene already loads. Load lazily on first
  `setPreviewBuilding(type)`, dedupe by path, ideally clone from HexceptionScene's meshes (share geometry/textures,
  clone only tinted materials).
- c. **FX texture dedup** — `managers/fx-manager.ts`: each FXManager instance loads its own copies of the 5 built-in
  FX textures. Module-level texture cache. (June's "gate by tier" half of this item dies with the tiers — dedup only.)
- d. **(Stretch) Defer the Hexception catalog** — June 5.5: the entire building/realm/wonder/hyperstructure catalog
  loads at startup. Defer to first Hexception entry. If taken, coordinate with item 1: the hexception warm-up then
  runs after the deferred load, behind the same first-transition overlay.
- Gate: heap after bootstrap on worldmap before/after (expect a visible drop); hexception first entry visually
  unchanged; no double-parse (instrument with a counter or the network panel).

### 5. Shadow-blob bug (open since Aug 15, fix rides item 2's shadow lever)

Evidence: dark detached shadow blobs at max zoom-in over unexplored hexes (screenshots in the Aug 15 session).
Hypotheses: a stale frozen shadow map that the refresh policy holds while the camera moves into unexplored terrain, vs
legitimate long tree shadows at low sun angle. Since item 2.b builds the on-change shadow refresh policy, root-cause
here rather than patching: make terrain-content change (new chunk entering the shadow frustum) a refresh trigger and
confirm the blobs die with it. If they turn out to be legitimate tree shadows, say so with screenshots and close the
issue instead.

- Gate: max zoom-in over unexplored hexes shows no detached blobs; before/after screenshots in the PR.

### 6. Cleanup sweep (after item 2's deletions land)

- Delete `three/utils/quality-controller.ts`, the `GraphicsSettings` enum in `@/ui/config`, every tier-keyed table,
  and the old localStorage key (item 2 does most of this; the sweep verifies nothing survived).
- `GRAPHICS_OPTIMIZATION_PLAN.md`: add a status header recording what P0–P3 closed (Phases 1, 2, 4.3/6.3/6.5-class,
  5.1; 6.4 superseded by deletion) and pointing to the three brief files for the record. Keep the document — it is the
  audit of record — but it must stop claiming open work that is done.
- Root `pnpm run knip` green after the deletions; remove every orphaned export it flags.
- Grep gates: zero `GraphicsSettings` / `GRAPHICS_SETTING` / `quality-controller` references outside
  `GRAPHICS_OPTIMIZATION_PLAN.md` and `docs/plans/` history.
- Do NOT touch: the forced-WebGL fallback (`VITE_PUBLIC_RENDERER_BUILD_MODE=experimental-webgpu-force-webgl` must
  still boot and render), the DEV-only GPU instrumentation, the `docs/plans/` briefs.

### 7. Decommission the legacy WebGL renderer stack (owner-ratified; the WebGL2 fallback backend STAYS)

Two different "WebGL"s exist in the codebase; only one dies. The `legacy-webgl` build mode is a full parallel stack:
classic `WebGLRenderer` in `three/renderer-backend.ts` (~309 lines), a separate composer on the `postprocessing` npm
package in `three/webgl-postprocess-runtime.ts` (~245 lines), the `three` vs `three/webgpu` build aliasing in
`renderer-build-mode.ts` / `vite.config.ts`, the root `package.json` `packageExtensions` shim for `postprocessing`,
and a renderer-mode user preference in `ui/modules/settings/settings.tsx` (`RENDERER_MODE_STORAGE_KEY`). The WebGPU
build has carried the entire perf program and every gate; the escape hatch has served its purpose.

- Delete: the `legacy-webgl` mode from `RENDERER_BUILD_MODES`, `renderer-backend.ts`, `webgl-postprocess-runtime.ts`,
  the renderer-mode picker + localStorage preference (migrate silently: ignore and remove the stored key), the
  `postprocessing` dependency and its `packageExtensions` entry — verify `renderer-effects-runtime.ts` /
  `constants/rendering.ts` imports from `postprocessing` and unpick or inline what the WebGPU path actually uses.
- KEEP: the WebGL2 fallback backend inside `WebGPURenderer` (`webgpu-renderer-backend.ts` `"webgl2-fallback"`) — it
  is what players without WebGPU (blocklisted drivers, older Safari/Firefox, some Linux) get, it shares the whole
  render path, and it is upstream-maintained. `force-webgl` stays as its test mode.
- Rename the surviving modes to drop the `experimental-` prefix (`webgpu-auto`, `webgpu-force-webgl`), accepting the
  old names as aliases so existing env files/deploys don't break; update `.env.*` files in the same PR.
- Add one PostHog event at renderer init recording the resolved backend (`webgpu` vs `webgl2-fallback`) so a later
  decision about the fallback itself is made with data.
- Gate: `webgpu-auto` and `webgpu-force-webgl` both boot and render worldmap + hexception; `pnpm build` succeeds with
  the `postprocessing` dependency gone; zero `legacy-webgl` references; bundle-size delta reported.

## Sequencing

1 first (independent, user-felt, small). Then 2, with 5 riding its shadow lever. 3 and 4 are independent of both and
of each other. 7 is independent and pairs naturally with 6. 6 last — it is the verification sweep for 2's and 7's
deletions. One PR per numbered item is fine; do not bundle 2, 6, or 7 into one commit with 3/4.

## Out of scope

- Torii `SubscribeEntities` HTTP2 reconnect after background idle — sync workstream.
- The army "Cannot travel/explore" bug — needs a live game session to reproduce.
- Render-bundle spike (audit F9) and the label texture atlas (3.a long-term) — backlog.
- Any adaptive/auto behavior, any render-on-demand beyond the Battery idle pacing in 2.b.

## Checks

- `pnpm test` + `pnpm typecheck` green in `client/apps/game`; touched-package tests green.
- `pnpm run format` + `pnpm run knip` green at root.
- The `webgpu-force-webgl` fallback backend boots and renders after items 2 and 7 (the WebGL2 backend must survive
  the legacy-stack deletion).
- Measurement protocol before/after in every PR; a gate that regresses blocks merge.
- No new settings, flags, or abstraction layers beyond the single Quality/Battery mode and its one RenderProfile
  module.
