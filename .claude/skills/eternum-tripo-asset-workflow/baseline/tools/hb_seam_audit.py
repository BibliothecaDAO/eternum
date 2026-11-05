"""Seam audit (numpy only): where can a gap open when a joint moves?
Lists every border between two classes that will move differently, with its length, before anything is bound:
  rigid | rigid on different joints  nothing soft lies between them, so no surface lies under the seam. A closed seam
                                     of 20 mm or more gets a cuff from the bind (hb_split joint fill); anything else
                                     listed here needs a decision.
  rigid | soft                       the bind continues the soft surface under the rigid piece (underlay).
env HB_CHAR = char.json spec. Reads <work>/character.npz and applies the spec's label overrides. Prints the table and
writes <work>/seam-audit.json."""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
from hb_split import _seam_loop

if __name__ == "__main__":
    SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); f = os.path.join(WORK, "character.npz")
    d = np.load(f); meta = json.load(open(f[:-4] + ".json")); V, tris, fcls = d["V"].astype(float), d["tris"].astype(np.int64), d["fcls"]; classes = meta["classes"]
    for c in classes.values(): c.update(SPEC["labels"].get("overrides", {}).get(c["name"], {}))
    nm = {int(k): c["name"] for k, c in classes.items()}; kind = {int(k): c["kind"] for k, c in classes.items()}; bone = {int(k): c.get("bone") for k, c in classes.items()}; E = {}
    for fi, t in enumerate(tris):
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E.setdefault((min(int(a), int(b)), max(int(a), int(b))), []).append(fi)
    pair = {}; pv = {}
    for (a, b), fs in E.items():
        if len(fs) != 2: continue
        c0, c1 = int(fcls[fs[0]]), int(fcls[fs[1]])
        if c0 == c1: continue
        k = tuple(sorted((c0, c1))); pair[k] = pair.get(k, 0.0) + float(np.linalg.norm(V[a] - V[b])); pv.setdefault(k, set()).update((a, b))
    rr = []; rs = {}
    for (c0, c1), L in pair.items():
        k0, k1 = kind.get(c0), kind.get(c1)
        if k0 == "rigid" and k1 == "rigid":
            if bone[c0] != bone[c1]:
                P = V[sorted(pv[(c0, c1)])]; lab = np.where(fcls == c0, "a", np.where(fcls == c1, "b", "x")); loop = _seam_loop(tris, lab, "a", "b")
                rr.append({"between": [nm[c0], nm[c1]], "joints": [bone[c0], bone[c1]], "length_mm": round(L * 1000, 1), "across_mm": round(float(np.ptp(P, axis=0).max()) * 1000, 1), "closed_loop": loop is not None,
                           "filled_by_bind": bool(loop is not None and len(loop) >= 12 and np.ptp(P, axis=0).max() >= 0.02)})
        elif "rigid" in (k0, k1):
            r, s = (c0, c1) if k0 == "rigid" else (c1, c0); rs.setdefault(nm[r], {})[nm[s]] = round(L * 1000, 1)
    rr.sort(key=lambda r: -r["length_mm"]); json.dump({"rigid_rigid": rr, "rigid_soft": rs}, open(os.path.join(WORK, "seam-audit.json"), "w"), indent=1)
    print("SEAM_AUDIT rigid | rigid on different joints: %d" % len(rr))
    for r in rr: print("  %7.1f mm  %-14s (%s) | %-14s (%s)  across %.0f mm  %s" % (r["length_mm"], r["between"][0], r["joints"][0], r["between"][1], r["joints"][1], r["across_mm"], "closed loop: cuff built by the bind" if r["filled_by_bind"] else "not a closed loop of 20 mm or more: no fill, decide"))
    print("SEAM_AUDIT rigid | soft (underlay):")
    for r in sorted(rs): print("  %-14s %s" % (r, ", ".join("%s %.0f" % (s, L) for s, L in sorted(rs[r].items(), key=lambda kv: -kv[1])[:7])))
