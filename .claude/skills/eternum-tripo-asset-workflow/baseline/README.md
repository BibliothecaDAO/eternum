# Human baseline

The shared structure for every Eternum humanoid troop under workflow v4 (`eternum-tripo-asset-workflow` 4.1.0): Tripo
supplies the look from one generation per character; this folder supplies the skeleton, the weights, the test and the
poses.

Read `CONTRACT.md` for the rules. This file says what is here and how to run it.

## What this folder is

The human baseline of the `eternum-tripo-asset-workflow` skill, shipped inside it so that the pipeline in `SKILL.md` can
be run from this repository with Blender and nothing else. It holds the tools, the reference body, the skeleton
contract, the pass thresholds, the pose library, the facts the contract rests on and a format example.

Not shipped, on purpose:

- `poses/refs/`: third-party reference photographs. Each pose's `sources` records the page and the licence, so the
  images are not redistributed. Fetch them from those pages if you need to look at one.
- The MakeHuman source files in `template/mpfb/` (`base.obj`, `tree.json`, `rig.game_engine.json`,
  `weights.game_engine.json`; CC0 but large). `template/template.npz` is the built result and is what every tool uses;
  `template/SOURCE.md` says where the sources come from and where to put them to rebuild it.
- The author's probe (`probe/`), review sheets (`review/`), skill history (`skill/`) and the template's own harness
  reports (`harness/template-*.harness.json`, written again by `tools/hb_selftest.sh`). The history sections below
  mention them.

Paths of the form `../t1-knight-claude/...` in the history sections point into the author's working tree (the Knight's
character folder). They are not in the repository. They are evidence references, not inputs.

## Running from the repository

**Prerequisites.** Blender 5.2 and the Python that ships with it (it has numpy). Nothing from the repository's Node
workspace is used; no `pnpm install`.

**Environment variables.**

