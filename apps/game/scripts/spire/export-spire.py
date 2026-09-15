"""Blender 5.2: export only the authored production collection, retaining its hierarchy."""
import sys
from pathlib import Path

import bpy

APP = Path(__file__).resolve().parents[2]
SOURCE = APP / "asset-sources/ethereal/spire/spire.blend"
OUTPUT = APP / "public/models/ethereal/spire.glb"
if "--" in sys.argv:
    arguments = sys.argv[sys.argv.index("--") + 1:]
    if arguments:
        OUTPUT = Path(arguments[0]).resolve()

if Path(bpy.data.filepath).resolve() != SOURCE.resolve():
    raise RuntimeError(f"Open {SOURCE} before running this export script")
scene = bpy.context.scene
collection = bpy.data.collections["SPIRE_V2_PRODUCTION"]
objects = list(collection.objects)
assert len(objects) == 44 and sum(obj.type == "MESH" for obj in objects) == 25
assert all(obj.get("spirePart") != "base" for obj in objects), "Terrain owns the landmark base"
scene.frame_start, scene.frame_end, scene.render.fps = 1, 241, 30
scene.frame_set(1)
# Scene properties from the review session otherwise become animation extras.
# Object extras carry the actual runtime semantics and are retained.
for key in list(scene.keys()):
    del scene[key]
bpy.ops.object.select_all(action="DESELECT")
for obj in objects:
    obj.select_set(True)
bpy.context.view_layer.objects.active = next(obj for obj in objects if obj.type == "MESH")
OUTPUT.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=str(OUTPUT), export_format="GLB", use_selection=True,
    export_yup=True, export_extras=True, export_materials="EXPORT",
    export_vertex_color="ACTIVE", export_all_vertex_colors=False,
    export_animations=True, export_animation_mode="SCENE", export_anim_scene_split_object=False,
    export_nla_strips_merged_animation_name="Spire_Loop", export_frame_range=True,
    export_anim_slide_to_zero=True, export_force_sampling=True, export_frame_step=1,
    export_cameras=False, export_lights=False, export_morph=False,
    export_draco_mesh_compression_enable=False,
)
print(f"Exported {OUTPUT}; run pnpm --dir apps/game optimize:spire next.")
