# Procedural motion and reference review

Use this reference for animation/controller work, not as a requirement to produce a full action library during every
model task. Continue through the existing `ProceduralUnitRuntime`, family actors/adapters, gym and capture CLI in the
active repository. Knight, Crossbowman and Paladin own separate behavior/profile revisions; share pure solver/contact
utilities and a reviewed style record. No standalone replacement animation engine or baked gameplay clips.

## Action and skin readiness

Track idle, walk, run, attack and defend for each family, with optional aim/reload, turn/start/stop, hit/death or
special mount actions when scoped. Per action use unimplemented, candidate, mechanically verified, visually reviewed,
device qualified or promoted, with evidence links. This roadmap does not declare that current code supports every state.
A skin can be ready for animation development while actions remain pending. Do not silently display idle for a missing
action and report success. Armor belongs to the skin; item motion classes and grip dimensions constrain supported
actions.

Keep world root motion/heading outside controllers. Separate lower-body locomotion and upper-body actions where useful;
record transitions, interruption, reset and representation/update-LOD behavior. Paladin composes mount support phase and
rider response with distinct contact constraints. Shared style means weight, contacts, clarity and restrained secondary
motion, not identical stride trajectories. Cosmetic strike/release events follow actual game intent/timing and do not
compute damage or fire a second gameplay event for every formation member.

## Skin and mount motion variants

Skin-specific animation adjustment is expected, particularly for Paladin mounts, tack and rider contacts. Keep the
family controller core reusable, with versioned skin/mount motion profiles or bounded behavior variants where needed.
Changes may include stance, reach, stride, action arcs and rider response; they are not limited to static socket
offsets. Different locomotion anatomy may require a dedicated mount controller/adapter within the Paladin composition.
Rider human scale stays fixed while mount dimensions vary. Do not overwrite accepted profiles for other skins.

Use existing family performances and captures as initial references, retaining their exact controller/profile revision
and review status. A provisional animation is a starting point, not an approved gold standard. Compare the new variant
with its source performance and any selected external reference, and recheck affected contacts, transitions and cost.
Keep the validated profile and reusable reference packet in the family motion library; no baked gameplay clip library is
implied. A new skin need not move identically to the default or rebuild every action from scratch.

## Whole-body performance and iteration

For substantial motion creation or visual repair, read [the iteration guide](animation-iteration.md): block support,
pelvis/chest and equipment together, compare complete timed performances, and keep/revert against a named defect. Use
[equipment fit](equipment-fit.md) for sword grip and forearm-shield checks. User-rejected motion remains rejected even
if numerical gates pass; a still atlas cannot establish timing or fluidity.

## One reproducible reference loop

Use the [motion packet template](../assets/motion-packet.md) beside the existing asset brief. Request a clip/link or
frame sequence for a specific family/action when reference selection is genuinely missing; a reference task may research
alternatives. Record provenance/permission, exact excerpt/hash, original timing/frame rate, views, contact/event
landmarks and limitations. A rights-cleared skeletal clip can be an offline analysis aid. Preserve original timing
alongside phase alignment; compare semantic contacts/trajectories, not raw quaternions from unrelated rigs.

Reuse existing animation evaluation, gym scenarios, readiness checks and capture CLI. Pin family, skin/rig, controller,
profile, items, source/config and scenario identity. Wait for the selected actor/asset/equipment and actual ready state.
Extend the existing review to reference/current/previous side-by-side playback, scrubbing and optional contact overlays
when commissioned. Do not describe this comparison addition as implemented until it exists. Missing video views stay
unknown; generated candidate angles do not reconstruct reference truth.

For a defect, save first bad time/frame, view, actual/expected behavior and owner layer: source/weights, rest adapter,
calibration/reach, controller timing, placement frame or material/lighting. Fix one diagnosed cause and replay the same
scenario. Use intermediate frames and a full unwarped sequence to detect snaps/tempo errors. At coherent milestones
review the repository's five-view phase atlas plus continuous motion and gameplay camera. Run affected state transitions
and another affected family only when shared code changed. Avoid exhaustive recapture during tiny local tuning.

Automate finite state, actual cycle coverage, reach before clamping, stretch, bend/limit excursions, sole orientation/
clearance, stance drift and socket/seat error where measurements exist. Label endpoint-only proxies and missing metrics;
never treat them as whole-foot evidence. Numerical success cannot approve weight, intent or fluidity. Record human
visual findings separately using the active `docs/architecture/animation-evaluation.md` rubric.

## Performance and delivery

Profile actual family density and action bursts through existing scheduler/LOD seams. Geometry, renderer quality and
animation solve/update LOD are distinct. Lower solve frequency or shared immutable phase samples must retain per-actor
world contact correction, event ordering and pose continuity; no shared mutable skeleton/plant state. Cache keys include
rig/proportion/profile/item-motion dependencies. Desktop or Node timings do not qualify a phone.

Pin accepted controller/profile versions with skin/item compatibility and references. Retain compact selected evidence
and one current/previous accepted motion comparison; retire bulky scratch captures per retention rules. Export runtime
models clip-free; Blender ROM and reference clips stay offline. Publication, animation approval and production selection
are separate statuses. A new controller does not automatically replace every skin or every family.
