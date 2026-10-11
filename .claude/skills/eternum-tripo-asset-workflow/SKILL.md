---
name: eternum-tripo-asset-workflow
description:
  Create Eternum assets from concept images through one Tripo generation per object, template-driven rigging, a scripted
  deformation gate, optimisation and hosted in-game approval. Use for new assets or approved-source revisions; animation
  development is excluded.
metadata:
  version: "4.5.3"
---

# Eternum concept-to-game assets

Follow the nine stages below. The endpoint is a user-approved game asset, rigged where needed and tested in the hosted
comparison instance. Animation creation, action libraries and controller tuning are outside this workflow. Static poses
validate rig preparation; runtime models ship without clips.

## Principles

1. **Tripo supplies the look. The family baseline supplies the structure.** A Tripo mesh is a sculpture: no joint loops,
   no record of which triangles are rigid. Do not ask it for structure and do not rebuild structure with one-off
   scripts.
2. **One generation per object.** A character is generated once, as the complete worn design. Only removable equipment
   and mounts are separate generations. Never assemble a character from separately generated body and armour layers:
   independent generations do not share scale, pose or depth.
3. **Label, don't guess.** Every rigid piece is identified from part-ID maps drawn in the same frame as the concept
   views, not from texture colour or position.
4. **Numbers before polish.** The baseline's deformation checks pose the mesh and report thickness kept at each joint,
   stretch, plate rigidity and poke-through. They run on the raw mesh before any repair work and again after every
   change. Renders confirm; they do not decide.
5. **Use the baseline tools.** Weights come from the proven template by transfer; plates bind by table. Do not write a
   new weight solver, fitter or registration method inside an asset task.
6. **Nothing built shows at rest.** Everything the bind adds or changes (labels, cuts, underlay, padding, linings,
   cuffs, recoloured crevices) must be invisible until something moves. The baseline's rest check compares the bound
   mesh, unposed, with the mesh as generated: at every joint, from six sides, what a viewer meets first, how far away
   and in what colour.
7. **A gate is ready when it has been looked at cold.** Passing numbers do not make a bind presentable. Before any
   visual gate goes to the user, an independent reviewer reads the full-size close-ups against the user's own words and
   finds nothing that looks broken. Until then, keep working: there is no limit on attempts. Stop only for what only the
   user can give: an approval, a spend, a design choice, images.
8. **Budgets.** Each stage has a time box and a credit box agreed at the brief.

## Brief and standing requirements

Read the project's instructions and inspect its loaders, rig adapters, equipment contracts, quality settings and
comparison site. Establish the asset family and tier, components, references, approved inputs, Tripo budget, target
devices and review destination. Ask only for consequential missing decisions. Carry existing approvals forward and start
a revision at its relevant stage.

Keep one compact asset record: current stage; prompts, view roles and source hashes; provider task IDs and actual
charges; approvals; scale, rig and socket contract; harness results per stage; export settings; limitations and next
action.

**Family baseline.** Humanoid work depends on the project's human baseline (shipped with this skill in `baseline/`;
start with `baseline/README.md`). It holds the template body with proven weights, the family skeleton contract, the
deformation harness and its thresholds, the pose library, and the import, label, split and bind tools. If it is missing
or its self-test fails, restore it before any character work. Improve the baseline in the baseline, never inside one
troop's folder.

- **Scale:** human stature is **H = 0.6 at hex radius 1**, shared by infantry and riders, measured standing without
  headgear. Mount dimensions vary independently. Record the source-to-runtime calibration and apply it once.
- **Counts:** foot soldiers display **1–6 figures per hex**; mounted troops **1–3 complete rider and mount units**. Test
  every count at constant figure scale. Mounted formations: one centred, two side by side, three in a triangle.
  Army-strength thresholds remain gameplay-owned.
- **Geometry:** at each quality preset, a complete foot soldier has allowance **T**, a complete mounted unit **2T**; a
  full hex allocates **6T**. Body, armour, underlay, equipment, mount and tack all count. Measure texture, draw, joint
  and frame-time costs separately at the largest count.
- **Skeleton:** all humanoids use the family skeleton: 25 core joints (root, pelvis, spine_01–03, neck_01, Head,
  clavicle/upperarm/lowerarm/hand, thigh/calf/foot/ball/ball_leaf, left and right) plus the helper joints listed in the
  baseline contract. Helper joints are driven by a fixed formula from core joints at runtime; the controller never keys
  them. Joint positions are per character; names, hierarchy and helper rules are shared. Changing the joint list is a
  baseline change that needs user approval and matching game-code work.
- **Modularity:** anatomy, clothing and armour belong to the skin and ship as one mesh, one material. Primary weapons
  and secondary items are removable and compatible within their troop family. Preserve authored item dimensions across
  skins; fit grips and sockets, never stretch items.
- **Hands:** there are no finger joints. Each hand is rigid on its hand joint and is generated in its final pose, so a
  hand can only ever do what it is drawn doing. Every hand that will hold something is drawn holding a plain guide of
  that thing's real thickness, in the hold's own position: a fist around a bar for a sword, shield arm or reins; a hand
  with its fingers curled round a bar lying across the palm for a crossbow. No holding hand is drawn empty: a "relaxed
  cup" comes out as a carrying hand, its channel a third of the stock's thickness and square to the forearm, and holds a
  stock only from above. The guide fixes the channel's size and its angle to the forearm and is removed in stage 7.
