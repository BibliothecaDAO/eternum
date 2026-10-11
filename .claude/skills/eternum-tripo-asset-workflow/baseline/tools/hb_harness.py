"""Deformation harness: pose a bound mesh through the range-of-motion set and the pose library with plain linear
blend skinning (as three.js does) and report numbers. No rendering here; see hb_pose_render.py.

Input: a 'bound' npz with V [N,3], tris [M,3], W [N,J] (dense, on the rig's joints), and next to it <name>.json with
{"rig": ..., "classes": {id: {"name", "kind": "rigid"|"soft", "bone"}}}; optional per-vertex 'cls' array in the npz.

Metrics, per pose:
  stretch_p995 / compress_p005   edge length ratio posed/rest (99.5th and 0.5th percentile), soft triangles only
  stretch_len_p995               the same 99.5th percentile weighted by rest edge length
  area_min_p01                   triangle area ratio, 1st percentile
  hinge[joint].outer_p05         radial distance ratio (posed/rest) to the bone line on the outside of the bend,
                                 5th percentile: the 'paper fold' / thinning measure. 1.0 = volume kept.
  hinge[joint].inner_p05         same on the inside of the bend (crease pinch)
  twist[zone].area_p05           triangle area ratio in the twisting zone (candy-wrapper measure)
  rigid_max_dev                  worst edge-length change inside any rigid island (must be ~0)
Static checks: influences, normalisation, left/right symmetry of weights, rigid islands bound to one joint.
"""
import os, sys, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hb_lib as H

HINGES = {"elbow": ("upperarm", "lowerarm", "hand"), "knee": ("thigh", "calf", "foot"), "wrist": ("lowerarm", "hand", None), "ankle": ("calf", "foot", "ball")}


def edges_of(tris):
    e = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]]); e.sort(axis=1); return np.unique(e, axis=0)


def seg_dist(Pt, a, b):
    ab = b - a; t = np.clip(((Pt - a) @ ab) / max(float(ab @ ab), 1e-12), 0, 1); q = a + np.outer(t, ab); return np.linalg.norm(Pt - q, axis=1), t


def zones(V, W, rig):
    """rest-pose hinge zones: verts near each hinge joint that belong to the two bones meeting there."""
    names, rest, tip = rig["names"], rig["rest"], rig["tip"]; Z = {}
    def col(n):
        idx = [i for i, m in enumerate(names) if m == n or (m.rsplit("_", 1)[0] in H.HELPERS and H.HELPERS[m.rsplit("_", 1)[0]][1] + m[-2:] == n)]
        return W[:, idx].sum(1)
    for hname, (pa, ch, gc) in HINGES.items():
        for s in ("_l", "_r"):
            ia, ib = names.index(pa + s), names.index(ch + s); j = rest[ib]; a0 = rest[ia]; b1 = tip[ib]
            wa = col(pa + s); wb = col(ch + s) + (col(gc + s) if gc else 0)
            for hh in names:
                if hh.rsplit("_", 1)[0] in H.HELPERS and hh.endswith(s) and rig["rules"].get(hh, ("", "", 0))[1] == ch + s: wb = wb + W[:, names.index(hh)]
            own = (wa + wb) > 0.6
            da, _ = seg_dist(V, a0, j); db, _ = seg_dist(V, j, b1); d = np.minimum(da, db); dj = np.linalg.norm(V - j, axis=1)
            near = own & (dj < 0.09)
            if near.sum() < 8: continue
            rad = float(np.median(d[near & (dj < 0.05)])) if (near & (dj < 0.05)).sum() > 4 else float(np.median(d[near]))
            m = own & (dj < 2.2 * rad) & (d > 0.25 * rad)
            Z[hname + s] = {"verts": np.nonzero(m)[0], "joint": ib, "parent": ia, "radius": rad, "rest_d": d[m]}
    return Z


