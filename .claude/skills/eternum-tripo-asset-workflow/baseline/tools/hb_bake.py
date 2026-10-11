"""Bake a reduced character to one material: a new texture layout, and colour, ORM and normal maps carried over from
the bind (runs in Blender: it unwraps, computes tangents and loads the source images).

The reduced mesh (hb_reduce.py) has a tenth of the bind's triangles and none of its texture layout. This gives it its
own: every face a place in one square, and for every texel there the surface of the bind it stands for.

  unwrap    the bind's own texture layout is kept wherever a reduced face lies on one piece of it (the reduced mesh's
            vertices are bind vertices): a few hundred well-shaped pieces. The rest (faces across two pieces, generated
            surface painted from a single texel) get Blender's smart projection, generated surface (underlay, padding,
            linings, fills: seen only when something moves) at 0.45 of its size and named classes larger ("density").
            All islands are then packed again. "unwrap": "smart" in the spec's "bake" entry (or HB_UNWRAP=smart)
            projects everything afresh instead: thousands of small islands, a third of the square used
  tangents  the reduced mesh keeps authored normals (hb_lib.corner_normals); tangents are Blender's (MikkTSpace), the
            same the exported file carries, so the normal map is read back in the basis it was written in
  covered   where the nearest surface of the bind is surface another piece covers at rest (painted black by the generator:
            the plate under a strap), the nearest uncovered surface of the same class is read instead, so a reduction's
            small shifts of an edge never show that black
  showing   a texel of generated surface that nothing covers at rest (a hidden face flattened until it cuts through the
            plate over it) is read from the character's surface nearest to it, so it looks like the plate and not like a
            dark wedge on it
  one texel a class the bind paints from a single texel throughout (the cloth under a cuff) is that texel on the reduction
            too, wherever its faces lie (a mouth's funnel, hb_reduce.py, lies nowhere near the bind's faces of its class)
  source    for each texel, the point of the bind's surface nearest to the texel's point on the reduced mesh, looked
            for only in the same connected piece of the bind (a plate's texel never reads the underlay beneath it), for
            a face of the character only among that piece's faces of the character (never the strip or cuff joined to
            it), and taken from the surface facing the same way when two are near
  colour    the source colour there. A face whose three texture corners are one point (generated surface and approved
            repaints are painted from a single texel) is read from that texel exactly
  normal    the source normal map there, in the bind's own tangent basis and on its authored normals, turned into the
            reduced mesh's basis. Faces painted from a single texel have no normal map: their own normal is used
  ORM       the source's, with the corrections approved for this family (steel is worn, not chrome; nothing but steel is
            metal): see `orm_rules` in the spec's "bake" entry, defaults below
  padding   texels outside every island take the nearest island texel's value, 8 texels out

env HB_CHAR  char.json (path under human-baseline); HB_HIGH bind npz; HB_LOW reduced npz (both under human-baseline)
    HB_NAME  output name (default: the reduced file's own, e.g. near); HB_RES texture size (default 1024)
    HB_TEX   folder with color, orm and normal images (.png or .jpg; default <work>/tex)
    HB_OUTDIR where to write (default <work>); HB_ORM=keep leaves roughness and metallic as the source has them
    HB_LOOKUP=normal  look for each texel's source along its own normal first (single-layer items; see below in the code)
Writes <work>/baked-<name>.npz (V, tris, W, cls, fcls, CN, keep, uv, tangent, as a bind plus the layout), .json, and
<work>/baked-<name>-{color,orm,normal}.png. Prints BAKE lines."""
import bpy, os, sys, json, math, time
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H

ORM_DEFAULT = {"steel_roughness": [0.48, 0.35], "steel_metallic_min": 0.85, "steel_is": {"metallic_over": 0.5, "saturation_under": 0.25}, "other_metallic": 0.04, "other_roughness": [0.55, 0.45], "skin_roughness": [0.5, 0.4], "skin_classes": ["head", "neck", "hand_l", "hand_r"]}
GEN = ("underlay", "padding", "joint_fill")


def load_image(path):
    im = bpy.data.images.load(path); im.colorspace_settings.name = "Non-Color"; w, h = im.size; a = np.empty(w * h * im.channels, np.float32); im.pixels.foreach_get(a)
    out = np.rint(a.reshape(h, w, im.channels)[:, :, :3] * 255.0).astype(np.uint8); del a; bpy.data.images.remove(im); return out   # values as stored in the file (bytes), bottom row first


def shrink(a, times):
    """halve a byte image `times` times by averaging; returns floats 0..1"""
    a = a.astype(np.float32) / 255.0 if times == 0 else (a[0::2, 0::2].astype(np.float32) + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) / (4 * 255.0)
    for _ in range(max(0, times - 1)): a = (a[0::2, 0::2] + a[1::2, 0::2] + a[0::2, 1::2] + a[1::2, 1::2]) * 0.25
    return a


def bilinear(img, uv):
    h, w, _ = img.shape; x = uv[:, 0] * w - 0.5; y = uv[:, 1] * h - 0.5; x0 = np.floor(x).astype(int); y0 = np.floor(y).astype(int); fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    g = lambda yy, xx: img[np.clip(yy, 0, h - 1), np.clip(xx, 0, w - 1)]
    return (g(y0, x0) * (1 - fx) + g(y0, x0 + 1) * fx) * (1 - fy) + (g(y0 + 1, x0) * (1 - fx) + g(y0 + 1, x0 + 1) * fx) * fy


