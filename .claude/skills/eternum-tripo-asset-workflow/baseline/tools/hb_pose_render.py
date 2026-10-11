"""Render a bound mesh in harness poses (linear blend skinning done here in numpy, not by a Blender armature).
env: HB_BOUND (npz path under human-baseline), HB_POSES (comma list of ids; 'rom:...' or '<set>:<id>'), HB_TAG, HB_VIEWS,
HB_COLS, HB_RES, HB_HELPERS (comma list: add helper joints with derived weights), HB_TEX (blend with the textured mesh),
HB_OUTDIR (output folder under human-baseline; default review/poses), HB_CELL (sheet cell size in pixels, default 300),
HB_BOX (x0,y0,z0,x1,y1,z1 framing box in metres; default the whole figure), HB_FOCUS (a joint name: frame a cube
centred on that joint where the pose puts it, half-side HB_FOCUS_SIZE metres, default 0.08; for joint close-ups),
HB_ONE_SIDED (default 1: back faces are not drawn, as in the game; 0 draws both sides), HB_GEAR (a gear-fit.json from
hb_gear.py: equipment drawn on its sockets; HB_GEAR_SKIP: comma list of items to leave off)."""
import bpy, os, sys, json
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_render as R
from hb_sheet import sheet
bound = p(*os.environ.get("HB_BOUND", "template/template.npz").split("/")); tag = os.environ.get("HB_TAG", "tpl")
V, tris, W, rig, cls, classes = HN.load_bound(bound)
import hb_helpers as HH
rig, W = HH.add_helpers(V, W, rig, os.environ.get("HB_HELPERS", "").split(","), cls, classes)
want = os.environ.get("HB_POSES", "rom:elbow-90,rom:elbow-140,rom:knee-135,rom:arm-p0-e90,rom:arm-p90-e90,rom:arm-p0-e170,rom:arm-rot80-hang,rom:pron80,rom:hip-flex90,rom:hip-abd45,rom:squat,rom:seated-ride,rom:spine-twist45,rom:spine-flex60,rom:head-yaw75,rom:kneel").split(",")
allp = {("rom", q["id"]): q for q in H.rom_poses()}
for s in ("general", "knight", "crossbowman", "paladin"):
    for q in H.load_pose_sets(p("poses"), [s]): allp[(s, q["id"])] = q
TEX = os.environ.get("HB_TEX"); texmat = None; BAKED = os.environ.get("HB_BAKED")
if TEX:
    bpy.ops.wm.open_mainfile(filepath=p(*TEX.split("/"))); src = bpy.data.objects["HB_char"]; texmat = src.data.materials[0]; texmat.use_fake_user = True
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
else: bpy.ops.wm.read_factory_settings(use_empty=True)
if BAKED:
    # a baked character (hb_bake.py): HB_BAKED is the files' common stem under human-baseline, e.g. ../x/work/baked-near; its
    # three maps make the one material, read as a game reads them (colour sRGB, ORM and normal as data)
    texmat = bpy.data.materials.new("baked"); texmat.use_nodes = True; nt_ = texmat.node_tree; bs_ = next(n for n in nt_.nodes if n.type == "BSDF_PRINCIPLED")
    def _img(kind, cs):
        n_ = nt_.nodes.new("ShaderNodeTexImage"); n_.image = bpy.data.images.load(p(*(BAKED + "-%s.png" % kind).split("/"))); n_.image.colorspace_settings.name = cs; return n_
    nt_.links.new(_img("color", "sRGB").outputs["Color"], bs_.inputs["Base Color"]); o_ = _img("orm", "Non-Color"); sp_ = nt_.nodes.new("ShaderNodeSeparateColor"); nt_.links.new(o_.outputs["Color"], sp_.inputs["Color"]); nt_.links.new(sp_.outputs["Green"], bs_.inputs["Roughness"]); nt_.links.new(sp_.outputs["Blue"], bs_.inputs["Metallic"])
    nm_ = nt_.nodes.new("ShaderNodeNormalMap"); nt_.links.new(_img("normal", "Non-Color").outputs["Color"], nm_.inputs["Color"]); nt_.links.new(nm_.outputs["Normal"], bs_.inputs["Normal"])
R.setup_scene(int(os.environ.get("HB_RES", "600")))
me = bpy.data.meshes.new("posed"); me.from_pydata(V.tolist(), [], tris.tolist()); me.update()
for pl in me.polygons: pl.use_smooth = True
# authored normals, skinned with each pose as a game skins them (HB_NORMALS=0: let Blender recompute them per pose, which
# draws a dark line along every cut). A bind made before 2026-10-06 has none stored; they are derived here the same way.
_bz = np.load(bound); CN = None
if os.environ.get("HB_NORMALS", "1") == "1" and "fcls" in _bz.files and classes:
    CN = _bz["CN"].astype(float) if "CN" in _bz.files else H.corner_normals(V, tris, _bz["fcls"], classes)
