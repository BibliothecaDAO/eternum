"""Derive the cleared-site study from the shipped camp's authored standard."""

import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

APP = Path(__file__).resolve().parents[2]
output = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
if bpy.app.version[:2] != (5, 2):
    raise ValueError("Use Blender 5.2 for the packed camp source")
if output.is_relative_to(APP.parents[1]) or output.suffix != ".glb":
    raise ValueError("Export a raw .glb outside the checkout, then compress and review it")
source = APP / "asset-sources/outposts/camp.blend"
bpy.ops.wm.open_mainfile(filepath=str(source))

# Match the authored pieces to the baked delivery, retaining UVs, normals and tint.
parts = [
    obj for obj in bpy.data.collections["OUTPOST_EDITABLE"].objects
    if obj.name.startswith(("Command pennant", "Standard ", "Embroidered rays"))
]
if len(parts) != 11:
    raise ValueError("The camp standard changed; inspect its authored pieces before deriving it")

def position_key(vector):
    return tuple(round(value, 5) for value in vector)

positions = {position_key(obj.matrix_world @ vertex.co) for obj in parts for vertex in obj.data.vertices}
pole = next(obj for obj in parts if obj.name == "Standard pole")
centre = sum((pole.matrix_world @ v.co for v in pole.data.vertices), Vector()) / len(pole.data.vertices)
kept = []
for obj in list(bpy.data.collections["OUTPOST_PRODUCTION"].objects):
    mesh = bmesh.new()
    mesh.from_mesh(obj.data)
    bmesh.ops.delete(mesh, geom=[v for v in mesh.verts if position_key(obj.matrix_world @ v.co) not in positions], context="VERTS")
    mesh.to_mesh(obj.data)
    mesh.free()
    if not obj.data.polygons:
        continue
    # The origin remains the tile centre. The standard sits on its rear edge.
    for vertex in obj.data.vertices:
        vertex.co.x = (vertex.co.x - centre.x) * 1.1 - 0.18
        vertex.co.y = (vertex.co.y - centre.y) * 1.1 + 0.58
        vertex.co.z *= 0.82
        x, y, z = vertex.co
        if math.hypot(x, y) < 0.45 or any(
            x * math.cos(side * math.pi / 3) + y * math.sin(side * math.pi / 3) > math.sqrt(3) / 2
            for side in range(6)
        ):
            raise ValueError("Keep the standard inside its hex and outside the centre's 0.45 radius")
    kept.append(obj)

for obj in list(bpy.data.objects):
    if obj not in kept:
        bpy.data.objects.remove(obj, do_unlink=True)
for obj in kept:
    obj.hide_set(False)
    obj.hide_render = False
    obj.select_set(True)
bpy.context.view_layer.objects.active = kept[0]
bpy.context.scene["sourceArtwork"] = "asset-sources/outposts/camp.blend"
bpy.context.scene["purpose"] = "Cleared-site lab study; rear-edge standard with the tile centre open"
triangles = sum(len(face.vertices) - 2 for obj in kept for face in obj.data.polygons)
if not 100 <= triangles <= 500:
    raise ValueError(f"Unexpected standard extraction: {triangles} triangles")
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=str(output.with_suffix(".blend")))
bpy.ops.export_scene.gltf(
    filepath=str(output), export_format="GLB", use_selection=True,
    export_yup=True, export_extras=True, export_attributes=True,
    export_materials="EXPORT", export_vertex_color="ACTIVE",
    export_animations=False, export_cameras=False, export_lights=False,
)
output.with_suffix(".json").write_text(json.dumps({"triangles": triangles, "pieces": [obj.name for obj in kept]}, indent=2))