def nearest(img, uv):
    h, w, _ = img.shape; return img[np.clip((uv[:, 1] * h).astype(int), 0, h - 1), np.clip((uv[:, 0] * w).astype(int), 0, w - 1)].astype(np.float32) / 255.0


def islands_of(nv, tris):
    par = np.arange(nv)
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    for a, b, c in tris:
        ra = find(a); rb = find(b)
        if ra != rb: par[rb] = ra
        rc = find(c)
        if rc != ra: par[rc] = ra
    return np.array([find(i) for i in range(nv)])


def make_object(name, V, tris, CN, uv=None):
    me = bpy.data.meshes.new(name); me.from_pydata(V.tolist(), [], tris.tolist()); me.update()
    for pl in me.polygons: pl.use_smooth = True
    if uv is not None: ul = me.uv_layers.new(name="UVMap"); ul.data.foreach_set("uv", uv.reshape(-1, 2).ravel().astype(np.float32))
    n = CN.reshape(-1, 3).astype(float); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-20); me.normals_split_custom_set(n.tolist()); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob); return ob


def loop_tangents(ob):
    me = ob.data; me.calc_tangents(uvmap="UVMap"); n = len(me.loops); t = np.zeros(n * 3, np.float32); s = np.zeros(n, np.float32); me.loops.foreach_get("tangent", t); me.loops.foreach_get("bitangent_sign", s); return t.reshape(-1, 3, 3).astype(float), s.reshape(-1, 3).astype(float)