ob = bpy.data.objects.new("posed", me); bpy.context.scene.collection.objects.link(ob)
if texmat is not None:
    raw = np.load(bound); uv = raw["uv"]; fc = raw["fcls"]; ul = me.uv_layers.new(name="UVMap"); ul.data.foreach_set("uv", uv.reshape(-1, 2).ravel().astype(np.float32))
    dark = bpy.data.materials.new("underlay"); dark.use_nodes = True; b_ = next(n for n in dark.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); b_.inputs["Base Color"].default_value = (0.06, 0.05, 0.045, 1); b_.inputs["Roughness"].default_value = 0.9
    me.materials.append(texmat); me.materials.append(dark); mi = np.zeros(len(fc), np.int32)
    for k_, c_ in classes.items():                                   # classes without texture of their own: flat colour (underlay dark by default)
        if c_["name"] == "underlay" and not c_.get("textured"): mi[fc == int(k_)] = 1
        elif c_.get("flat"):
            fm = bpy.data.materials.new("flat_" + c_["name"]); fm.use_nodes = True; fb = next(n for n in fm.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); fb.inputs["Base Color"].default_value = (*c_.get("colour", (0.1, 0.1, 0.1)), 1); fb.inputs["Roughness"].default_value = 0.9
            me.materials.append(fm); mi[fc == int(k_)] = len(me.materials) - 1
    me.polygons.foreach_set("material_index", mi)
elif cls is not None and classes:
    cols = {}
    for cid, c in classes.items():
        m = bpy.data.materials.new(c["name"]); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); b.inputs["Base Color"].default_value = (*c.get("colour", (0.7, 0.7, 0.7)), 1); b.inputs["Roughness"].default_value = 0.7
        me.materials.append(m); cols[int(cid)] = len(me.materials) - 1
    fc = cls[tris]; 
    for pl, row in zip(me.polygons, fc):
        vals, cnt = np.unique(row, return_counts=True); pl.material_index = cols.get(int(vals[np.argmax(cnt)]), 0)
else:
    me.materials.append(R.clay_material())
# equipment on its sockets (HB_GEAR: a gear-fit.json written by hb_gear.py, path under human-baseline): each item is its
# own object with its own material and follows its joint rigidly
GEAR = []
if os.environ.get("HB_GEAR"):
    for gn_, gi_ in json.load(open(p(*os.environ["HB_GEAR"].split("/"))))["items"].items():
        if gn_ in os.environ.get("HB_GEAR_SKIP", "").split(","): continue
        with bpy.data.libraries.load(p(*gi_["blend"].split("/")), link=False) as (src_, dst_): dst_.objects = [gi_["object"]]
        go_ = dst_.objects[0]; bpy.context.scene.collection.objects.link(go_); GEAR.append((go_, np.array(gi_["rest_matrix"], float), gi_["joint"]))
if os.environ.get("HB_ONE_SIDED", "1") == "1":                                       # front faces only, as the game draws them (HB_ONE_SIDED=0: both sides)
    for m_ in me.materials: R.one_sided(m_)
idx, val = H.dense_to_top4(W); views = os.environ.get("HB_VIEWS", "rt-three-quarter,rt-left").split(","); out = p(*os.environ["HB_OUTDIR"].split("/")) if os.environ.get("HB_OUTDIR") else p("review", "poses"); os.makedirs(out, exist_ok=True); paths = []
box = (__import__("mathutils").Vector((-0.30, -0.30, 0.0)), __import__("mathutils").Vector((0.30, 0.30, 0.66)))
for w_ in want:
    s, i = w_.split(":"); q = allp.get((s, i))
    foc = None
    Np = CN
    if s == "rest": Vp = V.copy(); foc = rig["rest"][rig["names"].index(os.environ["HB_FOCUS"])].copy() if os.environ.get("HB_FOCUS") else None   # 'rest:rest' renders the mesh as bound, unposed
    elif q is None: print("MISSING", w_); continue
    else:
        A, P = H.solve_pose(rig, q["targets"]); Vp = H.skin(V, idx, val, rig, A, P); dz_ = min(0.0, Vp[:, 2].min()) if "seat" not in q.get("support", []) else 0.0; Vp[:, 2] -= dz_
        if os.environ.get("HB_FOCUS"): foc = np.array(P[rig["names"].index(os.environ["HB_FOCUS"])], float); foc[2] -= dz_
        if CN is not None: Np = H.skin_normals(CN, tris, idx, val, A)
    me.vertices.foreach_set("co", Vp.ravel()); me.update()
    if Np is not None: me.normals_split_custom_set(Np.reshape(-1, 3).tolist()); me.update()
    for go_, M_, jn_ in GEAR:
        from mathutils import Matrix as _M
        Mp_ = M_.copy()
        if s != "rest":
            j_ = rig["names"].index(jn_); Mp_[:3, :3] = A[j_] @ M_[:3, :3]; Mp_[:3, 3] = A[j_] @ (M_[:3, 3] - rig["rest"][j_]) + P[j_]; Mp_[2, 3] -= dz_
        go_.matrix_world = _M(Mp_.tolist())
    for v in views:
        bx = os.environ.get("HB_BOX"); from mathutils import Vector as _V
        hs_ = float(os.environ.get("HB_FOCUS_SIZE", "0.08"))
        R.frame((_V((foc - hs_).tolist()), _V((foc + hs_).tolist())) if foc is not None else ((_V([float(x) for x in bx.split(",")[:3]]), _V([float(x) for x in bx.split(",")[3:]])) if bx else [ob] + [g_[0] for g_ in GEAR]), R.VIEWS[v], pad=1.08); fp = os.path.join(out, f"{tag}-{s}-{i}-{v}.png"); R.render(fp); paths.append(fp)
sheet(paths, int(os.environ.get("HB_COLS", "8")), int(os.environ.get("HB_CELL", "300")), os.path.join(out, f"SHEET-{tag}.png")); print("POSE_SHEET", os.path.join(out, f"SHEET-{tag}.png"), len(paths))
