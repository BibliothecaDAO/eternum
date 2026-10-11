"""Check a character's exported game files against the baseline they were made from (numpy and the standard library; no Blender window).

Reads the GLB files and runtime-fit.json as a game would (it uses nothing else from the export folder), then:

  structure   one scene, one root, one mesh, one primitive, one material with three embedded PNG maps, no clips; a skin of the
              joints in the stated order with translation-only nodes and inverse binds that are the rest positions negated
  mesh        the file's triangles are the baked level's in order, corner for corner; every file vertex is at its place (turned to
              the game's frame) with that place's weights (helper joints derived, four largest, summing to one)
  posed       for a set of poses: the file's mesh, skinned by the file's own skeleton with the core joints turned as the
              baseline's pose solver turns them and the helper joints turned by runtime-fit.json's own rules, lands where
              the baseline's skinning of the baked level puts it. This is the claim the game side rests on: files + rules =
              the deformation the harness measured
  items       each item's file, placed by its socket in runtime-fit.json on the file's joint at rest, lies where the gear fit
              put the item in the baseline
  manifest    sizes and hashes as <export>/MANIFEST.json states

  python hb_export_check.py --char <char.json> --export <export folder> [--work <folder>] [--levels near,mid]
         [--items sword,shield --item-level near] [--helpers a,b,c] [--pose-sets knight] [--gear-fit <gear-fit.json>]
  --work       default: the spec's "work"; it holds baked-<level>.npz, items/<item>/baked-<item-level>.npz and gear-fit.json
  --levels     default near,mid: <export>/<level>/skin.glb for each
  --items      default none: <export>/<item-level>/<item>.glb for each, checked against the gear fit
  --helpers    default: the spec's helpers
  --pose-sets  default: the spec's pose_sets (with the range-of-motion set and the general set, every fourth pose of each)
Paths are absolute or relative to the baseline folder. Run with Blender's Python.
Writes <export>/export-check.json. Prints CHECK lines and EXPORT_CHECK PASS or FAIL."""
import argparse, hashlib, json, math, os, struct, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH
C = np.array([[1.0, 0, 0], [0, 0, 1.0], [0, -1.0, 0]]); CT = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}; NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    b = open(path, "rb").read(); assert b[:4] == b"glTF" and struct.unpack("<I", b[4:8])[0] == 2 and struct.unpack("<I", b[8:12])[0] == len(b)
    jl, jt = struct.unpack("<II", b[12:20]); assert jt == 0x4E4F534A; doc = json.loads(b[20:20 + jl]); bl, bt = struct.unpack("<II", b[20 + jl:28 + jl]); assert bt == 0x004E4942; return doc, b[28 + jl:28 + jl + bl], b


def acc(doc, bn, i):
    a = doc["accessors"][i]; v = doc["bufferViews"][a["bufferView"]]; fmt, w = CT[a["componentType"]]; n = NC[a["type"]]; off = v.get("byteOffset", 0) + a.get("byteOffset", 0); assert "byteStride" not in v
    return np.frombuffer(bn, dtype="<" + fmt, count=a["count"] * n, offset=off).reshape(a["count"], n)


def q_of(R):
    """rotation matrix -> (x, y, z, w)"""
    t = np.trace(R)
    if t > 0: s = math.sqrt(t + 1.0) * 2; q = [(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, 0.25 * s]
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]: s = math.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2; q = [0.25 * s, (R[0, 1] + R[1, 0]) / s, (R[0, 2] + R[2, 0]) / s, (R[2, 1] - R[1, 2]) / s]
    elif R[1, 1] > R[2, 2]: s = math.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2; q = [(R[0, 1] + R[1, 0]) / s, 0.25 * s, (R[1, 2] + R[2, 1]) / s, (R[0, 2] - R[2, 0]) / s]
    else: s = math.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2; q = [(R[0, 2] + R[2, 0]) / s, (R[1, 2] + R[2, 1]) / s, 0.25 * s, (R[1, 0] - R[0, 1]) / s]
    q = np.array(q, float); return q / np.linalg.norm(q)


