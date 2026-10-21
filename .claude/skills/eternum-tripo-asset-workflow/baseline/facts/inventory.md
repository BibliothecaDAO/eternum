# T1 Troops Runtime and Asset Contract Inventory

> A dated snapshot, kept as the record the contract was first written from. It describes the game client and the troop
> records as they stood in early October 2026, before the T1 Knight Default model of #5029: 25 joints, and game files
> then named `bastion-knight-…` and `validate-bastion-final-exports.mjs`. Those files now carry 31 joints and the names
> `t1-knight-default-…`; line numbers below are the old files'. `CONTRACT.md` is the current statement.

Fact sheet for Knight, Crossbowman, and Paladin rider. Sources: asset records, goal prompts, runtime-fit-contract.json,
and rig adapters. All values as quoted from source files with file paths and keys/lines.

## 1. Skeleton: Joint List, Hierarchy, and Validator Contract

### Joint Names and Count (Exactly 25 deform joints per troop)

Knight, Crossbowman, Paladin rider all use identical humanoid skeleton: `bastion-knight-humanoid-rig-adapter.ts` (game
client, `apps/game/src/three/characters/`) and runtime-fit-contract.json (Crossbowman, line 12–37):

```
root, pelvis, spine_01, spine_02, spine_03, clavicle_l, clavicle_r, upperarm_l, upperarm_r, lowerarm_l, lowerarm_r, hand_l, hand_r, neck_01, Head, thigh_l, thigh_r, calf_l, calf_r, foot_l, foot_r, ball_l, ball_r, ball_leaf_l, ball_leaf_r
```

Total: **25 joints** (Knight GOAL-PROMPT.md, line 147–150; Crossbowman runtime-fit-contract.json, lines 11–37).

### Required vs Auxiliary vs Diagnostic Bones

- **Required (deform):** all 25 listed above
- **Auxiliary (non-deform):** `root`, `spine_02`, `clavicle_l`, `clavicle_r` (bastion-knight-humanoid-rig-adapter.ts,
  line 39)
- **Diagnostic (reference only, not exported):** ankleLeft, ankleRight, chest, elbowLeft, elbowRight, head, hipLeft,
  hipRight, kneeLeft, kneeRight, pelvis, shoulderLeft, shoulderRight, wristLeft, wristRight
  (bastion-knight-humanoid-rig-adapter.ts, lines 40–56)

### Axes and Units

- **Runtime:** +Y up, +Z forward, +X anatomical left (Knight GOAL-PROMPT.md, line 143; Crossbowman
  runtime-fit-contract.json, line 5)
- **Raw glTF input:** +X forward, +Y up, +Z anatomical right. Blender conversion: +X forward, +Z up, −Y anatomical right
  (Knight ASSET-RECORD.md, line 143–144; Paladin GOAL-PROMPT-LAYERED.md, line 48)
- **Units:** world units at H=0.6 (standing height without helmet/cap)

### Validator Assertions

From validate-bastion-final-exports.mjs (lines 113–149):

- Exactly 25 joints in skin: `document.skins[0].joints.length === 25` (line 113)
- Maximum 4 influences per vertex (line 120)
- Skinned attribute validation: JOINTS_0 (4-component) and WEIGHTS_0 (4-component) required (line 120)
- Weight normalization tolerance: maximumError < 1e-5 (line 137)
- All vertex weights normalised to sum ≈ 1.0, range checked (lines 124–135)
- Inverse bind matrices: 25 × 4×4 matrices, all finite (lines 138–143)
- Geometry: 1 mesh, 1 primitive, triangle mode (lines 77–81)
- Attributes: POSITION, NORMAL, TEXCOORD_0 required (line 84)
- No animation clips (Knight GOAL-PROMPT.md, line 155)

## 2. Sockets and Equipment

### Socket Names, Parent Bones, and Offsets

From Crossbowman runtime-fit-contract.json (lines 419–475):

