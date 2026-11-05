"""Bind a labelled character to the family skeleton.
env HB_CHAR = char.json spec (under human-baseline). Optional HB_HELPERS (comma list), HB_TAG, HB_FUSE=1 (soft weights
meet plate weights at plate borders; default: soft weights come only from the template).

Soft classes: weights transferred from the template body (fitted to the character's joints) by the robust transfer
method (Abdrashitov et al. 2023): accept a nearest-surface match only where distance and normals agree, then inpaint
the rest by solving a Laplace problem over the character's own surface. Rigid classes: one joint each, by table.
No weights are painted or solved from the armature here.
Writes <work>/bound[-tag].npz/.json and runs the deformation harness on it."""
import bpy, bmesh, os, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH
SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); TAG = os.environ.get("HB_TAG", "")
d = np.load(os.path.join(WORK, "character.npz")); meta = json.load(open(os.path.join(WORK, "character.json")))
V, tris, cls = d["V"].astype(float), d["tris"].astype(np.int64), d["cls"]; rig = H.rig_from_json(meta["rig"])
from hb_common import load_classes
classes = dict(load_classes(SPEC, os.path.normpath(p(*SPEC["packet"].split("/")))))          # the spec (or its legend) is the authority for the class table
for cid_, c_ in meta.get("classes", {}).items():                                                # plus classes made by tools after the import (a guide bore's channel, a class a patch in the spec made)
    if (c_.get("generated") or c_.get("patched")) and cid_ not in classes: classes[cid_] = dict(c_); classes[cid_].update(SPEC["labels"].get("overrides", {}).get(c_["name"], {}))
# A guide that has not been bored out yet stays on the mesh, rigid on its hand. (Until 2026-10-06 the bind deleted every
# face touching a guide-labelled vertex, which left a stub of the bar and cut pieces out of the fist.)
for cid_, c_ in classes.items():
    if c_["kind"] == "remove":
        m_ = cls == int(cid_)
        if m_.any(): c_["kind"] = "rigid"; c_["bone"] = "hand_l" if float(V[m_, 0].mean()) > 0 else "hand_r"; c_["kept_guide"] = True
t = np.load(p("template", "template.npz")); tm = json.load(open(p("template", "template.json"))); TV, Ttris, TW = t["V"].astype(float), t["tris"].astype(np.int64), t["W"].astype(float); trig = H.rig_from_json(tm["rig"])
names = rig["names"]; J = len(names)
# ---- label sanity: a class that declares a body region cannot own faces that plainly sit on another limb (labels
# flooded onto faces no view could see). Those faces go back to plain 'soft'.
fcls0 = d["fcls"].copy(); relabelled = 0
def _capd(Pt, a, b, r):
    ab = b - a; tt = np.clip(((Pt - a) @ ab) / max(float(ab @ ab), 1e-12), 0, 1); return np.linalg.norm(Pt - (a + np.outer(tt, ab)), axis=1) / r
_FC = V[tris].mean(1); _rs = rig["rest"]; _jn = lambda n: _rs[names.index(n)]; _soft_id = [int(k_) for k_, c_ in classes.items() if c_["name"] == "soft"]
if _soft_id:
    _arm = np.minimum.reduce([np.minimum(_capd(_FC, _jn("upperarm" + s_), _jn("lowerarm" + s_), 0.03), _capd(_FC, _jn("lowerarm" + s_), _jn("hand" + s_), 0.027)) for s_ in ("_l", "_r")])
    _leg = np.minimum.reduce([np.minimum(_capd(_FC, _jn("thigh" + s_), _jn("calf" + s_), 0.051), _capd(_FC, _jn("calf" + s_), _jn("foot" + s_), 0.039)) for s_ in ("_l", "_r")])
    _tor = np.sqrt((_FC[:, 0] / 0.075) ** 2 + ((_FC[:, 1] - _jn("spine_02")[1]) / 0.057) ** 2)
    for cid, c in classes.items():
        if c.get("region") == "torso":
            bad = (fcls0 == int(cid)) & (_arm < 0.95) & (_tor > 1.0) & (_FC[:, 2] < _jn("upperarm_l")[2] - 0.012); fcls0[bad] = _soft_id[0]; relabelled += int(bad.sum())
        if c.get("region") == "leg":
            bad = (fcls0 == int(cid)) & (_arm < 0.9) & (_leg > 1.2); fcls0[bad] = _soft_id[0]; relabelled += int(bad.sum())
# ---- 1. fit the template to the character's joints: one similarity transform per bone, blended by the template weights
def align(a, b):
    a, b = H.unit(a), H.unit(b); ax = np.cross(a, b); n = np.linalg.norm(ax)
    return np.eye(3) if n < 1e-9 else H.rot(ax / n, math.degrees(math.atan2(n, float(a @ b))))
Rb = np.zeros((J, 3, 3)); sb = np.ones(J)
torso = ("pelvis", "spine_01", "spine_02", "spine_03"); iz = lambda n: names.index(n)
s_torso = (rig["rest"][iz("neck_01")][2] - rig["rest"][iz("pelvis")][2]) / (trig["rest"][iz("neck_01")][2] - trig["rest"][iz("pelvis")][2])
w_torso = abs(rig["rest"][iz("upperarm_l")][0]) / abs(trig["rest"][iz("upperarm_l")][0])
for i, n in enumerate(names):
    tv = trig["tip"][i] - trig["rest"][i]; cv = rig["tip"][i] - rig["rest"][i]
    if n == "root" or n in torso: Rb[i] = np.eye(3); sb[i] = (s_torso + w_torso) / 2
    else: Rb[i] = align(tv, cv); sb[i] = np.linalg.norm(cv) / max(np.linalg.norm(tv), 1e-9)
    if n in ("neck_01", "Head") or n.startswith("ball") or n.startswith("hand"): sb[i] = max(sb[i], 0.5)
TF = np.zeros_like(TV)
for i in range(J):
    w = TW[:, i:i + 1]
    if w.max() < 1e-6: continue
    TF += w * ((TV - trig["rest"][i]) @ Rb[i].T * sb[i] + rig["rest"][i])
