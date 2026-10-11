"""See-inside check (runs inside Blender for its BVH): does any pose open a view into the inside of the mesh?

Two shares per joint and pose, each above the same share in the rest pose. "Inside seen": rays whose first surface is
seen from behind. "Holes": of those, rays that then meet nothing from the front before leaving the joint's cube. A
renderer that draws one side only does not draw the backs; where something drawn lies behind them (a neck inside a
helmet) the view is closed, and where nothing does the background shows through the figure. Holes are the defect.
A hole ray counts only with another beside it.

A gap at a joint shows the inside of a shell: the back of a surface. A runtime that draws one side only shows nothing
there at all, so the gap is a hole. For every pose and every joint this looks at a cube round the joint from six
sides (four level, two from above, turned with the pelvis) through a grid of rays and counts how many of the rays that
hit something hit it from behind. The same count in the rest pose is subtracted, so open shells that are part of the
design (the underside of a skirt) do not count.

env HB_BOUND   bound npz (path under human-baseline)
    HB_HELPERS helper joints (comma list)
    HB_SETS    pose sets (default rom,general)
    HB_GRID    rays per side of the grid (default 20)
    HB_FLAG    share that counts as a flag (default 0.03 = 3% of what is seen at that joint)
    HB_TAG     suffix of the report file (default gap-check)
Writes <bound>.<tag>.json: per joint the median, 90th percentile and worst share with its pose and view, and every
flag. Prints GAP_CHECK lines. Reported, with flags; the pass limit is in harness/thresholds.json."""
import os, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH

# joint, cube half-side in metres at stature 0.6
JOINTS = [("neck", "Head", 0.07), ("shoulder_l", "upperarm_l", 0.075), ("shoulder_r", "upperarm_r", 0.075), ("elbow_l", "lowerarm_l", 0.055), ("elbow_r", "lowerarm_r", 0.055),
          ("wrist_l", "hand_l", 0.04), ("wrist_r", "hand_r", 0.04), ("waist", "spine_01", 0.11), ("hip_l", "thigh_l", 0.09), ("hip_r", "thigh_r", 0.09),
          ("knee_l", "calf_l", 0.07), ("knee_r", "calf_r", 0.07), ("ankle_l", "foot_l", 0.06), ("ankle_r", "foot_r", 0.06)]
FAR = 1.5
c35, s35 = math.cos(math.radians(35)), math.sin(math.radians(35))
VIEWS = {"front": (0, 1, 0), "back": (0, -1, 0), "left": (-1, 0, 0), "right": (1, 0, 0), "front-above": (0, c35, -s35), "back-above": (0, -c35, -s35)}   # direction the rays travel, body frame (+Z up, -Y forward)


def look(bv, c, a, s, G):
    """rays that meet something in the cube; of those, rays whose first surface is seen from behind; of those, rays that
    then meet no surface from the front before leaving the cube (what a one-sided renderer shows as a hole: it does not
    draw the backs, and nothing drawn lies behind them)"""
    a = np.asarray(a, float); a /= np.linalg.norm(a); u = np.cross(a, [0, 0, 1.0]); u = u / np.linalg.norm(u) if np.linalg.norm(u) > 1e-6 else np.array([1.0, 0, 0]); v = np.cross(a, u)
    hits = backs = 0; av = Vector(a.tolist()); H_ = np.zeros((G, G), bool); xs_ = (np.arange(G) + 0.5) / G * 2 * s - s
    for ix, x in enumerate(xs_):
        for iy, y in enumerate(xs_):
            # from well outside the figure, so the first thing met is an outside surface or the inside of an open one;
            # a ray started inside the body leaves through skin from behind and counts falsely
            o = c + u * x + v * y - a * FAR; loc, nrm, fi, dd = bv.ray_cast(Vector(o.tolist()), av, FAR + s)
            if loc is None or abs(dd - FAR) > s: continue                        # nothing, or the first thing met is outside the cube (the joint is hidden from here)
            hits += 1
            if float(nrm.dot(av)) <= 0.05: continue
            backs += 1; t = dd; front = False
            for _ in range(12):                                                  # on through the backs: is anything drawn behind them, inside the cube?
                o2 = Vector((o + a * (t + 1e-4)).tolist()); loc, nrm, fi, d2 = bv.ray_cast(o2, av, FAR + s - t)
                if loc is None: break
                t += d2 + 1e-4
                if t - FAR > s: break
                if float(nrm.dot(av)) < -0.05: front = True; break
            H_[ix, iy] = not front
    # a hole is at least two rays side by side: one ray through a crack between two faces is not something anyone sees
    nb8 = sum(np.roll(np.roll(H_, dx, 0), dy, 1) for dx in (-1, 0, 1) for dy in (-1, 0, 1)) - H_
    return hits, backs, int((H_ & (nb8 >= 1)).sum())