| Socket             | Bone         | Offset [x, y, z]                                              | Type                      |
| ------------------ | ------------ | ------------------------------------------------------------- | ------------------------- |
| `gripRight`        | `hand_r`     | [-0.01730674, 0.03764342, -0.00259193]                        | sword/crossbow primary    |
| `gripLeft`         | `hand_l`     | [0.01844231, 0.03428578, 0.00167928]                          | crossbow support grip     |
| `forearmLeft`      | `lowerarm_l` | [0.02429374, 0.0540103, 0.00590031] (Knight adapter, line 89) | shield                    |
| `projectileOrigin` | `hand_r`     | [-0.1061993, 0.14968275, 0.1175148]                           | crossbow projectile spawn |
| `quiver`           | `pelvis`     | [-0.05557791, 0.05349997, -0.02831836]                        | back-hip attachment       |

Paladin rider adds (GOAL-PROMPT-LAYERED.md, line 99):

- `reinLeft` on `hand_l`: left-hand rein grip
- `seat` on `pelvis`: mount seat attachment
- `stirrupLeft`, `stirrupRight` on `ball_l`, `ball_r`: foot stirrup positions

### Equipment Dimensions

Knight: sword 0.343 total (blade 0.257, guard top at raw Z −0.21371), shield diameter ~0.25 (ASSET-RECORD.md, lines 27,
46, 186) Crossbowman: crossbow 0.261 long; quiver tube 0.113 long × 0.03551 wide × 0.03 deep (runtime-fit-contract.json,
lines 261, 554–557) Paladin: sword 0.30, shield 0.165 diameter, horse withers 0.55 (ASSET-RECORD.md, Paladin section,
line 44; GOAL-PROMPT-LAYERED.md, line 78)

### Palm Points (Hand-Local Space, Cupped or Fist Pose)

Crossbowman cupped hands (runtime-fit-contract.json, lines 359–417):

**Left (index, middle, pinky):** `[0.00969684, 0.02395719, 0.01898087]`, `[0.00442842, 0.02595677, 0.00932505]`,
`[-0.00267577, 0.02395636, -0.00160743]` **Right:** `[-0.01020766, 0.02520107, 0.01484865]`,
`[-0.00436159, 0.0272006, 0.00553104]`, `[0.00339442, 0.02520002, -0.00494923]`

Knight loose fist: not in runtime contract, defined in Blender only (ASSET-RECORD.md, line 218, socket `gripRight` on
`hand_r`)

## 3. Scale and Counts

### Standing Height H

**H = 0.6 at hex radius 1**, measured without helmet/cap, standing equivalent (Knight GOAL-PROMPT.md, line 142;
Crossbowman runtime-fit-contract.json, line 7; troop-families.md, line 10)

### Figures Per Hex

- **Foot soldiers (Knight, Crossbowman):** 1–6 figures per hex at constant figure scale (troop-families.md, line 23;
  GOAL-PROMPT-LAYERED.md Paladin, line 31)
- **Mounted troops (Paladin):** 1–3 complete rider-mount units per hex; layout: one centred, two side-by-side, three in
  triangle (troop-families.md, lines 23–24)

### Formation Layouts and Implementation

Paladin counts 1/2/3 use positioned rider-mount pairs. Knight/Crossbowman layout not specified in current records.
Formation control is gameplay-owned; count represents army size, not individual scaling (troop-families.md, lines
27–30).

Coat assignment for Paladin mounts (GOAL-PROMPT-LAYERED.md, line 144): Count 1 = A; count 2 = A/B; count 3 = A/B/C.
Stable slots maintained across count changes and reloads (troop-families.md, line 111).

## 4. Budgets: Triangles, Texture Sizes, Material Rules

### Knight Budget (Approved, GOAL-PROMPT.md, lines 180–196)

| LOD  | Skin   | Sword  | Shield | Equipped Unit | Texture |
| ---- | ------ | ------ | ------ | ------------- | ------- |
| Near | ≤10.5k | ≤500   | ≤1k    | ≤12k          | 1024²   |
| Mid  | ≤3.5k  | shared | shared | ≤5k           | 512²    |

Actual Knight near skin: 12,678 tris (G3 revision 3, ASSET-RECORD.md, line 229); approved by user feedback (line 107)

### Crossbowman Budget (Proposed, GOAL-PROMPT.md, lines 253–260)

