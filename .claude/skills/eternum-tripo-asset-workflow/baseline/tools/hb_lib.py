"""Human baseline library (numpy only): family skeleton, anatomical pose solver, linear blend skinning.

Frame (same as the runtime working frame used by the troop sessions): +Z up, -Y forward, +X the character's left,
metres, soles at z = 0. Anatomical directions: F = (0,-1,0), L = (1,0,0), U = (0,0,1).

A rig is a dict: names [J], parent [J] (index, -1 for root), rest [J,3] joint positions, tip [J,3] a point along
each bone (child joint or an explicit tail), helpers {name: rule}. Poses follow poses/SCHEMA.md.

Skinning is plain linear blend, as in three.js: v' = sum_i w_i (A_i (v - rest_i) + pos_i).
"""
import json, math, os
import numpy as np

F = np.array([0.0, -1.0, 0.0]); L = np.array([1.0, 0.0, 0.0]); U = np.array([0.0, 0.0, 1.0])
MIR = np.diag([-1.0, 1.0, 1.0])

CORE = ["root", "pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "Head",
        "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r",
        "thigh_l", "calf_l", "foot_l", "ball_l", "ball_leaf_l", "thigh_r", "calf_r", "foot_r", "ball_r", "ball_leaf_r"]
CORE_PARENT = {"root": None, "pelvis": "root", "spine_01": "pelvis", "spine_02": "spine_01", "spine_03": "spine_02", "neck_01": "spine_03", "Head": "neck_01",
               "clavicle": "spine_03", "upperarm": "clavicle", "lowerarm": "upperarm", "hand": "lowerarm",
               "thigh": "pelvis", "calf": "thigh", "foot": "calf", "ball": "foot", "ball_leaf": "ball"}
# Optional procedurally driven helper joints (never keyed by the controller). rule = (kind, parent, source, factor, at)
#   half : rotation = factor x the source bone's rotation relative to its parent (hinge bisector), placed at `at`
#   twist: rotation = factor x the source bone's twist about the parent's bone axis, placed at `at`
#   swing: rotation = factor x the source bone's swing (twist removed), placed at `at`
#   azel : factor = (ke, kh): follows the source bone's elevation by ke and its direction round the body by kh, no twist
HELPERS = {
    "elbow_half": ("half", "upperarm", "lowerarm", 0.5, "lowerarm"),
    "knee_half": ("half", "thigh", "calf", 0.5, "calf"),
    "lowerarm_twist": ("twist", "lowerarm", "hand", 0.5, ("lowerarm", "hand", 0.7)),
    # where the upper arm points, plus 40% of its roll. A shoulder plate and everything under it follow this: a plate that
    # takes the arm's whole roll turns its underside to the front in every guard pose (the Knight's library rolls the
    # arm by 20 degrees at the median, 59 at most), and one that takes none wrings the sleeve below it when the arms go
    # overhead (82 degrees of roll in reach-up).
    "upperarm_twist": ("twist", "clavicle", "upperarm", 0.4, "upperarm"),
    "pauldron": ("azel", "clavicle", "upperarm", (1.0, 0.25), "upperarm"),   # rises and falls with the arm, turns a quarter of the way round with it
    # the upper arm's direction without its roll: where the arm points, by the shortest turn from rest. The shoulder end of
    # the sleeve and a shoulder plate follow this, so the arm's roll is spread along the upper arm, not wrung at the shoulder.
    "upperarm_swing": ("swing", "clavicle", "upperarm", 1.0, "upperarm"),
}


def unit(v):
    v = np.asarray(v, float); n = np.linalg.norm(v); return v / n if n > 1e-12 else v


def rot(axis, deg):
    a = unit(axis); t = math.radians(deg); c, s = math.cos(t), math.sin(t); x, y, z = a
    return np.array([[c + x * x * (1 - c), x * y * (1 - c) - z * s, x * z * (1 - c) + y * s],
                     [y * x * (1 - c) + z * s, c + y * y * (1 - c), y * z * (1 - c) - x * s],
                     [z * x * (1 - c) - y * s, z * y * (1 - c) + x * s, c + z * z * (1 - c)]])


def frame(d, ref):
    """orthonormal frame with first column along d and second along ref projected perpendicular to d."""
    d = unit(d); r = np.asarray(ref, float) - d * float(np.dot(ref, d))
    if np.linalg.norm(r) < 1e-6: r = np.cross(d, [1.0, 0, 0]) if abs(d[0]) < 0.9 else np.cross(d, [0, 1.0, 0])
    r = unit(r); return np.stack([d, r, np.cross(d, r)], axis=1)


