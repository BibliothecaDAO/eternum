"""Backs in front (runs inside Blender for its BVH): how much of what the bind shows from eight sides a reduced level of
detail meets back-first. A ray counts when the first surface it meets on the reduction is seen from behind, within 10 mm
of where the bind's first surface is seen from the front. A one-sided renderer draws nothing for that back, so the
surface behind it shows; but the back still throws its shadow on it. Almost always a plate's lining standing in front
of its plate. env HB_BOUND (the bind), HB_LOW (the reduction), both npz paths under human-baseline. Prints BACK."""
import bpy, sys, os, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
def load(path):
    z = np.load(path); J = json.load(open(path[:-4] + ".json")); V = z["V"].astype(float); T = z["tris"].astype(np.int64); return BVHTree.FromPolygons(V.tolist(), T.tolist()), z["fcls"], {int(k): c["name"] for k, c in J["classes"].items()}, V
hi, HF, nm, HV = load(p(*os.environ["HB_BOUND"].split("/"))); lo, LF, _, LV = load(p(*os.environ["HB_LOW"].split("/"))); step = 0.003; cen = (HV.min(0) + HV.max(0)) / 2; R = float(np.linalg.norm(HV.max(0) - HV.min(0))) / 2 + 0.05; tot = 0; bad = 0; by = {}
for az, el in ((0, 0), (180, 0), (90, 0), (-90, 0), (45, 15), (-45, 15), (135, 15), (0, 80)):
    a, e = math.radians(az), math.radians(el); d = -np.array([math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)]); rt = np.cross(d, [0, 0, 1.0]); rt = rt / np.linalg.norm(rt) if np.linalg.norm(rt) > 1e-6 else np.array([1.0, 0, 0]); uu = np.cross(rt, d); dv = Vector(d.tolist())
    for x in np.arange(-R, R, step):
        for y in np.arange(-R, R, step):
            o = Vector((cen + rt * x + uu * y - d * (R + 0.1)).tolist()); h = hi.ray_cast(o, dv)
            if h[0] is None or h[1].dot(dv) >= 0: continue
            tot += 1; l = lo.ray_cast(o, dv)
            if l[0] is not None and l[1].dot(dv) > 0 and (l[0] - h[0]).length < 0.01: bad += 1; n = nm.get(int(LF[l[2]]), "?"); by[n] = by.get(n, 0) + 1
json.dump({"rays": tot, "back_first": bad, "share": round(bad / max(tot, 1), 5), "by_class": by}, open(p(*os.environ["HB_LOW"].split("/"))[:-4] + ".lod-backs.json", "w"), indent=1)
print("BACK", os.environ["HB_LOW"], "rays", tot, "meet a back first within 10 mm of the bind's front: %d (%.3f%%)" % (bad, 100.0 * bad / max(tot, 1)), dict(sorted(by.items(), key=lambda kv: -kv[1])[:10]))
