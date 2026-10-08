"""The Knight's arm poses for the game's controller, from the approved pose library, with the game's limits applied.

Reads pose-reference.json (k4_pose_reference.py) and runtime-fit.json. The game does not move the clavicle, so its
shoulder stays where it rests; it reaches a wrist with a two-bone solve whose elbow bends toward a given point, and
poses upper arm and forearm in the elbow's hinge frame. This script does the same from the approved poses' wrist and
elbow, carries the approved wrist turn (hand relative to forearm) over, and writes:
  - arm-poses.json: per state, per arm: wrist, elbow, the hand's turn relative to the forearm; and what the game should
    then show (elbow, shield centre and front, sword grip, tip and blade), all relative to the chest in game axes;
  - a clearance report over the states and the straight blends between them.

Numpy only. Paths are relative to the baseline folder or absolute:
  "$HB_PYTHON" <this file> --ref <character>/work/integration/pose-reference.json \
        --fit <character>/export/runtime-fit.json --out <character>/work/integration/arm-poses.json
"""
import argparse, json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
# the baseline's tools: two folders up in the skill (baseline/examples/<name>/), or beside the maker's working tree
TOOLS = next((t for t in (os.path.join(HERE, "..", "..", "tools"), os.path.join(HERE, "..", "..", "..", "human-baseline", "tools")) if os.path.isfile(os.path.join(t, "hb_lib.py"))), None)
if TOOLS is None: raise SystemExit("the baseline's tools were not found beside this example")
sys.path.insert(0, os.path.normpath(TOOLS))
from hb_common import p                                                 # noqa: E402

# game phase -> approved pose. "contact" is halfway between the cut's middle and its follow-through: the frame the
# game calls contact should show the blade coming down on the target, not still raised.
STATES = {"carry": ("walk-contact", None), "guard": ("guard-middle", None), "windup": ("cut-windup", None),
          "contact": ("cut-mid", "cut-followthrough"), "follow": ("cut-followthrough", None)}
LEFT_STATES = ("carry", "guard")                                        # the shield arm holds its guard through the attack
BLENDS = [("carry", "guard"), ("guard", "windup"), ("windup", "contact"), ("contact", "follow"), ("follow", "guard"), ("follow", "carry"), ("guard", "carry")]


def unit(v):
    v = np.asarray(v, float); n = np.linalg.norm(v); return v / n if n > 1e-12 else v


def r4(a): return [round(float(x), 4) for x in np.asarray(a, float).ravel()]


def r5(a): return [round(float(x), 5) for x in np.asarray(a, float).ravel()]


def q2m(q):
    x, y, z, w = [float(v) for v in q]; n = math.sqrt(x * x + y * y + z * z + w * w); x, y, z, w = x / n, y / n, z / n, w / n
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def m2q(R):
    R = np.asarray(R, float); t = np.trace(R)
    if t > 0:
        s = math.sqrt(t + 1.0) * 2; q = [(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, 0.25 * s]
    else:
        i = int(np.argmax(np.diag(R))); j, k = (i + 1) % 3, (i + 2) % 3; s = math.sqrt(1.0 + R[i, i] - R[j, j] - R[k, k]) * 2
        q = [0.0, 0.0, 0.0, 0.0]; q[i] = 0.25 * s; q[j] = (R[j, i] + R[i, j]) / s; q[k] = (R[k, i] + R[i, k]) / s; q[3] = (R[k, j] - R[j, k]) / s
    q = np.array(q); return q if q[3] >= 0 else -q


def slerp(qa, qb, t):
    qa, qb = np.array(qa, float), np.array(qb, float); d = float(qa @ qb)
    if d < 0: qb, d = -qb, -d
    if d > 0.9995: return unit(qa + (qb - qa) * t)
    th = math.acos(d); return (math.sin((1 - t) * th) * qa + math.sin(t * th) * qb) / math.sin(th)


def angle(a, b): return math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(unit(a), unit(b)))))))


def hinge_frame(d, h):
    d = unit(d); f = unit(h - d * float(np.dot(h, d))); r = unit(np.cross(d, f)); f = unit(np.cross(r, d)); return np.stack([r, d, f], axis=1)


