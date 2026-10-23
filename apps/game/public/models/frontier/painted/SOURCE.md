# Painted Frontier buildings

Game-ready versions of the 33 approved painted Frontier building masters: the four realm castles, Farm, Workshop,
Barracks and Workers' hut at tiers I–V, the four training buildings and five map sites. They are delivered for
integration. The lab draws them through `InstancedModel` on game terrain (FEATURE-MAP.md, "Frontier buildings — painted
set"), but the board and the world map still draw the shipped models.

## Sources and rebuild

The masters are the approved high-resolution assemblies: 26 to 112 MB each, 23k to 79k triangles and up to 38 draws.
They stay outside the repository, and each delivery records its master's SHA-256 (`masterSha256` on the architecture
node). `scripts/frontier-painted/export-painted-building.py` turns a master into the editable source committed under
`asset-sources/frontier-painted/<id>.glb`: uncompressed, with PNG textures at delivery size. The shared outpost
optimizer compresses that source with Draco edgebreaker geometry, ETC1S colour and emission at quality 180 and UASTC
normals. `stamp-source.mjs` then records the source's SHA-256 (`sourceSha256`) on the delivery.

From the repository root, with installed client dependencies and Khronos KTX-Software on PATH:

```sh
bash apps/game/scripts/frontier-painted/rebuild.sh /absolute/fresh/output                     # from the committed sources
bash apps/game/scripts/frontier-painted/rebuild.sh /absolute/fresh/output /absolute/masters   # export <masters>/<id>/game.glb first
pnpm --dir apps/game verify:painted-buildings
```

Set `FRONTIER_PAINTED_BLENDER` to Blender 5.2's executable if it is not on PATH. A reviewed rebuild is copied to
`asset-sources/frontier-painted/` (its `sources/`) and here. Compressing the committed sources again reproduces every
delivery byte for byte.

## The export

The architecture (every static part) is joined and welded, and small holes are capped: the generated masters carry some,
and decimation would otherwise widen one into a dark slit. It is then decimated to its catalogue budget
(`src/three/structures/frontier-painted-buildings.json`) and shaded smooth only across creases under 45°. Colour (and
the rift's emission) is baked from the master's full-resolution parts by ray at twice the atlas size, then scaled down
to the catalogue's atlas: 1024² for castles and board buildings, 512² for map sites, the outposts' texture class. A 256²
tangent normal map is baked the same way. The master's back-face liners are dropped, because every runtime material is
double-sided.

The parts the game drives stay separate:

- `ground`: the master's ground plate, its texture at 512².
- `tier-banner`: the tier flag, decimated to 30% of its cloth, its numeral composited into a 256² texture. Its far side
  samples the texture mirrored, so the numeral reads correctly from both sides.
- `order-cloth`: the castle flags, `orderCloth: "banner"`. Each flag spans the order canvas's width from its pole and
  the 256 × 512 canvas's band around the emblem (centred 205 px from the top). Its far side is mirrored.
- `rotor`: a farm's sails. They turn a quarter in 2.5 s at one speed, through six 15° morph targets about the hub (clip
  `rotor`, linear keys), and their four equal sails make the loop seamless.

## Runtime contract

Every node transform is the identity. Every vertex, at rest and in each rotor pose, lies inside the unit-radius pointy
hex (apothem √3/2), and the ground sits at y = 0. `InstancedModel` draws a part's geometry without its node transform,
and these deliveries need none. Each part names itself in `extras.frontierPart`. The architecture node also carries
`frontierBuilding`, `masterSha256` and `sourceSha256`.

A tier banner records its pole as `poleAxis` ([x, z] in model space). The board, the placement preview and
`InstancedModel` turn such a part back about its pole by the model's yaw (`src/three/structures/held-heading.ts`). Every
tier banner flies to screen right, broadside to the camera, at each of the board's six headings. The exporter refuses a
banner that would meet its building at any of those headings. The board plays the rotor clip with its AnimationMixer.
`InstancedModel` animates the first clip's morph weights, written where three reads them
(`src/three/managers/morph-texture-dirty-state.ts`).