- **Crossbows:** every crossbow and every crossbowman's hands are built to one hold, so any crossbow fits any
  crossbowman skin (set 2026-10-09 on the T1 default Crossbowman; confirm at its equipment gate).
  - Weapon: a rear (trigger) station at the grip origin and a forward (support) station **0.178 H** ahead of it on a
    straight stock (107 mm at H = 0.6), with **0.07 H** of stock behind the rear station (42 mm). At each station the
    stock is 0.029 to 0.034 H wide and high (17.5 to 20.5 mm), with rounded edges, straight for 0.058 H either side, and
    nothing below it between the stations but the trigger lever.
  - Hands: both hold the stock from below and are drawn palm-forward in the A-pose, fingers curled round a guide bar
    that lies across the palm, thumb along its near side. Rear hand (right): palm directly under the stock, the stock
    45° across the fingers' line and 30° off the forearm's, the wrist straight and pivoted 16° toward the little finger.
    Forward hand (left): palm just toward the bottom-left edge, the stock 30° off the knuckle line and 64° off the
    forearm's, forward end toward the thumb, the wrist bent back 23° and pivoted 9° toward the thumb.
  - Guide in each hand: a round bar 0.037 H across (22 mm) and 0.117 H long (70 mm), lying across the palm.
  - These hands shoulder the crossbow with the trigger elbow raised to about 20° below shoulder level and carry it at
    port arms or nose-down across the body with the trigger elbow about 45° from hanging. A hand drawn with the stock
    along it carries at ease but cannot shoulder (butt 18 to 22 mm short); a hand with the fingers perpendicular
    shoulders with the elbow at shoulder height but cannot carry low. The pivot at the wrist (45° in all) is what limits
    one hand to one of the two.
  - Posing: arms and elbows first (templates per kind of hold), the weapon's place found for both arms together, the
    support arm solved first in carries; the bow's limbs kept off the support arm; the butt seated on the front of the
    shoulder (14 mm above the joint, 8 mm toward the neck). Check the elbow landmark against where the arm bends before
    posing (the T1 packet had it 22 mm low).
- **Appearance:** fixed authored palettes, no player recolouring. Paladin mounts use the established coat set with
  stable assignments A, A/B and A/B/C for counts 1/2/3.
- **Riders and mounts** have separate rigs joined at the seat.

## 1. Concept image

Generate the complete asset from the brief and references, including equipment and mounted seating where relevant.
Preserve proportions, silhouette, tier, construction, material roles and palette under neutral lighting. Shield concepts
omit rear arm loops and straps.

**Design for rigging.** A humanoid concept must satisfy all of these, or it goes back before any view work:

- A-pose with the upper arms **45–60° from the body**: 45° for plain sleeves, 50–55° for bulky shoulder armour. Not
  lower, and not a T-pose: a T-pose puts every working pose further from rest and generates shoulder plates in the
  raised position. Legs apart, slight bend at elbows and knees, palms toward the thighs, left and right alike.
- Clear air between surfaces that must move apart: arm and torso from the armpit down, thigh and thigh, hand and hip.
  Tripo welds whatever is drawn touching, exactly as far as it is drawn touching, and a weld cannot be repaired
  afterwards: the surfaces behind it were never generated. Background must show between upper arm and torso within the
  first 40% of the way from shoulder to elbow and be at least 1% of stature wide halfway down.
- No rigid piece spans a joint. Plates stop short of the elbow, knee, shoulder, wrist and ankle pivots. A plate may
  cover a joint only as a free overlapping edge fixed on one side, like a knee top on a greave.
- Cloth or soft leather is visible at every joint, **and between any two rigid pieces that meet across a joint**. Draw a
  band of the garment between them, about 1% of stature wide: a sleeve cuff between bracer and hand, trouser or boot
  between greave and thigh plate, neck or collar between helmet and cuirass. Two rigid pieces drawn edge to edge are
  generated edge to edge, with nothing underneath, and the joint opens onto a hole.
- A helmet ends above the collar. Flaps, neck guards and aventails hang clear of the shoulders, the collar and the
  cuirass, with neck or collar visible beneath them all the way round, or the head cannot turn or tip without the flap
  digging in or its rim staying behind.
- The neck shows below the jaw, front and back, at least 2% of stature of it. The head is rigid and the neck is not; a
  chin drawn resting on the collar leaves no neck to bend.
- Every plate and every over-garment has a drawn edge: a visible rim with a step down onto what it sits on. The bind
  finds where pieces divide from that step and from the change of colour. A plate painted flush with its neighbour in
  the same colour cannot be separated.
- Flat, even lighting with no cast or contact shadows. The generator copies the views' shading into the texture, and a
  shadow drawn under a rim becomes a dark ring when the rim moves away.
- Shoulder plates sit on the upper arm or the shoulder, clear of the neck, the collar, any neck guard and the chest
  plate. Each is one rigid shell that will follow the upper arm, so the further it reaches toward the neck the more it
  lifts and digs in when the arm moves. Draw leather padding, not bare tunic, around and under its rim; tunic shows only
  at the armpit.