if __name__ == "__main__":
    bound = p(*os.environ["HB_BOUND"].split("/")); V, tris, W, rig, cls, classes = HN.load_bound(bound)
    helpers = [h for h in os.environ.get("HB_HELPERS", "").split(",") if h]; rig, W = HH.add_helpers(V, W, rig, helpers, cls, classes); idx, val = H.dense_to_top4(W); names = rig["names"]
    G = int(os.environ.get("HB_GRID", "20")); FLAG = float(os.environ.get("HB_FLAG", "0.03")); poses = []
    for s in os.environ.get("HB_SETS", "rom,general").split(","):
        poses += [dict(q, set="rom") for q in H.rom_poses()] if s == "rom" else H.load_pose_sets(p("poses"), [s])
    T = [tuple(int(x) for x in t) for t in tris]; ip = names.index("pelvis"); joints = [(n, names.index(j), s) for n, j, s in JOINTS if j in names]
    bv0 = BVHTree.FromPolygons([tuple(q) for q in V], T); rest = {}
    for n, j, s in joints:
        for vn, a in VIEWS.items():
            h, b, ho = look(bv0, rig["rest"][j], a, s, G); rest[(n, vn)] = (b / h, ho / h) if h >= 20 else (0.0, 0.0)
    rows = []; per = {n: [] for n, _, _ in joints}; perh = {n: [] for n, _, _ in joints}
    for q in poses:
        A, P = H.solve_pose(rig, q["targets"]); Vp = H.skin(V, idx, val, rig, A, P); bv = BVHTree.FromPolygons([tuple(x) for x in Vp], T); r = {"set": q.get("set", ""), "id": q["id"], "joints": {}}
        for n, j, s in joints:
            best = (0.0, None, 0); besth = (0.0, None)
            for vn, a in VIEWS.items():
                h, b, ho = look(bv, P[j], A[ip] @ np.array(a, float), s, G)
                if h < 20: continue
                d = b / h - rest[(n, vn)][0]; dh = ho / h - rest[(n, vn)][1]
                if d > best[0]: best = (d, vn, h)
                if dh > besth[0]: besth = (dh, vn)
            r["joints"][n] = {"share": round(best[0], 4), "view": best[1], "hole_share": round(besth[0], 4), "hole_view": besth[1]}; per[n].append((best[0], q["id"], best[1])); perh[n].append((besth[0], q["id"], besth[1]))
        rows.append(r)
    summ = {}; flags = []; hflags = []
    for n, lst in per.items():
        sh = np.array([x[0] for x in lst]); w = max(lst); summ[n] = {"median": round(float(np.median(sh)), 4), "p90": round(float(np.percentile(sh, 90)), 4), "max": round(float(w[0]), 4), "worst_pose": w[1], "worst_view": w[2], "poses_flagged": int((sh > FLAG).sum())}
        hs = np.array([x[0] for x in perh[n]]); wh = max(perh[n]); summ[n].update({"hole_median": round(float(np.median(hs)), 4), "hole_p90": round(float(np.percentile(hs, 90)), 4), "hole_max": round(float(wh[0]), 4), "hole_worst_pose": wh[1], "hole_worst_view": wh[2], "hole_poses_flagged": int((hs > FLAG).sum())})
        flags += [{"joint": n, "pose": x[1], "view": x[2], "share": round(float(x[0]), 4)} for x in lst if x[0] > FLAG]; hflags += [{"joint": n, "pose": x[1], "view": x[2], "hole_share": round(float(x[0]), 4)} for x in perh[n] if x[0] > FLAG]
    flags.sort(key=lambda f: -f["share"]); hflags.sort(key=lambda f: -f["hole_share"])
    out = bound[:-4] + "." + os.environ.get("HB_TAG", "gap-check") + ".json"; json.dump({"bound": os.environ["HB_BOUND"], "helpers": helpers, "poses": len(poses), "grid": G, "flag_over": FLAG, "summary": summ, "flags": flags, "hole_flags": hflags, "rows": rows}, open(out, "w"), indent=1)
    for n, s_ in summ.items(): print("GAP_CHECK %-11s inside seen: median %5.2f%%  p90 %5.2f%%  worst %5.2f%% (%s, %s)  poses over %.0f%%: %2d | holes: p90 %5.2f%%  worst %5.2f%% (%s, %s)  poses over %.0f%%: %d" % (n, 100 * s_["median"], 100 * s_["p90"], 100 * s_["max"], s_["worst_pose"], s_["worst_view"], 100 * FLAG, s_["poses_flagged"], 100 * s_["hole_p90"], 100 * s_["hole_max"], s_["hole_worst_pose"], s_["hole_worst_view"], 100 * FLAG, s_["hole_poses_flagged"]))
    print("GAP_CHECK_HOLES %d" % len(hflags), [(f["joint"], f["pose"], f["view"], round(100 * f["hole_share"], 1)) for f in hflags[:10]])
    print("GAP_CHECK_FLAGS %d" % len(flags), [(f["joint"], f["pose"], f["view"], round(100 * f["share"], 1)) for f in flags[:10]]); print("GAP_REPORT", out)
