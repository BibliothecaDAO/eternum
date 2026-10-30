"""Bind-gate battery for one character: build (optional), every report, every review render, one summary.

Run with the Python that ships with Blender (it has numpy); this script starts Blender itself where a step needs it.
From WSL:
  <Blender's bundled Python> hb_gate.py --char <char.json> --tag r35 --out <review folder> --build
(see "Running from the repository" in ../README.md for the Python and the environment variables)

  --char    char.json spec, absolute or relative to the baseline folder. Read from it: work folder, helpers, pose_sets, review_poses,
            gear (optional: a gear spec, see hb_gear.py; adds the equipment fit, clash and direction checks and sheets).
  --tag     the bind is <work>/bound-<tag>.npz
  --out     review folder, absolute or relative to the baseline folder
  --build   first run: label refine, border cut, bind (from <work>/character-bored.*, the mesh as imported and bored, or
            from the stem the spec names in "build_from" where an approved mesh edit made a later source)
  --before  a folder from an earlier run of this script: adds before/after sheets for every joint
  --only    comma list of steps: build, reports, joints, labels, sheets, gear, beforeafter, summary (default: all;
            the before/after sheets are made with the joints, or alone with "beforeafter")

What it produces under --out:
  joints/SHEET-<joint>.png        every joint, framed on the joint: rest, its range-of-motion limits, the troop's review poses
  labels/SHEET-<joint>.png        the same joints in label colours (rest and two poses): where pieces really divide
  SHEET-<set>.png                 the general and troop pose sets, whole figure
  rest-check/                     rest-pose identity check (hb_rest_check.py)
  gear/SHEET-fit-<item>.png       with "gear" in the spec: each item on its joint at rest, six sides, close
  gear/SHEET-rest-figure.png      the whole figure at rest with its items
  gear/SHEET-<set>-gear-<view>.png  the troop's own pose sets with the items on: front-right, back-right and back-left
  before-after/SHEET-<joint>.png  with --before: rows alternate before, after
  gate-summary.json               every check against harness/thresholds.json, PASS / FAIL / reported
Reports next to the bind: <bound>.rom.harness.json, .library.harness.json, .contact-plates.json, .gap-check.json,
.gear-clash.json; <work>/seam-audit.json, <work>/gear-fit.json (the sockets), <work>/item-aim.json.

Rendering uses EEVEE when Blender can get a graphics context and falls back to CPU path tracing (HB_ENGINE=CYCLES)
when it cannot (screen locked or asleep). Before and after must come from the same engine to be comparable; the
summary records which was used."""
import argparse, json, os, subprocess, sys, statistics, time

TOOLS = os.path.dirname(os.path.abspath(__file__)); HB = os.path.dirname(TOOLS)
def _blender():
    """HB_BLENDER, else the Blender executable beside the Python that runs this script (<blender>/<version>/python/bin/python*)."""
    if os.environ.get("HB_BLENDER"): return os.environ["HB_BLENDER"]
    root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(sys.executable))))
    for n in ("blender.exe", "blender"):
        if os.path.exists(os.path.join(root, n)): return os.path.join(root, n)
    sys.exit("hb_gate: Blender not found beside this Python; set HB_BLENDER to the Blender executable")
BLENDER = _blender()
BODY_PARTS = ("head", "hand", "foot")

