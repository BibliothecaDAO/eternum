"""View-packet check, run BEFORE any paid generation (env HB_CHAR = char.json spec).
Measures, on the front and back views with the packet's landmarks, whether surfaces that must move apart are drawn
with clear air between them. Tripo welds surfaces that are drawn touching, and a weld cannot be repaired afterwards
without inventing the surfaces it hides. Writes <work>/packet-check.json and prints PASS/FAIL per rule.

Rules (H = stature in pixels, floor to head top):
  arm angle            upper arm 45-60 degrees from vertical
  arm gap opens        background appears between arm and torso within the first 40% of the shoulder-to-elbow drop
  arm gap mid          at least 1.0% H wide at half the shoulder-to-elbow drop
  arm gap elbow        at least 2.5% H wide at the elbow row
  thigh gap            opens within 3% H below the crotch landmark and is at least 1.0% H wide 5% H lower
  fist to hip          at least 3% H
  symmetry             left and right arm measures within 15% of each other"""
import os, sys, json, math
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
# Two ways to run: (1) headless Blender with env HB_CHAR=<char.json>; (2) any Python that has numpy and Pillow (or
# Blender): hb_packet_check.py --packet <dir> --front views/front.png --back views/back.png --manifest packet-manifest.json
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else sys.argv[1:]
if "--packet" in argv:
    import argparse
    ap = argparse.ArgumentParser(); ap.add_argument("--packet"); ap.add_argument("--front"); ap.add_argument("--back", default=None); ap.add_argument("--manifest"); a_ = ap.parse_args(argv)
    PK = os.path.abspath(a_.packet); SPEC = {"views": {"front": a_.front, **({"back": a_.back} if a_.back else {})}, "manifest": a_.manifest}; WORK = os.path.join(PK, "evidence")
else:
    SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); PK = os.path.normpath(p(*SPEC["packet"].split("/")))
os.makedirs(WORK, exist_ok=True)
def img(path):
    try:
        from PIL import Image
        return np.asarray(Image.open(path).convert("RGBA"), dtype=np.float32) / 255.0
    except ImportError:
        import bpy
        im = bpy.data.images.load(path, check_existing=False); w, h = im.size; a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]; bpy.data.images.remove(im); return a
man = json.load(open(os.path.join(PK, SPEC["manifest"]))); fv = man["views"]["front"]; LM = fv["locked_anatomical_landmarks"]; Hpx = fv["anatomical_floor_reference_y"] - LM["anatomical_head_top"][1]
def fist_gap_profile(fg, cx, wr, hd, outward):
    """Measure inward clearance of the foreground branch attached to the wrist.

    Seed the row component nearest the wrist-to-hand line, then follow all
    8-connected row branches belonging to it. Disconnected rows after the hand
    ends are absent, not zero-width gaps. A branch touching the torso has zero
    clearance. No height or clearance threshold is introduced here.
    """
    height, width = fg.shape
    def runs(y):
        xs = np.flatnonzero(fg[y])
        if not len(xs): return []
        cuts = np.flatnonzero(np.diff(xs) > 1) + 1
        return [(int(a[0]), int(a[-1])) for a in np.split(xs, cuts)]
    def distance(run, x):
        return max(run[0] - x, x - run[1], 0)
    def inward_edge(run):
        return run[1] if outward < 0 else run[0]
    profile, previous = {}, None
    first, last = max(0, int(wr[1])), min(height, int(hd[1]) + 10)
    for y in range(first, last):
        row = runs(y)
        t = min(1.0, max(0.0, (y - wr[1]) / (hd[1] - wr[1]))) if hd[1] != wr[1] else 0.0
        expected = wr[0] + t * (hd[0] - wr[0])
        if previous is None:
            candidates = [a for a in row if (inward_edge(a) - cx) * outward > 0 or a[0] <= expected <= a[1]]
            if not candidates: return profile
            previous = [min(candidates, key=lambda a: distance(a, expected))]
        else:
            previous = [a for a in row if any(a[0] <= b[1] + 1 and a[1] >= b[0] - 1 for b in previous)]
            if not previous: break
        # Preserve finger branches connected to the same wrist component;
        # the innermost visible branch determines the actual minimum gap.
        edge = max(inward_edge(a) for a in previous) if outward < 0 else min(inward_edge(a) for a in previous)
        if (edge - cx) * outward <= 0:
            profile[y] = 0
            continue
        torso_candidates = [a for a in row if a[0] <= cx] if outward < 0 else [a for a in row if a[1] >= cx]
        if not torso_candidates:
            # Missing torso foreground is not evidence of torso clearance.
            profile[y] = 0
            continue
        # A white highlight at cx can split the torso row. Use the component
        # nearest cx on the measured side instead of requiring a filled cx.
        torso = min(torso_candidates, key=lambda a: distance(a, cx))
        torso_edge = torso[0] if outward < 0 else torso[1]
        lo, hi = sorted((edge, torso_edge))
        x = (lo + hi) // 2
        # The central continuous white interval is bounded by every foreground
        # pixel, including detached boundary islands on either silhouette.
        # Never sum separate white intervals or walk from one texture island
        # to another instead of measuring the air between hand and torso.
        if hi - lo <= 1 or fg[y, x]:
            profile[y] = 0
            continue
        left, right = x, x
        while left > lo and not fg[y, left - 1]: left -= 1
        while right < hi and not fg[y, right + 1]: right += 1
        profile[y] = right - left + 1
    return profile

