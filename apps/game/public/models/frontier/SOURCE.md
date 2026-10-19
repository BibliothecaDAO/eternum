# Frontier beast models

The five production beasts come from the packed Blender sources in `apps/game/asset-sources/frontier-beasts/refined/`.
Each source retains its sculpt and painted textures. The matching `*-paint.png` files and prompts live beside the
sources. `apps/game/scripts/frontier-beasts/sculpt-beasts.py` authors these production sculpts, dispatching the approved
Troll and Cyclops to `sculpt-creatures.py`; the packed `.blend` files are the inputs to delivery rebuilds.

| Species  | Editable source under `refined/` | Production delivery under `public/models/frontier/` |
| -------- | -------------------------------- | --------------------------------------------------- |
| Troll    | `troll.blend`                    | `beast-troll.glb`                                   |
| Wyvern   | `wyvern.blend`                   | `beast-wyvern.glb`                                  |
| Hydra    | `hydra.blend`                    | `beast-hydra.glb`                                   |
| Minotaur | `minotaur.blend`                 | `beast-minotaur.glb`                                |
| Cyclops  | `cyclops.blend`                  | `beast-cyclops.glb`                                 |

## Rebuild and validate

From the repository root, with workspace dependencies, Blender and the texture encoder installed:

```sh
bash apps/game/scripts/frontier-beasts/rebuild.sh /absolute/path/to/a-new-beast-build
pnpm --dir apps/game verify:beasts
```

The output directory must be absolute and must not already exist. The rebuild exports all five packed sources through
`export-beast.py`, then compresses the fresh exports through `scripts/outposts/optimize-outpost.mjs`. It writes
`beast-{troll,wyvern,hydra,minotaur,cyclops}.glb` and per-model logs into that external directory. It does not overwrite
production deliveries. Review the rebuilt files in the game's lab before copying an approved set to the production
paths, then run `verify:beasts` again against those delivered bytes. Never recompress an already compressed delivery.

`verify:beasts` checks the committed GLBs' source hashes, grounded footprint at each species' maximum runtime scale,
triangle and byte budgets, one primitive, unit transforms, UVs, color and normal textures, and KTX2 encoding. The lab is
`/lab/models?family=beasts`; its Set, View, Turn and Light controls expose the current species and site compositions.

## Runtime identity and placement

Models are static, authored Z-up facing -Y and delivered Y-up facing +Z with baked transforms. Each origin is the tile's
ground center. Deliveries use Draco geometry, ETC1S color and UASTC normal textures. Terrain belongs to the scene.

`src/three/structures/frontier-beast.ts` owns species paths, depth/band selection, scales and site composition. The
standing depth beasts are Troll, Wyvern and the three-headed Hydra; the two roaming encounters use Minotaur and Cyclops.
Species art does not define combat tiers. Both the model and player-facing identity use that shared resolver.

Troll and Cyclops use the owner-approved creature sculpts. Wyvern and Hydra studies and their editable sources live in
`asset-sources/lab/frontier-beasts/`, outside deployment. The local lab serves their GLBs at `/lab/frontier-beasts/`;
`rebuild.sh <fresh-absolute-directory> creatures` rebuilds those two separately. The rejected Minotaur study is removed.

The ruin, shrines and wells belong to the [outpost family](../outposts/SOURCE.md). The ruin delivery is
`/models/outposts/ruin.glb`; the beast is a separate model. `pnpm --dir apps/game verify:fallen-realm` is a read-only
geometry check of the delivered ruin and depth beasts. It reads the shared runtime depth table and checks all four ruin
placements, plus both roaming beasts without a structure. It reports tile fit and masonry intersections; rerun it after
model changes. A passing beast footprint/source check alone does not establish ruin clearance.