| LOD  | Skin  | Crossbow         | Quiver         | Equipped Unit | Texture |
| ---- | ----- | ---------------- | -------------- | ------------- | ------- |
| Near | ≤11k  | 1,102 (retained) | 528 (retained) | ≤12.7k        | 1024²   |
| Mid  | ≤3.5k | shared           | shared         | ≤5.2k         | 512²    |

Extra allowance for joint loops (Knight accepted 12,678 near); budget changes only on stage measurements.

### Paladin Budget (Proposed, GOAL-PROMPT-LAYERED.md, lines 150–153)

| LOD  | Rider (merged) | Horse + tack | Sword  | Shield | Unit   | Coats          |
| ---- | -------------- | ------------ | ------ | ------ | ------ | -------------- |
| Near | ≤13.5k         | ≤14k         | ≤500   | ≤1k    | ≤29k   | ×3 colour maps |
| Mid  | ≤4.5k          | ≤5.5k        | shared | shared | ≤11.5k | ×3 colour maps |

Mounted unit 2× foot-soldier allowance per troop-families.md allocation rule (line 22): T per foot soldier, 2T per
mounted unit, 6T full hex.

### Material Rules

- 1 material per model (1 mesh, 1 primitive); embedded colour, ORM, normal PNGs (Knight GOAL-PROMPT.md, lines 153–154;
  Crossbowman GOAL-PROMPT.md, line 214)
- No embedded animations (Knight, line 155)
- Shared texture routes: near/sword, near/shield shared with mid LOD (Knight, line 176)

## 5. Mount: Horse Rig and Coat Variants

### Horse Rig (`t1-horse-v1`)

From GOAL-PROMPT-LAYERED.md (Paladin, line 100):

- Root, pelvis, spine, chest, withers, 2 neck bones, head
- Four legs: 4-bone chains per leg with hoof contacts
- Tail: 3 bones
- Tack: `saddle`, `stirrup_l`, `stirrup_r`, `rein_grip` bones
- Target: ≤40 deform joints total

Sockets: `saddleSeat` (rider seat), `stirrupBarL`/`stirrupBarR` (foot stirrups), `bit` (rein mouth attachment).

### Calibration

Horse withers height: 0.55 (GOAL-PROMPT-LAYERED.md, line 78; ASSET-RECORD.md Paladin, line 44) Scale factor: 0.74584
(origin at centre of four hooves, z = 0) (ASSET-RECORD.md Paladin, line 46)

### Coat Variants and Assignment

Three reusable colour maps for Paladin: A (bay), B (dark bay), C (chestnut) (ASSET-RECORD.md Paladin, lines 89–90,
reviewed in `review/g2/horse/SHEET-coats.png`) Assignment: count 1 = A only; count 2 = A and B; count 3 = A, B, and C
(troop-families.md, lines 103–108) Geometry shared, colour maps swapped per coat. Not yet shown to user for full G2
approval (Paladin ASSET-RECORD.md, line 89).

## 6. Hands: Grip Frames and Finger Joints

### Knight and Paladin Rider

**Loose fist:** both hands, sword arm and shield arm (Knight GOAL-PROMPT.md, line 86)

- Fixed-length bones, rotation-only control (ASSET-RECORD.md, line 173)
- Knuckle +50°, middle joint +25°, end joint +10°, pinky gradient (line 178)
- Thumb: opposition −55°, flex 10°, MCP 40°, IP 60° (line 178)
- Right fist tunnel: 8.0mm enclosed (line 179); left: 10.5mm (line 179)
- Grip seated in palm tunnel, blade exits thumb–index side; handle axis on bar bore (ASSET-RECORD.md Knight, lines
  200–208)

### Crossbowman

**Cupped left hand (support):** palm-up under crossbow fore-stock (GOAL-PROMPT.md, line 103) **Trigger-ready right
hand:** fingers under stock's left face, thumb on right, handshake-like seat under lower-right edge (GOAL-PROMPT.md,
lines 102–103, 177)

Palm points defined in runtime-fit-contract.json (see section 2). Helper rig reuses Knight's method (GOAL-PROMPT.md,
line 174).

### Finger Joint Requirements

Knight: no explicit finger animation in test; static poses only via fist helper rig (GOAL-PROMPT.md, line 263)
Crossbowman: same cupped/trigger-ready endpoints (GOAL-PROMPT.md, line 199) No individual finger animation or extra
twist bones specified in current records.

