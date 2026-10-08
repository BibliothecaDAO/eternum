# Reusable troop families and scale

These are the owner's family requirements, not a request to build all tiers or identities during a single-model test.
Concept and raw-mesh approval stages in SKILL.md govern new assets. Reuse existing scale evidence and accepted
interfaces; only make cheap fitting proxies when a real unresolved footprint question requires them. A missing final rig
does not block high-quality geometry generation. Do not impose proxy geometry as the final anatomical source.

## Shared scale and formations

H=.598 at hex radius 1 is the **human stature reference**, 15% above the earlier H=.52 study. Measure a rider's
standing-equivalent human stature against the same neutral standing reference as a foot soldier; a seated pose's bounds,
cap/plume, equipment or complete mounted assembly do not define H. Knights, crossbowmen and riders retain this common
human scale across skins and mounts. Mounts can be larger or smaller independently. Fit seat, stirrup and rein contacts
to the mount while preserving the rider's human scale; do not resize the rider or normalize the whole assembly to H.

Record human calibration separately from mount dimensions and complete-assembly bounds. Preserve source/delivery
transforms so an already calibrated model is not enlarged again. Building doors, tools and props use the same human
reference. H is project context, not a universal unit or required skeleton. All current and future troop types follow
the same display rule:

| Troop class    | Examples                                     | Models per occupied hex            |
| -------------- | -------------------------------------------- | ---------------------------------- |
| Foot soldiers  | Knights, crossbowmen, future unmounted types | 1–6                                |
| Mounted troops | Paladins, future mounted types/creatures     | 1–3 complete rider-and-mount units |

For mounted troops, use one centred, two side by side, three in a triangle. Test every supported count and the largest
loadout/identity at the maximum count; counts represent army size, not independent scaling of each figure. Exact army
strength thresholds remain gameplay-owned. Do not enlarge a lone model to fill its hex. All human foot soldiers and
riders retain appropriate common stature/proportions from the mounted-rider calibration; larger mounts do not imply
larger humans. Building doors, tools, scaffolds and props use this same human scale even when building mass is stylized.

T1 horses are the smallest mount class. The owner requested future width reserve about 1.5–2×, preferably preserving
seat height. Width overlays prove packing only: future anatomy must still allow rider thighs, stirrups and equipment.
Measure swept motion and weapon/tail clearance, not just static bounds. Keep rider/equipment dimensions fixed while
fitting different mounts. The previous 7.5% horse enlargement and forward seat repair are historical test adjustments;
do not automatically add another 7.5% or the same offset to a new well-proportioned Tripo model.

## Per-unit detail allowance at runtime

For each actual engine quality preset and distance LOD, let **T** be the allocated triangle budget for one complete
foot-soldier instance. Allocate **2T** for one complete mounted instance. Thus a full hex budgets **6 × T = 3 × 2T**
triangles. Use this relationship for Knights, crossbowmen, Paladins and every future foot/mounted type. It provides
mounted units additional geometry/detail headroom without doubling the maximum per-hex geometry workload.

Count the complete rendered instance: body, armour, weapons, secondary items and hair; mounted accounting also includes
the mount, saddle, tack, mane/tail and other attached geometry. The rider and mount share 2T; they do not each receive
2T. Count instanced/shared meshes per visible draw instance when calculating rendered hex triangles, while reporting
shared storage separately. Record exported triangles as the common unit; authoring polygons/quads must be triangulated
for like-for-like accounting. Set T from actual game-preset requirements, not an invented universal number.

This is an allowance, not a demand to add useless polygons or a promise of twice the perceptual quality. Spend the extra
mounted headroom where it best preserves the ideal rider/mount assembly. Texture/material/rig/frame-time costs still
need their own per-hex measurements; do not interpret 2× geometry as an automatic 2× texture width/height or equivalent
performance. Keep comparable humans visually coherent despite different total assembly budgets.

Apply these allocations only to runtime derivatives after establishing the full-detail ideal. Retain ideal-versus-preset
comparison at every count, with the maximum count used for per-hex cost acceptance. A new type uses the foot/mounted
category; it does not silently introduce another count or scale rule.

## Family rigs, not individual reinventions

Maintain one versioned troop-type contract across T1/T2/T3 and skins; compatible humanoid classes may share a deform
skeleton with different equipment/pose profiles. Riders and mounts remain distinct rigs joined at a seat interface.
Different creature anatomy may need a separate mount adapter; it still supports the same rider lifecycle.

