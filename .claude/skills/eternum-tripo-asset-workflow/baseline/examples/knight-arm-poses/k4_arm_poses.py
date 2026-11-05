"""The Knight's poses for the game's controller, from the approved pose library, with the game's limits applied.

Reads pose-reference.json (k4_pose_reference.py) for the arms, solves the approved poses again for trunk, head and
feet, and writes one table the game's gear catalog declares and its tests check against:

  states.<name>: one approved pose (or the halfway point of two), with
    left / right:  wrist, elbow (the point the elbow bends toward) and hand_turn_xyzw (the hand's turn on the forearm),
                   relative to the chest (the point midway between the shoulder joints, in spine_03's frame);
    body:          pelvis yaw / pitch / roll (degrees, in the actor's frame; yaw positive to the left, pitch positive
                   leaning forward), pelvis height as a fraction of its rest height, the pelvis' place over the stance
                   (forward and left of the midpoint between the ankles, metres); spine flex / twist / side (the chest
                   against the pelvis); head yaw / pitch (the head against the chest);
    stance:        each foot's ankle forward and left of the midpoint between the ankles, and its yaw (toes turned
                   left positive), in the actor's frame; which parts touch the ground;
    expect:        what a game arm posed in the elbow's hinge frame from an unmoving shoulder then shows, as before.
  groups: which states are idle variants, which are the guard held on the move, which make up each attack.

The game does what the approved solver did: the shoulder stays where it rests, a two-bone reach whose elbow bends
toward the approved elbow, hinge arms, the approved turn of the hand on the forearm.

Numpy only. Paths are relative to the baseline folder or absolute:
  "$HB_PYTHON" k4_arm_poses.py --char <character>/char.json --bound <character>/work/bound-r71.npz \
        --ref <character>/work/integration/pose-reference.json --fit <character>/export/runtime-fit.json \
        --out <character>/work/integration/arm-poses.json
"""
import argparse, json, math, os, sys
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = next((t for t in (os.path.join(HERE, "..", "..", "tools"), os.path.join(HERE, "..", "..", "..", "human-baseline", "tools")) if os.path.isfile(os.path.join(t, "hb_lib.py"))), None)
if TOOLS is None: raise SystemExit("the baseline's tools were not found beside this script")
sys.path.insert(0, os.path.normpath(TOOLS)); sys.path.insert(0, HERE)
from hb_common import p                                                 # noqa: E402
import hb_lib as H, hb_harness as HN, hb_helpers as HH                  # noqa: E402
from hb_export import C, to_game                                        # noqa: E402

# game state -> approved pose (or the halfway point of two). The arms of every state come from the pose itself; the
# shield arm no longer holds one guard through an attack, the approved pose says where it is.
STATES = {
    "idle-relaxed": ("idle-relaxed", None), "idle-at-ease": ("idle-at-ease", None), "sword-on-shoulder": ("sword-on-shoulder", None),
    "guard": ("guard-middle", None), "walk-guard": ("advance-behind-shield", None), "run-guard": ("run-charge", None),
    "hit": ("hit-react", None),
    "cut-windup": ("cut-windup", None), "cut-contact": ("cut-mid", "cut-followthrough"), "cut-follow": ("cut-followthrough", None),
    "backhand-windup": ("backhand-cut-windup", None), "backhand-contact": ("backhand-cut-mid", "backhand-cut-followthrough"), "backhand-follow": ("backhand-cut-followthrough", None),
    "chop-windup": ("chop-overhead-raise", None), "chop-contact": ("chop-overhead-strike", None), "chop-follow": ("chop-overhead-strike", None),
    "thrust-windup": ("thrust-chamber", None), "thrust-contact": ("thrust-extension", None), "thrust-follow": ("thrust-extension", None),
}
GROUPS = {"idle": ["idle-relaxed", "idle-at-ease", "sword-on-shoulder"], "guard": "guard", "walk_guard": "walk-guard", "run_guard": "run-guard", "hit": "hit",
          "attacks": {"cut": ["cut-windup", "cut-contact", "cut-follow"], "backhand": ["backhand-windup", "backhand-contact", "backhand-follow"],
                      "chop": ["chop-windup", "chop-contact", "chop-follow"], "thrust": ["thrust-windup", "thrust-contact", "thrust-follow"]}}