def axis_angle(R):
    c = max(-1.0, min(1.0, (np.trace(R) - 1) / 2)); ang = math.acos(c)
    if ang < 1e-9: return np.array([1.0, 0, 0]), 0.0
    if math.pi - ang < 1e-6:
        w, v = np.linalg.eigh((R + R.T) / 2); return unit(v[:, int(np.argmax(w))]), 180.0
    ax = np.array([R[2, 1] - R[1, 2], R[0, 2] - R[2, 0], R[1, 0] - R[0, 1]]) / (2 * math.sin(ang)); return unit(ax), math.degrees(ang)


def frac(R, k):
    ax, ang = axis_angle(R); return rot(ax, ang * k)


def swing_twist(R, axis):
    """R = swing * twist, twist about `axis` (unit)."""
    a = unit(axis); ax, ang = axis_angle(R); h = math.radians(ang) / 2
    q = np.array([math.cos(h), *(ax * math.sin(h))]); p = a * float(np.dot(q[1:], a)); tq = np.array([q[0], *p]); n = np.linalg.norm(tq)
    if n < 1e-9: return R, np.eye(3)
    tq /= n; tang = math.degrees(2 * math.atan2(float(np.dot(tq[1:], a)), tq[0])); T = rot(a, tang); return R @ T.T, T


# Trial rules without editing this table: env HB_HELPER_RULES = JSON {name: [kind, parent, source, factor, at]}.
for _k, _v in json.loads(os.environ.get("HB_HELPER_RULES", "{}")).items(): HELPERS[_k] = (_v[0], _v[1], _v[2], tuple(_v[3]) if isinstance(_v[3], list) else _v[3], tuple(_v[4]) if isinstance(_v[4], list) else _v[4])


def make_rig(joints, tips=None, helpers=(), helper_pos=None):
    """joints: {name: (x,y,z)} for the 25 core joints. helpers: iterable of HELPERS keys (both sides are added).
    helper_pos: {helper joint name: (x,y,z)} places a helper somewhere other than its rule's default joint."""
    names = list(CORE); parent = []
    for n in names:
        base, sfx = (n[:-2], n[-2:]) if n[-2:] in ("_l", "_r") else (n, "")
        p = CORE_PARENT[base]; parent.append(-1 if p is None else names.index(p + sfx if p + sfx in names else p))
    rest = np.array([joints[n] for n in names], float); rules = {}
    for h in helpers:
        kind, par, src, k, at = HELPERS[h]
        for sfx in ("_l", "_r"):
            pos = rest[names.index(at + sfx)] if isinstance(at, str) else rest[names.index(at[0] + sfx)] * (1 - at[2]) + rest[names.index(at[1] + sfx)] * at[2]
            if helper_pos and (h + sfx) in helper_pos: pos = np.array(helper_pos[h + sfx], float)
            names.append(h + sfx); parent.append(names.index(par + sfx)); rest = np.vstack([rest, pos]); rules[h + sfx] = (kind, src + sfx, k)
    tip = np.array(rest)
    for i, n in enumerate(names):
        ch = [j for j in range(len(CORE)) if parent[j] == i]
        if tips and n in tips: tip[i] = tips[n]
        elif len(ch) == 1: tip[i] = rest[ch[0]]
        elif n == "pelvis": tip[i] = rest[names.index("spine_01")]
        elif n == "spine_03": tip[i] = rest[names.index("neck_01")]
        else: tip[i] = rest[i] + np.array([0, 0, 0.03])
    return {"names": names, "parent": parent, "rest": rest, "tip": tip, "rules": rules, "helper_pos": {k: [float(x) for x in v] for k, v in (helper_pos or {}).items()}}


def rig_to_json(rig):
    return {"names": rig["names"], "parent": rig["parent"], "rest": np.asarray(rig["rest"]).round(6).tolist(), "tip": np.asarray(rig["tip"]).round(6).tolist(), "rules": {k: list(v) for k, v in rig["rules"].items()}, "helper_pos": rig.get("helper_pos", {})}


def rig_from_json(d):
    return {"names": d["names"], "parent": d["parent"], "rest": np.array(d["rest"], float), "tip": np.array(d["tip"], float), "rules": {k: tuple(v) for k, v in d.get("rules", {}).items()}, "helper_pos": d.get("helper_pos", {})}


