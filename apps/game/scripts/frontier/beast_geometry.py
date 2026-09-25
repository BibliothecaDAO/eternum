"""Connected creature volumes, tapered limbs and small facial details."""

import math

import bpy
from mathutils import Vector

from frontier_geometry import mesh


def ellipsoid(name, center, size, material, segments=16, rings=10):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    return obj


def tapered_limb(name, start, end, start_radius, end_radius, material, sides=10):
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cone_add(
        vertices=sides, radius1=start_radius, radius2=end_radius,
        depth=direction.length, location=(Vector(start) + Vector(end)) / 2,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(material)
    return obj


def curved_limb(name, centers, radii, material, sides=12):
    vertices = []
    for index, center in enumerate(centers):
        previous = Vector(centers[max(index - 1, 0)])
        following = Vector(centers[min(index + 1, len(centers) - 1)])
        tangent = (following - previous).normalized()
        across = tangent.cross(Vector((0, 1, 0)))
        if across.length < 0.01:
            across = tangent.cross(Vector((1, 0, 0)))
        across.normalize()
        up = tangent.cross(across).normalized()
        for side in range(sides):
            angle = side * math.tau / sides
            point = Vector(center) + radii[index] * (across * math.cos(angle) + up * math.sin(angle))
            vertices.append(tuple(point))
    faces = [tuple(reversed(range(sides)))]
    for index in range(len(centers) - 1):
        for side in range(sides):
            a = index * sides + side
            b = index * sides + (side + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple((len(centers) - 1) * sides + side for side in range(sides)))
    return mesh(name, vertices, faces, material)


def fuse_anatomy(material, voxel_size=0.015):
    parts = [
        obj for obj in bpy.context.scene.objects
        if obj.type == "MESH" and obj.data.materials[0] == material
    ]
    bpy.ops.object.select_all(action="DESELECT")
    for part in parts:
        part.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    body = parts[0]
    body.name = "Connected beast anatomy"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    remesh = body.modifiers.new("Joined anatomy", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = voxel_size
    bpy.ops.object.modifier_apply(modifier=remesh.name)
    simplify = body.modifiers.new("Broad sculpted planes", "DECIMATE")
    simplify.ratio = 0.45
    bpy.ops.object.modifier_apply(modifier=simplify.name)
    # Remeshing changes topology, so provide a fresh packed UV map for the grain bake.
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.015)
    bpy.ops.object.mode_set(mode="OBJECT")
    return body
