# Animation evaluation

## Definition

A good-looking animation communicates **intent, weight, and character through clear motion** while keeping the rig,
equipment, and contacts physically believable from every gameplay-relevant view. Joint validity is only the admission
gate. An animation can contain no broken elbows and still feel weightless, robotic, unreadable, or stylistically wrong.

Evaluation therefore has two layers:

1. **Hard correctness gates** catch objective defects that always block promotion.
2. **A scored motion review** judges whether technically valid motion is appealing enough to ship.

Neither layer substitutes for the other. Images establish spatial correctness; continuous playback establishes timing,
arcs, overlap, and rhythm; the gameplay camera establishes whether the action reads at its real presentation scale.

## Hard correctness gates

Every sampled frame and view must pass these before aesthetic scoring begins:

- all simulated transforms and projected diagnostic points are finite;
- elbows, knees, and horse limb chains bend in their intended direction;
- hands, the head, arrows, weapons, shields, rider, saddle, and mount do not visibly penetrate one another;
- palms and grips face the correct direction for their role;
- planted feet or hooves do not slide beyond the configured contact tolerance;
- weapon, bow, string, nock, projectile, rider, and saddle sockets remain continuous;
- the runtime phase agrees with the deterministic capture phase;
- every required camera produces a nonblank, correctly framed image;
- no frame contains a discontinuous pose jump or implausible angular-velocity spike;
- ragdoll handoff begins from the currently rendered pose without teleporting or exploding constraints.

One hard-gate failure makes the animation **not promotable**, irrespective of its visual score.

## Scored review

Score each dimension from 1 to 5, then apply the weight. Scores must cite an atlas row, a frame range, a gameplay-camera
observation, or a measured diagnostic. Aesthetic scores without evidence are opinions, not evaluation.

| Dimension                         | Weight | 1 — failing                                | 3 — usable                               | 5 — high fidelity                                                       |
| --------------------------------- | -----: | ------------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------- |
| Anatomy and silhouette            |    20% | broken, inverted, tangled, or unreadable   | valid pose with occasional tangency      | clean line of action and readable limbs from every diagnostic view      |
| Contact, balance, and weight      |    20% | floating, sliding, or no force transfer    | contacts hold but mass feels generic     | centre of mass, compression, recoil, and recovery sell the unit's mass  |
| Timing, spacing, and motion arcs  |    20% | linear, snapping, evenly timed, or robotic | functional anticipation/action/recovery  | deliberate acceleration, curved paths, overshoot, and clean settles     |
| Intent and gameplay readability   |    15% | action or target is ambiguous              | action reads from the primary camera     | intent reads immediately at game scale and remains clear in silhouette  |
| Equipment and multi-body coupling |    10% | prop, rider, or mount moves independently  | sockets align and contacts are plausible | equipment leads/lags naturally and force travels across coupled bodies  |
| Secondary motion and personality  |    10% | frozen or noisy                            | restrained breathing and follow-through  | controlled asymmetry, overlap, variation, and character-specific rhythm |
| Technical stability               |     5% | frame-rate dependent or non-deterministic  | deterministic at the fixed timestep      | stable across backends, frame rates, seeds, LODs, and repeated capture  |

### Score interpretation

- **Below 3.0 / 5:** prototype motion; return to pose construction or state timing.
- **3.0–3.79 / 5:** mechanically usable but visibly game-development quality.
- **3.8–4.24 / 5:** promotable for normal gameplay after every hard gate passes.
- **4.25–5 / 5:** high-fidelity target suitable for hero shots and close inspection.

Promotion additionally requires every individual dimension to score at least 3. A strong silhouette cannot compensate
for foot sliding, and polish cannot compensate for an unreadable attack.

## What to inspect

### Anatomy and silhouette

- Follow shoulder → elbow → wrist and hip → knee → ankle chains without relying on costume outlines.
- Check the sign of the bend from both profiles; a correct angle can still bend through the wrong anatomical plane.
- Look for tangencies where a forearm, weapon, shield, bow, quiver, or horse limb disappears into another silhouette.
- Compare front and rear views for unintended mirroring or a swapped left/right role.

