# Notes: general.json and knight.json

Written by the pose-library drafting worker. No Blender or game code was touched. The `output/` tree is not inside a git
repository, so there is no source commit to record.

## What is here

| File                                 | Poses                     | Confidence                |
| ------------------------------------ | ------------------------- | ------------------------- |
| `general.json` (`applies_to: all`)   | 29                        | 12 estimated, 17 designed |
| `knight.json` (`applies_to: knight`) | 37 (19 converted, 18 new) | 27 estimated, 10 designed |

Reference images: 22 JPEGs (11 in `refs/general/`, 11 in `refs/knight/`), longest side at most 1280 px. Sources are in
each pose's `sources`. The 19 converted poses point at the existing images by relative path
(`../../t1-knight-claude/research/poses/refs/...`) and are not copied.

- General references are public-domain Muybridge _Animal Locomotion_ plates (1887) from Wikimedia Commons. They are
  multi-frame plates of nude models, used only for joint angles. Coverage is thin for the non-locomotion poses (salute,
  point, cheer, hit reactions, stagger, look, reach up, sidestep, turn, weight shift, idle): those are `designed`.
- Knight references are Wikimedia Commons reenactment photos (CC BY-SA 4.0 / CC BY 2.0 / one public domain). Only three
  new poses rest mainly on a photo: lunge over the rim, parry, shield-wall crouch, plus advance and taunt in part. The
  photos were judged by eye at thumbnail size.

## How the 19 existing poses were converted

- Source numbers: `g3_07_ref_poses.py` `POSES` table plus the per-joint notes in `poses.json`.
- Shoulder: old `(flexion, abduction, axial)` was turned into `(plane, elev, rot)` by building the old rotation
  (abduction first, then flexion about a fixed axis, axial first) and re-expressing it in the new convention. Old axial
  rotation is external-positive for both arms, so new `rot` is roughly the negated old value.
- Head pitch: old positive was looking up, new positive is chin down, so the sign was flipped.
- Pelvis `height` is derived, not copied (see below); old `drop` percentages were not used.
- Hip angles: the old notes read as thigh-versus-vertical (they reproduce the stated stance lengths), so
  `hip_flex = thigh angle + pelvis pitch`. Hip rotation comes from the old foot yaw relative to the pelvis yaw (scaled
  0.8).
- Where the old numbers could not close a stance (long lunges, rear leg too short for the stated pelvis drop) the rear
  leg was re-solved so the foot reaches the floor. Affected: guard-low, walk-contact, cut-mid, cut-followthrough,
  thrust-extension (rear thigh -30 and knee 30 instead of straight), shield-brace-front, shield-bash, hit-react. Lengths
  stay within a few hundredths of the old stance values.
- Pelvis height and stance length are computed from a sagittal-plane leg model (thigh 0.245, shin 0.246, ankle height
  0.039, hip height 0.53 of body height). Ankle angle is set so the foot is flat; when that needs more than the 20
  degree dorsiflexion limit the heel is lifted and `toe` takes the excess.
- Dropped from the old table: pelvis `drop` as a percentage, foot yaw numbers (folded into `hip_rot`), pelvis shift
  (`pel_y`), the `edge` hint for the blade.

## Items (`blade`, `face`)

`items.sword.blade` and `items.shield.face` are computed from the final arm angles by a forward-kinematics model, not
copied from a wish list. With the shoulder in a swing-then-twist convention, a 90 degree hammer fist (blade along the
thumb direction), and the shield face on the dorsal side of the left forearm.

The solver chooses forearm roll and wrist so the blade lands as close as it can to the intended direction while keeping
the arm near the researched shoulder and elbow angles, the fist clear of the torso, and wrist within 25 degrees. Blade
error against the intended direction: most poses under 5 degrees; idle-relaxed 22, backhand-cut-windup 24,
backhand-cut-mid 22, taunt 31, chop-overhead-strike 37. Shield face error is under 10 degrees except hit-react (22),
charge-sprint-flight (22), backhand-cut-windup (19), shield-block-high (14).

## Limits and doubts for the coordinator

1. **Shoulder `rot` convention.** I assumed `rot` is the twist about the upper-arm axis after the shortest-arc swing
   from the hanging arm to the (plane, elev) direction, with 0 = thumb forward at hanging. SCHEMA.md gives
   plane/elev/rot but not the decomposition. If the harness uses the ISB Y-X-Y sequence the same numbers will look
   different once the arm is raised. Please confirm.
2. **Hammer grip cannot point the blade down.** With the blade perpendicular to the forearm (plus 25 degrees of wrist)
   the blade can reach about 30 degrees below horizontal at best when the hand is held in front. A sword planted
   vertically (kneel-exhausted-on-sword, idle-at-ease with the point on the ground) needs a canted second grip, as
   `sword-arm.md` recommended. I kept kneel-exhausted at the best reachable blade and said so in its description.
3. **limits.json forces compromises**
   - `arm.plane` min -40 means a pure backward arm swing is impossible. Back-swings (walk, run, hit-back) are expressed
     as arms swung back and outward.
   - `leg.ankle` max 20 is below the roughly 40 degrees a flat-footed deep squat needs; the squat uses lifted heels.
     Several rear legs in lunges also lift the heel for the same reason.
   - `pelvis.pitch` (-30 to 60) and `pelvis.height` (min 0.25) cannot express lying on the ground. `lying-prone`
     (pitch 90) and `lying-supine` (pitch -90) use height 0.12 and list `over_limit: ["pelvis.pitch", "pelvis.height"]`.
     A root-orientation field in the schema would be cleaner.
   - `leg.hip_flex` min -20 limits rear-leg extension in deep lunges.
4. **Unverified geometry.** No rig was posed. Hand and foot positions come from a rough proportion model (arm 0.186 +
   0.146, fist 0.09, shoulder 0.30 above the pelvis); expect centimetre-level error and check in the harness. Two clamps
   were applied: shield-wall-crouch right toe 64 -> 60 and hit-react left shoulder rot 90 -> 80.
5. **Frame.** Vectors are in the root frame with the pelvis yaw included. Poses with a turned pelvis (most knight
   guards) therefore show blade and face vectors that look rotated against the nominal "forward".
6. **Walk/run mirrors.** `walk-contact-r`, `walk-passing-r` are exact mirrors of the left versions (central angles
   negated, sides swapped).
7. **Muybridge plates** are public domain, but they show nudes; they were kept as whole plates and only viewed at
   thumbnail size, so frame-level angles are rough.
8. **Count.** The general set has 29 poses (the listed items add up to 29); the knight set adds 18 poses instead of 10
   to 14 because each requested item and phase has its own pose.

## Order of the knight file

The 19 converted poses come first in the original order, then the 18 new ones. Phase groups (`phase_of`): `guard`,
`walk-cycle`, `cut-overhand`, `thrust`, `shield-bash`, `backhand-cut`, `chop-overhead`; general: `walk-cycle`,
`run-cycle`.
