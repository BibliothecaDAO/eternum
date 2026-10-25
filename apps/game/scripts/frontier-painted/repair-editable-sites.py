"""Restore runtime parts from the uncompressed deliveries, without rebaking their painted architecture.

    blender --background --python repair-editable-sites.py -- <editable-source-directory> <fresh-output-directory>

The rift's painted emission mask weights its surge; stone, the tile edge and the ground remain fixed.
Run optimize-outpost.mjs and stamp-source.mjs on the output before replacing the delivery.
Repaired inputs are copied unchanged when run again.
"""

import importlib.util
import math
import shutil
import sys
from pathlib import Path

import bpy
import numpy as np
from bpy_extras import anim_utils
from mathutils import Vector

spec = importlib.util.spec_from_file_location("painted_export", Path(__file__).with_name("export-painted-building.py"))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)


def animate_rift(architecture):
    mesh = architecture.data
    shader = exporter.principled(architecture.active_material)
    image = shader.inputs["Emission Color"].links[0].from_node.image
    pixels = exporter.pixels(image)
    height, width = pixels.shape[:2]
    mask = np.zeros(len(mesh.vertices))
    for loop in mesh.loops:
        u, v = mesh.uv_layers.active.data[loop.index].uv
        colour = pixels[min(height - 1, int(v * height)), min(width - 1, int(u * width)), :3]
        mask[loop.vertex_index] = max(mask[loop.vertex_index], float(max(colour)))
    # UV seams duplicate vertices. Give coincident vertices exactly the same weight so a surge cannot split a seam.
    weights = {}
    for vertex in mesh.vertices:
        key = tuple(round(c, 5) for c in vertex.co)
        weights[key] = max(weights.get(key, 0), mask[vertex.index])
    rest = [vertex.co.copy() for vertex in mesh.vertices]
    architecture.shape_key_add(name="rest")
    targets = []
    for step in range(1, 8):
        phase = step * math.tau / 8
        target = architecture.shape_key_add(name=f"surge {step}")
        for index, point in enumerate(rest):
            x, y, z = point
            emission = weights[tuple(round(c, 5) for c in point)]
            weight = max(0, min(1, (emission - 0.06) / 0.3))
            weight *= max(0, min(1, (z - 0.035) / 0.045))
            weight *= max(0, min(1, (0.75 - math.hypot(x, y)) / 0.12))
            surge = 0.045 * (math.sin(phase + y * 6) - math.sin(y * 6)) + 0.035 * (1 - math.cos(phase))
            target.data[index].co = point + Vector((0.012 * math.sin(phase), 0, surge)) * weight
        targets.append(target)
    for step in range(9):
        for index, target in enumerate(targets, 1):
            target.value = float(index == step)
            target.keyframe_insert("value", frame=1 + step * 12)
    animation = mesh.shape_keys.animation_data
    animation.action.name = "rift-surge"
    for curve in anim_utils.action_get_channelbag_for_slot(animation.action, animation.action_slot).fcurves:
        for key in curve.keyframe_points:
            key.interpolation = "LINEAR"


def repair(source, output, building):
    path = source / f"{building}.glb"
    exporter.load_master(path)
    architecture = next(obj for obj in bpy.context.scene.objects if obj.get("frontierPart") == "architecture")
    target = output / path.name
    if architecture.get("runtimeSiteRepair") == 1:
        shutil.copyfile(path, target)
        return
    animate_rift(architecture)
    architecture["runtimeSiteRepair"] = 1
    runtime = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    exporter.write_runtime(runtime, building, target)


if __name__ == "__main__":
    source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
    output.mkdir(parents=True, exist_ok=False)
    repair(source, output, "essence-rift")