tb = BVHTree.FromPolygons([tuple(q) for q in TF], [tuple(f) for f in Ttris])
def _body(Pq):
    # nearest point of the fitted template body, for the underlay under plate rims (hb_split.split_underlay)
    Q_ = np.zeros_like(Pq); dq_ = np.zeros(len(Pq))
    for k_, q_ in enumerate(Pq):
        loc_, nrm_, fi_, dd_ = tb.find_nearest(Vector(q_.tolist())); Q_[k_] = loc_; dq_[k_] = dd_
    return Q_, dq_
split_info = None; RIDE = None; helpers = [h for h in os.environ.get("HB_HELPERS", "").split(",") if h]
if os.environ.get("HB_SPLIT", "1") == "1":
    import hb_split
    _m = bpy.data.meshes.new("n"); _m.from_pydata(V.tolist(), [], tris.tolist()); _m.update(); _VN = np.array([v.normal[:] for v in _m.vertices])
    _sb = BVHTree.FromPolygons([tuple(q) for q in V], [tuple(int(x) for x in t_) for t_ in tris])
    def _surf(Pq):
        # nearest point of the character's own surface and its outward normal there (for cuffs through closed seams)
        Q_ = np.zeros_like(Pq); N_ = np.zeros_like(Pq)
        for k_, q_ in enumerate(Pq):
            loc_, nrm_, fi_, dd_ = _sb.find_nearest(Vector(q_.tolist())); Q_[k_] = loc_; N_[k_] = nrm_
        return Q_, N_
    def _seen(Pq, Nq, k=24):
        # how much of the outside can see each point: the share of k directions over its outward half-space in which
        # nothing is met (for dressing closed seams: only what nothing can see may move)
        out_ = np.zeros(len(Pq)); i_ = np.arange(k) + 0.5; ph_ = np.arccos(1 - i_ / k); th_ = np.pi * (1 + 5 ** 0.5) * i_
        loc_ = np.stack([np.cos(th_) * np.sin(ph_), np.sin(th_) * np.sin(ph_), np.cos(ph_)], 1)
        for q_ in range(len(Pq)):
            n_ = Nq[q_] / max(float(np.linalg.norm(Nq[q_])), 1e-12); a_ = np.cross(n_, [0, 0, 1.0]) if abs(n_[2]) < 0.9 else np.cross(n_, [1.0, 0, 0]); a_ /= np.linalg.norm(a_); b_ = np.cross(n_, a_); o_ = Vector((Pq[q_] + n_ * 2e-4).tolist()); free = 0
            for d_ in loc_ @ np.stack([a_, b_, n_]): free += _sb.ray_cast(o_, Vector(d_.tolist()), 0.5)[0] is None
            out_[q_] = free / k
        return out_
    def _seen_cam(Pq):
        # can a camera see each point? The share of 17 outside directions (eight round the figure, level and from 35
        # degrees above, and straight down from the top) along which nothing lies between the point and the camera.
        # The game's camera and the rest check look from the side and from above, never from below: the floor of the
        # crevice under a helmet's rim is open to the ground and to no camera.
        dirs_ = [(math.cos(a_) * c_, math.sin(a_) * c_, s_) for a_ in np.arange(8) * math.pi / 4 for c_, s_ in ((1.0, 0.0), (math.cos(math.radians(35)), math.sin(math.radians(35))))] + [(0.0, 0.0, 1.0)]
        out_ = np.zeros(len(Pq))
        for q_ in range(len(Pq)):
            o_ = Vector(Pq[q_].tolist()); out_[q_] = sum(_sb.ray_cast(o_ + Vector(d_) * 3e-4, Vector(d_), 0.5)[0] is None for d_ in dirs_) / len(dirs_)
        return out_
    V, _VN2, tris, fcls, cls, classes, split_info, RIDE = hb_split.split_underlay(V, tris, fcls0, classes, _VN, body=_body if os.environ.get("HB_UNDERLAY_BODY", "1") == "1" else None, surf=_surf, seen=_seen, seen_cam=_seen_cam, seam_cap=float(os.environ.get("HB_SEAM_CAP", "0.002")), sheet_strips=os.environ.get("HB_SHEET_STRIPS", "1") == "1", iron_cap=float(os.environ.get("HB_IRON_CAP", "0.004"))); LINING_SRC = split_info.pop("_lining_src", []); UNDER_SRC = split_info.pop("_under_src", []); RINGV = split_info.pop("_ring", []); FILL_LOCAL = split_info.pop("_fill_local", []); FILL_W = split_info.pop("_fill_w", []); TUBE_W = split_info.pop("_tube_w", []); UNDER_CLS = split_info.pop("_under_cls", [])
# ---- 2. robust transfer
order = {int(i): c["kind"] for i, c in classes.items()}; kind = np.array([order.get(int(c), "soft") for c in cls])
soft = kind == "soft"; rigid = kind == "rigid"; remove = kind == "remove"
me = bpy.data.meshes.new("c"); me.from_pydata(V.tolist(), [], tris.tolist()); me.update(); VN = np.array([v.normal[:] for v in me.vertices])
tme = bpy.data.meshes.new("t"); tme.from_pydata(TF.tolist(), [], Ttris.tolist()); tme.update(); TN = np.array([v.normal[:] for v in tme.vertices])
tb = BVHTree.FromPolygons([tuple(q) for q in TF], [tuple(f) for f in Ttris])
DMAX = float(os.environ.get("HB_DMAX", "0.04")); NDOT = float(os.environ.get("HB_NDOT", "0.35"))
W = np.zeros((len(V), J)); known = np.zeros(len(V), bool); dist = np.full(len(V), np.nan)
for v in np.nonzero(soft)[0]:
    loc, nrm, fi, dd = tb.find_nearest(Vector(V[v].tolist()))
    if loc is None: continue
    a, b, c = Ttris[fi]; pa, pb, pc = TF[a], TF[b], TF[c]; q = np.array(loc)
    v0, v1, v2 = pb - pa, pc - pa, q - pa; d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1; den = d00 * d11 - d01 * d01
    if abs(den) < 1e-18: continue
    bv = (d11 * d20 - d01 * d21) / den; bw = (d00 * d21 - d01 * d20) / den; bu = 1 - bv - bw
    nt = H.unit(bu * TN[a] + bv * TN[b] + bw * TN[c]); dist[v] = dd
    if dd < DMAX and float(nt @ VN[v]) > NDOT: W[v] = bu * TW[a] + bv * TW[b] + bw * TW[c]; known[v] = True