# joint sheet: (name, joint to frame, half-side of the frame in metres at stature 0.6, views, range-of-motion poses, takes the troop's review poses)
JOINTS = [
    ("neck", "Head", 0.105, "rt-back,rt-front,rt-left,rt-three-quarter", "rest:rest,rom:head-yaw75,rom:head-pitch45,rom:head-pitch-45,rom:head-roll30,general:look-over-shoulder", False),
    ("shoulder_r", "upperarm_r", 0.10, "rt-back,rt-front,rt-three-quarter", "rest:rest,general:idle-neutral,rom:arm-p0-e90,rom:arm-p90-e90,general:reach-up-both,rom:arm-cross-r", True),
    ("shoulder_l", "upperarm_l", 0.10, "rt-back,rt-front,rt-three-quarter", "rest:rest,general:idle-neutral,rom:arm-p0-e90,rom:arm-p90-e90,general:reach-up-both,rom:arm-cross-l", True),
    ("elbow_r", "lowerarm_r", 0.075, "rt-front,rt-back,rt-right,rt-three-quarter", "rest:rest,rom:elbow-90,rom:elbow-140", False),
    ("wrist_r", "hand_r", 0.055, "rt-front,rt-back,rt-right,top", "rest:rest,rom:wrist-flex30,rom:wrist-flex-30,rom:wrist-dev20,rom:pron80", True),
    ("wrist_l", "hand_l", 0.055, "rt-front,rt-back,rt-left,top", "rest:rest,rom:wrist-flex30,rom:wrist-flex-30,rom:pron-80", True),
    ("waist", "spine_01", 0.13, "rt-front,rt-back,rt-left,rt-three-quarter", "rest:rest,rom:spine-flex60,rom:spine-flex-25,rom:spine-twist45,rom:spine-side30", False),
    ("hip_r", "thigh_r", 0.12, "rt-front,rt-back,rt-right,rt-three-quarter", "rest:rest,rom:hip-flex90,rom:hip-abd45,rom:squat,rom:kneel", False),
    ("knee_r", "calf_r", 0.095, "rt-front,rt-back,rt-right,rt-three-quarter", "rest:rest,rom:knee-90,rom:knee-135,rom:squat", False),
    ("ankle_r", "foot_r", 0.085, "rt-front,rt-back,rt-right,rt-three-quarter", "rest:rest,rom:ankle20,rom:ankle-40,rom:squat", False),
]


def rel(path): return os.path.join(HB, *path.replace("\\", "/").split("/"))


def blender(script, env, log, expr=None):
    e = dict(os.environ); e.update({k: str(v) for k, v in env.items()})
    if expr and len(expr) > 2000:                                                 # Windows refuses a command line over about 32,000 characters: run a long expression from a file
        script = log[:-4] + ".py"; open(script, "w").write(expr); expr = None
    cmd = [BLENDER, "-b", "--factory-startup"] + (["--python-expr", expr] if expr else ["--python", os.path.join(TOOLS, script)])
    with open(log, "w") as f: r = subprocess.run(cmd, env=e, stdout=f, stderr=subprocess.STDOUT)
    return r.returncode


def python(script, args, env, log):
    e = dict(os.environ); e.update({k: str(v) for k, v in env.items()})
    with open(log, "w") as f: return subprocess.run([sys.executable, os.path.join(TOOLS, script)] + list(args), env=e, stdout=f, stderr=subprocess.STDOUT).returncode


def grep(log, *keys):
    return [l.rstrip() for l in open(log, errors="replace") if any(k in l for k in keys)] if os.path.exists(log) else []