def evaluate(V, tris, W, rig, poses, cls=None, classes=None, top=4):
    names = rig["names"]; rest = rig["rest"]; tip = rig["tip"]
    idx, val = H.dense_to_top4(W, top)
    E = edges_of(tris); e0 = np.linalg.norm(V[E[:, 0]] - V[E[:, 1]], axis=1); ok = e0 > 1e-7; E = E[ok]; e0 = e0[ok]
    a0 = np.linalg.norm(np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]), axis=1) / 2; okt = a0 > 1e-12
    rigid_v = np.zeros(len(V), bool); islands = {}
    if cls is not None and classes:
        for cid, c in classes.items():
            if c.get("kind") == "rigid": m = cls == int(cid); rigid_v |= m; islands[c["name"]] = m
    hidden_v = np.zeros(len(V), bool)                       # the underlay is hidden under plates: not part of the stretch statistics
    if cls is not None and classes:
        for cid, c in classes.items():
            if c.get("name") in ("underlay", "padding", "joint_fill"): hidden_v |= cls == int(cid)      # padding is the gap filler under a plate; it stretches by design
    soft_e = ~(rigid_v[E[:, 0]] & rigid_v[E[:, 1]]) & ~(hidden_v[E[:, 0]] | hidden_v[E[:, 1]]); soft_t = ~(rigid_v[tris].all(1)) & ~(hidden_v[tris].any(1)) & okt
    Z = zones(V, W, rig); out = []
    # twist zones: wrist band (forearm roll) and shoulder band (upper-arm rotation)
    tw = {}
    for s in ("_l", "_r"):
        for zn, (ja, jb, lo, hi) in {"forearm": ("lowerarm", "hand", 0.45, 1.25), "upperarm": ("upperarm", "lowerarm", -0.25, 0.6)}.items():
            a, b = rest[names.index(ja + s)], rest[names.index(jb + s)]; ab = b - a; t = ((V - a) @ ab) / float(ab @ ab); d = np.linalg.norm(V - (a + np.outer(t, ab)), axis=1)
            m = (t > lo) & (t < hi) & (d < 0.06) & (np.sign(V[:, 0]) == (1 if s == "_l" else -1)); tm = m[tris].all(1) & okt
            if tm.sum() > 4: tw[zn + s] = tm
    for pz in poses:
        A, P = H.solve_pose(rig, pz["targets"]); Vp = H.skin(V, idx, val, rig, A, P)
        er = np.linalg.norm(Vp[E[:, 0]] - Vp[E[:, 1]], axis=1) / e0
        ar = (np.linalg.norm(np.cross(Vp[tris[:, 1]] - Vp[tris[:, 0]], Vp[tris[:, 2]] - Vp[tris[:, 0]]), axis=1) / 2)[okt] / a0[okt]
        # the same percentile weighted by rest length: generated meshes pack sub-millimetre edges into creases, and a
        # 0.2 mm edge shows a large ratio for a displacement nobody could see. Reported beside the count-based figure.
        if soft_e.any():
            o_ = np.argsort(er[soft_e]); cw_ = np.cumsum(e0[soft_e][o_]); len_p995 = float(er[soft_e][o_][min(len(o_) - 1, int(np.searchsorted(cw_, 0.995 * cw_[-1])))])
        else: len_p995 = 1.0
        # and the collapse measure weighted by rest area: the share of the surface, not of the triangle count. A reduced
        # mesh keeps its triangles where the body bends, so a count-based percentile reads deeper into the creases the
        # fewer triangles there are elsewhere; the area-weighted one compares like with like across levels of detail.
        if soft_t.any():
            ar_s = ar[soft_t[okt]]; aw_ = a0[okt][soft_t[okt]]; o2_ = np.argsort(ar_s); cw2_ = np.cumsum(aw_[o2_]); area_w_p01 = float(ar_s[o2_][min(len(o2_) - 1, int(np.searchsorted(cw2_, 0.01 * cw2_[-1])))])
        else: area_w_p01 = 1.0
        r = {"set": pz["set"], "id": pz["id"], "stretch_len_p995": len_p995, "area_w_p01": area_w_p01, "stretch_p995": float(np.percentile(er[soft_e], 99.5)) if soft_e.any() else 1.0, "compress_p005": float(np.percentile(er[soft_e], 0.5)) if soft_e.any() else 1.0,
             "area_p01": float(np.percentile(ar[soft_t[okt]], 1)) if soft_t.any() else 1.0, "hinge": {}, "twist": {}}
        for zn, z in Z.items():
            ib, ia = z["joint"], z["parent"]; j = P[ib]; ua = H.unit(P[ia] - j); pb = P[ib] + A[ib] @ (tip[ib] - rest[ib]); ub = H.unit(pb - j)
            bend = math.degrees(math.acos(max(-1, min(1, float(-ua @ ub)))))
            da, _ = seg_dist(Vp[z["verts"]], P[ia], j); db, _ = seg_dist(Vp[z["verts"]], j, pb); ratio = np.minimum(da, db) / np.maximum(z["rest_d"], 1e-6)
            h = {"bend": round(bend, 1), "all_p05": float(np.percentile(ratio, 5))}
            if bend > 20:
                # outside of the bend, fixed in the rest pose: opposite to the direction the child swings toward
                cr = H.unit(tip[ib] - rest[ib]); f = A[ia].T @ ub; f = H.unit(f - cr * float(f @ cr)); side = (V[z["verts"]] - rest[ib]) @ (-f)
                outer = side > 0.25 * z["radius"]; inner = side < -0.25 * z["radius"]
                if outer.sum() > 3: h["outer_p05"] = float(np.percentile(ratio[outer], 5)); h["outer_min"] = float(ratio[outer].min())
                if inner.sum() > 3: h["inner_p05"] = float(np.percentile(ratio[inner], 5))
            r["hinge"][zn] = h
        for zn, tm in tw.items():
            a_ = (np.linalg.norm(np.cross(Vp[tris[tm, 1]] - Vp[tris[tm, 0]], Vp[tris[tm, 2]] - Vp[tris[tm, 0]]), axis=1) / 2) / a0[tm]
            r["twist"][zn] = {"area_p05": float(np.percentile(a_, 5)), "area_min": float(a_.min())}
        if islands:
            dev = 0.0
            for nm, m in islands.items():
                em = m[E[:, 0]] & m[E[:, 1]]
                if em.any(): dev = max(dev, float(np.abs(er[em] - 1).max()))
            r["rigid_max_dev"] = dev
        out.append(r)
    return out, Z