NEUTRAL = {"pelvis": {"yaw": 0, "pitch": 0, "roll": 0, "height": 1.0}, "spine": {"flex": 0, "twist": 0, "side": 0}, "head": {"yaw": 0, "pitch": 0, "roll": 0},
           "arm": {"plane": 0, "elev": 0, "rot": 0, "elbow": 0, "pron": 0, "wrist_flex": 0, "wrist_dev": 0},
           "leg": {"hip_flex": 0, "hip_abd": 0, "hip_rot": 0, "knee": 0, "ankle": 0, "toe": 0}}


def azel_rotation(Qs, d0, k):
    """Rotation of a joint that follows how high a source bone points and which way it points round the body, never its
    twist: a shoulder plate rises and falls with the arm but does not orbit the shoulder with it.
    Qs: the source bone's turn from rest in its parent's rest axes; d0: the source bone's rest direction.
    k = (ke, kh): follow elevation by ke and direction round the body by kh; or
    k = (f_down, f_up, e_max, kh): follow by f_down when the bone is lower than at rest, by f_up when higher, levelling
    off smoothly so the joint never rises more than e_max degrees above rest."""
    d = Qs @ d0; h0 = d0 - U * float(d0 @ U); h = d - U * float(d @ U); n0 = float(np.linalg.norm(h0)); n = float(np.linalg.norm(h))
    e0 = math.degrees(math.acos(max(-1.0, min(1.0, float(-d0 @ U))))); e = math.degrees(math.acos(max(-1.0, min(1.0, float(-d @ U))))); de = e - e0
    if len(k) == 2: fe = k[0] * de; kh = k[1]
    else:
        f_down, f_up, e_max, kh = k; fe = f_down * de if de < 0 else (e_max * math.tanh(f_up * de / e_max) if e_max > 0 else 0.0)
    href = h0 / n0 if n0 > 1e-6 else L; daz = math.degrees(math.atan2(float(np.cross(href, h) @ U), float(href @ h))) if n > 1e-6 else 0.0
    return rot(U, kh * daz * min(1.0, n / 0.5)) @ rot(np.cross(-U, href), fe)


def girdle(elev):
    """automatic clavicle elevation (degrees) for an arm elevation, before subtracting the rest pose's share."""
    return max(0.0, min(18.0, (elev - 30.0) / 6.0))


def _arm_left(R0, T0, t, clav_auto=True):
    """left-arm local rotations (clavicle, upperarm, lowerarm, hand) in chest rest axes. R0/T0: rest joints and tips."""
    sh, el, wr = R0["upperarm"], R0["lowerarm"], R0["hand"]; hand_tip = T0["hand"]
    S = L
    # clavicle (shoulder-girdle rhythm), relative to the rest pose: the mesh was modelled with the arm at its rest
    # elevation, so the girdle only rises for elevation beyond that and never drops below rest. One sixth of arm
    # elevation above 30, at most 18 degrees: the shoulder joint rises about 3% of stature with the arm overhead.
    # (Until 2026-10-05 this was one third of absolute elevation, up to 45: a 24 mm shrug at 90 degrees of abduction on
    # a 0.6 m figure, and a shrug in every pose whose arm was above 30 degrees, including poses below the rest pose.)
    cl = t.get("clavicle") or {}
    e_rest = math.degrees(math.acos(max(-1.0, min(1.0, float(np.dot(unit(el - sh), -U))))))
    ce = cl.get("elev", max(0.0, girdle(t["elev"]) - girdle(e_rest)) if clav_auto else 0.0); cp = cl.get("protract", 0.0)
    pl = math.radians(t["plane"]); cp = cp + (0.0 if "protract" in cl else 12.0 * max(0.0, math.sin(pl)) * min(1.0, t["elev"] / 90.0))
    Qc = rot(U, -cp) @ rot(F, ce)
    # upper arm target frame relative to the chest (ISB plane / elevation, axial rotation counter-rotated so that
    # rot = 0 always means "forearm flexes forward" for the hanging arm and for pure abduction)
    h = math.cos(pl) * S + math.sin(pl) * F; e = math.radians(t["elev"]); d_t = math.cos(e) * (-U) + math.sin(e) * h
    f0 = F if abs(np.dot(h, F)) < 0.999 or t["elev"] < 1 else F
    # path-wise transport of the flexion direction: elevate about the axis perpendicular to the elevation plane
    ax = np.cross(-U, h); E = rot(ax, t["elev"]) if np.linalg.norm(ax) > 1e-9 else np.eye(3)
    flex_t = rot(d_t, t["rot"]) @ (E @ F)                      # + internal rotation turns the forearm toward the midline (left arm)
    d_r = unit(el - sh); fore_r = unit(wr - el)
    bend0 = math.degrees(math.acos(max(-1, min(1, float(np.dot(d_r, fore_r))))))
    flex_r = fore_r if bend0 > 6 else F
    Tr = frame(d_r, flex_r); Tt = frame(d_t, flex_t); Qu_chest = Tt @ Tr.T; Qu = Qc.T @ Qu_chest
    # elbow hinge about the rest lateral axis of the arm
    hinge = Tr[:, 2]; hinge = hinge if np.dot(np.cross(d_r, Tr[:, 1]), hinge) > 0 else -hinge
    Ql = rot(np.cross(d_r, Tr[:, 1]), t["elbow"] - bend0)
    # hand: forearm roll is applied at the wrist (the forearm bone itself does not twist: bracer and shield stay put)
    hd = unit(hand_tip - wr); lat = unit(np.cross(fore_r, Tr[:, 1])); dors = unit(np.cross(lat, fore_r))
    Qh = rot(fore_r, t["pron"]) @ rot(Tr[:, 1], -t["wrist_flex"]) @ rot(lat, t["wrist_dev"])
    return Qc, Qu, Ql, Qh


