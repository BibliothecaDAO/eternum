# Human baseline contract

Shared by every humanoid troop (Knight, Crossbowman, Paladin rider, later tiers). Change it here, with evidence, never
inside one troop's folder.

## Names

A troop skin is named **tier, type, skin**: "T1 Knight Default" (owner's decision, 2026-10-08). Ids, folders and file
names are the same three words in kebab case (`t1-knight-default`), with a suffix for a level or an item
(`t1-knight-default-near`, `t1-knight-default-sword`); identifiers keep the same order. The name of a concept set or an
art direction ("Bastion") is never used in code, ids, file names, flags or labels.

## Frame and scale

- Working frame (Blender, all baseline tools): +Z up, −Y forward, +X the character's left, metres, soles at z = 0.
- Runtime frame (game): +Y up, +Z forward, +X left. The exporter converts once.
- Stature H = 0.6 at hex radius 1, measured from the anatomical floor to the top of the head without headgear. Scale
  comes from the packet's front-view landmarks, applied once.

## Skeleton

25 core joints, same names and hierarchy as the game's humanoid rig adapter:

`root, pelvis, spine_01, spine_02, spine_03, neck_01, Head, clavicle_l/r, upperarm_l/r, lowerarm_l/r, hand_l/r, thigh_l/r, calf_l/r, foot_l/r, ball_l/r, ball_leaf_l/r`

Plus 4 helper joints (29 in total):

| Helper           | Parent     | Position                            | Rotation rule                                    |
| ---------------- | ---------- | ----------------------------------- | ------------------------------------------------ |
| `elbow_half_l/r` | `upperarm` | at the elbow (the `lowerarm` joint) | half of `lowerarm`'s rotation from its rest pose |
| `knee_half_l/r`  | `thigh`    | at the knee (the `calf` joint)      | half of `calf`'s rotation from its rest pose     |

Why: linear blend skinning pulls a 50/50 vertex to `cos(angle/2)` of its distance from the pivot. Measured on the
reference body at full flexion, the outside of the bend keeps 0.73 (elbow) and 0.66 (knee) of its thickness with 25
joints, and 0.94 and 0.89 with the half-angle helpers. On the Knight test subject the elbow goes from 0.75 to 0.96 and
the knee from 0.76 to 0.94.

Runtime driving (per frame, after the controller has posed the core joints, before skinning):

```
D = child.localQuaternion * inverse(child.restLocalQuaternion)          // child = lowerarm or calf; its turn from rest, in the parent's frame
helper.localQuaternion = slerp(identity, D, 0.5) * helper.restLocalQuaternion
```

`slerp` is along the shorter arc (three.js's `Quaternion.slerp` is). The helper shares the child's parent and sits at
the child's position. Export it with the child's rest orientation so the two rest transforms match.

The controller never keys a helper. Helper weights are derived from the core weights by `tools/hb_helpers.py`
(`w_helper = 2·min(w_upper, w_lower)`, each donor gives half); nothing is painted.

### Shoulder-plate joint (troops with shoulder plates: 31 joints)

| Helper               | Parent     | Position                               | Rotation rule                                    |
| -------------------- | ---------- | -------------------------------------- | ------------------------------------------------ |
| `upperarm_twist_l/r` | `clavicle` | at the shoulder (the `upperarm` joint) | where the upper arm points, plus 40% of its roll |

A shoulder plate, its lining and everything under it are bound to this joint. Soft surface on the upper arm takes all of
its upper-arm weight from it as far down the arm as the plate reaches, then ramps back to `upperarm` at the elbow, so
the remaining roll is spread over the sleeve below the plate. Derived by `tools/hb_helpers.py`; nothing is painted.

Runtime driving:

```
D = upperarm.localQuaternion * inverse(upperarm.restLocalQuaternion)    // the upper arm's turn from rest, in the clavicle's frame
swing, twist = decompose(D, restArmDirection)                           // twist about the arm's own rest direction; swing = D * inverse(twist)
helper.localQuaternion = swing * slerp(identity, twist, 0.4) * helper.restLocalQuaternion
```

Why, measured on the v13 Knight (2026-10-06, `../t1-knight-claude/v4/work/plate-follow-r16.json`,
`review/trial-follow/`, `review/trial-roll/`):

- Bound to `upperarm`, a plate takes the arm's whole roll. The Knight's own poses roll the upper arm by 20° at the
  median and 59° at most, and in every guard pose the plate turned its underside to the front and the padding came
  through it.
- Taking none of the roll keeps the plate on top but wrings the sleeve below it when the arms go overhead (82° of roll
  in `reach-up-both`).
- Following only part of the arm's height or turn puts the arm through the plate (9% to 12% of sleeve and arm-band
  vertex-poses, against 0.07% when the plate follows the arm's direction fully).

This replaces the 2026-10-05 finding that shoulder plates should bind to `upperarm`. That test scored cloth through
steel only, and a plate turned inside out scores well on it. `upperarm_swing` (direction, no roll), `pauldron` (height
and part of the turn) and `lowerarm_twist` stay in `hb_lib.HELPERS` and are not used. Trial rules can be supplied
without editing the table (`HB_HELPER_RULES`).

A troop without shoulder plates keeps 29 joints. Whether the whole family should carry the joint, so every troop shares
one skeleton, is an open decision.

Deriving a helper's weights can leave five influences on a vertex; `hb_helpers.add_helpers` keeps the four largest and
renormalises.

Rules that keep 29 joints sufficient:

- **Forearm roll is applied at the wrist** (the hand joint), not at the forearm joint. Bracers and the forearm-mounted
  shield do not turn with the hand.
- **Pivots sit on the limb's own centreline.** Landmarks give the first estimate; the import then moves the shoulder,
  elbow and wrist onto lines fitted through the cross-section centres of the upper arm and forearm, and moves the hip
  sideways onto the line through the thigh's cross-section centres (kept between 40% and 60% of the way out to the hip's
  outer surface). On the v13 Knight the landmark shoulder sat 17 mm above the arm's centreline, and every raised arm
  swung up out of its socket.
- **Hinge pivots** sit about 10% of the limb's depth toward the outside of the bend (knee forward, elbow back).
- **Hip pivots** are at 0.52–0.53 H. (Until 2026-10-05 they were fixed at 0.05 H from the midline; on a stocky figure
  that is inside the leg's own line.)
- **The collarbone moves little.** In the pose solver the clavicle rises by one sixth of arm elevation above 30°, at
  most 18°, counted from the rest pose and never below it: the shoulder joint rises about 3% of stature with the arm
  overhead.

Game-side work this contract implies (part of the Knight goal, stage 8): the validator's joint count (25 → 29, or 31
with the shoulder-plate joint), the rig adapter listing the helpers as driven joints, and the drivers above.

### Exported files

`tools/hb_export.py` writes each level of detail and each item as one GLB; `tools/hb_runtime_fit.py` writes one
`runtime-fit.json` beside them.

- **Frame.** The game's: +Y up, +Z forward, +X the character's left, metres, feet on y = 0. From the working frame by
  `(x, y, z) → (x, z, −y)`.
- **Skeleton.** The 25 core joints in the family's file order
  (`root, pelvis, spine_01, spine_02, spine_03, clavicle_l, upperarm_l, lowerarm_l, hand_l, clavicle_r, upperarm_r, lowerarm_r, hand_r, neck_01, Head, thigh_l, calf_l, foot_l, ball_l, ball_leaf_l, thigh_r, calf_r, foot_r, ball_r, ball_leaf_r`),
  then the helpers (`elbow_half_l/r, knee_half_l/r`, and `upperarm_twist_l/r` for a troop with shoulder plates). Every
  joint is a node with a translation and no rotation: **every rest frame is world-aligned**, so a joint's local rotation
  is its turn from rest and the driver formulas above need no rest term. Inverse bind matrices are plain translations.
- **Skin.** One mesh, one primitive, at most four influences, weights summing to one. Normals are the authored ones;
  tangents are those the normal map was baked in. No clips.
- **Material.** One, single-sided: base colour (sRGB), one ORM image bound as occlusion and as metallic-roughness, one
  normal map; PNG, embedded.
- **Items.** One GLB each, no skin, vertices in the item's own frame turned to the game's axes the same way.
  `runtime-fit.json` gives each socket as `offset` and `quaternion_xyzw` in its joint's frame:
  `p_joint = R · p_item + offset`.
- **`runtime-fit.json`** also holds every joint's rest position, each helper's rule, share and (for a twist) axis, three
  knuckle points per hand with the way the palm faces, and each foot's sole height and heel and toe lengths. The
  game-side adapter is filled in from it; nothing there is tuned by eye.

## The gate

`tools/hb_gate.py` runs the build and every check and render for one character and writes `gate-summary.json`. The
limits are in `harness/thresholds.json`, including the rest check's (`see_rest`: 0.5% of what is seen at any joint from
any side, patches only) and depth through the steel (15 mm, armour plates, pose-library poses). Holes
(`see_inside.max_hole_share`: 3% of what is seen at a joint, above the rest pose) are a limit. Reported without a limit:
the share of what is seen whose first surface is seen from behind, and the count of depth flags. The numbers do not
judge how the result looks; the skill requires an independent reading of the joint sheets before a gate is presented.

