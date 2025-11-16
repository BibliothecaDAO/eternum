Overview

- GameRenderer owns a single PerspectiveCamera, WebGLRenderer, CSS2DRenderer, EffectComposer, Stats HUD and MapControls;
  it switches between WorldmapScene, HexceptionScene and the HUD scene via SceneManager and TransitionManager,
  throttling low/medium graphics modes in GameRenderer.animate (game-renderer.ts:788-809).
- Each scene extends HexagonScene, which bootstraps the Three Scene, camera, InputManager, InteractiveHexManager,
  FrustumManager, lighting/day- night cycle, thunder effects, and instanced biome meshes
  (scene/hexagon-scene.ts:302-610). Managers such as ArmyManager, StructureManager, QuestManager, ChestManager,
  SelectedHexManager, Minimap, HoverLabelManager, and FX/resource managers are composed into WorldmapScene
  (scenes/worldmap.tsx:280- 420).
- World state is driven through WorldUpdateListener streams (scenes/worldmap.tsx:400-520) and chunk streaming via
  ToriiStreamManager. Data is cached in maps (armyHexes, structureHexes, cachedMatrices, etc.), with helper pools
  (MatrixPool, InstancedMatrixAttributePool, HexGeometryPool, LabelPool, MaterialPool) acting as singletons (utils/
  matrix-pool.ts:5-73, utils/instanced-matrix-attribute- pool.ts:1-63, utils/hex-geometry-pool.ts:1-149, utils/
  material-pool.ts:1-214).
- The per-frame path is GameRenderer.animate → current scene update (worldmap.tsx:2940-2946 or hexception.tsx:1213-1218)
  → instanced biome updates (hexagon-scene.ts:593-607) → manager updates (ArmyManager.update,
  StructureManager.updateAnimations, SelectedHexManager.update, ChestManager.update, Minimap.update). Rendering uses a
  single RenderPass plus tone-mapping/FXAA/Bloom EffectPass, with HUD and CSS2D overlays composited afterward.

Findings

- CPU hotspots
  - The base scene update calls biome.updateAnimations every frame (scenes/hexagon-scene.ts:593-607). Inside
    InstancedBiome.updateAnimations every instanced mesh iterates all cells and issues mixer.setTime/mesh.setMorphAt
    calls even for off- screen chunks (managers/instanced-biome.tsx:190- 220), saturating the CPU/GPU bus as hex counts
    grow.
  - StructureManager.updateAnimations loops through every instanced structure type each frame regardless of visibility
    (managers/structure- manager.ts:1123-1128); each InstancedModel again iterates its mesh.count to update morph
    textures.
  - The minimap redraws and reclusters on every render tick (WorldmapScene.update ⇒ this.minimap.update();
    scenes/worldmap.tsx:2940-2946). Minimap.draw traverses all SQL tiles, structures, and armies
    (managers/minimap.ts:283-339) and an extra random check toggles clustering 10% of frames (managers/
    minimap.ts:266-271), causing unpredictable spikes.
  - SelectedHexManager’s particles recreate a brand- new Float32BufferAttribute each frame (managers/
    particles.ts:84-107), which reallocates CPU/GPU buffers instead of updating the existing attribute.
  - ArmyManager.update clones a Vector3 for every moving army each frame to feed PointsLabelRenderer
    (managers/army-manager.ts:1241-1264), producing avoidable GC churn.
  - Chunk switches run manager updates strictly sequentially (await army → structure → quest → chest;
    scenes/worldmap.tsx:2810-2849), so each chunk load incurs the sum of all manager latencies and stalls the main
    thread.
- Memory / GC issues
  - The particle update mentioned above continuously allocates typed arrays (managers/particles.ts:84- 107).
  - GameRenderer registers window.resize with this.onWindowResize.bind(this) and later removes a freshly bound function
    (game-renderer.ts:431- 435 vs 866-869), so the listener, focus/blur handlers (game-renderer.ts:400-419), the
    appended renderer canvas, and the Stats DOM node (game- renderer.ts:228-229) are never detached on destroy.
  - WorldmapScene.destroy only tears down FX, selection pulses, minimap, and input (scenes/ worldmap.tsx:3145-3167).
    ArmyManager, StructureManager, QuestManager, ChestManager, HoverLabelManager, and FXManager retain meshes, CSS
    labels, intervals, and subscriptions because their destroy methods are never called.
  - MaterialPool exposes dispose() (utils/material- pool.ts:200-214) but nothing invokes it, so pooled materials,
    textures, and shader programs stay alive across renderer restarts.
  - ResourceFXManager preloads every resource icon texture immediately (managers/resource-fx- manager.ts:205-244) and
    keeps them forever, even if a scene never shows resource FX.
  - Minimap fetches the entire SQL tile set every 10 seconds (managers/minimap.ts:936-975) and stores normalized copies,
    so memory usage grows with world size even if the camera only needs a small window.
