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

Asset ID: `fallen-realm-ruin`. Runtime path: `/models/frontier/fallen-realm-ruin.glb`.

```sh
blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/frontier/build-fallen-realm.py
node apps/game/scripts/optimize-structure-models.mjs frontier/fallen-realm-ruin.glb
node apps/game/scripts/optimize-structure-models.mjs --verify frontier/fallen-realm-ruin.glb
```

One static ruin is shared by every depth. The broken gate, round watchtower with torn clay roof and partial keep retain
the existing realm architecture. A separate beast is placed at the same ground-center origin, facing +Z. Keep the ruin
at scale 1; only the beast changes scale with depth. The central courtyard is open, with a radius-0.40 clear area.
Beast-specific scale limits must account for the surrounding masonry as well as the tile boundary. The model contains no
guard statistics or chest: frontend state chooses the beast and presents the existing C2 reward on clear.

Stone vertex colors supply per-block slate variation and moss-darkened lower courses. A thin, cool courtyard stain
replaces rubble within the original geometry budget; it is a ground marking, not a collision obstacle. The roof is
charred and missing panels. All of this retains three material draws, distinct from the pale living-realm stone.
