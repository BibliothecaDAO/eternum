Overview

- Render orchestration is centralized in game-renderer.ts (EffectComposer

* two scene layers + HUD), with world content managed by WorldmapScene/ HexagonScene derivatives and a stack of managers
  (armies, structures, minimap, FX, etc.).

- The architecture already leans on instancing/pooling for geometry and materials, but several subsystems still execute
  large per-frame JS workloads, allocate transient objects, and spin their own animation loops, which keeps CPU time and
  GC pressure high—especially when many entities or UI overlays are present.
- Memory monitoring hooks exist, yet a few long-lived singletons, event listeners, and data caches never shrink, so heap
  usage continues to climb during long play sessions.

Findings – CPU Hotspots

- Minimap redraw loop (managers/minimap.ts): WorldmapScene.update() calls minimap.update() every frame, and draw()
  repaints every SQL tile (iterating this.tiles, clustering, filling rectangles) plus reclusters based on Math.random()
  even when nothing changed.
- Instanced animation churn (managers/instanced-biome.tsx, managers/ instanced-model.tsx): updateAnimations walks every
  instance (mesh.count) and calls setMorphAt each update (20 FPS), re-uploading entire morph textures for all
  biomes/structures even if animations are idle.
- Per-effect RAFs (managers/resource-fx-manager.ts, managers/fx-manager.ts): Each resource/fx instance spins its own
  requestAnimationFrame, updates DOM labels, and never shares timers, so a flurry of events spawns dozens of RAF loops
  and layout passes.
- Attachment + label updates (managers/army-manager.ts): update() recomputes attachment transforms and CSS2D label
  positions for every visible army each frame, cloning vectors (position.clone(), new Euler, new Color) and recomputing
  biome-based model selection (getModelTypeForEntity).
- Chunk generation path (scenes/worldmap.tsx): updateHexagonGrid still runs synchronously on the main thread, calling
  MatrixPool.getMatrix() thousands of times per chunk, logging per-biome counts, and writing to instanced meshes
  serially; ArmyManager.executeRenderForChunk immediately follows with more allocations/logging.
- Multiple CSS2D renders per frame (game-renderer.ts): labelRenderer.render is called for WorldMap/Hexception, then
  again for HUD, while HUD labels also rely on CSS2DObjects—triggering three layout/paint passes per frame.

Findings – Memory & GC

- Buffer re-allocation in particles (managers/particles.ts): update() rebuilds the position attribute every frame with
  new Float32BufferAttribute, creating a new GPU buffer and leaving the old one for GC/driver cleanup.
- Event/listener leaks (game-renderer.ts, scenes/worldmap.tsx): window.addEventListener("resize",
  this.onWindowResize.bind(this)) uses a fresh bound function, so removeEventListener in destroy() never unregisters;
  document focus/blur and window.addEventListener("urlChanged", …) listeners are never removed.
- Unbounded world caches (scenes/worldmap.tsx): Maps such as exploredTiles, armyHexes, structureHexes, questHexes, and
  chestHexes only grow; chunk switches remove rendered instances but keep metadata forever, so long sessions leak heap.
- Singleton pools never trimmed (utils/matrix-pool.ts, utils/ instanced-matrix-attribute-pool.ts): Pool sizes only grow
  with ensureCapacity; even after chunks are released the pools retain thousands of Matrix4 objects/Float32 arrays.
- CSS2D label churn in FX (resource-fx-manager.ts): Every resource popup creates DOM nodes with Tailwind classes and
  removes them later, but there’s no pooling—GC spikes occur when large battles drop many resource FX.

Findings – Renderer/Draw Calls

- Shadow/resolution defaults: HexagonScene.configureDirectionalLight() keeps 2048² cascaded shadows and enables
  castShadow even when running on medium settings, while GameRenderer still builds bloom + vignette passes for mid/ high
  settings.
- HUD & world label layering: Sharing one CSS2DRenderer for both 3D scenes and HUD means the DOM tree is re-sorted three
  times per frame; HUD labels could live in their own renderer or be migrated to GPU sprites.
- Resource FX sprites: Every popup is a sprite + CSS2D label rendered on top of the scene, adding draw calls and CPU
  layout; batching would reduce overhead.

Findings – Asset/Loading

- Full-map polling (managers/minimap.ts): fetchTiles() hits sqlApi.fetchAllTiles() every 10 s regardless of camera
  region, normalizes all tiles, and logs timings; results feed directly into per-frame draw loops.
- Environment maps/textures: applyEnvironment() loads models_env.hdr at runtime and both Minimap/FX rely on uncompressed
  PNG sprites—no use of Basis/ KTX or mipmap-aware pipelines, so GPU memory and download sizes stay high.

Recommendations

- Throttle & cache the minimap: Move terrain drawing into an offscreen canvas that only updates when tile data or
  zoom/center changes, and render the cached bitmap each frame (drawImage) rather than redrawing tiles. Tie clustering
  to deterministic camera zoom deltas (remove Math.random() in update()) and debounce SQL polling to changed chunks or
  Torii diffs. Expect ~5‑8 ms/frame saved when thousands of tiles are visible.
- Fix event lifetimes: Store handler references (this.handleResize = this.onWindowResize.bind(this)) and unregister them
  in destroy(). Remove the document focus/blur listeners or gate them behind setup/teardown. Also unregister the
  window.urlChanged listener when the world scene is destroyed. This prevents duplicate listeners after hot reloads and
  shrinks heap usage over time.
