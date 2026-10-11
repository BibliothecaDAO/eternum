"""Arm reference for the game's controller, measured from the approved Knight pose library.

For each named pose of the knight set (poses/knight.json, approved with gear at gate E and on
bind r71), solved by the baseline's own pose solver on the bound model, this writes, in the game's axes
(+X left, +Y up, +Z forward, metres) and relative to the chest:
  - where shoulder, elbow and wrist are, both arms;
  - each arm bone's turn from rest;
  - where the shield sits and faces, where the sword's grip and tip are and where the blade points;
  - what a game arm posed in the elbow's hinge frame from the same three points would give (it must agree), and where
    the blade would point with a wrist that does not move.
"The chest" is the point midway between the two shoulder joints at rest, carried rigidly by spine_03, with spine_03's
rotation: the frame the game's controller places arm targets in.

Numpy only; reads the baseline tools, writes one JSON. Paths are relative to the baseline folder or absolute:
  "$HB_PYTHON" <this file> --char <character>/char.json --bound <character>/work/bound-r71.npz \
        --fit <character>/export/runtime-fit.json --out <character>/work/integration/pose-reference.json
"""
import argparse, json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
# the baseline's tools: two folders up in the skill (baseline/examples/<name>/), or beside the maker's working tree
TOOLS = next((t for t in (os.path.join(HERE, "..", "..", "tools"), os.path.join(HERE, "..", "..", "..", "human-baseline", "tools")) if os.path.isfile(os.path.join(t, "hb_lib.py"))), None)
if TOOLS is None: raise SystemExit("the baseline's tools were not found beside this example")
sys.path.insert(0, os.path.normpath(TOOLS))
from hb_common import p                                                 # noqa: E402
import hb_lib as H, hb_harness as HN, hb_helpers as HH                  # noqa: E402
from hb_export import C, to_game                                        # noqa: E402

POSES = None                                                            # every pose of the knight set
SWORD_LENGTH = 0.298393189907074                                        # the catalog's visualLength
SHIELD_RADIUS = 0.250672 / 2                                            # half the catalog's visualDiameter


def unit(v):
    v = np.asarray(v, float); n = np.linalg.norm(v); return v / n if n > 1e-12 else v


def r4(a): return [round(float(x), 4) for x in np.asarray(a, float).ravel()]


def quat_xyzw(R):
    R = np.asarray(R, float); t = np.trace(R)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2; q = [(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, 0.25 * s]
    else:
        i = int(np.argmax(np.diag(R))); j, k = (i + 1) % 3, (i + 2) % 3; s = math.sqrt(1.0 + R[i, i] - R[j, j] - R[k, k]) * 2
        q = [0.0, 0.0, 0.0, 0.0]; q[i] = 0.25 * s; q[j] = (R[j, i] + R[i, j]) / s; q[k] = (R[k, i] + R[i, k]) / s; q[3] = (R[k, j] - R[j, k]) / s
    return q


def angle_between_rotations(Ra, Rb):
    c = (np.trace(Ra.T @ Rb) - 1) / 2; return math.degrees(math.acos(max(-1.0, min(1.0, c))))


def angle(a, b): return math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(unit(a), unit(b)))))))


def hinge_frame(d, h):
    """The game's stable segment frame: columns (right, direction, forward), forward the reference made square to d."""
    d = unit(d); f = unit(h - d * float(np.dot(h, d))); r = unit(np.cross(d, f)); f = unit(np.cross(r, d)); return np.stack([r, d, f], axis=1)


def hinge_turns(S0, E0, W0, S, E, W):
    """Turns from rest of upper arm and forearm when both keep the elbow's hinge axis (forearm x upper arm)."""
    h0 = unit(np.cross(W0 - E0, E0 - S0)); h = unit(np.cross(W - E, E - S))
    return hinge_frame(E - S, h) @ hinge_frame(E0 - S0, h0).T, hinge_frame(W - E, h) @ hinge_frame(W0 - E0, h0).T, h