### Contact, balance, and weight

- During stance, the contact point should remain stable while the body travels over it.
- The pelvis and chest should respond to the active support polygon rather than bob independently.
- An attack should begin from a supported base, transfer through hips and torso, reach the hand or weapon, then recover.
- Mounted attacks should perturb the rider and mount at different amplitudes and with a small, controlled phase lag.

### Timing, spacing, and arcs

- Inspect real-time playback first, then quarter speed; slow motion must explain a defect, not replace the real-time
  test.
- Track wrists, head, pelvis, weapon tip, and hooves. Their paths should form intentional arcs without sharp corners.
- Anticipation should create contrast with the action; contact should be brief; recovery should remove residual energy.
- Avoid identical duration and easing on every joint. Organic motion is coordinated, not synchronized.

### Intent and gameplay readability

- The target, attack direction, and current action phase should be recognizable without UI text.
- The most important pose should survive the normal zoom, team colour, crowd density, and terrain background.
- Exaggeration is acceptable when it improves the strategy-game read and remains anatomically coherent.

### Equipment and coupled bodies

- Hands must own grips; props must not visually drag hands behind them.
- The bow string, nock, jaw anchor, arrow direction, weapon tip, and shield face should remain mutually coherent.
- Rider pelvis and saddle may overlap by design, but should not drift, pop, or make the rider appear glued to world
  space.
- Secondary equipment can lag the torso, but must settle and must not obscure the action silhouette.

### Secondary motion and personality

- Use low-amplitude breathing, head focus, hand settling, quiver/cape response, mane/tail overlap, and stance asymmetry.
- Variations should preserve contact and action timing. Random noise is not personality.
- Different unit roles should have different effort: an archer is controlled, a knight committed, and a horse rhythmic.

## Required capture protocol

Use two complementary captures for each configuration:

1. **Diagnostic phase atlas** — front, right profile, rear, left profile, and elevated three-quarter. Action sequences
   use one representative pose per named phase. Locomotion uses four quarter-cycle poses. Humanoids carrying equipment
   append one right-grip and one left-grip macro view; the five body views remain sufficient for an unequipped horse.
2. **Temporal capture** — every fixed-step frame from a single front three-quarter camera, reviewed at real time and
   quarter speed.

The five spatial views are the minimum for the current asymmetric rigs. Four cardinal views do not expose enough
vertical depth, while duplicating every temporal frame across all five cameras produces hundreds of low-value images.

Diagnostic images should include:

- frame number, elapsed time, expected/runtime phase, unit kind, and camera view;
- numbered head, pelvis/saddle, shoulders, elbows, wrists, knees, ankles, and hooves;
- left/right limb chains and elbow/knee or horse-chain angles;
- stance/swing state for each hoof;
- palm orientation, hand/head clearance, socket error, bow/arrow clearance, and weapon-tip data when applicable;
- hand-to-grip distance for the bow, draw hand, crossbow handles, melee weapon, and shield handle;
- visible issue callouts, using a different colour from informational measurements.

Clean capture remains available because labels are evidence overlays, not part of the art direction.

## Review sequence

1. Run the hard gates on the full temporal capture.
2. Inspect the atlas row-by-row, not image-by-image: compare the same phase across all five views.
3. Inspect the temporal sequence at real time and quarter speed.
4. Score each dimension with cited evidence.
5. Fix the lowest-scoring systemic cause, then repeat the exact same seeded capture.
6. Promote only when there are no hard failures, every dimension is at least 3, and the weighted score is at least 3.8.

## What automation can and cannot decide

Automation can measure joint angles, contact drift, pose continuity, clearances, phase agreement, finite state, and
determinism. It can identify the first suspicious frame and preserve reproducible evidence. It cannot decide whether a
pose has appealing line of action, whether anticipation feels courageous or timid, or whether exaggeration matches the
fantasy art direction. Those remain visual judgements, but the judgement must be made against stable, labelled evidence.

