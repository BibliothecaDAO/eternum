"""Remove a hand's guide bar and leave a clean channel, touching nothing but the bar (numpy only).

A guide bar is a plain cylinder the fist was generated around. It marks the grip axis and must go before equipment
is fitted. The part-ID maps only say roughly where it is; the geometry says exactly:

1. Fit a cylinder (axis, radius) to the side surface of the faces labelled as the guide.
2. The bar is every face whose three vertices lie inside that cylinder (radius + 0.35 mm) between its two end caps.
   Guide-labelled faces that are not on the cylinder are hand and go back to the hand's class.
3. Delete the bar's faces. That leaves two open rings on the fist where the bar entered and left.
4. Join the two rings with a tube running through the fist. The tube uses the rings' own vertices, so no vertex of the
   hand moves and no hand face is removed. Its radius is the bar's own radius: the smallest channel that removes the
   whole bar. Its faces get the class `bore_<side>`: rigid on the hand joint, flat dark colour.

env HB_CHAR = char.json spec. Reads and rewrites <work>/character.npz and character.json (the previous files are kept
as character-with-guide.*). Writes <work>/guide-bore.json with the axis, radius and counts. If the two rings cannot be
found the files are left untouched and the bar stays (bound rigid to the hand)."""
import os, sys, json, shutil
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p

TOL = 0.00035


def fit_cylinder(FC, FN, FA, seed):
    P = FC[seed]; c = P.mean(0); _, _, vt = np.linalg.svd(P - c); ax = vt[0]; mask = seed & (np.abs(FN @ ax) < 0.4); r = 0.0
    for it in range(12):
        n = FN[mask]; w = FA[mask]; _, evec = np.linalg.eigh((n * w[:, None]).T @ n); ax = evec[:, 0]      # the direction the side normals avoid
        q = FC[mask] - c; q = q - np.outer(q @ ax, ax); e1 = np.cross(ax, [0, 0, 1.0]); e1 /= np.linalg.norm(e1); e2 = np.cross(ax, e1)
        A = np.c_[2 * (q @ e1), 2 * (q @ e2), np.ones(len(q))]; b = (q @ e1) ** 2 + (q @ e2) ** 2; sol, *_ = np.linalg.lstsq(A * w[:, None], b * w, rcond=None)
        c = c + e1 * sol[0] + e2 * sol[1]; r = float(np.sqrt(max(sol[2] + sol[0] ** 2 + sol[1] ** 2, 1e-12)))
        q = FC - c; rf = np.linalg.norm(q - np.outer(q @ ax, ax), axis=1); outward = np.einsum("ij,ij->i", FN, q - np.outer(q @ ax, ax)) > 0
        if it >= 3: mask = (np.linalg.norm(q, axis=1) < 0.07) & (np.abs(rf - r) < 0.0008) & (np.abs(FN @ ax) < 0.3) & outward
    return ax, c, r, mask


def loops_of(edges):
    adj = {}
    for a, b in edges: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    if any(len(v) != 2 for v in adj.values()): return None
    seen = set(); out = []
    for v0 in adj:
        if v0 in seen: continue
        loop = [v0]; seen.add(v0); prev = None; v = v0
        while True:
            nxt = [w for w in adj[v] if w != prev]; w = nxt[0] if nxt else adj[v][0]
            if w == v0: break
            loop.append(w); seen.add(w); prev, v = v, w
        out.append(loop)
    return out


