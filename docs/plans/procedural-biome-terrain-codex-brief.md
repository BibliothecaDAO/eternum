# Procedural Biome Terrain — architecture and delivery brief

Status: proposed

Date: 2026-08-22

Target: replace biome-tile GLB rendering in the world map and Hexception with deterministic, asset-light procedural
terrain

Verification companion: [Procedural Biome Terrain — self-verification layer](./procedural-biome-terrain-verification.md)

## Decision

Build the terrain as **CPU-prepared, page-owned continuous geometry with TSL node materials and a curated, optimized
Quaternius Ultimate Nature prop catalog rendered through procedural `InstancedMesh` pools**.

Do not build a graph of small GLTF biome pieces. Do not keep one mesh or `Object3D` per hex. Do not generate the
authoritative biome classification again in a shader. Do not start with a GPU-compute terrain pipeline.

The logical map stays hexagonal. Movement, ownership, exploration, range, picking, and the onchain biome ID remain
hex-based. Only the presentation becomes continuous: adjacent explored cells share a smooth height field, palette,
shoreline, ground cover, and prop distribution. Gameplay hexes reappear only when the player hovers, selects, targets,
or reaches the fog-of-war frontier.

This is the strongest fit for the current renderer because:

- `WorldmapScene` already prepares and atomically presents retained 24×24 visual pages inside a 48×48 render window.
- the renderer is Three's `WebGPURenderer`, with its maintained WebGL2 backend as the fallback; TSL compiles for both,
  while `ShaderMaterial`, `RawShaderMaterial`, and `onBeforeCompile` are not supported by this renderer;
- the current terrain state already comes from the RECS-backed spatial projection and distinguishes explored cells from
  unknown cells;
- CPU geometry gives armies, buildings, paths, labels, and overlays the same surface-height function as the rendered
  mesh, with no GPU readback or duplicated approximation;
- a page can be prepared off the render hot path, committed atomically, cached, invalidated, and disposed using the
  lifecycle that already exists.

