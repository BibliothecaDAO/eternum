"""Pose library check: every human pose parses, stays within limits (or declares over_limit) and solves on the template rig."""
import os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H
lim = json.load(open(p("poses", "limits.json"))); tm = json.load(open(p("template", "template.json"))); rig = H.rig_from_json(tm["rig"])
G = {"pelvis": "pelvis", "spine": "spine", "head": "head", "arm_l": "arm", "arm_r": "arm", "leg_l": "leg", "leg_r": "leg"}; index = {"sets": {}, "total": 0}
for s in ("general", "knight", "crossbowman", "paladin", "mount"):
    d = json.load(open(p("poses", s + ".json"))); n = len(d["poses"]); bad = []; conf = {}; ids = set()
    for q in d["poses"]:
        conf[q.get("confidence", "?")] = conf.get(q.get("confidence", "?"), 0) + 1
        assert q["id"] not in ids, q["id"]; ids.add(q["id"])
        if d["applies_to"] == "horse": continue
        over = set(q.get("over_limit", []))
        for g, grp in G.items():
            for k, v in (q["targets"].get(g) or {}).items():
                if k in lim[grp] and isinstance(v, (int, float)):
                    lo, hi = lim[grp][k]["use"]; low = lim[grp][k].get("use_at_low_elev")
                    if low and (q["targets"][g].get("elev", 0) <= low["elev_at_most"] + 1e-6): lo, hi = low["range"]   # shoulder extension: the arm may go straight back while it is low
                    if not (lo - 1e-6 <= v <= hi + 1e-6) and f"{g}.{k}" not in over: bad.append((q["id"], g, k, v))
        try:
            A, P = H.solve_pose(rig, q["targets"]); assert np.isfinite(A).all() and np.isfinite(P).all()
            cl = H.limb_clearance(rig, A, P)                       # left and right limbs must not pass through each other
            for k_, v_ in cl.items():
                if v_ < -0.004 and f"clearance.{k_}" not in over: bad.append((q["id"], "limbs intersect", k_, round(v_ * 1000)))
        except Exception as e: bad.append((q["id"], "solve", str(e)))
    index["sets"][s] = {"file": s + ".json", "applies_to": d["applies_to"], "poses": n, "confidence": conf, "ids": sorted(ids)}; index["total"] += n
    print("POSESET", s, n, conf, "problems", bad[:6])
IDX = p("poses", "index.json")
if not (os.path.exists(IDX) and json.load(open(IDX)) == index): json.dump(index, open(IDX, "w"), indent=1)   # rewritten only when the library changed, so the committed (formatted) file stays as it is
print("POSE_TOTAL", index["total"])