def m_of(q):
    x, y, z, w = q; return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)], [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)], [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b; return np.array([aw * bx + ax * bw + ay * bz - az * by, aw * by - ax * bz + ay * bw + az * bx, aw * bz + ax * by - ay * bx + az * bw, aw * bw - ax * bx - ay * by - az * bz])


def slerp_id(q, t):
    """slerp(identity, q, t)"""
    q = np.array(q, float)
    if q[3] < 0: q = -q
    s = float(np.linalg.norm(q[:3]))
    if s < 1e-12: return np.array([0.0, 0, 0, 1])
    ang = 2 * math.atan2(s, q[3]) * t; return np.array([*(q[:3] / s * math.sin(ang / 2)), math.cos(ang / 2)])


def drive(rule, D):
    """runtime-fit.json's rule for one helper, given the followed joint's local quaternion D"""
    if rule["rule"] == "half": return slerp_id(D, rule["share"])
    a = np.array(rule["twist_axis"], float); pr = float(np.dot(D[:3], a)); tw = np.array([*(a * pr), D[3]]); n = np.linalg.norm(tw); tw = tw / n if n > 1e-9 else np.array([0.0, 0, 0, 1])
    sw = qmul(D, np.array([-tw[0], -tw[1], -tw[2], tw[3]])); return qmul(sw, slerp_id(tw, rule["share"]))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--export", required=True); ap.add_argument("--work", default=None); ap.add_argument("--levels", default="near,mid"); ap.add_argument("--items", default="")
    ap.add_argument("--item-level", dest="item_level", default="near"); ap.add_argument("--helpers", default=None); ap.add_argument("--pose-sets", dest="pose_sets", default=None); ap.add_argument("--gear-fit", dest="gear_fit", default=None); a = ap.parse_args()
    spec = json.load(open(p(*a.char.split("/")))); WORK = p(*(a.work or spec["work"]).split("/")); K = lambda *x: os.path.join(WORK, *x); EX = p(*a.export.split("/"))
    HELPERS = [h for h in (a.helpers if a.helpers is not None else ",".join(spec.get("helpers", []))).split(",") if h]; TROOP = [s_ for s_ in (a.pose_sets if a.pose_sets is not None else ",".join(spec.get("pose_sets", []))).split(",") if s_]
    LEVELS = [x for x in a.levels.split(",") if x]; ITEMS = [x for x in a.items.split(",") if x]; GEARFIT = p(*a.gear_fit.split("/")) if a.gear_fit else K("gear-fit.json")
    fit = json.load(open(os.path.join(EX, "runtime-fit.json"))); rep = {"export": EX, "levels": LEVELS, "items": ITEMS, "helpers": HELPERS, "pose_sets": TROOP, "checks": {}}; ok_all = True
    def chk(name, ok, value):
        global ok_all
        rep["checks"][name] = {"result": "PASS" if ok else "FAIL", "value": value}; ok_all &= bool(ok); print("CHECK %-4s %-58s %s" % ("PASS" if ok else "FAIL", name, value))
    order = fit["body"]["joint_order"]; rules = {h["name"]: h for h in fit["helpers"]}
    allp = {("rom", q["id"]): q for q in H.rom_poses()}
    for s_ in ["general"] + TROOP:
        for q in H.load_pose_sets(p("poses"), [s_]): allp[(s_, q["id"])] = q
    POSES = [k for k in allp if k[0] == "rom"][::4] + [k for k in allp if k[0] == "general"][::4] + [k for s_ in TROOP for k in allp if k[0] == s_][::4]
    NJ = len(order)
    for lv in LEVELS:
        doc, bn, raw = read_glb(os.path.join(EX, lv, "skin.glb")); pr = doc["meshes"][0]["primitives"][0]; nodes = doc["nodes"]; sk = doc["skins"][0]
        chk(lv + ": structure", len(doc["scenes"]) == 1 and len(doc["scenes"][0]["nodes"]) == 1 and len(doc["meshes"]) == 1 and len(doc["meshes"][0]["primitives"]) == 1 and len(doc["materials"]) == 1 and not doc.get("animations") and len(doc["images"]) == 3 and all(i["mimeType"] == "image/png" for i in doc["images"]) and doc["materials"][0].get("doubleSided") is False,
            "1 scene, 1 root, 1 mesh, 1 primitive, 1 single-sided material, %d PNG images, clips %d" % (len(doc["images"]), len(doc.get("animations", []))))
        jn = [nodes[j]["name"] for j in sk["joints"]]; chk(lv + ": joints", jn == order and len(jn) == NJ, "%d joints, order as runtime-fit.json: %s" % (len(jn), jn == order))
        chk(lv + ": joint nodes are translations only", all(set(nodes[j].keys()) <= {"name", "translation", "children"} for j in sk["joints"]), "no rotation, scale or matrix on any joint")
        par = {}
        for i, nd in enumerate(nodes):
            for c in nd.get("children", []): par[c] = i
        rest = {}
        def wpos(i):
            if i not in rest: rest[i] = np.array(nodes[i].get("translation", [0, 0, 0]), float) + (wpos(par[i]) if i in par else 0.0)
            return rest[i]
        R0 = np.array([wpos(j) for j in sk["joints"]]); Rf = np.array([j["rest_position"] for j in fit["joints"]]); ibm = acc(doc, bn, sk["inverseBindMatrices"]).reshape(-1, 4, 4).transpose(0, 2, 1)
        chk(lv + ": rest positions as runtime-fit.json", np.abs(R0 - Rf).max() < 2e-6, "max difference %.2e m" % np.abs(R0 - Rf).max())
        chk(lv + ": inverse binds are the rest positions negated", np.abs(ibm[:, :3, :3] - np.eye(3)).max() < 1e-7 and np.abs(ibm[:, :3, 3] + R0).max() < 2e-6, "rotation part identity; translation differs by at most %.2e m" % np.abs(ibm[:, :3, 3] + R0).max())
        pos = acc(doc, bn, pr["attributes"]["POSITION"]).astype(float); J0 = acc(doc, bn, pr["attributes"]["JOINTS_0"]).astype(int); W0 = acc(doc, bn, pr["attributes"]["WEIGHTS_0"]).astype(float); ind = acc(doc, bn, pr["indices"]).ravel()
        chk(lv + ": weights", J0.max() < NJ and abs(W0.sum(1) - 1).max() < 1e-5 and W0.min() >= 0 and (W0 > 0).sum(1).max() <= 4, "at most %d influences, sums within %.1e of one" % ((W0 > 0).sum(1).max(), abs(W0.sum(1) - 1).max()))
        # the baked level in the baseline
        bp = K("baked-%s.npz" % lv); V, tris, W, rig0, cls, classes = HN.load_bound(bp); rig, Wh = HH.add_helpers(V, W, rig0, HELPERS, cls, classes); names = list(rig["names"]); pj = [int(x) for x in rig["parent"]]; idx, val = H.dense_to_top4(Wh)
        chk(lv + ": triangles", len(ind) // 3 == len(tris), "%d in the file, %d in the baked level" % (len(ind) // 3, len(tris)))
        # which place each file vertex is: the file's triangles are the baked level's in the same order, corner for corner (several places can share a
        # position, a cut between two pieces, so position alone does not say)
        VG = V @ C.T; place = np.full(len(pos), -1, np.int64); T3 = ind.reshape(-1, 3); same = len(T3) == len(tris)
        if same:
            place[T3.ravel()] = tris.ravel(); same = bool((place[T3] == tris).all()) and bool((place >= 0).all())
        chk(lv + ": the file's triangles are the baked level's, corner for corner", same, "%d triangles; every file vertex stands for one place (%d file vertices, %d places of %d used)" % (len(T3), len(pos), len(np.unique(place)), len(V)))
        d0 = np.linalg.norm(VG[place] - pos, axis=1); chk(lv + ": every file vertex at its place", d0.max() < 2e-6, "max distance %.2e m" % d0.max())
        Wf = np.zeros((len(pos), NJ)); np.add.at(Wf, (np.arange(len(pos))[:, None], J0), W0); Wb = np.zeros((len(V), len(names)))
        np.put_along_axis(Wb, idx, val, 1); Wb = Wb / Wb.sum(1, keepdims=True); tf = [order.index(n) for n in names]; Wb2 = np.zeros((len(V), NJ)); Wb2[:, tf] = Wb
        chk(lv + ": file weights are the baseline's (helpers derived, four largest)", np.abs(Wf - Wb2[place]).max() < 2e-5, "max difference %.2e" % np.abs(Wf - Wb2[place]).max())
        # posed: file + rules against the baseline's own skinning
        worst = (0.0, None); worst_h = 0.0; ip = names.index("pelvis")
        for k in POSES:
            A, P = H.solve_pose(rig, allp[k]["targets"]); Vb = H.skin(V, idx, val, rig, A, P) @ C.T
            loc = {n: q_of(C @ (A[pj[i]].T @ A[i]) @ C.T) if pj[i] >= 0 else np.array([0.0, 0, 0, 1]) for i, n in enumerate(names)}
            for hn, r in rules.items():                                         # helpers by the written rules, not by the solver
                qh = drive(r, loc[r["follows"]]); worst_h = max(worst_h, 2 * math.degrees(math.acos(min(1.0, abs(float(qh @ loc[hn])))))); loc[hn] = qh
            dz = (P[ip] - (P[pj[ip]] + A[pj[ip]] @ (np.array(rig["rest"][ip]) - np.array(rig["rest"][pj[ip]])))) @ C.T      # the solver's pelvis height shift
            Wr = {}; Wp = {}
            def world(n):
                if n not in Wr:
                    i = order.index(n); node = sk["joints"][i]; t = np.array(nodes[node].get("translation", [0, 0, 0]), float) + (dz if n == "pelvis" else 0.0); pn = nodes[par[node]]["name"] if par.get(node) in sk["joints"] else None
                    if pn is None: Wr[n] = m_of(loc[n]); Wp[n] = t
                    else: Rp, Pp = world(pn); Wr[n] = Rp @ m_of(loc[n]); Wp[n] = Pp + Rp @ t
                return Wr[n], Wp[n]
            out = np.zeros_like(pos)
            for c in range(4):
                for j in np.unique(J0[:, c]):
                    m = (J0[:, c] == j) & (W0[:, c] > 0)
                    if not m.any(): continue
                    Rj, Pj = world(order[j]); out[m] += W0[m, c][:, None] * ((pos[m] + ibm[j][:3, 3]) @ Rj.T + Pj)
            e = float(np.linalg.norm(out - Vb[place], axis=1).max())
            if e > worst[0]: worst = (e, "%s:%s" % k)
        chk(lv + ": posed by the file and the written rules, against the baseline's skinning", worst[0] < 2e-5, "max distance %.2e m over %d poses (worst %s); helper rules against the solver: at most %.3f degrees" % (worst[0], len(POSES), worst[1], worst_h))
        chk(lv + ": feet on the ground", abs(pos[:, 1].min()) < 2e-4, "lowest vertex y = %.5f m" % pos[:, 1].min())
    # items on their sockets
    gf = json.load(open(GEARFIT)) if ITEMS else None; doc, bn, raw = read_glb(os.path.join(EX, LEVELS[0], "skin.glb")); nodes = doc["nodes"]; sk = doc["skins"][0]; Rf = {j["name"]: np.array(j["rest_position"]) for j in fit["joints"]}
    for it in ITEMS:
        d2, b2, r2 = read_glb(os.path.join(EX, a.item_level, it + ".glb")); pr = d2["meshes"][0]["primitives"][0]; ps = acc(d2, b2, pr["attributes"]["POSITION"]).astype(float); so = fit["sockets"][it]
        chk(it + ": structure", "skins" not in d2 and "JOINTS_0" not in pr["attributes"] and len(d2["scenes"][0]["nodes"]) == 1 and len(d2["nodes"]) == 1 and len(d2["images"]) == 3 and not d2.get("animations"), "no skin, one node, 3 PNG images, %d triangles" % (len(acc(d2, b2, pr["indices"])) // 3))
        world = ps @ m_of(np.array(so["quaternion_xyzw"])).T + np.array(so["offset"]) + Rf[so["joint"]]
        Vi = np.load(K("items", it, "baked-%s.npz" % a.item_level))["V"].astype(float); M = np.array(gf["items"][it]["rest_matrix"], float); base = (Vi @ M[:3, :3].T + M[:3, 3]) @ C.T
        Ti = np.load(K("items", it, "baked-%s.npz" % a.item_level))["tris"]; pl = np.full(len(ps), -1, np.int64); pl[acc(d2, b2, pr["indices"]).ravel()] = Ti.ravel()
        e = float(np.linalg.norm(world - base[pl], axis=1).max()); chk(it + ": placed by its socket, against the gear fit", e < 2e-5, "max distance %.2e m on joint %s" % (e, so["joint"]))
    man = json.load(open(os.path.join(EX, "MANIFEST.json"))); bad = [f for f, v in man.items() if hashlib.sha256(open(os.path.join(EX, f), "rb").read()).hexdigest() != v["sha256"]]
    chk("manifest", not bad, "%d files, hashes match" % len(man) if not bad else "differ: %s" % bad)
    rep["result"] = "PASS" if ok_all else "FAIL"; rep["poses"] = ["%s:%s" % k for k in POSES]; json.dump(rep, open(os.path.join(EX, "export-check.json"), "w"), indent=1); print("EXPORT_CHECK", rep["result"])
