# Outpost sources

Six Blender 5.2.1 files hold the camp, longhouse village, stragglers, shrine, well and ruin. Textures are packed into
each source. `OUTPOST_EDITABLE` retains separate construction meshes and is hidden to prevent double rendering.
`OUTPOST_PRODUCTION` holds the consolidated static presentation. Export reads the saved source without regenerating it.

Camp uses a tensioned canvas ridge, timber stockade and supply stores, with a standard separated from the canvas. The
village combines a timber longhouse and two roundhouses behind a split-stake palisade. Stragglers gather around a
damaged cart, with bent postures, torn cloaks, teal stains and violet shield scars. The shrine has an open approach
beneath a gold sun. The well has modeled ripples and broken teal highlights; it is static, with no animation update.

The 480² contact map is baked at 512² with 16 Cycles samples, then reduced. A separate surface swatch supplies grain; a
packed 128² tangent normal map supplies surface detail. Vertex colors supply the palette. The material graph retains the
same tint multiplied by contact shading that glTF displays. Violet residue uses the shipped rift's Living liquid
emission color `(0.095, 0.003, 0.29)` at strength 0.6. Teal stains are the existing refined-essence accent, not a payout
indicator.

Ownership cloth stays separate through consolidation and export. A single-material mesh with `relationshipCloth=trim`
uses the existing per-instance red/green colors; the modeled sun stays separate. Camp roof edging joins that surface.
This costs one primitive per settlement and introduces no ownership state or material system.

## Placement and delivery

Blender Z=0 exports as glTF Y=0 at terrain top. Entrances face glTF +Z. Narrow feet extend roughly 0.02 below terrain;
there is no ground slab. Scale is one inside a radius-one pointy hex. The exporter checks the source footprint; the
verifier checks decoded Draco positions with a 0.001 tolerance. Production transforms are identity.

| Source                  | Runtime file   | Triangles | Primitives |  Bytes |
| ----------------------- | -------------- | --------: | ---------: | -----: |
| camp.blend              | camp.glb       |      3047 |          4 |  91312 |
| village-longhouse.blend | village.glb    |      5886 |          4 | 115500 |
| stragglers.blend        | stragglers.glb |      2963 |          5 |  93592 |
| shrine.blend            | shrine.glb     |      1816 |          3 |  73524 |
| well.blend              | well.glb       |      5068 |          3 | 103684 |
| ruin.blend              | ruin.glb       |      3752 |          3 | 101536 |

These are exact delivered asset counts, not frame measurements. The small-landmark ceiling is 6296 triangles, five
primitives and 257144 bytes, based on the existing well/ruin family.

## Rebuild

Use Blender 5.2.1, Node >=20.19, the workspace's pnpm version, and Khronos KTX-Software on PATH. Install workspace
dependencies first. From the repository root:

```sh
export OUTPOST_BLENDER=/absolute/path/to/blender-5.2.1/blender
export OUTPOST_BUILD_DIR=/absolute/path/outside/the/checkout
bash apps/game/scripts/outposts/rebuild-outposts.sh "$OUTPOST_BUILD_DIR"
```

The wrapper accepts optional runtime names after the directory: `camp village stragglers shrine well ruin`. It exports
fresh raw geometry, compresses UASTC normals (level 2, RDO 0.5, Zstd 18), ETC1S color (quality 180) and Draco
edgebreaker, then verifies each result. Texture workers are limited to two. Compressed files are in
`$OUTPOST_BUILD_DIR/models`, already named for runtime. Logs, raw exports and verifier JSON remain beside them.
Repeating the command rebuilds the same outputs from the packed sources.

After reviewing a rebuilt model, replace its matching file under `public/models/outposts`. Run
`pnpm --dir apps/game verify:assets scripts/outposts/outpost-assets.test.mjs` to verify all six delivered assets.
`pnpm --dir apps/game verify:outposts /absolute/model.glb` verifies one compressed file without changing it. The
verifier checks footprint, contact height, tint and UV attributes, transforms, animation absence, texture formats,
triangles, primitives, payload and separate ownership cloth.

The runtime lab's visible placement and ownership controls provide the model proof described in
[FEATURE-MAP.md](../../FEATURE-MAP.md). The lab is part of the client; no separate comparison viewer is required.

The ruin has broken paving and low central rubble. Jagged cracks open through the masonry, with violet cores recessed
inside the walls. The exposed rafter faces outward. Beast meshes, their shared origin and the four runtime scales remain
unchanged; `pnpm --dir apps/game verify:fallen-realm` verifies zero triangle contacts at each scale.