## Binding rules

- Rigid classes: every vertex 100% on one joint, by the troop's binding table. Never weight-transferred.
- Soft classes: weights transferred from the template (`template/template.npz`: MakeHuman base mesh with its
  `game_engine` weights, fingers merged into the hands; CC0), then inpainted over the character's own surface. The only
  gates are impossibilities: wrong body side, torso below the armpit following an arm, a leg following an arm.
- Smooth borders: before binding, `tools/hb_border_cut.py` cuts the mesh along a smoothed border for every rigid class
  (new vertices on existing edges; no vertex moves). Whole-triangle borders are saws, and every tooth shows as a torn
  shard once a plate moves.
- Labels follow the texture: `tools/hb_label_refine.py` runs after the guide bore and before the border cut. The part-ID
  maps are drawn over the views and land a few millimetres off the generated surface; the generator painted the real
  boundary into the texture.
  - `labels.refine_by_colour` names the classes to refine (a list, or `{class: [classes it may trade faces with]}`;
    named partners may be rigid, e.g. a leather bracer against a hand). Within 12 mm of the class's border a face
    changes side when its colour is clearly nearer the other side's typical colour.
  - `labels.patches` holds hand corrections where a class sits on the wrong piece:
    `{"box": [x0,y0,z0,x1,y1,z1], "from": [...], "to": class, "why": text}`.
  - Colours are compared by what tells materials apart (chromaticity and saturation, brightness played down). With plain
    RGB a white highlight on a steel rivet sat nearer cream cloth than grey steel.
  - Snap (`labels.snap`, on by default): each rigid piece's border moves onto the line where it really meets its
    neighbours. Within 10 mm of the border, on both sides, each face gets a height: 1 minus its gap (mean distance to
    what rays from it meet, capped at 12 mm; 0 at a crevice's floor), plus half its colour-edge strength, plus a quarter
    for nearness to the border as it was. The faces outside that zone keep their side and flood inward, lowest first, so
    the sides meet on the ridge: the crevice floor, a colour edge, or the old border. A piece whose area would change by
    more than 30% is left alone.
  - Hidden surface (`labels.inpaint_hidden`, on by default): a face fewer than 9% of whose rays escape in the rest pose,
    and which lies within 15 mm of a rigid piece's border along the surface or has fewer than half its rays free for 12
    mm, takes one texel from the nearest face of its class of which more than 30% escape, within 15 mm. Within that 15
    mm a face at a crevice's floor is also recoloured when up to a quarter of its rays escape. So is a face beside a
    piece that none of 17 camera directions reaches (level and from above; none from below), and a hidden face with no
    visible face of its own class within reach takes the nearest visible face of its kind within 20 mm. Surface hidden
    only by something standing off it (a skirt behind a fist) is left alone.
  - Rim crevices (`labels.clean_rims`, on by default): within 12 mm of every rigid piece's border, a soft face takes the
    soft class that holds most of the surface within 5 mm of it, and faces that changed get one plain texel of their new
    class's colour. This is the strip a rim covers or shades, which shows when the rim lifts. (`{"dark": 0.55}` also
    flattens baked crevice shadow; off by default, it painted cream flecks on shadowed steel.)
