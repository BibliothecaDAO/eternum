"""Probe: evaluate Tripo's own auto-rig weights with the family harness.
Reads the rigged GLB (same vertex order as the raw generation), maps Tripo's 22 joints onto the family names, places
the family joints at Tripo's joint positions and runs the range-of-motion set with our part labels, to see how the
auto-rig treats rigid plates and joints."""
import os, sys, json, struct, glob
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN
fp = glob.glob(p("probe", "rig-mixamo", "tripo-out", "*", "model.glb"))[0]; b = open(fp, "rb").read(); n = struct.unpack("<I", b[12:16])[0]; g = json.loads(b[20:20 + n]); bin0 = 20 + n + 8
CT = {5120: "b", 5121: "B", 5122: "h", 5123: "H", 5125: "I", 5126: "f"}; NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}
def acc(i):
    a = g["accessors"][i]; bv = g["bufferViews"][a["bufferView"]]; nc = NC[a["type"]]; dt = np.dtype("<" + CT[a["componentType"]]); off = bin0 + bv.get("byteOffset", 0) + a.get("byteOffset", 0); st = bv.get("byteStride", 0)
    if st and st != dt.itemsize * nc: raw = np.frombuffer(b, dtype=np.uint8, count=st * a["count"], offset=off).reshape(a["count"], st)[:, :dt.itemsize * nc].copy(); return raw.view(dt).reshape(a["count"], nc)
    return np.frombuffer(b, dtype=dt, count=a["count"] * nc, offset=off).reshape(a["count"], nc)
prim = g["meshes"][0]["primitives"][0]; P = acc(prim["attributes"]["POSITION"]).astype(float); JI = acc(prim["attributes"]["JOINTS_0"]).astype(int); JW = acc(prim["attributes"]["WEIGHTS_0"]).astype(float)
if JW.max() > 1.5: JW = JW / (255.0 if JW.max() <= 255 else 65535.0)
skin = g["skins"][0]; jn = [g["nodes"][j].get("name") for j in skin["joints"]]; IB = acc(skin["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
JP = np.array([np.linalg.inv(m)[:3, 3] for m in IB])                       # joint positions in the mesh's bind space
d = np.load(p("probe", "knight-worn", "work", "character.npz")); meta = json.load(open(p("probe", "knight-worn", "work", "character.json"))); V = d["V"].astype(float); tris = d["tris"].astype(np.int64); cls = d["cls"]
# glTF (x, y, z) -> Blender (x, -z, y) -> working frame (y, -x, z); then a uniform scale and offset from the bounding boxes
def to_work(Q): Bq = np.c_[Q[:, 0], -Q[:, 2], Q[:, 1]]; return np.c_[Bq[:, 1], -Bq[:, 0], Bq[:, 2]]
Pw = to_work(P); sc = float((V.max(0) - V.min(0))[2] / (Pw.max(0) - Pw.min(0))[2]); off = V.min(0) - Pw.min(0) * sc; Pw = Pw * sc + off; JPw = to_work(JP) * sc + off
# match vertices by position (the importer does not keep the file's vertex order)
q = 2e-4; grid = {}
for i_, c_ in enumerate(np.floor(Pw / q).astype(np.int64)): grid.setdefault((int(c_[0]), int(c_[1]), int(c_[2])), []).append(i_)
perm = np.zeros(len(V), np.int64); err = np.zeros(len(V))
for i_, (c_, v_) in enumerate(zip(np.floor(V / q).astype(np.int64), V)):
    best = None
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for j_ in grid.get((int(c_[0]) + dx, int(c_[1]) + dy, int(c_[2]) + dz), ()):
                    dd = float(((Pw[j_] - v_) ** 2).sum())
                    if best is None or dd < best[0]: best = (dd, j_)
    if best is None: best = (1.0, int(np.argmin(((Pw - v_) ** 2).sum(1))))
    perm[i_] = best[1]; err[i_] = best[0] ** 0.5
fit = float(np.percentile(err, 99)); JI = JI[perm]; JW = JW[perm]
# classify Tripo joints by position: spine chain on the midline sorted by height; limbs by side and height
TN = {"tripo::Root": "pelvis", "tripo::Spine_0": "spine_01", "tripo::0_Right_Limb_0": "spine_02", "tripo::0_Right_Limb_1": "spine_03", "tripo::Head_0": "neck_01", "tripo::Head_1": "Head",
      "bone_6": "clavicle_l", "bone_7": "upperarm_l", "bone_8": "lowerarm_l", "bone_9": "hand_l", "tripo::0_Right_Limb_2": "clavicle_r", "tripo::0_Right_Limb_3": "upperarm_r", "tripo::0_Right_Limb_4": "lowerarm_r", "tripo::0_Right_Limb_5": "hand_r",
      "tripo::1_Left_Limb_0": "thigh_l", "tripo::1_Left_Limb_1": "calf_l", "tripo::1_Left_Limb_2": "foot_l", "tripo::1_Left_Limb_3": "ball_l", "tripo::0_Left_Limb_0": "thigh_r", "tripo::0_Left_Limb_1": "calf_r", "tripo::0_Left_Limb_2": "foot_r", "tripo::0_Left_Limb_3": "ball_r"}
m = {i: TN[nm] for i, nm in enumerate(jn) if nm in TN}
print("TRIPO joints", len(jn), "fit residual", fit, {jn[i]: m.get(i) for i in range(len(jn))})
fam = json.load(open(p("probe", "knight-worn", "work", "character.json")))["rig"]; frig = H.rig_from_json(fam); J = {nm: frig["rest"][k_].copy() for k_, nm in enumerate(frig["names"])}
for i, nm in m.items():
    if nm == "pelvis": continue                                              # Tripo's root sits on the ground; keep our pelvis pivot
    J[nm] = JPw[i]
for s_ in ("_l", "_r"): J["ball_leaf" + s_] = J["ball" + s_] + (frig["rest"][frig["names"].index("ball_leaf" + s_)] - frig["rest"][frig["names"].index("ball" + s_)])
rig = H.make_rig(J, {nm: frig["tip"][frig["names"].index(nm)] for nm in ("Head", "hand_l", "hand_r")})
W = np.zeros((len(V), len(rig["names"])))
for k_ in range(4):
    for i, nm in m.items():
        sel = JI[:, k_] == i; W[sel, rig["names"].index(nm)] += JW[sel, k_]
W /= np.maximum(W.sum(1, keepdims=True), 1e-9)
rows, Z = HN.evaluate(V, tris, W, rig, H.rom_poses(), cls, meta["classes"]); summ = HN.summarise(rows); st = HN.static_checks(V, W, rig, cls, meta["classes"])
# how rigid are the plates under Tripo's weights: share of each rigid class's verts that sit on a single joint
plate = {}
for cid, c in meta["classes"].items():
    if c["kind"] != "rigid": continue
    sel = cls == int(cid)
    if sel.any(): dom = W[sel].max(1); top = rig["names"][int(np.bincount(W[sel].argmax(1)).argmax())]; plate[c["name"]] = {"single_joint_share": round(float((dom > 0.98).mean()), 3), "mean_top_weight": round(float(dom.mean()), 3), "top_joint": top}
out = {"mapping": {jn[i]: m.get(i) for i in range(len(jn))}, "static": st, "summary": summ, "plates": plate}
json.dump(out, open(p("probe", "review", "tripo-rig-eval.json"), "w"), indent=1)
for k_, v_ in summ.items(): print("WORST %-28s %7.3f  %s" % (k_, v_["value"], v_["at"]))
for k_, v_ in plate.items(): print("PLATE %-12s %s" % (k_, v_))
