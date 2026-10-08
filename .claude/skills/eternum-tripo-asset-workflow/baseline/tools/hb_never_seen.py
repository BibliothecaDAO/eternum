"""Find the generated surface of a bind that can never be seen, in any pose, from any side (runs inside Blender for its BVH).

The bind builds underlay under every plate, a lining inside every plate, padding and fills at the joints, because any
of it may come into view when something moves. Much of it never can: the underlay under a thigh pad moves with the
thigh exactly as the pad does, and the pad seals it in. A reduced level of detail has no triangles to spare for that.

A generated face can never be seen if it moves as one with what hides it. Here: its three vertices are bound whole
(HB_RIGID_W or more) to one joint, and every line of sight out of it (RAYS directions spread over the cone it faces, out
to CONE degrees from its normal, from its middle and from near each corner) meets, within REACH, a face that is bound
whole to the same joint. Then nothing can open a view onto it. (Not the whole half-space: a face deep under a pad that
stands off the limb can be reached along the slot under the pad's edge, at a few degrees to the surface; from there it
is a sliver, and nothing would ever be left out if that counted.) A line that gets out, or that ends on a face bound to another joint
or to more than one, means the face might be seen: it is kept.

env HB_BOUND  the bind (npz path under human-baseline)
    HB_NS_RAYS (default 40), HB_NS_CONE degrees (default 70), HB_NS_REACH metres (default 0.08), HB_RIGID_W (default 0.98)
Writes <bound>.never-seen.npy (one flag per face of the bind) and .never-seen.json. Prints NEVER lines."""
import bpy, os, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p

GEN = ("underlay", "padding", "joint_fill")
if __name__ == "__main__":
    bp = p(*os.environ["HB_BOUND"].split("/")); b = np.load(bp); J = json.load(open(bp[:-4] + ".json")); cl = {int(k): c for k, c in J["classes"].items()}; RAYS = int(os.environ.get("HB_NS_RAYS", "40")); REACH = float(os.environ.get("HB_NS_REACH", "0.08")); RW = float(os.environ.get("HB_RIGID_W", "0.98"))
    V, T, F, W = b["V"].astype(float), b["tris"].astype(np.int64), b["fcls"], b["W"].astype(float); gen_ids = [k for k, c in cl.items() if c["name"] in GEN or c.get("lining_of") or c.get("generated")]; gen = np.isin(F, gen_ids)
    top = W.argmax(1); whole = W.max(1) >= RW; vj = np.where(whole, top, -1); fj = np.where((vj[T[:, 0]] == vj[T[:, 1]]) & (vj[T[:, 1]] == vj[T[:, 2]]), vj[T[:, 0]], -1)      # the one joint a face is bound whole to, or -1
    P = V[T]; n = np.cross(P[:, 1] - P[:, 0], P[:, 2] - P[:, 0]); A = np.linalg.norm(n, axis=1) / 2; n = n / np.maximum(2 * A[:, None], 1e-30); cen = P.mean(1); bvh = BVHTree.FromPolygons(V.tolist(), T.tolist())
    # directions over a half-space: evenly spread, out to 85 degrees from the pole
    CONE = float(os.environ.get("HB_NS_CONE", "70")); k = np.arange(RAYS) + 0.5; cosz = 1 - k / RAYS * (1 - math.cos(math.radians(CONE))); sinz = np.sqrt(1 - cosz ** 2); az = k * math.pi * (3 - math.sqrt(5)); D0 = np.stack([sinz * np.cos(az), sinz * np.sin(az), cosz], 1)
    never = np.zeros(len(T), bool); cand = np.nonzero(gen & (fj >= 0) & (A > 1e-12))[0]
    for f in cand:
        nz = n[f]; a = np.cross(nz, [1.0, 0, 0] if abs(nz[0]) < 0.9 else [0, 1.0, 0]); a /= np.linalg.norm(a); bb = np.cross(nz, a); dirs = D0[:, 0:1] * a + D0[:, 1:2] * bb + D0[:, 2:3] * nz; ok = True; j = fj[f]
        starts = [cen[f]] + [cen[f] * 0.15 + P[f][c] * 0.85 for c in range(3)]
        for si, s0 in enumerate(starts):
            o = Vector((s0 + nz * 2e-5).tolist())
            for d in (dirs if si == 0 else dirs[::4]):
                loc, nor, idx, dist = bvh.ray_cast(o, Vector(d.tolist()), REACH)
                if loc is None or fj[idx] != j: ok = False; break
            if not ok: break
        never[f] = ok
    names = {k: c["name"] for k, c in cl.items()}; by = {}
    for c in np.unique(F[gen]):
        m = F == c; by[names[int(c)]] = {"faces": int(m.sum()), "never_seen": int((m & never).sum()), "area_mm2": round(float(A[m].sum() * 1e6), 0), "never_seen_mm2": round(float(A[m & never].sum() * 1e6), 0)}
    rep = {"bind": os.environ["HB_BOUND"], "faces": int(len(T)), "generated_faces": int(gen.sum()), "of_them_bound_whole_to_one_joint": int(len(cand)), "never_seen": int(never.sum()), "never_seen_share_of_generated_area": round(float(A[never].sum() / max(A[gen].sum(), 1e-18)), 3), "rays": RAYS, "cone_deg": CONE, "reach_mm": REACH * 1000, "bound_whole_means_weight_at_least": RW,
           "by_class": dict(sorted(by.items(), key=lambda kv: -kv[1]["never_seen"])[:40])}
    np.save(bp[:-4] + ".never-seen.npy", never); json.dump(rep, open(bp[:-4] + ".never-seen.json", "w"), indent=1); print("NEVER", json.dumps({k: v for k, v in rep.items() if k != "by_class"})); print("NEVER by class", json.dumps({k: [v["never_seen"], v["faces"]] for k, v in list(rep["by_class"].items())[:16]}))
