# C2 closed chest

Asset ID: `chest-c2`. Runtime path: `/models/reward-tiles/chest-c2.glb`.

This is the owner's approved C2 reward chest, copied from the main checkout and compressed for Frontier. The original
file and source inputs remain in the main checkout. The violet coffer, gold bands, cyan clasp, floating gems and
independently moving ritual rings retain their authored proportions and materials.

## Procedural source

The source is `apps/game/scripts/reward-tiles/build-reward-tiles.py`, specifically `build_arcane_chest` and its shared
construction, material and animation helpers. `build-chest-c2.py` provides a C2-only export so a rebuild does not
overwrite other reward models. No hand-authored scene file is required.

Texture inputs are the existing `apps/game/scripts/reward-tiles/textures/slate.png` and `purple-enamel.png`. Their
source prompts are recorded alongside them in `slate-prompt.txt` and `purple-enamel-prompt.txt`. Both inputs are already
tracked. Other materials use the builder's scalar colors, roughness, metalness and emissive settings.

Run from the repository root with Blender 4.5, the installed client dependencies and Khronos KTX-Software on PATH:

```sh
blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/reward-tiles/build-chest-c2.py
node apps/game/scripts/reward-tiles/optimize-chest-c2.mjs
node apps/game/scripts/optimize-structure-models.mjs --verify reward-tiles/chest-c2.glb
```

The builder also accepts `-- --output-dir /absolute/output/directory` for an isolated source export. Always optimize a
fresh export, not an already compressed GLB.

## Delivery pipeline

`optimize-chest-c2.mjs` deduplicates and welds the source, simplifies with a target ratio of 0.5 and maximum error of
0.002, resamples animation with tolerance 0.000001, and prunes unused data. It then invokes the shared structure
optimizer: color textures become KTX2 ETC1S at quality 180 with a maximum dimension of 480 pixels, and geometry uses
Draco Edgebreaker. All node scales remain 1; animated part pivots and the two ring hierarchies remain independent.

| Measurement                | Owner source | Delivered C2 |
| -------------------------- | -----------: | -----------: |
| Bytes                      |    9,778,316 |      324,916 |
| Triangles                  |       57,542 |       40,234 |
| Mesh primitives            |           31 |           31 |
| Materials                  |           13 |           13 |
| Textures                   |        2 PNG |       2 KTX2 |
| Animation clips / channels |        1 / 7 |        1 / 7 |

Primitive counts describe asset cost, not measured whole-scene draw calls. Compression is lossy; the delivered asset was
compared with the original through the game loader at gameplay distance, close range and across the animation cycle.

## Placement and motion

Use scale 1 with the origin at the tile's ground center, Y up and the clasp facing +Z. The pedestal extends below ground
as authored. Decoded rest bounds are approximately X [-0.86603, 0.86604], Y [-0.16000, 0.96011], Z [-0.99653, 0.99653]:
a 1.73207 by 1.99307 footprint on the unit-radius hex. The original C2 presentation scale is preserved.

The `Scene` clip is an eight-second idle cycle with seven channels: a gentle body float, lid motion, orbiting gems and
handle motion. It is not a click-to-open animation. Time 0 provides the closed chest pose; the frontend owns activation
and opening feedback. The mesh and motion source are reused rather than rebuilding a new chest.

## Verification

The isolated procedural rebuild completed in background Blender. The compressed model passed the shared structure codec
and unscaled-node checks, decoded geometry bounds, all seven animation loop seams, the body float check, the four stone
palette colors and both independent inscribed rings. Actual game-loader previews beside `fallen-realm-ruin` completed
without script errors at times 0, 2, 4, 6 and 8 seconds; review captures remain outside the repository.

These previews use the game's terrain, lighting and WebGL renderer backend. Frontend site wiring, live selection and
opening behavior are separate integration work; target-device performance was not measured by these captures.
