"""Equipment on sockets (runs inside Blender: it reads the items' meshes and uses its BVH).

Removable items (sword, shield, crossbow, quiver, reins) are separate objects. Each follows one joint rigidly through a
socket: a fixed transform from the joint to the item. This tool fits the sockets on a bound character in its rest pose,
measures the fit, and then poses the character through the pose sets to find where an item passes through the body or
through another item.

env HB_CHAR   char.json spec (path under human-baseline)
    HB_BOUND  bound npz (path under human-baseline)
    HB_GEAR   gear spec json (path under human-baseline), see below
    HB_HELPERS helper joints (comma list); HB_SETS pose sets for the clash check (default: the spec's pose_sets. The
               general set is the family's body test and is not authored for equipment: with arms hanging, a shield on
               the forearm stands in the thigh. A troop's own set is where its items must be clear.)

Gear spec: {"items": [ {...}, ... ]}; every item has "name", "blend" (path under human-baseline), "object", "joint",
and "fit":
  "grip"     a handle on a bored guide axis (a sword in a fist). Item frame: handle along one axis ("blade": "+Z"),
             "edge" and "face" axes. Keys: "guide" (the bore report, path under human-baseline), "hand_class",
             "blade_toward" (working-frame direction the blade leaves the fist, e.g. [0,-1,0] = forward),
             "grip_half" (metres from the item's origin to the guard's inner face), "grip_radius", "guard_gap";
             optional "forearm_joint" (reports the blade's angle to the forearm) and "cant_deg" (the handle turned in
             the hand about the palm's normal, blade toward the forearm's line: a second, canted grip to measure).
  "forearm"  a plate on a forearm (a shield). Item frame: rear surface at the origin, front toward "front" ("-Y"),
             "up" ("+Z"). Keys: "wrist_joint", "surface_classes", "outward" (working-frame direction away from the
             body, e.g. [1,0,0] for a left arm), "centre_from_wrist" (metres up the forearm), "radius", "clip"
             (metres the rear may sink into the forearm, default 0.001).
  "socket"   "matrix": a 4x4 in the working frame at rest, given outright.

Writes <work>/gear-fit.json: per item the rest matrix in the working frame, the same socket relative to its joint (the
baseline's joints have world-aligned rest frames, so that is the rest matrix with the joint's rest position taken off),
and the fit's measurements. Writes <bound>.gear-clash.json: per pose and item, body vertices inside the item and how
deep, by class, item against item, and how much of each item lies inside the body (`item_inside_body_span_mm`, along
the item's long axis: a thin blade run through a torso holds few body vertices, so the first count alone misses it).
Prints GEAR lines."""
import bpy, os, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH

AX = {"+X": (0, 1.0), "-X": (0, -1.0), "+Y": (1, 1.0), "-Y": (1, -1.0), "+Z": (2, 1.0), "-Z": (2, -1.0)}


def load_item(blend, name):
    """the item's mesh in its own frame: (V, tris)"""
    with bpy.data.libraries.load(blend, link=False) as (src, dst): dst.objects = [name]
    o = dst.objects[0]; me = o.data; me.calc_loop_triangles()
    V = np.array([(o.matrix_world @ v.co)[:] for v in me.vertices], float); T = np.array([t.vertices[:] for t in me.loop_triangles], np.int64)
    bpy.data.objects.remove(o); return V, T


def bvh(V, T): return BVHTree.FromPolygons([tuple(q) for q in V], [tuple(int(x) for x in t) for t in T])


def apply(M, V): return V @ M[:3, :3].T + M[:3, 3]


def inside(bv, pts, reach=0.03):
    """depth (metres, 0 if outside) of each point inside a closed item. Inside is decided by counting crossings along
    two rays (odd on both = inside); depth is the distance to the nearest surface. (The side of the nearest face alone
    is wrong beside a thin blade: a point 30 mm past its edge reads as 30 mm inside.)"""
    out = np.zeros(len(pts)); dirs = (Vector((0.5377, 0.2673, 0.8)), Vector((-0.6, 0.64, -0.48)))
    for k, q in enumerate(pts):
        qv = Vector(q.tolist()); loc, nrm, fi, dd = bv.find_nearest(qv, reach)
        if loc is None: continue
        odd = True
        for d in dirs:
            n = 0; o = qv
            for _ in range(64):
                hit = bv.ray_cast(o, d, 2.0)
                if hit[0] is None: break
                n += 1; o = hit[0] + d * 1e-6
            if n % 2 == 0: odd = False; break
        if odd: out[k] = dd
    return out


