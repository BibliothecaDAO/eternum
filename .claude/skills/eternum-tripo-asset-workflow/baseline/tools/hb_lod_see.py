"""What a viewer sees of a reduced level of detail against the bind it came from, at rest (runs inside Blender for its BVH; renders nothing).

A reduction keeps the bind's vertices, so it cannot move a surface, but it can draw a rim back (what lies under a plate then
shows along its edge), let one layer come through another, or lose a thin part altogether. None of that shows in the pose
harness, which measures each surface by itself. This looks at both meshes from eight sides through a grid of rays and
compares, ray by ray, the first surface met from its front (backs are not drawn, as in the game):

  hidden surface showing   the reduction shows generated surface (underlay, padding, a fill, a lining) where the bind shows
                           a surface of the character: the defect a player sees as dark wedges and holes
  another piece showing    both show the character's surface but of different classes, and more than HB_SEE_DEPTH apart in
                           depth (a layer through another; a boundary between two pieces that has merely shifted is not counted)
  lost                     the bind is hit and the reduction is not (outline drawn in)
  gained                   the reverse (outline grown)
Only patches count for the first two: a ray with at least two of its eight neighbours the same.

env HB_BOUND  the bind (npz path under human-baseline); HB_LOW the reduced or baked npz
    HB_STEP   ray spacing in metres (default 0.002); HB_SEE_DEPTH (default 0.0015)
    HB_MAX_HIDDEN, HB_MAX_OTHER, HB_MAX_LOST  limits as shares of the rays that hit the bind (defaults from
              harness/thresholds.json "reduced_see": "near", or "mid" for a mesh of at most mid_at_most_triangles)
Writes <low>.lod-see.json. Prints SEE lines and LOD_SEE PASS or FAIL."""
import bpy, os, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p

GEN = ("underlay", "padding", "joint_fill")
def load(path):
    z = np.load(path); J = json.load(open(path[:-4] + ".json")); cl = {int(k): c for k, c in J["classes"].items()}
    gen = {k for k, c in cl.items() if c["name"] in GEN or c.get("lining_of") or c.get("generated")}; V = z["V"].astype(float); T = z["tris"].astype(np.int64)
    return {"bvh": BVHTree.FromPolygons(V.tolist(), T.tolist()), "F": z["fcls"], "names": {k: c["name"] for k, c in cl.items()}, "gen": gen, "V": V}
def first_front(m, o, d):
    q = o
    for _ in range(16):
        loc, nor, idx, dist = m["bvh"].ray_cast(q, d)
        if loc is None: return -1, 0.0
        if nor.dot(d) < 0: return int(m["F"][idx]), (loc - o).length
        q = loc + d * 1e-5
    return -1, 0.0