# ---- gate: a soft vertex may only take weights from joints of the body region it belongs to. Region = the class's
# declared region, else the nearest body capsule (distance normalised by the capsule radius). Removes the classic
# transfer error where the torso side picks up upper-arm weights (and the reverse) because the surfaces are close.
Hh = 0.6; rs = rig["rest"]; jn = lambda n: rs[names.index(n)]
def capd(Pt, a, b, r):
    ab = b - a; tt = np.clip(((Pt - a) @ ab) / max(float(ab @ ab), 1e-12), 0, 1); return np.linalg.norm(Pt - (a + np.outer(tt, ab)), axis=1) / r
REG = {"torso": np.minimum.reduce([np.sqrt((V[:, 0] / (0.125 * Hh)) ** 2 + ((V[:, 1] - jn("spine_02")[1]) / (0.095 * Hh)) ** 2) + np.clip((jn("pelvis")[2] - 0.05 * Hh - V[:, 2]) / (0.05 * Hh), 0, None) + np.clip((V[:, 2] - jn("neck_01")[2]) / (0.03 * Hh), 0, None)]),
       "head": capd(V, jn("neck_01"), rig["tip"][names.index("Head")], 0.11 * Hh)}
for s_ in ("_l", "_r"):
    REG["arm" + s_] = np.minimum.reduce([capd(V, jn("upperarm" + s_), jn("lowerarm" + s_), 0.065 * Hh), capd(V, jn("lowerarm" + s_), jn("hand" + s_), 0.055 * Hh), capd(V, jn("hand" + s_), rig["tip"][names.index("hand" + s_)], 0.045 * Hh)])
    REG["leg" + s_] = np.minimum.reduce([capd(V, jn("thigh" + s_), jn("calf" + s_), 0.085 * Hh), capd(V, jn("calf" + s_), jn("foot" + s_), 0.065 * Hh), capd(V, jn("foot" + s_), jn("ball_leaf" + s_), 0.05 * Hh)])
rkeys = list(REG); region = np.array(rkeys)[np.argmin(np.stack([REG[k] for k in rkeys]), axis=0)]
for cid, c in classes.items():
    if c.get("region"):
        m = (cls == int(cid)) & ~((c["region"] == "torso") & np.isin(region, ["arm_l", "arm_r"]) & (np.minimum(REG["arm_l"], REG["arm_r"]) < 0.6)); region[m] = np.where(c["region"] == "leg", np.where(V[m, 0] > 0, "leg_l", "leg_r"), np.where(c["region"] == "arm", np.where(V[m, 0] > 0, "arm_l", "arm_r"), c["region"]))
# Minimal gate: forbid only what cannot be right. The template's own shoulder and hip blends are kept.
amask = np.ones((len(V), J)); sh_z = jn("upperarm_l")[2]; armpit_z = sh_z - 0.075 * Hh          # allowed share of each joint per vertex (0..1)
# the armpit rule fades in over 20 mm: a hard cut at one height left a cliff in the weights along that line (the back of
# the shoulder stretched 19 to 29 times across it in the v13 Knight's squat and raised-arm poses)
arm_fade = np.clip((V[:, 2] - armpit_z) / 0.02, 0.0, 1.0)                                       # none at the armpit line, full 20 mm above it
def cols(lst): return [names.index(n) for n in lst if n in names]
for s_, sg in (("_l", 1), ("_r", -1)):
    arm_j = cols(["upperarm" + s_, "lowerarm" + s_, "hand" + s_]); leg_j = cols(["calf" + s_, "foot" + s_, "ball" + s_]); thigh_j = cols(["thigh" + s_])
    amask[np.ix_(V[:, 0] * sg < -0.004, cols(["clavicle" + s_]) + arm_j)] = 0.0                   # wrong side of the body
    amask[np.ix_(V[:, 0] * sg < -0.03, leg_j + thigh_j)] = 0.0
    tm_ = np.nonzero((region == "torso") & (V[:, 2] < armpit_z + 0.02))[0]                          # torso below the armpit does not follow the arm
    for j_ in arm_j: amask[tm_, j_] = arm_fade[tm_]
    amask[np.ix_(np.isin(region, ["leg_l", "leg_r"]), cols(["clavicle" + s_]) + arm_j)] = 0.0       # legs never follow an arm
    amask[np.ix_((region == "arm" + s_) & (REG["arm" + s_] < 1.3), cols(["pelvis", "spine_01", "thigh_l", "thigh_r", "calf_l", "calf_r", "foot_l", "foot_r", "ball_l", "ball_r"]))] = 0.0
    amask[np.ix_((region == "torso") | (region == "head"), leg_j)] = 0.0
amask[np.ix_(region == "head", cols(["pelvis", "spine_01", "spine_02", "thigh_l", "thigh_r"]))] = 0.0
for cid, c in classes.items():
    # a stiff over-garment (a leather cuirass) is marked "follow_arm": false: it stays with the trunk, and the sleeve
    # moves out from under its arm opening
    if c.get("follow_arm") is False:
        # every vertex its faces touch, so its whole edge stays with the trunk and the sleeve beside it does the stretching
        m_ = np.zeros(len(V), bool); m_[tris[fcls == int(cid)].ravel()] = True; m_ &= kind != "rigid"
        amask[np.ix_(m_, cols(["upperarm_l", "lowerarm_l", "hand_l", "upperarm_r", "lowerarm_r", "hand_r"]))] = 0.0
    # "forbid_joints": joints this class may never follow (a stand-up collar sewn to the cuirass does not turn with the head)
    if c.get("forbid_joints"): amask[np.ix_(cls == int(cid), cols(c["forbid_joints"]))] = 0.0
