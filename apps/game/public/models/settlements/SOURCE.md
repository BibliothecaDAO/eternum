# Settlement models

These five authored models are shared by the world map, local realm view, and graphics lab. Villages and mercenary camps
use `village.glb`; realm levels use `settlement.glb`, `city.glb`, `kingdom.glb`, and `empire.glb`.

Rebuild a model from the repository root (replace `village` with the desired tier):

```sh
blender --background --python-exit-code 1 --python apps/game/scripts/settlements/build-village.py
node apps/game/scripts/compress-models.mjs --only settlements/village.glb
```

The checked-in Blender generators and shared geometry helpers are the editable source. Each build also writes an
editable `.blend` and asset report under `.context/graphics-lab/realm-progression/<tier>/`. Those local artifacts and
discarded concept renders are excluded from the shipped assets.

Geometry is authored Z-up with entrances facing -Y; export bakes transforms for instancing. The GLB uses Y-up, with
entrances facing +Z. Terrain supplies the ground. Yurt wall height is 0.39 units and roof peak is 0.56 units, with the
approved village footprint preserved.

Mesh extras drive presentation: `settlementMotion` selects banner, flame, gem spin, or foliage animation;
`relationshipCloth` identifies village colors, and `orderCloth` identifies realm colors and emblems. Keep these surfaces
separate from static material consolidation. Wall hangings remain static so wind cannot push them through the facade.