def two_bone(S, W, pole, a, b):
    """Elbow and reached wrist: the elbow bends toward the pole. Returns (elbow, wrist, hinge axis = forearm x upper arm)."""
    d = W - S; L = float(np.linalg.norm(d)); u = d / L; pv = pole - S; n = unit(pv - u * float(pv @ u)); h = unit(np.cross(u, n))
    if L >= a + b - 1e-9: return S + u * a, S + u * (a + b), h
    x = (a * a - b * b + L * L) / (2 * L); hh = math.sqrt(max(a * a - x * x, 0.0)); return S + u * x + n * hh, W.copy(), h


def point_to_disc(P, c, n, R):
    d = float((P - c) @ n); q = P - c - n * d; rho = float(np.linalg.norm(q))
    return abs(d) if rho <= R else math.hypot(d, rho - R)


def seg_points(A, B, k=40): return [A + (B - A) * (i / (k - 1)) for i in range(k)]


def point_to_seg(P, A, B):
    ab = B - A; t = max(0.0, min(1.0, float((P - A) @ ab) / float(ab @ ab))); return float(np.linalg.norm(P - (A + ab * t)))


def seg_to_seg(A, B, Cc, D): return min(min(point_to_seg(P, Cc, D) for P in seg_points(A, B)), min(point_to_seg(P, A, B) for P in seg_points(Cc, D)))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--ref", required=True); ap.add_argument("--fit", required=True); ap.add_argument("--out", required=True); a = ap.parse_args()
    ref = json.load(open(p(*a.ref.split("/")))); fit = json.load(open(p(*a.fit.split("/"))))
    Ms, Mw = (np.array(fit["sockets"][k]["matrix_rows"], float) for k in ("shield", "sword"))
    rest = {k: np.array(v, float) for k, v in ref["rest"].items()}; RAD = float(ref["shield_radius"]); LEN = float(ref["sword_length"])
    arm = {}
    for s in ("l", "r"):
        S0, E0, W0 = rest["upperarm_" + s], rest["lowerarm_" + s], rest["hand_" + s]
        arm[s] = {"S0": S0, "E0": E0, "W0": W0, "a": float(np.linalg.norm(E0 - S0)), "b": float(np.linalg.norm(W0 - E0)), "h0": unit(np.cross(W0 - E0, E0 - S0))}

    def source(pose_a, pose_b, s):
        """wrist, elbow and wrist turn (hand relative to forearm) of one arm, from one approved pose or halfway between two"""
        def one(pid):
            e = ref["poses"][pid]["arm_" + s]; return np.array(e["wrist"], float), np.array(e["elbow"], float), m2q(q2m(e["lowerarm_turn_xyzw"]).T @ q2m(e["hand_turn_xyzw"]))
        w, el, q = one(pose_a)
        if pose_b: w2, el2, q2 = one(pose_b); w, el, q = (w + w2) / 2, (el + el2) / 2, slerp(q, q2, 0.5)
        return w, el, q

    def game(s, wrist, pole, wrist_q):
        """what the game shows for one arm: elbow, reached wrist, forearm and hand turns"""
        A = arm[s]; E, Wc, h = two_bone(A["S0"], wrist, pole, A["a"], A["b"])
        Rf = hinge_frame(Wc - E, h) @ hinge_frame(A["W0"] - A["E0"], A["h0"]).T
        Ru = hinge_frame(E - A["S0"], h) @ hinge_frame(A["E0"] - A["S0"], A["h0"]).T
        return {"elbow": E, "wrist": Wc, "Rf": Rf, "Ru": Ru, "Rh": Rf @ q2m(wrist_q), "short_mm": float(np.linalg.norm(wrist - Wc)) * 1000}

    def gear(gl, gr):
        front = gl["Rf"] @ Ms[:3, 2]; centre = gl["elbow"] + gl["Rf"] @ Ms[:3, 3]
        blade = gr["Rh"] @ Mw[:3, 1]; grip = gr["wrist"] + gr["Rh"] @ Mw[:3, 3]; tip = grip + blade * LEN
        return {"centre": centre, "front": front, "grip": grip, "tip": tip, "blade": blade}

    HEAD_C = rest["Head"] + np.array([0.0, 0.02, 0.01]); HEAD_R = 0.05; GROUND_Y = -0.4768
    def clearance(gl, gr, g):
        blade_pts = seg_points(g["grip"], g["tip"]); c, n = g["centre"], g["front"]
        arm_pts = seg_points(gr["elbow"], gr["wrist"], 20) + seg_points(gr["wrist"], g["grip"], 6)
        return {"blade_to_shield": min(point_to_disc(P, c, n, RAD) for P in blade_pts),
                "sword_arm_to_shield": min(point_to_disc(P, c, n, RAD) for P in arm_pts) - 0.02,
                "blade_to_head": min(float(np.linalg.norm(P - HEAD_C)) for P in blade_pts) - HEAD_R,
                "blade_to_trunk": seg_to_seg(g["grip"] + (g["tip"] - g["grip"]) * 0.15, g["tip"], rest["pelvis"], rest["neck_01"]) - 0.05,
                "blade_to_shield_arm": min(seg_to_seg(g["grip"] + (g["tip"] - g["grip"]) * 0.15, g["tip"], gl["elbow"], gl["wrist"]), seg_to_seg(g["grip"] + (g["tip"] - g["grip"]) * 0.15, g["tip"], arm["l"]["S0"], gl["elbow"])) - 0.02,
                "sword_arm_to_shield_arm": min(seg_to_seg(gr["elbow"], gr["wrist"], gl["elbow"], gl["wrist"]), seg_to_seg(gr["elbow"], gr["wrist"], arm["l"]["S0"], gl["elbow"]), seg_to_seg(arm["r"]["S0"], gr["elbow"], gl["elbow"], gl["wrist"])) - 0.04,
                "shield_to_head": min(float(np.linalg.norm(HEAD_C - (c + RAD * (math.cos(t) * unit(np.cross(n, [0, 0, 1.0])) + math.sin(t) * unit(np.cross(n, np.cross(n, [0, 0, 1.0]))))))) for t in np.linspace(0, 2 * math.pi, 72)) - HEAD_R,
                "tip_above_ground": float(g["tip"][1] - GROUND_Y)}

    src = {st: {"l": source(*STATES[st if st in LEFT_STATES else "guard"], "l"), "r": source(*STATES[st], "r")} for st in STATES}
    out = {"from": dict(ref["from"], tool="k4_pose_reference.py, k4_arm_poses.py"),
           "frame": "the game's axes (+X left, +Y up, +Z forward), metres, relative to the chest: the point midway between the shoulder joints",
           "what": "Where the Knight holds its arms with shield and sword, taken from the pose set approved with the gear. wrist: where the wrist goes. elbow: the point the elbow bends toward. hand_turn_xyzw: the hand's turn relative to the forearm (the wrist's own movement). expect: what a game arm posed in the elbow's hinge frame from an unmoving shoulder then shows.",
           "states": {}}
    worst = {}
    def note(tag, cl):
        for k, v in cl.items():
            if k not in worst or v < worst[k][0]: worst[k] = (v, tag)
    print("%-10s %-34s %s" % ("state", "from", "clearances (mm): blade-shield, arm-shield, blade-head, blade-trunk, blade-shieldarm, arms, shield-head, tip-ground | shield faces L/up | blade up/L | short mm"))
    solved = {}
    for st in STATES:
        (wl, el, ql), (wr, er, qr) = src[st]["l"], src[st]["r"]; gl, gr = game("l", wl, el, ql), game("r", wr, er, qr); g = gear(gl, gr); cl = clearance(gl, gr, g); solved[st] = (gl, gr, g); note(st, cl)
        fr = g["front"]; bl = g["blade"]
        pose_a, pose_b = STATES[st]; lib = ref["poses"][pose_a]
        out["states"][st] = {"from_pose": pose_a if not pose_b else "halfway between %s and %s" % (pose_a, pose_b),
                             "left": {"wrist": r5(wl), "elbow": r5(el), "hand_turn_xyzw": r5(ql), "from_pose": STATES[st if st in LEFT_STATES else "guard"][0]},
                             "right": {"wrist": r5(wr), "elbow": r5(er), "hand_turn_xyzw": r5(qr)},
                             "expect": {"left_elbow": r5(gl["elbow"]), "left_wrist": r5(gl["wrist"]), "right_elbow": r5(gr["elbow"]), "right_wrist": r5(gr["wrist"]),
                                        "left_forearm_turn_xyzw": r5(m2q(gl["Rf"])), "left_upperarm_turn_xyzw": r5(m2q(gl["Ru"])), "right_forearm_turn_xyzw": r5(m2q(gr["Rf"])), "right_upperarm_turn_xyzw": r5(m2q(gr["Ru"])), "right_hand_turn_xyzw": r5(m2q(gr["Rh"])),
                                        "shield_centre": r5(g["centre"]), "shield_front": r5(fr), "sword_grip": r5(g["grip"]), "sword_tip": r5(g["tip"]), "blade": r5(bl),
                                        "clearance_mm": {k: round(v * 1000, 1) for k, v in cl.items()}},
                             "against_the_approved_pose": {"shield_front_deg": round(angle(fr, lib["shield"]["front"]), 1) if not pose_b and st in LEFT_STATES else None,
                                                           "shield_centre_mm": round(float(np.linalg.norm(g["centre"] - np.array(lib["shield"]["centre"]))) * 1000, 1) if not pose_b and st in LEFT_STATES else None,
                                                           "blade_deg": round(angle(bl, lib["sword"]["blade"]), 1) if not pose_b else None,
                                                           "grip_mm": round(float(np.linalg.norm(g["grip"] - np.array(lib["sword"]["grip"]))) * 1000, 1) if not pose_b else None}}
        print("%-10s %-34s %s | L%5.1f up%5.1f | up%5.1f L%6.1f | L %.1f R %.1f | vs approved: %s" % (st, out["states"][st]["from_pose"], " ".join("%6.1f" % (v * 1000) for v in cl.values()),
              math.degrees(math.atan2(fr[0], fr[2])), math.degrees(math.asin(fr[1])), math.degrees(math.asin(bl[1])), math.degrees(math.atan2(bl[0], bl[2])), gl["short_mm"], gr["short_mm"], out["states"][st]["against_the_approved_pose"]))
    print("blends (worst over 12 steps each):")
    blends = {}
    for sa, sb in BLENDS:
        w = {}
        for i in range(13):
            t = i / 12.0
            la, lb = src[sa]["l"], src[sb]["l"]; ra, rb = src[sa]["r"], src[sb]["r"]
            gl = game("l", la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t, slerp(la[2], lb[2], t)); gr = game("r", ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, slerp(ra[2], rb[2], t))
            cl = clearance(gl, gr, gear(gl, gr)); note("%s>%s@%.2f" % (sa, sb, t), cl)
            for k, v in cl.items(): w[k] = min(w.get(k, 9.0), v)
        blends["%s>%s" % (sa, sb)] = {k: round(v * 1000, 1) for k, v in w.items()}
        print("  %-16s %s" % (sa + ">" + sb, " ".join("%6.1f" % (v * 1000) for v in w.values())))
    out["blend_clearance_mm"] = blends
    out["worst_clearance_mm"] = {k: {"mm": round(v[0] * 1000, 1), "at": v[1]} for k, v in worst.items()}
    out["clearance_note"] = "Shield as a disc of the catalog radius; blade from grip to tip (its first 15% left out against the trunk and the shield arm, where the hand is); sword arm as capsules of 20 mm; trunk a 50 mm capsule from pelvis to neck; head a 50 mm sphere. Negative means contact."
    print("WORST", json.dumps(out["worst_clearance_mm"]))
    op = p(*a.out.split("/")); json.dump(out, open(op, "w"), indent=1); print("ARM_POSES_DONE", op)
