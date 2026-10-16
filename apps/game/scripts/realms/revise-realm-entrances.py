"""Revise the packed Forum and Twin Ward entrances without rebuilding their architecture."""

import json
from pathlib import Path

import bmesh
import bpy


def point_key(point):
    return tuple(round(value, 6) for value in point)


def entrance_point(name, point, kingdom):
    point = point.copy()
    if name.startswith("Twin Ward / portal /"):
        center = -0.3492 if point.x < 0 else 0.3492
        point.x = center + (point.x - center) * 1.45
        point.z = 0.16 + (point.z - 0.16) * 1.38
    elif name.startswith("Stair / Twin Ward / entry"):
        center = -0.3492 if point.x < 0 else 0.3492
        point.x = center + (point.x - center) * 1.2
    elif name.startswith("Forum / main door"):
        point.x *= 1.6
        point.z = 0.615 + (point.z - 0.615) * 1.21
    elif name.startswith("Gate /"):
        point.x *= 1.8
        point.y += 0.06
        if name.startswith("Gate / carved entry"):
            point.z = 0.055 + (point.z - 0.025) * (1.36 if kingdom else 1.16)
        elif name.startswith(("Gate / recessed oak door", "Gate / door plank seam")):
            point.z = 0.055 + (point.z - 0.01) * ((0.50 if kingdom else 0.43) / 0.36)
        elif name == "Gate / lintel":
            point.z = (0.61 if kingdom else 0.52) + (point.z - 0.4) * (
                0.11 / 0.32 if kingdom else 0.4
            )
    elif name == "Order / gate":
        point.x *= 0.06 / 0.095
        point.y += 0.06
        point.z = (0.63 if kingdom else 0.54) + (
            point.z - (0.58 if kingdom else 0.46)
        ) * (0.06 / 0.095)
    return point


def remove_detail(obj, kingdom):
    if not kingdom:
        return obj.name.startswith(
            ("Order / wall banner", "Banner / wall crossbar", "Banner / wall anchor")
        )
    if "glassPigment" in obj:
        return True
    window = any(
        part in obj.name for part in (" / recessed window", " / carved reveal")
    )
    return (
        window
        and not obj.name.startswith("Twin Ward / portal /")
        and max(v.co.z for v in obj.data.vertices) < 0.7
    )


def revise():
    source = Path(bpy.data.filepath)
    if source.name not in {"citadel-terraced-forum.blend", "citadel-twin-ward.blend"}:
        raise ValueError("Open the packed Terrace Forum or Twin Ward source")
    kingdom = source.name == "citadel-twin-ward.blend"
    marker = "wardEntranceRevision" if kingdom else "forumEntranceRevision"
    if bpy.context.scene.get(marker) == 21:
        print("Entrance revision is already applied")
        return
    editable = bpy.data.collections["CITADEL_EDITABLE"]
    production = bpy.data.collections["CITADEL_PRODUCTION"]
    removed = [obj for obj in editable.objects if remove_detail(obj, kingdom)]
    removed_points = {point_key(v.co) for obj in removed for v in obj.data.vertices}
    changes = {}
    for obj in editable.objects:
        if obj in removed or not obj.name.startswith(
            (
                "Forum / main door",
                "Twin Ward / portal /",
                "Stair / Twin Ward / entry",
                "Gate /",
                "Order / gate",
            )
        ):
            continue
        for vertex in obj.data.vertices:
            old = point_key(vertex.co)
            vertex.co = entrance_point(obj.name, vertex.co, kingdom)
            changes[old] = vertex.co.copy()
        obj.data.update()
    for obj in production.objects:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.delete(
            bm,
            geom=[v for v in bm.verts if point_key(v.co) in removed_points],
            context="VERTS",
        )
        for vertex in bm.verts:
            replacement = changes.get(point_key(vertex.co))
            if replacement is not None:
                vertex.co = replacement
        bm.to_mesh(obj.data)
        bm.free()
        obj.data.update()
    removed_names = [obj.name for obj in removed]
    for obj in removed:
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.context.scene[marker] = 21
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
    print(
        json.dumps({"removedDetails": removed_names, "editedPositions": len(changes)})
    )


revise()