- Split and underlay: each rigid group is cut free along its border and the soft surface continues beneath it for 30 mm
  (`underlay_width` per class). The underlay is not a membrane: it is laid on the fitted template body's surface, fully
  from 15 mm in from the rim, and never above the plate. What a lifted rim uncovers is a neck, a wrist, a shin.
  - Weights: at the rim the underlay has the weights of the visible surface it is welded to; over 20 mm
    (`HB_UNDER_RAMP`) it goes over to the body's own weights at its place.
  - Colour: one typical texel of the soft class it continues; deeper than `underlay_colour_depth` (12 mm; 0 means from
    the rim itself), of the class named by the piece's `underlay_colour` (skin under a helmet).
- Tube (`"underlay": "tube"` on a class of the piece): where a rigid group's border with the soft surface is one closed
  loop round a limb (a helmet's rim round the neck), the underlay is a tube in place of the strip. Five rings rise from
  the welded rim into the piece over `underlay_width`, at 6, 16, 32, 55 and 100% of it, narrowing by 22, 50, 80, 95 and
  100% of the way to `tube_scale` (0.62) of the rim's outline smoothed round its axis. Weights by construction: 35% and
  80% on the piece's joint for the first two rings (the rest from the welded vertex below), 100% above. Colour as for
  any underlay.
- Skirt: under every tube and every cuff, one band of faces from the piece's own copies of the rim vertices to a ring
  that is wholly on the piece's joint (a tube's third ring, a cuff's deepest), facing the tube. Class `lining_<piece>`,
  rigid, textured from the rim's own faces.
- Dressing: before anything is cut, the vertices of each closed rim move onto the rim's own outline smoothed round its
  axis. A seam between two rigid pieces: every vertex, at most 2 mm, and the body part's hidden vertices next to it
  relax. A tube's rim: each vertex by its hidden share (all of the way under 10% seen, none over 30%, the share smoothed
  round the rim), at most 6 mm.
