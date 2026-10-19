"""Open the ruined court around the full-size beasts, retaining the perimeter masonry."""

import math
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


def widen_courtyard(source, output):
    if source.resolve() == output.resolve():
        raise ValueError("Keep the input source separate from the revised source")
    bpy.ops.wm.open_mainfile(filepath=str(source))
    for collection_name in ["OUTPOST_EDITABLE", "OUTPOST_PRODUCTION"]:
        for obj in list(bpy.data.collections[collection_name].objects):
            if obj.type == "MESH":
                open_masonry(obj)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(output), compress=True)


def open_masonry(obj):
    geometry = bmesh.new()
    geometry.from_mesh(obj.data)
    remaining = set(geometry.verts)
    removed = []
    while remaining:
        island = connected_stone(remaining)
        points = [obj.matrix_world @ vertex.co for vertex in island]
        center = sum(points, Vector()) / len(points)
        if center.xy.length < 0.55 and max(point.z for point in points) < 0.12:
            removed.extend(island)
        else:
            for vertex in island:
                vertex.co = obj.matrix_world.inverted() @ widen_position(obj.matrix_world @ vertex.co)
    bmesh.ops.delete(geometry, geom=removed, context="VERTS")
    geometry.to_mesh(obj.data)
    geometry.free()
    obj.data.update()


def widen_position(point):
    point.x *= 1.18
    point.y *= 1.18
    projection = max(
        abs(point.x * math.cos(side * math.pi / 3) + point.y * math.sin(side * math.pi / 3))
        for side in range(3)
    )
    if projection > 0.85:
        point.x *= 0.85 / projection
        point.y *= 0.85 / projection
    return point


def connected_stone(remaining):
    island = {remaining.pop()}
    pending = list(island)
    while pending:
        for edge in pending.pop().link_edges:
            for vertex in edge.verts:
                if vertex in remaining:
                    remaining.remove(vertex)
                    island.add(vertex)
                    pending.append(vertex)
    return island


if __name__ == "__main__":
    source, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
    widen_courtyard(source, output)
