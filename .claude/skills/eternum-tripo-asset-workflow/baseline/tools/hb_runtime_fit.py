"""What a game needs beside the exported files to drive them, measured from the bind (numpy only; no Blender).

The GLB files (hb_export.py) hold the mesh, the weights and the joints at rest. They do not say how the helper joints
turn, where an item sits on its joint, where the knuckles are or how long a heel is. This writes all of that to one
file, in the game's frame (+Y up, +Z forward, +X the character's left; from the working frame by (x, y, z) -> (x, z, -y)),
so the game-side adapter is filled in from measurements and nothing is tuned by eye.

  joints    every joint in file order: parent and rest position. Every joint's rest rotation is identity (the frames
            are world-aligned), so a joint's local rotation is its turn from rest
  helpers   for each helper joint: its rule (half or twist), parent, the joint it follows, the share, and for a twist
            the axis it is taken about (the followed bone's own rest direction), with the formulas as CONTRACT.md has them
  sockets   for each item of gear-fit.json (hb_gear.py): the joint, and the item's place in that joint's frame as an
            offset, a quaternion (x, y, z, w) and a matrix. The item's own file is in the game's frame too
            (hb_export.py --item turns its axes the same way), so: p_joint = R * p_item + offset
  hands     three points on each fist's knuckle row (index, middle, little finger) in the hand joint's frame, the
            direction the palm faces, and how they were found. The right hand's row runs along the guide axis the fist
            was generated round; the left hand's is the mirror of it unless the spec says otherwise. Taken from the
            hand's own surface: of the vertices in a 5 mm wide slab across the fist, the one furthest out toward the knuckles
  driver_reference   worked cases from the baseline's pose solver: for a dozen poses, each followed joint's local rotation
            and the helper's, so the game's driver can be tested against the solver the weights were made for
  feet      per foot: sole height, how far the heel reaches behind the ankle and the toe in front of it, and the heel
            length as a share of the ankle-to-ball length (what the game's adapter asks for)
  body      stature, and the head's top

  python hb_runtime_fit.py --char <char.json> --bound <bound npz> [--gear-fit <gear-fit.json>]
                           [--helpers elbow_half,knee_half,upperarm_twist] --out <runtime-fit.json>
Paths are under human-baseline. Prints FIT lines."""
import argparse, json, math, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH
from hb_export import GAME_ORDER, C, to_game


def quat_xyzw(R):
    """unit quaternion (x, y, z, w) of a rotation matrix"""
    t = np.trace(R)
    if t > 0: s = math.sqrt(t + 1.0) * 2; q = [(R[2, 1] - R[1, 2]) / s, (R[0, 2] - R[2, 0]) / s, (R[1, 0] - R[0, 1]) / s, 0.25 * s]
    elif R[0, 0] > R[1, 1] and R[0, 0] > R[2, 2]: s = math.sqrt(1.0 + R[0, 0] - R[1, 1] - R[2, 2]) * 2; q = [0.25 * s, (R[0, 1] + R[1, 0]) / s, (R[0, 2] + R[2, 0]) / s, (R[2, 1] - R[1, 2]) / s]
    elif R[1, 1] > R[2, 2]: s = math.sqrt(1.0 + R[1, 1] - R[0, 0] - R[2, 2]) * 2; q = [(R[0, 1] + R[1, 0]) / s, 0.25 * s, (R[1, 2] + R[2, 1]) / s, (R[0, 2] - R[2, 0]) / s]
    else: s = math.sqrt(1.0 + R[2, 2] - R[0, 0] - R[1, 1]) * 2; q = [(R[0, 2] + R[2, 0]) / s, (R[1, 2] + R[2, 1]) / s, 0.25 * s, (R[1, 0] - R[0, 1]) / s]
    q = np.array(q, float); q /= np.linalg.norm(q); return (q if q[3] >= 0 else -q)


def r6(a): return [round(float(x), 6) for x in np.asarray(a, float).ravel()]