def _leg_left(R0, t):
    hip, kn, an, ba = R0["thigh"], R0["calf"], R0["foot"], R0["ball"]
    d_r = unit(kn - hip); sh_r = unit(an - kn)
    Rt = rot(L, -t["hip_flex"]) @ rot(F, t["hip_abd"]); d_t = Rt @ (-U); back_t = rot(d_t, t["hip_rot"]) @ (Rt @ (-F))
    bend0 = math.degrees(math.acos(max(-1, min(1, float(np.dot(d_r, sh_r))))))
    # The rest shin defines the knee's flexion plane only when the rest knee is really flexed, i.e. the shin leaves the
    # thigh line mostly backward. A sideways angle between thigh and shin (a wide stance with the hip pivot inside the
    # leg's own line) is not flexion: taking it as the flexion plane twisted the whole leg about the thigh (68 degrees
    # on the v13 Knight, toes turned in and feet crossed in every pose; found 2026-10-05).
    perp = sh_r - d_r * float(np.dot(sh_r, d_r)); pn = np.linalg.norm(perp)
    flexed = bend0 > 6 and pn > 1e-9 and float(np.dot(perp, -F)) / pn > 0.8
    back_r = sh_r if flexed else -F
    if not flexed: bend0 = 0.0
    Tr = frame(d_r, back_r); Tt = frame(d_t, back_t); Qt = Tt @ Tr.T
    Qc = rot(np.cross(d_r, Tr[:, 1]), t["knee"] - bend0)
    Qf = rot(L, -t["ankle"]); Qb = rot(L, -t["toe"])
    return Qt, Qc, Qf, Qb