| Variable          | Meaning                                           | Default                                                                                           |
| ----------------- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `HB_BLENDER`      | The Blender executable                            | `blender` (or `blender.exe`) on `PATH`; `hb_gate.py` takes the one beside the Python that runs it |
| `HB_PYTHON`       | Blender's bundled Python                          | `<Blender's folder>/<version>/python/bin/python*`, found from `HB_BLENDER`                        |
| `HB_SELFTEST_OUT` | Where `hb_selftest.sh` writes its harness reports | a new temporary folder                                                                            |

The shell tools (`hb_*.sh`) source `tools/hb_env.sh`, which reads these. Under WSL with a Windows Blender they turn the
paths they pass on into Windows form (`wslpath -w`) and name the variables they set in `WSLENV`. The Python tools find
their data relative to their own folder (`tools/hb_common.py`), so the checkout can be anywhere. Run a Python tool with
Blender's Python: `"$HB_PYTHON" tools/hb_harness.py ...` (with a Windows Python, give it Windows-form paths).

**A character's files live outside the repository.** Its working folder holds the raw mesh, the packet, the binds and
the exports. Its `char.json` (see `SPEC.md`) names every file by absolute path or by path relative to this folder; a
path starting with `/` or a drive or share is absolute (with a Windows Blender run from WSL, write it in Windows form:
`\\<host>\<share>\...`). The shell tools take paths on the command line, absolute or relative to the current folder, and
read the rest (work folder, helper joints, pose sets) from the spec.

**Order of the steps.** Check the tools: `tools/hb_selftest.sh`. Then the pipeline table below, top to bottom: step 0b
before any paid generation, steps 1 to 2 and the gate (`hb_gate.py`) for the bind, 8 for equipment, and 9 to 9h for
levels of detail, bake and export, which the five shell and check tools at the end of the table run in one go
(`hb_lod_build.sh`, `hb_items_build.sh`, `hb_export_all.sh`, `hb_export_check.py`, `hb_lod_review.sh`; `--help`-style
usage is the comment at the top of each). `SPEC.md` lists what a new troop's `char.json` must decide, and `SKILL.md`
(one folder up) says what each stage must show before the next begins.

## Contents

| Path                         | What                                                                                                                                                                                                                                                              |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CONTRACT.md`                | Frame, skeleton with helper joints and their runtime formula, binding rules, hands and sockets per troop, counts and budgets, mounts                                                                                                                              |
| `template/`                  | Reference body: MakeHuman/MPFB base mesh with its game-engine weights on the family joints (CC0; licence in `template/mpfb/`; where the sources come from: `template/SOURCE.md`). `template.npz` + `template.json`                                                |
| `harness/`                   | `thresholds.json` (pass criteria). The template's own harness reports are not kept; `tools/hb_selftest.sh` writes them again                                                                                                                                      |
| `poses/`                     | Pose library: `general`, `knight`, `crossbowman`, `paladin`, `mount` (133 poses), `SCHEMA.md`, `limits.json`, `index.json`, authors' notes. Each pose's `sources` names its reference and licence; the reference images (`refs/`) are not in this repository      |
| `tools/`                     | The pipeline (below)                                                                                                                                                                                                                                              |
| `probe/`                     | (not in this repository) Tripo probe on the baseline test subject: the single-generation Knight, auto-rig and segmentation results, `PROBE.md`, `credit-ledger.json`; `assess/ASSESSMENT.md` (why the test subject's armpits fail and what the views must change) |
| `facts/inventory.md`         | Extracted runtime and asset facts for the three T1 troops, with sources                                                                                                                                                                                           |
| `skill/`                     | (not in this repository) Skill text by version (`SKILL-v3.0.2.md` backup, `SKILL-v4.0.0.md` … ; the highest version is the installed copy); `CODEX-FOUR-VIEW-PROMPT.md` (the prompt that asks Codex for a troop's view packet)                                    |
| `examples/id-map/`           | Format example of flat-colour part-ID maps and their legend                                                                                                                                                                                                       |
| `examples/knight-arm-poses/` | The two scripts that measured the Knight's in-game arm poses from its approved pose set, and what they write                                                                                                                                                      |
| `review/`                    | (not in this repository) Pose sheets (probe renders are in `probe/review/`)                                                                                                                                                                                       |

## Pipeline

All tools run headless. Blender scripts run as `blender.exe -b --factory-startup --python <script>` with settings passed
in environment variables (list them in `WSLENV`). Numpy-only tools run with Blender's bundled `python.exe`.

| Step                         | Tool                                                                                                                                                                                                                                                         | Input → output                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0                            | `hb_selftest.sh`                                                                                                                                                                                                                                             | Rebuilds the template data, runs the harness on it, checks the pose library                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 0b                           | `hb_packet_check.py` (`HB_CHAR=<char.json>`)                                                                                                                                                                                                                 | Views and landmarks → arm angle, clearances, symmetry; must pass before any paid generation                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 1                            | `hb_char_import.py` (`HB_CHAR=<char.json>`)                                                                                                                                                                                                                  | Raw Tripo GLB + packet views, landmarks and part masks → `work/character.{npz,json,blend}`, label sheet                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 1b                           | `hb_guide_bore.py` (`HB_CHAR`)                                                                                                                                                                                                                               | Fits the guide bar's cylinder, removes only the bar and joins the two openings with a channel; rewrites `work/character.*`, report `work/guide-bore.json`. Optional before the bind gate; until it runs, the bar stays rigid on the hand                                                                                                                                                                                                                                                                                                           |
| 1c                           | `hb_label_refine.py` (`HB_CHAR`)                                                                                                                                                                                                                             | Hand patches from the spec (a patch may make a new soft class, e.g. `neck`); borders onto the texture's colour boundaries; every rigid piece's border onto the crevice where it meets its neighbours (`snap`); the underside of a cuff's lip given to the cuff (`seam_sides`); rim crevices cleaned; surface hidden at rest recoloured from its visible surroundings. Rewrites `work/character.*` (keeps `character-prerefine.*`), writes `work/rest-visibility.npz`                                                                               |
| 1d                           | `hb_border_cut.py` (`HB_CHAR`)                                                                                                                                                                                                                               | Closes slits and notches, cuts the mesh along a smoothed border for every rigid class and every over-garment edge, then relabels stray islands; rewrites `work/character.*`, report `work/border-cut.json`. Steps 1c and 1d are not repeatable on their own output: start again from `work/character-bored.*` (the mesh as imported and bored; copy `character.*` there once)                                                                                                                                                                      |
| 2                            | `hb_bind.py` (`HB_CHAR`, `HB_HELPERS=elbow_half,knee_half`, `HB_TAG`)                                                                                                                                                                                        | Labels and template → closed rims dressed, split with underlay (strips, tubes, skirts), shoulder padding and lining, cuffs, weights, clearance under every plate, everything generated hidden at rest; `work/bound-<tag>.{npz,json}`, harness and contact reports                                                                                                                                                                                                                                                                                  |
| 3                            | `hb_harness.py <bound.npz> --sets rom,general,<troop> --poses <poses dir> --helpers …`                                                                                                                                                                       | Numbers per pose and worst-case summary; `--explain <pose id>` lists that pose's most stretched edges with their classes and weights                                                                                                                                                                                                                                                                                                                                                                                                               |
| 3b                           | `hb_contact.py` (`HB_BOUND`, `HB_HELPERS`, `HB_SETS`, optional `HB_REBIND`)                                                                                                                                                                                  | Per plate and per pose: soft surface through the plate (share, depth) and the plate lifting off what it covered (gap). A vertex is under a plate when it lies behind one of its faces with a clear line to it and the first plate face on that line is met from behind. `HB_REBIND` binds rigid classes to other joints for candidate tests                                                                                                                                                                                                        |
| 4                            | `hb_pose_render.py` (`HB_BOUND`, `HB_POSES`, `HB_TEX=<character.blend>`, `HB_HELPERS`)                                                                                                                                                                       | Pose sheets, textured or class-coloured                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5                            | `hb_seam_audit.py` (`HB_CHAR`)                                                                                                                                                                                                                               | Every border between pieces that move differently; flags rigid-on-rigid seams and says whether the bind will run a cuff through each                                                                                                                                                                                                                                                                                                                                                                                                               |
| 6                            | `hb_gap_check.py` (`HB_BOUND`, `HB_HELPERS`, `HB_SETS`)                                                                                                                                                                                                      | See-inside check: per joint and pose, the share of what is seen that is the inside of a surface (a gap; a hole in a one-sided renderer), above the rest pose                                                                                                                                                                                                                                                                                                                                                                                       |
| 7                            | `hb_rest_check.py` (`HB_CHAR`, `HB_BOUND`)                                                                                                                                                                                                                   | Rest-pose identity, by rays (no rendering): at every joint, from six sides, what a grid of rays meets first on the mesh as generated and on the bound mesh at rest. A ray differs when the surface is more than 1.5 mm nearer or further or its colour differs by more than 0.12; only patches count (three of a ray's eight neighbours differ too). Limit: 0.5% of what is seen at any joint from any side                                                                                                                                        |
| 8                            | `hb_gear.py` (`HB_CHAR`, `HB_BOUND`, `HB_GEAR=<gear.json>`, `HB_HELPERS`, `HB_SETS`)                                                                                                                                                                         | Fits removable items to their sockets on the bound character at rest (a handle on the bored guide axis; a plate on a forearm), measures the fit, and poses the troop's own sets to find where an item is in the body or in another item. Writes `work/gear-fit.json` (the sockets) and `<bound>.gear-clash.json`                                                                                                                                                                                                                                   |
| 8b                           | `hb_item_aim.py --char … --bound … [--fix] [--place] [--clear] [--hold] [--give 30] [--only …] [--src …] [--out …]`                                                                                                                                          | Numpy only. Measures the angle between where each item points and where each pose's `items` entry says it should. `--place` solves a whole arm from an item's stated place and direction (`"at"`); `--fix` corrects an authored arm wrist first; `--clear` moves either arm to take the body out of the items (`--hold` keeps placed items in place); `--give` lets a direction give way and rewrites it. Writes `work/item-aim.json`                                                                                                              |
| 8c                           | `hb_pose_facts.py --char … --bound … [--sets …] [--out …]`                                                                                                                                                                                                   | Numpy only. Per pose: the gripped item's hand height against the body's landmarks, its angle and tip; a forearm item's rim heights against eye and knee; the nearest the two come. For checking each pose's text against what the pose has                                                                                                                                                                                                                                                                                                         |
| 9                            | `hb_reduce.py --char … --bound … --faces 13500,4500 --names near,mid --bend 20,10`                                                                                                                                                                           | Numpy only. The bind reduced to each triangle budget by merging edges, every kept vertex a vertex of the bind with its weights and class. Linings of plates are built again from each level's reduced plate, and plates named under `"reduce": {"mouths": […]}` get their open rims closed. Writes `work/reduced-<name>.{npz,json}` in the bind's own form. Rules and why: "Reducing, baking and exporting" below                                                                                                                                  |
| 9b                           | `hb_tuck.py` (`HB_BOUND`, `HB_LOW`)                                                                                                                                                                                                                          | Moves generated surface that the reduction's flatter faces have left in front of the piece that covered it back behind that piece (0.6 mm). Rewrites the reduced file                                                                                                                                                                                                                                                                                                                                                                              |
| 9c                           | `hb_lod_see.py` (`HB_BOUND`, `HB_LOW`), `hb_lod_backs.py` (same)                                                                                                                                                                                             | At rest, from eight sides, ray by ray against the bind: hidden surface showing, another piece showing, outline lost or gained (limits `reduced_see` in `harness/thresholds.json`); and how much of what the bind shows the reduction meets back-first (a lining in front of its plate)                                                                                                                                                                                                                                                             |
| 9d                           | `hb_lod_check.py --char … --reduced … --bound … --helpers …`; `hb_gap_check.py` with `HB_BOUND=<reduced npz>`                                                                                                                                                | The pose harness and the see-inside check on the reduction: rigidity, influences, thickness kept, stretch and collapse (limits `reduced`), and holes in poses (the bind's own limit)                                                                                                                                                                                                                                                                                                                                                               |
| 9e                           | `hb_bake.py` (`HB_CHAR`, `HB_HIGH=<bind>`, `HB_LOW=<reduced>`, `HB_RES`)                                                                                                                                                                                     | One material for the reduction: a texture layout (the bind's own pieces kept where a reduced face lies on one), and colour, ORM and normal maps carried over from the bind. Writes `work/baked-<name>.{npz,json}` and three PNG files                                                                                                                                                                                                                                                                                                              |
| 9f                           | `hb_item_prepare.py` (`HB_CHAR`, `HB_ITEM`)                                                                                                                                                                                                                  | A removable item put into the bind's file form (`work/items/<name>/item.{npz,json}`, its three images under `tex/`), so steps 9, 9e and 9g take it                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9g                           | `hb_export.py --char … --baked <stem> --out <glb> [--helpers …] [--item --joint …]`                                                                                                                                                                          | Numpy only. Writes the GLB directly: game frame, family joint order with helpers last, world-aligned rest frames, four influences, authored normals, the bake's tangents, one material with the three images embedded. Report beside it (`<glb>.json`)                                                                                                                                                                                                                                                                                             |
| 9h                           | `hb_runtime_fit.py --char … --bound … --gear-fit … --helpers … --out …`                                                                                                                                                                                      | Numpy only. What the game needs beside the files, in the game's frame: joints, helper rules and axes, each item's socket as offset and quaternion, three knuckle points per hand and the way the palm faces, heel and toe lengths                                                                                                                                                                                                                                                                                                                  |
| **all**                      | **`hb_gate.py --char … --tag … --out … [--build] [--before …]`**                                                                                                                                                                                             | **Steps 1c to 7 and every review render in one run, with one summary against `harness/thresholds.json`. Run it with Blender's own Python; it starts Blender where needed and falls back to CPU rendering when no graphics context is available. This is the command a troop session uses**                                                                                                                                                                                                                                                         |
| **9 to 9h, in one run each** | **`hb_lod_build.sh --char … --bound …`**; **`hb_items_build.sh --char … --item name:faces:fold …`**; **`hb_export_all.sh --char … --bound … --out … --skin-name … --item name:joint:gltf-name …`**; **`hb_export_check.py --char … --export … [--items …]`** | Steps 9, 9b, 9c, 9d and 9e for every level (reduce, tuck, rest checks, pose checks, bake; defaults are the Knight's: budgets 13500 and 4500, `--weigh head:30,hand_l:6,hand_r:6`, `--bend 20,10`); steps 9f, 9, 9e for each removable item (500 or 1000 triangles, 512 px, `HB_ORM=keep`, `HB_LOOKUP=normal`, a per-item `HB_REDUCE_FOLD_RIGID`); steps 9g and 9h for every file plus `MANIFEST.json`; then the check that reads the files as a game would and poses them against the baseline's skinning. Numpy only apart from the Blender steps |
| 9i                           | `hb_lod_review.sh --char … --bound … --level <bind\|near\|mid>`                                                                                                                                                                                              | Review sheets of one level, the same frames for every level so they can be laid side by side                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

Libraries: `hb_lib.py` (skeleton, pose solver, skinning, range-of-motion set), `hb_helpers.py` (helper joints and
derived weights), `hb_split.py` (plate split and underlay), `hb_render.py`, `hb_sheet.py`, `hb_common.py`. Probe-only:
`hb_probe_view.py`, `hb_tripo_rig_eval.py`.

A character is described by a `char.json`: raw GLB, packet folder and views, manifest with landmarks, the labels, and
every per-character decision the bind needs. **`SPEC.md` lists every key and what to decide for a new troop.** Two label
forms are supported:

- **Packet legend** (current packets; see `../t1-knight-claude/v4/char.json`): `labels.legend` names the packet's
  `id/legend.json` and `labels.id_png` names one flat-colour ID map per view. The legend needs no catch-all class.
  `labels.overrides` holds per-character corrections to the legend decided at the bind gate, as
  `{"class name": {"kind" | "bone" | "region": …}}`.
- **Inline classes with mask layers** (the baseline test subject; see `probe/knight-worn/char.json`): the class table
  and the mask files that compose each view's ID map.

Front and back ID maps vote first. A profile map can only confirm a class where the front and back views place it
(within the class's left-right extent), so a drawn arm that covers the torso in profile cannot relabel the torso.

## What has been proven

On the reference body (range-of-motion set, 56 poses):

| Measure at full flexion                          | 25 joints | With `elbow_half`, `knee_half` |
| ------------------------------------------------ | --------- | ------------------------------ |
| Elbow, thickness kept on the outside of the bend | 0.73      | 0.94                           |
| Knee, thickness kept on the outside of the bend  | 0.66      | 0.89                           |

On the baseline test subject (one Tripo generation of the complete worn Knight, 76k triangles, bound as generated with
no repairs; reports in `probe/knight-worn/work/bound-a8.*`), over 122 poses (range of motion, general set, knight set):

| Measure                                                      | Result                                                                                     | Same raw mesh with Tripo's own auto-rig (range-of-motion set only) |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Plate distortion (edge-length change inside any rigid piece) | 0 in every pose                                                                            | up to 25×                                                          |
| Elbow, thickness kept outside the bend (worst pose)          | 0.96 (0.75 without helpers)                                                                | 0.55                                                               |
| Knee, thickness kept outside the bend (worst pose)           | 0.94 (0.76 without helpers)                                                                | 0.54                                                               |
| Influences per vertex                                        | at most 4, none unweighted                                                                 | —                                                                  |
| Cloth and leather stretch (99.5th percentile edge)           | median 2.0× per pose; worst 4.4× with arms overhead                                        | 5.7× worst                                                         |
| Soft surface coming through a plate                          | 4.6% of under-plate vertices in the median checked pose (20 range-of-motion poses checked) | —                                                                  |

- Part labels from the packet's own masks identified every armour piece from the front and back views alone
  (`work/SHEET-labels.png`).
- Weights for cloth and leather come from the template; nothing was painted or solved from the armature.
- Pose sheets: `review/poses/SHEET-knight-a8-rom.png`, `…-knightset.png`, `…-generalset.png`.

**Not yet passing:** stretch is over the provisional threshold in 43 of the 122 poses, poke-through is over it in most
checked poses, and triangle-area collapse is just under its limit in the full squat (0.236 against 0.25). Both
concentrate where label borders are jagged and at the shoulders and hips. The worst stretched edges are armpit welds
whose two sides differ in weight by less than the bridge threshold (`hb_harness.py … --explain arm-p90-e170` lists
them). That is stage 6 work for the Knight (side-view labels, border smoothing, joint choice for the pauldrons), and the
thresholds themselves are first estimates.

## Correction, 2026-10-05: seam welding

A GLB stores a vertex once per texture chart, so an imported mesh is cut along every texture seam. Until 2026-10-05 the
import kept those cuts, and labels, weight smoothing, bridge-face detection and the stretch measure all worked chart by
chart. `hb_char_import.py` now welds coincident vertices (UVs are per face corner and unaffected). The test-subject
figures in the table above were measured before the fix. Re-run on the welded mesh (`probe/knight-worn/work-welded/`,
range-of-motion set): 18 welds removed, 15 of 56 poses over the stretch limit, worst 5.06×, elbow and knee 0.96, plates
rigid, poke-through 3.8% median. The first troop on this basis is the v13 Knight
(`../t1-knight-claude/v4/review/GATE-R.md`): 0 welds, 10 of 56 poses over, worst 3.98×.

## Corrections, 2026-10-05: pose solver, pivots, labels

Found on the v13 Knight after the user reported shrugged shoulders and arms leaving their sockets. Evidence and
before/after figures: `../t1-knight-claude/v4/review/GATE-B.md`.

- **Collarbone.** The pose solver raised the clavicle by a third of the arm's absolute elevation, up to 45°: a 24 mm
  shrug at 90° of abduction on a 0.6 m figure, and a shrug in every pose with the arm above 30°, including poses below
  the rest pose. It is now one sixth, at most 18°, counted from the rest pose.
- **Leg twist.** The solver took any angle between the rest thigh and shin as knee flexion. On a wide-stance mesh that
  angle is sideways, and the whole leg was twisted about the thigh (68° on the Knight: toes in, feet crossed, thigh pads
  at the front). It now uses the shin only when it leaves the thigh line mostly backward.
- **Impossible poses.** Several poses put limbs through each other. `arm-cross` and `hip-rot` are now one limb at a
  time, the turned-in arm pose uses opposite turns, the wrist-flex pair holds the arms slightly out, and
  `general/deep-squat` and `knight/backhand-cut-windup` were adjusted. `hb_lib.limb_clearance` measures it and
  `hb_pose_check.py` rejects library poses whose limbs intersect on the reference body; it flags
  `crossbowman/aim-crouch` (legs), still to fix.
- **Pivots.** The import now moves shoulder, elbow, wrist and hip onto the limb's own centreline (see `CONTRACT.md`).
- **Labels.** Faces no view saw, and a band along every class border, are now settled by growing labels over the surface
  with creases as barriers, so borders settle on plate rims.
- **Bind.** The armpit gate fades in over 20 mm instead of cutting at one height; weights that change faster than a full
  swap over 12 mm are smoothed locally; a class can ask for a full underlay.
- **Harness.** Stretch is also reported weighted by edge length (`stretch_len_p995`), because generated meshes pack
  sub-millimetre edges into creases. Thresholds are unchanged and still read the count-based figure.

All figures in this file dated before 2026-10-05 were measured with the old solver and are not comparable with later
ones. The reference body after the changes: elbow 0.94, knee 0.89, worst stretch 1.79× (range of motion) and 1.74×
(general and knight sets).

## Corrections, 2026-10-06: shoulders, borders, guide bar

After the user rejected the Knight's first bind gate (gaps under the shoulder plates, torn fragments, a damaged right
hand). Evidence: `../t1-knight-claude/v4/review/GATE-B2.md`.

- **Guide bar.** The bind used to delete every face touching a guide-labelled vertex, which left a stub of the bar and
  cut pieces out of the fist. A guide now stays on the mesh, rigid on its hand, until `hb_guide_bore.py` removes exactly
  the bar (cylinder fit) and leaves a channel.
- **Borders.** Labels follow whole triangles, so plate borders were saws. `hb_border_cut.py` cuts along a smoothed
  border (Knight: rigid borders 8.3 m to 6.2 m long). The import also removes saw teeth by perimeter majority.
- **Arms.** Profile ID maps no longer vote on arm pieces or on faces on the arm; they were streaking the tops of the
  arms with the wrong class.
- **Shoulder plates** are built in two layers: a closed shell, steel inside and out, over soft leather padding that is
  part of the body (see `CONTRACT.md`). A first version, padding riding fully with the plate, closed the shoulder with
  the arms down but tore into sheets with the arms up; the Knight's stretched area at the shoulders (soft faces over 3×,
  mean of 123 poses) went from 44 cm² to 13 cm² with the stretch-limited rule, for 1.5% against 1.0% of under-plate
  vertices through the plate (`../t1-knight-claude/v4/work/ride-candidates-t15.json`).
- **Closing.** Before the cut, slits, notches and holes in rigid pieces are closed (shoulder plates harder), and an
  underlay can no longer lie on top of its plate.
- **Influences.** Helper weights are pruned to four influences.
- **Islands.** The border cut now relabels stray islands (Knight: 12, among them a hole in the right shoulder plate and
  three stiff breastplate fragments on the back).
- **Underlay** takes the colour of the garment it continues. It was flat dark, and read as a hole where a raised arm
  pulled it out from behind a plate.
- **Shoulder-plate joint.** Plates are bound to `upperarm_twist`: where the arm points plus 40% of its roll (31 joints
  for troops with shoulder plates; see `CONTRACT.md`). Earlier in the same rework four families of shoulder helpers were
  tested and rejected on a score that only counted cloth through steel; an independent visual review then showed plates
  on `upperarm` turning inside out in every guard pose.
- **Thresholds** were recalibrated from the Knight at the user's decision: stretch 3.4× (range of motion) and 3.3× (pose
  library), triangle collapse 0.22; poke depth is reported but no longer a limit.
- `hb_lib` gained `azel_rotation`, the `upperarm_swing` helper and helper positions (`helper_pos`); `hb_pose_render.py`
  renders `rest:rest`, flat-coloured classes, a framing box and a cell size.

## Corrections, 2026-10-06 (second pass): every joint

After the user asked for the wrists and all other joints to be checked and built out. Evidence:
`../t1-knight-claude/v4/review/GATE-B3.md`.

- **Seam audit.** Every border between pieces that move differently is listed first
  (`../t1-knight-claude/v4/scripts/k4_joint_audit.py`). On the Knight the rigid-to-rigid seams were bracer to hand
  (about 100 mm each, with no surface under them) and breastplate to belt buckle (about 25 mm, left alone).
- **Joint fill** under such seams (a plain tube; a first version that copied the pieces' own bands crumpled), **underlay
  laid on the template body** under every rim (was a relaxed membrane), and **shoulder padding laid on the template
  body** (was the plate's own shape).
- **Labels follow the texture** (`hb_label_refine.py`): the pauldrons' front trim corners were labelled sleeve, strips
  of tunic were labelled leather, and the cream band at the back of the neck was labelled head.
- **Rim crevices** are cleaned of mixed labels. **Wrist seams** are straightened: a cuff's inner lip was labelled hand.
- **Stiff over-garments** stay off the arm (`follow_arm`), with the sleeve doing the stretching. Cutting the cuirass
  free of the sleeve was tried and dropped.
- **Contact report** separates surface through the steel from surface slipping out past a rim, and lists every pose and
  plate where the first is deeper than 10 mm (`flags`). Reported, not a limit.
- **Joint close-ups.** `hb_pose_render.py` can frame a cube on a joint where the pose puts it (`HB_FOCUS`,
  `HB_FOCUS_SIZE`).

## Corrections, 2026-10-06 (third pass): neck, wrists, and a gate that checks itself

After the user sent the third gate back for the neck and wrists and asked for changes that spare later troops the same
rounds. Evidence: `../t1-knight-claude/v4/review/GATE-B4.md`.

- **Borders snap to crevices** (`hb_label_refine.snap`). The underside of the helmet's rolled rim was labelled collar
  and stayed on the neck as a dark ring when the head tipped; a cuff's inner lip was labelled hand. Each rigid piece's
  border now floods to the floor of the crevice where it meets its neighbours (mean ray distance, not the share of
  blocked rays, which is flat under a rim), or to the colour edge, or stays put.
- **Hidden surface is recoloured** from its nearest visible surroundings (`inpaint_hidden`), so what a lifted rim
  uncovers has no baked shadow. Faces visible at rest are never touched.
- **Wrist cuff** (`hb_split` joint fill, fourth form): starts on the hand's own edge with the hand's weights, runs 14 mm
  into the bracer narrowing, goes over to the forearm's weights, and carries the sleeve's texture. Forms that failed:
  copies of the pieces' bands (crumpled), a skin tube inside the seam (a plug), rings of the seam's full outline (came
  out through the cuff band and the back of the hand at rest).
- **Neck**: the underlay under a helmet is skin from the rim.
- **Shoulder padding** carries the leather's own grain, laid out from the top of the dome (`padding_uv` mode
  `azimuthal`).
- **Checks that would have caught each round**: `hb_rest_check.py`, `hb_gap_check.py`, `hb_seam_audit.py`, and
  `hb_gate.py`, which runs everything and renders every joint, textured and in label colours.
- **Depth through the steel** is a limit: 15 mm for armour plates in pose-library poses (user decision).
- **CPU rendering** (`HB_ENGINE=CYCLES`): EEVEE crashes in background mode when Windows gives Blender no graphics
  context.

## Corrections, 2026-10-06 (fourth pass): a neck that is a neck, clean rims, checks that measure what they say

Same round as the third pass, after reading the neck and wrist close-ups with the joints bent. Evidence:
`../t1-knight-claude/v4/review/GATE-B4.md`.

- **The throat is soft.** The packet's `head` class ran down the front of the neck to the collar; rigid on the head it
  swung out under the chin as a flap when the head tipped back. A spec patch can now make a class the legend lacks
  (`"class": {"kind": "soft", "region": "head"}`); the Knight's throat below the jaw is `neck`.
- **Tube under a rim that runs right round a limb** (`"underlay": "tube"`, `hb_split`): five rings from the welded rim
  into the piece, narrowing to 62% of the rim's outline (the first ring already 8% in), following the piece's joint from
  the second ring, skin-coloured from the rim. The strip underlay (the rim's own faces copied onto the template body)
  kept the helmet's rolls and flaps as steps and stood proud of the collar wherever the template's neck was wider than
  the character's.
- **Skirt**: faces from a tube's or cuff's rim (the piece's own copies of the rim vertices) to a ring that follows the
  piece's joint, facing inward. It closes the underside of a helmet or cuff, which a one-sided renderer otherwise draws
  as a hole.
- **Closed rims are dressed** before the cut: the rim's vertices move onto its own outline smoothed round its axis (by
  angle; smoothing along the rim does nothing to a rim that zigzags up a crevice wall). Seams between rigid pieces: at
  most 2 mm. Tube rims: only as far as each vertex is hidden at rest, at most 6 mm, with that share smoothed round the
  rim (moving every other vertex made a saw of it).
- **Cuff lips** (`hb_label_refine.seam_sides`, on by default): body-part faces within 6 mm of a closed seam that face
  the seam's axis are the underside of the other piece's overhanging lip and go to that piece. On the Knight about 90
  such faces per wrist were labelled hand and left with the hand as a ring of shards.
- **Hidden at rest, by faces** (`hb_split.hide_at_rest`): points across every generated face are tested; a face with a
  point in front of an original surface moves into the body (against the fitted template's normal) until it is covered.
  Holding vertices under the nearest surface left faces spanning crevices in front of their floors. Moving along the
  face normal walked vertices out through thin rims; tapering the moves into their surroundings drew thousands of
  vertices into the gaps between layered surfaces. Both were tried and removed.
- **Sheets sink as sheets.** Shoulder padding and the strips under rims are seen whole when a plate turns away or a rim
  lifts. Pressed under the nearest original surface vertex by vertex, padding took on every strap edge beside the plate
  and showed as a crumpled, spiked shoulder top whenever the arms hung down. They are no longer pressed; `hide_at_rest`
  moves them (padding and strips only, not tubes or cuffs) and spreads every move into its surroundings.
- **Crevices are ironed** (`hb_split`, `HB_IRON_CAP`, 4 mm): soft surface within 6 mm of a rigid piece's border that
  nothing outside can see at rest relaxes toward its surroundings before the cut. As generated, cloth runs up a rim's
  wall to meet it and stands round the opening as a torn edge when the plate lifts.
- **Linings on request** (`"lining": true`): a greave's knee top lifts off the knee and shows its inside. With linings
  on the greaves no joint in any pose shows a hole (below).
- **Holes, not insides** (`hb_gap_check.py`): the check now follows each ray on through surfaces seen from behind and
  counts a hole only where nothing is then met from the front inside the joint's cube. A neck inside a helmet closes the
  view; the first measure counted it as open. Limit: 3% of what is seen at a joint (`see_inside.max_hole_share`). A hole
  ray counts only with another beside it (one ray through a crack between two faces flipped a knee from pass to fail
  between two identical builds). Knight: third gate 12.2% at the neck and 12 joint-poses over 3%; now 2.3% worst and
  none over.
- **Hidden surface is recoloured only where a piece covers it** (`inpaint_hidden`): within 15 mm of a rigid border along
  the surface, or in a crevice. The first version recoloured everything no ray could leave, and the skirt behind a fist
  held at the hip became one flat blotch that showed when the arm moved.
- **Authored normals** (`hb_lib.corner_normals`, stored in the bind as `CN`, one per face corner): the surface as
  generated is shaded smooth across every border the bind cuts. Normals recomputed after the cut stop at each cut, and a
  cut across smooth surface (a jaw) shows as a dark line in the rest pose. Corners of original faces at one rest
  position share one normal, whatever piece they belong to; generated faces get their own class's. `hb_pose_render.py`
  rotates them with each corner's joints, as a game does. The export must carry them.
- **Open only to the ground** (`hb_label_refine.camera_hidden`): a face beside a piece that none of 17 camera directions
  (level and from above, none from below) can see is recoloured like hidden surface, and a hidden face with no visible
  face of its own class within reach takes the nearest visible face of its kind within 20 mm. The crevice under the
  Knight's helmet rim was baked near black and visible only from below; it showed as a black gash when the rim lifted.
  The same test lets rim dressing and ironing move what only the ground can see.
- **Review renders are one-sided** (`hb_render.one_sided`, `HB_ONE_SIDED`, on by default): back faces are not drawn, as
  in the game (a glTF material is one-sided unless it says otherwise, and the game does not override that for units).
  Two-sided renders hid every hole and showed the backs of linings and skirts as dark bands over necks and cuffs.
- **Cuffs are plain** by default: one light tone of the garment. Laid out from the sleeve's own texture they came out
  grey and striped.
- **Tube rings get rounder with height** (the outline is smoothed over 8, 14, 22, 32 and 45 mm), and the neck's skin
  takes a lighter tone of the face (`underlay_tone`).
- **Cuff rings** (`hb_split`, fifth form): depths 0.3, 5, 9 and 14 mm with 100, 60, 25 and 0% on the body part's joint,
  so no ring overtakes the next when the wrist closes 30 degrees on that side (at 3 and 7 mm the first ring passed the
  second and the strip between folded into a dark crease). The inner rings follow the seam's smoothed outline, every
  ring goes round the axis in one direction (a seam that doubles back gave a bow-tie: a black line across the cuff), and
  the inner rings are never moved after they are built. The skirt under a cuff takes the cuff's cloth colour.
- **A strip's free edge must stay under its plate.** The strip under a greave's knee top was 30 mm deep; at a 90 degree
  knee the knee had left the greave by more, and the strip's jagged inner edge showed as see-through teeth.
  `underlay_width` 0.06 for the greaves. Sinking a strip is also capped by its distance from the welded edge
  (`HB_UNDER_SLOPE`), so it leaves the weld as a slope and not a cliff.
- **Strips are relaxed** (`hb_bind`, `HB_UNDER_SMOOTH`, 8 passes): a strip under an open rim is a copy of the plate's
  rim faces and keeps the rim's roll and rivets as folds. Where the rim lifts in the open (the breastplate's lower edge
  when the back bends) the folds showed as a crumpled band with dark holes. After the clearance fit each strip vertex
  relaxes toward its neighbours, welded edge fixed.
- **Tried and dropped, 2026-10-07: a swept strip** (rings stepped in from an open rim's border and laid on the template
  body, as the tube does for a closed rim). Swept along the plate's own surface it ran outward under the rolled rim and
  left a hole; swept toward the plate's interior it came out through the plate. Not in the tools. A clean construction
  for open rims is still wanted.
- **Repaint, on request only** (`labels.repaint`): every face of a class takes one plain texel of another class's
  colour. It changes surface that is visible at rest, so it is the user's decision and the rest check fails there by
  design. Built for the Knight's throat (the generator painted a shadow under the chin).
- **Tried and dropped, 2026-10-07, in the hidden recolour:** taking colours only from surface in the open; recolouring
  ground-only surface only where it is near black; giving each face its neighbourhood's median colour; evening the
  result among neighbours. Each made the collar under the Knight's helmet worse than plain nearest colour: a patchwork
  of cream and brown spikes where two materials meet under the rim, in place of one dark band. None is in the tool.
- **Clearance under every plate**: the fit that sinks shoulder padding where its plate would cut through it now also
  sinks the underlay strips under every other plate (`HB_UNDER_CAP`, 10 mm). The body bending under the rigid
  breastplate brought its underlay out through the rim in 15% of the vertices under it in `hit-front`.
- **Under a helmet, colour from the weld**: an `underlay_colour_depth` of 0 now means from the rim itself. The first
  ring of faces had taken the collar class's typical colour, which on the Knight is the brown of the collar's front
  tabs, as blocks on the back of the neck.
- **Contact: what counts as under a plate.** A plate's upstanding lip is a sheet whose two sides are a fraction of a
  millimetre apart. To a strap beside it the nearest face could be either; when it was the far one, the strap counted as
  under the plate and read as 20 mm through the steel once the plate turned, with nothing changed in the renders.
  Membership now needs a clear line to the plate and the first plate face on it met from behind. Numbers from before
  this change are not comparable; the Knight's earlier binds were recomputed.
- **Gate runner**: the engine probe wrote its test image to a relative path and always chose CPU rendering; a long
  before/after job exceeded Windows' command-line limit. Both fixed. `--only beforeafter` remakes the before/after
  sheets alone.

## Equipment on sockets, 2026-10-07

Stage 7 for the Knight. Evidence: `../t1-knight-claude/v4/review/GATE-E.md`, `../t1-knight-claude/v4/gear.json`,
`../t1-knight-claude/v4/work/gear-fit.json`.

- **An item is a separate object that follows one joint.** Its socket is a fixed transform in that joint's frame. The
  baseline's joints have world-aligned rest frames, so the socket is the item's rest matrix with the joint's rest
  position taken off (`socket_in_joint_frame` in `gear-fit.json`). A character names its gear spec with `"gear"` in
  `char.json`; the gate then fits, checks and renders the items (`SPEC.md`, "Gear spec").
- **Grip fit** (`"fit": "grip"`): the handle goes on the bored guide's axis, the blade leaves the fist on the thumb
  side, the edge faces the wrist, the guard stops a set gap in front of the fist. Measured: deepest hand vertex inside
  the item, the blade's angle to the forearm, and round the fist whether the handle is covered, seen through an opening
  between fingers and palm, or stands proud of the hand's surface.
- **Forearm fit** (`"fit": "forearm"`): the plate's rear is seated on the forearm's outward side, leaning with the
  forearm, sunk by `clip` at the first point it meets. It follows the forearm joint, so nothing a wrist does can move
  it.
- **The fitted sword is not at 90 degrees to the forearm.** On the Knight the bored guide axis puts the blade 67 degrees
  from the forearm. The pose set had been aimed with a stand-in socket at 90 degrees and a shield that turned with
  forearm roll, so every blade pointed 23 degrees off and every shield face off by an amount that depended on the roll
  (61 of 74 directions over 12 degrees).
- **A fist that holds a bar is a hammer grip, and a hammer grip limits the poses.** With wrist deviation the blade can
  be 42 to 87 degrees from the forearm and no nearer its line. A blade in line with the arm cannot be had: a straight
  thrust at shoulder height, a blade straight up on a straight arm, a point-down rest. Aiming a pose that asks for one
  of these does not fail; it finds the one contorted arm that does it (a fist in front of the face with the blade
  hanging down the chest, for an at-ease pose). Restate such poses to what the grip can do.
- **Author an item pose as a place and a direction, not as arm angles.**
  `"items": {"sword": {"blade": [f, l, u], "at": {"joint": "pelvis", "offset": [f, l, u]}}}`: where the item's origin
  is, from a joint, in statures, and where it points. `hb_item_aim.py --place` solves the whole arm from that: a grid of
  upper-arm and elbow positions ranked by where they put the item, the best refined over every arm target, with a charge
  for a wrist or a roll near its limit so that the easiest arm wins and an intent only a wrung arm can meet is met less
  exactly. Places are rough (20 mm costs as much as 4 degrees). The first attempt kept each authored arm and corrected
  it wrist first; the numbers passed (every direction within 12 degrees, nothing in the body) and a cold review found 13
  of 24 poses not doing what their names say. The second placed 19 items; a second review still found a dozen poses off
  their own descriptions. The third placed 29 items in 25 poses and restated 19 descriptions.
- **Check each pose's text against measured facts before anyone looks.** `tools/hb_pose_facts.py` prints, per pose, the
  sword hand's height against the body's landmarks (hip, waist, ribs, shoulder, eyes), how far it is from the chest, the
  blade's angle, the shield's rim heights against eye and knee, and the nearest the blade comes to the shield. The
  second cold review found a dozen poses whose items did not sit where their own descriptions said (a hand "at shoulder
  height" at the waist, a shield "covering the head" below it, a rim "on the ground" at the knee); every one was visible
  in this table. Where the body cannot do what the text says (the Knight's shield is 0.42 of a stature across: its lower
  rim cannot be on the ground with its top at a kneeling fighter's eye level), the text is restated; where it can, the
  item is placed again.
- **Three cameras for a pose with items, not two on one diagonal.** Front-right and back-left three-quarter views lie on
  one diagonal; an arm flung out along it is foreshortened in both and reads as tucked in front of the belly. The gate
  now renders front-right, back-right and back-left.
- **Keep a gap between items.** A blade whose tip stops 3 mm from a shield's rim measures clear and reads as touching.
  Making room keeps 8 mm between one item's axis and the other's stand-in (`--gap`); on the Knight the real surfaces
  still come within 4.4 mm in one pose, so the gap wants measuring on the meshes.
- **The shoulder may extend.** `poses/limits.json` allowed the plane of elevation no lower than −40, so no arm could go
  straight back: not in a walk, not with a hilt at the hip and the elbow behind the body. It is now −90 while elevation
  is at most 50.
- **Inside a thin item, count crossings.** Deciding "inside" by which side of the nearest face a point is on reads a
  point 30 mm past a blade's edge as 30 mm inside it. `hb_gear.inside` counts crossings along two rays.
- **Body vertices inside an item miss a blade run through a torso.** A blade is 3 mm thick: it holds few vertices
  however far it goes in. The measure that shows it is the other way round: how much of the item's length is inside the
  body (`item_inside_body_span_mm`; a point is inside when at least 12 of 14 rays from it meet a surface from behind
  first, because the body is layered and open at its borders and parity does not work on it). On the Knight, version 1
  aimed for direction only had 115 to 130 mm of the sword inside the body in three poses.
- **Making room** (`hb_item_aim.py --clear`): either arm moves, within 30 degrees of the arm it started from (plane,
  elevation and elbow; rolls and wrist are free inside their limits), wherever that lowers the count of body in the
  items and items in the body, while every item stays within 12 degrees of its direction, a placed item within 25 mm of
  its place (`--hold`), and no limbs cross. `--give` lets a direction give way and rewrites the pose's `items` entry.
  The score is a numpy stand-in, so the result is always measured again with `hb_gear.py` on the real meshes; for the
  Knight's set the stand-in needed its strictest setting (`--behind 0 --votes 4 --every 1`) to see a blade grazing a
  thigh.
- **A big shield on a short arm does not go over the head.** The centre of the Knight's shield can rise about 0.27 of a
  stature above the shoulder joint and the helmet's crown stands 0.23 above it, so a shield laid over the crown passes
  through the helmet. `shield-raised-overhead` was restated to a shield above and in front of the brow.
- **The general set is not for equipment.** It is the family's body test; with the arms hanging, a shield on the forearm
  stands in the thigh. Items are checked on the troop's own sets.
- **A second, canted grip in the same fist was measured and is poor value**
  (`../t1-knight-claude/v4/work/cant-trials.json`): turning the handle 10, 15, 20 degrees in the bored fist brings the
  blade 9, 13, 17 degrees nearer the forearm's line and puts the handle 3.1, 5.6, 5.5 mm proud of the hand's surface
  (0.76 as fitted). A blade in line with the arm needs a hand generated for it, not a second socket.
- **Limits set on one case.** Every `equipment` limit in `harness/thresholds.json` was set with the Knight as the only
  troop. The direction limit equals the aim tool's stopping tolerance, so an aimed set passes it by construction; the
  gate also reports how many directions were restated since the set was first authored.
- **Tried and dropped:** wrist-first correction of the authored arm as the whole method (above); a body-in-item count
  alone as the score for making room (it settled with the blade lying through a thigh and reported 2); placing a shield
  flat over the crown; a level thrust over the shield's rim at eye height.

## Reducing, baking and exporting, 2026-10-08

Stage 8 for the Knight. Evidence: `../t1-knight-claude/v4/review/GATE-X.md`, `../t1-knight-claude/v4/review/lod/`,
`../t1-knight-claude/v4/work/reduced-*.json`, `baked-*.json`, `../t1-knight-claude/v4/export/`.

A bind is about a hundred thousand triangles in fifty pieces with underlay, linings and cuffs between them. A game skin
is a tenth of that (near) or a twentieth (mid). Taking triangles away is easy; every lesson below is about what a
general reducer does to a layered mesh that a one-sided renderer then shows.

- **The reduction keeps the bind's vertices.** Edges are merged one at a time, cheapest first, onto one of their own two
  vertices. Nothing is interpolated or re-skinned: every vertex of a level has the bind's weights, class and place, so a
  rigid piece stays on its one joint by construction and the harness reads a level as it reads a bind.
- **A rim is not a surface.** The planes of a rim's two faces both pass through it, so a vertex slid back along the
  sheet costs nothing and the plate's edge is drawn back into the plate; what lies under it shows as wedges. Open
  borders, the edges of thin sheets (two faces looking opposite ways, or on a rigid piece more than a right angle
  apart), the line where shown surface meets hidden, and lines where three surfaces meet are all rims: a rim vertex
  leaves only along its rim, a vertex where rims meet stays, and no rim may stray further than `--rim` from where it ran
  (0.5 mm near, 4 mm mid). Without the hard limit the budget is met by cutting the corners off rims.
- **The line between shown and hidden surface moves one way.** It may go in under the plate (shown surface then reaches
  further in, where nobody sees) and never out.
- **Small turns add up.** Each merge may turn a face a little; after many a face looks inward and is not drawn. A face
  may not end more than about 70 degrees from the way it faced in the bind.
- **A lining is rebuilt, not reduced.** A plate's lining reduced by itself gets its own corners, and where the plate is
  hollow its flat faces stand in front of the plate's: not drawn from outside, but throwing their shadow on the plate
  (black wedges that a two-sided render does not show). Each level's lining is the level's own plate again, facing
  inward, 0.3 mm inside it at the rim and 1.2 mm from 4 mm in. A lining lying in the plate's own faces shadows it too,
  so even the rim vertices are offset.
- **A mouth the limb used to fill opens.** A bracer is a tube. In the bind the sleeve's bulk fills its elbow end;
  reduced, the sleeve is thinner there and a view from above and behind (the game's own, in every walk) goes past it to
  the inside of the bracer, which is not drawn: a hole (8 flagged poses at 13,500 triangles, 31 at 4,500, none in the
  bind). Plates named under `"reduce": {"mouths": […]}` get each open rim closed by a funnel built from the reduced rim
  to a point on the mouth's axis, in a class of its own (`mouth_<plate>`) painted as the plate's lining at 0.6 of its
  tone (`mouth_tone`): a pale funnel reads as a lid, a dark one as the shadow in the mouth.
- **A line where three surfaces meet must be allowed to thin.** The skirt under the helmet lands on the underlay along
  127 edges. Left alone (as any edge shared by more than two faces first was), every vertex on it outlived the reduction
  and held its faces with it: a tenth of the 4,500 triangle level sat round one unseen ring. It is now a rim like the
  others.
- **Moving covered surface back, and what not to move.** `hb_tuck.py` moves only vertices of generated surface, only
  inward. Moving the covered corners of plates tipped the faces they share with what shows; dropping hidden faces that
  showed at rest opened holes of up to a third of the view in poses (those faces close the gaps when the body moves);
  moving whole faces ran away by centimetres.
- **Normals at a low level of detail.** `hb_lib.corner_normals` (area weighted over a piece) cancels at every rim of a
  reduction, where a plate, its edge band and its lining are a handful of faces. `corner_normals_lod` sorts the faces
  round each place into fans (faces sharing an edge there and within 60 degrees of each other) and gives every corner of
  a fan the fan's one normal; a corner more than 60 degrees from its fan's normal (a fan run round a rounded edge) takes
  only the fan's faces near its own. The first version gave each corner the faces within 60 degrees of its own face, fan
  or no fan: corners at one place then differed wherever a fan held two faces further apart than that, which at a low
  level of detail is most places. Every such edge was lit as a crease and the file needed 2.6 vertices per place for
  normals alone.
- **Shown surface never reads hidden surface.** The bake looks for each texel's source in the same connected piece of
  the bind, and a bracer, the cloth strip hung from its rim and the cuff the strip lands on are one piece. A flattened
  bracer's texels near its rim lay nearer the strip than the bracer and took its plain pale cloth: a white band round
  both wrists at 4,500 triangles, white flecks at 13,500, found by a cold review and by nothing else (the rest check
  sees which piece shows, not what is painted on it). Faces of the character are now looked for among the piece's faces
  of the character only. The strip under a rim is also tucked and repainted like other hidden surface; only a plate's
  lining and a mouth's funnel are left as built.
- **Weigh what is looked at.** At equal cost a face 25 mm across loses its eyes before a thigh loses a wrinkle. The
  Knight's levels are built with `--weigh head:30,hand_l:6,hand_r:6` (a face of 300 triangles at 13,500 instead of 153;
  fists of about 250 instead of 190).
- **Items.** `hb_item_prepare.py` welds an item's vertices by place: one cut along its texture seams comes in as many
  pieces (the sword: 66), every cut an open border the reducer may only merge along itself, and the budget cannot be
  reached. Texture corners and normals are per face corner, so nothing is lost. An item is one layer, so its bake looks
  for each texel's source along the texel's normal (`HB_LOOKUP=normal`): where a raised rim has been flattened, the
  nearest point bends the rim's painted border toward the flat face and it wavers. A round rim wants only edges whose
  faces look nearly opposite ways counted as rims (`HB_REDUCE_FOLD_RIGID=-0.3`); counting square ones too spends the
  budget on them and the outline is cut instead (2.0 mm against 1.1 mm at 1,000 triangles on the Knight's shield).
- **What the bake must not carry over.** The generator paints what it cannot see black (a plate under its strap). A
  reduction moves every edge a little, so a texel whose nearest bind surface is covered at rest reads the nearest
  uncovered surface of its own class, and a texel of hidden surface that shows at rest reads the nearest surface that
  shows. A baked normal may lean at most 50 degrees from the reduced face: where a plate has been flattened the bind's
  normal can stand behind it, and steel lit by such a normal renders black. A class painted from one texel in the bind
  is that texel on the reduction wherever its faces lie.
- **Count the file's vertices, not only its triangles.** A vertex in the file is a place with one normal, one texture
  point and one tangent. The Knight's near level has 7,445 places and 13,499 triangles; texture islands alone make
  16,072 vertices of them, and normals and tangents bring it to 19,927 (28,164 before the normals were made by fans).
  The layout's fragmentation (about 2,450 islands) is the larger part and is not solved.
- **The checks that found these.** Rest: `hb_lod_see.py` (what a viewer's first front-facing surface is, against the
  bind) and `hb_lod_backs.py`. Poses: `hb_gap_check.py` on the reduction (holes), `hb_lod_check.py`. Neither rest check
  sees a mouth open in a walk, and the pose harness sees none of the layering: all four are needed, and then renders.
- **Collapse is judged by area, and is a property of the pose.** In `reach-down` the front skirt strips and the trousers
  fold at the hip on the bind itself: 0.76% of its soft surface falls under 0.22 of its rest area, and 1.18% at both
  13,500 and 4,500 triangles, in the same pieces. The limit (first percentile by area at least 0.22, borrowed from the
  bind's count-based one) allows 1%. Bind 0.249, near 0.207, mid 0.191 (0.207 in `knee-135`). Two thirds of the
  collapsed area in a reduction is on faces that reach across two joints, against a quarter in the bind, but charging
  such merges three times as much (`--span 12`) and weighting the skirt strips and trousers moved the figure by 0.01
  either way and moved the worst pose from one deep bend to another. The Knight's levels failed that limit. On the
  owner's decision of 2026-10-08 it was recalibrated: a level is now judged against its own bind by the same measure, at
  most 0.05 below it at the near size and 0.07 at the mid size, and never under 0.15 (`reduced.area_w_p01` in
  `harness/thresholds.json`; `hb_lod_check.py` needs `--bound` for it). Both levels pass. The Knight is the only case
  behind these figures.
- **Prove the file by posing it.** `tools/hb_export_check.py` reads the exported files as a game would, turns the core
  joints as the baseline's solver does and the helper joints by the rules written in `runtime-fit.json`, skins the
  file's own vertices with the file's own weights, and compares with the baseline's skinning of the same level: the two
  must agree to a hundredth of a millimetre in every pose. The first export did not: it built its rig without the "ride"
  data, so 263 places of padding under the shoulder plates were written with their template weights and moved 26 mm off.
  Every structural check (joint count, four influences, weights summing to one) had passed. A troop's export is not done
  until this check passes.
- **Export.** `hb_export.py` writes the file itself: positions, authored normals and the bake's tangents turned to the
  game's frame by one rotation, joints as plain translations in the family order with helpers last, weights cut to four
  and summed to one in the file's own floats. `hb_runtime_fit.py` writes the rest of what a game needs from
  measurements: helper rules, sockets, knuckle points, feet.
- **Limits set on one case.** `reduced` and `reduced_see` in `harness/thresholds.json` were set with the Knight as the
  only troop.
- **Tried and dropped:** keeping the bind's texture seams whole in the reducer (`--seams`: the budgets could not be
  reached); a list of faces no camera ever sees, to drop before reducing (`hb_never_seen.py`: 3,889 of 23,319 generated
  faces at a 70 degree cone; they are what closes gaps in poses); the three tuck variants above.

## Under the game's controller, 2026-10-09

The Knight in the game's own pose controller, after it had passed every gate above and stood correctly in the comparison
instance. Evidence: `../t1-knight-claude/v4/review/gym-motion/` (first capture), `gym-arms-final/` (last),
`../t1-knight-claude/v4/work/integration/` (work orders K to N, `pose-reference.json`, `arm-poses.json`),
`examples/knight-arm-poses/`.

The comparison instance sets joint rotations directly. It shows that the files are right and nothing about what the
game's controller will do with them. Every fault below was invisible until the model was captured in the game's
development gym, standing, walking, running and attacking, large enough to judge the arms.

- **The controller works at another figure's size.** Its offsets are metres for a figure about 1.9 tall, scaled by one
  number. A model kept at its own size (0.61, so that gear and sockets stay as fitted) had its legs folded and its feet
  9 cm off the floor until that number followed the measured leg length.
- **A limb is given a direction, not a roll.** The controller turns an arm bone by the shortest arc from straight up to
  where it should point. Gear the game orients itself never shows this. A shield fixed to the forearm does: it lay flat,
  face up, with the forearm forward, and faced the knight's own chest with the forearm across the body.
- **Posing the arm in the elbow's hinge frame is exact.** Upper arm and forearm each point where the solver puts them
  and both keep the hinge axis, the normal of the plane through shoulder, elbow and wrist. From the same three points
  this gives the turns of this baseline's pose solver to 0.00 degrees in every pose measured, so everything approved
  about plates, sleeves and gear carries over. The game does it for a rig that asks.
- **An elbow has one side.** The game's arm solver keeps the last frame's bend plane so elbows do not flicker. With
  hinge arms a kept plane can leave the elbow on the far side of its pole for good, and everything fixed to the arm then
  faces the wrong way round: the blade lay across the body and through the shield after one motion followed another. A
  hinge arm bends towards its pole only.
- **Do not describe arm poses in words.** Two rounds of targets written from a description ("shield half open on the
  left, sword at the ready, elbow low") removed the contact between sword and shield and looked wrong: the sword held
  out to the side, the blade pointing away from the target at contact, a shoulder plate showing its inside from behind.
  The pose set approved with the gear already says how the arms are held. Measure it (`examples/knight-arm-poses/`):
  wrist, the point the elbow bends towards, and the hand's turn on the forearm, relative to the chest.
- **The wrist moves in the approved poses.** The hand turns 16 to 48 degrees on the forearm in the guard and cut poses.
  With the wrist rigid the approved guard puts the blade through the shield; with the turn carried over it passes 24 mm
  clear. Carry the turn with the pose.
- **The game's legs are not the pose set's legs.** The approved walk carries the shield low. The game's walk and run
  lift the knee higher than the pose set's walk does: the low shield came within 1 mm of the thigh in the game's walk
  and 17 mm into it in its run. Standing still holds the carry; on the move the arms hold the guard.
- **Check clearances by computation, on one figure, through the motions in turn.** Blade as a segment, arms and legs as
  capsules, shield as a disc, sampled over idle, walk, run and the whole attack. Each motion on a fresh figure passed
  while the elbow fault above was live; it showed only when one motion followed another.
- **A switch is a jump.** The game eases the rotations of body parts, not the positions its arm solver reaches for. A
  guard held "while moving" as a yes or no put shield and sword there in one frame when a unit set off, and back in one
  frame when it stopped. The melee controller eases a weight instead.
- **Measure what the game shows.** The game's pose filter makes the visible chest follow the controller's a little late,
  so arms placed in the controller's chest frame lead the trunk in a fast attack (up to 5 cm on this figure) and stand
  closer to head and trunk than the unfiltered pose says (shield to head 8 mm against 18). Measure clearances with the
  filter on.
- **The whole body can follow the approved poses, measured the same way (2026-10-09, body pass).** Pelvis yaw, pitch,
  roll and height, the spine and head against them, and where each foot stands, measured from the approved poses per
  state and declared by the gear, with the game's chain blending between them; standing, the pelvis stands over the
  declared stance and the feet step into it. The trunk, head and standing feet then agree with the approved poses to 0.0
  degrees; walking and running legs stay the gait's.
- **The filter cuts corners.** The game eases pelvis, chest and head rotations with a time constant of about 0.12 s. A
  transition between two states therefore comes a little closer to the head or the body than either state (2 to 10 mm on
  the Knight), and the figure reaches a fast pose late: the cut's contact shows about 0.1 s after the contact event, and
  looking ahead by the filter's lag halves the gap but cannot close it. Judge transitions against the states they move
  between, not against a fixed number.
- **A table's labels are the whole truth of it.** The first pose table assigned the chest's turn about the vertical to
  "flex" and its pitch to "twist"; the game applied them faithfully and the chest leaned back where the approved pose
  leans forward. Found only by reading the posed skeleton back out of the game and solving the approved poses again
  (`examples/knight-arm-poses/`, steps 3 to 5). Do that on every result; a test against the table proves the table was
  applied, not that it is right.
- **What the poses leave for the controller.** A shield on the forearm cannot be turned by the hand, so a transition
  that swings it past the thigh needs a different path for the whole arm (an outward bow helped two idles, not a third,
  which was left out). The approved follow-throughs stand the trailing foot on its toes; the game plants it flat, so no
  attack drive is added on top of a declared body. This figure's foot points 27 degrees down at rest, so under the
  game's rule for idle and run (the foot keeps its bind turn on the shin) the toes went 37 mm through the floor: feet
  that bear weight now stand on their soles, opt-in.
- **Open the frames.** A capture is evidence only at a size where the thing in question can be judged, and only once
  someone has looked at it. A worker's sentence about a frame is not a look.
- **Capture a windup at its apex, not at the phase's end.** Declared states lead the attack by the pose filter's lag
  (0.12 s, seven frames at 60 fps), so the raise or chamber is fullest seven frames before the windup phase ends and is
  already on its way down at the end. The chop's raise read as "hand at helmet height" until the frame was taken at the
  apex, where it matches the approved raise; the numbers (the wrist's height over the shoulders at every frame, from
  the skeleton dump) said so before the frame did.
- **Capture with the gym's own camera.** `seekFrame(frame, sequence, rootMotionSpeed, viewId)` leaves the inspection
  camera on a named view (front, rear, profiles, three-quarters), framed by the figure's measured height; mouse orbits of
  the viewport overshoot and have no repeatable framing. A part missing from one view is a question for the other
  views and for several moments before it is a question for the model or the controller: the Knight's head, shield and
  sword vanished from behind because the gym's floor stood on edge at the figure's root plane and hid everything in
  front of it, which only the profiles and a frame series showed.

## Known limits (2026-10-04)

- Tools are first versions, written for the baseline proof. `hb_bind.py` takes several minutes on a raw 76k-triangle
  mesh.
- Label borders are as jagged as the raw triangles, and faces no view could see are filled from their neighbours.
  Side-view ID maps and border smoothing are Knight-stage work.
- Tripo welds surfaces that touch in the rest pose (inner arm to torso). The bind removes faces whose corners have
  disjoint weights; a concept with clear air at the armpits avoids them.
- The contact (poke-through) measure is new and its thresholds are provisional.
- Not built yet: automatic choice between candidate joints for a plate (bind once per candidate and compare by hand for
  now). (Budget reduction, bake and export exist since 2026-10-08; the game-side helper driver and validator change are
  Knight stage 8 work in the game repository.)
- The baked texture layout is fragmented: about 2,400 islands at 13,500 triangles using a third of the square, and 2.5
  file vertices per place. Better packing (charts grown across the bind's seams, swatches for flat faces) is not built.
- The poke-through check lives in `hb_bind.py` and covers 20 range-of-motion poses, not the pose library.
- The horse rig does not exist; `poses/mount.json` is keyed by anatomical joints.
- Pose angles in the library are estimated from references by eye (about ±15°) or designed from the limits; the Knight
  goal reviews its set on the rig.