kept = (W * amask).sum(1); gated = known & (kept < 0.55); W = W * amask; known &= ~gated; W[~known & soft] = 0
W[known] /= np.maximum(W[known].sum(1, keepdims=True), 1e-9)
# rigid classes
for cid, c in classes.items():
    if c["kind"] == "rigid":
        # a rigid class may name a helper joint (a shoulder plate on upperarm_swing): here it goes on the core joint the
        # helper sits at, and hb_helpers.add_helpers moves it onto the helper whenever the helper is in the rig
        b_ = c["bone"]
        if b_ not in names: b_ = H.HELPERS[b_[:-2]][4] + b_[-2:]
        m = cls == int(cid); W[m] = 0; W[m, names.index(b_)] = 1.0
fuse = os.environ.get("HB_FUSE") == "1"
E = HN.edges_of(tris)
free = soft & ~known; fixed = known | (rigid if fuse else np.zeros(len(V), bool))
# inpaint: harmonic interpolation on the surface graph (Jacobi with fixed values), unknown soft verts only
use_e = (soft[E[:, 0]] | fixed[E[:, 0]]) & (soft[E[:, 1]] | fixed[E[:, 1]]) & ~remove[E[:, 0]] & ~remove[E[:, 1]]; Eu = E[use_e]
deg = np.bincount(Eu.ravel(), minlength=len(V)).astype(float)
# seed unknowns with the nearest known soft vertex (keeps isolated islands sensible), then relax
kidx = np.nonzero(known)[0]
if free.any() and len(kidx):
    from mathutils.kdtree import KDTree
    kd = KDTree(len(kidx))
    for i_, v in enumerate(kidx): kd.insert(Vector(V[v].tolist()), i_)
    kd.balance()
    for v in np.nonzero(free)[0]: W[v] = W[kidx[kd.find(Vector(V[v].tolist()))[1]]]
for it in range(int(os.environ.get("HB_ITERS", "400"))):
    acc = np.zeros_like(W); np.add.at(acc, Eu[:, 0], W[Eu[:, 1]]); np.add.at(acc, Eu[:, 1], W[Eu[:, 0]])
    upd = free & (deg > 0); W[upd] = acc[upd] / deg[upd][:, None]
# light smoothing of all soft weights (keeps rigid fixed), then 4 influences
for it in range(2):
    acc = np.zeros_like(W); np.add.at(acc, Eu[:, 0], W[Eu[:, 1]]); np.add.at(acc, Eu[:, 1], W[Eu[:, 0]])
    upd = soft & (deg > 0); W[upd] = 0.5 * W[upd] + 0.5 * acc[upd] / deg[upd][:, None]
W[soft] = W[soft] * amask[soft]; W[soft] /= np.maximum(W[soft].sum(1, keepdims=True), 1e-9)
# gradient limit: across a fold (underarm, crotch) the nearest-surface transfer can jump from one body part's weights to
# another's within a millimetre, and those edges then stretch many times over. Smooth only the vertices on edges whose
# weights change faster than a whole swap of joints over HB_GRADLEN metres (default 12 mm); everything else is left.
GLEN = float(os.environ.get("HB_GRADLEN", "0.012")); elen = np.linalg.norm(V[Eu[:, 0]] - V[Eu[:, 1]], axis=1); steep_total = 0
for it in range(int(os.environ.get("HB_GRADITERS", "400")) if GLEN > 0 else 0):
    g_ = np.abs(W[Eu[:, 0]] - W[Eu[:, 1]]).sum(1) / np.maximum(elen, 1e-5); st_ = g_ > 2.0 / GLEN
    if not st_.any(): break
    hot = np.zeros(len(V), bool); hot[Eu[st_].ravel()] = True; hot &= soft & (deg > 0)
    if it == 0: steep_total = int(hot.sum())
    acc = np.zeros_like(W); np.add.at(acc, Eu[:, 0], W[Eu[:, 1]]); np.add.at(acc, Eu[:, 1], W[Eu[:, 0]]); W[hot] = 0.5 * W[hot] + 0.5 * acc[hot] / deg[hot][:, None]
    # the smoothing may not undo a gate: a sleeve barred from the trunk stays barred, and the step is taken up by its
    # ungated neighbours (the underlay under a cuirass's edge)
    W[hot] = W[hot] * amask[hot]; W[hot] /= np.maximum(W[hot].sum(1, keepdims=True), 1e-9)
# underlay under a rim: at the rim it has the weights of the visible surface it is welded to, and over HB_UNDER_RAMP
# (default 20 mm) it goes over to the body's own weights at its place. Whatever the visible garment and the body
# disagree about (a sleeve that follows the arm, under a cuirass that does not) is then taken up evenly inside the
# hidden underlay, not in one sub-millimetre edge at the weld.
if split_info and RINGV:
    _ramp = float(os.environ.get("HB_UNDER_RAMP", "0.02")); _nv = np.array([r_[0] for r_ in RINGV]); _bv = np.array([r_[1] for r_ in RINGV]); _t = np.clip(np.array([r_[2] for r_ in RINGV]) / _ramp, 0, 1); _t = _t * _t * (3 - 2 * _t)
    W[_nv] = (1 - _t)[:, None] * W[_bv] + _t[:, None] * W[_nv]
# cuffs through closed seams: weights by construction, from the body part's joint at its edge to the outer piece's joint
if split_info and FILL_W:
    for v_, ba_, bo_, t_ in FILL_W:
        if ba_ in names and bo_ in names: W[v_] = 0; W[v_, names.index(ba_)] += 1.0 - t_; W[v_, names.index(bo_)] += t_
# tubes under rims that run round a limb: weights by construction too, from the welded rim's own weights to the piece's joint
if split_info and TUBE_W:
    for v_, w_, bo_, t_ in TUBE_W:
        if bo_ in names: W[v_] = (1.0 - t_) * W[w_]; W[v_, names.index(bo_)] += t_
zero = soft & (W.sum(1) < 1e-6)                             # nothing allowed survived: take the nearest allowed joint's bone
if zero.any():
    segd = np.stack([capd(V[zero], rs[i_], rig["tip"][i_], 1.0) for i_ in range(J)], axis=1); segd[amask[zero] < 0.5] = 1e9; segd[:, names.index("root")] = 1e9
    W[np.nonzero(zero)[0], segd.argmin(1)] = 1.0
