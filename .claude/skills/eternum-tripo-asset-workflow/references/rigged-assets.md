# Rigging for procedural game motion

Geometry approval comes first. Rigging makes the approved model poseable; it does not authorize replacing its anatomy.
Troops remain animated even when no rig exists yet. In schema-v2 provider specs, set `rigStatus: pending` and
`canonicalSkeleton: null` honestly during geometry development. Resolve a real family rig or validated adapter before
claiming runtime compatibility. Legacy schema-v1's pre-generation rig requirement is not the new workflow.

## Minimum contract

Record separate rider/mount skeletons where relevant, actual forward/up units, rest/bind pose, bone semantics, intended
sockets and attachment frames, root motion ownership and allowed joint ranges. Reuse a proven type rig across tiers and
skins; do not canonize the rough test's joint count or force generated anatomy onto unsuitable donor proportions.
Preserve usable imported rig/weights where available; adapt names/rest space through a tested mapping. Author missing
controls in Blender, export only supported deform joints/sockets. Rigify/IK/cages are optional authoring aids, not
mandatory pipelines. Keep one armature pose instance per actor, with reusable definitions; shipped exports remain
clip-free. Prove the imported bind pose and neutral runtime pose on the actual skinned export before tuning gait or
repairing microdetail. A clean rest skeleton alone does not show that the runtime adapter preserves skinning and
attachments.

## Fit and deform

Fit meshes and armour to shared anatomy, seed weights with surface interpolation where appropriate, normalize and review
joints in motion. Nearest-surface transfer can cross nearby limbs; inspect shoulder/hip/neck junctions and armour seams.
Do not replace full weight painting with coordinate thresholds. Rigid weapons/shields keep their authored size,
orientation and contact frames. Simple well-shaped gloved fists are accepted for this troop brief: finger animation is
not required. Their palm/thumb/handle relationship still has to look plausible from all sides.

Mounts need a working seat interface, pelvis/thigh/stirrup contacts and reins to mouth-bit attachments. Ground the
complete hoof or sole, including its underside and orientation, in the same frame used by the rig and terrain sampler; a
target point or animated bounds is not the visible contact surface. Check each required front and hind joint chain over
its allowed range, including bend direction, original target reach before clamping, and sole-to-terrain clearance.
Hair/mane/tail may have a small deform chain where it benefits future procedural motion; avoid dozens of decorative
bones before basic anatomy is accepted. Keep saddle/girth weight transfer fitted to the moving mount surface.

For forearm shields and swords, follow [equipment fit](equipment-fit.md): no rear shield loops/bands, an independently
removable forearm attachment, actual hand enclosure and blade-edge orientation. Check the exported surfaces through
affected motions; mathematical socket agreement alone does not establish fit.

## Diagnostic motion only by default

For a separately commissioned animation task use [procedural motion](procedural-animation.md) and the selected family
pathway. Required future idle/walk/run/attack/defend readiness is tracked independently; a default-skin task may hand
off a validated rig/ROM while unfinished action cells remain explicit. Armor is integral to the skin, with only weapons
and secondary items exposed as equipment slots. Test actual required semantic capabilities instead of inventing fake
bones.

Use a short action or pose set exercising head turn/tilt, arm raise/reach, elbow flex, wrist orientation, torso twist,
hip/knee bend and mount leg swing. Add simple idle/walk tests when requested. Include intermediate poses and practical
range limits; render problem regions at extremes. No required run/attack/hurt/death library, facial animation, cloth
simulation or ragdoll/Jolt implementation for a model test. Add these only with explicit project scope.

Three.js owns procedural locomotion and placement in this workflow. Document bone forward axes, local rotation limits,
rest pose, sockets, contact targets and reset behaviour for that handoff. Blender IK/constraints must be baked into
necessary diagnostic clips or represented by actual runtime solver data; do not claim they export as solvers.

## Optional Tripo rigging

Do not auto-rig all candidates. Once the selected geometry is approved, use direct Blender rigging or a usable provider
rig according to expected fidelity and effort. Provider rig tasks/retarget clips consume separately recorded approved
spend. Verify current CLI `anim` help, check riggability, record task IDs, keep both unrigged and rigged results
temporarily through comparison/weight transfer, and inspect deformation. At handoff retain the compact source and
evidence under [retention](retention.md). A provider rig may be retained if it meets the same family/export contract; do
not discard working weights solely because they were generated. Reusable contract requirements remain real, not rigid
skeleton reconstruction rituals.

## Acceptance

Separate structural skin/joint/inverse-bind checks from visible deformation quality. Review source and exported mesh
from all angles, through range extremes and simple motion, with actual item swaps when commissioned. Runtime checks
include root ownership, contact, state reset and drift. Inspect continuous motion and measure contact clearance, stance
drift, underside clearance extent, joint excursions and target reach over a complete moving-root gait; an issue-free
pose report is not sufficient visual or physical evidence. Verify capture stepping matches the configured time step and
measure actual phase coverage; a declared duration alone does not prove a full cycle. Ensure review fixtures do not
occlude required camera views. For mounted motion, keep the rider phase-locked to the mount while giving the upper body
its own response and preserving pelvis, seat, thigh and stirrup contact through the cycle. Apply
`docs/architecture/animation-evaluation.md` in the active repository only to the relevant integration scope. Testing two
clips does not certify arbitrary future procedural poses; retain tested limits and unresolved seams.

If a contact defect persists after a bounded repair, freeze one failing frame before further tuning. Record the original
and solved target, root/ankle frames, segment lengths, sole orientation, contact phase and active limits. Check whether
a fixed end orientation changes the remaining chain's reach, and whether bend poles remain stable in rest space. Reuse
that frame as a small regression fixture. Do not accumulate target offsets, loosen acceptance thresholds or retune every
gait to conceal a coordinate or reach error.

## Current procedural contract

For troop delivery, inspect the active `ProceduralUnitRuntime`, humanoid/horse libraries and rig adapters before
choosing a skeleton or exporting clips. Validate semantic bone mapping, rest axes, skin/inverse binds and one actor root
per rider or mount. Gloved hands need a real minimal-hand capability or attachment landmarks for grip and wrist;
individual finger bones are not a mandatory art requirement and fake aliases are not a valid adapter. Calibrate seat,
pelvis, thighs, stirrups and rein targets against the source anatomy. Test all required front and hind horse joints and
moving-root hoof contact in the actual procedural pose range. Keep forearm shield and rein-hand contacts independent;
equipment remains removable and rigid where authored. Blender ROM actions are diagnostics and must be excluded from
shipped runtime assets.