def solve_pose(rig, targets):
    """targets per SCHEMA.md -> (A [J,3,3] world rotations rest->posed, P [J,3] posed joint positions)."""
    names, parent, rest, tip = rig["names"], rig["parent"], rig["rest"], rig["tip"]
    def T(g, side=None):
        base = dict(NEUTRAL["arm" if g.startswith("arm") else "leg" if g.startswith("leg") else g]); base.update(targets.get(g) or {}); return base
    Q = {n: np.eye(3) for n in names}
    pv, sp, hd = T("pelvis"), T("spine"), T("head")
    Q["pelvis"] = rot(U, pv["yaw"]) @ rot(L, pv["pitch"]) @ rot(F, pv["roll"])
    for b in ("spine_01", "spine_02", "spine_03"): Q[b] = rot(U, sp["twist"] / 3) @ rot(L, sp["flex"] / 3) @ rot(F, -sp["side"] / 3)
    for b, k in (("neck_01", 0.4), ("Head", 0.6)): Q[b] = rot(U, hd["yaw"] * k) @ rot(L, hd["pitch"] * k) @ rot(F, -hd["roll"] * k)
    for sfx in ("_l", "_r"):
        M = np.eye(3) if sfx == "_l" else MIR
        R0 = {b: M @ rest[names.index(b + sfx)] for b in ("clavicle", "upperarm", "lowerarm", "hand", "thigh", "calf", "foot", "ball")}
        T0 = {"hand": M @ tip[names.index("hand" + sfx)]}
        ta = T("arm" + sfx); tl = T("leg" + sfx)
        if "clavicle" in (targets.get("arm" + sfx) or {}): ta["clavicle"] = targets["arm" + sfx]["clavicle"]
        for b, q in zip(("clavicle", "upperarm", "lowerarm", "hand"), _arm_left(R0, T0, ta)): Q[b + sfx] = M @ q @ M
        for b, q in zip(("thigh", "calf", "foot", "ball"), _leg_left(R0, tl)): Q[b + sfx] = M @ q @ M
    # helper joints
    for hname, (kind, src, k) in rig["rules"].items():
        i = names.index(hname); p = parent[i]; s = names.index(src); axis = unit(tip[p] - rest[p]) if kind != "half" else None
        Qs = Q[src]
        if parent[s] != p:                                  # express the source rotation relative to the helper's parent
            chain = []; j = parent[s]
            while j != p and j != -1: chain.append(j); j = parent[j]
            for j in chain: Qs = Q[names[j]] @ Qs
        if kind == "half": Q[hname] = frac(Qs, k)
        elif kind == "twist":
            a = unit(tip[s] - rest[s]) if names[p].startswith("clavicle") else unit(tip[p] - rest[p]); sw, tw = swing_twist(Qs, a)
            Q[hname] = (sw @ frac(tw, k)) if names[p].startswith("clavicle") else frac(tw, k)
        elif kind == "swing":
            a = unit(tip[s] - rest[s]); sw, tw = swing_twist(Qs, a)
            if isinstance(k, (tuple, list)):                    # (share of the swing when the bone is lower than at rest, share when higher)
                k = k[0] if float(-(Qs @ a) @ U) > float(-a @ U) else k[1]
            Q[hname] = frac(sw, k)
        elif kind == "azel":
            Q[hname] = azel_rotation(Qs, unit(tip[s] - rest[s]), k)
    J = len(names); A = np.zeros((J, 3, 3)); P = np.zeros((J, 3))
    order = sorted(range(J), key=lambda i: _depth(parent, i))
    for i in order:
        p = parent[i]
        if p == -1: A[i] = np.eye(3); P[i] = rest[i]; continue
        A[i] = A[p] @ Q[names[i]]; P[i] = P[p] + A[p] @ (rest[i] - rest[p])
    # pelvis height: move the whole body so the pelvis sits at height x rest height
    ip = names.index("pelvis"); dz = rest[ip][2] * (pv["height"] - 1.0); P += np.array([0, 0, dz]); P[names.index("root")] = rest[names.index("root")]
    return A, P


def _depth(parent, i):
    d = 0
    while parent[i] != -1: i = parent[i]; d += 1
    return d


def skin(V, W_idx, W_val, rig, A, P):
    """V [N,3]; W_idx [N,K] joint indices; W_val [N,K] weights (rows sum to 1)."""
    rest = rig["rest"]; out = np.zeros_like(V)
    for k in range(W_idx.shape[1]):
        j = W_idx[:, k]; w = W_val[:, k:k + 1]
        out += w * (np.einsum("nij,nj->ni", A[j], V - rest[j]) + P[j])
    return out


def corner_normals(V, tris, fcls, classes):
    """Authored normals, one per face corner [F,3,3]: what an exported model carries and a game skins.

    The surface as generated is shaded smooth across every border the bind later cuts. Normals recomputed after the
    cut stop at each cut, and every cut across smooth surface (a jaw, a cheek) shows as a dark line in the rest pose.
    So: for faces of the original surface, corners at the same rest position share one normal, summed over all the
    original faces that meet there, whatever piece they belong to. Generated faces (underlay, padding, cuffs, linings)
    get the smooth normals of their own class at each vertex; a lining's and its plate's share a rim but face
    opposite ways."""
    fn = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); CN = np.zeros((len(tris), 3, 3))
    gen_ids = [int(k_) for k_, c_ in classes.items() if c_["name"] in ("underlay", "padding", "joint_fill") or c_.get("lining_of")]; gen = np.isin(fcls, gen_ids)
    _, grp = np.unique(np.round(V * 2e5).astype(np.int64), axis=0, return_inverse=True); grp = grp.ravel(); acc = np.zeros((int(grp.max()) + 1, 3)); T = tris[~gen]
    for k_ in range(3): np.add.at(acc, grp[T[:, k_]], fn[~gen])
    CN[~gen] = acc[grp[T]]
    for c_ in np.unique(fcls[gen]):
        m_ = fcls == c_; T = tris[m_]; a2 = np.zeros((len(V), 3))
        for k_ in range(3): np.add.at(a2, T[:, k_], fn[m_])
        CN[m_] = a2[T]
    return CN / np.maximum(np.linalg.norm(CN, axis=2, keepdims=True), 1e-18)



