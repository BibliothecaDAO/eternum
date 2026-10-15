"""Export a packed outpost source to an external build directory."""

import math
import sys
from pathlib import Path

import bpy

APP = Path(__file__).resolve().parents[2]
ROOT = APP.parents[1]
output = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
if output.is_relative_to(ROOT):
    raise ValueError("Export raw GLBs outside the checkout before compression and verification")
source = Path(bpy.data.filepath).resolve()
if source.parent != (APP / "asset-sources/outposts").resolve():
    raise ValueError("Open the packed outpost source before exporting")
collection = bpy.data.collections["OUTPOST_PRODUCTION"]
objects = list(collection.objects)
if not objects or any(obj.type != "MESH" for obj in objects):
    raise ValueError("Production collection must contain static meshes")
triangles = sum(len(face.vertices) - 2 for obj in objects for face in obj.data.polygons)
if not 500 <= triangles <= 6296:
    raise ValueError(
        f"{triangles} triangles exceed the small-landmark budget; revise construction"
    )
for obj in objects:
    for vertex in obj.data.vertices:
        x, y, z = obj.matrix_world @ vertex.co
        if z < -0.031 or any(
            x * math.cos(i * math.pi / 3) + y * math.sin(i * math.pi / 3)
            > math.sqrt(3) / 2 + 0.00001
            for i in range(6)
        ):
            raise ValueError(
                f"{obj.name}: geometry leaves the radius-one hex or contact skirt"
            )
for image in bpy.data.images:
    if not image.packed_file:
        raise ValueError(f"Pack texture {image.name} before export")
bpy.ops.object.select_all(action="DESELECT")
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = objects[0]
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(output),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_extras=True,
    export_materials="EXPORT",
    export_vertex_color="ACTIVE",
    export_all_vertex_colors=False,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_morph=False,
    export_draco_mesh_compression_enable=False,
)
print(f"Exported {source.name} to {output}")
