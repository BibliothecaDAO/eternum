"""A stationary stone socket, orbiting obelisks and a spherical essence portal."""

import json
import math
import random
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "settlements"))
from settlement_geometry import (
    block, mesh, bake_instance_transforms, consolidate_static_materials, export_glb,
)
from town_architecture import palette
from stone_textures import bake_limestone

SOURCE = ROOT / ".context/ethereal-layer/spire"
OUTPUT = ROOT / "apps/game/public/models/ethereal/spire.glb"


def build_spire():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    materials = palette()
    stone = bake_limestone(materials["stone_light"], SOURCE)
    build_socket(stone)
    for side in [-1, 1]:
        build_obelisk(side, stone, materials["teal"])
    finish_stone(stone)
    build_portal(materials["purple"])
    bake_instance_transforms()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "spire.blend"))
    consolidate_static_materials()
    export_glb(OUTPUT)
    write_report()


def build_socket(stone):
    # A hollow dressed-stone socket and irregular buttresses leave the ground visible around the feet.
    vertices = []
    for radius, height in [(0.58, 0.08), (0.56, 0.29), (0.31, 0.29), (0.31, 0.08)]:
        vertices.extend((math.cos(i * math.tau / 12) * radius,
                         math.sin(i * math.tau / 12) * radius, height) for i in range(12))
    faces = [(ring + i, ring + (i + 1) % 12, (ring + 12) % 48 + (i + 1) % 12,
              (ring + 12) % 48 + i) for ring in (0, 12, 24, 36) for i in range(12)]
    socket = mesh("Fixed stone socket", vertices, faces, stone)
    bevel_edges(socket, 0.012)
    for side in [-1, 1]:
        for front in [-1, 1]:
            x, y = side * 0.53, front * 0.20
            vertices = [(x + dx, y + dy, z) for dx, dy, z in [
                (-0.19, -0.18, 0.03), (0.19, -0.18, 0.03), (0.19, 0.18, 0.03), (-0.19, 0.18, 0.03),
                (-0.13, -0.15, 0.38), (0.14, -0.13, 0.40), (0.12, 0.14, 0.39), (-0.15, 0.12, 0.36),
            ]]
            foot = mesh("Worn socket buttress", vertices,
                        [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], stone)
            bevel_edges(foot, 0.025)
        block("Worn entrance step", (0, side * 0.44, 0.095), (0.69, 0.20, 0.16), stone, 0.02)


def bevel_edges(obj, width):
    modifier = obj.modifiers.new("Chipped stone edges", "BEVEL")
    modifier.width = width
    modifier.segments = 1
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier.name)


def finish_stone(stone):
    """Authored facet and cavity tones retain legibility under the game's strong ambient fill."""
    rng = random.Random(35)
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.data.materials[0] != stone:
            continue
        colors = obj.data.color_attributes.new(name="Stone wear", type="BYTE_COLOR", domain="CORNER")
        for face in obj.data.polygons:
            tone = rng.uniform(0.83, 0.99)
            if obj.name.startswith("Carved limestone face"):
                tone = 0.45 if face.index >= 8 else (1 if face.index >= 4 else 0.92)
            elif face.area < 0.007:
                tone = 1
            for loop in face.loop_indices:
                colors.data[loop].color = (tone, tone * 0.96, tone * 0.86, 1)


def blade_ring(side, height, center, width, depth, seam=0):
    cross_section = [(-1, -0.58), (-0.67, -1), (0.68, -1), (1, -0.45), (1, 0.55), (0.4, 1), (-0.7, 1), (-1, 0.4)]
    return [
        (side * (center + x * width), y * depth, height + seam * math.sin(i * 2.1 + height))
        for i, (x, y) in enumerate(cross_section)
    ]


