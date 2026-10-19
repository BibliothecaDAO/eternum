# Outposts

The approved camp, Canvas & Thatch village, beasts, shrine, well and ruin use packed Blender sources in
[asset-sources/outposts](../../../asset-sources/outposts/SOURCE.md).

| Runtime file | Source                      | Triangles | Primitives |   Bytes |
| ------------ | --------------------------- | --------: | ---------: | ------: |
| camp.glb     | camp.blend                  |     3,047 |          4 |  91,312 |
| village.glb  | village-canvas-thatch.blend |     6,149 |          3 | 213,200 |
| beasts.glb   | beasts.blend                |     2,963 |          5 |  93,592 |
| shrine.glb   | shrine.blend                |     1,816 |          3 |  73,524 |
| well.glb     | well.blend                  |     5,068 |          3 | 103,684 |
| ruin.glb     | ruin.blend                  |      3228 |          3 |   97152 |

These are decoded asset counts, not frame measurements. The village has a 480² painted color atlas, 240² tangent normal
atlas and vertex contact shading. The other outposts use 480² contact shading and 128² normal detail. ETC1S color, UASTC
normals and Draco geometry use the existing outpost pipeline.

Blender Z=0 exports as glTF Y=0, at the sampled terrain top; scale is one inside a radius-one pointy hex. Production
transforms are identity. All six are static. The well has modeled water ripples and highlights; MapSiteManager does not
update animations.

Camps, villages and beasts use SettlementModel's existing per-instance ownership colors. Their cloth is a separate
single-material mesh with `relationshipCloth=trim`; the modeled gold sun stays separate and unchanged. Camp roof edging
joins the same ownership surface. Other canvas, timber, roofs and the beasts' worn cloaks retain their authored
materials. These sites have no realm order assignment, so they do not use the realm-order atlas. Shrine and well use
MapSiteManager's ordinary InstancedModel path and disappear when their tile occupancy is consumed.

Rebuild fresh exports into an external directory, then copy the six verified deliveries:

```sh
export OUTPOST_BUILD_DIR=/absolute/path/outside/the/checkout
bash apps/game/scripts/outposts/rebuild-outposts.sh "$OUTPOST_BUILD_DIR"
for asset in camp village beasts shrine well ruin; do
  cp "$OUTPOST_BUILD_DIR/models/$asset.glb" "apps/game/public/models/outposts/$asset.glb"
done
pnpm --dir apps/game verify:assets scripts/outposts/outpost-assets.test.mjs
```

Set `OUTPOST_BLENDER` to Blender 5.2.1's executable if it is not on PATH. The asset gate decodes delivered geometry,
verifies bounds/codecs/budgets and rejects a merged-away ownership surface. Runtime lab and live-game paths are in
[FEATURE-MAP.md](../../../FEATURE-MAP.md).

`ruin.glb` uses packed `ruin.blend`: 3228 triangles, three primitives, 97152 bytes. Violet fissures are recessed in its
walls; the court is clear of loose rubble. The runtime beast placement and depth table are unchanged. Run
`pnpm --dir apps/game verify:fallen-realm` for the four exact-scale collision gates.

The beast courtyard refinement removes the loose central stones and widens the surviving wall plan by 18%, bounded
inside a 0.85 hex apothem. Beast scales and wall heights are unchanged. `scripts/outposts/widen-ruin-courtyard.py`
applies that source edit from the prior packed ruin to a separate output source; normal delivery rebuilds read the
committed `ruin.blend` through the existing exporter. The read-only `verify:fallen-realm` gate checks decoded
deliveries.