- Hidden at rest: no generated face may lie in front of the surface as generated. Seven points on each generated face
  are tested; a point is covered when the first original surface outward along the face normal is met from behind, and
  proud when an original surface faces it from within 12 mm behind. Proud faces move into the body, against the fitted
  template's normal, until covered (8 rounds, at most 12 mm). Shoulder padding and the strips under rims move as sheets:
  after every round each of their vertices moves at least the mean of its neighbours (6 times). Tubes and cuffs do not:
  they lie among layered thin surfaces.
- Ironing: before the cut, soft vertices within 6 mm of a rigid piece's border that nothing outside can see at rest
  (under 10% of 24 directions free) relax toward their neighbours (6 rounds, at most 4 mm).
- Lining on request: `"lining": true` gives any plate the inner side that `"underlay": "full"` plates always have.
- Clearance: generated surface under a plate (shoulder padding, underlay strips) sinks, up to 10 mm, wherever its plate
  would cut through it in a pose of the range-of-motion, general and troop sets. Original surface never moves for this.
- The throat: everything below the jaw is soft. If the packet has no `neck` class, a spec patch makes one from the lower
  part of `head`.
- Cuff lips: body-part faces within 6 mm of a closed seam with another rigid piece that face the seam's axis go to that
  piece (`labels.seam_sides`, on by default).
