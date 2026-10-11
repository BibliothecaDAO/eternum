"""Contact between plates and the soft surface under them, per plate and per pose (runs inside Blender for its BVH).

For every rigid piece, take the soft vertices that lie under it in the rest pose (behind one of its faces, within
20 mm, projecting inside the face). In each pose report, for that piece:
  poke   share of those vertices that have come out in front of the plate by more than 1.2 mm, and how far (p95)
  gap    how much further behind the plate they now are than at rest (p50, p95): the plate lifting off its surface
  uncovered  share of those vertices that are no longer under the plate at all: the plate has left the place it covered
  through    poke counted only away from the plate's rim: through the steel, not out past its edge. Depths over
             HB_POKE_FLAG_MM (default 10) are listed as flags; this is reported, not a pass limit.

env: HB_BOUND   bound npz (path under human-baseline)
     HB_HELPERS helper joints to add (comma list), HB_SETS pose sets (default rom,general)
     HB_REBIND  JSON {"class name": "joint name"}: bind these rigid classes to another joint for this run (candidates)
     HB_TAG     suffix for the report file (default: contact-plates)
Importable: contact(V, tris, W, rig, cls, classes, poses) -> rows, summary.
"""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import hb_lib as H


def contact(V, tris, W, rig, cls, classes, poses, reach=0.02, poke_min=0.0012, only=None, flag_mm=10.0, rim=0.004):
    """rows: per pose and plate (see the module text), plus
      through_share / through_depth_p95_mm  the same counted only where the nearest plate face is more than `rim` from
                                            the plate's open edge: through the steel, not slipping out past its rim
    flags: every pose and plate whose through-depth exceeds `flag_mm` (reported, not a limit)."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    kind = np.array([classes[str(int(c))]["kind"] if str(int(c)) in classes else "soft" for c in cls]); name = {int(k): c["name"] for k, c in classes.items()}
    soft_idx = np.nonzero(kind == "soft")[0]; plates = {}; rimf = {}
    for cid, c in classes.items():
        if c["kind"] != "rigid" or c.get("lining_of") or (only and c["name"] not in only): continue      # a lining faces inward: not a plate
        f = tris[(cls[tris] == int(cid)).all(1)]
        if len(f) < 20: continue
        plates[c["name"]] = f; E = {}
        for t in f:
            for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E[(min(int(a), int(b)), max(int(a), int(b)))] = E.get((min(int(a), int(b)), max(int(a), int(b))), 0) + 1
        rv = np.unique([v for e, n in E.items() if n == 1 for v in e]); fc = V[f].mean(1)
        if len(rv):
            R_ = V[rv][::max(1, len(rv) // 600)]; rimf[c["name"]] = np.array([float(np.min(np.linalg.norm(R_ - q, axis=1))) < rim for q in fc])
        else: rimf[c["name"]] = np.zeros(len(f), bool)

    def signed(Vp, faces, verts):
        bv = BVHTree.FromPolygons([tuple(q) for q in Vp], [tuple(t) for t in faces]); out = np.full(len(verts), np.nan); fo = np.zeros(len(verts), np.int64)
        for k, v in enumerate(verts):
            loc, nrm, fi, dd = bv.find_nearest(Vector(Vp[v].tolist()), reach * 2.5)
            if loc is None: continue
            s = float((Vector(Vp[v].tolist()) - loc).dot(nrm))
            if abs(s) >= 0.85 * dd: out[k] = s; fo[k] = fi                  # the point projects inside a plate face, not past its edge
        return out, fo
    # "Under a plate": behind one of its faces, within reach, with nothing of the character as generated in between, and
    # the first plate face met on the way there is met from behind. A plate's upstanding lip is a sheet with two sides a
    # fraction of a millimetre apart; to a strap beside the lip the nearest face may be either side, and when it is the
    # far one the strap counts as under the plate and reads as 20 mm through the steel as soon as the plate turns (the
    # Knight's right shoulder plate, 2026-10-06, on 8 vertices, with renders unchanged).
    gen_ids = [int(k) for k, c in classes.items() if c["name"] in ("underlay", "padding", "joint_fill") or c.get("lining_of")]
    orig = tris[~np.isin(cls[tris], gen_ids).any(1)]; whole = BVHTree.FromPolygons([tuple(q) for q in V], [tuple(int(x) for x in t) for t in orig])
    def clear_to(f, verts):
        bv = BVHTree.FromPolygons([tuple(q) for q in V], [tuple(t) for t in f]); ok = np.ones(len(verts), bool)
        for k, v in enumerate(verts):
            loc, nrm, fi, dd = bv.find_nearest(Vector(V[v].tolist()), reach * 2.5)
            if loc is None or dd < 0.0012: continue
            d_ = (loc - Vector(V[v].tolist())) / dd; hit = whole.ray_cast(Vector(V[v].tolist()) + d_ * 0.0004, d_, dd - 0.0010)
            first = bv.ray_cast(Vector(V[v].tolist()) + d_ * 0.0004, d_, dd + 0.002)
            ok[k] = hit[0] is None and not (first[0] is not None and first[1].dot(d_) < 0)
            if ok[k]:                                                           # and no plate face about as near has the vertex in front of it (one ray can slip past the edge of a lip's near side)
                for l2, n2, f2, d2 in bv.find_nearest_range(Vector(V[v].tolist()), dd + 0.0015):
                    s2 = float((Vector(V[v].tolist()) - l2).dot(n2))
                    if s2 > 0 and s2 >= 0.85 * d2: ok[k] = False; break
        return ok
    under = {}; blocked = {}
    for pn, f in plates.items():
        s0, _ = signed(V, f, soft_idx); m = (s0 < -0.0004) & (s0 > -reach); mi = np.nonzero(m)[0]; cl = clear_to(f, soft_idx[mi]); blocked[pn] = int((~cl).sum()); mi = mi[cl]
        if len(mi) >= 10: under[pn] = (soft_idx[mi], s0[mi])
    idx, val = H.dense_to_top4(W); rows = []; flags = []
    for q in poses:
        A, P = H.solve_pose(rig, q["targets"]); Vp = H.skin(V, idx, val, rig, A, P); row = {"set": q.get("set", ""), "id": q["id"], "plates": {}}
        for pn, (vs, s0) in under.items():
            s, fo = signed(Vp, plates[pn], vs); ok = ~np.isnan(s); pk = ok & (s > poke_min); th = pk & ~rimf[pn][fo]; gap = np.where(ok, np.clip(s0 - s, 0, None), np.nan)
            row["plates"][pn] = {"under": int(len(vs)), "uncovered_share": float(1.0 - ok.mean()), "poke_share": float(pk.sum() / len(vs)), "poke_depth_p95_mm": float(np.percentile(s[pk], 95) * 1000) if pk.any() else 0.0,
                                 "through_share": float(th.sum() / len(vs)), "through_depth_p95_mm": float(np.percentile(s[th], 95) * 1000) if th.any() else 0.0,
                                 "gap_p50_mm": float(np.nanpercentile(gap, 50) * 1000) if ok.any() else 0.0, "gap_p95_mm": float(np.nanpercentile(gap, 95) * 1000) if ok.any() else 0.0}
            if row["plates"][pn]["through_depth_p95_mm"] > flag_mm: flags.append({"set": row["set"], "id": q["id"], "plate": pn, "through_depth_p95_mm": round(row["plates"][pn]["through_depth_p95_mm"], 1), "vertices": int(th.sum())})
        n = sum(r["under"] for r in row["plates"].values()); row["poke_share"] = float(sum(r["poke_share"] * r["under"] for r in row["plates"].values()) / max(n, 1))
        row["through_share"] = float(sum(r["through_share"] * r["under"] for r in row["plates"].values()) / max(n, 1))
        row["poke_depth_p95_mm"] = max([r["poke_depth_p95_mm"] for r in row["plates"].values()] or [0.0]); row["through_depth_p95_mm"] = max([r["through_depth_p95_mm"] for r in row["plates"].values()] or [0.0]); rows.append(row)
    summ = {}
    for pn in under:
        ps = [r["plates"][pn]["poke_share"] for r in rows]; pd = [r["plates"][pn]["poke_depth_p95_mm"] for r in rows]; g = [r["plates"][pn]["gap_p95_mm"] for r in rows]; g5 = [r["plates"][pn]["gap_p50_mm"] for r in rows]
        ts = [r["plates"][pn]["through_share"] for r in rows]; td = [r["plates"][pn]["through_depth_p95_mm"] for r in rows]
        wi = int(np.argmax(g)); summ[pn] = {"under": int(len(under[pn][0])), "behind_but_not_under": blocked.get(pn, 0), "poke_share_median": float(np.median(ps)), "poke_share_max": float(max(ps)), "poke_depth_p95_mm_median": float(np.median(pd)), "poke_depth_p95_mm_max": float(max(pd)),
                                             "through_share_median": float(np.median(ts)), "through_share_max": float(max(ts)), "through_depth_p95_mm_median": float(np.median(td)), "through_depth_p95_mm_max": float(max(td)),
                                             "gap_p50_mm_median": float(np.median(g5)), "gap_p95_mm_median": float(np.median(g)), "gap_p95_mm_max": float(max(g)), "gap_worst_pose": rows[wi]["id"]}
    summ["_flags"] = {"through_depth_over_mm": flag_mm, "count": len(flags), "items": sorted(flags, key=lambda f_: -f_["through_depth_p95_mm"])}
    return rows, summ


def fit_clearance(V, tris, fcls, W, rig, cls, classes, ride_cls, poses, cap=0.010, margin=0.0005, passes=3, reach=0.02, cap_v=None):
    """Sink padding under its shoulder plate where the plate would cut through it in a pose. (Also used for the strips
    of underlay under other plates' rims: `ride_cls` then gives, per generated vertex, the class of the plate above it.)

    Padding that does not ride fully with its plate stays with the body, and the plate can swing into it. For each
    padding vertex take the deepest it comes out through the plate over `poses`; move it that far (plus `margin`, at
    most `cap`) inward along its rest normal, spread the move among the padding so no pit forms, and repeat. Vertices
    that would need more than `cap` are places where the plate goes into the body itself; they are left to show.

    Only padding moves. On 2026-10-06 this also sank other soft vertices "behind" the plate (a strap under its rim);
    an independent check found 110 of the 111 it moved were in plain view in the rest pose, just past the rim, and
    moved by up to 10 mm. A vertex beside a rim is behind the plate's plane without being hidden by it.
    `cap_v` (per vertex, optional) lowers the cap near a welded edge: sunk its full depth right beside the weld, a strip
    drops away as a cliff whose faces turn their backs to the viewer, and the cliff shows as a row of see-through teeth
    along the rim (the Knight's knee tops).
    `rig` and `W` must already include helper joints and ride. Returns (V, report)."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    name2 = {c["name"]: int(i) for i, c in classes.items()}; V = V.copy(); rep = {"cap_mm": cap * 1000, "passes": []}
    if not (ride_cls > 0).any(): return V, rep
    kindf = np.array([classes[str(int(c))]["kind"] if str(int(c)) in classes else "soft" for c in fcls]); sf = tris[kindf == "soft"]; idx, val = H.dense_to_top4(W); adj = {}
    softv = np.zeros(len(V), bool); softv[sf.ravel()] = True; kindv = np.array([classes[str(int(c))]["kind"] if str(int(c)) in classes else "soft" for c in cls]); softv &= kindv == "soft"
    for a, b in np.unique(np.sort(np.vstack([sf[:, [0, 1]], sf[:, [1, 2]], sf[:, [2, 0]]]), axis=1), axis=0): adj.setdefault(int(a), []).append(int(b)); adj.setdefault(int(b), []).append(int(a))
    def signed(bv, P):
        hit = bv.find_nearest(Vector(P.tolist()), reach * 1.5)
        if hit[0] is None: return None
        s_ = float((Vector(P.tolist()) - hit[0]).dot(hit[1])); return s_ if abs(s_) >= 0.85 * hit[3] else None
    sets = {}
    for cid in np.unique(ride_cls[ride_cls > 0]):                                # per plate: its padding
        pf = tris[fcls == int(cid)]; fv = np.unique(pf); loc_f = np.searchsorted(fv, pf); sets[int(cid)] = (pf, fv, loc_f, np.nonzero(ride_cls == cid)[0])
    mv = np.unique(np.concatenate([s_[3] for s_ in sets.values()])); inset = np.zeros(len(V), bool); inset[mv] = True
    solved = [H.solve_pose(rig, q["targets"]) for q in poses]; total = np.zeros(len(V))
    for it in range(passes):
        fn = np.cross(V[sf[:, 1]] - V[sf[:, 0]], V[sf[:, 2]] - V[sf[:, 0]]); vn = np.zeros_like(V)
        for k in range(3): np.add.at(vn, sf[:, k], fn)
        vn /= np.maximum(np.linalg.norm(vn, axis=1, keepdims=True), 1e-12); need = np.zeros(len(V))
        for cid, (pf, fv, loc_f, pv) in sets.items():
            for A, P in solved:
                Vf = H.skin(V[fv], idx[fv], val[fv], rig, A, P); Vp = H.skin(V[pv], idx[pv], val[pv], rig, A, P); bv = BVHTree.FromPolygons([tuple(q) for q in Vf], [tuple(t) for t in loc_f])
                for k, v in enumerate(pv):
                    s_ = signed(bv, Vp[k])
                    if s_ is not None and s_ > 0: need[v] = max(need[v], s_)
        off = np.where(need > 0, np.minimum(need + margin, cap), 0.0)
        for _ in range(3):                                                       # spread: a neighbour of a sunk vertex sinks at least half as far
            nb = np.array([np.mean([off[w] if inset[w] else 0.0 for w in adj.get(int(v), [v])]) for v in mv]); off[mv] = np.maximum(off[mv], nb)
        off = np.minimum(off, np.maximum((cap if cap_v is None else np.minimum(cap, cap_v)) - total, 0.0)); V[mv] -= vn[mv] * off[mv, None]; total += off
        rep["passes"].append({"verts_coming_through": int((need > 0.0005).sum()), "need_mm_p50_p90_max": [round(float(np.percentile(need[need > 0], q_)) * 1000, 2) for q_ in (50, 90, 100)] if (need > 0).any() else [0, 0, 0], "over_cap": int((need + total > cap + margin).sum()), "verts_moved": int((off > 0).sum())})
    # the sinking is per vertex and leaves dents; even them out (two passes, the welded rim fixed). The padding is seen
    # when a rim lifts, and a dented shoulder reads as damage.
    if (total > 0).any():
        for _ in range(2):
            Q_ = V.copy()
            for v in mv:
                nb_ = adj.get(int(v))
                if nb_: Q_[v] = 0.5 * V[v] + 0.5 * np.mean(V[nb_], axis=0)
            V = Q_
    name = {int(k): c["name"] for k, c in classes.items()}; by = {}
    for v in np.nonzero(total > 0)[0]: by[name.get(int(cls[v]), "?")] = by.get(name.get(int(cls[v]), "?"), 0) + 1
    rep["sunk_mm_p50_p90_max"] = [round(float(np.percentile(total[total > 0], q_)) * 1000, 2) for q_ in (50, 90, 100)] if (total > 0).any() else [0, 0, 0]; rep["verts_sunk"] = int((total > 0).sum()); rep["verts_sunk_by_class"] = by
    return V, rep


def rebind(W, rig, cls, classes, table):
    """bind rigid classes to other joints (one-hot), returns (W, classes)."""
    classes = json.loads(json.dumps(classes)); W = W.copy(); names = rig["names"]
    for cname, joint in table.items():
        for cid, c in classes.items():
            if c["name"] == cname and c["kind"] == "rigid":
                c["bone"] = joint
                if joint in names: m = cls == int(cid); W[m] = 0; W[m, names.index(joint)] = 1.0
    return W, classes


if __name__ == "__main__":
    from hb_common import p
    import hb_harness as HN, hb_helpers as HH
    bound = p(*os.environ["HB_BOUND"].split("/")); V, tris, W, rig, cls, classes = HN.load_bound(bound)
    table = json.loads(os.environ.get("HB_REBIND", "{}")); helpers = [h for h in os.environ.get("HB_HELPERS", "").split(",") if h]
    if table: W, classes = rebind(W, rig, cls, classes, table)
    rig, W = HH.add_helpers(V, W, rig, helpers, cls, classes)
    poses = []
    for s in os.environ.get("HB_SETS", "rom,general").split(","):
        poses += H.rom_poses() if s == "rom" else H.load_pose_sets(p("poses"), [s])
    rows, summ = contact(V, tris, W, rig, cls, classes, poses, flag_mm=float(os.environ.get("HB_POKE_FLAG_MM", "10")))
    out = bound[:-4] + "." + os.environ.get("HB_TAG", "contact-plates") + ".json"; json.dump({"bound": os.environ["HB_BOUND"], "helpers": helpers, "rebind": table, "poses": len(rows), "flags": summ["_flags"], "summary": {k_: v_ for k_, v_ in summ.items() if k_ != "_flags"}, "rows": rows}, open(out, "w"), indent=1)
    sh = [r["poke_share"] for r in rows]; print("CONTACT_ALL poses %d  poke share median %.3f max %.3f  depth p95 max %.1f mm" % (len(rows), float(np.median(sh)), max(sh), max(r["poke_depth_p95_mm"] for r in rows)))
    fl = summ.pop("_flags")
    for pn, s_ in summ.items(): print("CONTACT %-14s under %4d  poke med %.3f max %.3f depth max %4.1f mm | through steel med %.3f max %.3f depth max %4.1f mm | gap p95 med %4.1f max %4.1f mm (%s)" % (pn, s_["under"], s_["poke_share_median"], s_["poke_share_max"], s_["poke_depth_p95_mm_max"], s_["through_share_median"], s_["through_share_max"], s_["through_depth_p95_mm_max"], s_["gap_p95_mm_median"], s_["gap_p95_mm_max"], s_["gap_worst_pose"]))
    print("CONTACT_FLAGS through-steel depth over %.0f mm: %d pose-plates" % (fl["through_depth_over_mm"], fl["count"]), [(f_["id"], f_["plate"], f_["through_depth_p95_mm"]) for f_ in fl["items"][:8]])
    print("CONTACT_REPORT", out)
