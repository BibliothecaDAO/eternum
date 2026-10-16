# Production realm series

The packed Blender 5.2.1 files are the editable source. Citadels contain `CITADEL_EDITABLE`, the exported
`CITADEL_PRODUCTION` meshes, baked surface/grain UVs and packed textures. Canvas & Thatch retains its canonical outpost
collections; its realm export adapts the cloth slots in memory. Twin Guardians uses the organic procedural statues; the
separate sculpt study is not part of this production series.

`src/three/structures/realm-assets.json` maps every delivered file to its source. The four normal levels remain
zero-based: Canvas & Thatch, Terrace Forum, Twin Ward, empire. Wonders replace the whole realm body. City chooses Sun
Dial or Oath Arch; kingdom chooses Star Lantern or Twin Guardians. The sanctum retains seven seeded crown silhouettes.
The complete entity ID determines the variant; ownership and Order never change it.

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

## Settlement and entrance revisions

The settlement reads the same packed `../outposts/village-canvas-thatch.blend` as the village. The realm exporter runs
`prepare-canvas-settlement.py` in memory: it replaces the standard's fixed sun with the swappable Order surface, mounts
a small Order plaque on the existing left entrance post, and marks the tent seams for realm ownership tint.
Architecture, proportions, UVs, painted textures, vertex contact bake and the shared fence clearance in
`scripts/outposts/village-yard.json` are preserved. No second village source is stored. The former Wellstead source is
removed; its old builder was already retired. The settlement's height floor is 0.70 so the approved 0.808-high village
keeps its proportions; the wonder stays unchanged.

Terrace Forum removes the two window hangings and their brackets. Twin Ward removes its glass panes and lower window
rows while retaining plain upper windows. Both have larger entrances, with the gates inset to keep their wider jambs
inside the hex. `revise-realm-entrances.py` edits either packed source once and then safely does nothing on reruns:

```sh
flock /tmp/eternum-lanes-heavy.lock /path/to/blender-5.2.1 --background apps/game/asset-sources/realms/options/citadel-twin-ward.blend --threads 2 --python-exit-code 1 --python apps/game/scripts/realms/revise-realm-entrances.py
```

Use the Forum source path for the city. Export remains the command above, with `--asset kingdom` or `--asset city`. The
retained bakes follow the edited geometry through its original UVs; these small doorway edits do not introduce new
textures. The approved window revision below replaces the plain and stained infill.

The outposts-15 source places the cottages toward the side fences and the small tent at the rear-right beside the canvas
shelter. The settlement uses that exact layout. Its Order plaque locates the actual left entrance post; the source check
reads the shared hex-fence radius, post thickness and minimum clearance. No second layout or circular yard constraint is
maintained for realms.

## Solid doors and occupied windows

`revise-realm-accents.py` adds the Forum's opposite standard by duplicating its anchored banner into the existing cloth
batch, and replaces Twin Ward's two copper tips with faceted teal gems. The gems share one Refined essence material;
kingdom now uses eight materials, within the existing cap. Height and architecture remain unchanged.

`revise-realm-doors.py` fits opaque oak leaves and iron bands/studs to each existing door contour, removes the imperial
vertical bars, and merges the new faces into existing production materials. Both edits are idempotent and save the
packed source when invoked directly with Blender. The canonical Canvas & Thatch source already has closed plank doors;
the realm adapter adds its iron hardware in memory, preserving the shared village source. Run the normal family export
to regenerate all normal and wonder variants. Door faces carry `_SOLID_REALM_DOOR`; the imperial passage check must hit
the closed door through its stone frame.

`revise-realm-windows.py` applies the approved lower oak shutters and warm upper glass to the three normal stone realms.
City and kingdom retain only upper windows; empire has four lower shutters and six upper glass panels. The idempotent
edit updates both editable panels and production meshes, packs two 256px base/emission atlases, and replaces the
empire's retired glass texture. It adds a dedicated UV set while preserving the original contact and normal bakes.
Non-window faces sample white base/black emission swatches, so doors and stone do not acquire window light. No material,
primitive, triangle, render pass or runtime option is added. Each asset uses six textures, within the existing cap. Warm
glass uses standard glTF emission at 0.25; its contrast rises naturally in darker lighting.

Run the revision with Blender 5.2.1 as for the entrance script above, using the Forum, Twin Ward and empire paths from
the manifest. Then export each with `--asset city`, `--asset kingdom`, or `--asset empire` into a fresh directory. The
delivery verifier checks the infill's base/emission textures and their dedicated UV set. The normal lab comparison shows
the previous GLB beside the delivered model; there is no window-treatment selector.