# the chain the game blends along, for the clearance of the blends between states
BLENDS = [("idle-relaxed", "guard"), ("idle-at-ease", "guard"), ("sword-on-shoulder", "guard"), ("idle-relaxed", "walk-guard"), ("walk-guard", "run-guard"), ("walk-guard", "guard"),
          ("guard", "cut-windup"), ("cut-windup", "cut-contact"), ("cut-contact", "cut-follow"), ("cut-follow", "guard"),
          ("guard", "backhand-windup"), ("backhand-windup", "backhand-contact"), ("backhand-contact", "backhand-follow"), ("backhand-follow", "guard"),
          ("guard", "chop-windup"), ("chop-windup", "chop-contact"), ("chop-contact", "chop-follow"), ("chop-follow", "guard"),
          ("guard", "thrust-windup"), ("thrust-windup", "thrust-contact"), ("thrust-contact", "thrust-follow"), ("thrust-follow", "guard"),
          ("guard", "hit"), ("idle-relaxed", "hit")]
U, F, L = H.U, H.F, H.L


def unit(v):
    v = np.asarray(v, float); n = np.linalg.norm(v); return v / n if n > 1e-12 else v


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
    d = W - S; Ln = float(np.linalg.norm(d)); u = d / Ln; pv = pole - S; n = unit(pv - u * float(pv @ u)); h = unit(np.cross(u, n))
    if Ln >= a + b - 1e-9: return S + u * a, S + u * (a + b), h
    x = (a * a - b * b + Ln * Ln) / (2 * Ln); hh = math.sqrt(max(a * a - x * x, 0.0)); return S + u * x + n * hh, W.copy(), h


def point_to_disc(P, c, n, R):
    d = float((P - c) @ n); q = P - c - n * d; rho = float(np.linalg.norm(q))
    return abs(d) if rho <= R else math.hypot(d, rho - R)


def seg_points(A, B, k=40): return [A + (B - A) * (i / (k - 1)) for i in range(k)]


def point_to_seg(P, A, B):
    ab = B - A; t = max(0.0, min(1.0, float((P - A) @ ab) / float(ab @ ab))); return float(np.linalg.norm(P - (A + ab * t)))


def seg_to_seg(A, B, Cc, D): return min(min(point_to_seg(P, Cc, D) for P in seg_points(A, B)), min(point_to_seg(P, A, B) for P in seg_points(Cc, D)))


def orient(R):
    """yaw (left positive), pitch (leaning forward positive), roll (left side down positive) of a frame turned by R from rest."""
    f = R @ F; l = R @ L
    yaw = math.atan2(float(np.dot(f, L)), float(np.dot(f, F))); pitch = math.asin(max(-1.0, min(1.0, -float(f[2])))); roll = math.asin(max(-1.0, min(1.0, -float(l[2]))))
    return math.degrees(yaw), math.degrees(pitch), math.degrees(roll)


def body_and_stance(names, A, P, rest, support):
    """trunk, head and feet of a solved pose, in the actor's frame (game axes: +X left, +Y up, +Z forward)"""
    ix = names.index; pel = A[ix("pelvis")]; chest = A[ix("spine_03")]; head = A[ix("Head")]
    y, pch, r = orient(pel); st, sf, ss = orient(pel.T @ chest); hy, hp, _ = orient(chest.T @ head)   # orient gives yaw (twist), pitch (flex), roll (side)
    ankles = {s: P[ix("foot_" + s)] for s in ("l", "r")}; balls = {s: P[ix("ball_" + s)] for s in ("l", "r")}
    centre = (ankles["l"] + ankles["r"]) / 2; g = lambda v: to_game(v)
    def foot(s):
        a, b = g(ankles[s] - centre), g(balls[s] - ankles[s])
        return {"forward": round(float(a[2]), 4), "left": round(float(a[0]), 4), "yaw": round(math.degrees(math.atan2(float(b[0]), float(b[2]))), 1)}
    pelvis_over = g(P[ix("pelvis")] - centre)
    return {"pelvis": {"yaw": round(y, 1), "pitch": round(pch, 1), "roll": round(r, 1), "height": round(float(P[ix("pelvis")][2] / rest[ix("pelvis")][2]), 4),
                       "forward": round(float(pelvis_over[2]), 4), "left": round(float(pelvis_over[0]), 4)},
            "spine": {"flex": round(sf, 1), "twist": round(st, 1), "side": round(ss, 1)}, "head": {"yaw": round(hy, 1), "pitch": round(hp, 1)}}, \
           {"left": foot("l"), "right": foot("r"), "support": list(support)}