- Nothing hangs loose (skirts, tabards, long straps, capes) unless the user has accepted that it will be stiff.
- Hands are in their final pose with their guide proxies. A hand that will hold anything is never drawn empty.

## 2. View packet

Produce **front, left, back and right** orthographic views from the same concept anchor, as four separate files
`front.png`, `left.png`, `back.png`, `right.png` in a `tripo-views/` folder. Left and right slots follow the direction
the figure faces in the image: the profile whose nose points to image-left is `left`. Check this by eye before every
paid run.

The packet also carries, in the same pixel frame as the views:

- **Part-ID maps:** one flat-colour image per view in which every rigid piece and every soft class has its own colour,
  with a legend. Borders follow the drawn edges to within two pixels; a piece's rim and the crevice under it belong to
  the piece on top. The neck below the jaw is its own soft class, separate from the head. Label by what a thing is, not
  by what it touches: the strip of collar that shows under a helmet's rim is collar. Front and back are required; sides
  improve the result for the head, torso and legs. Profiles are not used for the arms: in an A-pose the arms point at
  the camera and a drawn profile arm never matches the mesh. A guide bar is labelled, but its exact extent is taken from
  its geometry, not from the map.
- **Landmarks:** head top, chin, shoulders, elbows, wrists, hand ends, crotch, knees, heels and toes in the front view,
  plus the floor line.
- **Binding table:** for each class in the legend: rigid or soft; for rigid, the joint it follows (or candidate joints
  for the harness to choose between); for soft, its body region where that is not obvious. Classes follow what a piece
  is attached to, not its material: a leather band strapped round the upper arm belongs to the arm even when it is drawn
  with the torso leather.

Repair cross-view drift. A sheet may be used for review; never submit a sheet as one directional image.

Run the baseline's packet check on the front and back views. It measures arm angle, the arm, thigh and hand clearances
and left-right symmetry from the silhouettes. A packet that fails is corrected before approval and never submitted for
generation. Measure every drawn guide as well: its diameter, its length and its angle to the forearm against the item it
stands for, and the clearances with the guide counted as part of the hand.

## 3. Concept approval

Present the concept, the four views, the part-ID maps with legend and binding table, the packet check result and the
rigging checklist result. Obtain approval of that exact design before paid generation. Reopen this gate for material
design changes.

## 4. Tripo generation

One multiview generation per object from the approved views. Verify the route, parameters and expected charge before
each paid request. Record exact inputs, settings, task IDs, output hashes and actual charges read from the provider's
usage record. No automatic reroll chains. Keep raw meshes immutable.

Generate removable equipment as its own object. Generate a mount as its own object. Do not generate clothing, armour or
helmets separately from their wearer.

Optional Tripo services, each a separate small spend: the rig check is free and confirms the mesh reads as a biped or
quadruped. Tripo's auto-rig does not keep plates rigid and is not a weight source for armoured humanoids; it may seed
weights for a creature that has no family template. Tripo's segmentation splits by body region, not by plate; use it
only when a design has no part-ID maps.

## 5. Raw-mesh approval and riggability probe

Show the actual textured result beside its concept from front, back, sides, top and underside, with clay views. Disclose
fused parts, missing surfaces and drift, and list faults in the texture itself (a blotch where a hand's shadow fell on
the hip, black under a rim): they are the generation's, they are repaired at stage 7 or the bake, and at the bind gate
they must not be mistaken for rig faults, or the reverse.

Then run the probe, before any repair:

1. Import to the working frame, weld the vertices the file split at texture seams, and scale from the landmarks.
2. Project the part-ID maps to label every triangle; settle unseen faces and borders by growing labels along the surface
   with creases as barriers; show the label sheet.
3. Run the seam audit: every border between two pieces that will move differently, with its length. A seam between two
   rigid pieces on different joints has nothing under it. Decide each one now (the bind builds a cuff through a closed
   seam; anything else is a design fault to raise).
4. Bind with the baseline tools: template weights for soft classes, one joint per rigid class, plates split with
   underlay.
5. Run the harness on the range-of-motion set and report the numbers against the baseline thresholds, with a contact
   sheet of the worst poses and the joint sheets (stage 6) in label colours.
6. Measure every hand against the item it will hold, on the raw mesh, before any bind work: the clear channel against
   the item's thickness, the channel's angle to the forearm, which way the hand opens, and the deepest seat with no more
   than 2 mm of hand inside the item. It takes minutes. A hand that cannot hold its item is a fault of the views:
   correct them and regenerate. Do not bind a mesh whose hands have failed.

Obtain approval of the raw mesh **and** the probe result. If the probe fails on the design itself (a plate across a
joint, no cloth at a joint), return to stage 1 rather than repairing in Blender. One reroll may be proposed when the
fault is the generation, not the design. Welds are never the generation's fault: they follow the views, so a reroll
reproduces them. Correct the views.

## 6. Bind and pose gate

Refine labels and the binding until the gate battery passes on the full pose library (the general set plus the troop's
own set: knight, crossbowman, paladin; the mount set for mounts) **and** an independent reviewer passes the joint
close-ups.

