"""Helper joints: extend a core-25 rig with procedurally driven helpers and derive their weights from the existing
weights (no painting). Rigid classes are never touched, except that a class may name a helper as its bone.
  elbow_half / knee_half : hinge bisector. w_h = 2 * min(w_upper, w_lower); both donors give half each.
  lowerarm_twist         : wrist band. Takes the forearm/hand blend, plus a ramp of forearm weight over the distal half.
  upperarm_twist         : shoulder cap. Takes a ramp of upper-arm weight over the proximal half (full at the shoulder).
  upperarm_swing         : the same ramp over the proximal 60%, onto a joint that follows the arm's direction but not its roll.
                           Under a rigid piece bound to it (a shoulder plate) it takes all the upper-arm weight, and the
                           ramp starts at the piece's lower edge.
  pauldron               : no derived weights; rigid pauldron classes bind to it by name."""
import numpy as np
import hb_lib as H


def _top4(Wd, keep=None):
    """the four largest influences of each row, renormalised (the runtime limit). Deriving a helper's weight splits a
    donor's weight in two, so a vertex with four influences can come out with five. keep: a joint never dropped."""
    Wd = np.asarray(Wd, float); rank = Wd.copy()
    if keep is not None: rank[:, keep] = np.where(Wd[:, keep] > 0, 2.0, 0.0)
    idx = np.argsort(-rank, axis=1)[:, :4]; out = np.zeros_like(Wd); np.put_along_axis(out, idx, np.take_along_axis(Wd, idx, axis=1), axis=1)
    return out / np.maximum(out.sum(1, keepdims=True), 1e-9)


def add_helpers(V, W, rig, helpers, cls=None, classes=None):
    helpers = [h for h in (helpers or []) if h]
    joints = {n: rig["rest"][i] for i, n in enumerate(rig["names"][:len(H.CORE)])}; tips = {n: rig["tip"][i] for i, n in enumerate(rig["names"][:len(H.CORE)])}
    new = H.make_rig(joints, tips, helpers, rig.get("helper_pos")); names = new["names"]; Wn = np.zeros((len(V), len(names))); Wn[:, :W.shape[1]] = W[:, :len(H.CORE)] if W.shape[1] >= len(H.CORE) else W
    soft = np.ones(len(V), bool)
    if cls is not None and classes:
        for cid, c in classes.items():
            if c.get("kind") == "rigid": soft &= cls != int(cid)
    def ix(n): return names.index(n)
    for s in ("_l", "_r"):
        for h, up, lo in (("elbow_half", "upperarm", "lowerarm"), ("knee_half", "thigh", "calf")):
            if h not in helpers: continue
            wu, wl = Wn[:, ix(up + s)].copy(), Wn[:, ix(lo + s)].copy(); wh = np.where(soft, 2 * np.minimum(wu, wl), 0.0)
            Wn[:, ix(h + s)] += wh; Wn[:, ix(up + s)] -= wh / 2; Wn[:, ix(lo + s)] -= wh / 2
        if "lowerarm_twist" in helpers:
            a, b = new["rest"][ix("lowerarm" + s)], new["rest"][ix("hand" + s)]; t = ((V - a) @ (b - a)) / float((b - a) @ (b - a))
            wl, wh_ = Wn[:, ix("lowerarm" + s)].copy(), Wn[:, ix("hand" + s)].copy()
            blend = np.where(soft, 2 * np.minimum(wl, wh_), 0.0); ramp = np.where(soft, np.clip((t - 0.5) / 0.5, 0, 1) * (wl - blend / 2), 0.0)
            Wn[:, ix("lowerarm_twist" + s)] += blend + ramp; Wn[:, ix("lowerarm" + s)] -= blend / 2 + ramp; Wn[:, ix("hand" + s)] -= blend / 2
        for hn, reach in (("upperarm_twist", 0.5), ("upperarm_swing", 0.6)):
            if hn not in helpers: continue
            a, b = new["rest"][ix("upperarm" + s)], new["rest"][ix("lowerarm" + s)]; t = ((V - a) @ (b - a)) / float((b - a) @ (b - a)); t0 = 0.0
            if cls is not None and classes:
                # a rigid piece bound to this helper (a shoulder plate) does not roll with the arm, so nothing under it
                # may roll either: the helper takes all the upper-arm weight as far down the arm as the piece reaches,
                # and the roll is spread over the sleeve below it
                for cid, c in classes.items():
                    if c.get("kind") == "rigid" and c.get("bone") == hn + s and not c.get("lining_of") and (cls == int(cid)).sum() >= 20: t0 = max(t0, float(np.percentile(t[cls == int(cid)], 98)))
                t0 = min(max(t0, 0.0), 0.6)
            end = max(reach, 1.0 if t0 > 0 else reach); new.setdefault("swing_reach", {})[hn + s] = [round(t0, 3), round(end, 3)]   # below a plate the roll is spread all the way to the elbow
            wu = Wn[:, ix("upperarm" + s)].copy(); ramp = np.where(soft, np.clip((end - t) / max(end - t0, 1e-6), 0, 1) * wu, 0.0)
            Wn[:, ix(hn + s)] += ramp; Wn[:, ix("upperarm" + s)] -= ramp
    Wn = _top4(np.clip(Wn, 0, None))
    if cls is not None and classes:                        # rigid classes bound to a helper by name
        for cid, c in classes.items():
            if c.get("kind") == "rigid" and c.get("bone") in names:
                m = cls == int(cid); Wn[m] = 0; Wn[m, ix(c["bone"])] = 1.0
    ride = rig.get("ride")
    if ride is not None and classes:                       # padding rides with its plate's joint, whichever joint that is
        rs, rc = ride
        for cid in np.unique(rc[rs > 0]):
            j = classes.get(str(int(cid)), {}).get("bone")
            if j in names:
                m = (rc == cid) & (rs > 0); Wn[m] *= (1 - rs[m])[:, None]; Wn[m, ix(j)] += rs[m]; Wn[m] = _top4(Wn[m], keep=ix(j))
        new["ride"] = ride
    return new, Wn