if __name__ == "__main__":
    hi = load(p(*os.environ["HB_BOUND"].split("/"))); lp = p(*os.environ["HB_LOW"].split("/")); lo = load(lp); step = float(os.environ.get("HB_STEP", "0.002")); DEP = float(os.environ.get("HB_SEE_DEPTH", "0.0015"))
    try: TH = json.load(open(p("harness", "thresholds.json"))).get("reduced_see", {})
    except Exception: TH = {}
    ntri = int(len(np.load(lp)["tris"])); level = "mid" if ntri <= int(TH.get("mid_at_most_triangles", 6000)) else "near"; TH = TH.get(level, {})
    LIM = {"hidden": float(os.environ.get("HB_MAX_HIDDEN", TH.get("hidden_surface_showing", 0.001))), "other": float(os.environ.get("HB_MAX_OTHER", TH.get("another_piece_showing", 0.006))), "lost": float(os.environ.get("HB_MAX_LOST", TH.get("lost", 0.02)))}
    lo_, hi_ = hi["V"].min(0) - 0.01, hi["V"].max(0) + 0.01; cen = (lo_ + hi_) / 2; R = float(np.linalg.norm(hi_ - lo_)) / 2 + 0.05; up = np.array([0, 0, 1.0]); views = {}
    for name, az, el in (("front", 0, 0), ("back", 180, 0), ("left", 90, 0), ("right", -90, 0), ("front-left", 45, 15), ("front-right", -45, 15), ("back-left", 135, 15), ("above", 0, 80)):
        a, e = math.radians(az), math.radians(el); eye = np.array([math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e)]); views[name] = -eye          # looking direction (az 0: from the front, the figure faces -y)
    rep = {"bind": os.environ["HB_BOUND"], "reduced": os.environ["HB_LOW"], "triangles": ntri, "held_to": level, "ray_spacing_mm": step * 1000, "views": {}, "limits": LIM}; tot = {"rays": 0, "hidden": 0, "other": 0, "lost": 0, "gained": 0}; worst = {}
    for name, d in views.items():
        d = d / np.linalg.norm(d); rt = np.cross(d, up); rt = rt / np.linalg.norm(rt) if np.linalg.norm(rt) > 1e-6 else np.array([1.0, 0, 0]); uu = np.cross(rt, d); n = int(2 * R / step); us = (np.arange(n) + 0.5) * step - R
        ca = np.full((n, n), -2, np.int32); cb = np.full((n, n), -2, np.int32); da = np.zeros((n, n)); db = np.zeros((n, n)); dv = Vector(d.tolist())
        # only where the bind's box projects: cast the bind first, then the reduction on a one-cell-dilated mask of its hits
        for i, x in enumerate(us):
            for j, y in enumerate(us):
                o = Vector((cen + rt * x + uu * y - d * (R + 0.1)).tolist()); ca[j, i], da[j, i] = first_front(hi, o, dv)
        hit = ca >= 0; mask = hit.copy()
        for sx, sy in ((1, 0), (-1, 0), (0, 1), (0, -1)): mask |= np.roll(np.roll(hit, sx, 1), sy, 0)
        for j, i in zip(*np.nonzero(mask)):
            o = Vector((cen + rt * us[i] + uu * us[j] - d * (R + 0.1)).tolist()); cb[j, i], db[j, i] = first_front(lo, o, dv)
        hb = cb >= 0; gen_b = np.isin(cb, list(lo["gen"])); gen_a = np.isin(ca, list(hi["gen"]))
        hidden = hit & hb & gen_b & ~gen_a; other = hit & hb & ~gen_b & ~gen_a & (ca != cb) & (np.abs(da - db) > DEP); lost = hit & ~hb; gained = ~hit & hb
        def patches(m):
            k = np.zeros(m.shape, int)
            for sx in (-1, 0, 1):
                for sy in (-1, 0, 1):
                    if sx or sy: k += np.roll(np.roll(m, sx, 1), sy, 0)
            return m & (k >= 2)
        hidden, other = patches(hidden), patches(other); nh = int(hit.sum())
        rep["views"][name] = {"rays_on_the_bind": nh, "hidden_surface_showing": round(float(hidden.sum()) / max(nh, 1), 5), "another_piece_showing": round(float(other.sum()) / max(nh, 1), 5), "lost": round(float(lost.sum()) / max(nh, 1), 5), "gained": round(float(gained.sum()) / max(nh, 1), 5)}
        tot["rays"] += nh; tot["hidden"] += int(hidden.sum()); tot["other"] += int(other.sum()); tot["lost"] += int(lost.sum()); tot["gained"] += int(gained.sum())
        for c in ca[hidden]: worst[hi["names"].get(int(c), "?")] = worst.get(hi["names"].get(int(c), "?"), 0) + 1
        print("SEE %-12s %6d rays: hidden surface showing %.3f%%, another piece %.3f%%, lost %.3f%%, gained %.3f%%" % (name, nh, 100 * hidden.sum() / max(nh, 1), 100 * other.sum() / max(nh, 1), 100 * lost.sum() / max(nh, 1), 100 * gained.sum() / max(nh, 1)), flush=True)
    sh = {k: round(tot[k] / max(tot["rays"], 1), 5) for k in ("hidden", "other", "lost", "gained")}; rep["all_views"] = {"rays_on_the_bind": tot["rays"], "hidden_surface_showing": sh["hidden"], "another_piece_showing": sh["other"], "lost": sh["lost"], "gained": sh["gained"]}
    rep["hidden_surface_shows_where_the_bind_shows"] = dict(sorted(worst.items(), key=lambda kv: -kv[1])[:15]); fails = [k for k in ("hidden", "other", "lost") if sh[k] > LIM[k]]; rep["result"] = "PASS" if not fails else "FAIL"; rep["failed"] = fails
    json.dump(rep, open(lp[:-4] + ".lod-see.json", "w"), indent=1); print("SEE all views", json.dumps(rep["all_views"]), "| hidden surface shows over:", json.dumps(rep["hidden_surface_shows_where_the_bind_shows"])); print("LOD_SEE", rep["result"], ", ".join(fails))
