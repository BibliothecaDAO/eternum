# Three.js client

This folder contains Eternum's browser renderer: the world map, settlement view, fast travel, HUD, managers, effects,
and renderer instrumentation.

## Quick start

- Install dependencies at the repository root with `pnpm install`.
- Run the client with `pnpm --dir apps/game dev`.
- Exercise the maintained WebGL2 fallback with `pnpm --dir apps/game dev:webgpu:force-webgl`.

`GameRenderer` is created by the app shell and mounts into `#main-canvas`.

## Renderer contract

The game has one rendering stack: Three's `WebGPURenderer`. It selects native WebGPU when available and its maintained
WebGL2 backend otherwise. `webgpu-force-webgl` forces that fallback for testing; it is not a second scene or effects
implementation.

Player rendering has two modes, defined in `render-profile.ts`:

- **Quality** is the default full-rate mode.
- **Battery** changes only when work happens: it paces idle frames, samples distant animation less often, lowers the
  shadow-refresh floor, and narrows background prefetch.

Both modes use the same pixel ratio, model counts, materials, effects, shadows, and other visual values. A still frame
must be identical between them.

## Key entry points

- `game-renderer.ts`: renderer bootstrap, controls, frame loop, and top-level runtime ownership.
- `renderer-backend-runtime.ts`: initializes the WebGPU/WebGL2-fallback backend and handles device-loss recovery.
- `renderer-effects-runtime.ts`: owns the shared post-process plan.
- `scene-manager.ts`: switches scenes and owns transition ordering and input-surface handoff.
- `scenes/hexagon-scene.ts`: shared camera, lighting, fog, shadow refresh, input, and visibility behavior.
- `scenes/worldmap.tsx`: chunked world traversal rendered from the session spatial projection.
- `scenes/hexception.tsx`: settlement view and lazy building preview.
- `scenes/fast-travel.ts`: fast-travel traversal and its merged static grid.
- `scenes/hud-scene.ts`: renderer-owned HUD overlay.

## Frame flow

The top-level frame reads like this:

1. Apply Quality/Battery pacing at the single animation-loop boundary.
2. Update controls and the active scene.
3. Drain the shared frame-budget queue for terrain and entity presentation work.
4. Render the active scene through the backend's post-process path.
5. Render HUD and label overlays.

Input immediately leaves Battery idle pacing. Camera movement selects already-synchronized projection data and may
prepare retained render pages; it does not fetch current game truth.

## World state and chunking

Current game facts live in RECS. `WorldSpatialProjection` derives render-ready spatial indexes from RECS and is owned by
the game-sync runtime. The world map reads that projection for visible tiles, structures, armies, and chests. Scene
managers own presentation resources only; they are not alternative state stores.

Chunk geometry and retention policy live in the `worldmap-chunk-*` and `warp-travel-*` modules. A camera crossing:

1. resolves the next retained render area;
2. prepares projected terrain pages through the frame-budget queue;
3. presents the new terrain atomically;
4. updates entity managers from projection bounds;
5. schedules bounded directional prefetch.

Quality and Battery use the same visible area. Battery only narrows work prepared ahead of the camera.

## Resource ownership

The cosmetic catalog and FX caches own their source geometry and textures. Consumers own the materials they clone or
tint and their own instance buffers. The biome cache deduplicates GLTF parsing while scenes retain the shared render
resources. Renderer teardown clears scene-owned resources first, then the shared parse, cosmetic, environment, and
material caches.

Important shared owners include:

- `utils/biome-gltf-cache.ts` for deduplicated biome GLTF parsing;
- `cosmetics/asset-cache.ts` for cosmetic GLTFs and textures;
- `managers/fx-manager.ts` for ref-counted built-in FX textures;
- `utils/material-pool.ts` and the instanced attribute/matrix pools.

Do not dispose cosmetic- or FX-cache-owned geometry or textures from a scene manager.

## Performance and diagnostics

- `frame-budget-work-queue.ts` slices heavy presentation commits across frames.
- `shadow-refresh-policy.ts` refreshes shadows only for sun, content, or camera-cell changes.
- `perf/renderer-gpu-telemetry.ts`, `stats-recorder.ts`, and world-map diagnostics provide DEV-only measurement.
- `compact-entity-label-renderer.ts`, the fast-travel grid, and `PathRenderer` share or retain GPU resources to avoid
  per-entity draw/material churn.

Keep DEV instrumentation out of production paths and preserve the forced-WebGL smoke whenever renderer ownership or
effects code changes.