W[remove] = 0; W[remove, names.index("hand_r")] = 1.0
W = np.clip(W, 0, None); W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
idx, val = H.dense_to_top4(W); W4 = np.zeros_like(W); np.put_along_axis(W4, idx, val, axis=1); W = W4
keep = ~remove[tris].any(1)
# ---- bridge faces: Tripo fuses surfaces that touch in the rest pose (inner arm to torso side, thigh to thigh, hand to
# hip). Neighbouring vertices of one real surface never have disjoint weights, so a face whose corners do is a web
# between two surfaces: delete it.
wt = W[tris]; l1 = np.maximum.reduce([np.abs(wt[:, 0] - wt[:, 1]).sum(1), np.abs(wt[:, 1] - wt[:, 2]).sum(1), np.abs(wt[:, 2] - wt[:, 0]).sum(1)])
softf = ~(rigid[tris].all(1)); bridge = keep & softf & (l1 > float(os.environ.get("HB_BRIDGE", "1.5"))); keep &= ~bridge
rep = {"relabelled_faces": relabelled, "bridge_faces_removed": int(bridge.sum()), "split": split_info, "template_fit": {"torso_scale": float((s_torso + w_torso) / 2), "bone_scale": {n: round(float(sb[i]), 3) for i, n in enumerate(names) if n.endswith("_l") or n in ("Head", "neck_01")}},
       "soft_verts": int(soft.sum()), "steep_fold_verts_smoothed": steep_total, "matched": int(known.sum()), "gated_out": int(gated.sum()), "zero_rows_fixed": int(zero.sum()), "regions": {k_: int((region[soft] == k_).sum()) for k_ in rkeys}, "match_rate": float(known.sum() / max(soft.sum(), 1)), "inpainted": int(free.sum()), "rigid_verts": int(rigid.sum()),
       "match_dist_mm_p50_p95": [float(np.nanpercentile(dist[soft], 50) * 1000), float(np.nanpercentile(dist[soft], 95) * 1000)], "fuse": fuse}
