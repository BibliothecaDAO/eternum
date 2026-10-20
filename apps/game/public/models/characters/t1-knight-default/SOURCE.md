# T1 Knight Default

The production T1 Knight with its sword and shield. All land T1 Knights use it, without a query parameter or build flag.
Ships retain their naval representation; other troop tiers retain their existing models.

The world map loads only the visible skin LOD: near within 12 world units of the camera, mid beyond that, and icons at
the far content band. Sword and shield are shared by both skins. A prepared skin stays cached until its runtime closes;
returning to it does not fetch it again. Loading a replacement keeps the previous representation until it is ready. The
map uses scale 1.67 to match the former T1 Knight's approximately 1.024-unit standing height.

| File              | Triangles | Vertices | Maps        | Joints |
| ----------------- | --------- | -------- | ----------- | ------ |
| `near/skin.glb`   | 13,499    | 19,954   | 3 × 1024 px | 31     |
| `mid/skin.glb`    | 4,498     | 8,077    | 3 × 512 px  | 31     |
| `near/sword.glb`  | 500       | 636      | 3 × 512 px  | none   |
| `near/shield.glb` | 1,000     | 1,696    | 3 × 512 px  | none   |

One figure with sword and shield is 14,999 triangles at near and 5,998 at mid, in three draws. The same sword and shield
serve both levels.

## Delivery sizes

| File            | Original bytes | Delivered bytes | Reduction |
| --------------- | -------------: | --------------: | --------: |
| near/skin.glb   |      3,476,800 |       2,381,832 |     31.5% |
| mid/skin.glb    |      1,169,232 |         725,968 |     37.9% |
| near/sword.glb  |        426,340 |         402,980 |      5.5% |
| near/shield.glb |        623,252 |         561,340 |      9.9% |
| Total           |      5,695,624 |       4,072,120 |     28.5% |

A cold mid view fetches 1,690,288 bytes of Knight assets; a cold near view fetches 3,346,152 bytes. These counts exclude
the shared renderer/runtime and other asset families. The gear maps were already 512 px; they remain 512 px. Image
payloads dominate these small rigid meshes, so Draco's reduction is smaller than on the skins.

Use the same delivery pipeline as structures (position and generic precision are 20 bits for this rig to retain
normalized weights):

```sh
node apps/game/scripts/optimize-structure-models.mjs characters/t1-knight-default/near/skin.glb characters/t1-knight-default/mid/skin.glb characters/t1-knight-default/near/sword.glb characters/t1-knight-default/near/shield.glb
pnpm --dir apps/game verify:t1-knight-default
```

The verifier decodes Draco before checking joints, weights, inverse binds, triangle budgets and texture dimensions.
Decoded vertex counts can increase at attribute seams; triangle counts and the 31-joint skin stay unchanged.

## What the files hold

Every file is a Draco-compressed GLB: one mesh, one primitive, one single-sided PBR material with base colour, normal
and one ORM image (occlusion, roughness, metallic) as embedded KTX2 images (colour ETC1S, normal and ORM UASTC, from
`pnpm compress:models`). No animation clips. Axes are the game's: +Y up, +Z forward, +X the character's left, in metres,
feet on y = 0. The figure stands about 0.61 to the top of the helmet.

The skins carry 31 joints: the 25 core joints in the family order, then `elbow_half_l/r`, `knee_half_l/r` and
`upperarm_twist_l/r`. Every joint is a node with a translation and no rotation, so a joint's local rotation is its turn
from rest. The six helpers are never keyed. The runtime turns them each frame from the joint they follow
(`procedural-character-driven-joints.ts`, declared on the adapter in `t1-knight-default-humanoid-rig-adapter.ts`):

- `elbow_half` and `knee_half` take half of the forearm's or shin's rotation.
- `upperarm_twist` takes where the upper arm points plus 40% of its roll. The shoulder plates and everything under them
  are bound to it, so a plate neither turns its underside forward in a guard nor wrings the sleeve overhead.

Armour plates are each bound whole to one joint. Hands have no finger joints: the right hand is a fist bored for the
sword's grip, the left a closed fist. The sword sits on `hand_r` (`gripRight`) and the shield on `lowerarm_l`
(`forearmLeft`), so wrist rotation never moves the shield. The sword's blade runs along +Y from an origin at the grip's
centre; the shield's front faces +Z from an origin at the centre of its rear face.

