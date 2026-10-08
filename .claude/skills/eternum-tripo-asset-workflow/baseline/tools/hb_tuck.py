"""Tuck what was covered back under what covered it (runs inside Blender for its BVH; after hb_reduce.py, before hb_bake.py).

In the bind every layer lies under the next with a millimetre or two to spare: the underlay under a plate, a lining
inside its plate, cloth under a strap. A reduction keeps each surface's vertices where they were but joins them with
longer, flatter faces, and the flat face of a plate can then pass below a vertex of the layer under it: the lower layer
comes through. This puts it back. For every vertex of the reduction that another piece covered in the bind (the first
surface outward from it, within REACH), the same piece's faces in the reduction are looked for along the same line; if
the vertex is now in front of them or inside the piece, or nearer than MARGIN behind it, it is moved straight back
until it is MARGIN behind the piece's innermost face. A lining's vertices are kept behind their own plate in the same way.

Only vertices of generated surface move (underlay, padding, fills, linings), and only inward, so nothing that shows
at rest changes shape; weights and classes are untouched. A plate's lining and a mouth's funnel are not touched (hb_reduce.py
builds them from the reduced plates); a skirt under a rim is, where it lies on the cuff.

Three further steps were tried here and taken out again. Moving the covered corners of plates that show elsewhere
(under a strap) tipped the faces they share with what shows until they turned their backs. Taking out every hidden
face that still showed at rest opened holes of up to a third of the view at wrists, elbows and knees in poses: those
faces close the gaps when the body moves. Moving whole faces back by points spread over them ran away (corners moved
by centimetres over a few rounds). Hidden surface that still shows at rest is painted like the surface behind it by
hb_bake.py instead.

env HB_BOUND  the bind (npz path under human-baseline); HB_LOW the reduced npz (rewritten in place)
    HB_TUCK_MARGIN metres (default 0.0006); HB_TUCK_REACH metres (default 0.012: a padded piece stands 7 mm off what it covers)
Prints TUCK lines."""
import bpy, os, sys, json
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p