- Cuff, as built since 2026-10-07 (this replaces the ring figures in the next entry): four rings at 0.3, 5, 9 and 14 mm
  into the outer piece, at 99, 90, 80 and 72% of the seam's outline, with 100, 60, 25 and 0% of their weight on the body
  part's joint and the rest on the outer piece's. The first ring follows the seam's own outline; the others its outline
  smoothed round the axis; each vertex's angle round the axis is made to rise all the way round. One plain colour of the
  garment the outer piece is worn over (`labels.cuff_texture`, `cuff_tone`); the skirt under it the same. Rule for any
  change: after the joint's largest closing travel, every ring must still lie deeper than the one before it.
- Joint fill: where two rigid pieces on different joints meet in a closed seam at least 20 mm across (bracer and hand),
  nothing soft lies under the seam. The bind runs a cuff through it, class `joint_fill`: four rings of the seam's own
  outline, the first on the seam itself (99% of its size, 0.3 mm in) with the body part's weights, the rest 3, 7 and 14
  mm into the outer piece at 90%, 80% and 72%, going over to the outer piece's joint. It carries the texture of the
  garment the outer piece is worn over (the soft class it touches most, or the class's `fill_colour`), laid out round
  and along the cuff.
- Per-class bind options, set in the spec's `labels.overrides`:
  - `"follow_arm": false`: a stiff over-garment (a leather cuirass, its straps). Every vertex its faces touch is barred
    from the arm joints, so its edge stays with the trunk and the sleeve beside it does the stretching.
  - `"over": [classes]`: the garments it lies over. Its border with them gets a smooth cut. With `"cut_free": true` it
    is also cut free and the under-garment continued beneath it; tried on the Knight's cuirass and not used (with the
    arms overhead the sleeve pulled clear and a hole opened at the front of the armpit).
  - `"forbid_joints": [joints]`: joints the class may never follow (a collar does not turn with the head).
- Before the cut, slits, notches and holes in each rigid piece are closed and its spikes removed (a face joins the piece
  when the piece holds most of the surface within 5 mm; 7 mm and one half for shoulder plates). Smooth borders also
  remove stray islands: a small patch of a rigid class away from its piece goes to the class around it, and a small
  patch of soft class enclosed by a rigid piece joins the piece. One stays stiff inside moving cloth, the other stays
  behind as a hole.
- Shoulder plates: a class marked `"underlay": "full"` (a plate that moves off what it covers) is bound to
  `upperarm_twist` and built in two layers in place of the membrane.
  - **Lining.** The plate copied 1.2 mm inside itself, facing inward, joined to the plate at its rim, rigid on the
    plate's joint and carrying the plate's own texture. The plate is a closed shell, steel inside as well as outside, so
    it still reads as a plate when it tips and shows its underside.
  - **Padding.** The plate copied and welded to the surrounding soft surface at the rim, then laid 4 mm above the fitted
    template body (fully from 15 mm in from the rim), smoothed, and kept at least 2.5 mm under the plate. It is the
    shoulder under the plate: soft, with the body's own weights. On top of those it rides with the plate's joint only as
    far as costs no more than 3× stretch in any pose of the range-of-motion, general and troop sets
    (`hb_split.ride_limited`, `HB_RIDE_STRETCH`).
  - **Clearance.** Padding is then sunk along its normal, up to 10 mm, wherever the plate would cut through it in one of
    those poses (`hb_contact.fit_clearance`, `HB_PAD_CAP`). The sunk padding is then smoothed (two passes). Only padding
    moves: a strap or sleeve beside a plate rim is behind the plate's plane but in plain view, and sinking such vertices
    changed the rest-pose look (tried and reverted 2026-10-06).
  - Padding carries the texture of the class named by the spec's `labels.padding_texture`, laid out by distance and
    bearing from the top of the dome. A pattern laid flat smeared down the dome's sides; one plain colour read as a flat
    patch. The troop's pose sets are named by the spec's `pose_sets`.
  - History, all 2026-10-06: padding riding fully with the plate tore into sheets with the arms overhead; padding in the
    plate's own shape just under the steel cut through the straps beside it and was dented wherever the plate dug in.
