# Iterating whole-body procedural animation

Use for commissioned motion development or substantial visual repair. Follow the family route and the current
repository's animation-evaluation rubric. The loop is an evidence-driven development process, not permission to launch
paid generations, add actions, create a scheduler or replace the animation engine. Preserve earlier design approvals;
record rejected motion as rejected even when its mechanical checks pass.

## Start with a performance and a reproducible baseline

Record the exact skin/rig, gear/socket, profile/controller, runtime, source hashes and scenario in the existing
[motion packet](../assets/motion-packet.md). Include root path/speed, action-event times, seed, ground, camera, quality,
fixed step and actual phase coverage. Confirm that capture loaded this identity: a legacy Knight test does not validate
a new Knight skin. If the existing gym/CLI cannot select it or capture defend, extend that narrow seam before claiming
coverage. Reuse the workshop/game stage and capture tools; do not build a second runtime.

Choose a small reference packet by question: whole-body weight/support, armed carriage, or one action's intent/timing.
Prefer a clear full-body performance with visible feet and equipment, original speed, long enough lead-in/recovery and
known camera direction. Use user references first, then first-party animator/performer demonstrations or appropriately
licensed mocap. Match equipment role: centre-grip buckler work is not direct evidence for a forearm shield. Preserve
source owner/link, exact excerpt, observed versus unviewed status, timing, rights for any retained data and missing
views. Do not infer hidden joints or precise 3D trajectories from one projection. Study style and mechanics without
copying choreography or shipping borrowed clips. If a clip is inaccessible, say so and continue with supported sources.

Write a short action brief before tuning. Specify support changes, pelvis path, chest/shoulder response, gaze, wrist and
weapon paths, shield carriage, anticipation/contact/recovery and the main gameplay silhouette. Keep event timing and
root ownership authoritative. Any proposed tempo/exaggeration is an artistic candidate, not a new damage/travel rule. A
useful quality target is observable: e.g. a planted compression and chest brace makes defend distinct from idle.

## Construct from support to equipment

Block the few semantic poses that explain the action before adding continuous detail. Use the actual source anatomy and
equipped silhouette. Establish feet/support and pelvis, then chest/head and shoulders, then elbows/wrists and gear. Make
their timing related rather than animating each channel independently. Small authored pose targets and phase curves
inside a versioned procedural profile are compatible with clip-free exports; Blender poses remain offline aids.

Idle needs restrained breathing and supported weight adjustment with responsive hips/knees/ankles, not a uniform sine on
every bone. Defend needs a readable set, brace and return with lower-body support and torso response; do not invent a
hit/recoil event absent from the game. Walk requires support-linked pelvis rise/drop/shift and chest counter-response
with controlled asymmetrical sword/shield carriage. Run needs a distinct support rhythm, compression/recovery, lean and
secure gear. Attack needs an anticipatory base, pelvis/chest involvement, an intentional cutting path and supported
follow-through/recovery. Keep the shield protective without obscuring or intersecting the sword arm. These are prompts
for the commissioned performance, not prescribed historical choreography or universal joint amplitudes.

Then solve anatomical reach, feet and grip constraints. Diagnose unreachable targets, double-applied transforms and
rest-axis errors before tuning amplitudes. Avoid a late fixed guard override that erases the locomotion contribution.
Keep grip/forearm relations rigid; express weight through body/limb response rather than detaching items. Add secondary
overlap only after the primary support/action reads. Smoothing can preserve continuity but cannot create a convincing
pose or force transfer. Preserve position and velocity at state/cycle boundaries where the implementation supports it.

Distinguish cyclic idle/gait curves from one-shot attacks and defend enter/hold/exit. For a cycle inspect multiple
repetitions and match endpoint pose plus linear/angular velocity, not just the first/last image. Keep world-space plant
state continuous across the wrap. A repeated preview must not hide a root teleport. Small parameter sweeps can compare
one supported hypothesis after channel propagation is proved; hard checks filter failures and visual review decides
between survivors. Do not optimize an invented scalar naturalness score.

## The three review loops

1. **Local defect loop:** reproduce one defect, record first bad frame/view and expected observation, name the owning
   layer, change one causal hypothesis or a tightly coupled group, then replay the identical slice. Keep a compact
   before/after and an explicit keep/revert decision. A target-frame improvement must survive neighbouring frames.