- Renderer / draw-call concerns
  - All instanced biome/structure meshes are marked frustumCulled = false and updated every frame
    (managers/instanced-biome.tsx:171-178), so off- camera terrain still incurs animation and draw costs.
  - Minimap rendering uses immediate mode canvas drawing per entity; there is no batching or dirty- rectangle strategy,
    so every frame redraw touches every icon (managers/minimap.ts:283-339).
  - Chunk switches invalidate/recreate entire instanced buffers (updateHexagonGrid and cacheMatricesForChunk) and then
    setMatrixAt in a tight loop (scenes/worldmap.tsx:2266-2342), even if only a minority of tiles changed.
- Asset / loading
  - ResourceFXManager eagerly loads ~25 textures plus instantiates an FXManager (managers/resource-
    fx-manager.ts:205-250) on scene construction, lengthening scene boot irrespective of use.
  - Minimap polls sqlApi.fetchAllTiles() every 10 s (managers/minimap.ts:936-975) and converts all coordinates, which is
    costly on large maps and redundant with Torii streams.
  - Label/FX assets (CSS2D elements, sprites) are created eagerly and often left attached because manager destruction is
    incomplete (scenes/ worldmap.tsx:3145-3167).

Recommendations

- Gate biome/structure animations: keep a single time uniform per biome and drive vertex shader offsets, or at minimum
  skip InstancedBiome.updateAnimations for chunks not intersecting the FrustumManager bounds. Hook cachedMatrices bounds
  (scenes/worldmap.tsx:2600- 2608) to decide when to run model.updateAnimations and avoid per-instance mesh.setMorphAt
  (managers/instanced- biome.tsx:190-220). Trade-off: requires shader work or additional visibility tracking but drops
  thousands of per-frame JS calls.
- Make the minimap event-driven: throttle this.minimap.update() to a fixed interval (e.g., 4– 10 Hz) or drive it from
  actual data changes instead of render ticks (scenes/worldmap.tsx:2940-2946). Cache a prerendered offscreen canvas for
  tiles and only redraw overlays when clusters change to avoid redrawing this.tiles each frame
  (managers/minimap.ts:283-339).
- Fix hot-path allocations: reuse a shared Vector3 in ArmyManager.update (managers/army-manager.ts:1241- 1264) and
  update the BufferAttribute in place inside Particles.update (managers/particles.ts:84-107) by writing to
  geometry.attributes.position.array and toggling needsUpdate. Both changes remove per-frame GC and buffer re-uploads.
- Parallelize or stage chunk switches: schedule armyManager.updateChunk, structureManager.updateChunk, etc. via
  Promise.allSettled once the shared prerequisites (Torii bounds + hex grid) finish (scenes/ worldmap.tsx:2810-2849). If
  certain managers conflict, at least overlap CPU-bound ones (structure, quest, chest) while the GPU replays instanced
  buffers.
- Fully tear down managers: extend WorldmapScene.destroy/ onSwitchOff to invoke armyManager.destroy(),
  structureManager.destroy(), questManager.destroy(), chestManager.destroy(), hoverLabelManager cleanup, and
  fxManager.destroy() before clearing caches (scenes/worldmap.tsx:3145-3167). Likewise, ensure HexagonScene.destroy()
  removes InteractiveHexManager, DayNightCycle, etc. Trade-off: requires exposing destroy hooks where missing but
  releases GPU memory and DOM nodes.
- Clean up renderer-level listeners: store the resize handler (this.onResizeHandler = this.onWindowResize.bind(this)) so
  removeEventListener actually unregisters it, and remove the focus/ blur handlers plus Stats DOM on destroy (game-
  renderer.ts:400-419, 431-435, 866-874). This prevents stacking listeners when remounting the renderer or switching
  pages.
- Manage singleton pools explicitly: call MaterialPool.getInstance().dispose() when the renderer is torn down, and
  expose metrics from MatrixPool/ InstancedMatrixAttributePool to ensure clearCache frees them when world data resets
  (utils/material- pool.ts:200-214).
- Asset loading: lazy-load resource FX textures on first use instead of preloadResourceTextures (managers/
  resource-fx-manager.ts:205-244), and parameterize minimap refresh intervals or allow Torii deltas to drive tile
  updates (managers/minimap.ts:936-975). This
- Phase 1 – Low-risk fixes:
  1. Detach Stats/resize/focus listeners properly and remove renderer DOM nodes on destroy (game- renderer.ts).
- Phase 2 – Architectural improvements:
  1. Introduce visibility-aware animation gating for InstancedBiome/InstancedModel and hook into FrustumManager/chunk
     cache metadata.
  2. Redesign chunk switch orchestration to parallelize manager work or move heavy recomputation