def corner_normals_lod(V, tris, fcls, classes, smooth_deg=60.0):
    """Authored normals for a reduced level of detail, one per face corner [F,3,3].

    corner_normals() sums, at each place, the normals of every original face that meets there. On the bind that hides the
    cuts between pieces. On a reduction it goes wrong at every rim: a strap, a skirt strip, a plate with its edge band are
    thin sheets with two sides, and at their rims the two sides' normals cancel. On the bind a rim is a thin line of small
    faces; on a reduction most faces have a corner on a rim, and their normals came out 60 to 90 degrees and more off the
    face (a normal behind its own face is lit as if from inside: black).
    Here the faces round a place are sorted into fans: two faces are in one fan when they share an edge there and look
    within smooth_deg of each other, and fans join through such edges. Every corner of a fan takes the fan's one normal
    (its faces' normals summed, so weighted by area): smooth across a curved plate and across the bind's cuts (a place
    is a position, whichever vertices stand on it), sharp at a rim. Generated faces fan only with faces of their own class.
    (Until 2026-10-08 each corner took the faces within smooth_deg of its own face, fan or no fan. Faces across a fan from
    each other are often further apart than that at a low level of detail, so the corners at one place got different
    normals: every such edge was lit as a crease, and the exported file needed 2.6 vertices for every place.)"""
    fn = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); fu = fn / np.maximum(np.linalg.norm(fn, axis=1, keepdims=True), 1e-30); CN = np.zeros((len(tris), 3, 3)); cs = float(np.cos(np.radians(smooth_deg)))
    gen_ids = [int(k_) for k_, c_ in classes.items() if c_["name"] in ("underlay", "padding", "joint_fill") or c_.get("lining_of")]; gen = np.isin(fcls, gen_ids)
    _, grp = np.unique(np.round(V * 2e5).astype(np.int64), axis=0, return_inverse=True); grp = grp.ravel(); G = grp[tris].astype(np.int64); key = G * (int(max(int(fcls.max()), 0)) + 2) + np.where(gen, fcls.astype(np.int64) + 1, 0)[:, None]
    order = np.argsort(key.ravel(), kind="stable"); ks = key.ravel()[order]; starts = np.concatenate([[0], np.nonzero(np.diff(ks))[0] + 1, [len(ks)]])
    for a, b in zip(starts[:-1], starts[1:]):
        fc = order[a:b]; f = fc // 3; c = fc % 3; k = len(f)
        if k == 1: CN[f[0], c[0]] = fu[f[0]]; continue
        o1 = G[f, (c + 1) % 3]; o2 = G[f, (c + 2) % 3]                          # each face's two other places: two faces share an edge here when they share one of them
        adj = ((o1[:, None] == o1[None, :]) | (o1[:, None] == o2[None, :]) | (o2[:, None] == o1[None, :]) | (o2[:, None] == o2[None, :])) & ((fu[f] @ fu[f].T) >= cs)
        fan = np.arange(k)
        for _ in range(k):                                                     # join through shared edges until nothing changes (k is small: the faces round one place)
            nf = np.where(adj, fan[None, :], k).min(1); nf = np.minimum(nf, fan)
            if (nf == fan).all(): break
            fan = nf
        dots = fu[f] @ fu[f].T
        for g in np.unique(fan):
            m = np.nonzero(fan == g)[0]; acc = fn[f[m]].sum(0); n_ = np.linalg.norm(acc); nu = (acc / n_) if n_ > 1e-30 else None
            for i in m:
                # A fan that runs round a rounded edge or a point joins faces far apart, and its one normal can stand behind some of them (lit as if from
                # inside: black). A corner whose fan normal is further than smooth_deg from its own face takes, of its fan, only the faces within smooth_deg of it.
                if nu is not None and float(nu @ fu[f[i]]) >= cs: CN[f[i], c[i]] = nu
                else:
                    mm = m[dots[i, m] >= cs]; a2 = fn[f[mm]].sum(0); n2 = np.linalg.norm(a2); CN[f[i], c[i]] = (a2 / n2) if n2 > 1e-30 else fu[f[i]]
    return CN

