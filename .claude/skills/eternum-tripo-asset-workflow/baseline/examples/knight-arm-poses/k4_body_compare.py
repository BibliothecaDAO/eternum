"""Trunk, head and legs of the Knight under the game's controller, against the approved pose set.

Reads a skeleton dump from the game (bones' world position and quaternion per controller moment, game axes) and the
approved poses solved by the baseline's own solver on the bound model, measures both the same way and prints the
differences. Measures, in the baseline's working frame (+Z up, -Y forward, +X left):
  pelvis yaw / pitch / roll (degrees; yaw positive to the left, pitch positive leaning forward), pelvis height as a
  fraction of rest; spine flex / twist / side (spine_03 against the pelvis); head yaw / pitch (Head against spine_03);
  per leg: hip flexion and abduction (thigh against the pelvis), knee bend, the foot's place in front of and beside the
  pelvis (in the pelvis' yaw frame), and the lowest point of the foot.

Numpy only; needs the baseline's tools beside it (two folders up in the skill, or the maker's tree). Run with Blender's
Python from anywhere:
  "$HB_PYTHON" k4_body_compare.py --char <character>/char.json --bound <character>/work/bound-r71.npz \
        --dump <game-skeleton.json> --out <where to write the comparison json>
"""
import argparse, json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = next((t for t in (os.path.join(HERE, "..", "..", "tools"), os.path.join(HERE, "..", "..", "..", "human-baseline", "tools")) if os.path.isfile(os.path.join(t, "hb_lib.py"))), None)
if TOOLS is None: raise SystemExit("the baseline's tools were not found beside this script")
sys.path.insert(0, os.path.normpath(TOOLS))
from hb_common import p                                                 # noqa: E402
import hb_lib as H, hb_harness as HN, hb_helpers as HH                  # noqa: E402
from hb_export import C                                                 # noqa: E402

U, F, L = H.U, H.F, H.L

# which approved poses each game moment is held against
MATCH = {"idle": ["idle-relaxed", "idle-at-ease"], "guard-standing": ["guard-middle"], "walk": ["walk-contact", "walk-passing"],
         "run": ["run-charge"], "attack-acquire": ["guard-middle"], "attack-windup": ["cut-windup"], "attack-strike": ["cut-mid"],
         "attack-contact": ["cut-mid", "cut-followthrough"], "attack-followThrough": ["cut-followthrough"], "attack-recover": ["guard-middle", "idle-relaxed"],
         # the chop's moments (labels attack-chop-<phase>-<frame>) are held against the chop's approved poses
         "attack-chop-acquire": ["guard-middle"], "attack-chop-windup": ["chop-overhead-raise"], "attack-chop-strike": ["chop-overhead-strike"],
         "attack-chop-contact": ["chop-overhead-strike"], "attack-chop-followThrough": ["chop-overhead-strike"], "attack-chop-recover": ["guard-middle", "idle-relaxed"]}


def unit(v):
    v = np.asarray(v, float); n = np.linalg.norm(v); return v / n if n > 1e-12 else v


def q2m(q):
    x, y, z, w = [float(v) for v in q]; n = math.sqrt(x * x + y * y + z * z + w * w); x, y, z, w = x / n, y / n, z / n, w / n
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def deg(a): return math.degrees(a)


def orient(R):
    """yaw (left positive), pitch (forward lean positive), roll (left side down positive) of a frame turned by R from rest."""
    f = R @ F; l = R @ L
    yaw = math.atan2(-f[0], -f[1])                    # rest forward is -Y; turning left brings it toward -X... check sign below
    yaw = math.atan2(float(np.dot(f, L)), float(np.dot(f, F)))
    pitch = math.asin(max(-1.0, min(1.0, -float(f[2]))))
    roll = math.asin(max(-1.0, min(1.0, -float(l[2]))))
    return deg(yaw), deg(pitch), deg(roll)


def relative(Ra, Rb): return Ra.T @ Rb


def leg_metrics(names, A, P, side, rest):
    i = lambda n: names.index(n + "_" + side)
    hip, knee, ankle, ball, tip = (P[i(n)] for n in ("thigh", "calf", "foot", "ball", "ball_leaf"))
    pel = A[names.index("pelvis")]
    d = pel.T @ unit(knee - hip)                      # thigh in the pelvis frame
    flex = deg(math.atan2(float(np.dot(d, F)), float(np.dot(d, -U))))
    abd = deg(math.asin(max(-1.0, min(1.0, float(np.dot(d, L * (1 if side == "l" else -1)))))))
    kneebend = deg(math.acos(max(-1.0, min(1.0, float(np.dot(unit(knee - hip), unit(ankle - knee)))))))
    # the foot's place against the pelvis, in the pelvis' yaw frame only
    yaw = orient(pel)[0]; cy, sy = math.cos(math.radians(yaw)), math.sin(math.radians(yaw))
    fwd = cy * F + sy * L; left = -sy * F + cy * L
    rel = ankle - P[names.index("pelvis")]
    return {"hip_flex": round(flex, 1), "hip_abd": round(abd, 1), "knee": round(kneebend, 1),
            "foot_forward": round(float(np.dot(rel, fwd)), 3), "foot_left": round(float(np.dot(rel, left)), 3),
            "foot_low_z": round(float(min(ankle[2], ball[2], tip[2])), 3)}