def static_checks(V, W, rig, cls=None, classes=None):
    names = rig["names"]; n_inf = (W > 1e-4).sum(1); rep = {"verts": int(len(V)), "max_influences": int(n_inf.max()), "over_4": int((n_inf > 4).sum()), "unweighted": int((W.sum(1) < 0.999).sum())}
    # left/right symmetry of weights (nearest mirrored vertex, sampled)
    rs = np.random.default_rng(0); samp = rs.choice(len(V), size=min(1500, len(V)), replace=False); mir = {i: names.index(n[:-2] + ("_r" if n.endswith("_l") else "_l")) if n[-2:] in ("_l", "_r") else i for i, n in enumerate(names)}
    perm = [mir[i] for i in range(len(names))]; err = []
    for i in samp:
        q = V[i] * np.array([-1, 1, 1]); k = int(np.argmin(((V - q) ** 2).sum(1)))
        if np.linalg.norm(V[k] - q) < 0.004: err.append(float(np.abs(W[i] - W[k][perm]).max()))
    rep["symmetry_pairs"] = len(err); rep["symmetry_err_p95"] = float(np.percentile(err, 95)) if err else None
    if cls is not None and classes:
        bad = {}
        for cid, c in classes.items():
            if c.get("kind") != "rigid": continue
            m = cls == int(cid)
            if not m.any(): continue
            j = names.index(c["bone"]); off = float((1 - W[m, j]).max())
            if off > 1e-4: bad[c["name"]] = off
        rep["rigid_not_single_bone"] = bad
    return rep