## Measurements

Decoded counts and delivered file sizes, not frame measurements; a draw is one glTF primitive. The shipped model is the
one the game draws today where the painted building would stand.

| Model             | Triangles | Draws | Atlas |   Bytes | Master: size, triangles, draws | Shipped today: bytes, triangles, draws                    |
| ----------------- | --------: | ----: | ----: | ------: | ------------------------------ | --------------------------------------------------------- |
| settlement        |     8,987 |     3 | 1024² | 362,712 | 36 MB, 49,678, 7               | `realms/settlement.glb`: 253,916, 6,183, 5                |
| city              |    13,258 |     3 | 1024² | 378,632 | 34 MB, 66,776, 11              | `realms/city.glb`: 375,732, 9,692, 7                      |
| kingdom           |    17,793 |     3 | 1024² | 411,520 | 36 MB, 66,454, 19              | `realms/kingdom.glb`: 478,512, 15,808, 8                  |
| empire            |    22,870 |     3 | 1024² | 436,892 | 30 MB, 71,544, 38              | `realms/empire.glb`: 466,116, 24,953, 8                   |
| farm-1            |     8,987 |     4 | 1024² | 559,324 | 33 MB, 48,839, 15              | `new-buildings-opt/farm.glb`: 505,660, 5,470, 7           |
| farm-2            |     8,986 |     4 | 1024² | 514,740 | 63 MB, 53,637, 17              | `frontier/buildings/farm-2.glb`: 508,612, 5,826, 7        |
| farm-3            |     8,986 |     4 | 1024² | 510,952 | 62 MB, 52,706, 15              | `frontier/buildings/farm-3.glb`: 511,732, 5,982, 7        |
| farm-4            |     8,971 |     4 | 1024² | 471,088 | 92 MB, 60,744, 26              | none                                                      |
| farm-5            |     8,963 |     4 | 1024² | 478,744 | 92 MB, 60,678, 23              | none                                                      |
| workshop-1        |     8,986 |     3 | 1024² | 329,908 | 54 MB, 23,248, 11              | `new-buildings-opt/workshop.glb`: 225,752, 6,100, 1       |
| workshop-2        |     8,987 |     3 | 1024² | 343,344 | 51 MB, 25,052, 14              | `new-buildings-opt/workshop.glb`: 225,752, 6,100, 1       |
| workshop-3        |     8,987 |     3 | 1024² | 339,772 | 29 MB, 35,067, 13              | `new-buildings-opt/workshop.glb`: 225,752, 6,100, 1       |
| workshop-4        |     8,988 |     3 | 1024² | 351,596 | 55 MB, 39,082, 16              | none                                                      |
| workshop-5        |     8,987 |     3 | 1024² | 352,952 | 83 MB, 47,635, 16              | none                                                      |
| barracks-1        |     8,986 |     3 | 1024² | 357,796 | 65 MB, 44,109, 9               | `new-buildings-opt/barracks.glb`: 352,780, 9,299, 2       |
| barracks-2        |     8,988 |     3 | 1024² | 362,320 | 34 MB, 44,304, 10              | `frontier/buildings/barracks-2.glb`: 354,492, 9,611, 2    |
| barracks-3        |     8,987 |     3 | 1024² | 360,992 | 63 MB, 52,292, 12              | `frontier/buildings/barracks-3.glb`: 356,704, 9,731, 2    |
| barracks-4        |     8,987 |     3 | 1024² | 369,240 | 94 MB, 56,802, 14              | none                                                      |
| barracks-5        |     8,986 |     3 | 1024² | 365,504 | 33 MB, 53,495, 11              | none                                                      |
| workers-hut-1     |     8,988 |     3 | 1024² | 362,892 | 84 MB, 62,109, 11              | `new-buildings-opt/workers_hut.glb`: 310,936, 5,902, 2    |
| workers-hut-2     |     8,987 |     3 | 1024² | 362,156 | 84 MB, 65,585, 13              | `frontier/buildings/workers-hut-2.glb`: 312,384, 6,186, 2 |
| workers-hut-3     |     8,988 |     3 | 1024² | 360,876 | 111 MB, 70,299, 14             | `frontier/buildings/workers-hut-3.glb`: 314,084, 6,246, 2 |
| workers-hut-4     |     8,987 |     3 | 1024² | 364,076 | 112 MB, 71,449, 13             | none                                                      |
| workers-hut-5     |     8,986 |     3 | 1024² | 367,196 | 84 MB, 71,777, 14              | none                                                      |
| war-hall          |     8,720 |     2 | 1024² | 320,816 | 29 MB, 52,632, 2               | `new-buildings-opt/archerrange.glb`: 365,924, 8,114, 2    |
| supply-yard       |     8,720 |     2 | 1024² | 338,796 | 30 MB, 46,651, 3               | `new-buildings-opt/market.glb`: 362,040, 7,404, 2         |
| scouts-lodge      |     8,720 |     2 | 1024² | 344,964 | 29 MB, 59,502, 3               | `new-buildings-opt/stable.glb`: 564,940, 7,401, 4         |
| hearth            |     8,720 |     2 | 1024² | 338,600 | 36 MB, 53,505, 4               | `new-buildings-opt/workers_hut.glb`: 310,936, 5,902, 2    |
| camp              |     5,000 |     1 |  512² | 192,592 | 32 MB, 54,108, 2               | `outposts/camp.glb`: 91,312, 3,047, 4                     |
| fallen-realm-ruin |     4,999 |     1 |  512² | 191,424 | 40 MB, 49,904, 1               | `outposts/ruin.glb`: 92,208, 2,908, 2                     |
| shrine            |     3,993 |     1 |  512² | 158,276 | 26 MB, 51,169, 3               | `outposts/shrine.glb`: 73,524, 1,816, 3                   |
| well              |     3,999 |     1 |  512² | 178,488 | 33 MB, 44,652, 3               | `outposts/well.glb`: 103,684, 5,068, 3                    |
| essence-rift      |    10,000 |     1 |  512² | 253,364 | 43 MB, 79,063, 2               | `reward-tiles/rift.glb`: 1,120,924, 35,910, 28            |

