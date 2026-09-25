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

At scale 1, decoded bounds are approximately X [-0.36498, 0.36499], Y [0.00154, 1.33574], Z [-0.27777, 0.28080]. The
footprint is 0.72997 by 0.55856. First ruin contact is at uniform scale 1.39012; the recommended maximum is **1.38**.
The tile-only limit is 2.37275. These are measured with the same verifier and placement assumptions as the Troll.

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

At scale 1, decoded bounds are approximately X [-0.35135, 0.34541], Y [0.01752, 1.71955], Z [-0.27902, 0.34451]. The
footprint is 0.69676 by 0.62353. First ruin contact is at uniform scale 1.71673; the recommended maximum is **1.70**.
The tile-only limit is 2.00147. Preserve the shared ground-center origin and +Z facing; keep the ruin at scale 1.

## Shrine

Asset ID: `shrine`. Runtime path: `/models/frontier/shrine.glb`.

```sh
blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/frontier/build-shrine.py
node apps/game/scripts/optimize-structure-models.mjs frontier/shrine.glb
node apps/game/scripts/optimize-structure-models.mjs --verify frontier/shrine.glb
```

The arch, sun relief and altar follow the approved Direction A. This is a static site: research unlocks discovery; using
it grants one attribute level and removes tile occupancy. There is no spent model, opening animation, ownership cloth or
separate gameplay state embedded in the GLB. Frontend integration owns visibility and removal.

This is an asset handoff to the Frontier frontend lane; live placement and interaction validation belong to that
integration. The existing C2 chest is reused unchanged. Ring-plot highlighting is frontend-owned and has no model.