**The build, in order** (baseline tools in `baseline/tools/`; each is described in `baseline/README.md`):

1. Import, weld, labels from the ID maps, pivots on limb centrelines.
2. Guide bore, if the user wants the hand judged with the rig.
3. Label refine: hand patches from the spec (the throat below the jaw becomes a soft class if the packet labelled it
   head), borders onto the texture's colour boundaries, every rigid piece's border onto the crevice where it really
   meets its neighbours, the underside of a cuff's lip given to the cuff, rim crevices cleaned, surface hidden at rest
   recoloured from its visible surroundings.
4. Border cut: slits and notches closed, a smooth cut along every rigid border, stray islands removed.
5. Bind: closed rims dressed, split, underlay (a strip on the template body under an open rim, a tube under a rim that
   runs right round a limb), shoulder plates in two layers, cuffs through closed seams, skirts closing the underside of
   tube and cuff rims, weights, clearance under every plate fitted over the pose sets, everything generated moved under
   the surface as generated.

Steps 3 to 5 and everything below run from one command, `hb_gate.py --build`. The character's `char.json` carries every
decision (`baseline/SPEC.md` lists the keys); no decision lives in a script.

**The battery** (`hb_gate.py`): harness numbers on the range-of-motion and library sets; contact with plates (what lies
under a plate with a clear line to it, and how far it comes through), with depth through the steel held to its limit;
the hole check (how much of what is seen at each joint, in each pose, a one-sided renderer would show as background
through the figure); the rest check; the seam audit; and the review renders: every joint framed on the joint, at rest,
at its limits and in the troop's own stances, from three or four sides, textured and in label colours; the pose sets;
before/after sheets against the last presented bind.

Review renders draw front faces only and use the bind's authored normals, rotated with each joint, as the game does. The
exported model must carry those normals and a one-sided material (the glTF default): a two-sided material hides holes at
the cost of drawing every lining and skirt from behind, and normals recomputed after the cut draw a dark line along
every cut.

**Before presenting.** All of these, or keep working:

1. The battery's numbers pass, or each miss is explained and proposed as the user's decision.
2. You have opened the joint sheets at full size, textured and in label colours, for every joint: shoulders, elbows,
   wrists, neck, waist, hips, knees, ankles. A complaint about one joint is a reason to check them all.
3. An independent visual reviewer has read the same files cold: given the user's words, the before and after files, what
   is intended (so plate motion is told apart from build defects), and asked for defects by file, place and severity. It
   finds no blocker and nothing that looks broken at a joint. What it finds, fix, and review again. Do not present your
   own reading of the images as the result.
4. An independent verifier has recomputed the figures in the gate document from the files.

**Presenting.** Lead with the result in two sentences and the images to open first. Then: what was wrong and what
changed, joint by joint; numbers with before and now; what is still wrong, in the reviewer's words; every edit to the
mesh so far; decisions requested. Say what got worse.

- **Soft classes** take weights from the template by transfer and inpainting. Fix a bad area by correcting labels,
  landmarks or the class's region, not by painting.
- **Rigid classes** are bound whole to one joint. Where the table lists candidates, bind once per candidate and keep the
  joint with the least stretch and poke-through; record the numbers.