def check(view, mirror):
    fg = img(os.path.join(PK, SPEC["views"][view]))[..., :3].min(-1) < 0.94
    if mirror: fg = fg[:, ::-1]                              # the back view is the front view's landmarks mirrored
    cx = int(round(LM["pelvis"][0])); W_ = fg.shape[1]; r = {}
    if mirror: cx = W_ - 1 - cx
    def X(x): return (W_ - 1 - x) if mirror else x
    for side, sgn in (("right", -1), ("left", 1)):
        sh, el, wr, hd = (np.array(LM[side + "_" + n]) for n in ("shoulder", "elbow", "wrist", "hand")); sh[0], el[0], wr[0], hd[0] = X(sh[0]), X(el[0]), X(wr[0]), X(hd[0]); s2 = sgn * (-1 if mirror else 1); prof = {}
        for y in range(int(sh[1]) + 8, int(hd[1]) + 12):
            t = (y - sh[1]) / (wr[1] - sh[1]); x = int(round(sh[0] + t * (wr[0] - sh[0]))); step = -s2
            while 0 < x < W_ - 1 and fg[y, x]: x += step
            g = 0
            while 0 < x < W_ - 1 and not fg[y, x] and (x - cx) * s2 > 0: x += step; g += 1
            prof[y] = g if (x - cx) * s2 > 0 else 0
        drop = el[1] - sh[1]; opens = next((y for y in sorted(prof) if all(prof.get(y + d, 0) >= 3 for d in range(8))), None)
        fist = list(fist_gap_profile(fg, cx, wr, hd, s2).values())
        r[side] = {"upper_arm_angle_deg": round(math.degrees(math.atan2(abs(el[0] - sh[0]), el[1] - sh[1])), 1), "elbow_bend_deg": round(abs(math.degrees(math.atan2(abs(el[0] - sh[0]), el[1] - sh[1])) - math.degrees(math.atan2(abs(wr[0] - el[0]), wr[1] - el[1]))), 1),
                   "gap_opens_at_share_of_drop": round((opens - sh[1]) / drop, 2) if opens else None, "gap_mid_pctH": round(100 * prof.get(int(sh[1] + 0.5 * drop), 0) / Hpx, 2), "gap_elbow_pctH": round(100 * prof.get(int(el[1]), 0) / Hpx, 2), "fist_hip_pctH": round(100 * min(fist) / Hpx, 2) if fist else 0.0}
    prof = {}
    for y in range(int(LM["pelvis"][1]) - 10, int(fv["anatomical_floor_reference_y"]) - 40):
        w = 0
        if not fg[y, cx]:
            l = cx; q = cx
            while l > 0 and not fg[y, l]: l -= 1
            while q < W_ - 1 and not fg[y, q]: q += 1
            w = q - l - 1
        prof[y] = w
    opens = next((y for y in sorted(prof) if all(prof.get(y + d, 0) >= 3 for d in range(8))), None)
    r["thighs"] = {"gap_opens_pctH_below_crotch": round(100 * (opens - LM["pelvis"][1]) / Hpx, 2) if opens else None, "gap_pctH_5pctH_lower": round(100 * prof.get(int((opens or LM["pelvis"][1]) + 0.05 * Hpx), 0) / Hpx, 2)}
    return r
rep = {"H_px": Hpx, "front": check("front", False)}
if "back" in SPEC["views"]: rep["back"] = check("back", True)
def rules(v):
    out = {}
    for s in ("right", "left"):
        a = v[s]; out[s + " arm angle 45-60"] = 45 <= a["upper_arm_angle_deg"] <= 60
        out[s + " arm gap opens <= 0.40 of drop"] = a["gap_opens_at_share_of_drop"] is not None and a["gap_opens_at_share_of_drop"] <= 0.40
        out[s + " arm gap mid >= 1.0% H"] = a["gap_mid_pctH"] >= 1.0; out[s + " arm gap elbow >= 2.5% H"] = a["gap_elbow_pctH"] >= 2.5; out[s + " fist to hip >= 3% H"] = a["fist_hip_pctH"] >= 3.0
    t = v["thighs"]; out["thigh gap opens <= 3% H below crotch"] = t["gap_opens_pctH_below_crotch"] is not None and t["gap_opens_pctH_below_crotch"] <= 3.0; out["thigh gap >= 1.0% H"] = t["gap_pctH_5pctH_lower"] >= 1.0
    l, r_ = v["left"], v["right"]; out["arms symmetric (gap opening within 0.15 of drop)"] = None not in (l["gap_opens_at_share_of_drop"], r_["gap_opens_at_share_of_drop"]) and abs(l["gap_opens_at_share_of_drop"] - r_["gap_opens_at_share_of_drop"]) <= 0.15
    return out
rep["rules"] = {k: {n: bool(ok) for n, ok in rules(v).items()} for k, v in rep.items() if k in ("front", "back")}; rep["pass"] = all(all(x.values()) for x in rep["rules"].values())
json.dump(rep, open(os.path.join(WORK, "packet-check.json"), "w"), indent=1)
for view in ("front", "back"):
    if view in rep["rules"]:
        print("PACKET", view, json.dumps(rep[view]))
        for k, ok in rep["rules"][view].items(): print("PACKET  %-5s %s" % ("PASS" if ok else "FAIL", k))
print("PACKET RESULT", "PASS" if rep["pass"] else "FAIL")
