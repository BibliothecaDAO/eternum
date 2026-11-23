# Frontier beast models

All nineteen production beasts (Surface five, Veil five, Hollow five, and Deep four) ship through the Tripo pipeline
(`pnpm --dir apps/game ship:model --kind beast`) from committed editable sources under
`apps/game/asset-sources/tripo/frontier/beast-<species>/{source.glb,fit.json}`. Each delivered GLB under
`public/models/frontier/beast-*.glb` embeds `assetKind: "beast"`, `sourceSha256`, and `fitSha256` matching its committed
`source.glb` and `fit.json`. Retired legacy `.blend` sculpts and their Blender export scripts have been removed; concept
paintings remain under `apps/game/asset-sources/frontier-beasts/refined/` as references.

## Rebuild and validate

From the repository root, with workspace dependencies and `ktx` installed:

```sh
pnpm --dir apps/game ship:model \
  --input apps/game/asset-sources/tripo/frontier/beast-<species>/source.glb \
  --fit apps/game/asset-sources/tripo/frontier/beast-<species>/fit.json \
  --kind beast \
  --out apps/game/public/models/frontier/beast-<species>.glb
pnpm --dir apps/game verify:beasts
```

`verify:beasts` runs `assertDeliveredAsset` from `apps/game/scripts/tripo/ship-model.mjs` against `BEAST_BUDGET`,
checking budgets, grounded footprint at each species' maximum runtime scale, unit transforms, UVs, KTX2 encoding,
`tripoMaterial` tags, and exact `sourceSha256`/`fitSha256` equality against the committed files in
`asset-sources/tripo/`. The lab is `/lab/models?family=beasts`; its Set, View, Turn and Light controls expose the
current species and site compositions.

## Runtime identity and placement

Models are static, delivered Y-up facing +Z with baked transforms. Each origin is the tile's ground center. Deliveries
use Draco geometry, ETC1S color/emissive and UASTC technical textures. Terrain belongs to the scene.

`packages/core/src/utils/frontier-beast.ts` resolves each site's beast and scale from the one table by family and layer
(`BEASTS`, `packages/types/src/words/nouns.ts`), and each Deep site's beast by its kind (`DEEP_BEASTS`, read by the
map's Deep sites). Every species ships its own model with no fallback stand-ins. No combat tier or count rule is derived
from this art. The client beast catalog owns delivery paths and site offsets.

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