def build_obelisk(side, stone, teal):
    # Real chamfered facets and uneven joints supply the silhouette; pores stay in the shared texture.
    rings = [
        (0.55, 0.68, 0.014, 0.015),
        (0.91, 0.78, 0.19, 0.15),
        (1.21, 0.80, 0.21, 0.17),
        (1.56, 0.75, 0.165, 0.145),
        (1.97, 0.69, 0.12, 0.105),
        (2.32, 0.63, 0.072, 0.064),
        (2.64, 0.59, 0.003, 0.004),
    ]
    for index in range(len(rings) - 1):
        low, high = rings[index], rings[index + 1]
        a = blade_ring(side, low[0] + (0.003 if index else 0), *low[1:], 0.055)
        b = blade_ring(side, high[0] - 0.003, *high[1:], 0.055)
        engraved = 1 <= index <= 4
        faces = [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8)
                 for i in range(8) if not (engraved and i == 7)]
        if engraved:
            for face_index in (7,):
                corners = [a[face_index], a[(face_index + 1) % 8], b[(face_index + 1) % 8], b[face_index]]
                build_engraved_face(corners, side, stone, teal)
        vertices = a + b
        faces += [tuple(range(7, -1, -1)), tuple(range(8, 16))]
        if index == 0:
            vertices = [(side * low[1], 0, low[0])] + b
            faces = [(0, (i + 1) % 8 + 1, i + 1) for i in range(8)] + [tuple(range(1, 9))]
        elif index == len(rings) - 2:
            vertices = a + [(side * high[1], 0, high[0])]
            faces = [(i, (i + 1) % 8, 8) for i in range(8)] + [tuple(range(7, -1, -1))]
        if side < 0:
            faces = [tuple(reversed(face)) for face in faces]
        section = mesh("Orbiting stone", vertices, faces, stone)
        section["spirePart"] = "orbit"
        modifier = section.modifiers.new("Chipped joint edges", "BEVEL")
        modifier.width = 0.009
        modifier.segments = 1
        bpy.context.view_layer.objects.active = section
        bpy.ops.object.modifier_apply(modifier=modifier.name)


def build_engraved_face(corners, side, stone, teal):
    """Carve the face around a recessed inlay, including stone lips and dark side walls."""
    points = [Vector(point) for point in corners]
    normal = (points[1] - points[0]).cross(points[3] - points[0]).normalized() * side

    def point(u, v, depth=0):
        return tuple(points[0].lerp(points[1], u).lerp(points[3].lerp(points[2], u), v) - normal * depth)

    # Each perimeter travels in the same direction as the original face.
    outer = [tuple(p) for p in points]
    lip = [point(u, v) for u, v in [(0.35, 0.025), (0.65, 0.025), (0.65, 0.975), (0.35, 0.975)]]
    bevel = [point(u, v, 0.008) for u, v in [(0.39, 0.045), (0.61, 0.045), (0.61, 0.955), (0.39, 0.955)]]
    floor = [tuple(Vector(p) - normal * 0.016) for p in bevel]
    vertices = outer + lip + bevel + floor
    faces = [(ring + i, ring + (i + 1) % 4, ring + (i + 1) % 4 + 4, ring + i + 4)
             for ring in (0, 4, 8) for i in range(4)]
    if side < 0:
        faces = [tuple(reversed(face)) for face in faces]
    surround = mesh("Carved limestone face", vertices, faces, stone)
    surround["spirePart"] = "orbit"
    inlay = mesh("Recessed refined essence", floor, [(0, 1, 2, 3) if side > 0 else (3, 2, 1, 0)], teal)
    inlay["spirePart"] = "orbit"


def build_portal(purple):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=20, radius=0.48, location=(0, 0, 1.36))
    orb = bpy.context.object
    orb.name = "Spherical raw essence portal"
    orb.data.materials.append(purple)
    orb["spirePart"] = "portal"
    for face in orb.data.polygons:
        face.use_smooth = True


def write_report():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    report = {
        "triangles": sum(sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in meshes),
        "drawParts": len(meshes),
        "uncompressedBytes": OUTPUT.stat().st_size,
        "textureSize": 512,
        "portalRadius": 0.48,
        "minimumBladeRadius": 0.585,
        "maximumBladeRadius": 1.025,
        "height": 2.64,
        "stationaryBase": True,
    }
    (SOURCE / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    build_spire()
