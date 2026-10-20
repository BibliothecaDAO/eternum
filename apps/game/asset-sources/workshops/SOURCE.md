# Craft Yard Workshop

The selected Craft Yard is the production `ResourceLabor` building, outside the board's central keep.
`/lab/models?family=workshops` compares the same production asset with the shipped Farm and Workers Hut. The discarded
hall source, painting, delivery and lab option are removed. The castle GLB remains for Research and its construction
card.

`craft-yard.png` is the approved painting. `painted-surfaces.png` supplies clay, oak, limestone and limewash.
`craft-yard.blend` is the packed Blender 4.5 LTS source:

- `WORKSHOP_EDITABLE`: separate contour-modeled architecture, staggered lapped clay courses with a closed timber
  underside, fitted fascias and seated ridge caps, adzed beams, trestle bench, flagstones and tools.
- `WORKSHOP_SCULPT`: worn-edge bevels, a dense subdivided surface and restrained relief displacement. Subdivision and
  displacement remain editable modifiers; geometry supplies roof laps and timber joints.
- `WORKSHOP_DELIVERY`: one consolidated lower-resolution mesh, painted swatch UVs, a separate normal-bake UV layout,
  packed textures and baked contact shading in vertex colors.

The worktop is 0.48 × 0.23 authoring units, down from 0.68 × 0.30, turned along the yard. Its trestles narrow with it.
The hoist and suspended load move left; the storage wing moves right and has a narrower, lower roof. The lower wing
meets below the hall eave, leaving an open work lane. Tile joints stagger, courses overlap, and continuous boarding
closes the underside. These are refinements to the selected L-shaped design and terracotta palette, not a new concept.

The model occupies one radius-one pointy hex at scale one. Blender Z=0 becomes glTF Y=0 at terrain top; separate
flagstones reach slightly below ground. The hoist is static. One base appearance serves every Workshop tier; this change
refines the selected architecture and fixes its production identity without adding new tier variants.

## Delivery and rebuild

The delivery has 6,100 triangles, one primitive and one material. Painted color is 480², sculpted normals 240², with
16-sample Cycles contact bakes. The existing static-landmark verifier enforces 6,296 triangles and 257,144 bytes; source
export is stricter at 6,250 triangles, matching the shipped hut tier family.

```sh
bash apps/game/scripts/workshops/rebuild.sh /absolute/fresh/output-directory
```

The wrapper exports the saved packed source outside the checkout, reuses the outpost/static-model compressor (ETC1S
color quality 180, UASTC normal level 2/RDO 0.5/Zstd 18, Draco edgebreaker), and verifies footprint, textures,
transforms and budgets. `WORKSHOP_BLENDER` selects Blender if needed. After review, copy `craft-yard.glb` to
`apps/game/public/models/new-buildings-opt/workshop.glb`. The lab resolves this through the production catalog; there is
no separate preview delivery. Source and concept SHA-256 values are embedded in the GLB.

To intentionally recreate the editable source:

```sh
blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/workshops/author-workshops.py
```

Authoring replaces later manual source edits; normal export does not. The constructor reacquires UV handles after
allocating color attributes and validates each swatch and alpha before saving.

`pnpm --dir apps/game verify:assets scripts/workshops/workshop-assets.test.mjs` decodes the delivery, verifies its
footprint, transforms and budgets, checks the UVs and textures, matches source/concept hashes and enforces construction
thumbnail fill. The renderer's keep/Workshop distinction has behavioral tests in `hexception-building-model.test.ts`.
The interactive proofs and thumbnail regeneration command are in
[FEATURE-MAP.md](../../FEATURE-MAP.md#workshop--craft-yard).
