# Ethereal landmarks

The spire and Bitcoin mine are base-free landmarks placed on the procedural Three.js ethereal biome. Their former basalt
bases and ground veins are removed; terrain owns the support surface and flowing neon gameplay-hex borders. Align
model-local Y=0 with the occupied terrain top, currently 0.12, without an additional landmark lift. Both use a
radius-one pointy gameplay hex. Source binaries are committed only in the same change as their shipped GLBs.

## Spire

`spire.glb` is the hand-authored S2 dimensional spire: a hovering shard and fragments, plus a translucent purple sphere
wrapped in neon currents, with one eight-second `Spire_Loop`. Upper-model emission and animation remain intact. The
editable source is `apps/game/asset-sources/ethereal/spire/spire.blend` (Blender 5.2.1, textures packed, production
collection `SPIRE_V2_PRODUCTION`). Its three former `spirePart=base` objects are absent from source and export.

Rebuild from the repository root with Blender 5.2.1 and Khronos KTX-Software 4.4.2 on PATH:

```sh
blender --background apps/game/asset-sources/ethereal/spire/spire.blend --python-exit-code 1 --python apps/game/scripts/spires/export-spire.py
pnpm --dir apps/game optimize:spire
pnpm --dir apps/game verify:structures
pnpm --dir apps/game verify:assets
```

The optimizer resamples the clip, limits textures to 480 px, encodes them as KTX2 and applies Draco without flattening
the hierarchy: six current parents intentionally reach zero scale to hide inward-motion resets. Raw exports match byte
for byte. Comparing all 241 authored poses before and after base removal gives zero upper-hierarchy matrix change. The
lowest floating geometry stays at least 0.0473 above local support. The refitted export is 564,268 bytes, 25 primitives
and 11,712 triangles, with eight materials, six KTX2 textures and 43 animation channels; the preceding base-bearing
export was 603,840 bytes, 29 primitives and 16,140 triangles. These are asset counts, not frame draw costs.

Runtime: `src/three/structures/spire-model.ts` evaluates the hierarchy with a stable phase per placement and shares
instanced stone draws. `spire-portal.ts` composes rear light, translucent core and front light, splitting currents by a
per-fragment ray/sphere test; separate portals sort on camera moves, including while animation is paused.
`spire-veins.ts` retains saturated upper-model vein cores and narrow additive shells on shared instance buffers, because
the renderer runs without screen-space bloom.

`apps/game/scripts/spires/build-spire.py` is the earlier procedural obelisk variant for a later cosmetic. It writes
`spire-obelisk.glb`, which is not committed or loaded; wiring it needs its own model path because the runtime spire
requires the hand-authored asset's portal metadata and clip.

## Bitcoin mine

`bitcoin-mine.glb` retains the tilted digital cube, shallow gold excavations, blue circuitry, oak decks, ladders, rope
derrick, suspended ore bucket and cart. Its editable source is
`apps/game/asset-sources/ethereal/bitcoin-mine/bitcoin-mine.blend`, with editable parts in `MINE_EDITABLE_PARTS` and six
baked material groups in `BITCOIN_MINE_PRODUCTION`. Review cameras/lights are excluded from export. Units are meters,
Blender Z up and glTF Y up. Exported mesh nodes have identity transforms; the mine has no animation.

The 12 foundation posts, two cart tyres and two handle ends meet local support within 1e-6. The cart is refitted as a
rigid assembly with a 20.9791-degree pitch. Ladder feet and the tilted cube have shallow contact skirts, with a maximum
embed of 0.00812, to prevent light gaps. All six 60-degree placements fit the gameplay hex. The occupied terrain must
provide a flat support plane across that hex. The refit preserves the cube's navy/gold three-shade vertex palettes, gold
emission strength 1.5 and blue circuitry strength 1.2.

Export the committed source and optimize it from the repository root:

```sh
blender --background apps/game/asset-sources/ethereal/bitcoin-mine/bitcoin-mine.blend --python-exit-code 1 --python apps/game/scripts/bitcoin-mine/export-mine.py
node apps/game/scripts/optimize-structure-models.mjs ethereal/bitcoin-mine.glb
node apps/game/scripts/optimize-structure-models.mjs --verify ethereal/bitcoin-mine.glb
pnpm --dir apps/game verify:assets
```

To rebuild the editable mine from its procedural construction script:

```sh
blender --background --threads 4 --python-exit-code 1 --python apps/game/scripts/bitcoin-mine/build-mine.py
```

The builder resolves paths from its own file and creates output directories, so it works from a clean checkout and any
working directory. It writes the editable source above and local intermediate/review output under
`.context/bitcoin-mine/`. It generates the wood texture and pixel palettes procedurally; no Spire source, external image
or previous session file is an input. The builder does not overwrite the public GLB; run the export and optimization
commands afterward. The exporter defaults to the public GLB; an optional path after `--` selects another raw export
location.

Export uses selected static production meshes, Y up, materials and active vertex colors, with no cameras, lights,
extras, morphs or Blender-side compression. The shared optimizer limits textures to 480 px, encodes the wood color map
as ETC1S quality 180, stamps its hash and applies Draco Edgebreaker compression. Use fresh source exports as inputs. The
refitted mine is 130,784 bytes, six primitives/materials, 27,346 triangles and one KTX2 texture; the preceding
base-bearing revision was 450,948 bytes, eight material groups, 31,506 triangles and three textures.

## Verification and local evidence

`scripts/spire-assets.test.mjs` checks both exports for compression, base removal, supported transforms and mine contact
bounds, plus the Spire's portal metadata, loop duration and hidden current resets. Source checks confirm all 141 mine
structural parts connect to the 12 foundations, all 15 required gantry joints meet, and no equipment intersects the
cube. Raw exports from both saved sources repeat identically.

Concepts, Blender renders, screenshots, validation reports and earlier base-bearing versions remain local under
`.context/`; they are not committed beside the source binary or shipped GLB. Refitting evidence for this change is in
`.context/ethereal-layer/biome-tiles/landmarks/`. Source contact checks and construction renders do not replace runtime
acceptance. Verify loading, lighting, terrain contacts, all six placements, complete Spire animation, renderer backends
and representative density in the lab and live game, and retain those captures with the change's local evidence.
