"""Validate and export the saved workshop source, without rebuilding its geometry."""

import hashlib
import math
import sys
from pathlib import Path
import bpy

source = Path(bpy.data.filepath).resolve()
output = Path(sys.argv[sys.argv.index("--") + 1]).resolve()
if source.parent.name != "workshops" or source.suffix != ".blend":
    raise ValueError("Open a packed workshop source before export")
if output.is_relative_to(Path(__file__).resolve().parents[4]):
    raise ValueError(
        "Export to an external build directory before reviewing deliveries"
    )
scene = bpy.context.scene
for name, expected in [
    (scene["conceptPainting"], scene["conceptSha256"]),
    ("painted-surfaces.png", scene["surfaceSha256"]),
]:
    if hashlib.sha256((source.parent / name).read_bytes()).hexdigest() != expected:
        raise ValueError(
            f"{name}: source painting changed; review and rebuild the source"
        )
objects = list(bpy.data.collections["WORKSHOP_DELIVERY"].objects)
if len(objects) != 1 or objects[0].type != "MESH":
    raise ValueError("Workshop delivery must be one consolidated static mesh")
model = objects[0]
triangles = sum(len(face.vertices) - 2 for face in model.data.polygons)
if not 1000 <= triangles <= 6250:
    raise ValueError(
        f"{triangles} triangles: match the shipped hut family ceiling (6250)"
    )
for vertex in model.data.vertices:
    x, y, z = model.matrix_world @ vertex.co
    if z < -0.031 or any(
        x * math.cos(i * math.pi / 3) + y * math.sin(i * math.pi / 3)
        > math.sqrt(3) / 2 + 0.001
        for i in range(6)
    ):
        raise ValueError(
            f"{model.name}: vertex {(x,y,z)} outside the radius-one hex or ground skirt"
        )
for image in bpy.data.images:
    if image.users and not image.packed_file:
        raise ValueError(f"{image.name}: pack the texture in the editable source")
model["workshopSourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
model["workshopConceptSha256"] = scene["conceptSha256"]
bpy.ops.object.select_all(action="DESELECT")
model.select_set(True)
bpy.context.view_layer.objects.active = model
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
)
print(f"Exported {source.name}: {triangles} triangles")