out = os.path.join(WORK, f"bound{('-' + TAG) if TAG else ''}")
UV = d["uv"] if "uv" in d.files else np.zeros((len(d["tris"]), 3, 2), np.float32)
if split_info: UV = np.vstack([UV, np.zeros((len(tris) - len(UV), 3, 2), np.float32)])
_px = []
def _tex():
    # the character's base-colour image, 1024 x 1024 x 3, rows bottom-up (loaded once)
    if not _px:
        with bpy.data.libraries.load(os.path.join(WORK, "character.blend"), link=False) as (src_, dst_): dst_.materials = list(src_.materials)
        im = None
        for m_ in dst_.materials:
            if m_ and m_.use_nodes:
                bs = next((n for n in m_.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
                if bs and bs.inputs["Base Color"].is_linked: im = bs.inputs["Base Color"].links[0].from_node.image; break
        im = im.copy(); im.scale(1024, 1024); _px.append(np.array(im.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)[:, :, :3])
    return _px[0]
if RIDE is not None and (RIDE[1] > 0).any():
    # padding under shoulder plates: how far it rides with the plate (stretch-limited), then its clearance under the plate
    import hb_contact as HC
    fit_poses = H.rom_poses() + H.load_pose_sets(p("poses"), ["general"] + list(SPEC.get("pose_sets", [])))
    if os.environ.get("HB_RIDE", "limited") == "limited":
        _r, rep["padding_ride"] = hb_split.ride_limited(V, tris[keep], fcls[keep], classes, W, rig, RIDE[1], fit_poses, helpers, cls, lam=float(os.environ.get("HB_RIDE_STRETCH", "2.0"))); RIDE = (_r, RIDE[1])
    if float(os.environ.get("HB_PAD_CAP", "0.010")) > 0:
        _rg = dict(rig); _rg["ride"] = RIDE; _rg, _Wh = HH.add_helpers(V, W, _rg, helpers, cls, classes)
        V, rep["padding_clearance"] = HC.fit_clearance(V, tris[keep], fcls[keep], _Wh, _rg, cls, classes, RIDE[1], fit_poses, cap=float(os.environ.get("HB_PAD_CAP", "0.010")))
        # (padding that the sinking and smoothing leave proud of the original surface is dealt with below, as a sheet)
if split_info and UNDER_CLS and float(os.environ.get("HB_UNDER_CAP", "0.010")) > 0:
    # the strips of underlay under every other plate's rim get the same clearance fit: where a plate would cut through
    # its own underlay in a pose (the body bends under a breastplate that does not), the underlay sinks. It is generated
    # and hidden at rest, so sinking it costs nothing; left alone it came out through the Knight's breastplate rim.
    import hb_contact as HC
    fit_poses = H.rom_poses() + H.load_pose_sets(p("poses"), ["general"] + list(SPEC.get("pose_sets", [])))
    _uc = np.zeros(len(V), np.int32)
    for v_, c_ in UNDER_CLS: _uc[v_] = c_
    _rg = dict(rig)
    if RIDE is not None: _rg["ride"] = RIDE
    _rg, _Wh = HH.add_helpers(V, W, _rg, helpers, cls, classes)
    _capv = np.full(len(V), 1.0)                                                      # no deeper than the distance to the welded edge: a slope, not a cliff
    for v_, b_, d_ in RINGV: _capv[int(v_)] = max(0.001, float(os.environ.get("HB_UNDER_SLOPE", "1.0")) * float(d_))
    V, rep["underlay_clearance"] = HC.fit_clearance(V, tris[keep], fcls[keep], _Wh, _rg, cls, classes, _uc, fit_poses, cap=float(os.environ.get("HB_UNDER_CAP", "0.010")), cap_v=_capv)
    # A strip is a copy of its plate's rim faces: it keeps the rim's roll and rivets as folds, and where a rim lifts in the
    # open (a breastplate's lower edge when the back bends) the folds show as a crumpled, holed band. Relax the strips
    # toward their own neighbours (welded edge fixed); they are hidden at rest, and the step after this one keeps them so.
    _ns = int(os.environ.get("HB_UNDER_SMOOTH", "8"))
    if _ns > 0:
        _sv = np.array(sorted(int(v_) for v_, c_ in UNDER_CLS), dtype=np.int64); _isv = np.zeros(len(V), bool); _isv[_sv] = True
        _uf = tris[keep][_isv[tris[keep]].any(1) & np.isin(fcls[keep], [int(k_) for k_, c_ in classes.items() if c_["name"] == "underlay"])]; _ad = {}
        for a_, b_, c_ in _uf:
            for x_, y_ in ((a_, b_), (b_, c_), (c_, a_)): _ad.setdefault(int(x_), set()).add(int(y_)); _ad.setdefault(int(y_), set()).add(int(x_))
        _nb = [np.array(sorted(_ad.get(int(v_), {int(v_)})), dtype=np.int64) for v_ in _sv]; _P0 = V[_sv].copy()
        for _ in range(_ns):
            V[_sv] = 0.5 * V[_sv] + 0.5 * np.array([V[n_].mean(0) for n_ in _nb])
        rep["underlay_smoothing"] = {"passes": _ns, "vertices": int(len(_sv)), "moved_mm_p50_max": [round(float(np.median(np.linalg.norm(V[_sv] - _P0, axis=1))) * 1000, 2), round(float(np.linalg.norm(V[_sv] - _P0, axis=1).max()) * 1000, 2)]}
if split_info:
    # Hide at rest: no generated face (underlay, padding, a cuff) may lie in front of the surface as generated
    _gid = [int(k_) for k_, c_ in classes.items() if c_["name"] in ("underlay", "padding", "joint_fill")]
    def _inward(Pq):
        # into the body: against the fitted template's normal at its nearest point
        N_ = np.zeros_like(Pq)
        for k_, q_ in enumerate(Pq): N_[k_] = tb.find_nearest(Vector(q_.tolist()))[1]
        return -N_
    _sheet = (RIDE[1] > 0) if RIDE is not None else np.zeros(len(V), bool)
    if os.environ.get("HB_SHEET_STRIPS", "1") == "1":                                 # the strips under other plates' rims sink as sheets too (what a lifted rim uncovers: a knee, a belly)
        for v_, c_ in UNDER_CLS: _sheet[v_] = True
    _frozen = np.zeros(len(V), bool); _frozen[[int(v_) for v_ in split_info.pop("_frozen", [])]] = True      # the inner rings of cuffs: placed by construction, never moved one by one
    V, rep["hidden_at_rest"] = hb_split.hide_at_rest(V, tris, np.isin(fcls, _gid) & keep, len(d["V"]), _sb, _inward, sheet=_sheet, fixed=_frozen)
if split_info and split_info.get("padding_faces") and SPEC["labels"].get("padding_texture"):
    def _anchor(u0, v0, u1, v1):
        # the texel of the patch closest to the patch's median colour, at least a fifth of the patch in from its edge
        px = _tex(); a0, a1, b0, b1 = int(u0 * 1024), int(u1 * 1024), int(v0 * 1024), int(v1 * 1024); mu, mv = (a1 - a0) // 5, (b1 - b0) // 5; sub = px[b0 + mv:b1 - mv, a0 + mu:a1 - mu]
        med = np.median(sub.reshape(-1, 3), axis=0); d_ = ((sub - med) ** 2).sum(-1); iy, ix = np.unravel_index(int(np.argmin(d_)), d_.shape)
        return (a0 + mu + ix + 0.5) / 1024, (b0 + mv + iy + 0.5) / 1024
    UV, rep["padding_texture"] = hb_split.padding_uv(V, tris, fcls, UV, classes, SPEC["labels"]["padding_texture"], names=("padding",), mode="azimuthal")   # the leather's own grain, laid out from the top of the dome; UV = UV.astype(np.float32)
if split_info and LINING_SRC:
    for ni_, si_ in LINING_SRC: UV[ni_] = UV[si_][[0, 2, 1]]                   # a lining face shows the texture of the plate face it copies
    rep["lining_texture"] = {"faces": len(LINING_SRC), "from": "the plate's own faces"}
if split_info and split_info.get("underlay_faces") and os.environ.get("HB_UNDERLAY_TEX", "1") == "1" and os.path.exists(os.path.join(WORK, "character.blend")):
    # underlay continues the garment next to it: each underlay face takes the typical colour of the nearest soft class
    # along the underlay (one texel of that class: flat colour, no pattern to smear). Deeper than 12 mm, a piece that
    # names an "underlay_colour" class gets that instead (skin for the neck under a helmet; from the rim itself it showed
    # as pink edging under the helmet at rest), and a joint fill takes the colour of the body part at its seam. Before 2026-10-06 underlay was flat dark, and where a raised arm pulled it
    # out from behind a plate's edge it read as a hole.
    import heapq
    uid = next(int(k_) for k_, c_ in classes.items() if c_["name"] == "underlay"); fid = next((int(k_) for k_, c_ in classes.items() if c_["name"] == "joint_fill"), -1)
    uf = np.nonzero(np.isin(fcls, [uid, fid]) & keep)[0]; skip = {uid, fid} | {int(k_) for k_, c_ in classes.items() if c_["name"] == "padding" or c_["kind"] != "soft"}
    uvert = np.zeros(len(V), bool); uvert[tris[uf].ravel()] = True; lab = {}
    for f_ in np.nonzero(keep & ~np.isin(fcls, list(skip)))[0]:                               # welded border vertices: the soft class that owns them
        for v in tris[f_]:
            if uvert[v]: lab.setdefault(int(v), {}); lab[int(v)][int(fcls[f_])] = lab[int(v)].get(int(fcls[f_]), 0) + 1
    src = {v: max(d_, key=d_.get) for v, d_ in lab.items()}; dist_ = {v: 0.0 for v in src}; hq = [(0.0, v) for v in src]; heapq.heapify(hq); uadj = {}
    sface = {}                                                                                    # per welded vertex: a face of the class that owns it (its own colour there)
    for f_ in np.nonzero(keep & ~np.isin(fcls, list(skip)))[0]:
        for v in tris[f_]:
            if int(v) in src and int(fcls[f_]) == src[int(v)] and int(v) not in sface and float(np.abs(UV[f_]).sum()) > 0: sface[int(v)] = int(f_)
    for a_, b_, c_ in tris[uf]:
        for x_, y_ in ((a_, b_), (b_, c_), (c_, a_)): uadj.setdefault(int(x_), []).append(int(y_)); uadj.setdefault(int(y_), []).append(int(x_))
    while hq:
        d_, v = heapq.heappop(hq)
        if d_ > dist_.get(v, 1e9): continue
        for w in uadj.get(v, ()):
            nd = d_ + float(np.linalg.norm(V[w] - V[v]))
            if nd < dist_.get(w, 1e9):
                dist_[w] = nd; src[w] = src[v]; heapq.heappush(hq, (nd, w))
                if v in sface: sface[w] = sface[v]
    px = _tex(); anchors = {}; used = {}
    # "underlay_tone" on a class that names an underlay colour: which of that colour class's tones to take, as a share of
    # the way from its darkest to its lightest face (default 0.5, the median). A face's median tone includes its
    # shadows; as the colour of a whole neck it read as leather (Knight: 0.7).
    _tone = {}
    for c_ in classes.values():
        if c_.get("underlay_colour") and c_.get("underlay_tone") is not None:
            k_ = next((int(i_) for i_, x_ in classes.items() if x_["name"] == c_["underlay_colour"]), None)
            if k_ is not None: _tone[k_] = float(c_["underlay_tone"])
    def anchor_of(c_, tone=None):
        # one texel of the class's typical colour: the face-centre texel nearest the class's median colour (or, with a
        # tone, nearest the median colour of the faces round that share of the way from darkest to lightest)
        tone = _tone.get(c_) if tone is None else tone; key_ = (c_, tone)
        if key_ not in anchors:
            sf = np.nonzero(d["fcls"] == c_)[0]; cuv = d["uv"][sf].mean(1) if len(sf) else np.zeros((0, 2)); ok_ = (cuv.min(1) > 0) & (cuv.max(1) < 1) if len(sf) else np.zeros(0, bool); anchors[key_] = None
            if ok_.sum() >= 5:
                cuv = cuv[ok_]; col = px[np.clip((cuv[:, 1] * 1024).astype(int), 0, 1023), np.clip((cuv[:, 0] * 1024).astype(int), 0, 1023)]
                if tone is not None and len(col) >= 40:
                    lum_ = col.mean(1); lo_, hi_ = np.quantile(lum_, [max(0.0, tone - 0.08), min(1.0, tone + 0.08)]); sel_ = (lum_ >= lo_) & (lum_ <= hi_); med = np.median(col[sel_], axis=0)
                else: med = np.median(col, axis=0)
                anchors[key_] = cuv[int(np.argmin(((col - med) ** 2).sum(1)))]
        return anchors[key_]
    forced = {int(f_): (int(s_), float(d_)) for f_, s_, d_ in UNDER_SRC}; done = 0
    for f_ in uf:
        fs_, fd_ = forced.get(int(f_), (-1, 0.0)); c_ = None
        if fs_ >= 0 and (fd_ >= 0.012 - 1e-9 or int(fcls[f_]) == fid) and anchor_of(fs_) is not None: c_ = fs_   # (a depth of 0 means from the weld itself)
        else:
            vs_ = [int(v) for v in tris[f_]]; v_ = min(vs_, key=lambda v: dist_.get(v, 1e9)); c_ = src.get(v_)
            if (c_ is None or anchor_of(c_) is None) and fs_ >= 0: c_ = fs_
        loc_ = None
        if os.environ.get("HB_UNDERLAY_LOCAL") == "1" and not (fs_ >= 0 and c_ == fs_):            # optional: the colour the neighbouring surface has right there. Off: it carried crevice texels onto the Knight's neck as blocks
            vs_ = [int(v) for v in tris[f_]]; v_ = min(vs_, key=lambda v: dist_.get(v, 1e9)); loc_ = sface.get(v_)
        if loc_ is not None: UV[f_] = UV[loc_].mean(0); done += 1; used[classes[str(int(fcls[loc_]))]["name"]] = used.get(classes[str(int(fcls[loc_]))]["name"], 0) + 1
        elif c_ is not None and anchor_of(c_) is not None: UV[f_] = anchor_of(c_); done += 1; used[classes[str(c_)]["name"]] = used.get(classes[str(c_)]["name"], 0) + 1
    if done == len(uf): classes[str(uid)]["textured"] = True
    rep["underlay_texture"] = {"faces": int(len(uf)), "coloured": done, "from": dict(sorted(used.items(), key=lambda kv: -kv[1]))}; UV = UV.astype(np.float32)
if split_info and FILL_LOCAL and split_info.get("joint_fills"):
    # cuffs through closed seams carry the texture of the garment they continue (each fill's "colour_from" class)
    _loc = {int(v): (a_, b_) for v, a_, b_ in FILL_LOCAL}; _fid = next(int(k_) for k_, c_ in classes.items() if c_["name"] == "joint_fill"); _done = {}
    # Default: one plain texel of that garment, from its lighter tones (0.65). Laid out as cloth from the garment's own
    # texture (labels.cuff_texture: "garment") the Knight's cuffs came out grey and striped: a sleeve's texture near a
    # bracer is mostly baked shadow and folds.
    _plain = SPEC["labels"].get("cuff_texture", "plain") != "garment"
    if _plain:
        _nmid = {c_["name"]: int(k_) for k_, c_ in classes.items()}; _src = {int(f_): int(s_) for f_, s_, d_ in UNDER_SRC}; _n = {}
        for f_ in np.nonzero((fcls == _fid) & keep)[0]:
            a_ = anchor_of(_src.get(int(f_), -1), tone=float(SPEC["labels"].get("cuff_tone", 0.65))) if _src.get(int(f_), -1) >= 0 else None
            if a_ is not None: UV[f_] = a_; n_ = classes[str(_src[int(f_)])]["name"]; _n[n_] = _n.get(n_, 0) + 1
        for sk_ in split_info.get("skirts", []):                                     # the skirt under a cuff is the same cloth
            if sk_.get("colour_from") in _nmid:
                a_ = anchor_of(_nmid[sk_["colour_from"]], tone=float(SPEC["labels"].get("cuff_tone", 0.65)))
                if a_ is not None: UV[(fcls == sk_["class_id"]) & keep] = a_
        rep["joint_fill_texture"] = {"plain": True, "faces_by_garment": _n}; UV = UV.astype(np.float32)
    for jf in split_info["joint_fills"] if not _plain else []:
        if jf.get("kind") != "cuff" or jf["colour_from"] in _done: continue
        UV, _done[jf["colour_from"]] = hb_split.padding_uv(V, tris, fcls, UV, classes, jf["colour_from"], names=("joint_fill",), local=_loc)
    # padding_uv lays every joint_fill face out in each call; with fills from different garments, redo each fill's own faces
    if len(_done) > 1 and not _plain:
        _src = {int(f_): int(s_) for f_, s_, d_ in UNDER_SRC}; _nm = {int(k_): c_["name"] for k_, c_ in classes.items()}
        for g_ in list(_done):
            UVg, _ = hb_split.padding_uv(V, tris, fcls, UV.copy(), classes, g_, names=("joint_fill",), local=_loc)
            for f_ in np.nonzero(fcls == _fid)[0]:
                if _nm.get(_src.get(int(f_), -1)) == g_: UV[f_] = UVg[f_]
    if not _plain: rep["joint_fill_texture"] = {k_: {kk: v_.get(kk) for kk in ("patch_mm", "padding_faces", "error")} for k_, v_ in _done.items()}; UV = UV.astype(np.float32)
extra = {"ride": RIDE[0].astype(np.float32), "ride_cls": RIDE[1].astype(np.int32)} if RIDE is not None else {}
if RIDE is not None: rig["ride"] = RIDE
if split_info:
    # generated faces with no area (two rim vertices in one place give a tube or a skirt a collapsed quad) are dropped
    _ga = np.linalg.norm(np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]), axis=1) / 2
    _gz = keep & (tris >= len(d["V"])).any(1) & (_ga < 1e-12); keep &= ~_gz; rep["zero_area_generated_faces_dropped"] = int(_gz.sum())
