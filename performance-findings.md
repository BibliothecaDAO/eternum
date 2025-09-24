- src/three/managers/army-manager.ts:76 keeps armyPaths forever; they’re appended at army-manager.ts:638 but never
  deleted, so every movement path you compute sticks around. Clearing them after the movement command resolves (or on
  chunk switches) will stop the slow leak in JS heap.
- src/three/managers/structure-manager.ts:117-205 and army-model.ts:63-158 load every GLB at startup with MAX_INSTANCES
  = 1000. That clones geometry & materials per stage/troop variant even if you never see them, and the originals from
  the GLTF stay resident too. Lazy-load per structure type/tier, and share geometries/materials instead of cloning to
  cut tens of MB.
- Both instanced animation drivers (instanced-biome.tsx:109-145, instanced-model.tsx:140-198, and army-
  model.ts:196-265) iterate through every instance each frame and call setMorphAt, which forces morph-texture uploads
  and buffer re-computation. Throttling to a much lower rate, sampling a subset, or baking the animation into the shader
  would drop GPU memory churn and frame costs.
- The hex grid chunk generator (scenes/worldmap.tsx:1461-1644) still allocates ~2.6 K matrices per chunk switch, and
  MatrixPool only pre-allocates 1000 entries (utils/matrix-pool.ts:6-31), so it’s constantly creating fresh Matrix4
  objects that survive a full GC cycle before being reclaimed. Pre-sizing the pool to the maximum chunk size (or
  recycling arrays outright) will reduce heap spikes during panning.
- Every structure/army label is a new CSS2DObject that’s discarded on every chunk change (structure-manager.ts:246- 312,
  army-manager.ts:745-797). Pooling DOM nodes cuts layout thrash and CSS2D memory.
- Post-processing uses HalfFloatType render targets regardless of setting (game-renderer.ts:118-162). On medium/ low
  settings you can switch to UnsignedByteType, or skip EffectComposer entirely, to reduce render target memory by ~2×.
- Textures from the GLBs remain uncompressed (see the BIOMES_MODELS_PATH & BUILDINGS_MODELS_PATH assets in scene- Happy
  to dig deeper into any of these paths or help sketch implementation plans if you’d like.