- Guides: a guide bar is bound rigid to its hand until `tools/hb_guide_bore.py` removes it. Faces are never deleted by
  label.
- Bridge faces: a face whose corners have disjoint weights (weight difference above 1.5) is a weld between two surfaces
  that touched in the rest pose; it is deleted.
- Classes follow attachment, not material: leather bands strapped round the upper arm belong to the arm even when drawn
  with the torso leather. Body regions come from capsules around the joints; a class declares a region only when that is
  unambiguous (boots: leg).
- Maximum 4 influences, normalised.
- Normals: the bind stores authored normals per face corner (`CN` in the bound file). Corners of original faces at the
  same rest position share one normal, summed over every original face there whatever piece it belongs to; generated
  faces carry the smooth normals of their own class. The export writes these as the model's normals and one-sided
  materials (the glTF default); the game skins them. Recomputing normals after the cut is a fault: it draws a line along
  every cut.

Default binding for armoured infantry (a troop's table may differ):

| Piece                                          | Kind                              | Joint                                                                      |
| ---------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------- |
| Helmet, head and face                          | rigid                             | `Head`                                                                     |
| Chest plate                                    | rigid                             | `spine_03` (candidate `spine_02`; compare by binding once per candidate)   |
| Shoulder plates                                | rigid                             | `upperarm_twist` (see "Shoulder-plate joint"; until 2026-10-06 `upperarm`) |
| Bracers                                        | rigid                             | `lowerarm`                                                                 |
| Hands (fist or cup, from 10 mm past the wrist) | rigid                             | `hand`                                                                     |
| Thigh pads                                     | rigid                             | `thigh`                                                                    |
| Greaves with knee tops                         | rigid                             | `calf`                                                                     |
| Torso leather, belt, hip panels                | soft, region torso                | —                                                                          |
| Boots                                          | soft, region leg                  | —                                                                          |
| Sleeves, trousers, tunic, collar, neck         | soft                              | —                                                                          |
| Guide proxies                                  | rigid on the hand until bored out | `hand`                                                                     |

## Deformation gate

`tools/hb_harness.py` poses a bound mesh with plain linear blend skinning (the same maths as three.js) and reports, per
pose: edge stretch (by edge count and weighted by edge length), triangle area collapse, thickness kept on the outside
and inside of each hinge, twist-zone collapse, and rigid-island distortion. `tools/hb_contact.py` reports, per plate and
per pose, how much soft surface comes through the plate and how far the plate lifts off what it covered.
`tools/hb_pose_check.py` rejects poses whose left and right limbs pass through each other. Pass criteria are in
`harness/thresholds.json`.

Pose sources:

- Range-of-motion set (generated, 57 poses): every joint to its working limit, alone and in common combinations.
- Pose library (`poses/`, 133 poses): general 29, knight 36, crossbowman 24, paladin 23, mount 21. Schema in
  `poses/SCHEMA.md`, limits in `poses/limits.json`.

A humanoid troop must pass the range-of-motion set, the general set and its own set.

## Hands, equipment and sockets

No finger joints. Each hand is one rigid island, generated in its final pose.

| Troop         | Right hand                                | Left hand                                       | Items and sockets                                                                                                         |
| ------------- | ----------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Knight        | fist around a guide bar (sword grip axis) | closed fist                                     | sword on `gripRight` (`hand_r`); round shield on `forearmLeft` (`lowerarm_l`)                                             |
| Paladin rider | fist around a guide bar (sword)           | fist around a guide bar (reins pass through it) | sword `gripRight`; shield `forearmLeft`; reins `reinLeft` (`hand_l`); `seat` (`pelvis`); `stirrupLeft/Right` (`ball_l/r`) |
| Crossbowman   | relaxed cup, trigger side                 | relaxed cup, support                            | crossbow on `gripRight` with support point `gripLeft`; `projectileOrigin`; `quiver` (`pelvis`)                            |

- Guide bore: the bar's cylinder is fitted from its own surface (axis and radius); the faces inside it are deleted and
  the two openings on the fist are joined by a channel at the bar's own radius, using the openings' own vertices. No
  hand vertex moves, no hand face is removed. The fitted axis is the grip axis for the equipment fit.
- **Socket.** An item is a separate object that follows one joint rigidly through a socket: a fixed 4×4 from the joint's
  frame to the item's frame. The joints' rest frames are world-aligned, so at rest the socket is the item's matrix in
  the working frame with the joint's rest position subtracted. `tools/hb_gear.py` fits and records it
  (`<work>/gear-fit.json`, `socket_in_joint_frame`, metres, working axes). The game applies it as the item's local
  transform under the joint.
- Sword: grip on the guide axis, palm-seated, blade out of the thumb and index side, edge toward the wrist, guard a set
  gap in front of the fist. Item frame: origin at the grip's centre, blade +Z, edges ±Y, flats ±X. On the Knight the
  fitted blade lies 67° from the forearm, and with wrist deviation 42° to 87°: a hammer grip. A blade in line with the
  forearm cannot be posed with it. Turning the handle in the same fist was measured (10° puts the handle 3 mm through
  the skin); whether a second grip is wanted at all is a Knight decision at gate E.
- Shield: follows the forearm joint only, seated on the forearm's outward side and leaning with it. Item frame: origin
  at the centre of the rear surface, front toward −Y, up +Z.
- Poses state where items point, and may state where they are:
  `"items": {"sword": {"blade": [forward, left, up], "at": {"joint": "pelvis", "offset": [forward, left, up]}}, "shield": {"face": […]}}`.
  Directions are in the character's root frame; a place is from the named joint to the item's origin, in statures,
  turning with that joint. A pose is aimed when each item is within 12° of its direction on the fitted sockets
  (`tools/hb_item_aim.py`), with no more than 10 mm of any item inside the body, no body vertex more than 2 mm inside an
  item and no item inside another (`harness/thresholds.json`, `equipment`).
- Arm limits (`poses/limits.json`): the plane of elevation may go to −90 (straight back) while elevation is at most 50;
  otherwise no lower than −40.
- Crossbow: held flat, both palms under the stock; right fingers to the left face, thumb on the right. Total twist from
  upper arm to hand under 200°.
- Items keep their authored size on every skin.

## Counts and budgets

|                | Foot figure                                           | Mounted unit              | Full hex              |
| -------------- | ----------------------------------------------------- | ------------------------- | --------------------- |
| Figures        | 1–6 per hex                                           | 1–3 per hex               | 6 foot or 3 mounted   |
| Near triangles | T ≈ 15k (skin ≤ 13.5k including underlay, plus items) | 2T ≈ 30k                  | 6T ≈ 90k              |
| Mid triangles  | ≈ 5.5k (skin ≈ 4.5k plus items)                       | ≈ 11.5k                   | ≈ 33k                 |
| Joints         | 29                                                    | 29 + mount (≤ 40)         | 174 foot, 207 mounted |
| Draws          | skin + items (3)                                      | rider + mount + items (4) | 18 foot, 12 mounted   |
| Textures       | 1024² near, 512² mid, one material per object         | same; mount coats A/B/C   | —                     |

These are planning numbers from the three troops' records. The hosted test at the largest count is what decides.

## Mounts

A mount has its own rig and is generated once as its own object. The Paladin horse rig (`t1-horse-v1`, ≤ 40 joints) is
specified but not built; `poses/mount.json` is keyed by anatomical joints until it exists. Withers 0.55. Rider and mount
join at `seat` / `saddleSeat`; rein hand and shield forearm stay distinct. Tack is bound rigid by label. The paladin
pose set is seated and omits `pelvis.height`; pelvis height is a rigid shift and does not change any deformation number.