- Eliminate per-frame BufferAttribute reallocation: In Particles.update, write into the existing typed array
  (geometry.attributes.position.array) and only set .needsUpdate = true. Apply the same pattern anywhere else we
  reassign attributes (e.g., SelectionPulseManager clones). This removes a 30× per-frame GPU buffer churn and associated
  GC spikes.
- Centralize FX animation loops: Replace per-instance RAFs in ResourceFXInstance/FXInstance with a single manager-driven
  tick (hooked into GameRenderer.animate). Keep lightweight update(elapsed) hooks per effect and manage them via a pool
  so bursts of rewards don’t create dozens of RAF callbacks + DOM allocations.
- Reduce getWorldPositionForHex allocations: Provide an overload that writes into a supplied Vector3 (e.g.,
  getWorldPositionForHex(hex, outVec)), reuse scratch vectors in hot loops (ArmyManager, StructureManager, Minimap.draw,
  FX managers). This alone removes thousands of new Vector3() per frame during battles.
- Make attachment + label updates dirty-driven: Track whether an army actually moved/rotated before calling
  resolveArmyMountTransforms or repositioning CSS2D labels. Cache per-army Vector3 references inside ArmyModel and only
  recompute attachments when instanceData.isMoving flips or path index changes. Target: reduce update() work
  proportional to “moving armies” instead of “visible armies”.
- Offload chunk generation: Move updateHexagonGrid math into a Web Worker or OffscreenCanvas so Matrix4 generation and
  instanced buffer assembly run off the main thread. At minimum, assemble matrices into Float32Array batches and upload
  via mesh.instanceMatrix.array.set(...) instead of per-instance setMatrixAt calls to cut CPU time during chunk
  switches. Drop verbose console.log inside tight loops. MatrixPool/InstancedMatrixAttributePool and call them after
  chunk cache eviction or when MemoryMonitor detects upward trends. Keep only a few hundred matrices ready instead of
  tens of thousands once the player zooms out.
- Introduce chunk-aware cache eviction: When removeCachedMatricesForChunk runs, also purge exploredTiles, armyHexes,
  structureHexes, etc., outside the 3×3 neighborhood. Store per-chunk maps so they can be deleted wholesale. This keeps
  logical caches aligned with rendering caches and prevents unbounded Map growth.
- Simplify materials for lower tiers: Use GraphicsSettings to downscale the directional light shadow map (1024² or 512²
  for mid/low), turn off bloom/ vignette for mid tier, and skip PostProcessing entirely on low. Expose a UI toggle to
  disable the HUD CSS2D overlay in favor of sprites when targeting low-end GPUs.
- Split label rendering: Instantiate a second CSS2DRenderer for HUD overlays or, ideally, convert HUD labels to
  PointsLabelRenderer sprites so the DOM renderer only processes one scene per frame. This cuts DOM layout time and
  avoids triple render() calls per frame.
- Minimize asset payloads: Bake the environment map offline (PMREM + .ktx2) and serve compressed textures for
  resources/minimap icons (BasisU/Basis-KTX). For map data, align sqlApi.fetchAllTiles with chunk boundaries (fetch ±2
  chunks around camera) and delta pathways (only request changes since last timestamp) instead of the full world.

Phased Implementation Plan

- Phase 1 – Immediate wins (low risk) - Fix event listener bindings/removals in game-renderer.ts and worldmap.tsx. -
  Patch Particles.update (and other attribute offenders) to reuse buffers. - Gate minimap draw() behind a dirty flag and
  cap its frame rate (e.g., 10–15 Hz). - Add dirty flags to ArmyManager.update() for labels/attachments and introduce
  getWorldPositionForHex scratch versions. - Remove debug console.log calls inside chunk/army loops and disable
  bloom/vignette on low tiers. - Remove debug console.log calls inside chunk/army loops and disable bloom/vignette on
  low tiers.
- Phase 2 – Architectural adjustments - Move resource/FX animations onto a shared scheduler with object pooling for
  CSS2D labels. - Refactor instanced animation updates to use shader time uniforms or per-biome time textures instead of
  per-instance setMorphAt. - Implement chunk-based eviction for exploredTiles, armyHexes, etc., and add trimming APIs to
  matrix/attribute pools. - Introduce an offscreen/worker-based minimap renderer that accepts incremental tile updates,
  and align tile fetching with camera chunks. - Split HUD/world label rendering or migrate HUD annotations to GPU
  sprites.
- Phase 3 – Advanced optimizations - Worker-ize updateHexagonGrid and chunk rendering, feeding prebuilt buffers back to
  the main thread. - Add graphics-quality tiers that dynamically adjust shadow map size, post-processing stack, particle
  counts, and storm effects. - Adopt compressed texture/IBL pipelines (Basis/KTX2) and streaming asset loads for large
  GLTFs. - Explore GPU-driven instancing for armies/structures (single draw with per-instance data textures) to cut draw
  calls further and enable higher entity counts.

Implementing the Phase 1 items should immediately reduce frame time variance and GC churn; Phase 2 brings structural
stability for sustained sessions; Phase 3 positions the renderer for large-scale battles and mobile targets without
sacrificing visual fidelity.