def lerp_body(a, b, t):
    return {k: {kk: round(a[k][kk] + (b[k][kk] - a[k][kk]) * t, 4) for kk in a[k]} for k in a}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--bound", required=True); ap.add_argument("--ref", required=True); ap.add_argument("--fit", required=True)
    ap.add_argument("--helpers", default="elbow_half,knee_half,upperarm_twist"); ap.add_argument("--out", required=True); a = ap.parse_args()
    ref = json.load(open(p(*a.ref.split("/")))); fit = json.load(open(p(*a.fit.split("/"))))
    V, tris, W_, rig0, cls, classes = HN.load_bound(p(*a.bound.split("/")))
    rig, _ = HH.add_helpers(V, W_, rig0, [h for h in a.helpers.split(",") if h], cls, classes)
    names = list(rig["names"]); rest_w = np.array(rig["rest"], float)
    library = {q["id"]: q for q in H.load_pose_sets(p("poses"), ["knight"])}
    Ms, Mw = (np.array(fit["sockets"][k]["matrix_rows"], float) for k in ("shield", "sword"))
    rest = {k: np.array(v, float) for k, v in ref["rest"].items()}; RAD = float(ref["shield_radius"]); LEN = float(ref["sword_length"])
    arm = {}
    for s in ("l", "r"):
        S0, E0, W0 = rest["upperarm_" + s], rest["lowerarm_" + s], rest["hand_" + s]
        arm[s] = {"S0": S0, "E0": E0, "W0": W0, "a": float(np.linalg.norm(E0 - S0)), "b": float(np.linalg.norm(W0 - E0)), "h0": unit(np.cross(W0 - E0, E0 - S0))}
    solved = {pid: H.solve_pose(rig, q["targets"]) for pid, q in library.items()}

    def arm_source(pid_a, pid_b, s):
        def one(pid):
            e = ref["poses"][pid]["arm_" + s]; return np.array(e["wrist"], float), np.array(e["elbow"], float), m2q(q2m(e["lowerarm_turn_xyzw"]).T @ q2m(e["hand_turn_xyzw"]))
        w, el, q = one(pid_a)
        if pid_b: w2, el2, q2 = one(pid_b); w, el, q = (w + w2) / 2, (el + el2) / 2, slerp(q, q2, 0.5)
        return w, el, q

    def body_source(pid_a, pid_b):
        A_, P_ = solved[pid_a]; b1, s1 = body_and_stance(names, A_, P_, rest_w, library[pid_a].get("support", []))
        if not pid_b: return b1, s1
        A2, P2 = solved[pid_b]; b2, s2 = body_and_stance(names, A2, P2, rest_w, library[pid_b].get("support", []))
        st = {side: {k: round((s1[side][k] + s2[side][k]) / 2, 4) for k in s1[side]} for side in ("left", "right")}; st["support"] = s1["support"]
        return lerp_body(b1, b2, 0.5), st

    def game(s, wrist, pole, wrist_q):
        A = arm[s]; E, Wc, h = two_bone(A["S0"], wrist, pole, A["a"], A["b"])
        Rf = hinge_frame(Wc - E, h) @ hinge_frame(A["W0"] - A["E0"], A["h0"]).T; Ru = hinge_frame(E - A["S0"], h) @ hinge_frame(A["E0"] - A["S0"], A["h0"]).T
        return {"elbow": E, "wrist": Wc, "Rf": Rf, "Ru": Ru, "Rh": Rf @ q2m(wrist_q), "short_mm": float(np.linalg.norm(wrist - Wc)) * 1000}

    def gear(gl, gr):
        front = gl["Rf"] @ Ms[:3, 2]; centre = gl["elbow"] + gl["Rf"] @ Ms[:3, 3]; blade = gr["Rh"] @ Mw[:3, 1]; grip = gr["wrist"] + gr["Rh"] @ Mw[:3, 3]
        return {"centre": centre, "front": front, "grip": grip, "tip": grip + blade * LEN, "blade": blade}

    HEAD_C = rest["Head"] + np.array([0.0, 0.02, 0.01]); HEAD_R = 0.05; GROUND_Y = -0.4768
    def clearance(gl, gr, g):
        blade_pts = seg_points(g["grip"], g["tip"]); c, n = g["centre"], g["front"]; arm_pts = seg_points(gr["elbow"], gr["wrist"], 20) + seg_points(gr["wrist"], g["grip"], 6)
        blade_body = (g["grip"] + (g["tip"] - g["grip"]) * 0.15, g["tip"])
        return {"blade_to_shield": min(point_to_disc(P, c, n, RAD) for P in blade_pts), "sword_arm_to_shield": min(point_to_disc(P, c, n, RAD) for P in arm_pts) - 0.02,
                "blade_to_head": min(float(np.linalg.norm(P - HEAD_C)) for P in blade_pts) - HEAD_R,
                "blade_to_trunk": seg_to_seg(*blade_body, rest["pelvis"], rest["neck_01"]) - 0.05,
                "blade_to_shield_arm": min(seg_to_seg(*blade_body, gl["elbow"], gl["wrist"]), seg_to_seg(*blade_body, arm["l"]["S0"], gl["elbow"])) - 0.02,
                "sword_arm_to_shield_arm": min(seg_to_seg(gr["elbow"], gr["wrist"], gl["elbow"], gl["wrist"]), seg_to_seg(gr["elbow"], gr["wrist"], arm["l"]["S0"], gl["elbow"]), seg_to_seg(arm["r"]["S0"], gr["elbow"], gl["elbow"], gl["wrist"])) - 0.04,
                "shield_to_head": min(float(np.linalg.norm(HEAD_C - (c + RAD * (math.cos(t) * unit(np.cross(n, [0, 0, 1.0])) + math.sin(t) * unit(np.cross(n, np.cross(n, [0, 0, 1.0]))))))) for t in np.linspace(0, 2 * math.pi, 72)) - HEAD_R,
                "tip_above_ground": float(g["tip"][1] - GROUND_Y)}

    src = {st: {"l": arm_source(*STATES[st], "l"), "r": arm_source(*STATES[st], "r"), "body": body_source(*STATES[st])} for st in STATES}
    out = {"from": dict(ref["from"], tool="k4_pose_reference.py, k4_arm_poses.py"),
           "frame": "the game's axes (+X left, +Y up, +Z forward), metres and degrees. Arms relative to the chest (the point midway between the shoulder joints, in spine_03's frame). Body in the actor's frame: pelvis yaw left positive, pitch leaning forward positive, roll left side down positive, height a fraction of the rest pelvis height, forward and left of the midpoint between the ankles; spine against the pelvis; head against the chest. Stance: each ankle forward and left of that midpoint, toes' yaw left positive.",
           "what": "Where the Knight holds itself with shield and sword, from the pose set approved with the gear: idle variants, the guard standing and on the move, four attacks in three moments each, and the hit reaction. wrist: where the wrist goes. elbow: the point the elbow bends toward. hand_turn_xyzw: the hand's turn on the forearm. expect: what a game arm posed in the elbow's hinge frame from an unmoving shoulder then shows, with the chest in the body's frame.",
           "groups": GROUPS, "states": {}}
    worst = {}
    def note(tag, cl):
        for k, v in cl.items():
            if k not in worst or v < worst[k][0]: worst[k] = (v, tag)
    print("%-18s %-44s %s" % ("state", "from", "clearances (mm): blade-shield arm-shield blade-head blade-trunk blade-shieldarm arms shield-head tip-ground | shield L/up | blade up/L | pelvis yaw pitch h | spine flex twist | head yaw | feet fwd L R"))
    for st in STATES:
        (wl, el, ql), (wr, er, qr), (body, stance) = src[st]["l"], src[st]["r"], src[st]["body"]
        gl, gr = game("l", wl, el, ql), game("r", wr, er, qr); g = gear(gl, gr); cl = clearance(gl, gr, g); note(st, cl)
        fr = g["front"]; bl = g["blade"]; pose_a, pose_b = STATES[st]; lib = ref["poses"].get(pose_a)
        out["states"][st] = {"from_pose": pose_a if not pose_b else "halfway between %s and %s" % (pose_a, pose_b),
                             "left": {"wrist": r5(wl), "elbow": r5(el), "hand_turn_xyzw": r5(ql)}, "right": {"wrist": r5(wr), "elbow": r5(er), "hand_turn_xyzw": r5(qr)},
                             "body": body, "stance": stance,
                             "expect": {"left_elbow": r5(gl["elbow"]), "left_wrist": r5(gl["wrist"]), "right_elbow": r5(gr["elbow"]), "right_wrist": r5(gr["wrist"]),
                                        "shield_centre": r5(g["centre"]), "shield_front": r5(fr), "sword_grip": r5(g["grip"]), "sword_tip": r5(g["tip"]), "blade": r5(bl),
                                        "clearance_mm": {k: round(v * 1000, 1) for k, v in cl.items()}},
                             "against_the_approved_pose": None if pose_b or lib is None else {"shield_front_deg": round(angle(fr, lib["shield"]["front"]), 1), "shield_centre_mm": round(float(np.linalg.norm(g["centre"] - np.array(lib["shield"]["centre"]))) * 1000, 1),
                                                                                              "blade_deg": round(angle(bl, lib["sword"]["blade"]), 1), "grip_mm": round(float(np.linalg.norm(g["grip"] - np.array(lib["sword"]["grip"]))) * 1000, 1)}}
        print("%-18s %-44s %s | L%5.1f up%5.1f | up%5.1f L%6.1f | %6.1f %5.1f %.3f | %5.1f %6.1f | %6.1f | %+.3f %+.3f | vs approved %s" % (
            st, out["states"][st]["from_pose"], " ".join("%6.1f" % (v * 1000) for v in cl.values()), math.degrees(math.atan2(fr[0], fr[2])), math.degrees(math.asin(fr[1])),
            math.degrees(math.asin(bl[1])), math.degrees(math.atan2(bl[0], bl[2])), body["pelvis"]["yaw"], body["pelvis"]["pitch"], body["pelvis"]["height"], body["spine"]["flex"], body["spine"]["twist"], body["head"]["yaw"],
            stance["left"]["forward"], stance["right"]["forward"], out["states"][st]["against_the_approved_pose"]))
    print("blends (worst over 12 steps each), same columns:")
    blends = {}
    for sa, sb in BLENDS:
        w = {}
        for i in range(13):
            t = i / 12.0; la, lb = src[sa]["l"], src[sb]["l"]; ra, rb = src[sa]["r"], src[sb]["r"]
            gl = game("l", la[0] + (lb[0] - la[0]) * t, la[1] + (lb[1] - la[1]) * t, slerp(la[2], lb[2], t)); gr = game("r", ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, slerp(ra[2], rb[2], t))
            cl = clearance(gl, gr, gear(gl, gr)); note("%s>%s@%.2f" % (sa, sb, t), cl)
            for k, v in cl.items(): w[k] = min(w.get(k, 9.0), v)
        blends["%s>%s" % (sa, sb)] = {k: round(v * 1000, 1) for k, v in w.items()}
        print("  %-34s %s" % (sa + ">" + sb, " ".join("%6.1f" % (v * 1000) for v in w.values())))
    out["blend_clearance_mm"] = blends; out["worst_clearance_mm"] = {k: {"mm": round(v[0] * 1000, 1), "at": v[1]} for k, v in worst.items()}
    out["clearance_note"] = "Arms only, in the chest's frame: shield as a disc of the catalog radius; blade from grip to tip (its first 15% left out against the trunk and the shield arm, where the hand is); sword arm as capsules of 20 mm; trunk a 50 mm capsule from pelvis to neck at rest; head a 50 mm sphere at rest. Negative means contact. The game's own test measures the whole figure through its controller."
    print("WORST", json.dumps(out["worst_clearance_mm"]))
    op = p(*a.out.split("/")); json.dump(out, open(op, "w"), indent=1); print("ARM_POSES_DONE", op)
