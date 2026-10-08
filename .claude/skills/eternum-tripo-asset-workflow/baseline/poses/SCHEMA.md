# Family pose library: schema

One JSON file per set: `general.json`, `knight.json`, `crossbowman.json`, `paladin.json`, `mount.json`. The deformation
harness (`../harness/`) reads the human sets and poses any humanoid built on the family skeleton. Poses are static test
and reference poses. They are not animation clips.

## File shape

```json
{
  "set": "knight",
  "applies_to": "knight",
  "version": 1,
  "poses": [ { ...pose... } ]
}
```

`applies_to`: `all` (general set), `knight`, `crossbowman`, `paladin`, `horse`.

## Pose entry

```json
{
  "id": "cut-windup",
  "name": "Overhand cut, wind-up",
  "phase_of": "cut-overhand",
  "description": "Stance first: legs, hips and body facing. Then torso. Then arms and items.",
  "support": ["foot_l", "foot_r"],
  "stance": { "lead": "l", "width": 0.35, "length": 0.55, "weight_front": 0.4, "facing_yaw": 35 },
  "targets": {
    "pelvis": { "yaw": 35, "pitch": 5, "roll": 0, "height": 0.94 },
    "spine": { "flex": 5, "twist": -20, "side": 0 },
    "head": { "yaw": -30, "pitch": 0, "roll": 0 },
    "arm_r": { "plane": 60, "elev": 110, "rot": -40, "elbow": 95, "pron": 0, "wrist_flex": -10, "wrist_dev": 0 },
    "arm_l": { "plane": 70, "elev": 45, "rot": 20, "elbow": 80, "pron": 0, "wrist_flex": 0, "wrist_dev": 0 },
    "leg_r": { "hip_flex": -10, "hip_abd": 10, "hip_rot": -20, "knee": 15, "ankle": 5, "toe": 20 },
    "leg_l": { "hip_flex": 35, "hip_abd": 8, "hip_rot": 5, "knee": 40, "ankle": 10, "toe": 0 }
  },
  "items": { "sword": { "blade": [0.2, -0.3, 0.9] }, "shield": { "face": [0.9, 0.4, 0.1] } },
  "confidence": "estimated",
  "refs": ["refs/knight/cut-windup-1.jpg"],
  "ref_notes": "what each reference shows and what was taken from it",
  "sources": [
    {
      "file": "refs/knight/cut-windup-1.jpg",
      "page": "https://commons.wikimedia.org/...",
      "credit": "...",
      "licence": "CC BY-SA 4.0"
    }
  ]
}
```

A pose's `items` entry is what the equipment check holds the pose to. Beside its direction an item may have a place:
`"at": {"joint": "<joint>", "offset": [forward, left, up]}`, from that joint's posed position to the item's own origin
(a sword's grip centre, a shield's rear centre), in statures. The offset turns with the joint ("in front of the chest"
stays in front of the chest) unless `"frame": "root"` is given. With a place, `tools/hb_item_aim.py --place` solves the
whole arm from the intent; this is the way to author a pose for a held item.

Two optional records say how a pose came to differ from what was first authored:

- `aimed`: per item, `direction_error_deg` and (for a placed item) `position_error_mm` on the fitted sockets, the
  authored direction where it was restated, and `changed_from_version_1`, every target that differs.
- `corrected`: written by hand when a pose's intent was changed: date, what changed, why, and the authored description
  where the text was restated.

A set file carries `version` and, once aimed, `aimed_with` (date, tool options, the sockets it was aimed on, the
previous version's file).

## Conventions

- **Sides** are the character's own left and right.
- **Vectors** (`blade`, `face`, any direction) are `[forward, left, up]` in the character's root frame, unit length not
  required.
- **Angles** are degrees. Zero for every joint is the anatomical neutral stance: standing upright, arms hanging at the
  sides with palms facing the thighs, feet pointing forward. Zero is _not_ the A-pose the model is built in; the harness
  converts.
- **pelvis**: `yaw` + turns the body to its left; `pitch` + leans forward; `roll` + raises the left hip; `height` is
  pelvis height as a fraction of standing height (1.0 standing, about 0.55 deep crouch, about 0.3 kneeling low).
- **spine** (total over the three spine joints): `flex` + forward; `twist` + turns the chest to the left relative to the
  pelvis; `side` + bends to the left.
- **head** (total over neck and head, relative to the chest): `yaw` + left; `pitch` + chin down; `roll` + left ear to
  left shoulder.
- **arm** (ISB shoulder convention):
  - `plane`: plane of elevation. 0 = straight out to the side, 90 = straight forward, negative = behind the body.
  - `elev`: angle between the upper arm and the downward vertical of the chest. 0 hanging, 90 horizontal, 180 overhead.
  - `rot`: upper-arm axial rotation, + internal (forearm swings toward the belly when the elbow is bent 90 with the arm
    hanging).
  - `elbow`: flexion, 0 straight.
  - `pron`: forearm roll. 0 = thumb forward with the arm hanging (handshake). + pronation (palm turns back/down), −
    supination.
  - `wrist_flex`: + palmar flexion, − extension. `wrist_dev`: + radial (thumb side), − ulnar.
  - The clavicle is driven automatically and relative to the rest pose: one sixth of arm elevation above 30°, at most
    18°, minus the same figure for the arm's rest elevation, never below zero. The shoulder joint rises about 3% of
    stature with the arm overhead and does not move for poses at or below the rest elevation. Add
    `"clavicle": {"elev": n, "protract": n}` only where a pose needs a shrug or reach.
- **leg**: `hip_flex` + thigh forward; `hip_abd` + thigh out to the side; `hip_rot` + internal (toes in); `knee`
  flexion, 0 straight; `ankle` + dorsiflexion (toes up); `toe` + toe extension (heel-off).
- **support**: what carries weight: any of `foot_l`, `foot_r`, `toe_l`, `toe_r`, `knee_l`, `knee_r`, `seat`, `hand_l`,
  `hand_r`, `back`, `front`.
- **stance** (human, standing poses): `lead` foot `l`/`r`/`none`; `width` and `length` between the feet as fractions of
  leg length; `weight_front` 0–1; `facing_yaw` of the feet line relative to the target direction. This restates the
  stance for animation use; the harness uses `targets`.
- **confidence**: `measured` (angles read from a clear reference), `estimated` (judged from references), `designed` (no
  reference; built from the joint limits).
- **phase_of**: optional. Groups poses that are stages of one action.

## Limits

Every target must stay inside the limits in `limits.json`. A pose that needs more than the limit is marked
`"over_limit": ["arm_r.pron"]` and explained in `ref_notes`; do not silently exceed.

## Rules carried from user feedback

- Stance first: set legs, hips and body facing before the arms. Side-on where the reference is side-on.
- Items are held close with bent arms; do not push an item out at arm's length and bend the wrist to compensate.
- Arms stay natural: elbow never fully locked in action poses (15 or more), forearm roll within ±80, wrist within about
  25 per axis.
- Total twist from upper arm to hand stays under 200.
- Knight and Paladin: sword in the right fist, round shield strapped to the left forearm (it follows the forearm, not
  the hand). Paladin: reins pass through the left fist.
- Crossbowman: the crossbow is held flat with both palms under the stock; right fingers wrap to the left side with the
  thumb on the right; the left (support) hand is a relaxed cup. The quiver sits at the lower back.

## Mount set

`mount.json` uses the same file shape with `applies_to: "horse"`. `targets` are keyed by the horse rig's own joints; see
the header of that file for its convention.
