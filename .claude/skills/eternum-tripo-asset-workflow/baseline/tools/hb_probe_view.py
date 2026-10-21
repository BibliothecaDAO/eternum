"""Probe review: Tripo segmentation parts (flat colour per part) and the Tripo auto-rig skeleton (joint positions)."""
import bpy, os, sys, json
import numpy as np
from mathutils import Vector
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_render as R
from hb_sheet import sheet
import glob
OUT = p("probe", "review"); os.makedirs(OUT, exist_ok=True)
seg = glob.glob(p("probe", "segment-v2", "tripo-out", "*", "model.glb"))[0]; rigf = glob.glob(p("probe", "rig-mixamo", "tripo-out", "*", "model.glb"))[0]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=seg)
parts = [o for o in bpy.data.objects if o.type == "MESH"]; rep = {"parts": []}
COL = [(0.9, 0.1, 0.1), (0.1, 0.7, 0.1), (0.15, 0.3, 0.95), (0.95, 0.8, 0.1), (0.9, 0.2, 0.9), (0.1, 0.85, 0.85), (1.0, 0.5, 0.0), (0.5, 0.25, 0.05), (0.6, 0.6, 0.6), (0.3, 0.0, 0.5), (0.0, 0.4, 0.2), (1, 1, 1)]
R.setup_scene(1000)
for i, o in enumerate(sorted(parts, key=lambda o: o.name)):
    P = np.array([o.matrix_world @ v.co for v in o.data.vertices]); be = sum(1 for e in o.data.edges if False)
    import bmesh
    bm = bmesh.new(); bm.from_mesh(o.data); bnd = sum(1 for e in bm.edges if e.is_boundary); bm.free()
    rep["parts"].append({"name": o.name, "tris": len(o.data.polygons), "min": P.min(0).round(3).tolist(), "max": P.max(0).round(3).tolist(), "boundary_edges": bnd, "colour": COL[i % len(COL)]})
paths = []
for v in ("front", "three-quarter", "back", "left"):
    R.frame(parts, R.VIEWS[v] if v in R.VIEWS else R.VIEWS["front"]); fp = os.path.join(OUT, f"seg-tex-{v}.png"); R.render(fp); paths.append(fp)
for i, o in enumerate(sorted(parts, key=lambda o: o.name)):
    m = bpy.data.materials.new(f"flat{i}"); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); b.inputs["Base Color"].default_value = (*COL[i % len(COL)], 1); b.inputs["Roughness"].default_value = 0.8
    o.data.materials.clear(); o.data.materials.append(m)
for v in ("front", "three-quarter", "back", "left"):
    R.frame(parts, R.VIEWS[v]); fp = os.path.join(OUT, f"seg-flat-{v}.png"); R.render(fp); paths.append(fp)
sheet(paths, 4, 500, os.path.join(OUT, "SHEET-tripo-segment.png"))
# rig
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=rigf)
arm = next(o for o in bpy.data.objects if o.type == "ARMATURE"); me = next(o for o in bpy.data.objects if o.type == "MESH")
rep["rig"] = {b.name: {"parent": b.parent.name if b.parent else None, "head": [round(x, 4) for x in (arm.matrix_world @ b.head_local)], "tail": [round(x, 4) for x in (arm.matrix_world @ b.tail_local)]} for b in arm.data.bones}
P = np.array([me.matrix_world @ v.co for v in me.data.vertices]); rep["rig_mesh_bounds"] = [P.min(0).round(3).tolist(), P.max(0).round(3).tolist()]
ninf = [sum(1 for g in v.groups if g.weight > 1e-4) for v in me.data.vertices]; rep["rig_influences_max"] = max(ninf); rep["rig_groups"] = [g.name for g in me.vertex_groups]
json.dump(rep, open(os.path.join(OUT, "probe.json"), "w"), indent=1)
for q in rep["parts"]: print("PART", q)
for k, v in rep["rig"].items(): print("BONE", k, v)
print("RIGMESH", rep["rig_mesh_bounds"], rep["rig_influences_max"])
