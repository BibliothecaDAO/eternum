"""Render the Knight as the game poses it, with the baseline's renderer, so game and approved poses can be compared at
the same framing. Takes a skeleton dump from the game (bones' world position and quaternion per moment, game axes),
skins the bound model with those joints and draws the gear on its sockets, as hb_pose_render.py does for library poses.

Run inside Blender (background): HB_BOUND, HB_TEX, HB_GEAR, HB_HELPERS, HB_VIEWS, HB_RES, HB_OUTDIR as hb_pose_render.py;
K4_DUMP (the dump's absolute path); K4_SAMPLES (comma list of sample labels, default all); K4_APPROVED (optional:
comma list of "<sample>=<pose id>" pairs; the approved pose is rendered beside the sample in the same views)."""
import bpy, os, sys, json
import numpy as np
from mathutils import Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
TOOLS = next((t for t in (os.path.join(HERE, "..", "..", "tools"), os.path.join(HERE, "..", "..", "..", "human-baseline", "tools")) if os.path.isfile(os.path.join(t, "hb_lib.py"))), None)
if TOOLS is None: raise SystemExit("the baseline's tools were not found beside this script")
sys.path.insert(0, os.path.normpath(TOOLS))
from hb_common import p
import hb_lib as H, hb_harness as HN, hb_helpers as HH, hb_render as R
from hb_export import C
from hb_sheet import sheet


def q2m(q):
    x, y, z, w = [float(v) for v in q]; n = (x * x + y * y + z * z + w * w) ** 0.5; x, y, z, w = x / n, y / n, z / n, w / n
    return np.array([[1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w)],
                     [2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w)],
                     [2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)]])


bound = p(*os.environ["HB_BOUND"].split("/")); V, tris, W, rig, cls, classes = HN.load_bound(bound)
rig, W = HH.add_helpers(V, W, rig, [h for h in os.environ.get("HB_HELPERS", "elbow_half,knee_half,upperarm_twist").split(",") if h], cls, classes)
names = list(rig["names"]); rest = np.array(rig["rest"], float)
dump = json.load(open(os.environ["K4_DUMP"])); samples = {s["label"]: s for s in dump["samples"]}
want = [w for w in os.environ.get("K4_SAMPLES", ",".join(samples)).split(",") if w]
beside = dict(pair.split("=") for pair in os.environ.get("K4_APPROVED", "").split(",") if "=" in pair)
library = {q["id"]: q for q in H.load_pose_sets(p("poses"), ["knight"])}

TEX = os.environ.get("HB_TEX"); texmat = None
if TEX:
    bpy.ops.wm.open_mainfile(filepath=p(*TEX.split("/"))); src = bpy.data.objects["HB_char"]; texmat = src.data.materials[0]; texmat.use_fake_user = True
    for o in list(bpy.data.objects): bpy.data.objects.remove(o)
else: bpy.ops.wm.read_factory_settings(use_empty=True)
R.setup_scene(int(os.environ.get("HB_RES", "600")))
me = bpy.data.meshes.new("posed"); me.from_pydata(V.tolist(), [], tris.tolist()); me.update()
for pl in me.polygons: pl.use_smooth = True
_bz = np.load(bound); CN = None
if "fcls" in _bz.files and classes: CN = _bz["CN"].astype(float) if "CN" in _bz.files else H.corner_normals(V, tris, _bz["fcls"], classes)
ob = bpy.data.objects.new("posed", me); bpy.context.scene.collection.objects.link(ob)
if texmat is not None:
    raw = np.load(bound); uv = raw["uv"]; fc = raw["fcls"]; ul = me.uv_layers.new(name="UVMap"); ul.data.foreach_set("uv", uv.reshape(-1, 2).ravel().astype(np.float32))
    dark = bpy.data.materials.new("underlay"); dark.use_nodes = True; b_ = next(n for n in dark.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); b_.inputs["Base Color"].default_value = (0.06, 0.05, 0.045, 1)
    me.materials.append(texmat); me.materials.append(dark); mi = np.zeros(len(fc), np.int32)
    for k_, c_ in classes.items():
        if c_["name"] == "underlay" and not c_.get("textured"): mi[fc == int(k_)] = 1
    me.polygons.foreach_set("material_index", mi)
else: me.materials.append(R.clay_material())
GEAR = []
if os.environ.get("HB_GEAR"):
    for gn_, gi_ in json.load(open(p(*os.environ["HB_GEAR"].split("/"))))["items"].items():
        with bpy.data.libraries.load(p(*gi_["blend"].split("/")), link=False) as (src_, dst_): dst_.objects = [gi_["object"]]
        go_ = dst_.objects[0]; bpy.context.scene.collection.objects.link(go_); GEAR.append((go_, np.array(gi_["rest_matrix"], float), gi_["joint"]))
for m_ in me.materials: R.one_sided(m_)
idx, val = H.dense_to_top4(W); views = os.environ.get("HB_VIEWS", "rt-three-quarter,rt-back-right").split(",")
out = p(*os.environ["HB_OUTDIR"].split("/")) if os.environ.get("HB_OUTDIR") else p("review", "game-poses"); os.makedirs(out, exist_ok=True)
tag = os.environ.get("HB_TAG", "game")


def show(label, A, P):
    Vp = H.skin(V, idx, val, rig, A, P); dz_ = min(0.0, Vp[:, 2].min()); Vp[:, 2] -= dz_
    me.vertices.foreach_set("co", Vp.ravel()); me.update()
    if CN is not None: me.normals_split_custom_set(H.skin_normals(CN, tris, idx, val, A).reshape(-1, 3).tolist()); me.update()
    for go_, M_, jn_ in GEAR:
        j_ = names.index(jn_); Mp_ = M_.copy(); Mp_[:3, :3] = A[j_] @ M_[:3, :3]; Mp_[:3, 3] = A[j_] @ (M_[:3, 3] - rest[j_]) + P[j_]; Mp_[2, 3] -= dz_
        go_.matrix_world = Matrix(Mp_.tolist())
    paths = []
    for v in views:
        R.frame([ob] + [g_[0] for g_ in GEAR], R.VIEWS[v]); path = os.path.join(out, "%s-%s-%s.png" % (tag, label, v)); R.render(path); paths.append(path)
    print("RENDERED", label, "lowest sole before grounding %.4f" % dz_); return paths


paths = []
for label in want:
    s = samples[label]; A = np.zeros((len(names), 3, 3)); P = np.zeros((len(names), 3))
    for n, b in zip(dump["names"], s["bones"]):
        j = names.index(n); A[j] = C.T @ q2m(b["q"]) @ C; P[j] = C.T @ np.array(b["p"], float)
    paths += show(label, A, P)
    if label in beside:
        A_, P_ = H.solve_pose(rig, library[beside[label]]["targets"]); paths += show("approved-" + beside[label], A_, P_)
cols = len(views) * (2 if beside else 1)
sheet(paths, cols, int(os.environ.get("HB_CELL", "400")), os.path.join(out, "SHEET-%s.png" % tag)); print("GAME_POSE_SHEET", os.path.join(out, "SHEET-%s.png" % tag), len(paths))
