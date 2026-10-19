# Cleared-site standard study

This lab proposal reuses the shipped camp's timber pole, crossbar, cloth and sun emblem. The source is
`../outposts/camp.blend`, with its packed textures and editable standard pieces. No replacement painting or unrelated
art is introduced. `scripts/frontier/export-cleared-standard.py` matches those authored pieces to the camp's baked
production meshes, retaining the UVs, color attributes and separate ownership cloth. It removes the camp and puts the
standard at the rear of a radius-one tile. The pole is 82% of its original height; horizontal detail is 110% so the
cloth remains readable. The centre stays open for a later movement implementation.

Rebuild from the repository root with Blender 5.2.1 and an external build directory:

```sh
blender --background --threads 2 --python-exit-code 1 \
  --python apps/game/scripts/frontier/export-cleared-standard.py -- /absolute/external/build/standard.glb
pnpm --dir apps/game optimize:outposts /absolute/external/build/standard.glb /absolute/external/build/standard-compressed.glb
```

The first command also retains the derived editable `.blend` and triangle summary beside its raw export. Review the
compressed result before copying it to `public/lab/cleared-site/standard.glb`. The lab uses the existing settlement
loader and ownership material. This delivery is referenced only by the cleared-site lab, never by a production model
catalog. It must be promoted or deleted when that review ends.

The two-site comparison uses the world's renderer, terrain and camera profile. The selected panel illustrates an
uncapped camp clear or XP-only stragglers from existing native fixture facts and shared reward formulas. It does not
claim to persist a paid receipt or make the live tile walkable. Those require the contract and sync change assessed
separately.