Inspect actual runtime seams such as `apps/game/src/three/characters` and existing adapters before naming a canonical
rig. Preserve usable imported weights and map them where practical. During geometry selection a rig can be honestly
pending. Freeze names, hierarchy, rest axes/roll and inverse-bind rules only after representative anatomy/ROM passes. Do
not force new detailed anatomy onto the rough experiment's bone lengths or mandatory joint count.

Fit new meshes to compatible family proportions. Approved limb-length variants need versioned identity bindings,
recorded rest/inverse-bind changes and retarget/IK validation. Reuse each binding across that identity's tiers/skins.
Shared definitions do not mean one mutable pose instance for the entire army.

## Model skins and replaceable equipment

Anatomy, clothing and armor belong to each model skin. Armor may use separate objects for authoring but has no
independently equippable slots. Primary, secondary and mount/tack remain distinct. Knight and Paladin use weapon +
shield; Crossbowman uses crossbow + quiver, with both hands supporting the primary. Equipment roles are not synonyms for
left/right hand. Items stay within their troop family, even when sockets or shapes look similar. Use the versioned
[family development contract](troop-development.md) for compatibility and independent work. Ownership is shown by a
separate game mechanism, not recoloring materials. Preserve surfaces required by the actual exposed/moving joints;
provider segmentation does not reconstruct hidden interiors. Do not build modular-armor body masks for this brief.

Soft armour fits to the body and receives reviewed weights; rigid plates stay rigid or articulate in sections. Weapons
and secondaries keep authored world dimensions across identities. Use documented grip/socket contact frames and axes,
not unexplained per-model rotations. Remove inherited body scaling from rigid attachment roots. Saddle, reins and
stirrup targets drive mounted contact while preserving human proportions.

Simple accurately shaped gloved fists are permitted; finger animation is unnecessary for the current brief. Check
palm/thumb/handle placement, neutral wrists, elbow direction and continuous shoulder/forearm anatomy. Shield interiors
use direct forearm placement close to the arm, with no rear arm loops, straps or bands; follow
[equipment fitting](equipment-fit.md). Reins connect to the mouth bit, with compatible left-hand reach. Review contacts
from both sides, top and underneath plus diagnostic poses. Numerical bone distance is not grip quality.

## Appearance and variants

Current T1 Paladin: unarmoured horse, rider in the latest approved protective leather/metal skin and cap; sword in the
right hand, shield on left forearm, left hand holds reins. Exact cap, sleeve and other design details come from the
latest approved concept and feedback, not an older pilot. Use fixed authored palettes for troop, mount and building
materials. Later user direction can revise the brief; do not attach these class-specific rules to unrelated assets.

For production Paladin approval, provide three distinct reusable mount coat textures A, B and C on compatible mount
geometry/UVs. Count 1 shows A; count 2 A/B; count 3 A/B/C, with stable slots across count changes and reloads. Inspect
the three textured coats in the game scene and count their memory and transfer cost. Knights and crossbowmen have no
requested identity or texture pool. Do not infer an infantry variant program from this Paladin requirement. The current
scale-review pilot retains coat A; authored B/C maps remain pending under the user’s permission to defer non-scale
additions for this iteration. A fixed colour multiplier is not a substitute for the required coat textures.

For Paladin count changes retain the ordered A/B/C assignment in surviving slots and append/remove trailing slots. Do
not randomize on every frame, count change or reload. Army strength thresholds remain gameplay scope.

## Efficient production

Generate only missing source parts. Show the complete concept packet first; derive uncluttered component references
without redesigning it. Use high-quality Tripo anatomy and retain its detailed materials. Do not spend reconstruction
effort recreating an approved source as tubes/ovals. Transfer weights/fit armour with tested surface/cage methods and
inspect nearby limbs for cross-influence. IK/control rigs are authoring tools; export supported joints/sockets for
Three.js procedural animation. Keep diagnostic motion in offline artifacts; runtime exports are clip-free.

Use the same comparison site and locked cameras for art fidelity, then inspect a shareable actual game-instance
composition with real terrain, renderer, multiple troop/building placements and Three.js procedural motion. Inspect the
runtime export with selected matched reference captures or the temporary detailed source while it is needed. Keep only
game-ready models live in the workshop and stage. Maintain separate outcomes for structure, visible model quality,
deformation and runtime cost. Model development and [motion development](procedural-animation.md) are distinct tracks
with a shared rig/contact handoff. When both are commissioned, progress independently where inputs permit; missing
future actions do not force regeneration or prevent an honest model-ready handoff. Runtime action acceptance requires a
validated binding and contact baseline.
