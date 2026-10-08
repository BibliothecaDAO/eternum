"""Build the family deformation template from the MakeHuman/MPFB base mesh (CC0).
Reads template/mpfb/{base.obj, rig.game_engine.json, weights.game_engine.json}; keeps the body group; places the
family joints on MakeHuman's joint cubes; merges finger weights into the hands; scales to H = 0.6 with soles at z = 0.
Writes template/template.npz (+ template.json): V, quads, tris, dense weights on the 25 family joints, rig."""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H
SRC = p("template", "mpfb")
V = []; groups = {}; faces = []; g = None
for line in open(os.path.join(SRC, "base.obj")):
    if line.startswith("v "): x, y, z = map(float, line.split()[1:4]); V.append((x * 0.1, -z * 0.1, y * 0.1))
    elif line.startswith("g "): g = line.split()[1]
    elif line.startswith("f "):
        idx = [int(t.split("/")[0]) - 1 for t in line.split()[1:]]; groups.setdefault(g, []).append(idx)
V = np.array(V); body = groups["body"]; nb = max(max(f) for f in body) + 1
cube = {k: V[sorted({i for f in fs for i in f})].mean(0) for k, fs in groups.items() if k.startswith("joint-")}
rigj = json.load(open(os.path.join(SRC, "rig.game_engine.json")))
def pos(spec):
    if spec["strategy"] == "CUBE": return cube[spec["cube_name"]]
    if spec["strategy"] == "MEAN": return V[spec["vertex_indices"]].mean(0)
    return np.array(spec["default_position"])
MAP = {"pelvis": "pelvis", "spine_01": "spine_01", "spine_02": "spine_02", "spine_03": "spine_03", "neck_01": "neck_01", "Head": "head"}
J = {}; tips = {}
for fam, mh in MAP.items(): J[fam] = pos(rigj[mh]["head"])
tips["Head"] = pos(rigj["head"]["tail"])
for s in ("_l", "_r"):
    for b in ("clavicle", "upperarm", "lowerarm", "hand", "thigh", "calf", "foot", "ball"): J[b + s] = pos(rigj[b + s]["head"])
    J["ball_leaf" + s] = pos(rigj["ball" + s]["tail"]); tips["hand" + s] = pos(rigj["middle_01" + s]["head"]); tips["ball_leaf" + s] = J["ball_leaf" + s] + (J["ball_leaf" + s] - J["ball" + s]) * 0.3
B = V[:nb]; zmin = B[:, 2].min(); height = B[:, 2].max() - zmin; s = 0.6 / height
def tf(q): q = np.array(q, float) - np.array([0, 0, zmin]); return q * s
B = tf(B); J = {k: tf(v) for k, v in J.items()}; tips = {k: tf(v) for k, v in tips.items()}
# symmetrise joints (MakeHuman's cubes are symmetric to ~1e-4)
for b in ("clavicle", "upperarm", "lowerarm", "hand", "thigh", "calf", "foot", "ball", "ball_leaf"):
    l, r = J[b + "_l"], J[b + "_r"]; m = (l + r * np.array([-1, 1, 1])) / 2; J[b + "_l"] = m; J[b + "_r"] = m * np.array([-1, 1, 1])
for b in ("pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "Head"): J[b][0] = 0.0
J["root"] = np.zeros(3)
rig = H.make_rig(J, tips)
wj = json.load(open(os.path.join(SRC, "weights.game_engine.json")))["weights"]
W = np.zeros((nb, len(H.CORE)))
def fam(n):
    if n == "head": return "Head"
    if n == "Root": return "root"
    for f in ("index", "middle", "ring", "pinky", "thumb"):
        if n.startswith(f): return "hand" + n[-2:]
    return n
for n, rows in wj.items():
    j = H.CORE.index(fam(n))
    for vi, w in rows:
        if vi < nb: W[vi, j] += w
unw = int((W.sum(1) < 1e-6).sum()); W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
quads = np.array([f for f in body if len(f) == 4], dtype=np.int32); tris = np.concatenate([quads[:, [0, 1, 2]], quads[:, [0, 2, 3]]])
other = [f for f in body if len(f) != 4]
np.savez_compressed(p("template", "template.npz"), V=B, quads=quads, tris=tris, W=W.astype(np.float32))
rep = {"source": "MakeHuman/MPFB base mesh, game_engine rig and weights (CC0, makehumancommunity/mpfb2 master)", "verts": int(nb), "quads": int(len(quads)), "non_quads": len(other), "unweighted": unw,
       "scale": s, "stature": 0.6, "max_influences": int((W > 1e-4).sum(1).max()), "rig": H.rig_to_json(rig),
       "arm_angle_from_vertical_deg": float(np.degrees(np.arccos(-H.unit(J["lowerarm_l"] - J["upperarm_l"])[2]))),
       "joint_heights_over_H": {k: round(float(v[2] / 0.6), 4) for k, v in J.items() if not k.endswith("_r")}}
json.dump(rep, open(p("template", "template.json"), "w"), indent=1)
print("TEMPLATE", {k: rep[k] for k in rep if k != "rig"})
