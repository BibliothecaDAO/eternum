"""Where the items are in each pose, in terms a description can be checked against (numpy only).

A reviewer judges a pose against its own text: "hilt near the right hip", "shield's top rim at eye level", "blade
level". This prints what the pose really has, per pose and item, on the fitted sockets:
  a gripped item   the hand's height against the body's landmarks (knee, thigh, hip, waist, bottom of the ribs, chest,
                   shoulder, chin to eye, above the eyes, above the helmet), how far it is in front of and to the side
                   of the chest, the item's angle above level, where its tip is
  a forearm item   its top and bottom rim heights against the same landmarks and against eye level, and how far its
                   face tilts up
  both             the nearest the gripped item's axis comes to the forearm item's disc
Heights are statures above the ground the pose stands on. Landmarks are the posed joints, so in a deep lunge or a
forward lean the bands sit close together: read the numbers beside the words.

  python hb_pose_facts.py --char <char.json under human-baseline> --bound <bound npz under human-baseline>
                          [--sets knight] [--helpers elbow_half,knee_half,upperarm_twist] [--src <poses file>]
                          [--out <json>] [--stature 0.6]
Reads <work>/gear-fit.json (hb_gear.py) and the gear spec it names. Prints POSE_FACTS lines."""
import argparse, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH

AXV = {"+X": (1, 0, 0), "-X": (-1, 0, 0), "+Y": (0, 1, 0), "-Y": (0, -1, 0), "+Z": (0, 0, 1), "-Z": (0, 0, -1)}


def band(z, marks):
    lab = marks[0][0]
    for n, h in marks:
        if z >= h: lab = n
    return lab


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--bound", required=True); ap.add_argument("--sets", default=None); ap.add_argument("--helpers", default=""); ap.add_argument("--src", default=None); ap.add_argument("--out", default=None); ap.add_argument("--stature", type=float, default=0.6); a = ap.parse_args()
    SPEC = json.load(open(p(*a.char.split("/")))); WORK = p(*SPEC["work"].split("/")); fit = json.load(open(os.path.join(WORK, "gear-fit.json"))); gspec = {i["name"]: i for i in json.load(open(p(*fit["gear"].split("/"))))["items"]}; S = a.stature
    V, tris, W, rig, cls, classes = HN.load_bound(p(*a.bound.split("/"))); rig, Wh = HH.add_helpers(V, W, rig, [h for h in a.helpers.split(",") if h], cls, classes); names = rig["names"]; ix = names.index; idx, val = H.dense_to_top4(Wh)
    sets = (a.sets or ",".join(SPEC.get("pose_sets", []))).split(","); out = {}; side = lambda s_: "_r" if "upperarm_r" in names else ""
    for s in sets:
        d = json.load(open(p(*a.src.split("/")) if a.src and len(sets) == 1 else p("poses", s + ".json")))
        for q in d["poses"]:
            A, P = H.solve_pose(rig, q["targets"]); Vp = H.skin(V, idx, val, rig, A, P); g = min(0.0, float(Vp[:, 2].min())); z = lambda n: float(P[ix(n)][2] - g) / S; eye = z("Head")
            marks = [("below the knee", 0.0), ("knee", min(z("calf_r"), z("calf_l")) - 0.03), ("thigh", max(z("calf_r"), z("calf_l")) + 0.04), ("hip", z("pelvis") - 0.04), ("waist", z("spine_01")), ("bottom of the ribs", z("spine_03") + 0.01), ("chest", z("spine_03") + 0.07),
                     ("shoulder", min(z("upperarm_r"), z("upperarm_l")) - 0.03), ("chin to eye", eye - 0.07), ("above the eyes", eye + 0.03), ("above the helmet", eye + 0.12)]
            sp = P[ix("spine_03")]; fwd = A[ix("spine_03")] @ np.array([0, -1.0, 0]); lft = A[ix("spine_03")] @ np.array([1.0, 0, 0]); r = {"eye_height": round(eye, 3)}; grips = {}; plates = {}; line = []
            for n, gi in fit["items"].items():
                j = ix(gi["joint"]); M = np.array(gi["rest_matrix"], float); o = A[j] @ (M[:3, 3] - rig["rest"][j]) + P[j]; ax = np.array(AXV[next(iter(gspec[n].get("aim", {"x": "+Z"}).values()))], float); dn = A[j] @ (M[:3, :3] @ ax)
                if gi["fit"] == "grip":
                    L = max(sl[1] for sl in gi["proxy"]["slices"]); tip = o + dn * L; rt = "right" if gi["joint"].endswith("_r") else "left"; sgn = -1.0 if rt == "right" else 1.0
                    r[n] = {"hand_height": round((o[2] - g) / S, 3), "hand_at": band((o[2] - g) / S, marks), "hand_in_front_of_chest": round(float((o - sp) @ fwd) / S, 2), "hand_to_the_%s_of_chest" % rt: round(float(sgn * ((o - sp) @ lft)) / S, 2),
                            "deg_above_level": round(float(np.degrees(np.arcsin(np.clip(dn[2], -1, 1)))), 0), "points_forward_left_up": [round(float(-dn[1]), 2), round(float(dn[0]), 2), round(float(dn[2]), 2)], "tip_height": round((tip[2] - g) / S, 3), "tip_at": band((tip[2] - g) / S, marks)}
                    grips[n] = (o, dn, L); line.append("%s hand %-18s %.2f (front %.2f, %s %.2f) %+3.0f deg, tip %s" % (n, r[n]["hand_at"], r[n]["hand_height"], r[n]["hand_in_front_of_chest"], rt, r[n]["hand_to_the_%s_of_chest" % rt], r[n]["deg_above_level"], r[n]["tip_at"]))
                elif gi["fit"] == "forearm":
                    R_ = float(gspec[n].get("radius", 0.0)); rz = R_ * float(np.sqrt(max(0.0, 1 - dn[2] ** 2))); top, bot = (o[2] + rz - g) / S, (o[2] - rz - g) / S
                    r[n] = {"centre_height": round((o[2] - g) / S, 3), "top_rim": round(top, 3), "top_rim_at": band(top, marks), "top_rim_above_eye": round(top - eye, 3), "bottom_rim": round(bot, 3), "bottom_rim_at": band(bot, marks), "face_deg_above_level": round(float(np.degrees(np.arcsin(np.clip(dn[2], -1, 1)))), 0), "faces_forward_left_up": [round(float(-dn[1]), 2), round(float(dn[0]), 2), round(float(dn[2]), 2)]}
                    plates[n] = (o, dn, R_); line.append("%s top %-15s (%+.2f of eye) bottom %-14s face %+3.0f deg" % (n, r[n]["top_rim_at"], r[n]["top_rim_above_eye"], r[n]["bottom_rim_at"], r[n]["face_deg_above_level"]))
            for gn, (o, dn, L) in grips.items():
                for pn, (ho, face, R_) in plates.items():
                    best = 9.0
                    for t in np.linspace(0.03, L, 28):
                        v = o + dn * t - ho; h_ = float(v @ face); rad = float(np.linalg.norm(v - face * h_)); best = min(best, abs(h_) if rad <= R_ else float(np.hypot(rad - R_, h_)))
                    r["%s_axis_to_%s_mm" % (gn, pn)] = round(best * 1000, 0); line.append("%s-%s %3.0f mm" % (gn, pn, best * 1000))
            out[q["id"]] = r; print("POSE_FACTS %-27s %s" % (q["id"], " | ".join(line)))
    if a.out: json.dump(out, open(p(*a.out.split("/")), "w"), indent=1)