## Current evaluation

### Humanoid locomotion pass

Evaluation date: 2026-08-23. Configuration: tier 3 Knight, seed 1337, WebGPU, 60 Hz fixed step. Walk and run each use a
moving root at their natural distance-per-cycle speed. The temporal proof covers 61 walk frames and 39 run frames; each
spatial proof covers four quarter-cycle poses from front, right profile, rear, left profile, and elevated three-quarter,
plus both equipment-grip views.

The reviewed runtime lifecycle is:

1. the scene writes the actor's root transform;
2. the plant controller measures root travel before pose construction;
3. desired cadence and measured distance advance one deterministic gait phase;
4. left/right contact cycles produce stance and asymmetric swing targets;
5. support state drives pelvis translation and pelvis/chest counter-rotation;
6. two-bone IK solves the legs and arms, while the pose filter affects only non-contact rotations;
7. the active Quaternius skeleton and cosmetic sockets receive the pose;
8. diagnostics sample that rendered state, and Jolt can take over the same pose on a ragdoll edge.

The pass separated parameters that had previously shared one waveform. Walking now rises over mid-stance with restrained
clearance and an anticipatory support shift. Running compresses during stance, extends into flight, uses a longer
stride, recovers the swing leg before mid-swing, leans farther into travel, narrows lateral sway, and carries the arms
with more elbow flex. Breathing moved from the pelvis to a low-amplitude chest layer. A full stride is now explicitly
distinct from stance-foot travel, and the plant controller releases its world anchor during early swing instead of
sliding it at the end of stance.

| Moving-root metric                 | Original walk | Final walk | Original run | Final run |
| ---------------------------------- | ------------: | ---------: | -----------: | --------: |
| Natural root speed                 |       0.48000 |    0.72720 |      0.92000 |   2.42021 |
| Pelvis lateral excursion           |       0.11000 |    0.07694 |      0.11002 |   0.04614 |
| Pelvis vertical excursion          |       0.06565 |    0.04455 |      0.06828 |   0.07534 |
| Maximum swing clearance            |       0.24619 |    0.15860 |      0.28930 |   0.27450 |
| Swing apex                         |        42–43% |     41–42% |       49–50% |    38–39% |
| Maximum stance-contact drift       |            -- |    0.00243 |           -- |   0.00000 |
| Maximum consecutive joint movement |       0.11568 |    0.06876 |      0.32284 |   0.15488 |
| Double-support / flight fraction   |      24% / 0% |   23% / 0% |     0% / 21% |  0% / 15% |

Original contact drift is omitted because the old report sampled the visible ankle bone while the corrected report
samples the actual IK contact target; original and final clearance values use those same respective seams and therefore
show the change in visible gait scale rather than a strict contact-target delta. In the first like-for-like moving-root
capture, before toe-off repair, maximum contact drift was 0.11750 for walk and 0.15472 for run; the final values are
0.00243 and 0.00000. Final left/right duty fractions remain within 2.6 percentage points, clearance asymmetry is at or
below 0.001, captured cycle coverage is 0.98–1.00, all 100 temporal frames and all 56 atlas images are nonblank, and no
semantic pose issue fired.

| Sequence | Anatomy | Weight | Timing | Intent | Coupling | Secondary | Stability | Weighted | Decision             |
| -------- | ------: | -----: | -----: | -----: | -------: | --------: | --------: | -------: | -------------------- |
| Walk     |     4.1 |    4.3 |    4.1 |    4.0 |      4.1 |       3.7 |       4.5 |     4.11 | promote for gameplay |
| Run      |     4.1 |    4.2 |    4.2 |    4.2 |      4.0 |       3.8 |       4.4 |     4.13 | promote for gameplay |

These are internal visual-review scores against the rubric above, not biomechanical ground truth. The five-angle atlas
shows clean forward knee bend, readable flight and support poses, stable equipment grips, no limb crossover, and a
clearer difference between walking and running effort. The remaining hero-quality gap is articulated foot roll/toe-off,
cloth or cape overlap, and weapon-specific sprint carriage; those do not block the normal strategy camera.