`apps/game/asset-sources/characters/t1-knight-default/runtime-fit.json` is the measured data the adapter is filled from:
rest positions, helper rules and twist axes with 66 worked cases, both sockets, three knuckle points per hand and the
feet. The adapter test and the driver test read it: the first compares the adapter's hands, feet, sockets and driven
joints with it, the second takes its 66 worked cases from it. Its `from` field names the bound model file the data was
measured from, which is among the sources kept by the author.

`poses.json` beside it is how the Knight holds itself with the shield and the sword, measured from the pose set the
model was approved with: three idle states, the guard standing, walking and running, the hit reaction, and four attacks
(cut, backhand, chop, thrust) in three moments each. Each state gives, for both arms, where the wrist goes, the point
the elbow bends toward and the hand's turn on the forearm; for the body, the pelvis' turn, height and place over the
feet, the chest's turn against the pelvis and the head's against the chest; and where each foot stands and points. It
also records what the game should then show. The sword and shield declare these states in the catalog
(`melee/t1-knight-default-gear-poses.ts`), and `t1-knight-default-arms.test.ts` compares the catalog with the file and
the posed skeleton with its expected values. The catalog declares two idles (relaxed and sword on shoulder) and two
attacks, the cut and the chop, which a bearer makes in turn. Measured in `poses.json` but not declared: relaxing from
guard to `idle-at-ease` swings the shield's rim 5.1 mm into the thigh; the backhand puts the sword arm through the
shield and the blade through the shield arm; the thrust takes the blade 3 mm into the shield and the sword arm to within
1 mm of it on the way to the lunge. Declaring one of them is a data change in the catalog: the bearer then makes the
declared attacks in turn. Known limit: the viewer sees the cut's contact about 0.1 s after the contact event, because
the pose filter trails the controller and the strike is faster than the filter; the declared states lead by the filter's
lag, which brings the blade within about 120 mm of the contact pose when the event fires. Its `from` block names the
pose set and the two scripts that measured it, which are proposed with the tools in #5031, and the bound model, which is
kept by the author. For the reader it also records how close each state is to the approved pose it comes from and how
far sword, shield and body stay apart.

## Checking the files

```sh
cd apps/game
pnpm verify:t1-knight-default
pnpm test src/three/characters
pnpm verify:assets
```

`validate-t1-knight-default-exports.mjs` checks structure, the 31 joints by name and order, weights and embedded KTX2
maps. `t1-knight-default-exports.test.ts` (in `pnpm verify:assets`) pins each file's SHA-256, so a replaced file has to
be re-pinned on purpose.

## Where the model comes from

The figure is one Tripo multiview generation (model version 3.1) from the project's own four-view concept art for the T1
Knight. Tripo supplied the surface and its texture only. The sword and shield come from an earlier Tripo generation of
the same design and were resized to the approved grip and diameter.

The skeleton and weights were not generated. Weights for cloth and skin are transferred from a template body built on
the CC0 MakeHuman base mesh (none of that mesh is in these files); plates are bound by a table from part labels. Half of
the body under each plate is rebuilt so plates can lift off it. The two levels are reductions that keep the full model's
vertices and weights, with the texture baked from it; roughness and metallic are corrected so the steel reads as worn
rather than polished.

The editable sources (the raw generation, the labelled and bound full-detail model, the Blender file of the sword and
shield) and the Python tools that bind, reduce, bake and export are not in this repository. They are kept by the author.
Replacing a file here means re-exporting all four and `runtime-fit.json` together, compressing each with
`pnpm compress:models --only characters/t1-knight-default/<file>`, then updating the adapter and the hash pins from
them.

## Known limits

- Rivets, rolled plate rims and buckles are painted detail at these budgets; they hold at whole-figure and half-figure
  framing, not in close-ups of a single limb.
- The shield's rim is a 1,000-triangle outline and reads as a polygon when it fills the screen.
- The right fist is a hammer grip. The blade stands about 67 degrees from the forearm and cannot be brought into line
  with the arm.

## Licence and attribution

The figure, the sword and the shield were generated with [Tripo](https://www.tripo3d.ai) (model version 3.1) from this
project's own concept art, on a paid Tripo account.

Tripo's terms treat free and paid use differently. Models made on a paid plan belong to the account holder, who may use
them commercially, and no credit to Tripo is required. Models made on the free plan are public and licensed CC BY 4.0,
which does require credit. Tripo is named here as the source, not because attribution is owed. If a file here is ever
regenerated on a free plan, that changes. (Checked 2026-10-08 against Tripo's help pages on commercial use.)

The skinning weights derive from the MakeHuman base mesh's rig data, which is CC0. None of that mesh is in these files.