_Fk = (fcls[keep] if split_info else d["fcls"][keep]); extra["CN"] = H.corner_normals(V, tris[keep], _Fk, classes).astype(np.float16)   # authored normals per face corner (see hb_lib.corner_normals)
np.savez_compressed(out + ".npz", V=V, tris=tris[keep], W=W.astype(np.float32), cls=cls, fcls=_Fk, uv=UV[keep], **extra)
rep["helpers"] = helpers
json.dump({"rig": H.rig_to_json(rig), "classes": classes, "bind": rep}, open(out + ".json", "w"), indent=1)
np.savez_compressed(os.path.join(WORK, "template-fitted.npz"), V=TF, tris=Ttris, W=TW.astype(np.float32)); json.dump({"rig": H.rig_to_json(rig)}, open(os.path.join(WORK, "template-fitted.json"), "w"))
print("BIND", json.dumps(rep))
# ---- harness
rig2, W2 = HH.add_helpers(V, W, rig, helpers, cls, classes)
poses = H.rom_poses()
rows, Z = HN.evaluate(V, tris[keep], W2, rig2, poses, cls, classes); summ = HN.summarise(rows); st = HN.static_checks(V, W2, rig2, cls, classes)
json.dump({"helpers": helpers, "static": st, "summary": summ, "poses": rows}, open(out + f".harness{('-' + '+'.join(helpers)) if helpers else ''}.json", "w"), indent=1)
print("STATIC", st)
for k_, v_ in summ.items(): print("WORST %-28s %7.3f  %s" % (k_, v_["value"], v_["at"]))

