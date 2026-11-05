# Forearm shields and sword grips

Read for shield concepts, assembly, socket fitting or motion review. Apply the user's accepted family design; preserve
unaffected skins and historical source lineage.

## Shield construction

Eternum shields omit rear arm loops, straps and bands, including crossed horizontal/vertical loops. Use a simple rear
surface and sensible placement on the forearm. Preserve the approved front/rim, thickness, UVs and authored materials;
avoid unsupported interior detail that adds clipping without a gameplay-scale benefit. Concept/component prompts must
state this. If an approved source already has loops, a user-directed removal is a local repair, not a new concept or
provider-spend gate. Inspect the actual rear mesh: deleting disconnected islands alone may miss fused loops. Remove
identified loop surfaces and close only the resulting unintended holes; check rear, edge, underside and clay/material.
Do not call all decorative front/rim bands forbidden arm straps.

Keep the shield independently removable. In Blender, group/parent the item to the intended left forearm attachment frame
for assembly; in runtime, use that rig adapter's semantic forearm socket. Bone-local offset/orientation must be recorded
with coordinate convention and authored-to-runtime scale. A forearm attachment must inherit elbow/forearm motion without
independent wrist rotation dragging it off the arm. Do not skin the shield into armor or attach it to the world/root to
make one pose look right. Other items retain their actual hand/rein contacts.

Fit the rear plane beside the bracer/forearm surface, with practical clearance and a stable support region. Check the
rim against hand, elbow, torso, hip, thigh, sword and adjacent actors. An offset equal to an old authored target is not
proof of anatomical fit. Inspect visible surfaces; nearest-vertex distances and broad-phase boxes are only proxies.

## Sword construction and grip

Record distinct local axes for handle/blade length, blade width (edge-to-edge) and broad-face normal. In a neutral
Knight guard, the cutting edges face actor forward/rear; the flat blade faces mainly sideways. This is a grip
convention, not a demand to lock the blade to world forward during attacks. A small natural hand/grip angle is
permitted. Verify both guard orientation and cutting-plane alignment along the attack arc on the actual exported mesh.

Place the handle within the existing palm/finger grasp volume, with thumb/finger enclosure and guard clear of knuckles.
A zero socket error only says two mathematical frames agree. Show right-grip close-ups from at least two useful angles,
including a profile exposing blade thickness and handle depth. Do not require new finger bones or cosmetic hand redesign
when a simple approved grip suffices. Change source geometry only when placement cannot solve the diagnosed fit.

## Integrated check

Reopen the compact source, round-trip affected exports and inspect the actual runtime rig. Exercise equipped idle,
defend, walk, run, attack and their affected transitions when commissioned; include maximum reach, torso turn, shield
raise and recovery with intermediate frames. Look at blade plane, palm enclosure and shield-to-forearm relation in
continuous playback as well as close stills. Measure actual posed surfaces where possible; record remaining occlusion,
sampling and skin-compatibility limits. Test replacement/removal and near/mid representation changes through existing
loaders. A different compatible skin must be fitted/checked rather than assumed compatible because loops are absent. At
a coherent motion milestone repeat required formations (1–6 infantry or 1–3 mounted) and gameplay-scale views.