def skin_normals(CN, tris, W_idx, W_val, A):
    """corner normals [F,3,3] carried by each corner's own vertex: rotated by its joints' blended rotation, as a game does"""
    M = np.zeros((len(W_idx), 3, 3))
    for k_ in range(W_idx.shape[1]): M += W_val[:, k_, None, None] * A[W_idx[:, k_]]
    N = np.einsum("fkij,fkj->fki", M[tris], CN); return N / np.maximum(np.linalg.norm(N, axis=2, keepdims=True), 1e-18)


def dense_to_top4(Wd, k=4):
    idx = np.argsort(-Wd, axis=1)[:, :k]; val = np.take_along_axis(Wd, idx, axis=1); val = np.where(val < 1e-4, 0.0, val)
    s = val.sum(1, keepdims=True); s[s == 0] = 1.0; return idx.astype(np.int32), (val / s).astype(np.float64)


def load_pose_sets(folder, sets):
    import os
    out = []
    for s in sets:
        fp = os.path.join(folder, s + ".json")
        if not os.path.exists(fp): continue
        d = json.load(open(fp))
        for p_ in d["poses"]: out.append({"set": s, "id": p_["id"], "targets": p_.get("targets", {}), "support": p_.get("support", [])})
    return out


def rom_poses():
    """Generated range-of-motion set: every joint to its working limit, alone and in the common combinations."""
    P = []
    def add(i, stress, **t): P.append({"set": "rom", "id": i, "targets": t, "stress": stress})
    for a in (45, 90, 140): add(f"elbow-{a}", ["elbow"], arm_l={"elbow": a}, arm_r={"elbow": a})
    for a in (45, 90, 135): add(f"knee-{a}", ["knee"], leg_l={"knee": a, "hip_flex": a * 0.5}, leg_r={"knee": a, "hip_flex": a * 0.5})
    for pl in (0, 45, 90):
        for e in (45, 90, 135, 170): add(f"arm-p{pl}-e{e}", ["shoulder"], arm_l={"plane": pl, "elev": e}, arm_r={"plane": pl, "elev": e})
    add("arm-back-40", ["shoulder"], arm_l={"plane": -40, "elev": 40}, arm_r={"plane": -40, "elev": 40})
    # one arm at a time: two arms crossed at the same height pass through each other, which no body can do
    add("arm-cross-l", ["shoulder"], arm_l={"plane": 125, "elev": 80, "elbow": 40}, arm_r={"elev": 15})
    add("arm-cross-r", ["shoulder"], arm_r={"plane": 125, "elev": 80, "elbow": 40}, arm_l={"elev": 15})
    for r in (-80, 80):
        add(f"arm-rot{r}-hang", ["shoulder", "upperarm_twist"], arm_l={"rot": r, "elbow": 90}, arm_r={"rot": -r, "elbow": 90, "elev": 30})   # opposite turns, the outward arm held clear: both turned inward cross through each other
        add(f"arm-rot{r}-abd90", ["shoulder", "upperarm_twist"], arm_l={"plane": 0, "elev": 90, "rot": r, "elbow": 90}, arm_r={"plane": 0, "elev": 90, "rot": r, "elbow": 90})
        add(f"pron{r}", ["wrist", "forearm_twist"], arm_l={"elbow": 90, "pron": r}, arm_r={"elbow": 90, "pron": r})
    for w in (-30, 30): add(f"wrist-flex{w}", ["wrist"], arm_l={"elbow": 60, "wrist_flex": w, "elev": 12}, arm_r={"elbow": 60, "wrist_flex": w, "elev": 12})
    for w in (-25, 20): add(f"wrist-dev{w}", ["wrist"], arm_l={"elbow": 60, "wrist_dev": w}, arm_r={"elbow": 60, "wrist_dev": w})
    for a in (45, 90, 110): add(f"hip-flex{a}", ["hip"], leg_l={"hip_flex": a, "knee": 20}, leg_r={"hip_flex": 0})
    add("hip-ext20", ["hip"], leg_l={"hip_flex": -20}, leg_r={"hip_flex": 10})
    add("hip-abd45", ["hip"], leg_l={"hip_abd": 45}, leg_r={"hip_abd": 20})
    for r in (-40, 35): add(f"hip-rot{r}", ["hip"], leg_l={"hip_rot": r, "hip_flex": 30, "knee": 60}, leg_r={"hip_abd": 22})   # one leg at a time, the standing leg set wide: both turned the same way cross at the shins
    for a in (-40, 20): add(f"ankle{a}", ["ankle"], leg_l={"ankle": a}, leg_r={"ankle": a})
    add("toe60", ["ball"], leg_l={"toe": 60, "ankle": -20}, leg_r={"toe": 60, "ankle": -20})
    for a in (-25, 30, 60): add(f"spine-flex{a}", ["spine"], spine={"flex": a})
    for a in (-45, 45): add(f"spine-twist{a}", ["spine"], spine={"twist": a})
    for a in (-30, 30): add(f"spine-side{a}", ["spine"], spine={"side": a})
    for a in (-75, 75): add(f"head-yaw{a}", ["neck"], head={"yaw": a})
    for a in (-45, 45): add(f"head-pitch{a}", ["neck"], head={"pitch": a})
    add("head-roll30", ["neck"], head={"roll": 30})
    add("squat", ["hip", "knee", "ankle"], pelvis={"height": 0.55, "pitch": 20}, spine={"flex": 20}, leg_l={"hip_flex": 110, "hip_abd": 15, "knee": 135, "ankle": 20}, leg_r={"hip_flex": 110, "hip_abd": 15, "knee": 135, "ankle": 20}, arm_l={"plane": 90, "elev": 70}, arm_r={"plane": 90, "elev": 70})
    add("reach-up-twist", ["shoulder", "spine"], spine={"twist": 30, "flex": -10}, arm_l={"plane": 70, "elev": 165}, arm_r={"plane": 70, "elev": 165}, head={"pitch": -30})
    add("seated-ride", ["hip", "knee"], pelvis={"height": 0.9}, leg_l={"hip_flex": 55, "hip_abd": 35, "hip_rot": -10, "knee": 70, "ankle": 10}, leg_r={"hip_flex": 55, "hip_abd": 35, "hip_rot": -10, "knee": 70, "ankle": 10}, arm_l={"plane": 80, "elev": 30, "elbow": 80}, arm_r={"plane": 80, "elev": 30, "elbow": 80})
    add("kneel", ["hip", "knee", "ankle", "ball"], pelvis={"height": 0.5}, leg_l={"hip_flex": 90, "knee": 95}, leg_r={"hip_flex": -5, "knee": 120, "ankle": -30, "toe": 50})
    return P