## Verification and review

`verify:painted-buildings` decodes each delivery through glTF Transform. It checks the size limit, the Draco and KTX2
codecs, the draw count, double-sided materials, identity transforms, the hex footprint and grounding (rotor poses
included), the triangle and atlas budgets, the source hash, and each part's runtime data: the banner's pole, the order
cloth's role, and the rotor's clip and its constant speed.

Each export was rendered offline beside its master at the game camera and reviewed cold. The compressed deliveries were
reviewed in the lab through the game's loader, terrain and lighting, at gameplay and detail distances. That review
covered the held banners at three of the board's headings, and the rotor stepped through a loop on a stopped clock.
Review captures remain outside the repository.

## Integration not done here

- The board, the placement preview and the world map still load the shipped models. Swapping a family is a path change
  in its mode's asset map, plus that mode's preload plan.
- Realm castles face the camera, as realm models do. They carry `orderCloth: "banner"`, which `SettlementModel` reads
  for the order's heraldry, but no other ownership surface.
- The camp has no `relationshipCloth`, so a swap would lose the ownership colours the shipped camp shows.
- The shipped essence rift animates; this one is static.
- `buildingTierModelPath` has no Workshop entry, and the game ships tier models only for tiers II and III. The set
  covers tiers I to V.
- Under the game's daylight, the pale gravel ground of the Workshop, Barracks and training building plates reads lighter
  than in the offline renders. It is the masters' own texture.