GEN = ("underlay", "padding", "joint_fill")
if __name__ == "__main__":
    bp = p(*os.environ["HB_BOUND"].split("/")); lp = p(*os.environ["HB_LOW"].split("/")); MARGIN = float(os.environ.get("HB_TUCK_MARGIN", "0.0006")); REACH = float(os.environ.get("HB_TUCK_REACH", "0.012"))
    b = np.load(bp); J = json.load(open(bp[:-4] + ".json")); cl = {int(k): c for k, c in J["classes"].items()}; cl.update({int(k): c for k, c in json.load(open(lp[:-4] + ".json")).get("classes", {}).items()}); names = {k: c["name"] for k, c in cl.items()}; by_name = {c["name"]: k for k, c in cl.items()}
    lining = {k: by_name.get(c["lining_of"]) for k, c in cl.items() if c.get("lining_of")}; gen = {k for k, c in cl.items() if c["name"] in GEN or c.get("generated")} | set(lining)
    # A skirt (the strip from a rim down to the cuff's ring inside it) is reduced with everything else, and the end of it that lies on the cuff is tucked like
    # the cuff. Left out, as every lining first was, it came through the flattened bracer at the wrist and showed as a pale band round both wrists.
    rebuilt = {k for k, c in cl.items() if c.get("lining_of") and (not c.get("skirt") or c.get("mouth"))}
    BV, BT, BF = b["V"].astype(float), b["tris"].astype(np.int64), b["fcls"]; shown = ~np.isin(BF, list(gen)); bvh_hi = BVHTree.FromPolygons(BV.tolist(), BT[shown].tolist()); hi_cls = BF[shown]
    z = dict(np.load(lp)); V0 = (z["V_bind"] if "V_bind" in z else z["V"]).astype(float); T = z["tris"].astype(np.int64); F = z["fcls"]; V = V0.copy(); n = len(V)
    vcls = [set() for _ in range(n)]
    for f, t in enumerate(T):
        for v in t: vcls[int(v)].add(int(F[f]))
    # which way each vertex's own surface faces: from the bind's faces round it (the reduction's own long faces say it poorly), of the classes it still belongs to
    keep = z["keep"].astype(np.int64); bfn = np.cross(BV[BT[:, 1]] - BV[BT[:, 0]], BV[BT[:, 2]] - BV[BT[:, 0]]); back = np.full(len(BV), -1, np.int64); back[keep] = np.arange(n); vn = np.zeros((n, 3))
    for k in range(3):
        r = back[BT[:, k]]; m = r >= 0; own_ = np.array([int(BF[f]) in vcls[int(r[f])] for f in np.nonzero(m)[0]], bool); idx = np.nonzero(m)[0][own_]; np.add.at(vn, r[idx], bfn[idx])
    vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-30)
    # What covered each vertex in the bind. Asked of the bind's own faces round the vertex, each along its own normal from its own middle (a vertex on the
    # edge of a patch of underlay has no dependable normal of its own): the vertex was covered if at least half of them were, by the piece most of them met.
    cover = np.full(n, -1, np.int64); direc = np.zeros((n, 3)); bcen = BV[BT].mean(1); bnn = bfn / np.maximum(np.linalg.norm(bfn, axis=1, keepdims=True), 1e-30); inc = [[] for _ in range(n)]
    for f in range(len(BT)):
        for k in range(3):
            r = back[BT[f, k]]
            if r >= 0 and int(BF[f]) in vcls[int(r)]: inc[int(r)].append(f)
    fcover = {}
    def face_cover(f):
        if f not in fcover:
            d = Vector(bnn[f].tolist()); loc, nor, idx, dist = bvh_hi.ray_cast(Vector((bcen[f] + bnn[f] * 1e-5).tolist()), d, REACH); fcover[f] = int(hi_cls[idx]) if loc is not None else -1
        return fcover[f]
    for v in range(n):
        own = vcls[v]
        if not own or not inc[v]: continue
        if own & rebuilt: continue                                                  # a plate's lining and a mouth's funnel are left alone: hb_reduce.py builds them from the reduced plate itself, so they cannot stand in front of it
        if not own <= gen: continue                                                 # only surface that is hidden by design is moved. A covered corner of a plate that shows elsewhere (under a strap) stays: the faces it shares with what shows would tip with it, and at the lower level of detail they turned their backs to the viewer
        use = [f for f in inc[v] if int(BF[f]) not in lining] or inc[v]             # (a skirt's own faces look inward, at the limb: what covers the vertex is asked of the other surface round it)
        got = [(face_cover(f), f) for f in use]; hit = [(c, f) for c, f in got if c >= 0 and c not in own]
        if len(hit) * 2 < len(got): continue
        cs = [c for c, f in hit]; best = max(set(cs), key=cs.count); d = bnn[[f for c, f in hit if c == best]].sum(0); nd = np.linalg.norm(d)
        if nd > 1e-9: cover[v] = best; direc[v] = d / nd
    moved = np.zeros(n); kinds = {}
    for c in np.unique(cover[cover >= 0]):
        fm = F == c
        if not fm.any(): continue
        bvh = BVHTree.FromPolygons(V.tolist(), T[fm].tolist())
        for v in np.nonzero(cover == c)[0]:
            d = Vector(direc[v].tolist()); pv = Vector(V[v].tolist()); back = None
            loc, nor, idx, dist = bvh.ray_cast(pv + d * 1e-6, d, REACH + 0.004)
            if loc is not None:
                if dist < MARGIN: back = MARGIN - dist                                          # behind it, but nearer than the margin
            else:                                                                               # nothing of it outward any more: is the vertex in front of it, or inside it? Then it goes back to behind its innermost face
                q = pv; deep = None
                for _ in range(6):
                    loc, nor, idx, dist = bvh.ray_cast(q, -d, REACH - (deep or 0.0))
                    if loc is None: break
                    deep = (loc - pv).length; q = loc - d * 1e-6
                if deep is not None: back = deep + MARGIN
            if back is not None:
                V[v] = V[v] - direc[v] * back; moved[v] = back; k = "lining" if set(vcls[v]) & set(lining) else ("generated" if set(vcls[v]) & gen else "shown at rest elsewhere"); kinds[k] = kinds.get(k, 0) + 1
    genf = np.isin(F, list(gen))
    mv = moved > 0; byc = {}
    for v in np.nonzero(mv)[0]: byc[names.get(int(cover[v]), "?")] = byc.get(names.get(int(cover[v]), "?"), 0) + 1
    rep = {"margin_mm": MARGIN * 1000, "reach_mm": REACH * 1000, "vertices": int(n), "covered_in_the_bind": int((cover >= 0).sum()), "moved": int(mv.sum()), "moved_mm_p50_p95_max": [round(float(np.percentile(moved[mv], q)) * 1000, 2) for q in (50, 95, 100)] if mv.any() else [0, 0, 0],
           "moved_by_kind": kinds, "moved_under": dict(sorted(byc.items(), key=lambda kv: -kv[1])[:12]),
           "of_generated_faces": int(genf.sum())}
    z["V_bind"] = V0.astype(z["V"].dtype); z["V"] = V.astype(z["V"].dtype); np.savez_compressed(lp, **z); m = json.load(open(lp[:-4] + ".json")); m["tuck"] = rep; json.dump(m, open(lp[:-4] + ".json", "w"), indent=1); print("TUCK", json.dumps(rep))