def knuckles(Hv, J, a, f, tilt_deg=35.0, slab=0.0025):
    """three points on a fist's knuckle row. Hv the hand's vertices, J the wrist joint, a the unit direction along the row toward the index finger,
    f the unit direction from the wrist to the middle of the fist (square to a). All in one frame; returns index, middle, little, the back of the hand's direction"""
    back = np.cross(a, f); back /= np.linalg.norm(back)
    if back[2] < 0: back = -back                                                # the back of a fist hanging at the side looks up and out, the palm down and in
    k = math.cos(math.radians(tilt_deg)) * f + math.sin(math.radians(tilt_deg)) * back; R = Hv - J; out_k = R @ k; s = R @ a
    band = out_k > np.percentile(out_k, 75); lo, hi = np.percentile(s[band], 3), np.percentile(s[band], 97); pts = []
    for share in (0.80, 0.55, 0.08):                                            # index, middle, little: shares of the fist's width from its little-finger side
        s0 = lo + share * (hi - lo); m = np.abs(s - s0) < slab
        if not m.any(): m = np.abs(s - s0) < 3 * slab
        i = np.nonzero(m)[0][np.argmax(out_k[m])]; pts.append(Hv[i])
    return pts[0], pts[1], pts[2], back, (lo, hi)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--bound", required=True); ap.add_argument("--gear-fit", dest="gear_fit", default=None); ap.add_argument("--helpers", default=""); ap.add_argument("--out", required=True); a = ap.parse_args()
    SPEC = json.load(open(p(*a.char.split("/")))); bp = p(*a.bound.split("/")); V, tris, W, rig0, cls, classes = HN.load_bound(bp); helpers = [h for h in a.helpers.split(",") if h]
    rig, Wh = HH.add_helpers(V, W, rig0, helpers, cls, classes); names = list(rig["names"]); par = [int(x) for x in rig["parent"]]; rest = np.array(rig["rest"], float); tip = np.array(rig["tip"], float)
    order = GAME_ORDER + [n for n in names if n not in GAME_ORDER]; nm = {int(k): c for k, c in classes.items()}; byname = {c["name"]: k for k, c in nm.items()}
    out = {"from": os.path.basename(a.bound.replace("\\", "/")),   # the name only: a path would put the maker's folders into a shipped file
           "frame": {"up": "+Y", "forward": "+Z", "left": "+X", "units": "metres", "from_working_frame": "(x, y, z) -> (x, z, -y)", "note": "every joint's rest rotation is identity: a joint's frame is the world's axes at its rest position"},
           "joints": [{"name": n, "parent": (names[par[names.index(n)]] if par[names.index(n)] >= 0 else None), "rest_position": r6(to_game(rest[names.index(n)]))} for n in order]}

    # ---- helper joints
    hl = []
    for hname, (kind, src, k) in rig["rules"].items():
        i = names.index(hname); s = names.index(src); e = {"name": hname, "rule": kind, "parent": names[par[i]], "follows": src, "share": k, "rest_position": r6(to_game(rest[i]))}
        assert par[s] == par[i], "%s: the joint it follows has another parent" % hname          # the formulas below take the followed joint's local rotation as it is
        if kind == "half":
            e["formula"] = "helper.quaternion = slerp(identity, follows.quaternion, share)"
        elif kind == "twist":
            ax = H.unit(tip[s] - rest[s]); e["twist_axis"] = r6(to_game(ax)); e["twist_axis_is"] = "the rest direction of %s (toward its child), in the parent's frame" % src
            e["formula"] = "D = follows.quaternion; twist = the part of D about twist_axis (project D's vector part on the axis, renormalise); swing = D * inverse(twist); helper.quaternion = swing * slerp(identity, twist, share)"
        else: raise SystemExit("no runtime rule written for a '%s' helper" % kind)
        hl.append(e)
    out["helpers"] = sorted(hl, key=lambda e: order.index(e["name"])); out["helpers_note"] = "Driven every frame after the controller has posed the core joints and before skinning; never keyed. Local rotations are relative to rest, which is identity here."
    # worked cases for the game's driver, from the baseline's own pose solver: in each pose, the followed joint's local rotation and the helper's
    ref = []; allp = {("rom", q["id"]): q for q in H.rom_poses()}
    for s_ in ["general"] + list(SPEC.get("pose_sets", [])):
        for q in H.load_pose_sets(p("poses"), [s_]): allp[(s_, q["id"])] = q
    want = [k for k in (("rom", "elbow-90"), ("rom", "elbow-140"), ("rom", "knee-135"), ("rom", "arm-p90-e90"), ("rom", "arm-rot80-hang"), ("rom", "squat"), ("general", "reach-up-both"), ("general", "walk-passing-l")) if k in allp] + [k for k in allp if k[0] in SPEC.get("pose_sets", [])][:3]
    for k in want:
        A_, P_ = H.solve_pose(rig, allp[k]["targets"])
        for e in out["helpers"]:
            i = names.index(e["name"]); s = names.index(e["follows"]); loc = lambda j: C @ (A_[par[j]].T @ A_[j]) @ C.T
            ref.append({"pose": "%s:%s" % k, "helper": e["name"], "follows_quaternion_xyzw": r6(quat_xyzw(loc(s))), "helper_quaternion_xyzw": r6(quat_xyzw(loc(i)))})
    out["driver_reference"] = {"note": "Local rotations (x, y, z, w) in the game's frame. A driver that is given follows_quaternion must return helper_quaternion (or its negative) to about 1e-4.", "cases": ref}

    # ---- sockets
    if a.gear_fit:
        gf = json.load(open(p(*a.gear_fit.split("/")))); out["sockets"] = {}
        for iname, it in gf["items"].items():
            S = np.array(it["socket_in_joint_frame"], float); Rg = C @ S[:3, :3] @ C.T; tg = C @ S[:3, 3]; M = np.eye(4); M[:3, :3] = Rg; M[:3, 3] = tg
            assert abs(np.linalg.det(Rg) - 1) < 1e-4 and np.abs(Rg @ Rg.T - np.eye(3)).max() < 1e-4, "socket of %s is not a rotation" % iname
            out["sockets"][iname] = {"joint": it["joint"], "offset": r6(tg), "quaternion_xyzw": r6(quat_xyzw(Rg)), "matrix_rows": [r6(r) for r in M], "fit": it.get("fit"),
                                     "item_axes_in_its_file": {k: r6(C @ np.array(v, float)) for k, v in (("was_working_+X", [1, 0, 0]), ("was_working_+Y", [0, 1, 0]), ("was_working_+Z", [0, 0, 1]))}}
        out["sockets_note"] = "p_joint = R * p_item + offset, with p_item as the item's GLB holds it. In three.js: item.position = offset, item.quaternion = quaternion_xyzw, parented to the joint."

    # ---- hands
    out["hands"] = {}; hs = SPEC.get("runtime_fit", {}).get("hands", {}); gb = None
    try: gb = json.load(open(os.path.join(p(*SPEC["work"].split("/")), "guide-bore.json")))["guide"]
    except Exception: pass
    frames = {}
    for side in ("r", "l"):
        hn = "hand_" + side; J = rest[names.index(hn)]; Hv = V[cls == byname[hn]] if hn in byname else None
        if Hv is None or not len(Hv): continue
        cfg = hs.get(hn, {}); how = None
        if cfg.get("index_toward"): ax = H.unit(cfg["index_toward"]); cen = Hv.mean(0); how = "the row's direction is given in the spec (runtime_fit.hands.%s.index_toward)" % hn
        elif gb and gb.get("hand_class") == hn:
            ax = H.unit(gb["axis"]); cen = np.array(gb["point_on_axis"], float); cen = cen + ax * float((Hv.mean(0) - cen) @ ax)
            thumb = SPEC.get("runtime_fit", {}).get("thumb_side", [0, -1, 0])                # a fist at the side has its thumb to the front
            if float(ax @ np.array(thumb, float)) < 0: ax = -ax
            how = "the row runs along the guide axis the fist was generated round (guide-bore.json), index finger toward the front"
        elif ("r" if side == "l" else "l") in frames:
            oa, of_ = frames["r" if side == "l" else "l"]; ax = oa * np.array([-1.0, 1, 1]); cen = None; f_m = of_ * np.array([-1.0, 1, 1]); how = "the other hand's directions mirrored left to right"
        else: continue
        f = (cen - J) if cen is not None else f_m; f = f - ax * float(f @ ax); f = H.unit(f); frames[side] = (ax, f)
        ix, mid, lit, back, (lo, hi) = knuckles(Hv, J, ax, f); G = lambda v: to_game(v - J)
        fwd = H.unit(G(mid)); across = H.unit(G(ix) - G(lit)) if side == "l" else H.unit(G(lit) - G(ix)); raw_n = np.cross(across, fwd); raw_n /= np.linalg.norm(raw_n); palm = -to_game(back)
        out["hands"][hn] = {"index": r6(G(ix)), "middle": r6(G(mid)), "pinky": r6(G(lit)), "palm_faces": r6(palm), "normal_sign": -1 if float(raw_n @ palm) < 0 else 1,
                            "frame": "offsets from the hand joint, in the joint's frame (the game's axes)", "fist_width_mm": round(float(hi - lo) * 1000, 1), "how": how,
                            "normal_sign_is": "the sign that makes cross(across, forward) the direction the palm faces, with forward = middle - hand and across = index - pinky on the left hand, pinky - index on the right"}

    # ---- feet
    out["feet"] = {}; top = Wh.argmax(1)
    for side in ("l", "r"):
        ja, jb, jt = (names.index(n + "_" + side) for n in ("foot", "ball", "ball_leaf")); m = np.isin(top, [ja, jb, jt]); P = to_game(V[m]); A_, B_ = to_game(rest[ja]), to_game(rest[jb]); ball_len = float(B_[2] - A_[2])
        low = P[:, 1] < P[:, 1].min() + 0.012                                                    # the sole: the lowest 12 mm of the foot
        heel = float(A_[2] - P[low][:, 2].min()); toe = float(P[low][:, 2].max() - A_[2])
        out["feet"][side] = {"ankle": "foot_" + side, "toe": "ball_" + side, "toe_tip": "ball_leaf_" + side, "sole_height": round(float(P[:, 1].min()), 5), "ankle_height": round(float(A_[1]), 5), "ball_length": round(ball_len, 5),
                             "heel_behind_ankle": round(heel, 5), "toe_in_front_of_ankle": round(toe, 5), "heel_length_ratio": round(heel / ball_len, 6), "vertices_measured": int(m.sum())}
    out["feet_note"] = "ball_length is the ball joint's z minus the ankle's; heel_length_ratio = heel_behind_ankle / ball_length. Heel and toe are the sole's ends (the lowest 12 mm of the surface bound to the foot's joints)."
    G_ = to_game(V); out["body"] = {"stature": round(float(G_[:, 1].max() - G_[:, 1].min()), 5), "top_y": round(float(G_[:, 1].max()), 5), "lowest_y": round(float(G_[:, 1].min()), 5), "joint_count": len(order), "joint_order": order}
    op = p(*a.out.split("/")); os.makedirs(os.path.dirname(op), exist_ok=True); json.dump(out, open(op, "w"), indent=1)
    print("FIT joints %d (%d helpers); sockets %s; hands %s; feet heel ratio l %.3f r %.3f; stature %.4f" % (len(order), len(hl), list(out.get("sockets", {})), {k: (v["normal_sign"], v["fist_width_mm"]) for k, v in out["hands"].items()}, out["feet"]["l"]["heel_length_ratio"], out["feet"]["r"]["heel_length_ratio"], out["body"]["stature"]))
    print("FIT_DONE", op)
