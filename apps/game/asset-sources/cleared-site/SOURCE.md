# Cleared-site standard

The cleared-site standard reuses the shipped camp's timber pole, crossbar, cloth and sun emblem. The source is
`../outposts/camp.blend`, with its packed textures and editable standard pieces. No replacement painting or unrelated
art is introduced. `scripts/frontier/export-cleared-standard.py` matches those authored pieces to the camp's baked
production meshes, retaining the UVs, color attributes and separate ownership cloth. It removes the camp and puts the
standard at the rear of a radius-one tile. The pole is 82% of its original height; horizontal detail is 110% so the
cloth remains readable. The centre stays open for an army on the cleared tile.

Rebuild from the repository root with Blender 5.2.1 and an external build directory:

```sh
blender --background --threads 2 --python-exit-code 1 \
  --python apps/game/scripts/frontier/export-cleared-standard.py -- /absolute/external/build/standard.glb
pnpm --dir apps/game optimize:outposts /absolute/external/build/standard.glb /absolute/external/build/standard-compressed.glb
```

The first command also retains the derived editable `.blend` and triangle summary beside its raw export. Review the
compressed result before copying it to `public/models/outposts/cleared-standard.glb`. It stands only beside a supply
post, as part of the post's model (`SUPPLY_POST_STANDARD_MODEL_PATH` in the camp catalog), with the same delivery,
settlement loader and ownership material. A cleared site without a post shows no model.
