"""Where do the items point? (numpy only)

A pose in the library states what its items should do: `"items": {"sword": {"blade": [f, l, u]}, "shield": {"face":
[f, l, u]}}`, directions as [forward, left, up] in the character's root frame. With the items fitted on their sockets
(`<work>/gear-fit.json` from hb_gear.py) this poses the rig and measures, per pose and item, the angle between where
the item points and where the pose says it should.

  python hb_item_aim.py --char <char.json under human-baseline> --bound <bound npz under human-baseline>
                        [--sets knight] [--helpers elbow_half,knee_half,upperarm_twist] [--fix] [--out <poses file>]

Item axes are named in the gear spec's item entry: `"aim": {"blade": "+Z"}` for a sword, `"aim": {"face": "-Y"}` for a
shield (the item's own axes, as fitted).

--fix: for every pose and item more than `--tol` degrees off (default 12), adjust that arm's targets to bring the item
onto its direction. The order is the one a body uses: wrist first (deviation, flexion, forearm roll), then the upper
arm's roll, then, only if still more than `--tol` off, elbow, elevation and plane, each held within `--stay` degrees
(default 20) of the authored pose. Everything stays within the `use` limits of poses/limits.json, wrist flexion within
`--wrist` degrees (default 25), and the elbow never straighter than 15 degrees. No change is accepted that makes left
and right limbs pass through each other.

--clear (with --fix): then make room. Each item has a stand-in volume in gear-fit.json; a sample of the body's vertices
is posed and counted inside it, one item's axis inside another, and points of each item inside the body (a point is
inside when five of its six nearest body vertices have it more than 2 mm behind them; deeper counts for more). Either
arm is moved, a little at a time, wherever that lowers the score, as long as every item stays within the tolerance of
its direction, no limbs cross and the arm stays within `--stay-clear` degrees (default 30) of the authored pose.
--place (with --fix): an item whose pose entry has `"at": {"joint": <a joint>, "offset": [forward, left, up]}` (statures,
from that joint's posed position to the item's own origin: a sword's grip centre, a shield's rear centre; the offset
turns with the joint, so "in front of the chest" stays in front of the chest, unless `"frame": "root"` is given)
has its whole arm solved from that intent and its direction together, instead of the wrist-first correction of the
authored arm: of the arms that put the item there pointing that way, the easiest (least bent wrist, least roll). The
clearing step then keeps such an item within --pos-tol metres (default 0.025) of its place. This is how to author: say
where the hand or the shield is and where the item points; do not write seven arm angles by eye.
--gap <metres>: the room kept between one item and another when making room (default 0.008): a blade whose tip stops
on a shield's rim reads as touching it.
--hold (without --place): items that have an "at" are taken as already placed: the wrist-first correction leaves them
alone and the clearing step keeps them within --pos-tol of their place.
--only <ids>: work on these poses only (comma list); the others pass through unchanged.
--score: print each pose's clash score as it stands (no change). --behind (metres, default 0.002), --votes (of six,
default 5) and --every (body vertex stride, default 3) set how strict the item-in-body test is.
--report <file>: write the json report there instead of <work>/item-aim[-fixed].json (for a check that must not touch
the work folder; an absolute path).
--src <poses file>: read the (single) set from this file instead of poses/<set>.json, e.g. the authored version.
--give <deg> (with --clear): where that was not enough, the item's direction itself may give way by up to that many
degrees, and the pose's `items` entry is rewritten to where the item now points (the authored direction is kept in the
`aimed` record). An authored direction that runs a blade through the fighter's own body was wrong, not the body.
What cannot be cleared either way is reported; it is the pose that needs rethinking, not the arm that needs forcing.
The blade direction drives the forearm; the arm is never forced to a pre-placed item. Writes the adjusted set to --out (never over the library file unless
--out names it) with a `"aimed"` record in every pose it changed. Prints AIM lines."""
import argparse, json, os, sys, copy
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH

