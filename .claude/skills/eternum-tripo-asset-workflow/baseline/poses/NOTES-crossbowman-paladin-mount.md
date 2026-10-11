# Notes: crossbowman, paladin, mount pose sets

Files: `crossbowman.json` (24 poses), `paladin.json` (23), `mount.json` (21). Refs in `refs/crossbowman/`,
`refs/paladin/`, `refs/mount/` (JPEG, longest side at most 1280; 11 images downloaded from Wikimedia Commons with page,
credit and licence in each pose's `sources`). Images already held by other workspaces are referenced by relative path
(`../../t1-paladin-claude/research/poses/refs/`, `../../t1-crossbowman-claude/references/` for the three owner grip
photos, which are not licensed for redistribution).

## Converted

- Paladin: 14 of the 16 earlier rider poses (plus the stored right-turn mirror) in
  `t1-paladin-claude/research/poses/poses.json` converted by hand (shoulder flexion/abduction to plane/elev; head pitch
  sign flipped because the old table had + = up; hip flexion now = thigh angle below vertical plus pelvis pitch, because
  the schema hip is a joint angle; vectors changed from [fwd, up, right] to [fwd, left, up]). Not carried:
  `backhand-right-rear`, `thrust-down-right` (not requested).
- Mount: stand, walk, gallop gathered and extended from `horse-gaits.md`, expressed as deltas from the square halt.
- Crossbowman: no earlier pose table exists. `xh_specs.py` only holds five stance/aim entries (carry, lowered-carry,
  cheek-aim, raised-aim, shoulder-aim); their side-on yaw (-46 to -58) and head tilt informed the aim poses. The `xr_`
  scripts only hold joint-range tests.

## New

Everything else: rising trot, canter, overhead cut, brace, hit reaction, victory, rear balance (paladin); all spanning,
quiver, club, cheer, kneel poses and the run (crossbowman); relaxed stand, trot, canter, rear, slide, turn, head,
stumble, lying (mount). 30 of 68 poses are `designed` (built from limits, no reference).

## Conventions I fixed (check these)

- `bolt_axis`, `blade`, `face` are in the root (target) frame, so the side-on aim has pelvis yaw -45 and bolt `[1,0,0]`.
- Paladin `stance.seat`: `lean` = pelvis pitch + spine flex (+ forward), `twist` = pelvis yaw + spine twist (+ left),
  `side` = spine side bend (+ left). Paladin `pelvis` has no `height`. `support` always has `seat` plus both feet; in
  rising-trot-up, gallop-two-point and rear the seat is nominal (rider off the saddle or tilted).
- Horse `support` lists hooves (`hoof_lf` ...) or `chest`/`belly`; the check script does not apply `limits.json` to the
  horse.

## Horse joint list

The Paladin horse rig (`t1-horse-v1`) does not exist yet: the blend is mesh-only (`ASSET-RECORD.md`,
`GOAL-PROMPT-LAYERED.md` line 100 only specifies it). So targets are keyed by anatomical joints (root, pelvis, spine,
neck_base, poll, tail, fore_l/r shoulder-elbow-carpus-fetlock, hind_l/r hip-stifle-hock-fetlock), and the planned layout
is mapped to them in the file header (`joint_source`). Real bone names seen in
`eternum-knight-pr-r2/.../horse/quaternius-horse-rig-adapter.ts` (Body, Back, Torso, Torso2, Torso3, Neck1-3, Head,
FrontShoulderL/FrontUpperLegL/FrontLowerLegL, BackShoulderL/BackLegL/BackUpperLegL/BackLowerLegL, Tail1-7) belong to the
Quaternius horse, not the Paladin rig. Re-key when the rig is built.

## Open doubts

- Angles are read by eye from photos (about +/-15). Nothing is `measured`.
- Crossbow spanning: no photo of a foot-in-stirrup spanning was found; the sequence is `designed`. Hand roll values
  (palm-up cup left, handshake-like right) follow the owner's memory notes.
- Sliding-halt, rear and canter angles are rough; the rear body pitch 45 is from two photos.
- `limits.json`: `wrist_flex` use range of +/-30 is tight for the thumb-on-top rein fist and for gripping a string (I
  stayed within it). Suggest hip_abd lower bound -20 is fine; no change needed otherwise. `pelvis.height` has no meaning
  for the seated rider; the harness must ignore it when `support` includes `seat`.
- Rising-trot refs: the rise itself has no photo.
