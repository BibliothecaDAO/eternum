# Frontier beast models

The production beasts come from the packed Blender sources in `apps/game/asset-sources/frontier-beasts/refined/`. Each
source retains its sculpt and painted textures. The matching `*-paint.png` files and prompts live beside the sources.
`apps/game/scripts/frontier-beasts/sculpt-beasts.py` authors these production sculpts, dispatching the approved Troll,
Cyclops, Wyvern and Hydra to `sculpt-creatures.py`, Wraith to `sculpt-weak-beasts.py`, and Ammit and Dark fey to
`sculpt-site-beasts.py`; the packed `.blend` files are the inputs to delivery rebuilds.

| Species  | Editable source under `refined/` | Production delivery under `public/models/frontier/` |
| -------- | -------------------------------- | --------------------------------------------------- |
| Troll    | `troll.blend`                    | `beast-troll.glb`                                   |
| Wyvern   | `wyvern.blend`                   | `beast-wyvern.glb`                                  |
| Hydra    | `hydra.blend`                    | `beast-hydra.glb`                                   |
| Wraith   | `wraith.blend`                   | `beast-wraith.glb`                                  |
| Cyclops  | `cyclops.blend`                  | `beast-cyclops.glb`                                 |
| Ammit    | `ammit.blend`                    | `beast-ammit.glb`                                   |
| Dark fey | `dark-fey.blend`                 | `beast-dark-fey.glb`                                |

## Rebuild and validate

From the repository root, with workspace dependencies, Blender and the texture encoder installed:

```sh
bash apps/game/scripts/frontier-beasts/rebuild.sh /absolute/path/to/a-new-beast-build
pnpm --dir apps/game verify:beasts
```

The output directory must be absolute and must not already exist. The rebuild exports every packed source through
`export-beast.py`, then compresses the fresh exports through `scripts/outposts/optimize-outpost.mjs`. It writes
`beast-{troll,wyvern,hydra,wraith,cyclops,ammit,dark-fey}.glb` and per-model logs into that external directory. It does
not overwrite production deliveries. Review the rebuilt files in the game's lab before copying an approved set to the
production paths, then run `verify:beasts` again against those delivered bytes. Never recompress an already compressed
delivery.

`verify:beasts` checks the committed GLBs' source hashes, grounded footprint at each species' maximum runtime scale,
triangle and byte budgets, one primitive, unit transforms, UVs, color and normal textures, and KTX2 encoding. The lab is
`/lab/models?family=beasts`; its Set, View, Turn and Light controls expose the current species and site compositions.

## Runtime identity and placement

Models are static, authored Z-up facing -Y and delivered Y-up facing +Z with baked transforms. Each origin is the tile's
ground center. Deliveries use Draco geometry, ETC1S color and UASTC normal textures. Terrain belongs to the scene.

`packages/core/src/utils/frontier-beast.ts` resolves each site's beast and scale from the one table by family and layer
(`BEASTS`, `packages/types/src/words/nouns.ts`); a beast without its own model stands as its fallback's. No combat tier
or count rule is derived from this art. The client beast catalog owns delivery paths and site offsets.

All use the selected sculpts. Wraith and Ammit have the latest paint/sculpt polish; Wyvern and Hydra are the approved
polished versions. Minotaur and the unselected Ghoul/Kappa/Golem outputs are retired. Selected concept paintings remain
in the lab archive as the sculpts' references.

All beast deliveries remain static primitives. `FrontierModel` adds small vertex-shader idle displacements using the
shared animation clock and different phases per instance. Grounded beasts breathe above planted feet, the Wraith lifts
through its shroud, and the fey retains hover and wing motion. No bones, animation textures, extra draws or per-frame
instance-matrix uploads are added.

The fey delivery remains one static primitive; `FrontierModel` animates hover and wing membrane displacement on the GPU,
using the game's shared animation clock. It retains the painted color and normal maps. The rift and fey share a tile
center; runtime height offset is 0.2, above the landmark scaled to 0.5. Its small authored hovering foot clearance is
retained in the source. No duplicate animated delivery is needed.

The [outpost ruin](../outposts/SOURCE.md) keeps its masonry, with the violet residue removed from the packed source.
`FrontierModel` adds one instanced six-triangle mist draw per ruin batch. Clearing the ruin removes that instance and
its mist. The lab uses the same class and material path. `verify:fallen-realm` remains a read-only decoded-triangle
gate.
