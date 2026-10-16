# Frontier map structures

The procedural builders in `apps/game/scripts/frontier/` are the editable source. They reuse the settlement geometry and
limestone bake. No hand-authored Blender file is required. Generated textures are packed into each source export;
temporary bake files are removed after packing. Terrain comes from the scene, not the model.

## Placement and compression

Every model's origin is the tile's ground center. Geometry is authored Z-up, facing -Y, and exported Y-up, facing +Z,
with baked transforms. Load at scale 1 on a radius-one hex; the builder rejects geometry outside its inscribed circle.
Compression uses the existing structure pipeline: Draco geometry, ETC1S color and UASTC normal textures. Rebuild before
recompressing.

## Fallen realm ruin

The fallen-realm ruin now belongs to the [outpost family](../outposts/SOURCE.md), with packed `ruin.blend` and runtime
path `/models/outposts/ruin.glb`. Its old builder and GLB are removed. The beast remains at the shared ground-center
origin, facing +Z; the ruin stays at scale one. Central rubble and recessed violet fissures replace the old courtyard
stain and wall treatment. The depth table remains troll 1.2, wyvern 1.35, hydra 1.45 and hydra 1.7.

`pnpm --dir apps/game verify:fallen-realm` decodes delivered triangles and verifies all four placements against the new
ruin, with zero masonry contacts and a radius-one footprint at a 0.001 BVH tolerance. Conservatively retained runtime
maximum scales are not new first-contact measurements.

## Troll

Asset ID: `beast-troll`. Runtime path: `/models/frontier/beast-troll.glb`.

```sh
blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/frontier/build-beast-troll.py
node apps/game/scripts/optimize-structure-models.mjs frontier/beast-troll.glb
node apps/game/scripts/optimize-structure-models.mjs --verify frontier/beast-troll.glb
node apps/game/scripts/frontier/verify-beast-placement.mjs beast-troll
```

The Troll's hunched shoulders, long arms, tusks and stone club are a static presentation. Place it at the ruin's origin,
facing +Z. It has no ruin geometry or gameplay statistics. Skin volumes are fused before export; the shared procedural
surface bake supplies the hide grain. The ground-center origin and baked transforms match the structures.

## Wyvern

Asset ID: `beast-wyvern`. Runtime path: `/models/frontier/beast-wyvern.glb`.

```sh
blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/frontier/build-beast-wyvern.py
node apps/game/scripts/optimize-structure-models.mjs frontier/beast-wyvern.glb
node apps/game/scripts/optimize-structure-models.mjs --verify frontier/beast-wyvern.glb
node apps/game/scripts/frontier/verify-beast-placement.mjs beast-wyvern
```

Two clawed legs, upright folded wings, a horned head and a tucked tail distinguish the Wyvern from the Troll. Skin uses
the shared grain bake; wing membranes, eyes and horns retain separate materials. The pose is static and shares the
ruin's origin and +Z facing.

## Hydra

Asset ID: `beast-hydra`. Runtime path: `/models/frontier/beast-hydra.glb`.

```sh
blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/frontier/build-beast-hydra.py
node apps/game/scripts/optimize-structure-models.mjs frontier/beast-hydra.glb
node apps/game/scripts/optimize-structure-models.mjs --verify frontier/beast-hydra.glb
node apps/game/scripts/frontier/verify-beast-placement.mjs beast-hydra
```

Five S-curved necks rise from staggered roots: two low heads watch the gate, one high head anchors the center, and two
heads sweep sideways from the rear. Unequal lengths and opposing bends separate the silhouette and shadow. Dark teal
hide and pale throat strips distinguish it from the other beasts. The pose is static; deeper Hydra encounters reuse this
file at a larger uniform scale from the frontend's single depth table. There is no separate deep-Hydra export.

## Shrines and wells

The approved shrines and wells now live in the [outpost family](../outposts/SOURCE.md), with packed Blender sources and
the shared outpost export pipeline. Their old builders and GLBs are removed. They remain static, single-use sites
managed by tile occupancy: shrines grant an attribute level, wells restore stamina. The client owns discovery, use and
removal.