## 7. Animation and Procedural Controller

### Pose Sets (Static Diagnostic Only, No Clips)

Knight (GOAL-PROMPT.md, lines 244–263): joint-range poses (head/torso turns, shoulders, elbows, forearm roll ±60°,
wrist, hip, knee, ankle, crouch, lunge) + combat poses (guard, wind-ups, slash, thrust, shield bash, lowered rest) +
game procedural samples.

Crossbowman (GOAL-PROMPT.md, lines 198–205): five reference poses (carry, lowered carry, cheek aim, raised aim, shoulder
aim) from `../t1-crossbow-default-20260927/revisions/r2/references/user-reference-*.jpg`.

Paladin (GOAL-PROMPT-LAYERED.md, lines 207–212): mounted reference set (seat, rein hand, sword cuts, shield cover, horse
stand/walk/gallop phases) + game idle/walk/gallop samples. Static poses only; procedural controller is game-owned.

### Procedural Controller Drivers

Game owns all procedural motion via `ProceduralUnitRuntime` and humanoid/horse libraries (rigged-assets.md, lines
85–94). Runtime exports are **clip-free** (SKILL.md, line 11; Knight GOAL-PROMPT.md, line 155).

Root motion: on `pelvis` for foot troops, on horse mount root for riders. Bone forward axes: not specified in current
records; recorded per rig in Blender with rest pose axes.

### Helper/Twist Bones

Knight hand helper rig `KC_hand_rig`: fixed-length finger bones, rotation-only, local X is flexion axis
(ASSET-RECORD.md, line 173). No other helper/twist bones documented. Extra twist bones rejected in earlier iterations
(R4–R7 feedback, ASSET-RECORD.md, lines 88–93).

## 8. Open Conflicts or TODOs

### Knight

- **G3 Grip cant:** open decision on canting grip 15–20° (ASSET-RECORD.md, line 238). User approval pending.
- **Layered G2 approval:** visual review noted leather tone lighter/more orange than packet; steel tone differs between
  pieces (line 255). Open for G4 bake.
- **Left for G3:** hip panels split from chestpiece, boot shaft/foot split at ankle, hinge loops (line 256).

### Crossbowman

- **G1 status:** r5b raw meshes presented 2026-10-03; waiting for approval before editing. Slot mapping error fixed (r5a
  had profile swap) (ASSET-RECORD.md, line 23).
- **Decisions needed before spend:** trigger-hand seat (palm flat vs under stock's lower-right edge); body sharing with
  Knight; quiver length; budget approval (GOAL-PROMPT.md, lines 282–296).

### Paladin Rider

- **G2 status:** gear (worker acceptance checks on sword/shield), rein probe, coat renders pending user approval
  (ASSET-RECORD.md, line 87).
- **Mounted seat finalization:** rider scale against horse not yet confirmed; expected re-check at G3 with seated pose
  (ASSET-RECORD.md Paladin, lines 82–83).
- **Single rearward feather:** "Run as is, fix in Blender"; greave straps "Rebuild straps in Blender" (Paladin
  ASSET-RECORD.md, line 38).
- **Rein channel decision:** slot bore through left fist approved 2026-10-02; check required at G2 whether closed fist
  natural opening suffices or bore needed (GOAL-PROMPT-LAYERED.md, line 138).

### Shared Family Issues

- **Body sharing:** Knight and Crossbowman bodies initially same, then Crossbowman regenerated separately 2026-10-03;
  small differences not yet aligned. Paladin gets its own body (Paladin ASSET-RECORD.md, line 36; Crossbowman
  GOAL-PROMPT.md, line 290).
- **Test coverage:** Crossbowman and Paladin interchangeability with Knight sockets untested. Knight/Sword/Shield swap
  proven; other combinations marked untested (Knight GOAL-PROMPT.md, line 167).
- **Load-bearing clip allowances:** Knight defined explicitly (palm 5mm, fingers/thumb per joint, no show-through).
  Crossbowman/Paladin inherit same tolerances; no per-troop variance specified (Knight GOAL-PROMPT.md, lines 104–110).
