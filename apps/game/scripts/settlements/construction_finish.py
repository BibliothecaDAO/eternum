"""Consistent stone scale, restrained edge wear and tier-specific craftsmanship."""

import math
import random
import bpy
from mathutils import Vector, noise

from construction_styles import STYLES


ROOF_TINTS = {
    "roof": (0.38, 0.15, 0.065),
    "slate": (0.08, 0.16, 0.23),
    "teal_roof": (0.055, 0.23, 0.24),
}


def finish_construction(materials, tier):
    style = STYLES[tier]
    tints = {
        materials["stone"]: (1, 1, 1),
        materials["stone_light"]: (style.coping_tint,) * 3,
        materials["stone_dark"]: (0.42, 0.40, 0.35),
        **{materials[key]: tint for key, tint in ROOF_TINTS.items()},
    }
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH" or obj.data.materials[0] not in tints:
            continue
        apply_construction_uvs(obj)
        apply_facet_shading(obj, tints[obj.data.materials[0]], style.facet_min)
        wear_construction_edges(obj, style.edge_wear)


def apply_construction_uvs(obj):
    world = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
    low = Vector(tuple(min(point[i] for point in world) for i in range(3)))
    high = Vector(tuple(max(point[i] for point in world) for i in range(3)))
    center = (low + high) / 2
    cylindrical = "tower masonry" in obj.name or "conical roof" in obj.name or "swept roof" in obj.name
    radius = (high.x - low.x + high.y - low.y) / 4
    uv = obj.data.uv_layers.active or obj.data.uv_layers.new(name="UVMap")
    for face in obj.data.polygons:
        normal = obj.matrix_world.to_3x3() @ face.normal
        axes = projection_axes(normal)
        points = [world[obj.data.loops[i].vertex_index] for i in face.loop_indices]
        angles = [math.atan2(point.y - center.y, point.x - center.x) for point in points]
        wraps = max(angles) - min(angles) > math.pi
        for loop, point, angle in zip(face.loop_indices, points, angles):
            if cylindrical and axes != (0, 1):
                angle += math.tau if wraps and angle < 0 else 0
                uv.data[loop].uv = (angle * radius, point.z)
            else:
                uv.data[loop].uv = (point[axes[0]], point[axes[1]])


def projection_axes(normal):
    if abs(normal.z) > 0.85:
        return (0, 1)
    return (1, 2) if abs(normal.x) > abs(normal.y) else (0, 2)


def apply_facet_shading(obj, tint, minimum):
    rng = random.Random(obj.name)
    colors = obj.data.color_attributes.new(name="Construction finish", type="BYTE_COLOR", domain="CORNER")
    obj.data.color_attributes.active_color = colors
    for face in obj.data.polygons:
        tone = 1 if face.area < 0.007 else rng.uniform(minimum, 1)
        for loop in face.loop_indices:
            colors.data[loop].color = (*(channel * tone for channel in tint), 1)


def wear_construction_edges(obj, amount):
    matrix, inverse = obj.matrix_world, obj.matrix_world.inverted()
    for vertex in obj.data.vertices:
        point = matrix @ vertex.co
        # Shared positions receive the same displacement so adjoining stones remain fitted.
        displacement = noise.noise_vector(point * 9.7) * amount + noise.noise_vector(point * 31.3) * amount / 2
        vertex.co = inverse @ (point + displacement)
    obj.data.update()
