# Outposts

The approved camp and Canvas & Thatch village use packed Blender sources in
[asset-sources/outposts](../../../asset-sources/outposts/SOURCE.md). Fallen realm ruins
(`apps/game/src/three/structures/ruin-kit.ts`) and wells and shrines
(`apps/game/src/three/structures/well-shrine-kit.ts`) are built procedurally at runtime.

| Runtime file | Source                      | Triangles | Primitives |   Bytes |
| ------------ | --------------------------- | --------: | ---------: | ------: |
| camp.glb     | camp.blend                  |     3,047 |          4 |  91,312 |
| village.glb  | village-canvas-thatch.blend |     6,149 |          3 | 213,200 |

These are decoded asset counts, not frame measurements. The village has a 480² painted color atlas, 240² tangent normal
atlas and vertex contact shading. The other outposts use 480² contact shading and 128² normal detail. ETC1S color, UASTC
normals and Draco geometry use the existing outpost pipeline.

Blender Z=0 exports as glTF Y=0, at the sampled terrain top; scale is one inside a radius-one pointy hex. Production
transforms are identity. Both are static.

Camps and villages use SettlementModel's existing per-instance ownership colors. Their cloth is a separate
single-material mesh with `relationshipCloth=trim`; the modeled gold sun stays separate and unchanged. Camp roof edging
joins the same ownership surface. Other canvas, timber and roofs retain their authored materials. These sites have no
realm order assignment, so they do not use the realm-order atlas.

Rebuild fresh exports into an external directory, then copy the two verified deliveries:

```sh
export OUTPOST_BUILD_DIR=/absolute/path/outside/the/checkout
bash apps/game/scripts/outposts/rebuild-outposts.sh "$OUTPOST_BUILD_DIR"
for asset in camp village; do
  cp "$OUTPOST_BUILD_DIR/models/$asset.glb" "apps/game/public/models/outposts/$asset.glb"
done
pnpm --dir apps/game verify:assets scripts/outposts/outpost-assets.test.mjs
```

Set `OUTPOST_BLENDER` to Blender 5.2.1's executable if it is not on PATH. The asset gate decodes delivered geometry,
verifies bounds/codecs/budgets and rejects a merged-away ownership surface. Runtime lab and live-game paths are in
[FEATURE-MAP.md](../../../FEATURE-MAP.md).

Fallen realm ruins are generated procedurally in `apps/game/src/three/structures/ruin-kit.ts` with seeded per-hex
variants and runtime ground mist. Run `pnpm --dir apps/game verify:fallen-realm` for the exact-scale beast collision
gates across all procedural ruin variants.