AXV = {"+X": (1, 0, 0), "-X": (-1, 0, 0), "+Y": (0, 1, 0), "-Y": (0, -1, 0), "+Z": (0, 0, 1), "-Z": (0, 0, -1)}
ARM = {"hand_r": "arm_r", "lowerarm_r": "arm_r", "hand_l": "arm_l", "lowerarm_l": "arm_l"}
ORDER = {"hand": [("wrist_dev", 1), ("wrist_flex", 1), ("pron", 1), ("rot", 1), ("elbow", 2), ("elev", 2), ("plane", 2)], "lowerarm": [("rot", 1), ("elbow", 2), ("elev", 2), ("plane", 2)]}


def root_to_working(v): v = np.asarray(v, float); w = np.array([v[1], -v[0], v[2]]); return w / max(np.linalg.norm(w), 1e-12)   # [forward, left, up] -> working (+X left, -Y forward, +Z up)


def item_dirs(rig, targets, items):
    A, P = H.solve_pose(rig, targets); out = {}
    for n, (jn, axes) in items.items():
        j = rig["names"].index(jn); out[n] = {k: A[j] @ v for k, v in axes.items()}
    return out


def clash(rig, targets, prox, B):
    """how much of the body lies inside the items' stand-in volumes, and how much of one item inside another: counts
    over a sample of the body's vertices (B: positions, top-4 joints and weights, per-item masks of what to ignore)"""
    A, P = H.solve_pose(rig, targets); Vp = H.skin(B["V"], B["idx"], B["val"], rig, A, P); n = 0; frames = {}
    for name, (jn, M, px) in prox.items():
        j = rig["names"].index(jn); frames[name] = (A[j] @ M[:3, :3], A[j] @ (M[:3, 3] - rig["rest"][j]) + P[j])
    def inside(name, pts, pad=0.0):
        R, t = frames[name]; px = prox[name][2]; L = (pts - t) @ R; a = px["axis"]; o = [k for k in range(3) if k != a]; m = np.zeros(len(pts), bool)
        for lo, hi, ea, eb in px["slices"]: m |= (L[:, a] >= lo - pad) & (L[:, a] <= hi + pad) & ((L[:, o[0]] / max(ea + pad, 1e-4)) ** 2 + (L[:, o[1]] / max(eb + pad, 1e-4)) ** 2 <= 1.0)
        return m
    if "N" in B:
        M = np.zeros((len(Vp), 3, 3))
        for k_ in range(B["idx"].shape[1]): M += B["val"][:, k_, None, None] * A[B["idx"][:, k_]]
        Np = np.einsum("nij,nj->ni", M, B["N"])
    for name in prox:
        n += int(inside(name, Vp[B["use"][name]]).sum())
        if "N" in B and name in B.get("smp", {}):                                   # and the item in the body: a thin blade run through a torso holds few body vertices
            R, t = frames[name]; S = B["smp"][name] @ R.T + t; U = Vp[B["use"][name]]; UN = Np[B["use"][name]]
            d2 = ((S[:, None, :] - U[None, :, :]) ** 2).sum(-1); nn = np.argpartition(d2, 6, axis=1)[:, :6]; beh = -np.einsum("skj,skj->sk", S[:, None, :] - U[nn], UN[nn])
            ins = ((beh > B.get("behind", 0.002)).sum(1) >= B.get("votes", 5)) & (np.sqrt(np.take_along_axis(d2, nn, axis=1).min(1)) < 0.05)
            n += float((2.0 + np.median(beh[ins], axis=1) / 0.005).sum()) if ins.any() else 0.0
        for other in prox:
            if other == name: continue
            R, t = frames[other]; px = prox[other][2]; a = px["axis"]; pts = np.array([t + R[:, a] * ((lo + hi) / 2) for lo, hi, ea, eb in px["slices"]]); n += 3 * int(inside(name, pts, B.get("gap", 0.0)).sum())   # one item's axis inside another, with a gap kept between them
    return n, min(H.limb_clearance(rig, A, P).values())