def summarise(rows):
    """worst value per metric and where it happened."""
    S = {}
    def upd(key, v, where, better_high=True):
        cur = S.get(key)
        if cur is None or (v < cur[0] if better_high else v > cur[0]): S[key] = (v, where)
    for r in rows:
        w = f'{r["set"]}/{r["id"]}'
        upd("stretch_p995", r["stretch_p995"], w, False); upd("stretch_len_p995", r["stretch_len_p995"], w, False); upd("compress_p005", r["compress_p005"], w); upd("area_p01", r["area_p01"], w)
        for zn, h in r["hinge"].items():
            base = zn[:-2]
            if "outer_p05" in h: upd(f"{base}.outer_p05", h["outer_p05"], f"{w}:{zn}@{h['bend']}")
            if "inner_p05" in h: upd(f"{base}.inner_p05", h["inner_p05"], f"{w}:{zn}@{h['bend']}")
        for zn, t in r["twist"].items(): upd(f"{zn[:-2]}.twist_area_p05", t["area_p05"], f"{w}:{zn}")
        if "rigid_max_dev" in r: upd("rigid_max_dev", r["rigid_max_dev"], w, False)
    return {k: {"value": round(v[0], 4), "at": v[1]} for k, v in sorted(S.items())}


def explain(V, tris, W, rig, pose, cls=None, classes=None, top=8):
    """the most stretched soft edges of one pose, with the class and weights at each end."""
    names = rig["names"]; idx, val = H.dense_to_top4(W); A, P = H.solve_pose(rig, pose["targets"]); Vp = H.skin(V, idx, val, rig, A, P)
    E = edges_of(tris); e0 = np.linalg.norm(V[E[:, 0]] - V[E[:, 1]], axis=1); r = np.linalg.norm(Vp[E[:, 0]] - Vp[E[:, 1]], axis=1) / np.maximum(e0, 1e-9)
    cn = {int(k): v["name"] for k, v in (classes or {}).items()}; kd = {int(k): v["kind"] for k, v in (classes or {}).items()}
    soft = np.array([kd.get(int(c), "soft") == "soft" for c in cls]) if cls is not None else np.ones(len(V), bool); m = soft[E[:, 0]] | soft[E[:, 1]]
    order = np.argsort(-np.where(m, r, 0))[:top]; out = []
    for e in order:
        ends = [{"rest": V[v].round(4).tolist(), "class": cn.get(int(cls[v]), "?") if cls is not None else "?", "weights": {names[k]: round(float(W[v, k]), 2) for k in np.nonzero(W[v] > 0.02)[0]}} for v in E[e]]
        out.append({"ratio": round(float(r[e]), 2), "ends": ends})
    return out


def load_bound(path):
    d = np.load(path); meta = json.load(open(path[:-4] + ".json")); rig = H.rig_from_json(meta["rig"])
    if "ride" in d.files: rig["ride"] = (d["ride"].astype(float), d["ride_cls"].astype(np.int64))
    return d["V"].astype(float), d["tris"].astype(np.int64), d["W"].astype(float), rig, (d["cls"] if "cls" in d.files else None), meta.get("classes")


if __name__ == "__main__":
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument("bound"); ap.add_argument("--sets", default="rom"); ap.add_argument("--poses", default=None); ap.add_argument("--out", default=None); ap.add_argument("--helpers", default=""); ap.add_argument("--explain", default=None)
    a = ap.parse_args()
    V, tris, W, rig, cls, classes = load_bound(a.bound)
    import hb_helpers as HH
    rig, W = HH.add_helpers(V, W, rig, a.helpers.split(","), cls, classes)
    poses = []
    for s in a.sets.split(","):
        if s == "rom": poses += H.rom_poses()
        elif a.poses: poses += H.load_pose_sets(a.poses, [s])
    if a.explain:
        for q_ in [x for x in poses if x["id"] == a.explain]:
            for e_ in explain(V, tris, W, rig, q_, cls, classes): print("EDGE x%.1f" % e_["ratio"], " | ".join(f'{n_["class"]} {n_["rest"]} {n_["weights"]}' for n_ in e_["ends"]))
        sys.exit(0)
    rows, Z = evaluate(V, tris, W, rig, poses, cls, classes); rep = {"bound": a.bound, "helpers": a.helpers, "static": static_checks(V, W, rig, cls, classes), "summary": summarise(rows), "zones": {k: {"verts": int(len(z["verts"])), "radius": z["radius"]} for k, z in Z.items()}, "poses": rows}
    out = a.out or a.bound[:-4] + ".harness.json"; json.dump(rep, open(out, "w"), indent=1)
    print("STATIC", rep["static"])
    for k, v in rep["summary"].items(): print("WORST %-28s %7.3f  %s" % (k, v["value"], v["at"]))
