# Settlement models

The four realm levels use `settlement.glb`, `city.glb`, `kingdom.glb`, and `empire.glb` in the world map, local realm
view and graphics lab. Camps, villages and stragglers use the [outpost family](../outposts/SOURCE.md).

Rebuild a realm from the repository root (replace `settlement` with the desired tier):

```sh
blender --background --python-exit-code 1 --python apps/game/scripts/settlements/build-settlement.py
node apps/game/scripts/compress-models.mjs --only settlements/settlement.glb
```

The checked-in Blender generators and shared geometry helpers are the editable source. Each build also writes an
editable `.blend` and asset report under `.context/graphics-lab/realm-progression/<tier>/`. Those local artifacts and
discarded concept renders are excluded from the shipped assets.

Geometry is authored Z-up with entrances facing -Y; export bakes transforms for instancing. The GLB uses Y-up, with
entrances facing +Z. Terrain supplies the ground.

Mesh extras drive presentation: `settlementMotion` selects banner, flame, gem spin, or foliage animation;
`relationshipCloth` identifies village colors, and `orderCloth` identifies realm colors and emblems. Keep these surfaces
separate from static material consolidation. Wall hangings remain static so wind cannot push them through the facade.
