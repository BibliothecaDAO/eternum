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

At scale 1, decoded bounds are approximately X [-0.34758, 0.34759], Y [0.00206, 1.12756], Z [-0.21307, 0.31500]. The
footprint is 0.69517 by 0.52807. The first contact with the ruin occurs at uniform scale 1.47417; use **1.46** as the
maximum depth scale, retaining a small margin. The tile alone would allow 2.28746, so the ruin is the limiting shape.

The placement verifier decodes the compressed GLBs, checks the actual pointy-hex boundary, and finds first contact with
ruin triangles using a 0.005 scale sweep and bisection. Courtyard ground paint is a support surface, not an obstacle.
These limits assume the shared origin and +Z facing; remeasure after either mesh or placement changes. The frontend owns
one depth-to-scale table. Do not bake a second enlarged copy or scale the ruin along with the beast.