The unchanged 100-foot-unit benchmark also passes after this gait pass: 88.65 observed FPS, 12.4 ms total CPU p95, 3.1
ms animation CPU p95, 404 draw calls, and 1,794,426 triangles at the fixed 1440×900 reference viewport. Separate
61-frame moving-root walk captures for the Archer and Crossbowman also pass with no pose, grip, contact, or browser
errors; visual quarter-cycle review confirms that the free bow carry and constrained two-hand crossbow carry retain
distinct upper-body silhouettes over the same grounded leg controller.

The locomotion hard gate is now executable rather than prose. A full temporal gait fails promotion if it lacks moving
root evidence, does not cover approximately one cycle, travels too little, exceeds 0.01 stance drift, has left/right
contact or clearance asymmetry outside tolerance, peaks swing outside 30–55%, or lacks the expected walk double-support
or run flight pattern.

### Combat and mounted baseline

Evaluation date: 2026-08-22. Configuration: tier 3, seed 1337, WebGL2 fallback, fixed-step capture. Archer, knight, and
paladin use their complete action sequence. Horse and crossbowman use one walk cycle; the crossbowman evaluation covers
locomotion and carry only because a firing sequence does not yet exist.

Every final atlas and temporal capture passed the automated blank-image, finite-state, phase, joint, socket, bend,
clearance, and intersection gates. That does **not** make every sequence promotable: the weighted scores include the
visual review that automation cannot supply.

| Unit / sequence       | Anatomy | Weight | Timing | Intent | Coupling | Secondary | Stability | Weighted | Decision                                      |
| --------------------- | ------: | -----: | -----: | -----: | -------: | --------: | --------: | -------: | --------------------------------------------- |
| Archer shot           |     4.1 |    3.4 |    3.8 |    4.2 |      4.0 |       3.2 |       4.5 |     3.84 | promote at game scale; not hero quality       |
| Knight sword attack   |     4.0 |    3.8 |    3.3 |    4.0 |      4.1 |       3.0 |       4.4 |     3.75 | hold for strike spacing and secondary motion  |
| Mounted paladin smash |     3.8 |    3.2 |    3.2 |    3.8 |      3.8 |       3.3 |       4.3 |     3.54 | hold for rider/mount force transfer           |
| Horse walk            |     3.6 |    3.2 |    3.3 |    3.7 |      3.2 |       3.4 |       4.3 |     3.45 | hold for moving-root contact proof and polish |
| Crossbow walk/carry   |     4.0 |    3.4 |    3.4 |    3.2 |      3.8 |       3.1 |       4.3 |     3.55 | hold; firing animation is absent              |

### Objective evidence

| Sequence       | Frames | Max socket divergence | Max joint step | Stance drift | Relevant minimum clearance |
| -------------- | -----: | --------------------: | -------------: | -----------: | -------------------------: |
| Archer shot    |    147 |                0.1343 |        0.10674 |      0.00001 |          arrow/head 0.0607 |
| Knight attack  |     73 |                0.1405 |        0.29151 |      0.00000 |         weapon/head 0.1750 |
| Paladin attack |     73 |                0.1025 |        0.32660 |      0.04669 |         weapon/head 0.0165 |
| Horse walk     |     47 |                   n/a |        0.11126 |      0.04669 |      bend alignment 1.0000 |
| Crossbow walk  |     61 |                0.0000 |        0.09011 |      0.02296 |                        n/a |

### Weapon-hold evaluation

Evaluation date: 2026-08-22. This focused pass adds anatomically derived palm sockets, a draw-finger socket, distinct
bow/draw/power/shield/support finger poses, explicit shield handles, a two-hand crossbow transform, weapon-to-shield
clearance, and two macro grip cameras. The macro views are clean art evidence; diagnostic variants label the wrist,
solver target, equipment grip, equipment centre/tip, hand-to-grip delta, and relevant clearance.