def engine(out):
    """EEVEE if Blender can render with it here and now, else CYCLES"""
    if os.environ.get("HB_ENGINE"): return os.environ["HB_ENGINE"].upper()
    probe = os.path.join(out, "engine-probe.png")                              # as it is: Blender reads a path that starts with two forward slashes as relative
    expr = "import bpy; s=bpy.context.scene; s.render.resolution_x=s.render.resolution_y=16; s.render.filepath=r'%s'\ntry: s.render.engine='BLENDER_EEVEE'\nexcept TypeError: s.render.engine='BLENDER_EEVEE_NEXT'\nbpy.ops.render.render(write_still=True)" % probe
    if os.path.exists(probe): os.remove(probe)
    blender(None, {}, os.path.join(out, "engine-probe.log"), expr=expr)
    return "EEVEE" if os.path.exists(probe) else "CYCLES"


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--tag", required=True); ap.add_argument("--out", required=True)
    ap.add_argument("--build", action="store_true"); ap.add_argument("--before", default=None); ap.add_argument("--only", default="build,reports,joints,labels,sheets,gear,summary"); a = ap.parse_args()
    spec = json.load(open(rel(a.char))); work = rel(spec["work"]); out = rel(a.out); os.makedirs(out, exist_ok=True); logs = os.path.join(out, "logs"); os.makedirs(logs, exist_ok=True)
    helpers = ",".join(spec.get("helpers", ["elbow_half", "knee_half"])); troop = list(spec.get("pose_sets", [])); sets = ["general"] + troop; review = list(spec.get("review_poses", []))
    gear = spec.get("gear"); gearfit = spec["work"].rstrip("/") + "/gear-fit.json"
    bound_rel = spec["work"].rstrip("/") + "/bound-%s.npz" % a.tag; bound = rel(bound_rel); steps = set(a.only.split(",")); t0 = time.time(); summ = {"character": spec.get("name"), "bound": bound_rel, "helpers": helpers.split(","), "checks": {}}
    def say(*x): print(*x, flush=True)

    if a.build and "build" in steps:
        import shutil
        for ext in ("npz", "json"):
            src = os.path.join(work, spec.get("build_from", "character-bored") + "." + ext)   # "build_from": the source mesh's file stem, where an approved mesh edit has made a later one than the mesh as imported and bored
            if not os.path.exists(src): say("BUILD needs %s (the mesh as imported and bored); copy character.* there once, before the first label refine" % src); sys.exit(2)
            shutil.copyfile(src, os.path.join(work, "character." + ext))
        blender("hb_label_refine.py", {"HB_CHAR": a.char}, os.path.join(logs, "label-refine.log")); say(*[l[:300] for l in grep(os.path.join(logs, "label-refine.log"), "Traceback", "Error")] or ["BUILD label refine done"])
        python("hb_border_cut.py", [], {"HB_CHAR": a.char}, os.path.join(logs, "border-cut.log")); say(*[l[:200] for l in grep(os.path.join(logs, "border-cut.log"), "BORDER_CUT {", "Traceback")])
        blender("hb_bind.py", {"HB_CHAR": a.char, "HB_HELPERS": helpers, "HB_TAG": a.tag}, os.path.join(logs, "bind.log")); say(*[l[:200] for l in grep(os.path.join(logs, "bind.log"), "STATIC", "Traceback", "Error")])
    if not os.path.exists(bound): say("no bind at", bound); sys.exit(2)
    import hashlib
    summ["bound_sha256"] = hashlib.sha256(open(bound, "rb").read()).hexdigest()       # which bind this summary is about, by content

    if "reports" in steps:
        python("hb_seam_audit.py", [], {"HB_CHAR": a.char}, os.path.join(logs, "seam-audit.log"))
        python("hb_harness.py", [bound, "--sets", "rom", "--helpers", helpers, "--out", bound[:-4] + ".rom.harness.json"], {}, os.path.join(logs, "harness-rom.log"))
        python("hb_harness.py", [bound, "--sets", ",".join(sets), "--poses", os.path.join(HB, "poses"), "--helpers", helpers, "--out", bound[:-4] + ".library.harness.json"], {}, os.path.join(logs, "harness-library.log"))
        blender("hb_contact.py", {"HB_BOUND": bound_rel, "HB_HELPERS": helpers, "HB_SETS": ",".join(["rom"] + sets), "HB_TAG": "contact-plates"}, os.path.join(logs, "contact.log"))
        blender("hb_gap_check.py", {"HB_BOUND": bound_rel, "HB_HELPERS": helpers, "HB_SETS": ",".join(["rom"] + sets)}, os.path.join(logs, "gap-check.log"))
        if gear:                                                                     # items on their sockets: fit at rest, then the troop's own poses
            blender("hb_gear.py", {"HB_CHAR": a.char, "HB_BOUND": bound_rel, "HB_GEAR": gear, "HB_HELPERS": helpers, "HB_SETS": ",".join(troop or ["general"])}, os.path.join(logs, "gear.log")); say(*[l[:240] for l in grep(os.path.join(logs, "gear.log"), "GEAR_CLASH", "GEAR_THROUGH", "Traceback")])
            if troop: python("hb_item_aim.py", ["--char", a.char, "--bound", bound_rel, "--sets", ",".join(troop), "--helpers", helpers], {}, os.path.join(logs, "item-aim.log")); say(*[l[:240] for l in grep(os.path.join(logs, "item-aim.log"), "AIM_SUMMARY", "Traceback")])
        say("REPORTS done (%.0f s)" % (time.time() - t0))

    eng = engine(out); summ["render_engine"] = eng; say("RENDER ENGINE", eng); renv = {"HB_ENGINE": eng} if eng == "CYCLES" else {}
    tex = spec["work"].rstrip("/") + "/character.blend"
    if "reports" in steps:
        blender("hb_rest_check.py", dict(renv, HB_CHAR=a.char, HB_BOUND=bound_rel, HB_OUTDIR=a.out.rstrip("/") + "/rest-check"), os.path.join(logs, "rest-check.log")); say(*[l[:200] for l in grep(os.path.join(logs, "rest-check.log"), "REST_CHECK", "Traceback")])

    def sheet(tagname, sub, poses, views, extra, textured=True, res=640, cell=420):
        env = dict(renv, HB_BOUND=bound_rel, HB_HELPERS=helpers, HB_TAG=tagname, HB_OUTDIR=a.out.rstrip("/") + ("/" + sub if sub else ""), HB_RES=res, HB_CELL=cell, HB_VIEWS=views, HB_COLS=len(views.split(",")), HB_POSES=poses); env.update(extra)
        if textured: env["HB_TEX"] = tex
        blender("hb_pose_render.py", env, os.path.join(logs, "render-%s-%s.log" % (sub or "sheet", tagname)))
        bad = grep(os.path.join(logs, "render-%s-%s.log" % (sub or "sheet", tagname)), "Traceback", "EXCEPTION", "MISSING")
        if bad: say("RENDER PROBLEM", tagname, bad[:2])
    if "joints" in steps:
        for name, joint, size, views, poses, takes in JOINTS:
            sheet(name, "joints", poses + ("," + ",".join(review) if takes and review else ""), views, {"HB_FOCUS": joint, "HB_FOCUS_SIZE": size})
        say("JOINT SHEETS done (%.0f s)" % (time.time() - t0))
    if "labels" in steps:
        for name, joint, size, views, poses, takes in JOINTS:
            sheet(name, "labels", ",".join(poses.split(",")[:3]), views, {"HB_FOCUS": joint, "HB_FOCUS_SIZE": size}, textured=False, res=480, cell=360)
        say("LABEL SHEETS done (%.0f s)" % (time.time() - t0))
    if "sheets" in steps:
        for s in sets:
            d = json.load(open(os.path.join(HB, "poses", s + ".json"))); ids = [q["id"] for q in (d["poses"] if isinstance(d, dict) else d)]
            sheet(s, "", ",".join("%s:%s" % (s, i) for i in ids), "rt-three-quarter", {"HB_COLS": 8}, res=600, cell=300)
        say("POSE SHEETS done (%.0f s)" % (time.time() - t0))
    if "gear" in steps and gear:
        # the items at rest, close: each on its joint from four sides; then the troop's own poses with the items on
        G = json.load(open(rel(gear)))["items"]
        for it in G: sheet("fit-" + it["name"], "gear", "rest:rest", "rt-three-quarter,rt-front,rt-back,rt-right,rt-left,rt-back-low", {"HB_FOCUS": it.get("wrist_joint", it["joint"]), "HB_FOCUS_SIZE": 0.075 if it["fit"] == "grip" else 0.16, "HB_GEAR": gearfit, "HB_COLS": 6}, res=720, cell=480)
        sheet("rest-figure", "gear", "rest:rest", "rt-front,rt-three-quarter,rt-left,rt-back,rt-right", {"HB_GEAR": gearfit, "HB_COLS": 5}, res=720, cell=480)
        for s in troop:
            d = json.load(open(os.path.join(HB, "poses", s + ".json"))); ids = [q["id"] for q in (d["poses"] if isinstance(d, dict) else d)]
            for vw in ("rt-three-quarter", "rt-back-right", "rt-three-quarter-back"):   # front-right, back-right, back-left: two cameras on one diagonal both foreshorten an arm that points along it
                sheet("%s-gear-%s" % (s, vw[3:]), "gear", ",".join("%s:%s" % (s, i) for i in ids), vw, {"HB_GEAR": gearfit, "HB_COLS": 8}, res=600, cell=300)
        say("GEAR SHEETS done (%.0f s)" % (time.time() - t0))
    if a.before and ("joints" in steps or "beforeafter" in steps):
        bdir = os.path.join(rel(a.before), "joints"); adir = os.path.join(out, "joints"); os.makedirs(os.path.join(out, "before-after"), exist_ok=True); expr = ["import sys; sys.path.insert(0, r'%s'); from hb_sheet import sheet" % TOOLS]
        for name, joint, size, views, poses, takes in JOINTS:
            vs = views.split(","); rows = []
            for pz in (poses + ("," + ",".join(review) if takes and review else "")).split(","):
                fn = ["%s-%s-%s.png" % (name, pz.replace(":", "-"), v) for v in vs]
                if all(os.path.exists(os.path.join(bdir, f)) and os.path.exists(os.path.join(adir, f)) for f in fn): rows += [os.path.join(bdir, f) for f in fn] + [os.path.join(adir, f) for f in fn]
            if rows: expr.append("sheet(%r, %d, 420, %r)" % (rows, len(vs), os.path.join(out, "before-after", "SHEET-%s.png" % name)))
        blender(None, {}, os.path.join(logs, "before-after.log"), expr="\n".join(expr)); say("BEFORE/AFTER sheets done")

    if "summary" in steps:
        T = json.load(open(os.path.join(HB, "harness", "thresholds.json"))); R = T["range_of_motion"]; L = T["pose_library"]; ex = set(R["stretch_p995"]["exempt_poses"]); C = summ["checks"]
        def chk(name, value, ok, limit): C[name] = {"value": value, "limit": limit, "result": "PASS" if ok else "FAIL"}
        def rep(name, value, note=""): C[name] = {"value": value, "result": "reported", "note": note}
        try:
            h = json.load(open(bound[:-4] + ".rom.harness.json")); rows = h["poses"]; s = h["summary"]; st = h["static"]
            chk("influences", st["max_influences"], st["max_influences"] <= 4 and st["unweighted"] == 0 and not st["rigid_not_single_bone"], "at most 4, none unweighted, rigid pieces on one joint")
            chk("plate distortion", s["rigid_max_dev"]["value"], s["rigid_max_dev"]["value"] <= R["rigid_max_dev"]["max"], R["rigid_max_dev"]["max"])
            for k in ("elbow", "knee", "ankle", "wrist"): chk(k + " thickness kept (range of motion)", round(s[k + ".outer_p05"]["value"], 3), s[k + ".outer_p05"]["value"] >= R[k + ".outer_p05"]["min"], R[k + ".outer_p05"]["min"])
            ne = max((r["stretch_p995"], r["id"]) for r in rows if r["id"] not in ex); xe = max((r["stretch_p995"], r["id"]) for r in rows if r["id"] in ex)
            chk("stretch, range of motion", [round(ne[0], 2), ne[1]], ne[0] <= R["stretch_p995"]["max"] and xe[0] <= R["stretch_p995"]["exempt_max"], "%s (%s overhead)" % (R["stretch_p995"]["max"], R["stretch_p995"]["exempt_max"]))
            am = min((r["area_p01"], r["id"]) for r in rows); chk("triangle collapse, range of motion", [round(am[0], 3), am[1]], am[0] >= R["area_p01"]["min"], R["area_p01"]["min"])
            h = json.load(open(bound[:-4] + ".library.harness.json")); rows = h["poses"]; s = h["summary"]; m = max((r["stretch_p995"], r["id"]) for r in rows)
            chk("stretch, pose library", [round(m[0], 2), m[1]], m[0] <= L["stretch_p995"]["max"], L["stretch_p995"]["max"]); chk("plate distortion, pose library", s["rigid_max_dev"]["value"], s["rigid_max_dev"]["value"] <= L["rigid_max_dev"]["max"], L["rigid_max_dev"]["max"])
            for k in ("elbow", "knee", "ankle", "wrist"): chk(k + " thickness kept (pose library)", round(s[k + ".outer_p05"]["value"], 3), s[k + ".outer_p05"]["value"] >= R[k + ".outer_p05"]["min"], R[k + ".outer_p05"]["min"])
            am = min((r["area_p01"], r["id"]) for r in rows); chk("triangle collapse, pose library", [round(am[0], 3), am[1]], am[0] >= R["area_p01"]["min"], R["area_p01"]["min"])
        except Exception as e: C["harness"] = {"result": "FAIL", "value": "could not read the harness reports: %s" % e}
        try:
            c = json.load(open(bound[:-4] + ".contact-plates.json")); lib = [r for r in c["rows"] if r["set"] != "rom"]; lim = L["poke_through_share_of_under_plate_verts"]["max"]; w = max((r["poke_share"], r["id"]) for r in lib)
            chk("soft surface through or past plates, pose library", [round(100 * w[0], 2), w[1], "median %.2f%%" % (100 * statistics.median(r["poke_share"] for r in lib))], w[0] <= lim, "%.0f%%" % (100 * lim))
            dl = L["through_steel_depth_p95_mm"]["max"]; arm = [(pl["through_depth_p95_mm"], r["id"], pn) for r in lib for pn, pl in r["plates"].items() if pn.split("_")[0] not in BODY_PARTS]; w = max(arm) if arm else (0.0, "", "")
            chk("depth through the steel, armour plates, pose library", [round(w[0], 1), w[1], w[2]], w[0] <= dl, "%s mm" % dl)
            rep("depth through the steel, flags over %s mm" % c["flags"]["through_depth_over_mm"], c["flags"]["count"], "all poses and pieces; " + ", ".join("%s %s %.1f" % (f["id"], f["plate"], f["through_depth_p95_mm"]) for f in c["flags"]["items"][:5]))
        except Exception as e: C["contact"] = {"result": "FAIL", "value": "could not read the contact report: %s" % e}
        try:
            g = json.load(open(bound[:-4] + ".gap-check.json")); gl = T.get("see_inside", {}).get("max_hole_share"); w = max(((v["max"], n, v["worst_pose"], v["worst_view"]) for n, v in g["summary"].items()))
            rep("inside of a surface seen at any joint, worst", [round(100 * w[0], 1), w[1], w[2], w[3], "%d flags" % len(g["flags"])], "share of what is seen at a joint whose first surface is seen from behind, above the rest pose; not a defect where something drawn lies behind it")
            w = max(((v["hole_max"], n, v["hole_worst_pose"], v["hole_worst_view"]) for n, v in g["summary"].items())); val = [round(100 * w[0], 1), w[1], w[2], w[3], "%d flags" % len(g.get("hole_flags", []))]
            if gl is None: rep("holes at any joint, worst", val, "share of what is seen at a joint where a one-sided renderer shows the background through the figure, above the rest pose")
            else: chk("holes at any joint, worst", val, w[0] <= gl, "%.0f%%" % (100 * gl))
        except Exception as e: C["gap check"] = {"result": "FAIL", "value": "could not read the gap report: %s" % e}
        try:
            r = json.load(open(os.path.join(out, "rest-check", "rest-check.json"))); chk("rest pose unchanged", ["%.2f%%" % (100 * r["worst"]["share"]), r["worst"]["joint"], r["worst"]["view"]] + (["approved repaint of %s left out of the colour comparison (%d rays)" % (", ".join(sorted(r["approved_repaints"])), r.get("rays_on_repainted_surface_left_out_of_the_colour_comparison", 0))] if r.get("approved_repaints") else []), r["pass"], "%.1f%% of what is seen at any joint from any side, patches only" % (100 * r["max_share"]))
        except Exception as e: C["rest pose unchanged"] = {"result": "FAIL", "value": "no rest check: %s" % e}
        try:
            sa = json.load(open(os.path.join(work, "seam-audit.json"))); open_ = [x for x in sa["rigid_rigid"] if not x["filled_by_bind"]]
            rep("seams between rigid pieces on different joints", len(sa["rigid_rigid"]), "; ".join("%s | %s %.0f mm%s" % (x["between"][0], x["between"][1], x["length_mm"], "" if x["filled_by_bind"] else (" (no cuff: not a closed loop)" if not x.get("closed_loop") else " (no cuff: under 20 mm across)")) for x in sa["rigid_rigid"]))
        except Exception as e: C["seam audit"] = {"result": "FAIL", "value": "no seam audit: %s" % e}
        if gear:
            try:
                E = T.get("equipment", {}); lim = lambda it, k: float((it.get("allow") or {}).get(k, E.get(k, {}).get("max", 0))); GS = {i["name"]: i for i in json.load(open(rel(gear)))["items"]}
                F = json.load(open(os.path.join(work, "gear-fit.json"))); K = json.load(open(bound[:-4] + ".gear-clash.json")); summ["gear_fit"] = spec["work"].rstrip("/") + "/gear-fit.json"
                if F.get("bound") != bound_rel: C["equipment fitted on this bind"] = {"result": "FAIL", "value": "gear-fit.json was made on %s" % F.get("bound")}
                for n, gi in F["items"].items():
                    m = gi["measurements"]; it = GS[n]
                    if gi["fit"] == "grip":
                        chk("%s in the hand, deepest hand vertex inside it (mm)" % n, m["depth_mm_p50_p95_max"][2], m["depth_mm_p50_p95_max"][2] <= lim(it, "hand_depth_mm"), lim(it, "hand_depth_mm"))
                        hr = m["handle_round_the_fist"]; chk("%s handle proud of the hand (mm)" % n, [hr["proud_of_the_hand_mm_max"], "%d of %d samples round the fist" % (hr["shows_through_hand"], hr["covered_by_hand"] + hr["shows_through_hand"] + hr["open_between_fingers"])], hr["proud_of_the_hand_mm_max"] <= lim(it, "handle_proud_of_hand_mm"), lim(it, "handle_proud_of_hand_mm"))
                        rep("%s handle beyond the fist (mm)" % n, m["handle_beyond_fist_mm"], "guard to hand %s mm" % m["guard_to_hand_mm"])
                    elif gi["fit"] == "forearm":
                        chk("%s on the forearm, deepest surface vertex inside it (mm)" % n, [m["depth_mm_max"], "%d vertices" % m["surface_vertices_inside_item"]], m["depth_mm_max"] <= lim(it, "forearm_depth_mm"), lim(it, "forearm_depth_mm"))
                        rep("%s follows" % n, gi["joint"], "leans %.2f deg with the forearm; a wrist joint never moves it" % m["lean_with_forearm_deg"])
                    w = max(((r["items"][n]["item_inside_body_span_mm"], r["id"]) for r in K["rows"]), default=(0.0, "")); chk("%s inside the body in a pose, worst (mm of its length)" % n, [w[0], w[1], "%d of %d poses over the limit" % (sum(r["items"][n]["item_inside_body_span_mm"] > lim(it, "item_inside_body_span_mm") for r in K["rows"]), len(K["rows"]))], w[0] <= lim(it, "item_inside_body_span_mm"), lim(it, "item_inside_body_span_mm"))
                    w = max(((r["items"][n]["depth_mm_max"] if r["items"][n]["body_vertices_inside"] else 0.0, r["items"][n]["body_vertices_inside"], r["id"]) for r in K["rows"]), default=(0.0, 0, "")); chk("body inside the %s in a pose, deepest (mm)" % n, [w[0], "%d vertices" % w[1], w[2], "%d of %d poses with any" % (K["summary"][n]["poses_with_body_inside"], K["summary"][n]["poses"])], w[0] <= lim(it, "body_in_item_depth_mm"), lim(it, "body_in_item_depth_mm"))
                    tp = [r["id"] for r in K["rows"] if r["items"][n]["other_items_inside"]]; chk("%s touching another item, poses" % n, [len(tp)] + tp[:4], len(tp) <= lim(it, "items_touching_poses"), int(lim(it, "items_touching_poses")))
                if troop:
                    Aim = json.load(open(os.path.join(work, "item-aim.json"))); ev = [(v, r["id"], k) for r in Aim["rows"] for k, v in r["before"].items()]; w = max(ev, default=(0.0, "", "")); dl = float(E.get("direction_error_deg", {}).get("max", 12.0))
                    chk("items point where the poses say, worst (deg)", [w[0], w[1], w[2], "median %.1f" % statistics.median(v for v, _, _ in ev)] if ev else [0.0], w[0] <= dl + 1e-6, dl)
                    for s_ in troop:                                                # the pose file is what the items are held to; say how far it has moved from the set as first authored
                        f1 = os.path.join(HB, "poses", s_ + ".v1.json")
                        if not os.path.exists(f1): continue
                        import math
                        P1 = {q["id"]: q for q in json.load(open(f1))["poses"]}; ch = []
                        for q in json.load(open(os.path.join(HB, "poses", s_ + ".json")))["poses"]:
                            for n_, it_ in (q.get("items") or {}).items():
                                for k_, v_ in (it_ or {}).items():
                                    o_ = ((P1.get(q["id"], {}).get("items") or {}).get(n_) or {}).get(k_)
                                    if k_ == "at" or o_ is None or not isinstance(v_, list): continue
                                    c_ = sum(a_ * b_ for a_, b_ in zip(v_, o_)) / math.sqrt(sum(a_ * a_ for a_ in v_) * sum(b_ * b_ for b_ in o_)); ang_ = math.degrees(math.acos(max(-1.0, min(1.0, c_))))
                                    if ang_ > 1.0: ch.append((round(ang_, 1), q["id"], n_))
                        rep("item directions restated since the %s set was first authored" % s_, [len(ch)] + ([max(ch)[0], max(ch)[1], max(ch)[2]] if ch else []), "the direction check holds each item to the pose file as it now stands; this is how many of its directions differ from version 1, and the largest change")
            except Exception as e: C["equipment"] = {"result": "FAIL", "value": "could not read the equipment reports: %s" % e}
        fails = [k for k, v in C.items() if v["result"] == "FAIL"]; summ["result"] = "FAIL" if fails else "PASS"; summ["failed"] = fails; summ["seconds"] = round(time.time() - t0)
        json.dump(summ, open(os.path.join(out, "gate-summary.json"), "w"), indent=1)
        for k, v in C.items(): say("GATE %-8s %-58s %s%s" % (v["result"], k, v.get("value"), ("   limit " + str(v["limit"])) if "limit" in v else ""))
        say("GATE NUMBERS", summ["result"], "(%d failed)" % len(fails), "| the numbers do not judge how it looks: read the joint sheets, then have them reviewed cold")


if __name__ == "__main__": main()