def _seg_dist(p1, q1, p2, q2):
    """shortest distance between segments p1-q1 and p2-q2."""
    d1, d2, r = q1 - p1, q2 - p2, p1 - p2; a, e, f = float(d1 @ d1), float(d2 @ d2), float(d2 @ r)
    if a < 1e-12 and e < 1e-12: return float(np.linalg.norm(r))
    if a < 1e-12: s_, t_ = 0.0, min(1.0, max(0.0, f / e))
    else:
        c = float(d1 @ r)
        if e < 1e-12: t_, s_ = 0.0, min(1.0, max(0.0, -c / a))
        else:
            b = float(d1 @ d2); den = a * e - b * b; s_ = min(1.0, max(0.0, (b * f - c * e) / den)) if den > 1e-12 else 0.0
            t_ = (b * s_ + f) / e
            if t_ < 0: t_, s_ = 0.0, min(1.0, max(0.0, -c / a))
            elif t_ > 1: t_, s_ = 1.0, min(1.0, max(0.0, (b - c) / a))
    return float(np.linalg.norm((p1 + d1 * s_) - (p2 + d2 * t_)))


def limb_clearance(rig, A, P, stature=0.6):
    """Clearance (m) between the left and right forearm-and-hand chains and between the left and right lower legs
    (knee to toe) in a pose, as capsules. Negative means the limbs pass through each other: the pose is not possible."""
    names, rest, tip = rig["names"], rig["rest"], rig["tip"]; ix = names.index
    def chain(js, sfx):
        pts = [P[ix(j + sfx)] for j in js]; last = ix(js[-1] + sfx); pts.append(P[last] + A[last] @ (tip[last] - rest[last])); return pts
    out = {}
    for key, js, r in (("arms", ("lowerarm", "hand"), 0.033 * stature), ("legs", ("calf", "foot", "ball"), 0.045 * stature)):
        l, rr = chain(js, "_l"), chain(js, "_r")
        out[key] = min(_seg_dist(l[i], l[i + 1], rr[j], rr[j + 1]) for i in range(len(l) - 1) for j in range(len(rr) - 1)) - 2 * r
    return out