- **Smooth borders.** A generated mesh has no edges along a plate's rim, so a border made of whole triangles is a saw
  and every tooth becomes a torn shard once the plate moves. Before binding, cut the mesh along a smoothed border for
  every rigid piece (the baseline's border cut: new vertices on existing edges, no vertex moved). The same step relabels
  stray islands: a small patch of a rigid class away from its piece stays stiff inside moving cloth, and a small patch
  of cloth enclosed by a plate stays behind as a hole.
- **Labels follow the surface, not the map.** Part-ID maps are drawn over the views and land a few millimetres off the
  surface: a corner of a steel plate ends up labelled sleeve, the underside of a helmet's rim labelled collar, a cuff's
  inner lip labelled hand. Each such strip stays behind, or goes along, when its piece moves. The label refine moves
  borders onto the texture's colour boundary and onto the floor of the crevice where two pieces meet; correct by hand,
  in the spec, any class that sits on the wrong piece. Always check the result in label colours beside the textured
  render.
- **Rim crevices and hidden surface.** The strip a rim covers is a fringe of mixed labels with baked shadow, and it
  shows when the rim lifts. The label refine gives the fringe one material and gives surface hidden at rest under or
  beside a piece the colour of its nearest visible surroundings. Surface hidden only because a limb stands in front of
  it at rest (a skirt behind a fist) is not touched. Nothing visible at rest may change: the rest check proves it.
- **Split and underlay.** Each rigid piece is cut free along its border and the soft surface is continued beneath its
  edge, so plates slide over cloth without tearing it or opening holes. The underlay is laid on the template body, so
  what a lifted rim uncovers is a neck, a wrist or a shin in the colour of what belongs there, never a dark hole or a
  flat sheet.
- **Hidden at rest means faces, not vertices.** A generated face whose corners all lie under the surface can still span
  a crevice in front of its floor and show. The baseline tests points across every generated face and moves the face
  into the body until it is covered. It never moves along the face's own normal: near a thin rim that leads out through
  the rim's other side.
- **Clearance under plates.** Where a plate would cut through what was built under it in any pose of the sets, the built
  surface sinks (never the original surface). Without this the body bending under a rigid breastplate brings its
  underlay out through the rim.
- **Strips keep their rim's shape until relaxed.** The strip of body under an open rim starts as a copy of the rim's own
  faces. The baseline relaxes it after fitting clearance; without that, a rim lifting in the open (a breastplate's lower
  edge in a back-bend) uncovers a crumpled band with dark holes.
- **What a plate uncovers is a sheet.** Padding under a shoulder plate and the strip under a rim are seen whole when the
  plate turns away. Move them only as sheets: every move spread into its surroundings. Pressed into place vertex by
  vertex they copy every strap edge above them and come out crumpled.
- **Plates with a free edge get an inside.** A greave's knee top, a shoulder plate: anything that lifts off the body
  shows its inner side. Give it a lining, or a one-sided renderer shows a hole there. The hole check names the joint and
  pose.
- **Seams between rigid pieces.** Where two rigid pieces on different joints meet (a bracer and a hand) there is no
  surface under the seam at all. The bind runs a cuff through a closed seam: it starts on the body part's own edge, runs
  into the outer piece, takes the texture of the garment the outer piece is worn over, and stretches between the two.
  The underside of the outer piece's lip belongs to the outer piece: labelled as the body part, it leaves with the hand
  as a ring of shards. Fill gaps with plain generated shapes, never with copies of the detailed pieces (they crumple),
  and never with anything that lies outside the original surface at rest (it shows).
- **Under a helmet.** A helmet's rim runs right round the neck, so what lies under it is a tube: rings from the rim into
  the helmet, narrowing, skin-coloured from the rim, following the head from the second ring. A skirt from the rim to
  the tube closes the helmet's underside. The collar and the cuirass do not follow the head. Do not copy the rim's own
  faces down onto the template body for this: they keep the rim's rolls and flaps as steps and stand proud wherever the
  template is wider than the character.
- **The throat.** Everything below the jaw is soft. A head class that runs down the front of the neck to the collar
  swings out under the chin as a flap when the head tips back.
- **Closed rims and crevices.** A rim that runs right round a limb (helmet, cuff) wanders up and down the walls of the
  crevice it sits in, and cloth as generated runs up a rim's wall to meet it. Before the split, the baseline moves the
  rim's hidden vertices onto the rim's own outline smoothed round the limb's axis, and relaxes the hidden cloth beside
  every rim. These are the only moves of original surface in the bind: a few millimetres, only where no camera can see
  at rest, counted in the gate document and proved harmless by the rest check. Check each rim in label colours with the
  joint bent: blades of one colour standing in the other are this.
- **Stiff over-garments.** A leather cuirass or vest does not follow the arms. Mark it so in the spec: its edge stays
  with the trunk and the sleeve beside it takes the stretch as cloth. Do not cut it free of the sleeve.
- **Bridge faces.** Where two surfaces touched in the rest pose the generator welds them. A face whose corners have
  disjoint weights is such a weld; the bind removes it. Many of them in one place is a concept fault (no clear air).
- **Joints.** Landmarks give the first estimate; the pivot then goes on the limb's own centreline, fitted through the
  mesh's cross-sections. A shoulder pivot above the arm's centreline makes every raised arm swing out of its socket.
  Hinge pivots sit slightly toward the outside of the bend.
- **Shoulders.** The hardest joint; treat it on its own.
  - Shoulder plates bind to the baseline's shoulder-plate joint: it points where the upper arm points and takes part of
    its roll (40%). A plate on the upper arm itself takes the whole roll and turns its underside to the front in guard
    poses. A plate that takes none wrings the sleeve below it when the arms go overhead. A plate that follows only part
    of the arm's height or turn has the arm come through it. Everything under the plate follows the same joint.
  - Build each shoulder plate in two layers. The plate becomes a closed shell: a lining just inside it with the plate's
    own surface, joined at the rim, rigid with the plate, so the plate is steel on its underside too. Under it goes a
    leather shoulder: padding welded to the surrounding surface at the rim, laid a few millimetres above the template
    body, smooth, plain leather colour, and skinned as part of the body.
  - Padding follows the plate only as far as stretch allows. Where the body and the plate move alike (the arm side) it
    rides with the plate. Where they do not (the neck side, and the flanks that lie over the chest and back) it stays
    with the body. The baseline fits this from the pose sets with a stretch limit of 3×, then sinks the padding where
    the plate would cut through it in a pose. Never move original surface for this: a strap beside a plate rim looks
    hidden to a distance test and is in plain view. Do not weld padding to the plate all round its rim: with the arms
    overhead that band is pulled into sheets across the back of the shoulder.
  - Review a fixed shoulder set before anything else: arms down, arms level, arms forward, arms overhead, one arm across
    the chest, and the troop's guard pose; from the front, the back and three-quarter, close enough to see the plate
    rims.
  - Judge the shoulder at the plate rims in close-up, in the arms-down and the arms-overhead poses, in textured and in
    class-coloured renders. A whole-figure sheet hides torn strips.
  - Expect limits and state them: with the arm overhead or across the chest a one-piece shoulder plate turns with the
    arm, leaves the top or back of the shoulder to the padding, and its neck-side edge dips under whatever lies there (a
    harness strap).
- **Poses.** Stance first: legs, hips and body facing before the arms. Arms stay natural. Items are represented by their
  sockets at this stage; if the items already exist, fit them first (stage 7, step 1), because poses aimed at
  provisional sockets have to be aimed again. A pose must be possible: the baseline's pose check rejects poses whose
  left and right limbs pass through each other. When a pose looks wrong (shrugged shoulders, twisted legs, limbs
  crossing), check the pose solver and the pose itself before touching the bind.
- **Guides.** A guide bar stays on the mesh, rigid on its hand, until it is bored out. Never delete faces by label.

This is the main rigging approval; nothing downstream may change weights or labels without re-running the battery.

## 7. Polish and equipment

Only now do local repairs: guide removal and grip bore, seams, material correction, small surface defects. Preserve
defining shape, costume and appearance. Re-run the harness after any mesh change.

**Guide bore.** Remove the bar and nothing else. Fit a cylinder to the bar's surface for the axis and radius; delete the
faces that lie inside that cylinder; join the two openings left on the fist with a channel that uses the openings' own
vertices, at the bar's own radius. No vertex of the hand moves and no hand face is removed. Record the axis for the
equipment fit. The user may ask for this before the bind gate so the hand is judged with the rig.

**Equipment.** Removable items are separate objects. Each follows one joint through a socket: a fixed transform in that
joint's frame. The baseline fits and checks them. Describe each item in a gear spec, name the spec in the character
spec, and run the gate: it fits the sockets at rest, measures the fit, poses the troop's own sets with the items on, and
renders the items close at rest and on the figure in every pose.

Work in this order:

1. **Fit at rest, with the hands fixed.**
   - **Sword:** handle on the bored guide's axis, seated in the palm, blade out of the thumb and index side, edge toward
     the wrist, guard a set gap in front of the fist. Measure the deepest hand vertex inside the item and whether the
     handle stands proud of the hand anywhere round the fist.
   - **Shield:** plain rear, seated on the forearm's outward side and leaning with it, on the forearm joint. No wrist
     joint may move it.
   - **Crossbow and quiver:** the crossbow is a two-hand item on the crossbow hold standard. It follows the rear hand
     through its socket, seated on that hand's guide channel at the rear station, which is the grip origin; the forward
     hand has its own seat at the forward station. Give the weapon two directions in every pose, where the bolt points
     and which way is up, and a place. Pose the arms first from their templates for that kind of hold, the weapon's
     direction a looser wish in carries (4° in aims), its place found for both arms together and the support arm solved
     first in carries; then seat the forward hand onto the stock where the rear arm has put it: within 2 mm of the
     stock's line, free to slide a little along it. A hold in which the forward hand does not reach is restated, not
     forced. Both palms under the stock; quiver at its approved lower-back attachment.
   - **Mounted:** fit pelvis, thighs, seat, stirrups and reins-to-bit at H = 0.6. Keep the shield forearm and the rein
     hand distinct. Ground soles and hooves.
2. **Read the close-ups** of each item on its joint, from every side. Note the item's angle to the forearm: it says
   which poses this hand can do. A fist drawn round a bar is a hammer grip; its blade stays 40 to 90 degrees from the
   forearm and can never lie in line with the arm.
3. **Give every item in every pose a place and a direction, and solve the arm from that.** A pose set written before the
   fit was aimed at stand-in sockets; its arm angles are worthless and its directions are estimates. Do not keep the
   authored arm and correct it at the wrist: the numbers will pass and the poses will not do what their names say. State
   where the hand or the shield is, from a joint of the body, and where the item points; the baseline solves the whole
   arm and prefers the easiest one. The blade direction drives the forearm: never force an arm to a pre-placed item.
4. **Restate what the hand cannot do.** Where a description asks for something the grip or the reach cannot give (a
   blade in line with the arm, a shield laid over a helmet's crown on a short arm), the solver will not fail: it will
   find the one contorted arm that does it. Change the description to the nearest thing the body can do, and write why
   into the pose.
5. **Measure on the real meshes.** Two measures, both needed: body inside an item (catches grazing) and how much of the
   item's length is inside the body (catches a blade run through a torso, which the first hardly registers). Also one
   item inside another. Limits are in the baseline's thresholds.
6. **Check every pose's text against measured facts**: the hand's height against the body's landmarks, the shield's rim
   heights against eye and knee, the item's angle, the nearest the items come to each other. Where the item is not where
   the text says, place it again; where the body cannot do what the text says, restate the text. Do this before
   rendering: a reviewer judges each pose against its description, and every mismatch costs a round.
7. **Render the troop's set with the items on, from three sides (front-right, back-right, back-left), with the whole
   item in frame, and read every pose against its own description.** Two cameras on one diagonal both foreshorten an arm
   that points along it. This is the check that found the faults the numbers passed.
8. **Run the whole battery again**, because the troop's poses changed. Then the cold review, with the items on, and the
   verifier. Split a long review into parts of about forty frames.

The family's general pose set is a body test and is not authored for equipment; items are checked on the troop's own
sets. Record every socket in its joint's frame, and the item's own axes. Test removal and replacement and the compatible
skins.

A second grip for the same hand (the handle turned in the fist) costs show-through quickly: measure it before proposing
it. A different hold needs a hand generated for it.

## 8. Optimise, export and hosted test

Reduce to the measured budget with labels, plate borders and joint zones protected; bake to one material. Compare each
derivative with the approved appearance at matched framing. Run the harness on the reduced mesh; it must still pass.

A layered mesh drawn one-sided fails in ways a general reducer does not know about, and no single check sees them all.
Run every one on each level: what shows at rest against the bind, backs met first, the pose harness, and the see-inside
check in poses (a tube round a limb opens at the end the limb used to fill, and only a pose seen from above shows it).
Then render the levels beside the bind in the game's own view, in a walk, and have them reviewed cold: a wrong colour on
the right piece (a plate's edge painted from the hidden strip joined to it) passes every geometric check. Give the face
and hands more than their share of the budget. Count the file's vertices as well as its triangles. Reduce and bake items
with the same tools after welding their vertices by place. The baseline's README ("Reducing, baking and exporting") has
the rules and the reasons.

Export and round-trip through the real game loader: scale, axes, origin, grounding, maps, inverse binds, weights, helper
joints, sockets, the bind's authored normals, a one-sided material, clip-free output. Write the numbers the game needs
beside the files (helper rules and axes with worked cases, sockets, knuckle points, feet) from measurements, and fill
the game-side adapter from that file only. Implement registration, rig-adapter and helper-joint driving through the
existing framework; test the driver against the worked cases; run the repository's checks.

Build the asset into the hosted comparison instance with the game's renderer, terrain, camera and lighting. Review
static poses at close and gameplay views, at every count (1–6 foot, 1–3 mounted), with the largest loadout. Assert the
requested asset, count and preset actually loaded before taking evidence. Record triangles, draws, joints, textures,
transfer size and frame time with device and backend.

The comparison instance sets joint rotations directly, so it shows nothing of what the game's own controller does with
the rig. Before the game side is called done, put the model under that controller in the game's development gym and
capture it standing, walking, running and attacking, large enough to judge the arms and whatever they hold. A controller
that works at another figure's size, or gives a limb a direction and no roll, shows only there. Gear fixed to bones
needs the arm poses it was approved in: measure wrist, elbow and the hand's turn from the approved pose set, have the
game pose the arms in the elbow's hinge frame, and check clearances by computation through the motions in turn. Do not
write arm poses from a description. The baseline's README ("Under the game's controller") has the measurements, and
`baseline/examples/knight-arm-poses/` the two scripts.

## 9. Final approval and handoff

Present the comparison link, the exact revision, before and after evidence, harness results, equipment checks, formation
coverage, performance and remaining limitations. Ask for final approval. Tests and publication are not approval.

Retain one editable Blender source, runtime exports, the rig and socket contract, labels and binding table, harness
reports, export settings and lineage. Feed anything reusable (a better class rule, a new pose, a threshold) back into
the baseline with its evidence.

## Mounts and other creatures

A mount is its own object with its own rig, generated once. There is no family template for it until one is proven, so
its soft weights may be seeded from a quadruped auto-rig or a hand-made source, then held to the same rules: tack and
plates bound rigid by label, the harness run on the mount pose set, thresholds recorded. A second mount of the same
family reuses the first as its template.

## When something fails

- Harness fails at a joint: check the pivot, then the labels around it, then the class's region. Do not paint weights.
- Shoulders shrug, arms leave their sockets or legs twist in every pose: the fault is upstream of the weights. Check how
  far the pose solver moves the collarbone, whether the shoulder pivot is on the arm's centreline, and whether the
  solver reads a wide stance as a bent knee.
- Torn fragments at plate edges when a limb moves: the border is a saw. Run the border cut; check that profile maps are
  not labelling the arms.
- A shoulder plate looks like dark leather, or split open, in guard and wind-up poses: it is rolling with the arm and
  showing its underside, and the padding is coming through it. Check which joint it is bound to.
- Long thin strips from a shoulder plate's rim to the body with the arms raised: padding is welded to the plate where
  the plate leaves the body. Measure which faces stretch, by class; padding must follow the plate only within a stretch
  limit.
- A bite or gash in a plate's edge that opens when it moves, or white shards at an armhole: labels are off the texture
  boundary there. Refine the labels by colour; check the label-coloured render against the textured one.
- A gap or see-through at a wrist or neck when it bends: a seam between two rigid pieces with nothing under it, or an
  underlay that is a flat sheet. Run the seam audit.
- A flap under the chin when the head tips back: the throat is labelled head. Make everything below the jaw soft. A
  zigzag crack under the chin: the head's border runs level across the throat; put it on the jaw's edge (the underside
  of the jaw belongs to the neck).
- A flat blotch on a skirt or thigh that appears when an arm moves away: surface hidden at rest by the hand was
  recoloured. Recolour only under and beside pieces.
- A tab or ear of the wrong colour lifting off behind a rim when the joint bends: a strip of the piece below labelled as
  the piece above (collar labelled helmet). Find it in label colours with the joint bent, and patch it in the spec.
- Steps, pleats or blocks of flat colour where a helmet lifts off the neck: the underlay there is a copy of the rim's
  faces, or its rings follow a ragged rim. Use the tube, on a dressed rim.
- A ring of shards on a hand's edge when the wrist bends: the underside of the cuff's lip is labelled hand.
- The background shows through a helmet or cuff seen from below: nothing closes its underside. The skirt does. Through a
  knee top or another free edge: the plate has no lining. A row of see-through teeth behind a knee top with the knee
  bent: the strip of body under the plate is too short and its inner edge has come out; make it deeper than the knee's
  travel.
- A dark crease or a black line across a wrist cuff: a ring of the cuff overtook the next when the wrist closed, or the
  seam doubles back and a ring followed it. Ring depths must exceed the travel; rings go one way round the axis.
- Spiked or crumpled leather on top of the shoulders when the arms hang down: padding was pressed against the surface
  above it vertex by vertex. Sink it as a sheet.
- A torn edge of cloth round a knee or a wrist where it leaves a plate: the cloth as generated runs up the rim's wall.
  Iron the hidden surface beside the rim before the cut.
- Depth through the steel jumps although the renders have not changed: check which vertices the contact check counts as
  under the plate before changing the bind.
- A dark ring stays on the neck, or a rim stays behind, when a helmet or cuff moves away: the rim's underside is
  labelled as the piece below it. The border must sit on the crevice floor, not on the rim's outer edge; check in label
  colours. A black gash or flap under a lifted rim: near-black baked shadow on faces that are open only to the ground.
  Faces there that face down belong to the rim; the rest are recoloured.
- Flecks, flat patches or a different colour somewhere in the rest pose: a generated surface lies outside the original
  one, or a recolour reached visible surface. The rest check names the image and the place.
- Renders crash with an access violation in background mode: Windows is not giving Blender a graphics context (screen
  locked or asleep). The gate falls back to CPU rendering; render the before images with the same engine.
- A dot or patch of the wrong material on a plate, or a stiff shard in cloth: a stray label island. The border cut
  reports and relabels them.
- Every blade points the same angle off its direction in every pose, or a shield's face wanders with the forearm's roll:
  the pose set was aimed at provisional sockets. Fit the items first, then re-aim the set.
- A blade plainly through the body in a render although the clash count is a handful of vertices: the count is body
  inside the item, and a blade is too thin to hold many. Measure how much of the item is inside the body.
- An item nowhere near the body reported as deep inside it, or the reverse: "inside" was decided by the side of the
  nearest face. On a thin item count crossings; on a layered, open body take a vote of rays.
- A shield standing in the thigh in idle and walking poses of the general set: that set is not authored for equipment.
  Check the troop's own idle and walk.
- A pose that will not clear however the arm moves, or clears only with the wrist and forearm roll at their limits: the
  authored hand position or direction is wrong for this body. Re-author the pose; do not widen the limits.
- Every item points where its pose says and nothing is in the body, yet poses look wrong (a fist in front of the face in
  an at-ease pose, a guard with the blade lying back, a shield beside the knee): the authored arm was kept and wrung at
  the wrist to reach the direction. Author the item's place and direction and solve the whole arm.
- No arm can swing straight back, or hold a hilt at the hip with the elbow behind the body: the pose limits forbid
  shoulder extension. The plane of elevation may go straight back while the arm is low.
- Blades and shields cut off at the edge of pose renders: the camera framed the body only. Frame the items too.
- A reviewer reports an arm tucked in front of the body where the pose has it flung out, or cannot tell whether a blade
  touches a shield: both cameras lie on one diagonal. Add the view across it.
- A pose "does not read as described" although the item points where the pose file says: the description names a height
  or a cover (shoulder height, covering the head, rim on the ground) that the pose does not have. Measure the hand and
  rim heights against the body and either place the item again or restate the text.
- A blade's tip "lands on" a shield's rim in a render although the clash check is clean: a near miss of a few
  millimetres. Keep a gap between items when making room.
- Spikes or webs when a limb moves: two surfaces are welded, or a label has leaked onto the neighbouring limb. Ask the
  harness to explain the pose: it lists the most stretched edges with the classes and joints at each end.
- Plate tears or rubber-bands: the piece is not labelled rigid, or it spans a joint. The second is a concept fault.
- Mesh and labels disagree: the views or ID maps drifted. Fix the packet, not the mesh.
- A hand holds its item only from above, or the arm goes through the chest to get a palm under it: the hand was drawn
  empty and is a carrying hand. Measure its channel, the channel's angle to the forearm and which way it opens; redraw
  it round a guide and regenerate.
- A two-hand hold solves for one arm and leaves the other hand off the item: the pose's place or direction does not suit
  both seats. Move the item nearer the body or change its direction; do not bend the second wrist to its limits.
- An item is fitted and measured but missing from every render: its object is hidden from render in its own file.
- Result no longer resembles the concept: stop. List every edit since the raw mesh and remove the ones that were not
  needed to pass the harness.