The complete final temporal set contains 500 fixed-step frames: four default loadouts plus the two registered winter
cosmetic loadouts. Every frame passed the finite, phase, joint, hand/head, grip-detachment, weapon/head, and
weapon/offhand gates with no browser errors.

| Loadout                                     | Frames | Maximum hand/grip delta | Minimum weapon/shield clearance |
| ------------------------------------------- | -----: | ----------------------: | ------------------------------: |
| Knight · longsword + round shield           |     73 |                  0.0000 |                          0.0519 |
| Mounted paladin · warhammer + round shield  |     73 |                  0.0000 |                          0.3421 |
| Archer · longbow + draw-finger nock         |    147 |                  0.0000 |                             n/a |
| Crossbowman · paired support handles        |     61 |                  0.0000 |                             n/a |
| Knight · winter broadaxe + winter targe     |     73 |                  0.0000 |                          0.3095 |
| Mounted paladin · winter battleaxe + shield |     73 |                  0.0000 |                          0.3537 |

Visual review of the macro atlas confirms that fingers enclose the sword, hammer, axe, bow, crossbow, and shield handles
instead of remaining in the source model's open-hand bind pose. The shield face now sits in front of a visible rear
handle rather than through the wrist. The archer's nock follows the curled middle-finger chain instead of the palm. The
heavy-weapon windup was widened after the winter broadaxe exposed five head-intersection frames; the exact rerun is
clean.

The horse and crossbow stance-drift values come from an in-place treadmill preview: their roots do not translate while
the gait advances. They are recorded but are not interpreted as production foot sliding. A moving-root capture is still
required before locomotion can receive a score above 3.2 for contact and weight. Knight stance drift is meaningful
because the attack is stationary; it is zero after the weight-transfer repair.

High joint displacement during the knight and paladin strike is not automatically a discontinuity. Inspection of the
neighboring frames shows continuous target travel through the short strike interval, but the spacing contrast is still
too abrupt for a score above 3.3/3.2 in timing.

### Defects found and repaired during this review

1. **Viewport-dependent evidence framing:** narrow gym viewports cropped the horse muzzle. Inspection distance now
   compensates for camera aspect ratio.
2. **Synthetic/skinned limb disagreement:** the mathematical wrist and visible hand diverged by as much as 0.718 during
   knight contact. The runtime now calibrates limb proportions from the active Quaternius tier and performs final
   two-bone IK against the real skeleton. Final maximum divergence is 0.1405 for the knight and 0.1343 for the archer.
3. **Elbow plane flip:** the archer right elbow jumped 0.253 at frame 57. Bend-plane continuity reduced the maximum
   temporal joint step to 0.10674.
4. **Unplanted melee base:** adding weight transfer initially moved stance feet by roughly 0.021 per frame. Action
   pelvis motion now solves against the unshifted ankle anchors, producing zero measured stance drift.
5. **Floating crossbow:** the crossbow sat across the waist while both hands used locomotion poses. A procedural carry
   layer now keeps both hands on the weapon; final socket divergence is zero and maximum joint step is 0.09011.
6. **Open and misplaced grips:** props were attached to wrist origins while the source fingers remained open. Shared
   palm/draw sockets, role-specific finger curls, explicit handles, and grip macro views now prove contact across both
   procedural and registered cosmetic loadouts.

### Remaining priorities

1. Build a complete crossbow acquire, raise, aim, release, recoil, and reload sequence.
2. Extend moving-root contact proof to horse gaits and mounted units.
3. Smooth the acceleration profile around the knight and paladin strike peaks without reducing contact readability.
4. Give the mounted attack more visible horse response and delayed rider recovery.
5. Add finger collision volumes and cosmetic-authored grip metadata where future hero-grade props need sub-centimetre
   contact beyond the current shared palm model.
6. Add articulated foot roll/toe-off and weapon-specific sprint carriage for hero-distance humanoid shots.

Final reproducible evidence is under `output/animation-evaluation/`: each unit has a diagnostic atlas JSON, annotated
PNG contact sheet, and all-frame temporal JSON. Do not replace those reports with a subjective score table; keep both.