if __name__ == "__main__":
    t0 = time.time(); SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); RES = int(os.environ.get("HB_RES", "1024")); TEX = p(*os.environ["HB_TEX"].split("/")) if os.environ.get("HB_TEX") else os.path.join(WORK, "tex")
    hp = p(*os.environ["HB_HIGH"].split("/")); lp = p(*os.environ["HB_LOW"].split("/")); name = os.environ.get("HB_NAME") or os.path.basename(lp)[:-4].replace("reduced-", ""); B = SPEC.get("bake", {}); RULE = dict(ORM_DEFAULT, **B.get("orm_rules", {}))
    hd = np.load(hp); HV = hd["V"].astype(float); HT = hd["tris"].astype(np.int64); HU = hd["uv"].astype(float); HF = hd["fcls"]; HCN = hd["CN"].astype(float); meta = json.load(open(hp[:-4] + ".json")); classes = meta["classes"]
    ld = np.load(lp); LV = ld["V"].astype(float); LT = ld["tris"].astype(np.int64); LF = ld["fcls"]; LCN = ld["CN"].astype(float); keep = ld["keep"]; lmeta = json.load(open(lp[:-4] + ".json")); classes = dict(classes); classes.update(lmeta.get("classes", {}))      # (a reduction may have classes of its own: a mouth's funnel)
    nm = {int(k): c for k, c in classes.items()}; gen_ids = [k for k, c in nm.items() if c["name"] in GEN or c.get("lining_of") or c.get("generated")]; skin_ids = [k for k, c in nm.items() if c["name"] in RULE["skin_classes"]]
    bpy.ops.wm.read_factory_settings(use_empty=True); rep = {"high": os.environ["HB_HIGH"], "low": os.environ["HB_LOW"], "resolution": RES, "orm_rules": RULE}

    # ---- unwrap the reduced mesh
    lo = make_object("low", LV, LT, LCN); bpy.context.view_layer.objects.active = lo; lo.select_set(True); lo.data.uv_layers.new(name="UVMap")
    mode = os.environ.get("HB_UNWRAP") or B.get("unwrap", "inherit"); inherit = np.zeros(len(LT), bool); LUsrc = np.zeros((len(LT), 3, 2))
    if mode == "inherit" and "uv" in ld.files:                                 # the reducer kept the bind's texture pieces whole and wrote each face's texture points (hb_reduce.py --seams)
        LUsrc = ld["uv"].astype(float); inherit = ~np.isnan(LUsrc[:, 0, 0]); LUsrc[~inherit] = 0.0; a3_ = np.linalg.norm(np.cross(LV[LT[:, 1]] - LV[LT[:, 0]], LV[LT[:, 2]] - LV[LT[:, 0]]), axis=1)
        rep["inherit"] = {"from": "the reduced file", "reduced_faces_keeping_the_binds_layout": int(inherit.sum()), "of": int(len(LT)), "share_of_surface": round(float(a3_[inherit].sum() / max(a3_.sum(), 1e-18)), 3)}; print("BAKE inherit", json.dumps(rep["inherit"]), flush=True)
    elif mode == "inherit":
        # The bind's own texture layout is kept wherever it can be: a reduced face whose three corners lie on one piece of the bind's texture takes those
        # three texture points (the reduced mesh's vertices are bind vertices). The pieces are the generator's: a few hundred, already laid out well. Faces
        # that cannot (corners on different pieces, surface painted from a single texel, a texture triangle that would fold) are projected afresh below.
        hq = np.round(HU * 65536 * 16).astype(np.int64); hpar = np.arange(len(HT)); hkey = {}
        def hfind(x):
            while hpar[x] != x: hpar[x] = hpar[hpar[x]]; x = hpar[x]
            return x
        for f in range(len(HT)):
            for k in range(3):
                a, b = int(HT[f][k]), int(HT[f][(k + 1) % 3]); ua, ub = tuple(hq[f][k]), tuple(hq[f][(k + 1) % 3]); kk = (a, ua, b, ub) if a < b else (b, ub, a, ua)
                if kk in hkey: hpar[hfind(f)] = hfind(hkey[kk])
                else: hkey[kk] = f
        hisl = np.array([hfind(f) for f in range(len(HT))]); hsa = ((HU[:, 1, 0] - HU[:, 0, 0]) * (HU[:, 2, 1] - HU[:, 0, 1]) - (HU[:, 2, 0] - HU[:, 0, 0]) * (HU[:, 1, 1] - HU[:, 0, 1])) / 2; textured = np.abs(hsa) > 1e-10
        ha3 = np.linalg.norm(np.cross(HV[HT[:, 1]] - HV[HT[:, 0]], HV[HT[:, 2]] - HV[HT[:, 0]]), axis=1) / 2; parea = {}; psign = {}; p3 = {}; vp = {}; pieces_of = {}
        for f in np.nonzero(textured)[0]:
            i = int(hisl[f]); parea[i] = parea.get(i, 0.0) + abs(hsa[f]); psign[i] = psign.get(i, 0.0) + hsa[f]; p3[i] = p3.get(i, 0.0) + ha3[f]
            for k in range(3): v = int(HT[f][k]); vp[(v, i)] = HU[f][k]; pieces_of.setdefault(v, set()).add(i)
        none = set()
        for f in range(len(LT)):
            v = [int(keep[x]) for x in LT[f]]; common = pieces_of.get(v[0], none) & pieces_of.get(v[1], none) & pieces_of.get(v[2], none)
            if not common: continue
            i = max(common, key=lambda i_: parea[i_]); tri = np.array([vp[(v[k], i)] for k in range(3)]); sa = ((tri[1, 0] - tri[0, 0]) * (tri[2, 1] - tri[0, 1]) - (tri[2, 0] - tri[0, 0]) * (tri[1, 1] - tri[0, 1])) / 2
            a3_ = float(np.linalg.norm(np.cross(LV[LT[f][1]] - LV[LT[f][0]], LV[LT[f][2]] - LV[LT[f][0]]))) / 2; dens_ = parea[i] / max(p3[i], 1e-18)            # the piece's own texture area per surface area
            if sa * psign[i] <= 0 or abs(sa) < 0.1 * dens_ * a3_ or abs(sa) > 10 * dens_ * max(a3_, 1e-18): continue                        # would fold, or is squashed or blown up tenfold against its piece
            LUsrc[f] = tri; inherit[f] = True
        rep["inherit"] = {"bind_texture_pieces": int(len(parea)), "bind_faces_painted_from_a_single_texel": int((~textured).sum()), "reduced_faces_keeping_the_binds_layout": int(inherit.sum()), "of": int(len(LT)), "share_of_surface": round(float(np.linalg.norm(np.cross(LV[LT[inherit][:, 1]] - LV[LT[inherit][:, 0]], LV[LT[inherit][:, 2]] - LV[LT[inherit][:, 0]]), axis=1).sum() / max(np.linalg.norm(np.cross(LV[LT[:, 1]] - LV[LT[:, 0]], LV[LT[:, 2]] - LV[LT[:, 0]]), axis=1).sum(), 1e-18)), 3)}
        print("BAKE inherit", json.dumps(rep["inherit"]), flush=True)
    import bmesh
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_mode(type="FACE"); bpy.ops.mesh.select_all(action="DESELECT"); bm = bmesh.from_edit_mesh(lo.data); bm.faces.ensure_lookup_table()
    for i_ in np.nonzero(~inherit)[0]: bm.faces[int(i_)].select_set(True)
    bmesh.update_edit_mesh(lo.data)
    if (~inherit).any(): bpy.ops.uv.smart_project(angle_limit=math.radians(float(B.get("unwrap_angle", 66))), island_margin=0.0, area_weight=0.0, correct_aspect=True, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode="OBJECT")
    uv = np.zeros(len(LT) * 6, np.float32); lo.data.uv_layers["UVMap"].data.foreach_get("uv", uv); uv = uv.reshape(-1, 3, 2).astype(float); uv[inherit] = LUsrc[inherit]
    # islands of the layout: faces that share an edge with the same texture corners on both sides
    key = {}; par = np.arange(len(LT))
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    q = np.round(uv * 1e5).astype(np.int64)
    for f in range(len(LT)):
        for k in range(3):
            a, b = int(LT[f][k]), int(LT[f][(k + 1) % 3]); ua, ub = tuple(q[f][k]), tuple(q[f][(k + 1) % 3]); kk = (a, ua, b, ub) if a < b else (b, ub, a, ua)
            if kk in key: par[find(f)] = find(key[kk])
            else: key[kk] = f
    isl = np.array([find(f) for f in range(len(LT))]); dens = {c_: float(v_) for c_, v_ in (B.get("density") or {}).items()}; scale_f = np.array([dens.get(nm[int(c)]["name"], 0.45 if int(c) in gen_ids else 1.0) for c in LF])
    a3 = np.linalg.norm(np.cross(LV[LT[:, 1]] - LV[LT[:, 0]], LV[LT[:, 2]] - LV[LT[:, 0]]), axis=1) / 2; a2 = np.abs((uv[:, 1, 0] - uv[:, 0, 0]) * (uv[:, 2, 1] - uv[:, 0, 1]) - (uv[:, 2, 0] - uv[:, 0, 0]) * (uv[:, 1, 1] - uv[:, 0, 1])) / 2
    d0 = math.sqrt(max(a2[inherit].sum(), 1e-18) / max(a3[inherit].sum(), 1e-18)) if inherit.any() else 1.0   # what the kept layout gives: texture length per metre of surface
    for i in np.unique(isl):                                                   # every island to the same texels per metre, times its classes' density; islands keeping the bind's layout stay as they are
        m = isl == i
        if inherit[m].all(): continue
        s = d0 * math.sqrt(max(a3[m].sum(), 1e-12) / max(a2[m].sum(), 1e-12)) * float(np.average(scale_f[m], weights=a3[m] + 1e-12)); c = uv[m].reshape(-1, 2).mean(0); uv[m] = (uv[m] - c) * s + c
    lo.data.uv_layers["UVMap"].data.foreach_set("uv", uv.ravel().astype(np.float32)); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.uv.select_all(action="SELECT")
    margin = float(B.get("island_margin_px", 3)) / RES
    packed = None
    for kw in ({"rotate": True, "rotate_method": "ANY", "scale": True, "margin_method": "FRACTION", "margin": margin, "shape_method": B.get("pack_shape", "CONCAVE")}, {"rotate": True, "scale": True, "margin_method": "FRACTION", "margin": margin, "shape_method": "CONVEX"}, {"rotate": True, "margin": margin}):
        try: bpy.ops.uv.pack_islands(**kw); packed = kw; break
        except TypeError as e_: print("BAKE pack options refused:", str(e_)[:160], flush=True)
    bpy.ops.object.mode_set(mode="OBJECT")
    uvn = np.zeros(len(LT) * 6, np.float32); lo.data.uv_layers["UVMap"].data.foreach_get("uv", uvn); LU = uvn.reshape(-1, 3, 2).astype(float)
    a2 = np.abs((LU[:, 1, 0] - LU[:, 0, 0]) * (LU[:, 2, 1] - LU[:, 0, 1]) - (LU[:, 2, 0] - LU[:, 0, 0]) * (LU[:, 1, 1] - LU[:, 0, 1])) / 2
    rep["layout"] = {"unwrap": mode, "pack": packed, "islands": int(len(np.unique(isl))), "islands_keeping_the_binds_layout": int(len(np.unique(isl[inherit]))) if inherit.any() else 0, "used_share_of_square": round(float(a2.sum()), 3), "texels_per_mm_original_surface": round(float(np.sqrt(a2[scale_f == 1.0].sum() / max(a3[scale_f == 1.0].sum(), 1e-12))) * RES / 1000, 2), "outside_square": bool((LU.min() < -1e-4) or (LU.max() > 1 + 1e-4))}
    print("BAKE layout", json.dumps(rep["layout"]), flush=True)
    LTan, LSign = loop_tangents(lo)

    # ---- the bind: tangents, pieces, search trees
    hi = make_object("high", HV, HT, HCN, HU); HTan, HSign = loop_tangents(hi); hpiece_v = islands_of(len(HV), HT); hpiece = hpiece_v[HT[:, 0]]; lpiece = hpiece_v[keep[LT[:, 0]]]
    h_uvarea = np.abs((HU[:, 1, 0] - HU[:, 0, 0]) * (HU[:, 2, 1] - HU[:, 0, 1]) - (HU[:, 2, 0] - HU[:, 0, 0]) * (HU[:, 1, 1] - HU[:, 0, 1])) / 2; single = h_uvarea < 1e-10       # painted from a single texel
    HN = np.cross(HV[HT[:, 1]] - HV[HT[:, 0]], HV[HT[:, 2]] - HV[HT[:, 0]]); HN /= np.maximum(np.linalg.norm(HN, axis=1, keepdims=True), 1e-20)
    trees = {}; trees_shown = {}; h_gen = np.isin(HF, list(gen_ids)); l_gen_face = np.isin(LF, list(gen_ids))
    for pc in np.unique(lpiece):
        fi = np.nonzero(hpiece == pc)[0]; vi, inv = np.unique(HT[fi], return_inverse=True); trees[int(pc)] = (BVHTree.FromPolygons(HV[vi].tolist(), inv.reshape(-1, 3).tolist()), fi)
        # A piece of the bind is everything joined by shared vertices: a bracer, the cloth strip hung from its rim and the cuff the strip lands on are one piece.
        # A texel of surface that shows must never read surface that is hidden by design: a flattened bracer's texels near its rim lay nearer the strip than the
        # bracer and took its plain pale cloth (a white band round both wrists at 4,500 triangles, white flecks at 13,500). So faces of the character are
        # looked for among the piece's own faces of the character only.
        fs = fi[~h_gen[fi]]
        if len(fs) and len(fs) < len(fi): vi, inv = np.unique(HT[fs], return_inverse=True); trees_shown[int(pc)] = (BVHTree.FromPolygons(HV[vi].tolist(), inv.reshape(-1, 3).tolist()), fs)
        else: trees_shown[int(pc)] = trees[int(pc)]

    # ---- which texels belong to which face of the reduced mesh
    TY = []; TX = []; TF = []; TB = []
    for f in range(len(LT)):
        t = LU[f] * RES; mn = np.floor(t.min(0) - 1).astype(int); mx = np.ceil(t.max(0) + 1).astype(int); xs = np.arange(max(mn[0], 0), min(mx[0], RES - 1) + 1); ys = np.arange(max(mn[1], 0), min(mx[1], RES - 1) + 1)
        if len(xs) == 0 or len(ys) == 0: continue
        gx, gy = np.meshgrid(xs + 0.5, ys + 0.5); d = (t[1, 0] - t[0, 0]) * (t[2, 1] - t[0, 1]) - (t[2, 0] - t[0, 0]) * (t[1, 1] - t[0, 1])
        if abs(d) < 1e-9: continue
        b1 = ((gx - t[0, 0]) * (t[2, 1] - t[0, 1]) - (t[2, 0] - t[0, 0]) * (gy - t[0, 1])) / d; b2 = ((t[1, 0] - t[0, 0]) * (gy - t[0, 1]) - (gx - t[0, 0]) * (t[1, 1] - t[0, 1])) / d; b0 = 1 - b1 - b2
        tol = 0.75 / max(math.sqrt(abs(d)), 1e-6); ins = (b0 >= -tol) & (b1 >= -tol) & (b2 >= -tol)                                           # three quarters of a texel past the edge, so no texel on an island's rim is left out
        if not ins.any(): continue
        worst = np.minimum(np.minimum(b0, b1), b2)[ins]; TY.append(gy[ins].astype(int)); TX.append(gx[ins].astype(int)); TF.append(np.full(int(ins.sum()), f)); TB.append(np.stack([b0[ins], b1[ins], b2[ins], worst], 1))
    TY = np.concatenate(TY); TX = np.concatenate(TX); TF = np.concatenate(TF); TB = np.concatenate(TB)
    # a texel claimed by several faces goes to the one it is most inside
    order = np.lexsort((-TB[:, 3], TY * RES + TX)); TY, TX, TF, TB = TY[order], TX[order], TF[order], TB[order]; first = np.concatenate([[True], (TY[1:] * RES + TX[1:]) != (TY[:-1] * RES + TX[:-1])]); TY, TX, TF, TB = TY[first], TX[first], TF[first], TB[first, :3]
    bc = np.clip(TB, 0, None); bc /= bc.sum(1, keepdims=True); n_tex = len(TF); rep["texels_covered"] = int(n_tex); rep["texels_covered_share"] = round(n_tex / RES / RES, 3)
    P = np.einsum("tk,tkj->tj", bc, LV[LT[TF]]); NL = np.einsum("tk,tkj->tj", bc, LCN[TF]); NL /= np.maximum(np.linalg.norm(NL, axis=1, keepdims=True), 1e-20); TL = np.einsum("tk,tkj->tj", bc, LTan[TF]); SL = LSign[TF][:, 0]
    print("BAKE texels %d (%.0f%% of the square), %.0f s" % (n_tex, 100 * n_tex / RES / RES, time.time() - t0), flush=True)

    # ---- the bind's surface for each texel
    # "lookup": "normal" in the spec's bake entry (or HB_LOOKUP=normal): every texel is looked for along its own normal first, and takes the nearest point only
    # when nothing lies there. For a single-layer item whose relief the reduction has flattened (a shield's raised rim): the nearest point bends every edge of
    # the relief toward the flattened face, and the rim's painted border wavers; along the normal it stays where it is seen from the front. Not for a
    # layered character, where the next layer lies along the normal too.
    ALONG = (os.environ.get("HB_LOOKUP") or B.get("lookup", "nearest")) == "normal"; rep["lookup_mode"] = "normal" if ALONG else "nearest"
    hitf = np.full(n_tex, -1, np.int64); hitp = np.zeros((n_tex, 3)); how = np.zeros(n_tex, np.int8); tp = lpiece[TF]; same_way = 0
    for i in range(n_tex):
        tree, fi = (trees if l_gen_face[TF[i]] else trees_shown)[int(tp[i])]; pv = Vector(P[i].tolist()); loc, nrm, idx, dist = tree.find_nearest(pv, 0.03)
        if loc is None: continue
        gi = fi[idx]
        away = float(HN[gi] @ NL[i]) < 0.1
        if away or ALONG:                                                     # nearest surface faces the other way (or the spec asks for it throughout): look along the texel's own normal, both ways
            nv = Vector(NL[i].tolist()); best = None
            for o, dvec in ((pv + nv * 0.006, -nv), (pv - nv * 0.006, nv)):
                h = tree.ray_cast(o, dvec, 0.012)
                if h[0] is not None and float(HN[fi[h[2]]] @ NL[i]) >= 0.1:
                    dd = (h[0] - pv).length
                    if best is None or dd < best[0]: best = (dd, h[0], fi[h[2]])
            if best is None and away:                                          # nothing along the normal (the reduced face lies well off the bind's surface): the nearest surface facing the same way, wherever it is within 20 mm
                for l2, n2, i2, d2 in tree.find_nearest_range(pv, 0.02):
                    if float(HN[fi[i2]] @ NL[i]) >= 0.1 and (best is None or d2 < best[0]): best = (d2, l2, fi[i2])
            if best is not None: loc, gi = best[1], best[2]; how[i] = 1; same_way += 1
        hitf[i] = gi; hitp[i] = (loc.x, loc.y, loc.z)
    # ---- a class the bind paints from one texel throughout (the cloth under a cuff, a flat-coloured piece) is that texel on the reduction too, wherever its
    # faces now lie: a mouth's funnel (hb_reduce.py) is built in such a class and lies nowhere near the bind's faces of it
    # A class of the reduction that the bind does not have (a mouth's funnel) names the class it is painted as ("paint_as") and may be darker ("tone").
    one_texel = {}; _by = {c["name"]: k for k, c in nm.items()}; tone = np.ones(n_tex)
    for c in np.unique(LF):
        fi = np.nonzero(HF == _by.get(nm[int(c)].get("paint_as"), int(c)))[0]
        if len(fi) and single[fi].all() and float(np.abs(HU[fi].reshape(-1, 2) - HU[fi[0], 0]).max()) < 1e-6: one_texel[int(c)] = int(fi[0])
        if nm[int(c)].get("tone") is not None: tone[LF[TF] == c] = float(nm[int(c)]["tone"])
    if one_texel:
        lf_ = LF[TF]
        for c, f0 in one_texel.items(): m_ = lf_ == c; hitf[m_] = f0; hitp[m_] = HV[HT[f0]].mean(0)
    rep["classes_painted_from_one_texel"] = {nm[c]["name"]: int((LF[TF] == c).sum()) for c in one_texel}
    # ---- surface the bind keeps covered. The generator paints what it cannot see black: a plate under its strap, a sleeve under a bracer's edge. In the
    # bind the cover hides it to the last texel. A reduction moves every edge a little, and a sliver of that black would show beside the strap. So a texel
    # whose source lies on surface of the character that another piece covers at rest (the first thing met along its normal, within COVER_REACH, belongs to
    # another class) takes the nearest surface of its own class that is not covered instead: what shows is carried on under the cover.
    COVER_REACH = float(B.get("cover_reach", 0.010)); tree_all = BVHTree.FromPolygons(HV.tolist(), HT.tolist()); hcen = HV[HT].mean(1); covered = np.zeros(len(HT), bool); swapped = 0
    cls_hit = np.unique(HF[hitf[hitf >= 0]]); cand = np.nonzero(np.isin(HF, cls_hit) & ~single & ~np.isin(HF, list(gen_ids)))[0]
    for f in cand:
        h = tree_all.ray_cast(Vector((hcen[f] + HN[f] * 2e-5).tolist()), Vector(HN[f].tolist()), COVER_REACH)
        if h[0] is not None and HF[h[2]] != HF[f]: covered[f] = True
    # The same goes for any texel of the reduction that shows at rest but whose source in the bind does not: generated surface (a hidden face flattened until
    # it cuts through the plate over it), and surface of the character that the reduction has drawn in under a plate and that now shows through a gap the
    # plate has lost. Painted from its own source it is a dark wedge or a black hole. It is read from the nearest surface of the bind that shows, of any
    # class, within SHOW_NEAR: colour, ORM and normal. The wedge then looks like the plate it lies on.
    SHOW_REACH = float(B.get("show_reach", 0.03)); SHOW_NEAR = float(B.get("show_near", 0.012)); lin_ids = [k for k, c in nm.items() if c.get("lining_of") and (not c.get("skirt") or c.get("mouth"))]; l_shown = ~np.isin(LF, list(gen_ids)); same_cls = 0; shown_as = 0
    ls = np.nonzero(l_shown)[0]; low_shown = BVHTree.FromPolygons(LV.tolist(), LT[ls].tolist()); LNf = np.cross(LV[LT[:, 1]] - LV[LT[:, 0]], LV[LT[:, 2]] - LV[LT[:, 0]]); LNf /= np.maximum(np.linalg.norm(LNf, axis=1, keepdims=True), 1e-20)
    hs = np.nonzero(~np.isin(HF, list(gen_ids)) & ~single & ~covered)[0]; vi, inv = np.unique(HT[hs], return_inverse=True); bind_open = BVHTree.FromPolygons(HV[vi].tolist(), inv.reshape(-1, 3).tolist()); open_trees = {}
    hidden_face = np.isin(LF, list(gen_ids)) & ~np.isin(LF, lin_ids)                  # (a plate's lining and a mouth's funnel keep their own paint: they are seen from inside. A skirt under a rim does not: one that shows at rest showed as a pale band round the wrist)
    for i in np.nonzero((hitf >= 0) & (covered[np.maximum(hitf, 0)] | hidden_face[TF]))[0]:
        pv = Vector(P[i].tolist())
        if covered[hitf[i]]:
            c = int(HF[hitf[i]])
            if c not in open_trees:
                fi = np.nonzero((HF == c) & ~covered & ~single)[0]; open_trees[c] = None
                if len(fi): vi2, inv2 = np.unique(HT[fi], return_inverse=True); open_trees[c] = (BVHTree.FromPolygons(HV[vi2].tolist(), inv2.reshape(-1, 3).tolist()), fi)
            if open_trees[c] is not None:
                loc, nrm, idx, dd = open_trees[c][0].find_nearest(pv, 0.02)
                if loc is not None: hitf[i] = open_trees[c][1][idx]; hitp[i] = (loc.x, loc.y, loc.z); swapped += 1; same_cls += 1; continue
        nv = Vector(LNf[TF[i]].tolist())
        if low_shown.ray_cast(pv + nv * 2e-5, nv, SHOW_REACH)[0] is not None: continue           # something of the character lies over it at rest: it does not show
        loc, nrm, idx, dd = bind_open.find_nearest(pv, SHOW_NEAR)
        if loc is not None: hitf[i] = hs[idx]; hitp[i] = (loc.x, loc.y, loc.z); shown_as += 1
    rep["covered_sources"] = {"bind_faces_of_the_character_covered_at_rest": int(covered.sum()), "of": int(len(cand)), "texels_given_the_nearest_uncovered_surface_of_their_class": int(same_cls), "reach_mm": COVER_REACH * 1000}; print("BAKE covered", json.dumps(rep["covered_sources"]), flush=True)
    rep["hidden_surface_showing"] = {"texels_of_generated_surface": int(hidden_face[TF].sum()), "texels_showing_at_rest_with_a_source_that_does_not_and_painted_as_the_nearest_surface_that_does": int(shown_as), "reach_mm": SHOW_REACH * 1000, "nearest_within_mm": SHOW_NEAR * 1000}; print("BAKE hidden showing", json.dumps(rep["hidden_surface_showing"]), flush=True)
    ok = hitf >= 0; dist = np.linalg.norm(hitp - P, axis=1); rep["lookup"] = {"texels_without_source": int((~ok).sum()), "distance_mm_p50_p95_p99_max": [round(float(np.percentile(dist[ok], q)) * 1000, 2) for q in (50, 95, 99, 100)], "taken_along_the_normal_instead": int(same_way),
                                                                               "same_class_share": round(float((HF[hitf[ok]] == LF[TF[ok]]).mean()), 3)}
    print("BAKE lookup", json.dumps(rep["lookup"]), "%.0f s" % (time.time() - t0), flush=True)
    hf = np.where(ok, hitf, 0); A_, B_, C_ = HV[HT[hf, 0]], HV[HT[hf, 1]], HV[HT[hf, 2]]; v0, v1, v2 = B_ - A_, C_ - A_, hitp - A_; d00 = (v0 * v0).sum(1); d01 = (v0 * v1).sum(1); d11 = (v1 * v1).sum(1); d20 = (v2 * v0).sum(1); d21 = (v2 * v1).sum(1); den = np.maximum(d00 * d11 - d01 * d01, 1e-30)
    w1 = (d11 * d20 - d01 * d21) / den; w2 = (d00 * d21 - d01 * d20) / den; hb = np.clip(np.stack([1 - w1 - w2, w1, w2], 1), 0, 1); hb /= hb.sum(1, keepdims=True); huv = np.einsum("tk,tkj->tj", hb, HU[hf]); sg = single[hf]

    # ---- colour, ORM, normal
    def tex_file(k):
        for e in (".png", ".jpg", ".jpeg"):
            if os.path.exists(os.path.join(TEX, k + e)): return os.path.join(TEX, k + e)
        raise FileNotFoundError("no %s image in %s" % (k, TEX))
    col_full = load_image(tex_file("color")); orm_full = load_image(tex_file("orm")); nrm_full = load_image(tex_file("normal")); times = max(0, int(round(math.log2(col_full.shape[0] / RES))) - 1)
    col_s, orm_s, nrm_s = shrink(col_full, times), shrink(orm_full, times), shrink(nrm_full, times); del nrm_full; rep["source_images"] = {"size": int(col_full.shape[0]), "read_at": int(col_s.shape[0])}
    col = np.where(sg[:, None], nearest(col_full, huv), bilinear(col_s, huv)); orm = np.where(sg[:, None], nearest(orm_full, huv), bilinear(orm_s, huv)); col = col * tone[:, None]; ns = bilinear(nrm_s, huv) * 2 - 1; ns /= np.maximum(np.linalg.norm(ns, axis=1, keepdims=True), 1e-20)
    NHs = np.einsum("tk,tkj->tj", hb, HCN[hf]); NHs /= np.maximum(np.linalg.norm(NHs, axis=1, keepdims=True), 1e-20); THs = np.einsum("tk,tkj->tj", hb, HTan[hf]); THs -= NHs * (THs * NHs).sum(1, keepdims=True); tl = np.linalg.norm(THs, axis=1, keepdims=True); flat = sg | (tl[:, 0] < 1e-6) | ~np.isfinite(tl[:, 0])
    THs = THs / np.maximum(tl, 1e-20); BHs = np.cross(NHs, THs) * HSign[hf][:, :1]; NH = THs * ns[:, :1] + BHs * ns[:, 1:2] + NHs * ns[:, 2:3]; NH = np.where(flat[:, None], NHs, NH); NH /= np.maximum(np.linalg.norm(NH, axis=1, keepdims=True), 1e-20)
    TLo = TL - NL * (TL * NL).sum(1, keepdims=True); TLo /= np.maximum(np.linalg.norm(TLo, axis=1, keepdims=True), 1e-20); BLo = np.cross(NL, TLo) * SL[:, None]
    nt = np.stack([(NH * TLo).sum(1), (NH * BLo).sum(1), (NH * NL).sum(1)], 1); nt /= np.maximum(np.linalg.norm(nt, axis=1, keepdims=True), 1e-20)
    # A baked normal may lean at most TILT degrees from the reduced surface. Where the reduced face lies far off the bind's surface (a plate flattened at the
    # lower level of detail) the bind's normal there can stand at 80 degrees to it or behind it, and steel lit by such a normal renders black: a hole that is
    # not there. Detail worth carrying (a rivet, a rolled edge) leans far less. Past the limit the normal is turned back to it, keeping its heading.
    TILT = math.radians(float(B.get("normal_max_tilt", 50))); back = nt[:, 2] < math.cos(TILT); hz = np.linalg.norm(nt[:, :2], axis=1); head = nt[:, :2] / np.maximum(hz, 1e-9)[:, None]; nt[back, :2] = head[back] * math.sin(TILT); nt[back, 2] = math.cos(TILT)
    rep["normal_map"] = {"texels_with_no_source_normal_map": int(flat.sum()), "max_tilt_deg": round(math.degrees(TILT), 0), "texels_turned_back_to_it": int(back.sum()), "tilt_deg_p50_p95": [round(float(np.degrees(np.arccos(np.clip(np.percentile(nt[:, 2], q), -1, 1)))), 1) for q in (50, 5)]}
    # ORM: R occlusion kept; G roughness and B metallic corrected
    mx = col.max(1); sat = (mx - col.min(1)) / (mx + 1e-3); steel = (orm[:, 2] > RULE["steel_is"]["metallic_over"]) & (sat < RULE["steel_is"]["saturation_under"]) & ~np.isin(LF[TF], skin_ids); skin = np.isin(LF[TF], skin_ids)
    rough = np.where(steel, RULE["steel_roughness"][0] + RULE["steel_roughness"][1] * orm[:, 1], np.where(skin, RULE["skin_roughness"][0] + RULE["skin_roughness"][1] * orm[:, 1], RULE["other_roughness"][0] + RULE["other_roughness"][1] * orm[:, 1]))
    metal = np.where(steel, np.maximum(orm[:, 2], RULE["steel_metallic_min"]), np.minimum(orm[:, 2], RULE["other_metallic"]))
    if os.environ.get("HB_ORM") == "keep" or B.get("orm") == "keep": rough, metal = orm[:, 1], orm[:, 2]                                 # a source whose ORM is already corrected
    orm2 = np.stack([orm[:, 0], np.clip(rough, 0, 1), np.clip(metal, 0, 1)], 1)
    rep["orm"] = {"steel_texel_share": round(float(steel.mean()), 3), "roughness_mean_before_after": {"steel": [round(float(orm[steel, 1].mean()), 3), round(float(rough[steel].mean()), 3)] if steel.any() else None, "other": [round(float(orm[~steel, 1].mean()), 3), round(float(rough[~steel].mean()), 3)]},
                  "metallic_mean_before_after": {"steel": [round(float(orm[steel, 2].mean()), 3), round(float(metal[steel].mean()), 3)] if steel.any() else None, "other": [round(float(orm[~steel, 2].mean()), 3), round(float(metal[~steel].mean()), 3)]}}
    print("BAKE normal", json.dumps(rep["normal_map"])); print("BAKE orm", json.dumps(rep["orm"]), flush=True)

    # ---- into images, padded outward
    def compose(vals, fill):
        img = np.zeros((RES, RES, 3), np.float32); img[:] = fill; have = np.zeros((RES, RES), bool); img[TY[ok], TX[ok]] = vals[ok]; have[TY[ok], TX[ok]] = True
        for _ in range(int(B.get("padding_px", 8))):
            acc = np.zeros_like(img); cnt = np.zeros((RES, RES), np.float32)
            for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                sh = np.roll(have, (dy, dx), (0, 1)); si = np.roll(img, (dy, dx), (0, 1))
                if dy == 1: sh[0, :] = False
                if dy == -1: sh[-1, :] = False
                if dx == 1: sh[:, 0] = False
                if dx == -1: sh[:, -1] = False
                acc += si * sh[:, :, None]; cnt += sh
            new = (~have) & (cnt > 0); img[new] = acc[new] / cnt[new][:, None]; have |= new
        return img
    out = os.path.join(p(*os.environ["HB_OUTDIR"].split("/")) if os.environ.get("HB_OUTDIR") else WORK, "baked-%s" % name); imgs = {"color": compose(col, (0.2, 0.15, 0.12)), "orm": compose(orm2, (1.0, 0.8, 0.0)), "normal": compose(nt * 0.5 + 0.5, (0.5, 0.5, 1.0))}
    for k, a in imgs.items():
        im = bpy.data.images.new("b_" + k, RES, RES, alpha=False, float_buffer=False); im.colorspace_settings.name = "sRGB" if k == "color" else "Non-Color"
        rgba = np.concatenate([np.clip(a, 0, 1), np.ones((RES, RES, 1), np.float32)], 2); im.pixels[:] = rgba.ravel(); im.filepath_raw = out + "-%s.png" % k; im.file_format = "PNG"; im.save()
    tang = np.concatenate([LTan, LSign[:, :, None]], 2)
    extra = {k: ld[k] for k in ("ride", "ride_cls") if k in ld.files}
    np.savez_compressed(out + ".npz", V=LV, tris=LT, W=ld["W"], cls=ld["cls"], fcls=LF, CN=LCN.astype(np.float16), keep=keep, uv=LU.astype(np.float32), tangent=tang.astype(np.float32), **extra)
    lmeta["bake"] = rep; json.dump(lmeta, open(out + ".json", "w"), indent=1); print("BAKE_DONE %s: %d faces, %d texels, %.0f s" % (out, len(LT), n_tex, time.time() - t0), flush=True)
