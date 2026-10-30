"""Hold a reduced level of detail to the limits (numpy only).

  python hb_lod_check.py --char <char.json> --reduced <reduced or baked npz under human-baseline> [--bound <the bind it came from>]
                         [--helpers elbow_half,knee_half,upperarm_twist]

Runs the deformation harness on the range-of-motion set and on the pose library (general + the troop's sets) and
compares with harness/thresholds.json: rigidity, influences and thickness kept at the joints against the bind's own
limits; stretch against `reduced` (the measure weighted by rest length), and collapse (weighted by rest area) against the
bind's own figure when --bound is given: so far below it and no further (`reduced.area_w_p01`; why is in its note).
The count-based figures are reported beside them, and the bind's own figures when --bound is given.
Writes <reduced>.lod-check.json. Prints LOD lines and LOD_CHECK PASS or FAIL."""
import argparse, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH

if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--reduced", required=True); ap.add_argument("--bound", default=None); ap.add_argument("--helpers", default=""); a = ap.parse_args()
    SPEC = json.load(open(p(*a.char.split("/")))); T = json.load(open(p("harness", "thresholds.json"))); R = T["range_of_motion"]; L = T["pose_library"]; D = T["reduced"]; ex = set(R["stretch_p995"]["exempt_poses"]); helpers = [h for h in a.helpers.split(",") if h]
    sets = ["general"] + list(SPEC.get("pose_sets", [])); poses_rom = [dict(q, set="rom") for q in H.rom_poses()]; poses_lib = H.load_pose_sets(p("poses"), sets)
    def run(path):
        V, tris, W, rig, cls, classes = HN.load_bound(path); rig, Wh = HH.add_helpers(V, W, rig, helpers, cls, classes); st = HN.static_checks(V, Wh, rig, cls, classes); out = {"triangles": int(len(tris)), "vertices": int(len(V)), "static": st}
        for key, poses in (("range_of_motion", poses_rom), ("pose_library", poses_lib)):
            rows, _ = HN.evaluate(V, tris, Wh, rig, poses, cls, classes); ne = [r for r in rows if r["id"] not in ex] if key == "range_of_motion" else rows; xe = [r for r in rows if r["id"] in ex] if key == "range_of_motion" else []
            w = lambda k, fn, rr: (lambda v: [round(v[0], 3), v[1]])(fn((r[k], r["id"]) for r in rr)) if rr else None
            hinge = {z: round(min(r["hinge"][zz].get("outer_p05", 9.0) for r in rows for zz in r["hinge"] if zz.startswith(z)), 3) for z in ("elbow", "knee", "ankle", "wrist")}
            out[key] = {"poses": len(rows), "stretch_len_p995": w("stretch_len_p995", max, ne), "stretch_len_p995_exempt": w("stretch_len_p995", max, xe), "area_w_p01": w("area_w_p01", min, rows), "stretch_p995_by_count": w("stretch_p995", max, ne), "stretch_p995_by_count_exempt": w("stretch_p995", max, xe),
                        "area_p01_by_count": w("area_p01", min, rows), "rigid_max_dev": round(max(r.get("rigid_max_dev", 0.0) for r in rows), 5), "thickness_kept": hinge}
        return out
    rp = p(*a.reduced.split("/")); res = run(rp); C = {}; bind = run(p(*a.bound.split("/"))) if a.bound else None
    AW = D["area_w_p01"]; tier = AW["mid" if res["triangles"] <= T["reduced_see"]["mid_at_most_triangles"] else "near"]
    def collapse_limit(key):
        """the least a level's first percentile by area may be: so far below its own bind's by the same measure, never under the floor; an absolute figure when no bind is given"""
        if bind is None: return AW["min_without_bind"], "%s (no bind given)" % AW["min_without_bind"]
        b = bind[key]["area_w_p01"][0]; lim = round(max(AW["floor"], b - tier["max_drop_below_bind"]), 3)
        return lim, "%s (the bind's %s less %s; never under %s)" % (lim, b, tier["max_drop_below_bind"], AW["floor"])
    def chk(name, value, ok, limit): C[name] = {"value": value, "limit": limit, "result": "PASS" if ok else "FAIL"}
    def rep(name, value, note=""): C[name] = {"value": value, "result": "reported", "note": note}
    st = res["static"]; chk("influences", st["max_influences"], st["max_influences"] <= 4 and st["unweighted"] == 0 and not st["rigid_not_single_bone"], "at most 4, none unweighted, rigid pieces on one joint")
    for key, lab, lim_s, lim_x in (("range_of_motion", "range of motion", D["stretch_len_p995"]["range_of_motion_max"], D["stretch_len_p995"]["range_of_motion_exempt_max"]), ("pose_library", "pose library", D["stretch_len_p995"]["pose_library_max"], None)):
        r = res[key]; chk("plate distortion, " + lab, r["rigid_max_dev"], r["rigid_max_dev"] <= R["rigid_max_dev"]["max"], R["rigid_max_dev"]["max"])
        for z in ("elbow", "knee", "ankle", "wrist"): chk("%s thickness kept (%s)" % (z, lab), r["thickness_kept"][z], r["thickness_kept"][z] >= R[z + ".outer_p05"]["min"], R[z + ".outer_p05"]["min"])
        chk("stretch by length, " + lab, r["stretch_len_p995"], r["stretch_len_p995"][0] <= lim_s and (r["stretch_len_p995_exempt"] is None or r["stretch_len_p995_exempt"][0] <= lim_x), "%s%s" % (lim_s, (" (%s overhead)" % lim_x) if lim_x else ""))
        lim_a, lim_t = collapse_limit(key); chk("collapse by area, " + lab, r["area_w_p01"], r["area_w_p01"][0] >= lim_a, lim_t)
        rep("stretch by count, " + lab, r["stretch_p995_by_count"], "the bind's limit is %s; not a limit for a reduced mesh" % (R if key == "range_of_motion" else L)["stretch_p995"]["max"]); rep("collapse by count, " + lab, r["area_p01_by_count"], "the bind's limit is %s; not a limit for a reduced mesh" % R["area_p01"]["min"])
    out = {"reduced": a.reduced, "triangles": res["triangles"], "vertices": res["vertices"], "helpers": helpers, "checks": C, "measured": res}
    if bind is not None: out["bind"] = bind; out["bind_file"] = a.bound
    fails = [k for k, v in C.items() if v["result"] == "FAIL"]; out["result"] = "FAIL" if fails else "PASS"; out["failed"] = fails; json.dump(out, open(rp[:-4] + ".lod-check.json", "w"), indent=1)
    for k, v in C.items(): print("LOD %-8s %-44s %s%s" % (v["result"], k, v["value"], ("   limit " + str(v["limit"])) if "limit" in v else ""))
    print("LOD_CHECK", out["result"], "(%d failed) %s: %d triangles" % (len(fails), a.reduced, res["triangles"]))