def bore(V, tris, fcls, uv, classes, cid, report):
    name = classes[str(cid)]["name"]; FN = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); FA = np.linalg.norm(FN, axis=1) / 2
    FN = FN / np.maximum(np.linalg.norm(FN, axis=1, keepdims=True), 1e-12); FC = V[tris].mean(1); seed = fcls == cid
    if seed.sum() < 30: report[name] = {"error": "fewer than 30 labelled faces"}; return None
    ax, c, r, side = fit_cylinder(FC, FN, FA, seed); q = V - c; t = q @ ax; rad = np.linalg.norm(q - np.outer(t, ax), axis=1); tf = (FC - c) @ ax
    t0, t1 = float(tf[side].min()), float(tf[side].max()); resid = np.abs(np.linalg.norm((FC[side] - c) - np.outer(tf[side], ax), axis=1) - r)
    barv = (rad <= r + TOL) & (t > t0 - 0.004) & (t < t1 + 0.004) & (np.linalg.norm(q, axis=1) < 0.08); barf = barv[tris].all(1)
    # the hand this bar belongs to: the rigid hand class with most faces next to the bar
    hands = {int(k): c_ for k, c_ in classes.items() if c_["kind"] == "rigid" and str(c_.get("bone", "")).startswith("hand")}
    nearf = (np.linalg.norm(FC - c, axis=1) < 0.05) & ~barf; cnt = {k: int((fcls[nearf] == k).sum()) for k in hands}; hid = max(cnt, key=cnt.get)
    keep = ~barf; E = {}
    for fi in np.nonzero(keep)[0]:
        a, b, d = (int(x) for x in tris[fi])
        for x, y in ((a, b), (b, d), (d, a)): E[(min(x, y), max(x, y))] = E.get((min(x, y), max(x, y)), 0) + 1
    be = [e for e, n in E.items() if n == 1 and rad[e[0]] < r + 0.004 and rad[e[1]] < r + 0.004 and abs(t[e[0]]) < 0.08]
    loops = loops_of(be)
    if loops is None or len(loops) != 2: report[name] = {"error": "expected two open rings after removing the bar, found %s" % (None if loops is None else [len(l) for l in loops])}; return None
    e1 = np.cross(ax, [0, 0, 1.0]); e1 /= np.linalg.norm(e1); e2 = np.cross(ax, e1); ang = np.arctan2(q @ e2, q @ e1)
    def ordered(loop):                                             # walk each ring the same way round the axis, starting at the smallest angle
        a = np.unwrap(ang[loop]); loop = loop if a[-1] > a[0] else loop[::-1]; k = int(np.argmin(ang[loop])); return loop[k:] + loop[:k]
    A, B = sorted((ordered(l) for l in loops), key=lambda l: float(t[l].mean()))
    def prog(loop): a = np.unwrap(ang[loop]); return np.r_[(a - a[0]) / (2 * np.pi), 1.0]
    pa, pb = prog(A), prog(B); i = j = 0; new = []; na, nb = len(A), len(B)
    while i < na or j < nb:                                        # zipper: advance on whichever ring is behind
        if j >= nb or (i < na and pa[i + 1] <= pb[j + 1]): new.append((A[i % na], A[(i + 1) % na], B[j % nb])); i += 1
        else: new.append((A[i % na], B[(j + 1) % nb], B[j % nb])); j += 1
    new = np.array(new, dtype=tris.dtype); nc = V[new].mean(1); nn = np.cross(V[new[:, 1]] - V[new[:, 0]], V[new[:, 2]] - V[new[:, 0]])
    inward = np.einsum("ij,ij->i", nn, (c + np.outer((nc - c) @ ax, ax)) - nc)                           # the channel's wall faces the axis
    if inward.sum() < 0: new = new[:, ::-1]
    relab = seed & ~barf; fcls = fcls.copy(); fcls[relab] = hid
    bid = max(int(k) for k in classes) + 1; side_sfx = classes[str(hid)]["bone"][-2:]
    classes[str(bid)] = {"name": "bore" + side_sfx, "kind": "rigid", "bone": classes[str(hid)]["bone"], "colour": [0.10, 0.06, 0.05], "flat": True, "generated": True}
    tris2 = np.vstack([tris[keep], new]); fcls2 = np.concatenate([fcls[keep], np.full(len(new), bid, fcls.dtype)]); uv2 = np.vstack([uv[keep], np.zeros((len(new), 3, 2), uv.dtype)])
    report[name] = {"axis": [round(float(x), 5) for x in ax], "point_on_axis": [round(float(x), 5) for x in c], "radius_mm": round(r * 1000, 3), "fit_residual_mm_p50_p95": [round(float(np.percentile(resid, 50)) * 1000, 3), round(float(np.percentile(resid, 95)) * 1000, 3)],
                    "bar_span_mm": [round(t0 * 1000, 1), round(t1 * 1000, 1)], "axis_tilt_from_fore_aft_deg": round(float(np.degrees(np.arccos(min(1.0, abs(ax[1]))))), 2), "axis_tilt_from_level_deg": round(float(np.degrees(np.arcsin(min(1.0, abs(ax[2]))))), 2),
                    "hand_class": classes[str(hid)]["name"], "bar_faces_removed": int(barf.sum()), "labelled_guide_faces": int(seed.sum()), "guide_faces_returned_to_hand": int(relab.sum()), "bar_faces_that_were_labelled_hand": int((barf & ~seed).sum()),
                    "rings": [{"vertices": len(l), "along_axis_mm": [round(float(t[l].min()) * 1000, 1), round(float(t[l].max()) * 1000, 1)], "radius_mm": [round(float(rad[l].min()) * 1000, 2), round(float(rad[l].max()) * 1000, 2)]} for l in (A, B)],
                    "channel_faces_added": int(len(new)), "channel_length_mm": [round(float(t[B].min() - t[A].max()) * 1000, 1), round(float(t[B].max() - t[A].min()) * 1000, 1)], "hand_vertices_moved": 0, "hand_faces_removed": 0, "bore_class": "bore" + side_sfx}
    return tris2, fcls2, uv2, classes


if __name__ == "__main__":
    SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); npz = os.path.join(WORK, "character.npz"); js = os.path.join(WORK, "character.json")
    d = np.load(npz); meta = json.load(open(js)); V, tris, fcls, uv = d["V"].astype(float), d["tris"], d["fcls"], d["uv"]; classes = meta["classes"]; report = {}; done = 0
    for cid in [int(k) for k, c in list(classes.items()) if c["kind"] == "remove"]:
        res = bore(V, tris, fcls, uv, classes, cid, report)
        if res is not None: tris, fcls, uv, classes = res; done += 1
    if done:
        for f in (npz, js):
            bak = f.replace("character.", "character-with-guide.")
            if not os.path.exists(bak): shutil.copyfile(f, bak)
        used = np.unique(tris); remap = np.full(len(V), -1, np.int64); remap[used] = np.arange(len(used)); V = V[used]; tris = remap[tris].astype(d["tris"].dtype)   # drop the bar's own vertices
        report["vertices_dropped"] = int(len(remap) - len(used))
        order = {int(i): (2 if c["kind"] == "rigid" else 1 if c["kind"] == "soft" else 3) for i, c in classes.items()}; vcls = np.zeros(len(V), np.int32); vpri = np.zeros(len(V), np.int32)
        for f_, t_ in enumerate(tris):
            c_ = int(fcls[f_]); pr = order.get(c_, 0)
            for v in t_:
                if pr > vpri[v]: vpri[v] = pr; vcls[v] = c_
        np.savez_compressed(npz, V=V.astype(d["V"].dtype), tris=tris, cls=vcls, fcls=fcls.astype(np.int32), uv=uv); meta["classes"] = classes; meta.setdefault("report", {})["guide_bore"] = report; json.dump(meta, open(js, "w"), indent=1)
    json.dump(report, open(os.path.join(WORK, "guide-bore.json"), "w"), indent=1)
    for k, v in report.items(): print("BORE", k, json.dumps(v))