def measure(names, A, P, rest):
    ix = names.index
    pel = A[ix("pelvis")]; chest = A[ix("spine_03")]; head = A[ix("Head")]
    y, pch, r = orient(pel); st, sf, ss = orient(relative(pel, chest)); hy, hp, _ = orient(relative(chest, head))   # orient gives yaw (twist), pitch (flex), roll (side)
    return {"pelvis_yaw": round(y, 1), "pelvis_pitch": round(pch, 1), "pelvis_roll": round(r, 1),
            "pelvis_height": round(float(P[ix("pelvis")][2] / rest[ix("pelvis")][2]), 3),
            "spine_twist": round(st, 1), "spine_flex": round(sf, 1), "spine_side": round(ss, 1),
            "head_yaw": round(hy, 1), "head_pitch": round(hp, 1),
            "leg_l": leg_metrics(names, A, P, "l", rest), "leg_r": leg_metrics(names, A, P, "r", rest),
            "shoulder_line_yaw": round(orient(chest)[0], 1)}


def fmt(m):
    l, r = m["leg_l"], m["leg_r"]
    return ("pelvis yaw %6.1f pitch %5.1f roll %5.1f h %.3f | spine flex %5.1f twist %6.1f side %5.1f | head yaw %6.1f pitch %5.1f | "
            "L hip %5.1f/%5.1f knee %5.1f foot fwd %+.3f left %+.3f low %+.3f | R hip %5.1f/%5.1f knee %5.1f foot fwd %+.3f left %+.3f low %+.3f") % (
        m["pelvis_yaw"], m["pelvis_pitch"], m["pelvis_roll"], m["pelvis_height"], m["spine_flex"], m["spine_twist"], m["spine_side"], m["head_yaw"], m["head_pitch"],
        l["hip_flex"], l["hip_abd"], l["knee"], l["foot_forward"], l["foot_left"], l["foot_low_z"], r["hip_flex"], r["hip_abd"], r["knee"], r["foot_forward"], r["foot_left"], r["foot_low_z"])


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--bound", required=True); ap.add_argument("--dump", required=True)
    ap.add_argument("--helpers", default="elbow_half,knee_half,upperarm_twist"); ap.add_argument("--out", required=True); a = ap.parse_args()
    V, tris, W_, rig0, cls, classes = HN.load_bound(p(*a.bound.split("/")))
    rig, _ = HH.add_helpers(V, W_, rig0, [h for h in a.helpers.split(",") if h], cls, classes)
    names = list(rig["names"]); rest = np.array(rig["rest"], float)
    library = {q["id"]: q for q in H.load_pose_sets(p("poses"), ["knight"])}
    approved = {}
    print("APPROVED (working frame)")
    for pid, q in library.items():
        A_, P_ = H.solve_pose(rig, q["targets"]); approved[pid] = measure(names, A_, P_, rest)
        print("  %-28s %s" % (pid, fmt(approved[pid])))
    dump = json.load(open(a.dump if os.path.isabs(a.dump) else p(*a.dump.split("/"))))
    order = dump["names"]; assert order == names[:len(order)] or set(order) == set(names), "joint order differs from the bound rig"
    game = {}
    print("GAME (working frame)")
    for s in dump["samples"]:
        A_ = np.zeros((len(names), 3, 3)); P_ = np.zeros((len(names), 3))
        for n, b in zip(order, s["bones"]):
            j = names.index(n); A_[j] = C.T @ q2m(b["q"]) @ C; P_[j] = C.T @ np.array(b["p"], float)
        game[s["label"]] = measure(names, A_, P_, rest)
        print("  %-28s %s" % (s["label"], fmt(game[s["label"]])))
    print("DIFFERENCES game minus approved (degrees; height as a fraction; feet in metres)")
    rows = []
    for label, m in game.items():
        key = next((k for k in sorted(MATCH, key=len, reverse=True) if label.startswith(k) or label.replace("attack-cut-", "attack-").startswith(k)), None)   # the cut's labels may carry its variant
        if key is None: continue
        for pid in MATCH[key]:
            q = approved[pid]
            row = {"game": label, "approved": pid,
                   "pelvis_yaw": round(m["pelvis_yaw"] - q["pelvis_yaw"], 1), "pelvis_pitch": round(m["pelvis_pitch"] - q["pelvis_pitch"], 1),
                   "pelvis_height": round(m["pelvis_height"] - q["pelvis_height"], 3), "spine_flex": round(m["spine_flex"] - q["spine_flex"], 1),
                   "spine_twist": round(m["spine_twist"] - q["spine_twist"], 1), "head_yaw": round(m["head_yaw"] - q["head_yaw"], 1), "head_pitch": round(m["head_pitch"] - q["head_pitch"], 1),
                   "knee_l": round(m["leg_l"]["knee"] - q["leg_l"]["knee"], 1), "knee_r": round(m["leg_r"]["knee"] - q["leg_r"]["knee"], 1),
                   "stance_l_fwd": round(m["leg_l"]["foot_forward"] - q["leg_l"]["foot_forward"], 3), "stance_r_fwd": round(m["leg_r"]["foot_forward"] - q["leg_r"]["foot_forward"], 3)}
            rows.append(row)
            print("  %-28s vs %-20s pelvis yaw %+6.1f pitch %+5.1f h %+.3f | spine flex %+5.1f twist %+6.1f | head yaw %+6.1f pitch %+5.1f | knees %+5.1f %+5.1f | feet fwd %+.3f %+.3f" % (
                label, pid, row["pelvis_yaw"], row["pelvis_pitch"], row["pelvis_height"], row["spine_flex"], row["spine_twist"], row["head_yaw"], row["head_pitch"], row["knee_l"], row["knee_r"], row["stance_l_fwd"], row["stance_r_fwd"]))
    op = a.out if os.path.isabs(a.out) else p(*a.out.split("/"))
    json.dump({"approved": approved, "game": game, "differences": rows}, open(op, "w"), indent=1); print("BODY_COMPARE_DONE", op)