The official Three.js guidance supports this direction:
[WebGPURenderer and its WebGL2 fallback](https://threejs.org/manual/en/webgpurenderer),
[TSL/node materials](https://threejs.org/docs/TSL.html),
[custom `BufferGeometry`](https://threejs.org/manual/en/custom-buffergeometry.html), and
[`InstancedMesh`](https://threejs.org/docs/pages/InstancedMesh.html). The official examples also include a
[TSL procedural-terrain scene](https://threejs.org/examples/webgpu_tsl_procedural_terrain.html). These are references
for renderer mechanics, not a proposal to copy the example's visual design.

## Product result

The intended result is a restrained tabletop world rather than a photorealistic terrain engine:

- broad, low-relief landforms flow continuously through neighboring hexes;
- biome colors mix over distance instead of ending at a vertical or material seam;
- coastlines read as continuous shore bands, not blue and tan hex edges;
- forests thicken organically across wet regions and thin toward biome transitions;
- deserts, tundra, snow, rock, and grass have distinct material response without bitmap textures;
- trees, shrubs, cactus, deadwood, and hero rocks use a curated subset of Quaternius' Ultimate Nature Pack; secondary
  ground detail remains procedural;
- the player can always recover the exact gameplay hex through hover, selection, targeting, and minimap UI;
- unexplored terrain never leaks biome information through color, elevation, props, or shoreline shape.

“Overflowing” should come from continuity, density gradients, silhouettes, and subtle motion—not thousands of unique
assets or per-blade geometry.

## Scope and assumptions

### In scope

- world-map terrain surface, water, fog frontier, and biome decoration;
- Hexception terrain using the same field, material, palette, and authored prop catalog;
- exact deterministic input from each game's `BiomeClimateConfig`;
- terrain-height placement for buildings, armies, chests, paths, labels, selection, and effects;
- page generation, retention, invalidation, disposal, instrumentation, and both renderer backends;
- deletion of biome GLB paths, preload manifest entries, parsed-GLTF cache, `InstancedBiome`, and biome asset files
  after both scenes migrate.

### Out of scope

- changing Cairo map generation, biome thresholds, exploration, travel cost, or combat rules;
- replacing building, army, chest, cosmetic, or FX assets;
- physics, terrain collision, free-form movement, destructible terrain, caves, or editable terrain;
- runtime terrain authoring or a generic user-facing shader graph;
- server-generated meshes, downloaded heightmaps, biome textures, or baked terrain files;
- using predicted terrain to reveal information outside explored cells.

### Final asset rule

The final terrain path has no whole-hex biome GLB/GLTF files, heightmaps, splat maps, normal maps, or biome texture
atlases. Small building and army assets remain unchanged. Terrain geometry, prop placement, color response, normal
perturbation, snow/moss/season treatment, and water response are generated from code and game data. The one exception is
a small optimized prop catalog derived from the CC0
[Quaternius Ultimate Nature Pack](https://quaternius.com/packs/ultimatenature.html); it supplies silhouettes, never
terrain shape or biome truth.

## What exists today

### Domain source

`packages/core/src/utils/biome/biome.ts` already mirrors the Cairo biome algorithm. It evaluates fixed-point simplex
elevation and moisture using the per-game scale, bias, elevation seed, and moisture seed, then collapses those
continuous values to one of 16 `BiomeType` values. `ClientConfigManager.getBiome()` supplies the current game's climate
config.

The missing domain interface is the environment sample itself. `Biome.getBiome()` currently returns only the final
classification while its elevation and moisture are private intermediate values. Terrain should deepen this module so
the exact calculation happens once:

```ts
export interface BiomeEnvironmentSample {
  biome: BiomeType;
  elevation: number; // normalized, fixed-point-derived 0..1
  moisture: number;  // normalized, fixed-point-derived 0..1
}

Biome.sampleEnvironment(contractCol, contractRow, climate): BiomeEnvironmentSample
Biome.getBiome(contractCol, contractRow, climate): BiomeType // delegates to sampleEnvironment
```

This is an in-process dependency. It does not need a port or adapter. Tests at the `Biome` interface verify parity with
Cairo fixtures and prove that `getBiome()` did not change.

The onchain/RECS tile biome remains authoritative for every explored cell. The sampled climate values are presentation
inputs, not an alternative live-state store. If a sampled `biome` and the projected tile biome disagree, development
builds fail loudly and production renders the projected biome.

### Current rendering path

The current path is:

```text
RECS Tile entities
  -> WorldSpatialProjection
  -> WorldmapScene.exploredTiles
  -> retained 24x24 terrain page preparation
  -> one matrix bucket per biome
  -> worldmap presentation composite
  -> InstancedBiome per biome GLB
```

Relevant evidence:

- `client/apps/game/src/three/constants/scene-constants.ts` declares 22 biome render keys backed by 21 named biome
  files, including the outline and alternates (`None` reuses `Bare`).
- `client/apps/game/src/three/scenes/hexagon-scene.ts` loads every path and constructs one `InstancedBiome` per biome
  for each scene.
- `client/apps/game/src/three/scenes/worldmap.tsx` builds per-biome matrix buckets for explored tiles and an `Outline`
  bucket for unexplored tiles, then recomposes those buffers as retained pages change.
- structure hexes are currently omitted from the terrain render rather than represented as a surface pad.
- `client/apps/game/src/three/scenes/hexception.tsx` repeats the biome-matrix flow for roughly 750 local-view cells.
- the repository contains about 11 MB of high-detail biome files and 780 KB of flat biome files. Parsed geometry,
  materials, textures, morph resources, and per-scene instance buffers cost more than their transfer size; the existing
  graphics audit already identifies biome residency as one of the largest fixed renderer costs.

What should survive is the RECS projection, exploration snapshot, page window, generation tokens, exact/provisional
presentation ordering, work queue, bounds, diagnostics, and atomic reveal behavior. What should disappear is the
biome-keyed model-loading and matrix-bucket implementation.

## Options considered

### 1. Smaller GLTF tile pieces assembled per biome

This can create more local variety, but it does not solve the main problem. Cell ownership, hard masks, authored bases,
and prop clusters still repeat on a hex cadence. It also retains asset loading, parsing, material compatibility,
instancing variants, and resource ownership. Enough small pieces to hide repetition become a content pipeline and a
large combinatorial catalog.

Verdict: rejected. Whole-cell pieces preserve the seam we want to delete. This does not reject standalone authored
vegetation and rock silhouettes placed by the procedural field.

### 2. TSL shading over the current flat hex instances

One node material could replace much of the asset weight and smooth color in world space. It is a useful isolated
prototype for the palette and noise nodes, but the geometry silhouette, shore edge, prop ownership, and lighting normals
would still follow individual hex meshes.

Verdict: prototype technique only, not the target architecture.

### 3. One infinite GPU-displaced procedural plane

This has a small CPU footprint and can look excellent. It is weak at Eternum's important seams: exact explored-cell
masking, atomic tile reveals, CPU-side entity anchoring, deterministic backend parity, page retention, structure pads,
and testing. Matching the fixed-point Cairo sampler inside TSL would create a second implementation of authoritative
logic, while reading height back from the GPU would stall and complicate the WebGL2 fallback.

Verdict: rejected for the initial system. GPU compute can be reconsidered only if measurements later convict CPU page
generation.

### 4. Page geometry + TSL material + procedural instancing

The CPU creates typed position, normal, palette, biome-response, exploration-edge, and index buffers for each retained
page. TSL adds reusable micro-detail without changing semantic classification. Curated Ultimate Nature props are placed
by stable hashes and presented in shared instance pools. Logical picking remains on the existing hex interaction plane.

Verdict: recommended. It has the cleanest seam, keeps state authority intact, uses the current page lifecycle, and gives
both rendering backends one implementation.

## Target architecture

### The external seam

Add one deep `ProceduralTerrain` module under `client/apps/game/src/three/terrain/`. `WorldmapScene` and
`HexceptionScene` know only its interface and opaque prepared-page results:

```ts
export interface TerrainCellInput {
  col: number; // normalized render coordinate
  row: number; // normalized render coordinate
  biome: BiomeType | null; // null means unexplored
  occupied: boolean;
}

export interface TerrainPageRequest {
  pageKey: string;
  generation: number;
  mapCenter: number;
  climate: BiomeClimateConfig;
  cells: readonly TerrainCellInput[];
  halo: readonly TerrainCellInput[];
}

export interface TerrainSurfaceSample {
  height: number;
  normal: Vector3;
}

export class ProceduralTerrain {
  preparePage(request: TerrainPageRequest): PreparedTerrainPage;
  present(pages: readonly PreparedTerrainPage[]): TerrainPresentationResult;
  sampleSurface(worldX: number, worldZ: number): TerrainSurfaceSample;
  setView(view: CameraView): void;
  dispose(): void;
}
```

`PreparedTerrainPage` is opaque and explicitly owned: once prepared, it must be presented, cached, or disposed exactly
once. `present()` swaps a complete page set in one commit. Callers never manipulate geometry attributes, materials,
water masks, prop buckets, or GPU resources.

The module is deep because one small interface hides:

- exact environment sampling and render-only detail sampling;
- hex-patch tessellation and seam-safe normals;
- palette and material-response blending;
- fog-frontier caps and skirts;
- structure pad flattening and prop exclusion;
- water/shore geometry;
- deterministic decoration candidates and instance packing;
- near/far geometry policy;
- bounds, GPU uploads, page reuse, disposal, and instrumentation.

`sampleSurface()` is also the test surface for visual placement. It must use the same CPU field as mesh generation. A
flat `TerrainSurface` adapter is justified for tests and scenes that deliberately have no terrain, but the procedural
module's internal builders should not be exposed as public strategies.

### Internal file ownership

Proposed layout:

```text
packages/core/src/utils/biome/
  biome.ts                         exact environment sample + classification

client/apps/game/src/three/terrain/
  procedural-terrain.ts            public interface, ownership, present/dispose flow
  terrain-page-builder.ts          typed-array geometry and page result construction
  terrain-surface.ts               continuous height/normal/pad sampling
  terrain-palette.ts               biome visual descriptors and blend rules
  terrain-material.ts              TSL land material composition
  terrain-water.ts                 water/shore geometry and TSL material
  terrain-props.ts                 deterministic candidates and instance packing
  terrain-prop-catalog.ts          optimized Ultimate Nature geometry and instance families
  terrain-hash.ts                  signed-coordinate stable hash/PRNG
  terrain-diagnostics.ts           structured DEV measurements and fingerprints

client/public/models/procedural-terrain/
  ultimate-nature-props.glb        curated near/far meshes, one network request
  ultimate-nature-props.json       provenance, source names, hashes, budgets, license
  LICENSE-CC0.txt                  retained source license
```

Keep TSL as ordinary TypeScript composition functions such as `createLandColorNode()` and `createFoliagePositionNode()`.
Do not add a JSON node graph, registry framework, material DSL, or editor abstraction.

### Data flow

```text
BiomeClimateConfig + RECS-projected explored tiles + projected structures
                                  |
                                  v
                    TerrainPageRequest (+ 1-cell halo)
                                  |
                         preparePage in work queue
                    /             |              \
            land/water buffers  prop instances  fingerprint/stats
                    \             |              /
                                  v
                       existing page presentation order
                                  |
                                  v
                         ProceduralTerrain.present
                     /             |              \
              page surface meshes  shared props   fog/frontier
```

The scene remains responsible for deciding _which_ page/version is current. The terrain module is responsible for
turning that decision into visual resources. It must not create a second page cache or a second explored-tile store.

## Terrain field and determinism

### Separate semantic truth from visual continuity

There are two related facts:

1. the biome of an explored hex is a current game fact and comes from RECS;
2. the sub-hex height, blend, surface noise, and prop placement are deterministic presentation.

Never let (2) replace or correct (1). At every explored cell center, the palette's primary biome is the projected
`BiomeType`. Continuous values from `Biome.sampleEnvironment()` control elevation and moisture gradients. A render-only
detail hash may add small-scale relief and breakup, but it may not choose gameplay biome, movement cost, or any label.

### Stable coordinate rules

- hash normalized signed `col` and `row`, both climate seeds, and a named salt;
- convert normalized render coordinates back to contract coordinates with the configured map center before calling the
  exact `Biome` sampler; never make coordinate-space detection implicit inside terrain code;
- use integer arithmetic for identity and placement decisions; do not call `Math.random()`;
- do not include page key, build order, camera position, frame time, or instance index in persistent placement;
- calculate noise in global normalized map coordinates so the same point has the same result in every page and scene;
- use named salts (`"terrain-relief-v1"`, `"tree-candidate-v1"`) so changing one layer does not reshuffle all others;
- include an explicit procedural-style version in fingerprints. A visual algorithm change is allowed to alter output
  between client releases, but the same release/config/coordinate must be stable across sessions and page order.

### Continuous height

Use the exact center samples as control points, then interpolate in hex space. Add low-amplitude render detail through a
stable global noise function shared by `terrain-page-builder` and `sampleSurface()`.

The first visual profile should remain shallow:

- deep ocean below the common sea level;
- ocean just below it;
- beach nearly flat at the shore;
- plains and forests gently rolling;
- tundra/desert modestly raised;
- bare/scorched/snow mountain biomes highest, still well below building scale.

Use remapped elevation rather than a multiplier per biome. The continuous elevation field creates the landform; the
biome descriptor only adjusts relief character. Clamp slope near cell centers used by structures and at path-critical
points.

### Structure pads

Stop deleting the underlying structure cell. Generate it as a smooth pad:

- a flat center large enough for the building footprint;
- a smooth radial transition to the surrounding surface;
- no procedural props inside the footprint/clearance radius;
- height returned through `sampleSurface()` so the building and its labels share the pad;
- page invalidation when an occupied cell is added, moved, reserved, or removed.

This removes terrain holes and makes occupancy a presentation modifier rather than a separate terrain model.

## Surface geometry

### Page topology

Build one merged indexed `BufferGeometry` per visible page, not one mesh per tile. Each explored hex contributes a
subdivided hex patch into the page's typed arrays. Internal boundary vertices may be duplicated for simple cell
ownership, but their positions, heights, blended material attributes, and analytically/centrally sampled normals must be
identical because all derive from global coordinates.

A practical starting density is three radial subdivisions per hex:

- 37 vertices and 54 triangles per explored hex before frontier skirts;
- about 21k vertices and 31k triangles for a fully explored 24×24 page;
- at most 12 retained pages in the current window before normal eviction policy applies.

These are starting points, not entitlements. The spike must measure 2, 3, and 4 subdivisions at close/medium/far camera
views. Choose the smallest topology whose silhouettes and lighting are visually smooth.

### Normals

Do not depend on `computeVertexNormals()` across independently owned patches; it cannot know that duplicated edge
vertices represent the same point and will reveal page/hex seams. Sample the shared height function at small global X/Z
offsets and write the derived normal directly. Identical global points then receive identical normals.

### Page halo

Every request includes a one-cell halo around its owned cells. The halo supplies height, normal, and palette context but
does not render or own props. Adjacent page borders therefore use the same samples.

Unknown halo cells are not sampled as their predicted biome. Extend the nearest explored value or a neutral frontier
value. When the neighbor becomes authoritative, invalidate the owning page and its one-ring neighboring pages because
their blends/normals may change.

### Near/far detail

Start with one topology. Add view-based near/far geometry only if measurements show a material win. Quality and Battery
must still produce the same still frame at a given camera view; Battery may change update cadence but not topology, prop
count, or material appearance.

If LOD is needed, prepare both fixed page topologies once and switch at the existing camera-view seam. Never rebuild a
page on every zoom tick.

## Material system

Use `MeshStandardNodeMaterial` for land and water. One shared land material reads per-vertex attributes and world-space
nodes. The biome catalog becomes data, not 16 material classes:

```ts
interface TerrainBiomeDescriptor {
  primary: Color;
  secondary: Color;
  roughness: number;
  relief: number;
  stone: number;
  foliage: number;
  snow: number;
  shore: number;
}
```

The CPU blends descriptors from neighboring authoritative cells and writes compact attributes. TSL composes:

- large-scale primary/secondary color variation in world space;
- slope-aware rock exposure;
- height/moisture-aware snow and dry-ground response;
- fine color grain that does not require a texture;
- small normal perturbation for perceived detail without moving the collision/presentation surface;
- roughness variation;
- optional slow foliage bend and water-normal movement using time nodes.

Keep the node graph shallow and reusable. Avoid branching once per biome in the shader; blend numeric descriptors on the
CPU, then run one material path. Avoid transparent land materials and alpha-blended grass fields.

### Water and shore

Deliver water in two steps:

1. base release: the continuous terrain surface includes ocean depth and an opaque/near-opaque procedural water color,
   sufficient to prove shape and coastline continuity;
2. refinement: generate a sea-level water mesh only over authoritative ocean/deep-ocean regions, with a narrow shore
   band derived from the elevation crossing. Use TSL normal/color/roughness motion and keep displacement visual-only and
   tiny.

The shoreline must be generated from the same explored-cell field and clipped at the frontier. Do not sample hidden
neighbors to draw a coast the player has not revealed.

## Procedural vegetation and rocks

### Authored source

Use the CC0 [Quaternius Ultimate Nature Pack](https://quaternius.com/packs/ultimatenature.html) as the sole external
terrain-prop source. The official pack contains 150 untextured models in FBX, OBJ, and Blend formats. Do not ship the
source archive, all 150 models, the source FBXs, or one GLB per source file.

The imported catalog starts with these 11 neutral source geometries:

| Runtime archetype | Quaternius source       | Source faces observed | Near target | Far target |
| ----------------- | ----------------------- | --------------------: | ----------: | ---------: |
| broadleaf         | `CommonTree_3.fbx`      |                 1,584 |       ≤ 700 |      ≤ 160 |
| birch             | `BirchTree_2.fbx`       |                 1,568 |       ≤ 700 |      ≤ 160 |
| willow            | `Willow_4.fbx`          |                 1,568 |       ≤ 700 |      ≤ 160 |
| conifer           | `PineTree_5.fbx`        |                 1,576 |       ≤ 600 |      ≤ 140 |
| palm              | `PalmTree_3.fbx`        |                 1,496 |       ≤ 600 |      ≤ 140 |
| dead tree         | `CommonTree_Dead_3.fbx` |                   944 |       ≤ 450 |      ≤ 120 |
| shrub             | `Bush_2.fbx`            |                   268 |       ≤ 200 |       ≤ 60 |
| cactus            | `Cactus_2.fbx`          |                   720 |       ≤ 350 |      ≤ 100 |
| boulder           | `Rock_4.fbx`            |                   128 |       ≤ 128 |       ≤ 80 |
| stump             | `TreeStump.fbx`         |                   232 |       ≤ 232 |       ≤ 80 |
| fallen log        | `WoodLog.fbx`           |                   464 |       ≤ 240 |       ≤ 80 |

This is the initial audition set, not an entitlement to ship every entry. A source stays only if its contact-sheet
silhouette earns its draw call and its simplified meshes remain recognizable. Adding or replacing an archetype changes
the catalog manifest and triggers aesthetic, triangle, draw-call, and provenance review.

Do not import the pack's autumn, snow, moss, berry, or flower duplicates. They mostly repeat a base silhouette with a
different source material. The TSL prop material and per-instance attributes provide tint, snow, moss, wind weight, and
season response without multiplying geometry families.

### Import pipeline

Build one reproducible `ultimate-nature-props.glb` offline:

1. obtain the pack from the official Quaternius page and record retrieval URL, retrieval date, archive SHA-256, author,
   source filename, and CC0 license in `ultimate-nature-props.json`;
2. import only the allowlisted source files;
3. normalize units, +Y up, forward axis, origin at ground contact, scale, names, transforms, and winding;
4. bake source material base colors into vertex colors;
5. add vertex attributes for foliage/wind weight and material-region identity where needed;
6. merge each archetype into one geometry and remove unused source materials, cameras, lights, animations, and texture
   references;
7. generate fixed near and far simplifications against the table budgets, preserving borders, trunk continuity, and
   silhouette extrema;
8. generate normals and bounds, quantize attributes, apply mesh compression supported by both maintained backends, and
   export all archetypes in one GLB;
9. inspect the output with `gltf-transform inspect` and the terrain verification contact sheet before accepting it;
10. commit only the optimized GLB, manifest, and CC0 license. Raw archives, FBX/OBJ/Blend sources, and conversion
    scratch files remain outside git.

The import tool is versioned under `client/apps/game/scripts/terrain-props/` and requires an explicit source directory.
Production and CI never download from Quaternius or Google Drive.

### Runtime catalog

Each archetype gets one `InstancedMesh` for the active view LOD and shares the small number of TSL prop-material
behaviors. The runtime extracts all named geometries from the single cached GLB, owns instance buffers, and never clones
geometry per page or biome. Visible-page instance lists concatenate into global archetype pools.

Target no more than 11 prop draw calls in the initial catalog, not 11 per page. The catalog GLB must remain below 750 KB
before transport compression, with no bitmap textures and no more than 5,000 near-LOD source triangles or 1,500 far-LOD
source triangles across the allowlist. The full rendered triangle budgets still govern instance density.

Deterministic yaw, non-uniform scale within approved limits, tint, snow, moss, wind phase, and placement create local
variation. Do not deform authored tree silhouettes per instance unless the result is stable and normals remain correct.

### Biome affinities

The authoritative biome does not select a prefabricated scene. It supplies affinities and density to the global
candidate field:

| Biome family               | Primary archetypes      | Secondary accents                   |
| -------------------------- | ----------------------- | ----------------------------------- |
| Deep ocean / ocean         | none                    | none                                |
| Beach                      | palm                    | boulder, fallen log                 |
| Scorched / bare            | dead tree, boulder      | cactus at dry edges                 |
| Tundra / snow              | boulder, sparse conifer | dead tree, stump; TSL snow response |
| Temperate desert           | cactus, boulder         | sparse shrub                        |
| Shrubland                  | shrub, boulder          | sparse broadleaf                    |
| Taiga                      | conifer, birch          | dead tree, fallen log, shrub        |
| Grassland                  | sparse broadleaf, shrub | stump, boulder                      |
| Temperate deciduous forest | broadleaf, birch        | shrub, stump, fallen log            |
| Temperate rain forest      | willow, broadleaf       | birch, shrub, fallen log            |
| Subtropical desert         | cactus, shrub           | boulder                             |
| Tropical seasonal forest   | palm, broadleaf         | shrub, fallen log                   |
| Tropical rain forest       | willow, palm            | broadleaf, shrub, fallen log        |

These are weighted affinities, not switches. Moisture, elevation, slope, neighborhood blend, and stable candidate hash
control the final choice. The same authoritative biome can therefore produce a clearing, grove, rocky shoulder, or
deadwood pocket without introducing a second biome classification.

Do not instantiate the pack's grass, flower, crop, or small plant meshes at world-map scale. Grassland richness should
initially come from surface color, normal detail, procedural tufts, and broad density. Add close-view ground geometry
only if a measured visual review proves the surface is too empty and the triangle/alpha cost is acceptable.

### Placement

Use a globally anchored jittered candidate lattice, not a fixed list of offsets repeated inside every hex:

1. enumerate candidates over the page plus a placement halo;
2. hash the global lattice coordinate and layer salt for jitter, scale, yaw, shape variant, and acceptance;
3. resolve the nearest owning hex;
4. reject candidates whose owning cell is unexplored, occupied, water, or outside the page;
5. derive density from the cell's authoritative biome descriptor and exact moisture sample;
6. query `sampleSurface()` for height and normal;
7. pack accepted instances by archetype into typed arrays.

This avoids a visible “six trees per forest hex” pattern and remains independent of page boundaries and traversal order.
Keep props inside their owner page so eviction and invalidation are exact.

Use density gradients, not biome switches. A wet forest center can be dense, its edge sparse, and its neighboring
grassland almost empty even though gameplay retains discrete biome IDs.

## Exploration and information safety

The fog frontier is the one place where a hex edge should remain visible. It communicates a real gameplay fact.

- explored-to-explored biome transitions blend continuously;
- explored-to-unexplored transitions end on the exact hex union;
- generate a short downward/dark skirt or cap at that outer union so displaced terrain never shows a crack;
- render unexplored space with a neutral procedural fog/outline surface that contains no biome-dependent height, color,
  shore, snow, or props;
- keep the existing interaction/outline managers for hover and selection;
- a tile reveal rebuilds the tile's page plus affected one-ring pages, then appears atomically with the authoritative
  RECS update.

Do not let deterministic client prediction justify visual leakage. The fact that a player could reproduce public map
noise is separate from the product's current exploration contract.

## Interaction and entity placement

Terrain geometry must not become gameplay collision or picking authority.

- keep `getHexForWorldPosition()` and the invisible interaction plane logically flat;
- disable terrain mesh raycasting;
- after resolving a logical hex, place the hover/selection visual at `sampleSurface() + epsilon`;
- inject a narrow `TerrainSurface` interface into scene presentation chokepoints;
- provide a flat adapter for tests and deliberately flat scenes;
- migrate structure, army, chest, route/path, compact-label, arrival-ghost, and world FX placement through that seam;
- keep camera controls targeted at the logical plane unless visual testing proves a shallow height follow is needed.

Do not add optional `terrainHeight ?? 0` at every caller. Centralize visual position resolution so missing surface data
is loud in development and the flat adapter is explicit.

Movement splines should sample the surface along the path, not only at endpoints. Water-going armies can use the water
surface; land armies use the terrain surface. This preserves the existing boat-selection semantics while stopping models
and trails from clipping through hills.

## Integration with the existing page runtime

Preserve the current page scheduler and presentation semantics:

- `WorldmapScene` continues to build `TerrainPageRequest`s through `FrameBudgetWorkQueue`;
- exact, provisional, retained, stale-drop, and generation ordering remain in the existing presentation runtime;
- replace `biomeEntries: Map<string, CachedMatrixEntry>` with an opaque prepared terrain page plus lightweight cell
  metadata needed by the presentation runtime;
- replace `applyTerrainPresentationComposite()`'s per-biome matrix rebuild with `ProceduralTerrain.present()`;
- keep structured phase timing, upload bytes, cell count, dropped count, page keys, transition token, and fingerprint;
- page disposal releases its `BufferGeometry`, page-owned attributes, water geometry, and prop arrays exactly once;
- the shared Ultimate Nature catalog cache owns source geometry; terrain scenes own their instance buffers and shared
  TSL material instances and release them at scene teardown;
- remove the global biome GLTF cache only after Hexception no longer consumes it.

The presentation fingerprint must include:

- page key and generation;
- explored cell coordinate + projected biome;
- occupied coordinate/pad state;
- climate config and procedural-style version;
- geometry density/LOD version if it affects prepared buffers.

It must not include camera position or frame time.

## Hexception

Hexception should be a second caller of the same deep module, not a second terrain implementation.

- represent its roughly 750 cells as one or a few fixed pages;
- use the same climate field, palette, materials, generated props, structure pads, and surface-height seam;
- preserve its large-hex grouping, building reconciliation, pillars if still intentionally visible, and interaction
  managers;
- delete its biome matrix buckets after parity is reached;
- use a Hexception-specific density/view configuration only where the camera scale genuinely differs. Do not fork the
  biome catalog or noise algorithm.

The world map should migrate first because it exercises streaming, reveal, fog, and cache invalidation. Hexception then
validates that the module's interface is genuinely reusable.

## Self-verification is part of the product

Terrain is not complete when it compiles or when one screenshot looks attractive. Its verification layer ships with the
terrain and exercises the same production `ProceduralTerrain`, `TerrainSurface`, TSL materials, prop catalog, page
presentation, and renderer backend.

The companion [self-verification brief](./procedural-biome-terrain-verification.md) defines:

- an auth-free `/debug/procedural-terrain` route with fixed fixtures, cameras, lights, time, viewport, and renderer
  mode;
- coastline, forest, arid, alpine, frontier, occupied-pad, negative-page-seam, and prop-stress scenarios;
- beauty, normal, height, biome-blend, and exploration-ownership evidence passes;
- structural checks for deterministic fingerprints, page seams, hidden props, pads, coverage, backend parity, and
  resource ownership;
- cold-build, stable-frame, camera-trace, lifecycle, draw-call, triangle, upload, and memory measurements;
- screenshot signatures and baseline comparison for regression detection;
- a fixed eight-category aesthetic rubric that the agent completes only after viewing every required contact sheet;
- one machine-readable `pass`, `fail`, `review_required`, or `inconclusive` verdict;
- explicit user authority for the first approved aesthetic baseline. The agent may recommend a baseline but cannot
  approve its own target.

Pixel statistics are not an aesthetic oracle. They catch blank frames, exposure drift, seams, clipping, and unintended
change. Semantic review still judges continuity, biome legibility, composition, prop repetition, coast/water, gameplay
readability, material/lighting, and fog integrity with capture-specific evidence.

## Delivery slices

### P0 — visual and performance conviction

Size: small.

- capture current worldmap at close, medium, and far view across coast, forest/grass, desert/mountain, snow, an explored
  frontier, and occupied cells;
- record draw calls, triangles, CPU terrain prepare/commit time, GPU upload bytes, bootstrap network bytes, memory after
  bootstrap, first close zoom, and first Hexception entry;
- add a deterministic debug fixture that can render a fixed climate/page without a live account;
- implement the verification contract, fixture manifest, rubric schema, unified verdict evaluator, and tests described
  in verification V0;
- decide the reference visual language with screenshots before tuning palette constants in product code.

Gate: an evidence artifact names the baseline and fixed reference coordinates; sample pass/fail/review-required/
inconclusive inputs produce the correct structured verdict; no optimization claim exists without a capture.

### P1 — deepen the biome domain module

Size: small/medium.

- add `Biome.sampleEnvironment()` and make `getBiome()` delegate;
- return normalized numbers only at the interface; keep fixed-point implementation details private;
- add Cairo parity fixtures across ordinary contract coordinates, normalized-to-contract conversions, threshold-adjacent
  samples, and non-zero-seed coordinates;
- add mismatch diagnostics for projected biome versus sampled classification in development;
- add the stable signed-coordinate hash and golden vectors.

Gate: every existing biome test remains green; sampled classification matches the current function and Cairo fixtures
exactly; same hash inputs produce the same vectors in independent runs.

### P2 — procedural terrain module and debug fixture

Size: large.

- implement page tessellation, global height, explicit normals, palette descriptors, structure pads, frontier skirts,
  opaque water baseline, TSL land material, ownership, and diagnostics;
- exercise it only through the maintained debug fixture at first;
- mount it through the auth-free production-renderer verification route, with fixed capture mode and diagnostic passes;
- compare subdivision counts and main-thread build cost;
- validate both native WebGPU and forced WebGL2 before worldmap integration.

Gate: adjacent fixture pages have bit-identical shared-edge height and normal data; no visible internal hex seams; the
same request has the same fingerprint and buffers; all resources return to baseline after repeated build/dispose; the
verification route uses production terrain and renderer imports rather than a parallel debug implementation.

### P3 — worldmap replacement and placement seam

Size: large.

- wire projected cells, one-cell halo, climate config, and occupancy into page requests;
- integrate prepare/present/dispose with existing generation and stale-drop flows;
- implement the browser capture runner, error/snapshot collection, `sharp` contact sheets, and quick/full matrices;
- add the `TerrainSurface` seam and migrate visual placement chokepoints;
- preserve flat logical picking and current selection behavior;
- keep biome GLBs available only to Hexception during this intermediate slice;
- add the latest-feature entry when the user-visible worldmap path lands.

Gate: pan/zoom/chunk switching has no gaps or stale page flashes; tile reveals are atomic; structure add/remove rebuilds
the pad without a hole; hover, selection, paths, armies, buildings, labels, and effects sit on the surface; no worldmap
biome GLB request occurs; deliberately missing/blank/error captures fail with their exact reason and retain artifacts.

### P4 — Ultimate Nature props and refined coast/water

Size: large but internally separable.

- add the versioned Ultimate Nature import pipeline, provenance manifest, optimized catalog GLB, shared geometry cache,
  and global instance pools;
- add world-lattice deterministic placement and density gradients;
- add water overlay and shore band if the opaque baseline measurement/visual review warrants it;
- add restrained TSL foliage/water motion without new per-frame CPU traversal;
- tune palette and density against the fixed screenshot locations.
- run the aesthetic rubric loop after every visual tuning batch and save before/after evidence for each blocking
  finding.

Gate: no repeated per-hex prop pattern is visible at any camera view; props are stable across rebuild/page order; no
props leak into unexplored/occupied/water cells; draw calls and triangles remain inside the budgets below; every
aesthetic category has capture-specific evidence, no category is below 3, the mean is at least 4, and continuity,
gameplay readability, and fog integrity are each at least 4.

### P5 — Hexception migration and deletion harvest

Size: medium/large.

- move Hexception onto `ProceduralTerrain`;
- delete biome matrix buckets from both scenes;
- delete `InstancedBiome`, `biome-gltf-cache`, biome model filenames/paths, shared biome preload manifest entries,
  obsolete animation/morph/far-detail code, and both biome asset directories;
- update renderer documentation and asset-manifest tests;
- run knip to find every orphan created by the replacement.

Gate: zero runtime references to whole-tile biome `.glb`/`.gltf` paths; zero legacy biome network requests; both
worldmap and Hexception render correctly; repository biome-tile assets are gone; the only terrain model request is the
manifest-pinned Ultimate Nature prop catalog; deletion is materially larger than compatibility glue left behind.

### P6 — hardening and measurement

Size: medium.

- run long traversal and repeated scene-switch lifecycle tests;
- compare all P0 measurements at the same coordinates and camera views;
- run cold, stable-frame, camera, and lifecycle verification traces against a base artifact captured on the same
  machine/backend;
- validate device-loss recovery and renderer re-creation;
- test Quality/Battery still-frame identity;
- validate the forced WebGL2 backend and representative Safari/Firefox-class fallback hardware;
- remove temporary experiment selectors and debug branches that are not part of the maintained fixture.
- add the path-scoped terrain verification workflow and always upload its unified artifact bundle.

Gate: all budgets pass, no unbounded resource growth appears, native WebGPU and the maintained fallback have honest
separate results, the unified verdict is `pass`, and final production has one terrain implementation.

## Verification matrix

The detailed executable contract, route, scenarios, artifacts, rubric, CLI, and CI responsibilities live in the
[self-verification brief](./procedural-biome-terrain-verification.md). The matrix below is the product-level gate.

### Correctness

- `Biome.getBiome()` remains bit-for-bit compatible with current TypeScript and Cairo fixtures.
- projected biome always wins at an explored cell center.
- equal climate/config/coordinate/style version gives equal height, normal, palette, props, and fingerprint.
- page build order, cache eviction, and camera approach direction do not change output.
- shared page edges match within float storage identity or a documented epsilon of at most `1e-6`.
- revealing one tile invalidates every page whose halo-derived geometry can change.
- unknown neighbors cannot affect visible biome palette, height character, shoreline, or props.
- occupied cells make pads, not holes.

### Visual

- no internal hex outline or lighting seam in an explored region at close, medium, or far view;
- hover, selection, movement range, and fog frontier still communicate exact hexes;
- every biome family is recognizable without a label, but adjacent families blend rather than tile;
- coastlines form readable continuous bands;
- structures and units never visibly float or clip during movement;
- the same still scene is pixel-identical in Quality and Battery.

### Performance budgets

Treat these as merge gates after P0 establishes the exact baseline:

- no single terrain preparation or commit task blocks the main thread for more than 8 ms on the reference machine;
- critical terrain is committed inside the existing 16 ms exact-join opportunity or a provisional page remains visible;
- terrain-related draw calls at steady state are at most 40, with a target of 12 surface/water/frontier calls plus no
  more than 11 global prop-archetype calls;
- terrain plus props do not increase total triangles above the P0 baseline at any camera view; target under 1.5 M at far
  view and under 3 M at close view before buildings/armies;
- no whole-tile biome model wait remains and no legacy biome asset bytes transfer at boot or scene switch; the prop
  catalog is one cached, manifest-verified request;
- GPU upload bytes occur on page create/change, not per frame;
- a 100-chunk traversal followed by returning to the origin shows bounded page, geometry, attribute, material, and
  instance memory;
- first max zoom and first Hexception entry remain below the existing 500 ms blocked-frame gate, with no unexplained
  shader/pipeline burst.

If CPU page generation misses the 8 ms task budget, first reduce topology and reuse typed-array capacity. If it still
misses after measurement, move the pure `preparePage()` implementation to a dedicated worker and transfer typed arrays.
Do not preemptively add a worker, WASM, or GPU compute path.

### Backend and lifecycle

- `webgpu-auto` renders the complete terrain path on native WebGPU;
- `webgpu-force-webgl` renders the same materials and scene behavior through the maintained fallback;
- scene destroy, device loss, reconnect refresh, page stale-drop, and cancelled setup each dispose owned resources once;
- no use of `ShaderMaterial`, `RawShaderMaterial`, or `onBeforeCompile` enters the terrain path;
- terrain meshes never become interaction raycast targets.

### Repository checks

Each non-Cairo slice runs focused tests, client typecheck/test as appropriate, root `pnpm run format`, and root
`pnpm run knip`. A Cairo change is not expected. If parity work reveals a Cairo bug and changes it, `scarb fmt` and
contract tests become mandatory for that slice.

## Risks and controls

### The field looks smooth but generic

Control: tune a small art-directed descriptor catalog, silhouette hierarchy, and density response at fixed reference
locations. More noise octaves are not an art direction.

### Smooth blending makes biome rules unreadable

Control: keep each cell center strongly biased to its authoritative biome; blend in a controlled border width; preserve
the exact biome label and hover overlay. The world can flow without turning every biome into the same brown-green mix.

### Terrain height breaks existing presentation

Control: keep relief shallow, add `TerrainSurface` before raising amplitude, flatten structure pads, and migrate visual
placement at chokepoints rather than scattered offsets.

### Page seams or reveal leaks appear

Control: global-coordinate sampling, explicit normals, one-cell halos, unknown-cell clamping, neighboring-page
invalidation, and seam tests over positive and negative coordinates.

### TSL/backend instability in Three r185

Control: use simple `MeshStandardNodeMaterial` inputs, attributes, uniforms, and common arithmetic; avoid exotic draw
index, storage-buffer, custom shadow-layer, or compute dependencies; make forced-WebGL smoke a gate; isolate node
composition behind `terrain-material.ts` so a Three upgrade stays local.

### Props dominate triangles or transparency

Control: low-poly opaque geometry, shared instancing, no per-blade grass, density caps derived from camera-independent
art constants, and measurement at all three camera views.

### A temporary dual path becomes permanent

Control: the debug fixture is the experiment seam, not a production mode. Worldmap and Hexception migrate in named
slices, and P5 has an explicit deletion gate. The final product has no runtime “legacy terrain” selector.

## Definition of done

This work is done when the explored world reads as one continuous deterministic landscape, while every gameplay fact
still comes from the hex map; both worldmap and Hexception use the same procedural terrain module; the terrain surface
is generated without whole-tile biome files; vegetation and rocks come only from the curated, optimized, provenance-
pinned Ultimate Nature catalog; unit/building/overlay placement shares the rendered surface; WebGPU and forced-WebGL
gates pass; page streaming remains atomic and bounded; measurements meet the budgets; and the former GLB terrain stack,
assets, loaders, caches, animation machinery, and preload entries are deleted.