def place(rig, t, arm, kind, joint, M, want_dir, axis_dir, target, LIM, wrist=25.0, lc0=0.0, seeds=6):
    """Put an item where a pose says, pointing where it says: solve one arm from intent. `target` is where the item's own
    origin should be (working frame, metres), `want_dir` where its named axis should point (working frame, unit).
    Every arm target is free inside its `use` range (elbow at least 15, wrist flexion within `wrist`; the arm may go
    straight back while it is low). The cost is the position error (20 mm = 1: a place is a rough intent), the
    direction error (4 degrees = 1) and a charge for a wrist, forearm roll or upper-arm roll near its limit (1 each at
    the limit, rising with the fourth power), so that of the arms that do the job the easiest is chosen, and an intent
    that only a wrung arm can meet is met less exactly instead. A coarse grid of upper-arm and
    elbow positions is ranked by where it puts the item; the best few are refined over all the arm's targets.
    Returns the new targets and (position error in metres, direction error in degrees, cost)."""
    import copy as _c
    j = rig["names"].index(joint); keys = ["plane", "elev", "rot", "elbow"] + (["pron", "wrist_flex", "wrist_dev"] if kind == "hand" else [])
    low = LIM["plane"].get("use_at_low_elev")
    def bnd(kk):
        lo, hi = LIM[kk]["use"]
        if kk == "plane" and low: lo, hi = min(lo, low["range"][0]), max(hi, low["range"][1])
        if kk == "elbow": lo = max(lo, 15.0)
        if kk == "wrist_flex": lo, hi = max(lo, -wrist), min(hi, wrist)
        return lo, hi
    def ev(tt):
        A, P = H.solve_pose(rig, tt); o = A[j] @ (M[:3, 3] - rig["rest"][j]) + P[j]; d = A[j] @ axis_dir; pe = float(np.linalg.norm(o - target)); de = float(np.degrees(np.arccos(np.clip(d @ want_dir, -1, 1)))) if want_dir is not None else 0.0
        a_ = tt[arm]; ease = (a_.get("wrist_flex", 0) / 25.0) ** 4 + (a_.get("wrist_dev", 0) / 22.0) ** 4 + (a_.get("pron", 0) / 80.0) ** 4 + 0.5 * (a_.get("rot", 0) / 80.0) ** 4 + 0.05 * ((a_.get("wrist_flex", 0) / 25.0) ** 2 + (a_.get("wrist_dev", 0) / 22.0) ** 2 + (a_.get("pron", 0) / 80.0) ** 2)
        cross = 0.0 if min(H.limb_clearance(rig, A, P).values()) >= min(-0.004, lc0) else 50.0
        if low and a_.get("plane", 0) < LIM["plane"]["use"][0] - 1e-6 and a_.get("elev", 0) > low["elev_at_most"] + 1e-6: cross += 50.0     # straight back only while the arm is low
        return (pe / 0.020) ** 2 + (de / 4.0) ** 2 + ease + cross, pe, de
    grid = []
    for pl in (-90, -45, -20, 20, 60, 100, 130):
        for el in (5, 30, 55, 80, 105, 135):
            for ro in (-60, -20, 20, 60):
                for eb in (20, 55, 90, 125):
                    if low and pl < LIM["plane"]["use"][0] and el > low["elev_at_most"]: continue
                    tt = _c.deepcopy(t); tt[arm].update({"plane": float(np.clip(pl, *bnd("plane"))), "elev": float(np.clip(el, *bnd("elev"))), "rot": float(np.clip(ro, *bnd("rot"))), "elbow": float(eb)})
                    if kind == "hand": tt[arm].update({"pron": 0.0, "wrist_flex": 0.0, "wrist_dev": 0.0})
                    A, P = H.solve_pose(rig, tt); o = A[j] @ (M[:3, 3] - rig["rest"][j]) + P[j]; grid.append((float(np.linalg.norm(o - target)), tt))
    grid.sort(key=lambda g: g[0]); starts = [g[1] for g in grid[:seeds]] + [_c.deepcopy(t)]; best = None
    for st in starts:
        for pr0 in ((-40.0, 0.0, 40.0) if kind == "hand" else (None,)):
            tt = _c.deepcopy(st)
            if pr0 is not None: tt[arm]["pron"] = pr0
            cur = ev(tt)
            for step in (16, 8, 4, 2, 1):
                moved = True
                while moved:
                    moved = False
                    for kk in keys:
                        lo, hi = bnd(kk)
                        for sg in (1, -1):
                            v = float(np.clip(tt[arm].get(kk, 0) + sg * step, lo, hi))
                            if v == tt[arm].get(kk, 0): continue
                            t2 = _c.deepcopy(tt); t2[arm][kk] = v; c2 = ev(t2)
                            if c2[0] < cur[0] - 1e-4: tt, cur, moved = t2, c2, True
            if best is None or cur[0] < best[1][0]: best = (tt, cur)
    return best[0], (best[1][1], best[1][2], best[1][0])


