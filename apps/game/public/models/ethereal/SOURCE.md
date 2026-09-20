# Ethereal landmarks

The spire and Bitcoin mine sit on the procedural Three.js ethereal biome. Their former full-hex basalt bases and ground
veins are removed; terrain owns the level support surface. Flowing neon gameplay-hex borders appear only on the ethereal
layer; surface spire patches blend whole basalt slabs into revealed neighboring terrain. The spire retains only a small
rooted rock outcropping beneath its portal. Align model-local Y=0 with the terrain top, currently 0.12, without an
additional landmark lift. Both use a radius-one pointy gameplay hex. Source binaries are committed only in the same
change as their shipped GLBs.

## Spire

`spire.glb` is the hand-authored S2 dimensional spire: a hovering shard and fragments, plus a translucent purple sphere
wrapped in neon currents, with one eight-second `Spire_Loop`. Portal emission and animation remain intact. The editable
source is `apps/game/asset-sources/ethereal/spire/spire.blend` (Blender 5.2.1, textures packed, production collection
`SPIRE_V2_PRODUCTION`). Its three former `spirePart=base` objects remain absent. A fixed, non-emissive 19-column
outcropping sits beneath the portal: 1.226 wide, 1.132 deep and 0.155 high, with a 0.006 contact skirt below local
ground. Its original seven columns vary from 0.101 to 0.155 high; the surrounding twelve vary from 0.047 to 0.080,
forming a lower step within the gameplay hex. All share the spire's packed basalt material. Every main column slopes
inward at both ends: eighteen sloping shoulders and no flat caps above, nineteen sloping bottoms below. The central
shaft stays a full-width hexagon above the highest surrounding shoulder (3.438), then closes in one short continuous
point whose taper starts at 3.819 and is 0.14 high, so the core has a single apex at 3.959.

The former winding exterior veins are replaced by 24 flat mineral inclusions, each strictly vertical and 0.111–0.220
long. They occupy the recessed V-shaped junctions between two neighboring rock columns, with dark intervals between
them. Each of eight viewing sectors contains exactly three veins, distributed from local height 1.490 to 3.277. No veins
remain on the floating fragments or the grounded outcropping. The BLUE, ORANGE and PINK material names remain for the
production light treatment. The committed packed source is all a clean-checkout export needs.

Rebuild from the repository root with Blender 5.2.1 and Khronos KTX-Software 4.4.2 on PATH:

```sh
blender --background apps/game/asset-sources/ethereal/spire/spire.blend --python-exit-code 1 --python apps/game/scripts/spires/export-spire.py
pnpm --dir apps/game optimize:spire
pnpm --dir apps/game verify:structures
pnpm --dir apps/game verify:assets
```

The optimizer resamples the clip, limits textures to 480 px, encodes them as KTX2 and applies Draco without flattening
the hierarchy: six current parents intentionally reach zero scale to hide inward-motion resets. Raw exports match byte
for byte. Comparing all 241 authored poses across the crown/outcrop/seam revision gives zero matrix change for all 42
production objects; all 19 portal, floating-fragment and outcrop meshes remain unchanged. The outcropping has no
animation and does not intersect any portal surface across the complete loop; the nearest sampled portal vertex remains
0.04005 away. The revised main core also clears every portal surface through all 241 poses, with minimum sampled vertex
clearance 0.07744. The current export is 553,212 bytes, 23 primitives and 10,624 triangles, with eight materials, six
KTX2 textures and 43 animation channels. The preceding base-free export was 564,268 bytes, 25 primitives and 11,712
triangles. These are asset counts, not frame draw costs.

Runtime: `src/three/structures/spire-model.ts` evaluates the hierarchy with a stable phase per placement and shares
instanced stone draws. `spire-portal.ts` composes rear light, translucent core and front light, splitting currents by a
per-fragment ray/sphere test; separate portals sort on camera moves, including while animation is paused.
`local-emissive-glow.ts` retains saturated upper-model vein cores and narrow additive shells on shared instance buffers,
because the renderer runs without screen-space bloom.

`apps/game/scripts/spires/build-spire.py` is the earlier procedural obelisk variant for a later cosmetic. It writes
`spire-obelisk.glb`, which is not committed or loaded; wiring it needs its own model path because the runtime spire
requires the hand-authored asset's portal metadata and clip.

## Bitcoin mine

`bitcoin-mine.glb` retains the tilted digital cube, shallow gold excavations, blue circuitry, oak decks, ladders, rope
derrick, suspended ore bucket and cart. The mine is procedural: `apps/game/scripts/bitcoin-mine/build-mine.py` is the
source, in the repository convention for generated assets. It builds the editable parts (`MINE_EDITABLE_PARTS`), bakes
the six production material groups (`BITCOIN_MINE_PRODUCTION`), generates the wood texture and pixel palettes, and
exports the raw GLB. The `.blend` it saves under `.context/bitcoin-mine/` is review output, not a committed source.
Review cameras and lights are excluded from export. Units are meters, Blender Z up and glTF Y up. Exported mesh nodes
have identity transforms; the mine has no animation. Built with Blender 5.2.1.

The 12 foundation posts, two cart tyres and two handle ends meet local support within 1e-6. The cart is a rigid assembly
with a 20.9791-degree pitch. Ladder feet and the tilted cube have shallow contact skirts, with a maximum embed of
0.00812, to prevent light gaps. All six 60-degree placements fit the gameplay hex. Every ethereal tile provides the same
flat support plane at every zoom. The cube keeps its navy/gold three-shade vertex palettes, gold emission strength 1.5
and blue circuitry strength 1.2; the gold material name is what `local-emissive-glow.ts` keys its light diffusion on.

Rebuild and optimize from the repository root with Blender 5.2.1 and Khronos KTX-Software 4.4.2 on PATH:

```sh
blender --background --threads 4 --python-exit-code 1 --python apps/game/scripts/bitcoin-mine/build-mine.py
pnpm --dir apps/game optimize:bitcoin-mine
pnpm --dir apps/game verify:structures
pnpm --dir apps/game verify:assets
```

The builder resolves paths from its own file and creates output directories, so it works from a clean checkout and any
working directory. It writes the raw export straight to the public GLB and its report and review renders under
`.context/bitcoin-mine/`. No Spire source, external image or previous session file is an input.
