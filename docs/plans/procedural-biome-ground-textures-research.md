# Procedural biome ground textures — research and implementation specification

Status: implementation-ready research note Scope: textured land surfaces for the procedural terrain already used by
Worldmap and Hexception Renderer target: three.js r185 `WebGPURenderer`, native WebGPU with the maintained WebGL2
fallback

## Decision

Keep one shared `MeshStandardNodeMaterial` terrain path and make every biome a recipe over a small physical surface
library. Project textures from absolute world coordinates, blend the physical surfaces with continuous weights derived
from the existing deterministic terrain field, and ship the library as two mipmapped KTX2 texture arrays:

1. `ground-albedo-height.ktx2`: sRGB albedo in RGB, linear blend height in alpha;
2. `ground-normal-material.ktx2`: linear normal XY in RG, roughness in B, ambient occlusion in A.

The shader selects the two strongest physical surfaces per fragment, samples those two layers, applies height-aware
blending, reconstructs and blends their normals, and then applies low-frequency deterministic color and roughness
variation. Metalness remains the constant `0` because these are dielectric ground materials.

This is deliberately **not** sixteen materials, sixteen draw groups, a runtime-generated megatexture, or unconditional
triplanar/stochastic sampling. Three.js renders each `BufferGeometry` group as a separate draw call, so
material-per-biome would directly multiply the current page draw shape. Texture arrays retain one binding and one shader
path while allowing dynamic layer selection.
[Three.js `BufferGeometry.groups`](https://threejs.org/docs/pages/BufferGeometry.html)

## Why this is the production pattern

The established terrain systems converge on the same ideas:

- Unreal Landscape blends multiple material layers with normalized weights and offers height blending so, for example,
  dirt fills the gaps between rocks instead of producing a featureless linear cross-fade. It also provides world-aligned
  texture projection in world units.
  [Unreal Landscape materials](https://dev.epicgames.com/documentation/en-us/unreal-engine/landscape-materials-in-unreal-engine),
  [Unreal world-aligned texturing](https://dev.epicgames.com/documentation/en-us/unreal-engine/texturing?application_version=4.27)
- Unity Terrain Lit blends terrain layers by splat weights and optionally takes blend height from the mask texture.
  Unity also preserves distant terrain detail by sampling normals per pixel rather than relying only on mesh normals.
  [Unity Terrain Lit](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/shader-terrain-lit.html)
- Unity's HDRP packs grayscale material data sharing the same coordinates into channels because one packed fetch
  replaces up to four separate grayscale fetches; its detail map combines small-scale albedo, normal, and smoothness
  variation.
  [Unity mask and detail maps](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@10.5/manual/Mask-Map-and-Detail-Map.html)
- NVIDIA's terrain reference uses triplanar projection to avoid stretching on arbitrary topology, but triplanar means
  sampling three planar projections. Eternum's land is a gently sloped height field, so world XZ projection gives the
  continuity benefit at one sample per map; triplanar should be reserved for genuinely steep surfaces.
  [NVIDIA GPU Gems 3 terrain texturing](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu)

Three r185 already exposes `triplanarTexture()` in TSL and supports NodeMaterials through both WebGPU and the WebGL2
backend. `ShaderMaterial`, `RawShaderMaterial`, and `onBeforeCompile()` are not supported by `WebGPURenderer`, which
confirms that the implementation belongs in the existing `MeshStandardNodeMaterial` + TSL path.
[Three.js WebGPURenderer](https://threejs.org/manual/en/webgpurenderer),
[Three.js TSL specification](https://threejs.org/docs/TSL.html)

## Current Eternum seam

The procedural terrain already has the right ownership boundaries:

- [`terrain-field.ts`](../../apps/game/src/three/terrain/terrain-field.ts) owns deterministic, continuous height, biome
  influence, moisture, color, roughness, normals, and structure-pad behavior.
- [`terrain-page-builder.ts`](../../apps/game/src/three/terrain/terrain-page-builder.ts) samples that field and emits
  transferable indexed geometry buffers in a worker.
- [`terrain-material.ts`](../../apps/game/src/three/terrain/terrain-material.ts) is one shallow
  `MeshStandardNodeMaterial` using vertex color and roughness.
- [`procedural-terrain.ts`](../../apps/game/src/three/terrain/procedural-terrain.ts) shares that material across
  presented pages and owns disposal.
- The production and hermetic debug scenes already exercise native WebGPU and forced WebGL2 through the same terrain
  presentation path.

The implementation should deepen these seams rather than add a parallel texture renderer. Current `terrainBiomeId` is
the strongest categorical biome at a vertex; it is useful for diagnostics, but it is not sufficient for smooth material
blending. Interpolating layer IDs would select nonsensical intermediate layers. The worker must instead emit continuous
physical-surface weights.

## Biomes are recipes, not texture slots

A unique texture set for every gameplay biome would duplicate similar materials, consume more GPU memory, and make
cross-biome transitions harder. Use eight physical surface families and preserve biome identity through their weights,
palette tint, roughness response, macro variation, vegetation, and climate.

| Physical surface layer | Authored character                                    | Primary biome use                               |
| ---------------------- | ----------------------------------------------------- | ----------------------------------------------- |
| Sand                   | grains, small ripples, sparse pebbles                 | beach and both deserts                          |
| Dry earth              | cracked or dusty soil, gravel                         | temperate desert, subtropical desert, shrubland |
| Soil                   | compact dark/brown earth                              | grassland and exposed forest ground             |
| Grass                  | short dense ground cover, no isolated blades in alpha | grassland and forest openings                   |
| Litter / moss          | leaf or needle litter with mossy variation            | taiga and all forest families                   |
| Stone                  | bedrock, scree, fine cracks                           | bare, scorched, tundra, high/steep ground       |
| Snow / ice             | packed snow with restrained icy response              | snow, tundra, taiga overlays                    |
| Ash                    | charcoal, ash, heat-cracked earth                     | scorched                                        |

The initial recipe catalog should be explicit data alongside `TERRAIN_BIOME_DESCRIPTORS`:

| Gameplay biome             | Base recipe before continuous modifiers                          |
| -------------------------- | ---------------------------------------------------------------- |
| Deep Ocean                 | dark silt/stone seabed; visible only once the water slice exists |
| Ocean                      | silt/sand seabed                                                 |
| Beach                      | sand with wet soil/stone near the waterline                      |
| Scorched                   | ash + stone                                                      |
| Bare                       | stone + dry earth                                                |
| Tundra                     | dry earth + stone + snow overlay                                 |
| Snow                       | snow + stone/ice exposure                                        |
| Temperate Desert           | dry earth + gravelly sand                                        |
| Shrubland                  | dry earth + sparse grass                                         |
| Taiga                      | litter/moss + soil + seasonal snow                               |
| Grassland                  | grass + exposed soil                                             |
| Temperate Deciduous Forest | litter/moss + grass/soil                                         |
| Temperate Rain Forest      | wet litter/moss + soil                                           |
| Subtropical Desert         | warmer sand + stone                                              |
| Tropical Seasonal Forest   | dry litter + grass/soil                                          |
| Tropical Rain Forest       | dark wet litter/moss + soil                                      |

`primary` and `secondary` biome colors remain useful as albedo tints, not as replacement surface color. That retains the
current game's art direction while adding authored ground character.

## Continuous surface-weight field

Add eight normalized weights to `TerrainVisualSample`, packed as two `vec4` vertex attributes:

```ts
interface TerrainVisualSample {
  // Existing fields omitted.
  surfaceWeights0: readonly [sand: number, dryEarth: number, soil: number, grass: number];
  surfaceWeights1: readonly [litter: number, stone: number, snow: number, ash: number];
}
```

Keep these values as floats while the field is being evaluated, then quantize them at the geometry-buffer boundary into
two normalized `Uint8Array` attributes. Use a deterministic largest-remainder pass so the eight stored bytes total
exactly `255`. Three exposes the attributes to TSL as normalized floats, while the worker transfers only eight
additional bytes per vertex instead of 32. This matters because page upload bytes are already a measured regression
gate.

The field computes a biome recipe for every candidate cell, modifies that recipe by the cell's authoritative climate,
and blends the resulting numeric weights with the same continuous candidate kernel used for height and color. The final
weights are normalized and written by the page worker. This preserves deterministic page boundaries and does not require
GPU access to game state.

The modifier order is:

```text
biome recipe
  -> moisture response
  -> elevation / snowline response
  -> slope rock exposure and snow retention
  -> shore wetness
  -> structure-pad suppression of fragile cover
  -> normalize with soil/stone as the nonzero base
```

Recommended first-pass responses:

- increase grass, litter, moss tint, and darker soil with moisture;
- increase dry earth and sand as moisture falls;
- increase stone with `1 - normal.y`, scaled by the biome descriptor's existing `stone` affinity;
- increase snow with descriptor `snow`, normalized elevation, and upward-facing normal; suppress it on steep slopes;
- use the existing `shore` affinity and distance from sea level to darken sand/soil, lower roughness slightly, and add
  sparse stone rather than creating a ninth “wet” surface;
- on structure pads, favor compact soil/stone and suppress grass, litter, snow relief, and strong normals so buildings
  still read as grounded.

This follows the weight + height pattern proven by Unreal and Unity, but the weights are generated from the
deterministic game field instead of painted splat maps. Height-aware blending is important because plain linear blending
turns two recognizable materials into a muddy third material.
[Unreal height blending](https://dev.epicgames.com/documentation/en-us/unreal-engine/landscape-materials-in-unreal-engine),
[Unity height-based blending](https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/shader-terrain-lit.html)

## Texture library and asset contract

### Source assets

Each physical surface requires a genuinely tileable, lighting-neutral source set at the same resolution. The source
license and attribution must be recorded beside the import manifest; the Ultimate Nature Pack covers props but should
not be assumed to supply these PBR ground exemplars.

Use a single coherent CC0 source library for the first art pass. Poly Haven is the preferred starting point because its
curated, photoscanned textures are published as CC0 and supplied at high resolution; ambientCG is the fallback if one of
the eight required surface characters is unavailable. Record the exact asset page, author, download hash, and CC0 text
in the source manifest, then ship only the processed KTX2 arrays—not the raw high-resolution downloads.
[Poly Haven license](https://polyhaven.com/license), [Poly Haven texture library](https://polyhaven.com/textures)

Acceptance criteria per layer:

- albedo contains no baked directional light or large unique landmark;
- normal is OpenGL/Y+ convention or is converted deterministically by the build script;
- roughness, AO, and blend height are linear grayscale data;
- source scale is recorded in world units so rocks, leaves, and grains are not arbitrarily different sizes;
- a 4x4 repeat preview has no seam;
- the material remains legible under neutral overcast, warm directional, and low-angle light fixtures;
- all layers have identical width, height, format, and mip count before array assembly.

### Runtime layout

Use two 1024x1024, eight-layer arrays as the quality target. A 512x512 build is acceptable only if close-camera review
shows no softness. Eight 1024² RGBA arrays with full mip chains would be about 89 MiB if expanded to uncompressed RGBA8;
two 4-bpp block-compressed arrays are about 11 MiB including mipmaps. The merge gate is measured GPU allocation, not the
download size alone, because ordinary PNG/JPEG compression does not reduce expanded GPU memory.
[Three.js texture memory guidance](https://threejs.org/manual/en/textures.html)

Use standalone KTX2 arrays rather than embedding them in the prop GLB:

```text
apps/game/public/textures/procedural-terrain/
  ground-albedo-height.ktx2
  ground-normal-material.ktx2
  ground-materials.json
  LICENSES.md
```

KTX2 can represent array textures and mip levels. Three r185's `KTX2Loader` constructs a `CompressedArrayTexture` when
the container has more than one layer, and `detectSupport(renderer)` chooses a supported GPU transcoding target for
either renderer backend. [KTX 2 specification](https://registry.khronos.org/KTX/specs/2.0/ktxspec.v2.html),
[Three r185 `KTX2Loader` array path](https://github.com/mrdoob/three.js/blob/r185/examples/jsm/loaders/KTX2Loader.js#L439-L452),
[Three.js `KTX2Loader`](https://threejs.org/docs/pages/KTX2Loader.html)

Encoding contract:

- albedo RGB uses sRGB transfer; alpha remains linear blend height;
- normal/material data uses linear transfer and `NoColorSpace` at runtime;
- include a complete offline-generated mip pyramid;
- use ETC1S for color and UASTC for non-color data initially, following Khronos' material-texture guidance; validate
  actual transcode format and artifacts on Apple, Android, and desktop GPUs;
- use `LinearMipmapLinearFilter`, `RepeatWrapping`, and anisotropy capped at
  `min(4, renderer.capabilities.getMaxAnisotropy())`; a higher value is allowed only after the mobile trace proves it.

Khronos' Basis guidance requires sRGB for color data, linear transfer for normal/material data, a full mip pyramid when
mipmap filtering is used, and generally recommends ETC1S for color versus UASTC for non-color material maps.
[KHR_texture_basisu material guidance](https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_basisu/README.md#ktx-v2-images-with-basis-universal-supercompression)
Three likewise requires color textures to be annotated sRGB and non-color maps to remain `NoColorSpace`.
[Three.js color management](https://threejs.org/manual/en/color-management.html)

Mipmaps are mandatory. They suppress distant flicker and reduce texture bandwidth by allowing the GPU to sample a
smaller level; Apple and Arm both document the bandwidth/cache benefit for static 3D textures.
[Apple mipmap guidance](https://developer.apple.com/documentation/metal/improving-texture-sampling-quality-and-performance-with-mipmaps),
[Arm Mobile Studio texture guidance](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/accelerating-mali-gpu-analysis-using-arm-mobile-studio)

Anisotropy improves oblique ground sharpness but takes additional samples. Three exposes the device limit and documents
the cost, while Arm recommends keeping mobile anisotropy modest and avoiding high sample counts such as 8x without
evidence. [Three.js `Texture.anisotropy`](https://threejs.org/docs/pages/Texture.html),
[Arm filtering guidance](https://developer.arm.com/-/media/developer/Graphics%20and%20Multimedia/VR%20Downloads/VR%20on%20Arm%20-%20Developer%20Guide%20Unreal.v2.pdf)

## Shader architecture

Keep `createTerrainMaterials()` as top-level orchestration and move material-node construction into named helpers:

```text
createTerrainMaterials
  -> loadGroundTextureLibrary
  -> createTerrainSurfaceCoordinates
  -> selectStrongestSurfacePair
  -> sampleSurfacePair
  -> heightBlendSurfacePair
  -> composeTerrainAlbedo
  -> composeTerrainNormal
  -> composeTerrainRoughnessAndOcclusion
```

### 1. Coordinates

Derive coordinates from absolute world XZ, never page-local or hex-local coordinates:

```text
worldUv = rotate90(worldPosition.xz * surfaceTexelsPerWorldUnit, surfaceCatalogRotation)
```

Each surface may use a fixed quarter-turn rotation, scale, and offset from the material catalog. Apply the identical
transform to albedo, height, normal, roughness, and AO. For rotated normal maps, rotate the decoded XY normal by the
same quarter turn before combining it with the geometric normal.

World projection is continuous across pages and hexes and cannot “swim” because terrain does not move. Unreal calls out
world-aligned texture swimming specifically for moving objects, which is not applicable to the static terrain mesh.
[Unreal world-aligned texturing](https://dev.epicgames.com/documentation/en-us/unreal-engine/texturing?application_version=4.27)

### 2. Pair selection

Read the two `vec4` weight attributes, normalize them, and find the two strongest of eight scalar weights in TSL. The
result is two integer array-layer indices and two weights. This caps the regular material path at two surfaces
regardless of how many biome candidates influenced the vertex.

Do not send interpolated layer IDs from the CPU. Only weights are interpolated; layer selection happens after
interpolation in the fragment graph.

### 3. Base sampling and height blend

For each selected layer, sample:

```text
albedoHeight = groundAlbedoHeight[layer](worldUv)
normalMaterial = groundNormalMaterial[layer](worldUv)
```

Then bias each normalized surface weight by its sampled height and renormalize with an epsilon-protected base. Keep the
height influence configurable globally and per layer. It changes only material coverage, never terrain geometry,
collision, structure placement, or `sampleSurface()`.

### 4. Normals and PBR values

Decode normal XY from `[0, 1]` to `[-1, 1]`, reconstruct positive Z with `sqrt(max(0, 1 - x*x - y*y))`, normalize,
rotate into the world-oriented terrain frame, and blend the two decoded normals before combining with the geometric
normal. Normal maps create fine lighting detail without adding geometry; this is the appropriate tool for grooves,
grains, cracks, and small stones.
[Unity normal-map explanation](https://docs.unity3d.com/6000.1/Documentation/Manual/StandardShaderMaterialParameterNormalMap.html)

Blend roughness and AO with the same final material weights. Multiply texture roughness by the existing biome roughness
response and a restrained low-frequency variation. Keep metalness at zero.

### 5. Macro and micro detail

Use the existing seeded world-space noise for broad tint and roughness changes at a scale larger than a texture tile.
This breaks uniformity without another texture allocation and keeps the same result across page rebuilds. Preserve the
current biome primary/secondary colors as a tint over the sampled albedo, with a narrow range so the physical texture
does not disappear.

The base texture holds material-scale microdetail. Add a separate shared fine-detail normal only if the close-camera
gallery proves the base mips become soft before the camera's nearest allowed height. Unity uses separately tiled detail
maps for exactly this scale separation, but every added map is another per-fragment fetch.
[Unity detail maps](https://docs.unity3d.com/Packages/com.unity.render-pipelines.high-definition@10.5/manual/Mask-Map-and-Detail-Map.html#detail-map)

### 6. Slope projection

Do not run full triplanar sampling over the current height field. XZ projection is correct for the gently sloped ground
and costs one sample per map. If later terrain introduces cliff-like faces, use `triplanarTexture()` only in a measured
steep-surface variant or split steep faces into their own shared material. Full triplanar samples all three axes for
each map, so top-two material blending magnifies its cost rapidly.
[Three r185 triplanar node](https://github.com/mrdoob/three.js/blob/r185/src/nodes/utils/TriplanarTextures.js),
[NVIDIA triplanar terrain rationale](https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-1-generating-complex-procedural-terrains-using-gpu)

The existing frontier skirt may retain its dark procedural treatment or use a single dominant stone/soil lateral
projection. It must not force every top surface onto the triplanar path.

## Anti-repetition strategy

Start with the cheapest complete stack:

1. a high-quality seamless 1024² exemplar per physical surface;
2. fixed per-surface world scale and quarter-turn orientation;
3. continuous, seeded macro tint and roughness variation;
4. biome recipe changes, height blending, props, and relief breaking up the silhouette;
5. full authored mip chains.

Do not start with a UV atlas. Atlas tiles need gutters reproduced independently at every mip level or neighboring
materials bleed into one another; texture arrays avoid this class of artifact.
[NVIDIA texture-atlas mip caveat](https://developer.nvidia.com/gpugems/gpugems/part-iii-materials/chapter-20-texture-bombing)

Do not start with runtime stochastic tiling either. Texture bombing and histogram-preserving stochastic tiling reduce
obvious repetition, but they add dependent and repeated samples. NVIDIA's texture-bombing example requires up to eight
texture samples, and its authors explicitly identify repeated/dependent reads as the main efficiency problem.
[NVIDIA texture bombing](https://developer.nvidia.com/gpugems/gpugems/part-iii-materials/chapter-20-texture-bombing)

If the expanded debug gallery still exposes repeating motifs, add a **near-camera-only, convicted-material** stochastic
option. The Heitz–Neyret/Deliot method blends randomized tiles while preserving the source histogram and includes mip
prefiltering and compressed-texture considerations; its intended inputs include stochastic natural materials such as
sand, moss, granite, and bark. Use the same randomized transform for all channels of one material.
[Authors' stochastic-texture project](https://eheitzresearch.wordpress.com/738-2/),
[Unity research implementation and limitations](https://unity.com/blog/engine-platform/procedural-stochastic-texturing-in-unity)

The decision gate is visual evidence of a repeated motif plus a measured GPU margin. A regular top-two path costs four
array samples for the two proposed arrays. Three randomized patches would raise the same path to twelve samples before
any shared detail map; unconditional triplanar would triple it again. That is not an acceptable default mobile cost.
Three's texture guide notes that multi-texture trilinear filtering compounds the number of underlying texels sampled,
which is particularly important on mobile. [Three.js filtering and mipmaps](https://threejs.org/manual/en/textures.html)

## Texture-array backend and limits

`DataArrayTexture`/`CompressedArrayTexture` is the preferred representation. Three documents that raw data arrays
default to nearest filtering with mip generation disabled, so the runtime must not rely on defaults; the shipped KTX2
arrays must contain mips and explicitly use the production filter and wrapping settings.
[Three.js `DataArrayTexture`](https://threejs.org/docs/pages/DataArrayTexture.html),
[Three.js `CompressedArrayTexture`](https://threejs.org/docs/pages/CompressedArrayTexture.html)

Both WebGL2 and WebGPU expose array textures. The implementation uses two sampled texture bindings and eight layers,
well below the relevant limits, but it should still query/report actual renderer capabilities rather than assume a
desktop profile. WebGL diagnostics should record `maxTextures`, `maxTextureSize`, and maximum anisotropy; WebGPU
diagnostics should record adapter limits including `maxTextureArrayLayers` and `maxSampledTexturesPerShaderStage`.
[Three.js WebGL renderer capabilities](https://threejs.org/docs/pages/WebGLRenderer.html),
[WebGPU limits](https://www.w3.org/TR/webgpu/#limits)

The only fallback considered is a build-time atlas if the r185 compressed-array + TSL prototype fails backend parity.
That fallback must include per-mip gutters and preserve the same material API. Do not maintain both formats after the
prototype chooses one.

## Runtime ownership

Add one cache that owns the complete texture library:

```text
terrain-ground-texture-cache.ts
  load(renderer) -> Promise<TerrainGroundTextureLibrary>
  retain/release or one scene-owned lifetime matching the existing asset cache convention
  dispose exactly once
```

Rules:

- initialize a shared `KTX2Loader`, set the existing Basis transcoder path, and call `detectSupport(renderer)` before
  loading;
- load the two arrays once per renderer/device lifetime, not once per page;
- call `renderer.initTexture()` or compile the complete terrain scene before revealing it so decode/upload and shader
  compilation do not appear as the first close-zoom hitch; Three exposes explicit texture initialization and async
  shader compilation for this purpose;
- page creation uploads only geometry and weight attributes; camera movement does not mutate or regenerate textures;
- dispose textures, loader workers, material, and page geometry at their existing ownership boundaries;
- a missing layer, mismatched array dimension, missing mip chain, or unsupported texture type is a loud development
  error. Production reports the structured asset failure and retains the existing flat-color material so terrain never
  disappears or blocks game entry; this fallback must be observable, not silent.

[Three.js `KTX2Loader`](https://threejs.org/docs/pages/KTX2Loader.html),
[Three.js renderer texture initialization and compilation](https://threejs.org/docs/pages/WebGLRenderer.html)

## Proposed code changes

```text
apps/game/src/three/terrain/
  terrain-ground-material-catalog.ts      # eight physical surfaces and sixteen biome recipes
  terrain-ground-texture-cache.ts         # KTX2 array loading, validation, ownership
  terrain-ground-nodes.ts                 # coordinate, selection, sampling, blend, normal helpers
  terrain-material.ts                     # top-level material composition
  terrain-field.ts                        # continuous physical-surface weights
  terrain-page-builder.ts                 # writes two vec4 weight attributes
  terrain-types.ts                        # buffer/sample contracts and style-version bump
  procedural-terrain.ts                   # binds shared arrays and exposes diagnostics

apps/game/scripts/terrain-ground/
  build-ground-texture-arrays.mjs          # deterministic validation, packing, mips, KTX2
  ground-material-source.json              # scale, channel, license, hashes, layer order

apps/game/src/three/terrain/verification/
  existing fixtures extended with texture diagnostics and texture-focused captures
```

No new renderer, scene-local material registry, React state, or terrain truth store is required.

## Verification contract

Ground texture work is not complete when the maps merely load. Extend `/debug/procedural-terrain` so the existing large
field can switch between flat diagnostic color and final textured shading and expose the following fixed camera passes.

### Required visual fixtures

1. **All-biome close strip** — every biome fills enough screen area to inspect texture scale, normal strength, and
   recipe.
2. **Game-scale overview** — the expanded many-hex field checks that macro variation does not become blotchy and that
   biome identity survives at play zoom.
3. **Boundary walk** — camera crosses page boundaries and mixed biome boundaries at low angle.
4. **Structure pads** — empty and occupied examples verify reduced cover detail under buildings.
5. **Slope and frontier** — steepest generated land plus unexplored skirts catches projection stretch and information
   leaks.
6. **Lighting trio** — neutral overcast, current production light, and low-angle grazing light expose bad normals and
   roughness.
7. **Motion trace** — slow pan/zoom at glancing angle detects mip shimmer, moire, and texture swimming.

Capture every fixture on native WebGPU and forced WebGL2 with identical seed, cells, camera, lighting, and asset hashes.

### Aesthetic gates

- all sixteen gameplay biomes are recognizable without labels at close and play zoom;
- physical texture scale agrees with Ultimate Nature props and buildings;
- no page seam, hex seam, atlas bleed, texture swimming, or abrupt 90-degree normal discontinuity is visible;
- mixed boundaries preserve recognizable material features instead of becoming a uniform muddy band;
- no obvious repeated landmark appears inside a 12x12-hex inspection window;
- grazing-angle motion shows no persistent shimmer or crawling normal detail;
- snow settles on appropriate upward surfaces, rock exposure follows slope, wet shore is limited to the sea-level band,
  and structure pads remain calm and readable;
- the texture does not reveal an unexplored neighbor's biome beyond the existing frontier contract.

### Structural gates

- identical page request + asset manifest produces identical geometry fingerprint and surface-weight buffers;
- adjacent pages emit byte-identical weights at shared world coordinates;
- all evaluated weights are finite and in `[0, 1]`; packed bytes sum to exactly `255`, and decoded shader weights
  renormalize safely;
- texture arrays contain exactly the catalog layer count, identical dimensions, full mip chains, and expected color
  space;
- CPU catalog order, KTX layer order, shader constants, and build manifest are validated against one generated source of
  truth;
- no terrain geometry group or material-per-biome draw is introduced;
- texture uploads happen once at scene/device load, not on page build, camera movement, or reconnect refresh;
- disposal and device-loss recovery leave no live texture, transcoder worker, or material duplicate.

### Performance gates

Record a flat-material baseline and a textured-material candidate on the same machine, browser build, renderer backend,
resolution, fixture, camera trace, and warm-cache state. Report both absolute values and deltas:

- stable-frame CPU frame time and, where available, GPU duration;
- p50, p95, and worst frame over the fixed motion trace;
- terrain draw calls and shader pipeline count;
- sampled texture count for the material variant;
- KTX2 transfer bytes, transcode time, upload time, and measured/estimated GPU bytes including mipmaps;
- first reveal and first close-zoom blocked-frame duration;
- page preparation and commit duration, proving texturing did not move work into the worker or page commit loop.

Merge budgets:

- terrain draw calls do not increase from the existing page/material architecture;
- regular land path uses at most four array samples per fragment; one additional shared detail fetch requires a separate
  visual conviction and measured pass;
- combined ground arrays stay at or below 16 MiB measured GPU allocation and 8 MiB compressed transfer unless the 1024²
  quality proof cannot meet that budget;
- warm stable-frame textured terrain adds no more than 1.5 ms p95 GPU time on the reference desktop and no more than 2.5
  ms on the maintained WebGL2/mobile reference, while total p95 remains inside the game's frame budget;
- no new main-thread task above the existing 8 ms terrain gate;
- no shader/pipeline compilation hitch above the existing 500 ms blocked-frame gate at first close zoom;
- a 100-page traversal and return proves bounded texture count and no repeated transcode/upload.

If a platform cannot expose reliable GPU timing, treat its end-to-end frame trace as the gate and mark GPU duration
unavailable rather than fabricating a proxy. Arm's guidance recommends using mipmapped, block-compressed textures and
measuring texture/cache pressure because external texture bandwidth is energy-intensive.
[Arm Mobile Studio guidance](https://developer.arm.com/community/arm-community-blogs/b/mobile-graphics-and-gaming-blog/posts/accelerating-mali-gpu-analysis-using-arm-mobile-studio)

## Delivery slices

### G0 — asset and backend conviction

- Acquire one licensed grass, sand, and stone source set.
- Build 512² two-layer KTX2 array prototypes with full mips.
- Prove `KTX2Loader -> CompressedArrayTexture -> TSL dynamic layer sample` on native WebGPU and forced WebGL2.
- Capture transcode format, sampler/filter state, asset bytes, GPU estimate, and backend screenshots.
- Delete the atlas fallback if the array path passes.

Gate: both backends render identical layer selection and color-space behavior with no console validation errors.

### G1 — surface-field contract

- Add the eight physical surfaces, sixteen biome recipes, and two packed weight attributes.
- Unit-test normalization, moisture/elevation/slope/shore behavior, determinism, halo continuity, and occupied pads.
- Keep the old vertex color material active.

Gate: page fingerprints are stable, shared-edge weights match, and page preparation remains within budget.

### G2 — base textured material

- Load the two complete arrays once.
- Implement world XZ sampling, strongest-pair selection, height blending, color-space handling, roughness, AO, and
  normals in shallow TSL helpers.
- Preserve flat diagnostic shading and use the same material as the explicit production asset-failure fallback.

Gate: every biome passes the close strip on both backends and terrain draw calls do not increase.

### G3 — macro variation and environmental response

- Apply seeded macro tint/roughness variation.
- Tune slope rock, snow retention, shore wetness, moisture, and structure-pad calmness.
- Lock world scale against props/buildings.

Gate: large-field review shows no hex seams, muddy transitions, or implausible texture scale.

### G4 — asset pipeline and performance hardening

- Finish the deterministic source manifest, packing validation, mip generation, KTX2 encoding, hashes, and licenses.
- Prewarm textures and shader pipelines.
- Extend lifecycle, device-loss, traversal, and performance diagnostics.

Gate: all structural and performance budgets above pass on both renderer paths.

### G5 — anti-repetition only if convicted

- Run the 12x12 repeat review for every physical surface.
- If a named surface fails, first improve its exemplar, scale, and macro response.
- Only then prototype histogram-preserving stochastic sampling for the failing surface at near distance.
- Keep it only if the visual score materially improves and the GPU budgets still pass; otherwise delete it.

Gate: no obvious repetition remains and no unmeasured shader tier ships.

## Explicit non-goals

- no displacement/parallax occlusion in the first release;
- no runtime texture synthesis or virtual-texture system;
- no per-biome `Material`, geometry group, or draw call;
- no generated control/splat texture per page;
- no texture atlas unless the G0 array prototype fails;
- no unconditional triplanar or stochastic sampling;
- no change to authoritative biome classification, collision, interaction raycasts, or `sampleSurface()`;
- no new direct-fetch or side-store path for game state.

## Definition of done

The ground-texture layer is done when the live Worldmap and Hexception terrain use one shared, deterministic textured
NodeMaterial path; every gameplay biome is visually distinct through a continuous physical-surface recipe; shared page
and biome boundaries remain seamless; texture assets are licensed, validated, mipmapped, KTX2-compressed, bounded, and
disposed correctly; native WebGPU and forced WebGL2 pass the same visual, structural, lifecycle, and performance gates;
and the expanded debug scene makes all of that inspectable without authentication.
