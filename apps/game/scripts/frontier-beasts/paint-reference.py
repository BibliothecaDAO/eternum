"""Render aligned front/back paint guides; the same projection is used by the sculpt's material."""

import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
sculpt = next(obj for obj in scene.objects if obj.type == "MESH")
back = sculpt.copy()
back.data = sculpt.data
scene.collection.objects.link(back)
sculpt.location.x = -1
back.location.x = 1
back.rotation_euler.z = math.pi
bpy.ops.object.camera_add(location=(0, -8, 0.9))
camera = bpy.context.object
camera.rotation_euler = (
    (Vector((0, 0, 0.9)) - camera.location).to_track_quat("-Z", "Y").to_euler()
)
camera.data.type = "ORTHO"
camera.data.ortho_scale = 4
scene.camera = camera
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.render.threads_mode = "FIXED"
scene.render.threads = 2
scene.render.resolution_x = 2048
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.world = bpy.data.worlds.new("Neutral paint light")
scene.world.use_nodes = True
scene.world.node_tree.nodes["Background"].inputs[0].default_value = (0.5, 0.5, 0.5, 1)
scene.world.node_tree.nodes["Background"].inputs[1].default_value = 0.8
for location, power, size in [((0, -4, 5), 450, 5), ((3, 2, 3), 180, 4)]:
    bpy.ops.object.light_add(type="AREA", location=location)
    lamp = bpy.context.object
    lamp.data.energy = power
    lamp.data.shape = "DISK"
    lamp.data.size = size
    lamp.rotation_euler = (
        (Vector((0, 0, 0.8)) - lamp.location).to_track_quat("-Z", "Y").to_euler()
    )
scene.view_settings.view_transform = "Standard"
scene.render.filepath = str(output)
bpy.ops.render.render(write_still=True)