_VOTE = [Vector(d).normalized() for d in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1), (1, 1, 1), (-1, 1, 1), (1, -1, 1), (-1, -1, 1), (1, 1, -1), (-1, 1, -1), (1, -1, -1), (-1, -1, -1))]


def in_body(bv, fn, pts, reach=0.25, need=12):
    """which points lie inside the body: from each point fourteen rays; inside when at least `need` of them meet a
    surface from behind first (the body is layered and open at its borders, so parity does not work; a vote does).
    fn: the body's face normals. A blade lying against the chest is outside; one run through it is inside."""
    out = np.zeros(len(pts), bool)
    for k, q in enumerate(pts):
        qv = Vector(q.tolist()); back = 0; miss = 0
        for d in _VOTE:
            loc, nrm, fi, dd = bv.ray_cast(qv, d, reach)
            if loc is None: miss += 1
            elif float(fn[fi] @ np.array(d)) > 0: back += 1
            if miss > len(_VOTE) - need: break
        out[k] = back >= need
    return out


def fit_grip(V, tris, fcls, classes, rig, it, IV, IT):
    g = json.load(open(p(*it["guide"].split("/"))))["guide"]; a = np.array(g["axis"], float); a /= np.linalg.norm(a); c0 = np.array(g["point_on_axis"], float)
    d = a if a @ np.array(it.get("blade_toward", [0, -1, 0]), float) > 0 else -a                    # the blade leaves the fist on the thumb and index side
    name2 = {c["name"]: int(k) for k, c in classes.items()}; hv = np.unique(tris[fcls == name2[it["hand_class"]]]); HVp = V[hv]
    v = HVp - c0; t = v @ d; r = np.linalg.norm(v - np.outer(t, d), axis=1); near = r < 1.8 * g["radius_mm"] / 1000; tf, tb = float(t[near].max()), float(t[near].min())
    gh = float(it["grip_half"]); origin = c0 + d * (tf + float(it.get("guard_gap", 0.0015)) - gh)
    wrist = np.array(rig["rest"][rig["names"].index(it["joint"])], float); fist = HVp[near].mean(0); e = (wrist - fist) - d * ((wrist - fist) @ d); e /= np.linalg.norm(e)    # the edge that faces the wrist
    x = np.cross(e, d); x /= np.linalg.norm(x)
    cant = math.radians(float(it.get("cant_deg", 0.0)))                                 # a canted grip: the handle turned in the hand, about the palm's normal through the grip's centre, so the blade tips toward the line of the forearm
    if cant: d0_ = d.copy(); d = d0_ * math.cos(cant) - e * math.sin(cant); e = e * math.cos(cant) + d0_ * math.sin(cant); c0 = origin.copy(); t = (HVp - c0) @ d; r = np.linalg.norm((HVp - c0) - np.outer(t, d), axis=1)
    bi, bs = AX[it.get("blade", "+Z")]; ei, es = AX[it.get("edge", "+Y")]; fi_ = 3 - bi - ei; R = np.zeros((3, 3)); R[:, bi] = d * bs; R[:, ei] = e * es; R[:, fi_] = np.cross(R[:, (fi_ + 1) % 3], R[:, (fi_ + 2) % 3])
    M = np.eye(4); M[:3, :3] = R; M[:3, 3] = origin; SV = apply(M, IV); sb = bvh(SV, IT)
    hf = tris[fcls == name2[it["hand_class"]]]; hb = bvh(V, hf); dep = inside(sb, HVp, 0.04) * 1000
    # round the handle, inside the fist: is the handle's surface inside the hand's outer surface (hidden), outside it (it
    # shows through the hand), or is there no hand there at all (an opening between fingers: the handle is simply seen)
    if cant: near = r < 2.2 * g["radius_mm"] / 1000; tf, tb = float(t[near].max()), float(t[near].min())
    rg = float(it.get("grip_radius", 0.0074)); cov = thr = opn = 0; proud = 0.0
    for ti in np.arange(tb + 0.002, tf - 0.002, 0.002):
        for k in range(36):
            ang = 2 * math.pi * k / 36; u = e * math.cos(ang) + x * math.sin(ang); o_ = c0 + d * ti + u * 0.06; hit = hb.ray_cast(Vector(o_.tolist()), Vector((-u).tolist()), 0.06)
            if hit[0] is None: opn += 1
            elif 0.06 - hit[3] < rg - 0.0002: thr += 1; proud = max(proud, rg - (0.06 - hit[3]))
            else: cov += 1
    forearm = None
    if it.get("forearm_joint"):
        fa = wrist - np.array(rig["rest"][rig["names"].index(it["forearm_joint"])], float); forearm = round(float(np.degrees(np.arccos(np.clip(d @ fa / np.linalg.norm(fa), -1, 1)))), 1)
    tz = (SV - origin) @ d; guard = SV[(tz > gh - 0.0005) & (tz < gh + 0.008)]; pommel = SV[tz < -gh + 0.0005]
    gc = min(hb.find_nearest(Vector(q.tolist()))[3] for q in guard[::max(1, len(guard) // 400)]) if len(guard) else None
    pc = min(hb.find_nearest(Vector(q.tolist()))[3] for q in pommel[::max(1, len(pommel) // 400)]) if len(pommel) else None
    outside_fist = HVp[(dep > 0) & ((t < tb - 0.001) | (t > tf + 0.001))]
    rep = {"handle_axis": d.round(5).tolist(), "edge_toward_wrist": e.round(5).tolist(), "face_normal": x.round(5).tolist(), "grip_centre": origin.round(5).tolist(),
           "guide_radius_mm": g["radius_mm"], "grip_radius_mm": rg * 1000, "fist_span_on_axis_mm": round((tf - tb) * 1000, 1), "handle_beyond_fist_mm": {"pommel_side": round((2 * gh - (tf - tb) - float(it.get("guard_gap", 0.0015))) * 1000, 1), "guard_side": round(float(it.get("guard_gap", 0.0015)) * 1000, 1)},
           "hand_vertices_inside_item": int((dep > 0).sum()), "depth_mm_p50_p95_max": [round(float(np.percentile(dep[dep > 0], q_)), 2) for q_ in (50, 95, 100)] if (dep > 0).any() else [0, 0, 0],
           "handle_round_the_fist": {"covered_by_hand": cov, "shows_through_hand": thr, "open_between_fingers": opn, "proud_of_the_hand_mm_max": round(proud * 1000, 2)}, "hand_vertices_inside_item_outside_the_fist_span": int(len(outside_fist)),
           "guard_to_hand_mm": round(gc * 1000, 2) if gc is not None else None, "pommel_to_hand_mm": round(pc * 1000, 2) if pc is not None else None,
           "cant_deg": float(it.get("cant_deg", 0.0)), "blade_to_forearm_deg": forearm}
    return M, rep


def fit_forearm(V, tris, fcls, classes, rig, it, IV, IT):
    names = rig["names"]; elbow = np.array(rig["rest"][names.index(it["joint"])], float); wrist = np.array(rig["rest"][names.index(it["wrist_joint"])], float); fa = wrist - elbow; Lf = float(np.linalg.norm(fa)); fa /= Lf    # elbow to wrist
    name2 = {c["name"]: int(k) for k, c in classes.items()}; sv = np.unique(tris[np.isin(fcls, [name2[n] for n in it["surface_classes"] if n in name2])]); S = V[sv]; S = S[(S - elbow) @ fa > -0.01]
    plate = np.unique(tris[fcls == name2[it["surface_classes"][0]]]); Pp = V[plate]; s_ = (Pp - elbow) @ fa; cs = []
    for lo in np.arange(s_.min(), s_.max(), 0.006):                                                      # the forearm's own centreline through the plate (bracer) on it
        m = (s_ >= lo) & (s_ < lo + 0.006)
        if m.sum() > 15: cs.append(Pp[m].mean(0))
    cs = np.array(cs); ax = np.linalg.svd(cs - cs.mean(0))[2][0]; ax = ax if ax @ fa > 0 else -ax; c_w = cs.mean(0) + ax * ((wrist - cs.mean(0)) @ ax); c_axis = c_w - ax * float(it.get("centre_from_wrist", 0.021))
    n = np.array(it.get("outward", [1, 0, 0]), float); n -= ax * (n @ ax); n /= np.linalg.norm(n); ss, hh = [], []
    for k in range(1, 11):                                                                               # the forearm's outer line: the plate leans with it
        sk = 0.008 * k; cp = c_w - ax * sk; v = S - cp; a_ = v @ ax; rd = np.linalg.norm(v - np.outer(a_, ax), axis=1); m = (np.abs(a_) < 0.004) & (rd < 0.045) & ((S - c_w) @ n > 0)
        if m.sum() > 10: ss.append(sk); hh.append(float(((S[m] - c_w) @ n).max()))
    slope = float(np.polyfit(ss, hh, 1)[0]) if len(ss) >= 3 else 0.0; n = n + ax * slope; n /= np.linalg.norm(n)   # a forearm that thickens toward the elbow tips the plate's normal toward the wrist
    up = -ax - n * (-ax @ n); up /= np.linalg.norm(up)                                                    # the item's "up" lies along the forearm, toward the elbow
    fi, fs = AX[it.get("front", "-Y")]; ui, us = AX[it.get("up", "+Z")]; oi = 3 - fi - ui; Rr = float(it.get("radius", float(np.abs(np.delete(IV, fi, axis=1)).max())))
    srad = np.linalg.norm(np.delete(IV, fi, axis=1), axis=1); sdep = IV[:, fi] * fs; bins = np.arange(0, Rr + 0.004, 0.004); prof = np.full(len(bins), np.inf)
    for k in range(len(bins)):                                                                           # the item's rear profile by radius (0 on the rear plane)
        m = (srad >= bins[k] - 0.002) & (srad < bins[k] + 0.006)
        if m.any(): prof[k] = sdep[m].min()
    rear = lambda r: prof[np.clip((r / 0.004).astype(int), 0, len(prof) - 1)]
    v = S - c_axis; h = v @ n; rad = np.linalg.norm(v - np.outer(h, n), axis=1); foot = (rad < Rr) & (h > -0.06); clip = float(it.get("clip", 0.001))
    lift = h[foot] - rear(rad[foot]); t_off = float(lift.max()) - clip; lim = int(np.nonzero(foot)[0][int(np.argmax(lift))]); origin = c_axis + n * t_off
    R = np.zeros((3, 3)); R[:, fi] = n * fs; upv = up - n * (up @ n); upv /= np.linalg.norm(upv); R[:, ui] = upv * us; R[:, oi] = np.cross(R[:, (oi + 1) % 3], R[:, (oi + 2) % 3])
    M = np.eye(4); M[:3, :3] = R; M[:3, 3] = origin
    hp = h - (t_off + rear(rad)); pen = hp[(rad < Rr) & (hp > 1e-6) & (hp < 0.05)]; near_c = (rad < 0.02) & (h > -0.06)
    rep = {"forearm_axis_elbow_to_wrist": ax.round(5).tolist(), "outward": n.round(5).tolist(), "up_toward_elbow": upv.round(5).tolist(), "origin_rear_centre": origin.round(5).tolist(), "forearm_length_mm": round(Lf * 1000, 1),
           "centre_from_wrist_mm": round(float(it.get("centre_from_wrist", 0.021)) * 1000, 1), "lean_with_forearm_deg": round(math.degrees(math.atan(slope)), 2), "clip_setting_mm": clip * 1000,
           "rear_to_forearm_at_centre_mm": round((t_off + float(prof[:5].min()) - float(h[near_c].max())) * 1000, 2) if near_c.any() else None, "limiting_point": S[lim].round(4).tolist(), "limiting_radius_mm": round(float(rad[lim]) * 1000, 1),
           "surface_vertices_inside_item": int(len(pen)), "depth_mm_max": round(float(pen.max()) * 1000, 2) if len(pen) else 0.0}
    return M, rep


if __name__ == "__main__":
    SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); bound = p(*os.environ["HB_BOUND"].split("/")); G = json.load(open(p(*os.environ["HB_GEAR"].split("/"))))
    V, tris, W, rig, cls, classes = HN.load_bound(bound); fcls = np.load(bound)["fcls"]; names0 = list(rig["names"]); fit = {"bound": os.environ["HB_BOUND"], "gear": os.environ["HB_GEAR"], "frame": "working frame: +Z up, -Y forward, +X the character's left, metres", "items": {}}; items = {}
    for it in G["items"]:
        IV, IT = load_item(p(*it["blend"].split("/")), it["object"])
        if it["fit"] == "grip": M, rep = fit_grip(V, tris, fcls, classes, rig, it, IV, IT)
        elif it["fit"] == "forearm": M, rep = fit_forearm(V, tris, fcls, classes, rig, it, IV, IT)
        else: M, rep = np.array(it["matrix"], float), {}
        j = names0.index(it["joint"]); L = M.copy(); L[:3, 3] -= np.array(rig["rest"][j], float)
        # a simple stand-in for the item's volume, for tools that cannot afford the mesh (hb_item_aim.py): slices along
        # the item's long axis (a handle's) or thin axis (a plate's), each an ellipse with the slice's own half-extents
        pa = AX[it.get("blade", "+Z")][0] if it["fit"] == "grip" else (AX[it.get("front", "-Y")][0] if it["fit"] == "forearm" else int(np.argmax(np.ptp(IV, axis=0))))
        oth = [k_ for k_ in range(3) if k_ != pa]; t_ = IV[:, pa]; ns = 24 if it["fit"] == "grip" else 4; ed = np.linspace(t_.min(), t_.max(), ns + 1); sl = []
        for k_ in range(ns):
            m_ = (t_ >= ed[k_] - 1e-9) & (t_ <= ed[k_ + 1] + 1e-9)
            if m_.sum() >= 3: sl.append([round(float(ed[k_]), 5), round(float(ed[k_ + 1]), 5)] + [round(float(x_), 5) for x_ in np.abs(IV[m_][:, oth]).max(0)])
        fit["items"][it["name"]] = {"blend": it["blend"], "object": it["object"], "joint": it["joint"], "fit": it["fit"], "rest_matrix": M.round(6).tolist(), "socket_in_joint_frame": L.round(6).tolist(), "measurements": rep, "triangles": int(len(IT)),
                                    "proxy": {"axis": pa, "slices": sl}, "ignore_classes": it.get("ignore_classes", [])}
        items[it["name"]] = (IV, IT, M, it["joint"]); print("GEAR_FIT", it["name"], json.dumps(rep)[:900])
    json.dump(fit, open(os.path.join(WORK, "gear-fit.json"), "w"), indent=1)
    # ---- clash check over the pose sets
    helpers = [h for h in os.environ.get("HB_HELPERS", "").split(",") if h]; rig, Wh = HH.add_helpers(V, W, rig, helpers, cls, classes); idx, val = H.dense_to_top4(Wh); names = rig["names"]; nm = {int(k): c["name"] for k, c in classes.items()}
    sets = os.environ.get("HB_SETS", ",".join(list(SPEC.get("pose_sets", [])) or ["general"])).split(","); poses = H.load_pose_sets(p("poses"), sets); vclass = np.array([nm.get(int(c), "?") for c in cls])
    skip = {it["name"]: set(it.get("ignore_classes", [])) for it in G["items"]}; rows = []; worst = {}
    fname = np.array([nm.get(int(c), "?") for c in fcls]); AXI = {n_: int(fit["items"][n_]["proxy"]["axis"]) if fit["items"][n_]["fit"] == "grip" else int(np.argmax(np.ptp(items[n_][0], axis=0))) for n_ in items}; worst_in = {}
    for q in poses:
        A, P = H.solve_pose(rig, q["targets"]); Vp = H.skin(V, idx, val, rig, A, P); row = {"set": q.get("set", ""), "id": q["id"], "items": {}}; posed = {}; posed_m = {}
        for n_, (IV, IT, M, jn) in items.items():
            j = names.index(jn); Mp = np.eye(4); Mp[:3, :3] = A[j] @ M[:3, :3]; Mp[:3, 3] = A[j] @ (M[:3, 3] - rig["rest"][j]) + P[j]; SVp = apply(Mp, IV); posed[n_] = (SVp, bvh(SVp, IT)); posed_m[n_] = Mp
        for n_, (SVp, sb) in posed.items():
            lo, hi = SVp.min(0) - 0.01, SVp.max(0) + 0.01; cand = np.nonzero(np.all((Vp > lo) & (Vp < hi), axis=1) & ~np.isin(vclass, list(skip[n_])))[0]; dep = inside(sb, Vp[cand]) * 1000; m = dep > 0.5; by = {}
            for c_ in np.unique(vclass[cand][m]): k = vclass[cand][m] == c_; by[str(c_)] = [int(k.sum()), round(float(dep[m][k].max()), 1)]
            other = {}
            for o_, (OV, ob) in posed.items():
                if o_ == n_: continue
                d2 = inside(sb, OV[::3]) * 1000
                if (d2 > 0.5).any(): other[o_] = [int((d2 > 0.5).sum()), round(float(d2.max()), 1)]
            # and the other way round, which is what shows a blade run through a torso: how much of the item is inside the body
            keep = ~np.isin(fname, list(skip[n_])); bt = tris[keep]; bb = bvh(Vp, bt); fnp = np.cross(Vp[bt[:, 1]] - Vp[bt[:, 0]], Vp[bt[:, 2]] - Vp[bt[:, 0]]); fnp /= np.maximum(np.linalg.norm(fnp, axis=1, keepdims=True), 1e-20)
            st = max(1, len(SVp) // 700); smp = SVp[::st]; ins = in_body(bb, fnp, smp); la = AXI[n_]; Mi = np.linalg.inv(posed_m[n_]); loc_ = (smp - posed_m[n_][:3, 3]) @ posed_m[n_][:3, :3]; span = 0.0
            if ins.any(): b_ = np.unique(np.floor(loc_[ins][:, la] / 0.005).astype(int)); span = 5.0 * len(b_)
            row["items"][n_] = {"body_vertices_inside": int(m.sum()), "depth_mm_max": round(float(dep.max()), 1) if len(dep) else 0.0, "by_class": by, "other_items_inside": other,
                                "item_inside_body_share": round(float(ins.mean()), 4), "item_inside_body_span_mm": span}
            if m.sum() > worst.get(n_, (-1,))[0]: worst[n_] = (int(m.sum()), q["id"], round(float(dep.max()), 1))
            if span > worst_in.get(n_, (-1,))[0]: worst_in[n_] = (span, q["id"], round(float(ins.mean()), 3))
        rows.append(row)
    summ = {n_: {"poses_with_body_inside": int(sum(r["items"][n_]["body_vertices_inside"] > 0 for r in rows)), "poses": len(rows), "worst": worst.get(n_),
                 "classes": sorted({c_ for r in rows for c_ in r["items"][n_]["by_class"]}), "poses_touching_other_items": int(sum(bool(r["items"][n_]["other_items_inside"]) for r in rows)),
                 "poses_with_item_inside_body": int(sum(r["items"][n_]["item_inside_body_span_mm"] > 10.0 for r in rows)), "worst_item_inside_body_span_mm": worst_in.get(n_)} for n_ in items}
    json.dump({"bound": os.environ["HB_BOUND"], "sets": sets, "summary": summ, "rows": rows}, open(bound[:-4] + ".gear-clash.json", "w"), indent=1)
    for n_, s_ in summ.items(): print("GEAR_CLASH %-8s body inside in %d of %d poses; worst %s; classes %s; touching other items in %d poses" % (n_, s_["poses_with_body_inside"], s_["poses"], s_["worst"], s_["classes"], s_["poses_touching_other_items"]))
    for n_, s_ in summ.items(): print("GEAR_THROUGH %-8s more than 10 mm of the item inside the body in %d of %d poses; worst %s" % (n_, s_["poses_with_item_inside_body"], s_["poses"], s_["worst_item_inside_body_span_mm"]))