def swing_twist_deg(R, axis):
    """Twist of R about axis (degrees, signed), the rest being swing."""
    q = quat_xyzw(R); v = np.array(q[:3]); a = unit(axis); pr = float(np.dot(v, a)); w = q[3]
    n = math.hypot(pr, w)
    if n < 1e-9: return 180.0
    tw = 2 * math.degrees(math.atan2(pr, w)); tw = (tw + 180) % 360 - 180; return tw


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--bound", required=True); ap.add_argument("--fit", required=True)
    ap.add_argument("--helpers", default="elbow_half,knee_half,upperarm_twist"); ap.add_argument("--out", required=True); a = ap.parse_args()
    V, tris, W_, rig0, cls, classes = HN.load_bound(p(*a.bound.split("/")))
    rig, _ = HH.add_helpers(V, W_, rig0, [h for h in a.helpers.split(",") if h], cls, classes)
    names = list(rig["names"]); rest = np.array(rig["rest"], float); ix = names.index
    fit = json.load(open(p(*a.fit.split("/"))))
    sock = {k: np.array(v["matrix_rows"], float) for k, v in fit["sockets"].items()}       # game axes, in the joint's frame
    G = lambda v: np.asarray(to_game(np.asarray(v, float)), float)
    s3 = ix("spine_03"); mid_rest = (rest[ix("upperarm_l")] + rest[ix("upperarm_r")]) / 2
    rest_rel = {n: G(rest[ix(n)] - mid_rest) for n in names}
    library = {q["id"]: q for q in H.load_pose_sets(p("poses"), ["knight"])}
    out = {"from": {"poses": "poses/knight.json", "bound": os.path.basename(a.bound.replace("\\", "/")), "fit": os.path.basename(a.fit.replace("\\", "/"))},
           "frame": "game axes (+X left, +Y up, +Z forward), metres, relative to the chest: the point midway between the shoulder joints at rest, carried and turned by spine_03",
           "rest": {n: r4(rest_rel[n]) for n in ("upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r", "spine_03", "neck_01", "Head", "pelvis")},
           "shield_radius": round(SHIELD_RADIUS, 5), "sword_length": round(SWORD_LENGTH, 5), "poses": {}}
    lines = []
    for pid in (POSES or list(library)):
        if pid not in library: print("NO POSE", pid); continue
        A_, P_ = H.solve_pose(rig, library[pid]["targets"]); Rs = A_[s3]; chest = P_[s3] + Rs @ (mid_rest - rest[s3])
        pos = lambda n: G(Rs.T @ (P_[ix(n)] - chest)); turn = lambda n: C @ (Rs.T @ A_[ix(n)]) @ C.T
        e = {"targets": {k: library[pid]["targets"].get(k) for k in ("arm_l", "arm_r", "spine", "pelvis")}}
        for sfx in ("l", "r"):
            S, E, Wr = pos("upperarm_" + sfx), pos("lowerarm_" + sfx), pos("hand_" + sfx)
            S0, E0, W0 = rest_rel["upperarm_" + sfx], rest_rel["lowerarm_" + sfx], rest_rel["hand_" + sfx]
            Ru, Rf, Rh = turn("upperarm_" + sfx), turn("lowerarm_" + sfx), turn("hand_" + sfx)
            Hu, Hf, hinge = hinge_turns(S0, E0, W0, S, E, Wr)
            # the same with the shoulder where the game leaves it (the game does not move the clavicle)
            Hu_g, Hf_g, hinge_g = hinge_turns(S0, E0, W0, S0, E, Wr)
            e["arm_" + sfx] = {"shoulder": r4(S), "elbow": r4(E), "wrist": r4(Wr), "elbow_bend_deg": round(angle(E - S, Wr - E), 1),
                               "upperarm_turn_xyzw": r4(quat_xyzw(Ru)), "lowerarm_turn_xyzw": r4(quat_xyzw(Rf)), "hand_turn_xyzw": r4(quat_xyzw(Rh)),
                               "hinge_axis": r4(hinge), "upperarm_twist_about_rest_deg": round(swing_twist_deg(Ru, E0 - S0), 1),
                               "hinge_frame_vs_library_deg": {"upperarm": round(angle_between_rotations(Hu, Ru), 2), "lowerarm": round(angle_between_rotations(Hf, Rf), 2)},
                               "shoulder_moved_by_clavicle_mm": round(float(np.linalg.norm(S - S0)) * 1000, 1),
                               "hand_vs_forearm_deg": round(angle_between_rotations(Rf, Rh), 1)}
        # shield on lowerarm_l, sword on hand_r
        Rf, Rh = turn("lowerarm_l"), turn("hand_r"); Ms, Mw = sock["shield"], sock["sword"]
        front = Rf @ Ms[:3, 2]; centre = pos("lowerarm_l") + Rf @ Ms[:3, 3]
        blade = Rh @ Mw[:3, 1]; grip = pos("hand_r") + Rh @ Mw[:3, 3]; tip = grip + blade * SWORD_LENGTH
        blade_rigid = turn("lowerarm_r") @ Mw[:3, 1]
        yaw_left = math.degrees(math.atan2(front[0], front[2])); pitch_up = math.degrees(math.asin(max(-1, min(1, front[1]))))
        e["shield"] = {"centre": r4(centre), "front": r4(front), "faces_left_of_forward_deg": round(yaw_left, 1), "faces_up_deg": round(pitch_up, 1),
                       "rightmost_x": round(float(centre[0] - SHIELD_RADIUS * math.sqrt(max(0.0, 1 - front[0] ** 2))), 4),
                       "top_y": round(float(centre[1] + SHIELD_RADIUS * math.sqrt(max(0.0, 1 - front[1] ** 2))), 4)}
        e["sword"] = {"grip": r4(grip), "tip": r4(tip), "blade": r4(blade), "blade_with_rigid_wrist": r4(blade_rigid), "wrist_moves_blade_by_deg": round(angle(blade, blade_rigid), 1),
                      "blade_up_deg": round(math.degrees(math.asin(max(-1, min(1, blade[1])))), 1), "blade_left_of_forward_deg": round(math.degrees(math.atan2(blade[0], blade[2])), 1)}
        out["poses"][pid] = e
        L_, R_ = e["arm_l"], e["arm_r"]
        lines.append("%-22s L wrist %s elbow %s bend %5.1f twist %6.1f hinge-diff %.2f/%.2f | shield c %s faces L%5.1f up%5.1f right-x %+.3f | R wrist %s elbow %s bend %5.1f twist %6.1f hinge-diff %.2f/%.2f | blade %s (rigid %s, wrist %4.1f)" % (
            pid, L_["wrist"], L_["elbow"], L_["elbow_bend_deg"], L_["upperarm_twist_about_rest_deg"], L_["hinge_frame_vs_library_deg"]["upperarm"], L_["hinge_frame_vs_library_deg"]["lowerarm"],
            e["shield"]["centre"], e["shield"]["faces_left_of_forward_deg"], e["shield"]["faces_up_deg"], e["shield"]["rightmost_x"],
            R_["wrist"], R_["elbow"], R_["elbow_bend_deg"], R_["upperarm_twist_about_rest_deg"], R_["hinge_frame_vs_library_deg"]["upperarm"], R_["hinge_frame_vs_library_deg"]["lowerarm"],
            e["sword"]["blade"], e["sword"]["blade_with_rigid_wrist"], e["sword"]["wrist_moves_blade_by_deg"]))
    op = p(*a.out.split("/")); json.dump(out, open(op, "w"), indent=1)
    print("REST upperarm_l %s lowerarm_l %s hand_l %s" % (out["rest"]["upperarm_l"], out["rest"]["lowerarm_l"], out["rest"]["hand_l"]))
    for l in lines: print(l)
    print("POSE_REFERENCE_DONE", op)