def err(rig, targets, items, want):
    d = item_dirs(rig, targets, items); e = {}
    for n, w in want.items():
        for k, v in w.items():
            if n in d and k in d[n]: e[(n, k)] = float(np.degrees(np.arccos(np.clip(d[n][k] @ root_to_working(v), -1, 1))))
    return e


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--bound", required=True); ap.add_argument("--sets", default=None); ap.add_argument("--helpers", default="")
    ap.add_argument("--fix", action="store_true"); ap.add_argument("--out", default=None); ap.add_argument("--tol", type=float, default=12.0); ap.add_argument("--stay", type=float, default=20.0); ap.add_argument("--wrist", type=float, default=25.0); ap.add_argument("--clear", action="store_true"); ap.add_argument("--stay-clear", dest="stay_clear", type=float, default=30.0); ap.add_argument("--give", type=float, default=0.0); ap.add_argument("--src", default=None); ap.add_argument("--report", default=None); ap.add_argument("--place", action="store_true"); ap.add_argument("--hold", action="store_true"); ap.add_argument("--gap", type=float, default=0.008); ap.add_argument("--pos-tol", dest="pos_tol", type=float, default=0.025); ap.add_argument("--stature", type=float, default=0.6); ap.add_argument("--only", default=None); ap.add_argument("--score", action="store_true"); ap.add_argument("--behind", type=float, default=0.002); ap.add_argument("--votes", type=int, default=5); ap.add_argument("--every", type=int, default=3); ap.add_argument("--clash-ok", dest="clash_ok", type=int, default=2); a = ap.parse_args()
    SPEC = json.load(open(p(*a.char.split("/")))); WORK = p(*SPEC["work"].split("/")); fit = json.load(open(os.path.join(WORK, "gear-fit.json"))); gspec = {i["name"]: i for i in json.load(open(p(*fit["gear"].split("/"))))["items"]}
    V, tris, W, rig, cls, classes = HN.load_bound(p(*a.bound.split("/"))); rig, Wh = HH.add_helpers(V, W, rig, [h for h in a.helpers.split(",") if h], cls, classes)
    items = {}
    for n, gi in fit["items"].items():
        M = np.array(gi["rest_matrix"], float)[:3, :3]; items[n] = (gi["joint"], {k: M @ np.array(AXV[v], float) for k, v in gspec[n].get("aim", {}).items()})
    LIM = json.load(open(p("poses", "limits.json")))["arm"]; sets = (a.sets or ",".join(SPEC.get("pose_sets", []))).split(","); rows = []; changed = {}
    # for the limb and clash tests: every third body vertex, and per item which of them to ignore (the hand that holds it)
    nmc = {int(k): c["name"] for k, c in classes.items()}; vname = np.array([nmc.get(int(c), "?") for c in cls]); sub = np.arange(0, len(V), a.every); idx4, val4 = H.dense_to_top4(Wh)
    B = {"V": V[sub], "idx": idx4[sub], "val": val4[sub], "use": {n: ~np.isin(vname[sub], gi.get("ignore_classes", [])) for n, gi in fit["items"].items()}}
    prox = {n: (gi["joint"], np.array(gi["rest_matrix"], float), gi["proxy"]) for n, gi in fit["items"].items() if gi.get("proxy")}
    fn_ = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); VN = np.zeros_like(V)
    for k_ in range(3): np.add.at(VN, tris[:, k_], fn_)
    B["N"] = (VN / np.maximum(np.linalg.norm(VN, axis=1, keepdims=True), 1e-20))[sub]; B["smp"] = {}
    for n, (jn, M_, px) in prox.items():                                             # points of each item, in its own frame, that must not end up inside the body
        ax_ = px["axis"]; o_ = [k for k in range(3) if k != ax_]; pts = []
        if fit["items"][n]["fit"] == "grip":
            gh = float(gspec[n].get("grip_half", 0.0)) + 0.012                      # the handle is in the fist: leave it out
            for lo, hi, ea, eb in px["slices"]:
                c_ = (lo + hi) / 2
                if abs(c_) < gh: continue
                w_ = (0, ea) if ea >= eb else (1, eb)
                for f_ in (0.0, 0.6, -0.6, 0.95, -0.95): q_ = np.zeros(3); q_[ax_] = c_; q_[o_[w_[0]]] = f_ * w_[1]; pts.append(q_)
        else:
            wd = max(px["slices"], key=lambda sl: max(sl[2], sl[3])); R_ = max(wd[2], wd[3]); c_ = (wd[0] + wd[1]) / 2
            for rr, cnt in ((0.97, 16), (0.6, 8)):
                for a_ in np.arange(cnt) * 2 * np.pi / cnt: q_ = np.zeros(3); q_[ax_] = c_; q_[o_[0]] = rr * R_ * np.cos(a_); q_[o_[1]] = rr * R_ * np.sin(a_); pts.append(q_)
        if pts: B["smp"][n] = np.array(pts)
    B["behind"] = a.behind; B["votes"] = a.votes; B["gap"] = a.gap
    IM = {n: (gi["joint"], np.array(gi["rest_matrix"], float), np.array(AXV[next(iter(gspec[n].get("aim", {"x": "+Z"}).values()))], float)) for n, gi in fit["items"].items()}
    def item_at(tt, n):
        A_, P_ = H.solve_pose(rig, tt); jn_, M_, _ = IM[n]; j_ = rig["names"].index(jn_); return A_[j_] @ (M_[:3, 3] - rig["rest"][j_]) + P_[j_]
    def at_target(tt, at):
        A_, P_ = H.solve_pose(rig, tt); o_ = np.asarray(at.get("offset", [0, 0, 0]), float); j_ = rig["names"].index(at["joint"]); w_ = np.array([o_[1], -o_[0], o_[2]]) * a.stature
        return P_[j_] + (w_ if at.get("frame") == "root" else A_[j_] @ w_)                # the offset turns with the joint it is given from, unless "frame": "root"
    def working_to_root(w): return [round(float(-w[1]), 2), round(float(w[0]), 2), round(float(w[2]), 2)]
    def bounds(kk, arm, t0, stay):
        lo, hi = LIM[kk]["use"]
        if kk == "plane" and LIM["plane"].get("use_at_low_elev") and t0[arm].get("plane", 0) < lo: lo = LIM["plane"]["use_at_low_elev"]["range"][0]   # an arm authored straight back may stay there
        if kk in ("elbow", "elev", "plane"): lo, hi = max(lo, t0[arm].get(kk, 0) - stay), min(hi, t0[arm].get(kk, 0) + stay)
        if kk == "elbow": lo = max(lo, 15.0)
        if kk == "wrist_flex": lo, hi = max(lo, -a.wrist), min(hi, a.wrist)
        return lo, hi
    for s in sets:
        doc = json.load(open(p(*a.src.split("/")) if a.src and len(sets) == 1 else p("poses", s + ".json"))); poses = doc["poses"]
        for q in poses:
            if a.only and q["id"] not in a.only.split(","): continue
            want = {n: w for n, w in (q.get("items") or {}).items() if n in items}; t0 = q["targets"]; e0 = err(rig, t0, items, want); t = copy.deepcopy(t0); rec = {}
            A0, P0 = H.solve_pose(rig, t0); lc0 = min(H.limb_clearance(rig, A0, P0).values()); placed = {}
            if a.place:
                # items whose pose says where they are ("at": {"joint": ..., "offset": [forward, left, up] in statures}): solve
                # the whole arm from that intent, forearm items first (a sword hand may be placed relative to the shield arm)
                for n in sorted(want, key=lambda n_: 0 if items[n_][0].startswith("lowerarm") else 1):
                    at = want[n].get("at") if isinstance(want[n], dict) else None; jn = items[n][0]; arm = ARM.get(jn)
                    if not at or arm is None: continue
                    kd = [k_ for k_ in want[n] if k_ in items[n][1]]; wd_ = root_to_working(want[n][kd[0]]) if kd else None
                    t, (pe_, de_, c_) = place(rig, t, arm, "hand" if jn.startswith("hand") else "lowerarm", jn, IM[n][1], wd_, items[n][1][kd[0]] if kd else IM[n][2], at_target(t, at), LIM, wrist=a.wrist, lc0=lc0)
                    placed[n] = at; rec[n] = {"placed": {"at": at, "position_error_mm": round(pe_ * 1000, 1), "direction_error_deg": round(de_, 1)}, "changed": {kk: [t0[arm].get(kk, 0), round(t[arm].get(kk, 0), 1)] for kk in t[arm] if abs(t[arm].get(kk, 0) - t0[arm].get(kk, 0)) > 0.01}}
            if a.hold and not a.place: placed = {n: want[n]["at"] for n in want if isinstance(want[n], dict) and want[n].get("at")}   # already solved from intent: keep them where they are
            if a.fix:
                for (n, k), e_ in sorted(e0.items(), key=lambda kv: -kv[1]):
                    if e_ <= a.tol or n in placed: continue
                    jn = items[n][0]; arm = ARM.get(jn); kind = "hand" if jn.startswith("hand") else "lowerarm"
                    if arm is None: continue
                    cur = err(rig, t, items, want)[(n, k)]
                    for tier in (1, 2):
                        keys = [kk for kk, tr in ORDER[kind] if tr <= tier]
                        for step in (16, 8, 4, 2, 1):
                            moved = True
                            while moved:
                                moved = False
                                for kk in keys:
                                    lo, hi = bounds(kk, arm, t0, a.stay)
                                    for sg in (1, -1):
                                        v = float(np.clip(t[arm].get(kk, 0) + sg * step, lo, hi))
                                        if v == t[arm].get(kk, 0): continue
                                        t2 = copy.deepcopy(t); t2[arm][kk] = v; e2 = err(rig, t2, items, want)[(n, k)]
                                        if e2 < cur - 0.05:
                                            A2, P2 = H.solve_pose(rig, t2)
                                            if min(H.limb_clearance(rig, A2, P2).values()) < min(-0.004, lc0): continue      # never into a pose whose limbs pass through each other
                                            t, cur, moved = t2, e2, True
                        if cur <= a.tol: break                                      # close enough with the wrist and the upper arm's roll: leave the rest of the arm as authored
                    rec[n] = {"direction": k, "was_deg": round(e_, 1), "now_deg": round(cur, 1), "changed": {kk: [t0[arm].get(kk, 0), round(t[arm].get(kk, 0), 1)] for kk in t[arm] if abs(t[arm].get(kk, 0) - t0[arm].get(kk, 0)) > 0.01}}
            c0 = c1 = None
            if a.score and prox: print("AIM_SCORE %-28s %7.1f" % (q["id"], clash(rig, t, prox, B)[0]))
            if a.clear and prox:
                # then make room: move either arm, a little at a time, wherever that takes body out of an item or one
                # item out of another, as long as every item stays within the tolerance of its direction, no limbs cross
                # and the arm stays within `--stay-clear` degrees of the authored pose
                c0, _ = clash(rig, t, prox, B); cur = c0
                for limit in ([a.tol] + ([a.give] if a.give > a.tol else [])):
                  if cur <= a.clash_ok: break
                  for step in (12, 6, 3):
                        moved = True
                        while moved and cur > a.clash_ok:
                            moved = False
                            for arm in ("arm_r", "arm_l"):
                                for kk in ("rot", "elev", "plane", "elbow", "wrist_dev", "wrist_flex", "pron"):
                                    lo, hi = bounds(kk, arm, t0, a.stay_clear)
                                    for sg in (1, -1):
                                        v = float(np.clip(t[arm].get(kk, 0) + sg * step, lo, hi))
                                        if v == t[arm].get(kk, 0): continue
                                        t2 = copy.deepcopy(t); t2[arm][kk] = v
                                        if max(err(rig, t2, items, want).values(), default=0.0) > max(limit, max(err(rig, t, items, want).values(), default=0.0)): continue
                                        if any(np.linalg.norm(item_at(t2, n_) - at_target(t2, at_)) > max(a.pos_tol, np.linalg.norm(item_at(t, n_) - at_target(t, at_))) for n_, at_ in placed.items()): continue   # an item placed by intent stays where the pose puts it
                                        c2, l2 = clash(rig, t2, prox, B)
                                        if c2 < cur - 1e-6 and l2 >= min(-0.004, lc0): t, cur, moved = t2, c2, True
                if cur < c0: rec["clear"] = {"clash_score_was_now": [round(float(c0), 1), round(float(cur), 1)], "changed": {arm: {kk: [t0[arm].get(kk, 0), round(t[arm].get(kk, 0), 1)] for kk in t[arm] if abs(t[arm].get(kk, 0) - t0[arm].get(kk, 0)) > 0.01} for arm in ("arm_r", "arm_l")}}
                c1 = cur
                if a.give > a.tol:                                                   # where an item had to give way, the pose now says where it really points
                    dn = item_dirs(rig, t, items); en = err(rig, t, items, want)
                    for (n, k), e_ in en.items():
                        if e_ > a.tol and rec.get("clear"):
                            rec.setdefault("redirected", {})[n] = {"direction": k, "authored": list(q["items"][n][k]), "now": working_to_root(dn[n][k]), "by_deg": round(e_, 1)}; q["items"][n][k] = working_to_root(dn[n][k])
            e1 = err(rig, t, items, want); rows.append({"set": s, "id": q["id"], "before": {"%s.%s" % k: round(v, 1) for k, v in e0.items()}, "after": {"%s.%s" % k: round(v, 1) for k, v in e1.items()}, "aimed": rec, "clash_before_after": [c0, c1]})
            if rec: q["targets"] = t; q["aimed"] = rec; changed[q["id"]] = rec
            if c0 is not None and c0 > a.clash_ok: print("AIM_CLEAR %-28s clash score %6.1f -> %6.1f%s" % (q["id"], c0, c1, ("   redirected " + json.dumps({n: [r_["authored"], r_["now"], r_["by_deg"]] for n, r_ in rec["redirected"].items()})) if rec.get("redirected") else ""))
            print("AIM %-28s %s%s" % (q["id"], "  ".join("%s %5.1f" % (k_, v_) + (" -> %5.1f" % rows[-1]["after"][k_] if a.fix and abs(rows[-1]["after"][k_] - v_) > 0.05 else "") for k_, v_ in rows[-1]["before"].items()), ("   changed " + json.dumps({n: r_["changed"] for n, r_ in rec.items() if "changed" in r_})) if rec else ""))
        if a.fix and a.out and len(sets) == 1:
            doc["version"] = doc.get("version", 1) + 1; json.dump(doc, open(p(*a.out.split("/")), "w"), indent=1)
    allb = [v for r in rows for v in r["before"].values()]; alla = [v for r in rows for v in r["after"].values()]
    print("AIM_SUMMARY poses %d | before: median %.1f, over %g deg: %d of %d, worst %.1f | after: median %.1f, over: %d, worst %.1f | poses changed %d" % (len(rows), np.median(allb), a.tol, sum(v > a.tol for v in allb), len(allb), max(allb), np.median(alla), sum(v > a.tol for v in alla), max(alla), len(changed)))
    json.dump({"bound": a.bound, "sets": sets, "tolerance_deg": a.tol, "rows": rows}, open(a.report if a.report else os.path.join(WORK, "item-aim%s.json" % ("-fixed" if a.fix else "")), "w"), indent=1)
