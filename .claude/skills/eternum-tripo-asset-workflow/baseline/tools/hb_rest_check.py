"""Rest-pose identity check (runs inside Blender for its BVH; renders nothing): the bound mesh, unposed, must look
like the mesh as generated.

Everything the bind stage does (labels, cuts, underlay, padding, linings, cuffs, recolouring of hidden surface) is
meant to be invisible until something moves. For every joint this looks at a cube round the joint from six sides
through a grid of rays, on the mesh as imported (`<work>/character-prerefine.npz`, or `character.npz` if the label
refine has not run) and on the bound mesh at rest, and compares what each ray meets first: how far away it is and what
colour the texture has there. A ray differs when

  the surface it meets is more than 1.5 mm nearer or further (something generated lies outside the original surface), or
  the texture colour there differs by more than HB_TOL (a recolour reached surface that can be seen, or a generated
  surface of another colour shows).
Only patches count: a differing ray with at least three differing rays among the eight round it. Rays that differ and
meet a generated surface (underlay, padding, a cuff, a lining) are also counted separately.

Working by rays, not renders, it does not depend on the render engine or on lighting, and takes seconds.

env HB_CHAR   char.json spec (path under human-baseline)
    HB_BOUND  bound npz (path under human-baseline)
    HB_OUTDIR output folder under human-baseline (default <work>/rest-check)
    HB_GRID   rays per side (default 56); HB_TOL colour difference that counts (default 0.12, 0..1)
    HB_MAX    share of rays allowed to differ at any joint from any side (default: see_rest in harness/thresholds.json, else 0.005)
Writes rest-check.json (per joint and side: share of rays that differ, and why) and, for every joint over the limit,
a small picture of where (diff-<joint>-<side>.png: white same, red generated surface showing, blue colour, black depth).
Prints REST lines and REST_CHECK PASS or FAIL."""
import bpy, os, sys, json
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
from hb_gap_check import JOINTS, VIEWS, FAR

GENERATED = ("underlay", "padding", "joint_fill")


def texture(work):
    with bpy.data.libraries.load(os.path.join(work, "character.blend"), link=False) as (src, dst): dst.materials = list(src.materials)
    im = None
    for m in dst.materials:
        if m and m.use_nodes:
            bs = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bs and bs.inputs["Base Color"].is_linked: im = bs.inputs["Base Color"].links[0].from_node.image; break
    im = im.copy(); im.scale(1024, 1024); return np.array(im.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)[:, :, :3]


class Mesh:
    def __init__(self, V, tris, uv, px):
        self.V = V; self.tris = tris; self.uv = uv; self.px = px; self.bv = BVHTree.FromPolygons([tuple(q) for q in V], [tuple(int(x) for x in t) for t in tris])

    def look(self, c, a, s, G):
        """depth (nan where nothing in the cube), colour, face for a GxG grid of rays through the cube round c"""
        a = np.asarray(a, float); a /= np.linalg.norm(a); u = np.cross(a, [0, 0, 1.0]); u = u / np.linalg.norm(u) if np.linalg.norm(u) > 1e-6 else np.array([1.0, 0, 0]); v = np.cross(a, u)
        D = np.full((G, G), np.nan); C = np.zeros((G, G, 3)); F = np.full((G, G), -1); av = Vector(a.tolist()); xs = (np.arange(G) + 0.5) / G * 2 * s - s
        for i, y in enumerate(xs):
            for j, x in enumerate(xs):
                o = c + u * x + v * y - a * FAR; loc, nrm, fi, dd = self.bv.ray_cast(Vector(o.tolist()), av, FAR + s)
                if loc is None or abs(dd - FAR) > s: continue
                t = self.tris[fi]; A_, B_, C_ = self.V[t[0]], self.V[t[1]], self.V[t[2]]; q = np.array(loc); v0, v1, v2 = B_ - A_, C_ - A_, q - A_
                d00, d01, d11, d20, d21 = v0 @ v0, v0 @ v1, v1 @ v1, v2 @ v0, v2 @ v1; den = d00 * d11 - d01 * d01
                bv_ = (d11 * d20 - d01 * d21) / den if abs(den) > 1e-20 else 0.0; bw = (d00 * d21 - d01 * d20) / den if abs(den) > 1e-20 else 0.0
                w = self.uv[fi, 0] * (1 - bv_ - bw) + self.uv[fi, 1] * bv_ + self.uv[fi, 2] * bw
                D[i, j] = dd; F[i, j] = fi; C[i, j] = self.px[min(1023, max(0, int(w[1] * 1024))), min(1023, max(0, int(w[0] * 1024)))]
        return D, C, F


