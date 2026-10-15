# Production realm series

The packed Blender 5.2.1 files are the editable source. Each contains `CITADEL_EDITABLE`, the exported
`CITADEL_PRODUCTION` meshes, baked surface/grain UVs and packed textures. Twin Guardians uses the organic procedural
statues; the separate sculpt study is not part of this production series.

`src/three/structures/realm-assets.json` maps every delivered file to its source. The four normal levels remain
zero-based: Wellstead, Terrace Forum, Twin Ward, empire. Wonders replace the whole realm body. City chooses Sun Dial or
Oath Arch; kingdom chooses Star Lantern or Twin Guardians. The sanctum retains seven seeded crown silhouettes. The
complete entity ID determines the variant; ownership and Order never change it.

Model-local Y=0 is the terrain top. The contact skirt reaches -0.03. City, kingdom and empire retain the approved floor.
All models fit one radius-one pointy hex and stay under 25,000 triangles, eight materials and six texture maps at 480 px
maximum. The empire is the height ceiling. The export checks closed outward-facing roofs, footprint, curtain height,
attached details and the two independent `orderCloth=banner` slots.

The cloth and gate surfaces use independent full-panel UVs. Runtime ownership remains green for owned and red for other
holdings, with the realm Order in the shared banner atlas. Never merge these surfaces into the stone body.

Export to a fresh directory, inspect the delivered models in `/lab/models?family=realms`, then copy the verified GLBs
into `public/models/realms`. The exporter validates the packed sources before exporting and the compressed result
afterward; it uses the shared KTX2 compressor and Draco with 20-bit positions.

```sh
flock /tmp/eternum-lanes-heavy.lock pnpm --dir apps/game optimize:realms --blender /path/to/blender-5.2.1 --output /absolute/fresh/export
flock /tmp/eternum-lanes-heavy.lock pnpm --dir apps/game verify:structures
```

Use `--asset twin-guardians` to export one entry. Seven sanctum entries share the same source and use their manifest
seed to select the authored crown, palette and proportions. Exporting does not edit the packed source. Do not repeatedly
compress delivered GLBs: always start from the packed Blender file.

The rising aura lives in `src/three/structures/realm-living-aura.ts`. One GPU batch per wonder model draws 48 rising
motes and two soft horizontal lights (100 triangles per placement). Every vertex starts above the complete model,
including flags and crowns. Entity-seeded colour and phase are instance attributes; all animation is evaluated on the
GPU. The same system serves map, realm view and labs. No ring GLB is loaded.
