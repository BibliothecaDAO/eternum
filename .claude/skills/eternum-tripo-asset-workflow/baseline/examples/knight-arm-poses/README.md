# The Knight's arm poses for the game

How `apps/game/asset-sources/characters/t1-knight-default/arm-poses.json` was measured. Written for the Knight (a shield
strapped to the forearm, a sword in a bored fist); another troop with gear fitted to its bones needs its own states and
its own list of poses, and can start from these two files.

1. `k4_pose_reference.py` solves named poses of the approved pose set (`../../poses/knight.json`) with the baseline's
   own solver on the bound model and writes, relative to the chest and in the game's axes: shoulder, elbow and wrist of
   both arms, each arm bone's turn, where the shield sits and faces, where the blade points. It also poses an arm in the
   elbow's hinge frame from the same three points and reports how far that is from the solver: 0.00 degrees in every
   pose, which is what lets the game pose the arms that way.
2. `k4_arm_poses.py` picks the states the game blends between (carry, guard, windup, contact, follow), applies what the
   game does (the shoulder stays where it rests, a two-bone reach whose elbow bends towards the approved elbow, hinge
   arms, the approved turn of the hand on the forearm), and writes the table the game's gear catalog declares together
   with what the game should then show and how close sword, shield, arms, head and trunk come in each state and in the
   blends between them.

Both need the character's working files (the bound model and `runtime-fit.json`), which are not in this repository. Run
them with Blender's Python from anywhere; they find the tools two folders up. The usage is at the top of each.

The reasons are in the baseline's README, "Under the game's controller".