2. **Performance loop:** replay the complete action at original speed, then slow playback for diagnosis; inspect clean
   gameplay view plus affected profiles/grips. Compare current and previous candidate under matched conditions. For
   external references preserve an unwarped original-speed view alongside optional semantic phase alignment. Judge
   intent, weight, rhythm, arcs, equipment coupling and recovery separately from hard gates. Reject a technically valid
   candidate when its whole-body performance is still weak.
3. **Integration loop:** at coherent milestones, run all commissioned actions, starts/stops/interruptions that the game
   actually supports, multiple seeds, update rates, representation changes, required counts and representative density
   on actual terrain/renderer. Shared solver edits require relevant other-family regression; family-only tuning does not
   reauthor other families. Profile after artistic structure is credible and after meaningful cost changes.

For each loop retain the best reviewed candidate rather than assuming the newest is better. Rank unresolved defects by
visible impact and cause; fix the highest-impact systemic defect first. Do not pile unrelated offsets onto a failed
hypothesis, loosen thresholds, or call extra oscillation improvement. If a pass fails to improve its named criterion,
revert/retain it only with a documented reason and change the hypothesis, reference or measurement. Stop repeated
unchanged attempts and return for specific user motion feedback when competing styles or missing intent decide the next
step. There is no universal iteration count and no promise that more loops automatically improve quality.

## Evidence that can support a decision

At a milestone use the existing five-view phase atlas, right/left equipment macros and a complete fixed-step temporal
sequence. Include a clean normal-speed movie or verified continuous playback, not only contact sheets. Distinguish
simulation timestamps from wall-clock render time: slow software rendering must not silently slow the presented action.
For a saved movie verify frame count, duration, ordering and representative decoded frames. Capturing/encoding it is not
proof it was watched; label unreviewed temporal evidence honestly. If continuous review is unavailable, keep timing and
fluidity status pending instead of inferring it from stills.

Inspect the exported skin and equipment, not just ideal solver targets. Useful hard checks include finite transforms,
actual support drift/sole contact, knee/elbow planes, reach before clamping, grip enclosure/orientation, shield
clearance, pose/velocity continuity, phase/event agreement and formation envelopes. Report surface sampling limitations
and proxy measurements. A chest/hip motion trace helps diagnose a frozen body, but minimum displacement is not an
artistic target. Massless rigs can use a support/centre-of-mass proxy for diagnosis; do not label it physically measured
balance.

Use the repository rubric with time/view evidence and written reasons. Automated checks and a second agent can find
faults; neither turns aesthetic scores into objective truth or substitutes for requested user feedback. Never round up
scores to satisfy a gate. Record mechanical, visual, user-accepted, device and production statuses independently. A
publication or all-green test suite does not advance the others.

## Efficient, durable execution

Let one implementer own a controller/profile, one independent reviewer own findings, and the coordinator own integration
and acceptance when delegation adds value. Serialize Blender/GPU/capture work on constrained hosts. Reuse unchanged
valid evidence; capture focused slices during tuning and the complete packet at milestones. Keep one best candidate,
current experiment, concise defect/decision log, selected media and exact replay manifest; retire bulky scratch only
after dependencies are safe. Save the next precise operation and live resource owner on interruption.

The next batch should have a bounded performance outcome, a known reproduction and real feedback boundary. A request to
design an iterative workflow does not itself commission an unattended recurring job. Publish compact comparisons only
within the user's existing destination/authorization; production promotion remains separate.

## Primary sources informing this method

These support the underlying techniques, not a claim that this particular Knight performance is validated:

- [John Lasseter, animation principles (1987)](https://www.cs.cmu.edu/afs/cs/academic/class/15462-f13/www/lec_slides/Lesseter.pdf):
  timing, anticipation, follow-through and pose staging.
- [David Rosen, An Indie Approach to Procedural Animation (GDC 2014)](https://media.gdcvault.com/GDC2014/Presentations/Rosen_David_Animation_Bootcamp_An.pdf):
  sparse authored poses combined with procedural motion.
- [Wayne Gilbert, believable weight](https://www.animationmentor.com/blog/how-to-create-believable-weight-in-animation/):
  support, compression and recovery as visible weight cues.
- [Daniel Holden, foot locking](https://theorangeduck.com/page/inverse-kinematics-foot-locking): contact-aware IK and
  smooth lock transitions; not a complete performance generator.
- [Daniel Holden, springs](https://theorangeduck.com/page/spring-roll-call): tunable, frame-time-aware smoothing and
  velocity-aware response.

Recheck source access and dataset/media terms when actually acquiring references. Keep task-specific research, timings
and source decisions in the family packet rather than turning this guide into an unmaintained link catalogue.
