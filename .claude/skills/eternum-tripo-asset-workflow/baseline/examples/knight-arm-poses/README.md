# The Knight's poses for the game, and how to check what the game does with them

How `apps/game/asset-sources/characters/t1-knight-default/poses.json` was measured, and how the game's poses were
measured back against the approved ones. Written for the Knight (a shield strapped to the forearm, a sword in a bored
fist); another troop with gear fitted to its bones needs its own states and its own list of poses, and can start from
these files. All of them need the character's working files (the bound model, `char.json`, `runtime-fit.json`, the gear
fit), which are not in this repository, and Blender's Python; they find the baseline's tools two folders up.

1. `k4_pose_reference.py` solves every pose of the approved set (`../../poses/knight.json`) with the baseline's own
   solver on the bound model and writes, relative to the chest and in the game's axes: shoulder, elbow and wrist of both
   arms, each arm bone's turn, where the shield sits and faces, where the blade points. It also poses an arm in the
   elbow's hinge frame from the same three points and reports how far that is from the solver: 0.00 degrees in every
   pose, which is what lets the game pose the arms that way.
2. `k4_arm_poses.py` picks the states the game blends between (three idles; the guard standing and on the move; four
   attacks in three moments each; the hit), applies what the game does (the shoulder stays where it rests, a two-bone
   reach whose elbow bends towards the approved elbow, hinge arms, the approved turn of the hand on the forearm), and
   writes the table the game's gear catalog declares: arms relative to the chest, the trunk and head (pelvis yaw, pitch,
   roll and height; spine flex, twist and side against the pelvis; head yaw and pitch against the chest), the stance
   (each ankle forward and left of the midpoint between the ankles, the toes' yaw), what the game should then show, and
   how close sword, shield, arms and head come in each state and in the blends between them.
3. `k4_dump_skeleton.test.ts.txt` is a vitest file to copy into the game checkout for a minute: it runs the Knight
   through the game's own controller (idle, guard, walk, run, an attack) and writes every bone's world position and turn
   per moment.
4. `k4_body_compare.py` measures that dump and the approved poses the same way (pelvis, spine, head, hips, knees, feet)
   and prints the differences, state by state; each attack's moments are held against that attack's own approved poses
   (the cut against cut-windup and cut-mid, the chop against the overhead raise and strike).
5. `k4_game_pose_render.py` (run inside Blender) skins the bound model with the game's joints, draws the gear on its
   sockets and renders each moment beside the approved pose at the same framing; `k4_controller_pass_render.sh` is the
   command line that runs it.

The reasons are in the baseline's README, "Under the game's controller". A lesson from using them: a measurement tool's
output is only as good as its labels. The first table swapped the spine's twist and flex columns; the game applied them
faithfully and the chest leaned the wrong way. Steps 3 to 5, run on the result, are what found it.