# ---- contact checks (need a BVH): soft verts that sit under a plate at rest and come out through it when posed
T2 = tris[keep]; kindv = np.array([classes[str(int(c))]["kind"] if str(int(c)) in classes else "soft" for c in cls]); _lin_ids = [int(k_) for k_, c_ in classes.items() if c_.get("lining_of")]; rig_f = (kindv[T2] == "rigid").all(1) & ~np.isin(fcls[keep] if split_info else d["fcls"][keep], _lin_ids); soft_idx = np.nonzero(kindv == "soft")[0]
def signed(Vp):
    bv = BVHTree.FromPolygons([tuple(q) for q in Vp], [tuple(t_) for t_ in T2[rig_f]]); out_ = np.full(len(soft_idx), np.nan)
    for k_, v in enumerate(soft_idx):
        if not under0[k_] and Vp is not V: continue
        loc, nrm, fi, dd = bv.find_nearest(Vector(Vp[v].tolist()), 0.02)
        if loc is not None:
            sg_ = float((Vector(Vp[v].tolist()) - loc).dot(nrm))
            if abs(sg_) >= 0.85 * dd: out_[k_] = sg_                      # only where the point projects inside a plate face (not past its edge)
    return out_
under0 = np.ones(len(soft_idx), bool); s0 = signed(V); under0 = s0 < -0.0004
idx2, val2 = H.dense_to_top4(W2); crow = []
CKEY = {"elbow-90", "elbow-140", "knee-90", "knee-135", "arm-p0-e90", "arm-p90-e90", "arm-p45-e135", "arm-cross-l", "arm-cross-r", "arm-rot80-hang", "hip-flex90", "hip-abd45", "squat", "seated-ride", "kneel", "spine-flex60", "spine-twist45", "spine-side30", "head-yaw75", "head-pitch45", "ankle20"}
for pz in [q_ for q_ in poses if q_["id"] in CKEY]:
    A, P = H.solve_pose(rig2, pz["targets"]); Vp = H.skin(V, idx2, val2, rig2, A, P); sp_ = signed(Vp); pk = under0 & (sp_ > 0.0012); crow.append((int(pk.sum()), float(np.nanpercentile(sp_[pk], 95)) if pk.any() else 0.0, pz["id"]))
crow.sort(reverse=True); print("CONTACT under_plate_verts", int(under0.sum()), "worst", [(a_, round(b_ * 1000, 1), c_) for a_, b_, c_ in crow[:6]], "median", float(np.median([c_[0] for c_ in crow])))
json.dump({"under_plate_soft_verts": int(under0.sum()), "per_pose": [{"id": c_, "poke_through": a_, "depth_p95_mm": round(b_ * 1000, 2)} for a_, b_, c_ in crow]}, open(out + f".contact{('-' + '+'.join(helpers)) if helpers else ''}.json", "w"), indent=1)
