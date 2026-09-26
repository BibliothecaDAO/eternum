# Frontier building tiers

These are procedural tier variants of the existing realm-board models. The board loads GLBs through
`HexceptionScene.loadBuildingModel` and `mode.assets.buildingModelPaths`; the construction PNGs are menu illustrations.
The source architecture, textures, transforms, skins and animation are retained.

## Sources and rebuild

`apps/game/scripts/frontier/build-building-tiers.mjs` is the editable source. It reads the tracked GLBs under
`apps/game/public/models/new-buildings-opt/`: `farm.glb`, `barracks.glb`, `storehouse.glb` and `workers_hut.glb`.
Roof-fitting endpoints were measured on those meshes. Extensions, timber frames, roof banners, numerals and hex facings
are generated in the source coordinate system. No hand-authored scene file is needed.

From the repository root, with installed client dependencies and Khronos KTX-Software on PATH:

```sh
node apps/game/scripts/frontier/build-building-tiers.mjs
node apps/game/scripts/frontier/verify-building-tiers.mjs
```

Pass `farm`, `barracks`, `storehouse` or `workers-hut` as the optional build argument to regenerate one family. Every
run reads the original GLB, never a previous tier export. Original KTX2 texture payloads remain byte-identical. New
geometry samples the original stone, timber and roof atlas regions. Flat banner and trim colours use vertex colour. All
additions merge into the building's existing opaque primitive, keeping the original material draw count. Geometry uses
the project's Draco Edgebreaker codec.

Tier III adds one tiny procedural KTX2 emission mask. The builder writes its 16 by 4 RGBA pixels, encodes them with
`ktx create --raw --width 16 --height 4 --format R8G8B8A8_SRGB --encode basis-lz`, and embeds the result with a content
hash. A second UV set confines the soft gold emission to new trim; original surfaces and moving parts sample black. The
mask is generated from code and requires no external image master. Temporary build files are removed after encoding.

## Tier silhouettes

Tier I is the original realm-board model, with no banner: a building's tier shows only once it is upgraded. Tiers II and
III carry a roof-mounted banner in silver or gold with II or III on both sides. The thicker hex facing is a secondary
cue. Tier II adds silver roof fittings and a structural addition; Tier III adds a further piece, broader gold fittings
and soft emissive trim.

| Building     | Tier II addition                         | Tier III addition           |
| ------------ | ---------------------------------------- | --------------------------- |
| Farm         | Stone and timber granary beside the mill | A raised granary loft       |
| Barracks     | Crenellated watchtower                   | A second, taller watchtower |
| Storehouse   | Stone and timber warehouse annex         | A roof loft                 |
| Workers' hut | Covered timber porch                     | A tall capped chimney       |

Gold is `#dfaa54`; ink is `#1b1207`. Silver is `#e3e9ef` and stone is `#837a68`, modulated by the existing atlas and
scene lighting. Original roofs keep their terracotta colour.

## Runtime contract

Files are `/models/frontier/buildings/{farm,barracks,storehouse,workers-hut}-{2,3}.glb`; tier I draws the original
model. Use existing board placement scale, rotation and ground offset. The builder checks every added vertex against the
unit-radius pointy hex. Original meshes retain their source footprint. The Farm keeps its original scaled/skinned nodes,
so these are board models rather than inputs for the separate structure-instancing path that skips scaled nodes.

The Farm retains all four clips and skin hierarchies. Additions attach to static architecture without changing the mill
or worker motion. The other sources are static. Tier changes swap models; no upgrade animation is baked into these GLBs.
Learned/open/locked research rings and the marked-plot highlight remain frontend presentation.

## Verification and review

The builder enforces the added geometry's hex footprint. The verifier compares original texture hashes, animation
channels and every original node transform, checks unchanged draw counts, and enforces a maximum triangle increase of
15%. All eight exports passed. Tier III's one extra emission texture is expected; original images remain unchanged.

Actual game-loader previews with game terrain and lighting show each family in I / II / III order at gameplay and detail
camera distances, plus Farm animation playback. Review captures remain outside the repository. These establish asset
loading and appearance; frontend tier selection, live placement and model-swap effects are separate integration work.

| Family      | Tier |   Bytes | Triangles | Increase over base | Draws |
| ----------- | ---: | ------: | --------: | -----------------: | ----: |
| barracks    |    1 | 353,288 |     9,419 |               1.3% |     2 |
| barracks    |    2 | 354,492 |     9,611 |               3.4% |     2 |
| barracks    |    3 | 356,704 |     9,731 |               4.6% |     2 |
| farm        |    1 | 506,772 |     5,590 |               2.2% |     7 |
| farm        |    2 | 508,612 |     5,826 |               6.5% |     7 |
| farm        |    3 | 511,732 |     5,982 |               9.4% |     7 |
| storehouse  |    1 | 257,888 |    18,168 |               0.7% |     2 |
| storehouse  |    2 | 259,216 |    18,368 |               1.8% |     2 |
| storehouse  |    3 | 261,608 |    18,532 |               2.7% |     2 |
| workers-hut |    1 | 311,292 |     6,022 |               2.0% |     2 |
| workers-hut |    2 | 312,384 |     6,186 |               4.8% |     2 |
| workers-hut |    3 | 314,084 |     6,246 |               5.8% |     2 |