if __name__ == "__main__":
    SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); bound = p(*os.environ["HB_BOUND"].split("/"))
    OUT = p(*os.environ["HB_OUTDIR"].split("/")) if os.environ.get("HB_OUTDIR") else os.path.join(WORK, "rest-check"); os.makedirs(OUT, exist_ok=True)
    G = int(os.environ.get("HB_GRID", "56")); TOL = float(os.environ.get("HB_TOL", "0.12")); T = json.load(open(p("harness", "thresholds.json")))
    MAXS = float(os.environ.get("HB_MAX", T.get("see_rest", {}).get("max_share", 0.005)))
    ref = os.path.join(WORK, "character-prerefine.npz"); ref = ref if os.path.exists(ref) else os.path.join(WORK, "character.npz")
    a = np.load(ref); b = np.load(bound); bm = json.load(open(bound[:-4] + ".json")); classes = bm["classes"]; rig = bm["rig"]; px = texture(WORK)
    A = Mesh(a["V"].astype(float), a["tris"].astype(np.int64), a["uv"].astype(float), px); B = Mesh(b["V"].astype(float), b["tris"].astype(np.int64), b["uv"].astype(float), px)
    gen = np.isin(b["fcls"], [int(k) for k, c in classes.items() if c["name"] in GENERATED or c.get("lining_of")]); rows = []
    # An approved repaint (labels.repaint in the spec; the label refine records the texel it used) is a change to the rest
    # pose that the user has agreed to. Faces that carry exactly that texel are left out of the colour comparison, and
    # only of that: where they lie is still compared, and everything else is checked as before.
    try: rp = (json.load(open(os.path.join(WORK, "character.json"))).get("report", {}).get("label_refine", {}) or {}).get("repainted", {}) or {}
    except Exception: rp = {}
    rpf = np.zeros(len(b["tris"]), bool)
    for cn_, r_ in rp.items():
        if r_.get("texel"): rpf |= (np.abs(b["uv"].astype(float) - np.array(r_["texel"], float)).reshape(len(b["tris"]), -1).max(1) < 1e-6)
    exempt_total = 0
    for n, jn, s in JOINTS:
        if jn not in rig["names"]: continue
        c = np.array(rig["rest"][rig["names"].index(jn)], float)
        for vn, d in VIEWS.items():
            DA, CA, FA = A.look(c, d, s, G); DB, CB, FB = B.look(c, d, s, G); seen = ~np.isnan(DA) | ~np.isnan(DB)
            if seen.sum() < 50: continue
            depth = seen & ((np.isnan(DA) != np.isnan(DB)) | (np.abs(np.nan_to_num(DA) - np.nan_to_num(DB)) > 0.0015)); shows = seen & (FB >= 0) & gen[np.clip(FB, 0, None)]
            colour = seen & ~depth & (np.abs(CA - CB).max(2) > TOL)
            ex = colour & (FB >= 0) & rpf[np.clip(FB, 0, None)]; colour &= ~ex; exempt_total += int(ex.sum()); anyd = depth | colour
            # a patch, not a sliver: at least three of the eight rays round it differ too. Cutting a plate free leaves
            # hairline differences along its rim that nobody can see; a fleck, a flat patch or a bulge is several rays wide
            nb8 = sum(np.roll(np.roll(anyd, dy, 0), dx, 1) for dy in (-1, 0, 1) for dx in (-1, 0, 1)) - anyd; bad = anyd & (nb8 >= 3); depth = depth & bad; colour = colour & bad
            share = float(bad.sum() / seen.sum()); shows = shows & bad; sliver = float(anyd.sum() / seen.sum())
            rows.append({"joint": n, "view": vn, "share": round(share, 4), "rays": int(seen.sum()), "generated_surface_showing": int(shows.sum()), "depth": int(depth.sum()), "colour": int(colour.sum()), "share_with_slivers": round(sliver, 4)})
            if share > MAXS:
                img = np.ones((G, G, 4), np.float32); img[..., :3][~seen] = 0.85; img[..., :3][colour] = (0.1, 0.3, 1.0); img[..., :3][depth] = (0, 0, 0); img[..., :3][shows] = (1.0, 0.1, 0.1)
                big = img.repeat(6, 0).repeat(6, 1); im = bpy.data.images.new("d", G * 6, G * 6); im.pixels[:] = big.ravel(); im.filepath_raw = os.path.join(OUT, "diff-%s-%s.png" % (n, vn)); im.file_format = "PNG"; im.save(); bpy.data.images.remove(im)
    worst = max(rows, key=lambda r: r["share"]); ok = worst["share"] <= MAXS; per = {}
    for r in rows: per[r["joint"]] = max(per.get(r["joint"], 0.0), r["share"])
    json.dump({"reference": os.path.basename(ref), "bound": os.environ["HB_BOUND"], "grid": G, "colour_tolerance": TOL, "max_share": MAXS, "pass": bool(ok), "worst": worst, "worst_by_joint": per, "approved_repaints": {k_: {kk: v_.get(kk) for kk in ("faces", "from", "tone", "approved")} for k_, v_ in rp.items()}, "rays_on_repainted_surface_left_out_of_the_colour_comparison": exempt_total, "views": rows}, open(os.path.join(OUT, "rest-check.json"), "w"), indent=1)
    for n in per:
        w = max((r for r in rows if r["joint"] == n), key=lambda r: r["share"])
        print("REST %-11s worst %5.2f%% from %-11s (of %d rays: depth %d, colour %d; on generated surface %d)" % (n, 100 * w["share"], w["view"], w["rays"], w["depth"], w["colour"], w["generated_surface_showing"]))
    if rp: print("REST_REPAINT approved repaints %s: %d rays on repainted surface left out of the colour comparison" % (sorted(rp), exempt_total))
    print("REST_CHECK", "PASS" if ok else "FAIL", "worst %.2f%% at %s from %s (limit %.1f%%)" % (100 * worst["share"], worst["joint"], worst["view"], 100 * MAXS))
