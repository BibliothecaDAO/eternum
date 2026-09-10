"""Build the four reward studies in Blender; retain editable parts and export GLBs.

Run with Blender --background --python apps/game/scripts/reward-tiles/build-reward-tiles.py.
Coordinates use a one-metre circumradius hex, matching the game terrain exactly.
"""

import json
import math
import random
import struct
from itertools import pairwise
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "apps/game/public/models/reward-tiles"
ART = ROOT / ".context/model-lab/reward-tiles"
TEXTURES = Path(__file__).with_name("textures")
TAU = math.tau
RNG = random.Random(731)
MATERIALS = {}
COLLECTION = None


def material(name, color, metallic=0, roughness=0.5, texture=None, emission=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metallic
    shader.inputs["Roughness"].default_value = roughness
    if texture:
        image = bpy.data.images.load(str(TEXTURES / texture), check_existing=True)
        node = mat.node_tree.nodes.new("ShaderNodeTexImage")
        node.image = image
        tint = mat.node_tree.nodes.new("ShaderNodeMixRGB")
        tint.blend_type = "MULTIPLY"
        tint.inputs[0].default_value = 1
        tint.inputs[2].default_value = (*color, 1)
        mat.node_tree.links.new(node.outputs["Color"], tint.inputs[1])
        mat.node_tree.links.new(tint.outputs[0], shader.inputs["Base Color"])
    if emission:
        shader.inputs["Emission Color"].default_value = (*color, 1)
        shader.inputs["Emission Strength"].default_value = emission
    MATERIALS[name] = mat
    return mat


def create_materials():
    material("Rose gold", (0.68, 0.30, 0.105), 0.8, 0.28)
    material("Polished bevels", (0.96, 0.62, 0.28), 0.78, 0.22)
    material("Recessed bronze", (0.20, 0.075, 0.03), 0.72, 0.42)
    material("Purple enamel", (0.75, 0.60, 1.0), 0.04, 0.62, "purple-enamel.png")
    material("Crimson lacquer", (1.0, 0.70, 0.70), 0.18, 0.3, "crimson-lacquer.png")
    material("Dark timber", (0.19, 0.10, 0.045), 0, 0.67, "crimson-lacquer.png")
    material("Slate", (0.29, 0.34, 0.42), 0.04, 0.87, "slate.png")
    material("Slate edges", (0.11, 0.14, 0.19), 0, 0.9)
    material("Earth", (0.13, 0.075, 0.041), 0, 1)
    material("Dry cavity", (0.036, 0.022, 0.052), 0, 0.91)
    material("Cyan crystal", (0.012, 0.47, 0.72), 0.37, 0.15, emission=0.45)
    material("Crystal highlight", (0.17, 0.82, 0.94), 0.25, 0.14, emission=0.7)
    material("Emerald", (0.013, 0.22, 0.064), 0.32, 0.17, emission=0.1)
    material("Essence deep", (0.11, 0.006, 0.26), 0.3, 0.22, emission=0.7)
    material("Essence violet", (0.34, 0.012, 0.85), 0.1, 0.28, emission=2.2)
    material("Essence core", (0.76, 0.16, 1.0), 0, 0.3, emission=3.5)
    veil = material("Essence veil", (0.44, 0.025, 0.90), 0, 0.35, emission=1.7)
    veil.node_tree.nodes.get("Principled BSDF").inputs["Alpha"].default_value = 0.48
    veil.surface_render_method = "BLENDED"
    material("Warm magic", (1.0, 0.47, 0.06), 0, 0.3, emission=3)


def empty(name, parent=None):
    obj = bpy.data.objects.new(name, None)
    COLLECTION.objects.link(obj)
    obj.parent = parent
    return obj


def mesh(name, vertices, faces, mat, parent, bevel=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    COLLECTION.objects.link(obj)
    obj.parent = parent
    if mat:
        data.materials.append(MATERIALS[mat])
    uv = data.uv_layers.new(name="Surface")
    for polygon in data.polygons:
        normal = polygon.normal
        axis = max(range(3), key=lambda i: abs(normal[i]))
        axes = [i for i in range(3) if i != axis]
        for loop in polygon.loop_indices:
            co = data.vertices[data.loops[loop].vertex_index].co
            uv.data[loop].uv = (co[axes[0]] * 0.72 + 0.31, co[axes[1]] * 0.72 + 0.27)
    if bevel:
        modifier = obj.modifiers.new("Hand-finished edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier = obj.modifiers.new("Weighted corner normals", "WEIGHTED_NORMAL")
        modifier.keep_sharp = True
    return obj


def box(name, pos, size, mat, parent, bevel=0.008):
    x, y, z = size
    vertices = [
        (a * x / 2 + pos[0], b * y / 2 + pos[1], c * z / 2 + pos[2])
        for a, b, c in [
            (-1, -1, -1),
            (1, -1, -1),
            (1, 1, -1),
            (-1, 1, -1),
            (-1, -1, 1),
            (1, -1, 1),
            (1, 1, 1),
            (-1, 1, 1),
        ]
    ]
    return mesh(
        name,
        vertices,
        [
            (3, 2, 1, 0),
            (0, 1, 5, 4),
            (1, 2, 6, 5),
            (2, 3, 7, 6),
            (3, 0, 4, 7),
            (4, 5, 6, 7),
        ],
        mat,
        parent,
        bevel,
    )


def prism(name, polygon, bottom, top, mat, parent, bevel=0.008):
    n = len(polygon)
    vertices = [(x, y, bottom) for x, y in polygon] + [(x, y, top) for x, y in polygon]
    faces = [tuple(range(n - 1, -1, -1)), tuple(range(n, n * 2))]
    faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
    return mesh(name, vertices, faces, mat, parent, bevel)


def chip_stone_outline(polygon):
    chipped = []
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        chipped.append(a)
        length = math.dist(a, b)
        if length < 0.16:
            continue
        for t in (0.32, 0.68):
            x = a[0] + (b[0] - a[0]) * t
            y = a[1] + (b[1] - a[1]) * t
            boundary = max(
                x * math.cos(i * TAU / 6) + y * math.sin(i * TAU / 6) for i in range(6)
            )
            amount = (
                0 if boundary > math.sqrt(3) / 2 - 0.015 else RNG.uniform(0.002, 0.022)
            )
            chipped.append(
                (
                    x - (b[1] - a[1]) / length * amount,
                    y + (b[0] - a[0]) / length * amount,
                )
            )
    return chipped


def tube(name, points, radius, mat, parent, cyclic=False):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = radius
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, value in zip(spline.points, points):
        point.co = (*value, 1)
    spline.use_cyclic_u = cyclic
    obj = bpy.data.objects.new(name, curve)
    COLLECTION.objects.link(obj)
    obj.parent = parent
    curve.materials.append(MATERIALS[mat])
    return obj


def ring(
    name,
    center,
    radius,
    thickness,
    mat,
    parent,
    axis="Z",
    start=0,
    end=TAU,
    segments=64,
):
    points = []
    for i in range(segments + 1):
        angle = start + (end - start) * i / segments
        a, b = radius * math.cos(angle), radius * math.sin(angle)
        offset = (a, b, 0) if axis == "Z" else (0, a, b) if axis == "X" else (a, 0, b)
        points.append(tuple(center[j] + offset[j] for j in range(3)))
    return tube(name, points, thickness, mat, parent)


def crystal(name, center, size, mat, parent, axis="Z"):
    x, y, z = size
    vertices = [
        (0, 0, z / 2),
        (0, 0, -z / 2),
        (x / 2, 0, 0),
        (0, y / 2, 0),
        (-x / 2, 0, 0),
        (0, -y / 2, 0),
    ]
    if axis == "Y":
        vertices = [(a, c, b) for a, b, c in vertices]
    vertices = [tuple(v[j] + center[j] for j in range(3)) for v in vertices]
    obj = mesh(
        name,
        vertices,
        [
            (0, 2, 3),
            (0, 3, 4),
            (0, 4, 5),
            (0, 5, 2),
            (1, 3, 2),
            (1, 4, 3),
            (1, 5, 4),
            (1, 2, 5),
        ],
        mat,
        parent,
    )
    if mat == "Cyan crystal":
        obj.data.materials.append(MATERIALS["Crystal highlight"])
        obj.data.polygons[2].material_index = 1
        obj.data.polygons[7].material_index = 1
    return obj


def octagon(width, depth, chamfer):
    x, y, c = width / 2, depth / 2, chamfer
    return [
        (-x + c, -y),
        (x - c, -y),
        (x, -y + c),
        (x, y - c),
        (x - c, y),
        (-x + c, y),
        (-x, y - c),
        (-x, -y + c),
    ]


def contour(name, polygon, z, radius, mat, parent):
    return tube(name, [(x, y, z) for x, y in polygon], radius, mat, parent, True)


def hexagon(radius=1):
    return [
        (
            radius * math.cos(math.pi / 6 + i * TAU / 6),
            radius * math.sin(math.pi / 6 + i * TAU / 6),
        )
        for i in range(6)
    ]


def clip(polygon, normal, distance):
    result = []
    for a, b in zip(polygon, polygon[1:] + polygon[:1]):
        da = sum(a[i] * normal[i] for i in range(2)) - distance
        db = sum(b[i] * normal[i] for i in range(2)) - distance
        if da <= 1e-8:
            result.append(a)
        if (da < 0) != (db < 0):
            t = da / (da - db)
            result.append(tuple(a[i] + (b[i] - a[i]) * t for i in range(2)))
    return result


def stone_cells(boundary, seeds, parent, bottom=0.015, height=0.14, prefix="Slate"):
    for index, a in enumerate(seeds):
        cell = boundary[:]
        for b in seeds:
            if a == b:
                continue
            cell = clip(
                cell,
                (b[0] - a[0], b[1] - a[1]),
                (b[0] ** 2 + b[1] ** 2 - a[0] ** 2 - a[1] ** 2) / 2,
            )
            if len(cell) < 3:
                break
        if len(cell) < 3:
            continue
        cx = sum(p[0] for p in cell) / len(cell)
        cy = sum(p[1] for p in cell) / len(cell)
        # Preserve the six external boundaries; fine joints only separate internal stones.
        inset = [(x + (cx - x) * 0.012, y + (cy - y) * 0.012) for x, y in cell]
        top = height + RNG.uniform(-0.012, 0.012)
        obj = prism(
            f"{prefix} {index:02}",
            chip_stone_outline(inset),
            bottom,
            top,
            "Slate",
            parent,
            0.013,
        )
        if height > 0.1:
            for vertex in obj.data.vertices:
                if vertex.co.z > bottom + 0.01:
                    vertex.co.z += RNG.uniform(-0.025, 0.025)
        obj.data.materials.append(MATERIALS["Slate edges"])
        for face in obj.data.polygons:
            if face.normal.z < 0.5:
                face.material_index = 1


def build_tile(parent, paved=True):
    prism("Hex foundation", hexagon(), -0.16, 0, "Earth", parent, 0.006)
    if paved:
        seeds = [(RNG.uniform(-1, 1), RNG.uniform(-1, 1)) for _ in range(36)]
        stone_cells(hexagon(), seeds, parent, height=0.065, prefix="Flagstone")


def ornament(name, center, scale, parent, axis="front"):
    for side in (-1, 1):
        points = []
        for i in range(32):
            t = i / 31
            x = side * scale * (0.16 + 0.42 * t) * math.sin(t * math.pi * 2)
            z = scale * (t - 0.5) * 2
            local = (x, 0, z) if axis == "front" else (0, x, z)
            points.append(tuple(center[j] + local[j] for j in range(3)))
        tube(name, points, 0.0028, "Polished bevels", parent)


def loft(name, profiles, mat, parent, bevel=0.008):
    vertices = [(x, y, z) for polygon, z in profiles for x, y in polygon]
    count = len(profiles[0][0])
    faces = [tuple(range(count - 1, -1, -1))]
    for layer in range(len(profiles) - 1):
        a = layer * count
        b = a + count
        faces += [
            (a + i, a + (i + 1) % count, b + (i + 1) % count, b + i)
            for i in range(count)
        ]
    faces.append(tuple(range(len(vertices) - count, len(vertices))))
    return mesh(name, vertices, faces, mat, parent, bevel)


def build_arcane_chest(root):
    body = empty("ChestBody", root)
    body.location.z = 0.073
    lid = empty("ChestLid", body)
    outline = octagon(1.03, 0.69, 0.12)
    for a, b in zip(outline, outline[1:] + outline[:1]):
        wall = [a, b, (b[0] * 0.90, b[1] * 0.88), (a[0] * 0.90, a[1] * 0.88)]
        prism("Enamel coffer wall", wall, 0.065, 0.52, "Purple enamel", body, 0.009)
    prism(
        "Coffer interior floor",
        octagon(0.94, 0.60, 0.10),
        0.065,
        0.10,
        "Recessed bronze",
        body,
        0.006,
    )
    prism(
        "Violet interior glow",
        octagon(0.90, 0.56, 0.09),
        0.101,
        0.105,
        "Essence violet",
        body,
        0,
    )
    for z in (0.085, 0.12, 0.485, 0.535):
        contour("Cast perimeter moulding", outline, z, 0.019, "Rose gold", body)
        contour("Edge glint", outline, z + 0.013, 0.004, "Polished bevels", body)
    for x, y in outline:
        tube("Corner buttress", [(x, y, 0.09), (x, y, 0.53)], 0.022, "Rose gold", body)
    for x in (-0.34, 0.34):
        for y in (-0.35, 0.35):
            box(
                "Engraved gold pilaster",
                (x, y, 0.30),
                (0.085, 0.035, 0.40),
                "Rose gold",
                body,
            )
            if y < 0:
                ornament("Pilaster filigree", (x, y - 0.021, 0.30), 0.14, body)
        for y in (-0.25, 0.25):
            box("Cast foot", (x, y, 0.04), (0.15, 0.14, 0.08), "Rose gold", body, 0.014)
    profiles = [
        (octagon(1.065, 0.73, 0.13), 0.55),
        (octagon(1.025, 0.70, 0.13), 0.63),
        (octagon(0.86, 0.55, 0.115), 0.82),
        (octagon(0.68, 0.39, 0.09), 0.875),
    ]
    loft("Faceted enamel lid", profiles, "Purple enamel", lid, 0.009)
    for polygon, z in (profiles[0], profiles[-1]):
        contour("Lid raised frame", polygon, z, 0.011, "Rose gold", lid)
        contour("Fine gilt edge", polygon, z + 0.007, 0.0028, "Polished bevels", lid)
    for x in (-0.22, 0.22):
        front = [
            (x, -0.371, 0.55),
            (x, -0.352, 0.63),
            (x, -0.28, 0.82),
            (x, -0.20, 0.879),
            (x, 0.20, 0.879),
            (x, 0.28, 0.82),
            (x, 0.352, 0.63),
            (x, 0.371, 0.55),
        ]
        for offset in (-0.026, 0.026):
            tube(
                "Lid strap border",
                [(a + offset, b, c) for a, b, c in front],
                0.009,
                "Polished bevels",
                lid,
            )
        for a, b in pairwise(front):
            mesh(
                "Cast lid strap",
                [
                    (a[0] - 0.026, a[1], a[2]),
                    (a[0] + 0.026, a[1], a[2]),
                    (b[0] + 0.026, b[1], b[2]),
                    (b[0] - 0.026, b[1], b[2]),
                ],
                [(0, 1, 2, 3)],
                "Rose gold",
                lid,
            )
    build_clasp(body, 0.40, "Cyan crystal")
    for side in (-1, 1):
        for z in (0.16, 0.43):
            points = [
                (
                    side * (0.11 + 0.15 * t / 40),
                    -0.367,
                    z + 0.025 * math.sin(t / 40 * math.pi * 2),
                )
                for t in range(41)
            ]
            tube("Panel corner engraving", points, 0.003, "Rose gold", body)
    for x in (-0.29, 0.29):
        box("Rear hinge leaf", (x, 0.362, 0.52), (0.13, 0.032, 0.13), "Rose gold", body)
        ring(
            "Hinge barrel",
            (x, 0.386, 0.55),
            0.028,
            0.012,
            "Polished bevels",
            body,
            axis="X",
        )
    build_handles(body, "Rose gold", 0.53)
    contour("LidLight", outline, 0.542, 0.007, "Essence violet", body)
    orbit = empty("OrbitGems", root)
    for i in range(3):
        angle = i * TAU / 3
        crystal(
            f"Orbit jewel {i}",
            (0.70 * math.cos(angle), 0.70 * math.sin(angle), 0.62),
            (0.08, 0.07, 0.18),
            "Cyan crystal",
            orbit,
        )
    build_arcane_seal(root)
    animate_chest(body, lid, orbit, heavy=False)
    return body


def build_clasp(body, height, gemstone):
    for size, depth, mat in [
        (0.32, -0.385, "Recessed bronze"),
        (0.285, -0.407, "Rose gold"),
        (0.213, -0.44, gemstone),
    ]:
        if mat == gemstone:
            diamond_gem("Cut gemstone", (0, depth, height), size, size * 1.5, mat, body)
        else:
            crystal(
                "Diamond clasp",
                (0, depth, height),
                (size, size * 1.5, 0.065),
                mat,
                body,
                axis="Y",
            )
    for x in (-0.34, 0.34):
        for z in (0.14, 0.46):
            crystal(
                "Gold diamond rivet",
                (x, -0.38, z),
                (0.028, 0.041, 0.014),
                "Polished bevels",
                body,
                axis="Y",
            )


def diamond_gem(name, center, width, height, mat, parent):
    vertices = []
    diamond = [(0, height / 2), (width / 2, 0), (0, -height / 2), (-width / 2, 0)]
    for scale, depth in [(1, 0), (0.65, -0.025), (0.14, -0.041)]:
        vertices.extend(
            [
                (center[0] + x * scale, center[1] + depth, center[2] + z * scale)
                for x, z in diamond
            ]
        )
    faces = [(8, 9, 10, 11)]
    for layer in range(2):
        for i in range(4):
            a = layer * 4 + i
            b = layer * 4 + (i + 1) % 4
            faces += [(a, b, b + 4), (a, b + 4, a + 4)]
    obj = mesh(name, vertices, faces, mat, parent)
    if mat == "Cyan crystal":
        obj.data.materials.append(MATERIALS["Crystal highlight"])
        for i in (1, 5, 10):
            obj.data.polygons[i].material_index = 1


def build_handles(body, mat, x):
    for side in (-1, 1):
        pivot = empty(f"Handle_{side}", body)
        pivot.location = (side * x, 0, 0.39)
        ring(
            "Swivel ring handle",
            (side * 0.025, 0, -0.085),
            0.083,
            0.016,
            mat,
            pivot,
            axis="X",
        )
        box(
            "Handle mounting plate", (side * x, 0, 0.39), (0.037, 0.10, 0.12), mat, body
        )
        crystal(
            "Handle pin",
            (side * (x + 0.025), 0, 0.4),
            (0.047, 0.045, 0.045),
            "Polished bevels",
            body,
        )
        for frame in range(1, 242, 4):
            t = (frame - 1) / 30
            pivot.rotation_euler.y = (
                0.17 * math.sin(t * 4 + side) * max(0, math.sin(t * math.pi / 4))
            )
            pivot.keyframe_insert("rotation_euler", frame=frame)


def build_runes(parent, radius, z, mat):
    for i in range(12):
        start = i * TAU / 12
        ring(
            "Broken arc",
            (0, 0, z),
            radius,
            0.0045,
            mat,
            parent,
            start=start + 0.05,
            end=start + 0.35,
            segments=12,
        )
        a = start + 0.41
        p = (radius * math.cos(a), radius * math.sin(a), z)
        points = [
            (p[0] + 0.027 * math.cos(a + q), p[1] + 0.027 * math.sin(a + q), z)
            for q in (0, math.pi / 2, math.pi, math.pi * 1.5)
        ]
        tube("Rune diamond", points, 0.0035, mat, parent, True)


def build_crimson_chest(root):
    body = empty("ChestBody", root)
    body.location.z = 0.073
    lid = empty("ChestLid", body)
    for i in range(7):
        for side in (-1, 1):
            box(
                "Dark oak plank",
                (-0.45 + i * 0.15, side * 0.32, 0.28),
                (0.146, 0.045, 0.44),
                "Dark timber",
                body,
                0.009,
            )
    for side in (-1, 1):
        box(
            "Solid oak end",
            (side * 0.51, 0, 0.28),
            (0.045, 0.64, 0.44),
            "Dark timber",
            body,
        )
    box("Coffer inner floor", (0, 0, 0.095), (0.99, 0.61, 0.04), "Dark timber", body)
    for z in (0.095, 0.48):
        box("Front gold rail", (0, -0.35, z), (1.04, 0.05, 0.055), "Rose gold", body)
        box("Back gold rail", (0, 0.35, z), (1.04, 0.05, 0.055), "Rose gold", body)
    # Individual curved lacquer boards keep the traditional barrel-lid silhouette.
    for i in range(9):
        a = i * math.pi / 9
        b = (i + 1) * math.pi / 9 - 0.008
        points = [
            (-0.53, 0.345 * math.cos(a), 0.51 + 0.29 * math.sin(a)),
            (0.53, 0.345 * math.cos(a), 0.51 + 0.29 * math.sin(a)),
            (0.53, 0.345 * math.cos(b), 0.51 + 0.29 * math.sin(b)),
            (-0.53, 0.345 * math.cos(b), 0.51 + 0.29 * math.sin(b)),
        ]
        mesh(
            "Curved crimson lid board",
            points,
            [(0, 1, 2, 3)],
            "Crimson lacquer",
            lid,
            0.003,
        )
    for side in (-1, 1):
        points = [
            (
                side * 0.53,
                0.345 * math.cos(i * math.pi / 32),
                0.51 + 0.29 * math.sin(i * math.pi / 32),
            )
            for i in range(33)
        ]
        mesh("Crimson lid end", points, [tuple(range(33))], "Crimson lacquer", lid)
    for x in (-0.50, -0.32, 0.32, 0.50):
        for dx in (-0.017, 0.017):
            tube(
                "Arched gold band",
                [
                    (
                        x + dx,
                        0.352 * math.cos(i * math.pi / 48),
                        0.51 + 0.301 * math.sin(i * math.pi / 48),
                    )
                    for i in range(49)
                ],
                0.018,
                "Rose gold",
                lid,
            )
        for y in (-0.351, 0.351):
            box(
                "Vertical brass strap",
                (x, y, 0.29),
                (0.067, 0.04, 0.43),
                "Rose gold",
                body,
            )
            for z in (0.13, 0.23, 0.38, 0.46):
                crystal(
                    "Hand-hammered rivet",
                    (x, y + math.copysign(0.024, y), z),
                    (0.022, 0.024, 0.014),
                    "Polished bevels",
                    body,
                    axis="Y",
                )
    for x in (-0.46, 0.46):
        for y in (-0.28, 0.28):
            box(
                "Coffer foot",
                (x, y, 0.04),
                (0.14, 0.13, 0.08),
                "Rose gold",
                body,
                0.015,
            )
    build_clasp(body, 0.42, "Emerald")
    build_handles(body, "Rose gold", 0.55)
    for x in (-0.32, 0.32):
        for i in range(1, 8):
            a = i * math.pi / 8
            crystal(
                "Lid band rivet",
                (x, 0.374 * math.cos(a), 0.51 + 0.315 * math.sin(a)),
                (0.025, 0.025, 0.025),
                "Polished bevels",
                lid,
            )
        crystal(
            "Emerald crown setting", (x, 0, 0.83), (0.08, 0.07, 0.032), "Rose gold", lid
        )
        crystal(
            "Emerald crown jewel", (x, 0, 0.85), (0.056, 0.05, 0.024), "Emerald", lid
        )
    hinge = Vector((0, 0.345, 0.51))
    for child in lid.children:
        child.location -= hinge
    lid.location = hinge
    box("LidLight", (0, -0.342, 0.502), (0.97, 0.012, 0.012), "Warm magic", body, 0.002)
    animate_chest(body, lid, None, heavy=True)
    return body


def animate_chest(body, lid, orbit, heavy):
    for frame in range(1, 242, 3):
        t = (frame - 1) / 30
        pulse = max(0, math.sin(math.pi * (t - 1.6) / 4.8)) if 1.6 < t < 6.4 else 0
        if heavy:
            rock = (
                math.sin((t - 2) * 13) * math.sin(math.pi * (t - 2) / 1.3) ** 2
                if 2 < t < 3.3
                else 0
            )
            hop = math.sin(math.pi * (t - 3.3) / 0.6) if 3.3 < t < 3.9 else 0
            body.location.z = 0.073 + 0.055 * abs(rock) + 0.10 * hop
            body.rotation_euler.y = rock * 0.065
            lid.rotation_euler.x = -0.09 * max(0, rock) - 0.04 * hop
        else:
            body.location.z = 0.073 + 0.22 * pulse**2
            body.rotation_euler = (
                0.025 * math.sin(t * 2) * pulse,
                0.035 * math.cos(t * 1.5) * pulse,
                0.05 * math.sin(t * 0.8) * pulse,
            )
            lid.location.z = 0.008 * pulse * (0.5 + 0.5 * math.sin(t * 3))
        body.keyframe_insert("location", frame=frame)
        body.keyframe_insert("rotation_euler", frame=frame)
        lid.keyframe_insert("location", frame=frame)
        lid.keyframe_insert("rotation_euler", frame=frame)
        if orbit:
            orbit.rotation_euler.z = t * TAU / 8
            orbit.location.z = 0.045 * math.sin(t * TAU / 4)
            orbit.keyframe_insert("rotation_euler", frame=frame)
            orbit.keyframe_insert("location", frame=frame)


def build_fissure(root):
    build_tile(root, False)
    prism("Exposed dry bed", hexagon(0.998), -0.02, 0.015, "Dry cavity", root, 0)
    angles = [-2.5, -1.25, -0.10, 1.12, 2.30]
    for index, a in enumerate(angles):
        b = angles[(index + 1) % len(angles)]
        if b < a:
            b += TAU
        sector = clip(hexagon(), (math.sin(a), -math.cos(a)), -0.073)
        sector = clip(sector, (-math.sin(b), math.cos(b)), -0.073)
        mid = (a + b) / 2
        sector = clip(sector, (-math.cos(mid), -math.sin(mid)), -0.25)
        seeds = [(RNG.uniform(-1, 1), RNG.uniform(-1, 1)) for _ in range(26)]
        stone_cells(sector, seeds, root, height=0.19, prefix=f"Fractured slab {index}")
    build_monolith(root, (-0.05, 0.55, 0.20), (0.24, 0.23, 0.48))
    for i in range(22):
        angle = RNG.random() * TAU
        r = RNG.uniform(0.32, 0.86)
        build_monolith(
            root,
            (r * math.cos(angle), r * math.sin(angle), 0.17),
            (0.025, 0.022, RNG.uniform(0.018, 0.045)),
        )
    effects = empty("EssenceActive", root)
    prism("Recessed essence", hexagon(0.98), 0.017, 0.025, "Essence deep", effects, 0)
    for i, a in enumerate(angles):
        points = []
        for j in range(40):
            r = 0.09 + j * 0.018
            theta = a + 0.045 * math.sin(j * 0.35 + i)
            points.append(
                (
                    r * math.cos(theta),
                    r * math.sin(theta),
                    0.053 + 0.006 * math.sin(j * 0.5),
                )
            )
        tube("Flow vein", points, 0.012, "Essence violet", effects)
        tube(
            "Flow core",
            [(x, y, z + 0.009) for x, y, z in points],
            0.003,
            "Essence core",
            effects,
        )
        tracer = empty(f"ChannelCurrent{i}", effects)
        crystal(
            "Flowing essence bead",
            (0, 0, 0),
            (0.033, 0.033, 0.017),
            "Essence core",
            tracer,
        )
        for frame in range(1, 242, 4):
            progress = ((frame - 1) / 120 + i / 5) % 1
            radius = 0.78 - 0.71 * progress
            tracer.location = (radius * math.cos(a), radius * math.sin(a), 0.063)
            tracer.scale = (math.sin(progress * math.pi),) * 3
            tracer.keyframe_insert("location", frame=frame)
            tracer.keyframe_insert("scale", frame=frame)
    build_essence_wisps(effects, False)


def build_monolith(parent, pos, size):
    x, y, z = size
    vertices = []
    for layer, scale, height in [
        (0, 1, 0),
        (1, 0.9, 0.35),
        (2, 0.52, 0.85),
        (3, 0.08, 1),
    ]:
        for i in range(7):
            a = i * TAU / 7
            vertices.append(
                (
                    pos[0] + x * scale * math.cos(a) * (1 + RNG.uniform(-0.15, 0.15)),
                    pos[1] + y * scale * math.sin(a) * (1 + RNG.uniform(-0.1, 0.1)),
                    pos[2] + z * height,
                )
            )
    faces = [tuple(range(6, -1, -1)), tuple(range(21, 28))]
    for layer in range(3):
        for i in range(7):
            a = layer * 7 + i
            b = layer * 7 + (i + 1) % 7
            faces.extend([(a, b, b + 7), (a, b + 7, a + 7)])
    mesh("Ancient split monolith", vertices, faces, "Slate", parent, 0.007)


def build_arcane_seal(root):
    material("Ritual stone", (0.055, 0.050, 0.065), 0.02, 0.88, "slate.png")
    material("Ritual stone charcoal", (0.12, 0.115, 0.14), 0.02, 0.88, "slate.png")
    material("Ritual stone ash", (0.24, 0.22, 0.26), 0.02, 0.9, "slate.png")
    material("Ritual stone plum", (0.14, 0.085, 0.17), 0.02, 0.88, "slate.png")
    material("Carved rune face", (0.40, 0.35, 0.48), 0, 0.88, "slate.png")
    material("Rune recess", (0.035, 0.021, 0.055), 0, 1)
    material("Ritual violet", (0.20, 0.018, 0.45), 0, 0.65, emission=0.75)
    prism("Solid ritual hex", hexagon(), -0.16, 0.035, "Ritual stone", root, 0.012)
    rings = [empty(f"ArcaneSealRing{i}", root) for i in range(2)]
    build_ritual_masonry(root, rings)
    for ring_index, (radius, count) in enumerate(((0.71, 40), (0.515, 30))):
        inscriptions = rings[ring_index]
        ring(
            "Rotating violet circle", (0, 0, 0.052), radius + 0.035,
            0.003, "Ritual violet", inscriptions, segments=128,
        )
        for i in range(count):
            angle = i * TAU / count
            carve_ritual_glyph(
                inscriptions,
                (radius * math.cos(angle), radius * math.sin(angle)),
                angle,
                i,
                0.020,
                0.049,
            )
    for radius in (0.16, 0.29, 0.37):
        ring(
            "Central carved stone circle",
            (0, 0, 0.049),
            radius,
            0.009,
            "Ritual violet",
            root,
            segments=96,
        )
    for phase in (0, math.pi):
        points = [
            (
                0.35 * math.cos(phase + i * TAU / 3),
                0.35 * math.sin(phase + i * TAU / 3),
                0.051,
            )
            for i in range(3)
        ]
        tube(
            "Raised central ritual star", points, 0.008, "Ritual violet", root, True
        )


def build_ritual_masonry(root, rings):
    palette = ("Ritual stone charcoal", "Ritual stone", "Ritual stone ash", "Ritual stone charcoal", "Ritual stone plum")
    for inner, outer, count, height in (
        (0.84, 1.2, 24, 0.095),
        (0.78, 0.82, 28, 0.085),
        (0.60, 0.635, 24, 0.078),
        (0.405, 0.445, 20, 0.070),
    ):
        for i in range(count):
            start, end = i * TAU / count + 0.008, (i + 1) * TAU / count - 0.008
            polygon = [
                (r * math.cos(a), r * math.sin(a))
                for r, a in ((inner, start), (outer, start), (outer, end), (inner, end))
            ]
            for j in range(6):
                angle = j * TAU / 6
                polygon = clip(
                    polygon, (math.cos(angle), math.sin(angle)), math.sqrt(3) / 2
                )
            if len(polygon) > 2:
                prism(
                    "Chiselled ritual ring block",
                    polygon,
                    0.032,
                    height,
                    palette[(i * 7 + count) % len(palette)],
                    root if inner == 0.84 else rings[0 if inner == 0.78 else 1],
                    0.006,
                )


def carve_ritual_glyph(parent, center, angle, index, size, height):
    glyphs = [
        [(-0.6, -1), (-0.6, 1), (0.6, 0.3), (-0.6, -0.2)],
        [(0, -1), (0, 1), (-0.65, 0.35), (0, 1), (0.65, 0.35)],
        [(-0.65, -1), (-0.65, 1), (0.65, -1), (0.65, 1)],
        [(-0.65, 0), (0, 1), (0.65, 0), (0, -1), (-0.65, 0)],
        [(-0.65, 1), (0.65, 0.3), (-0.65, -0.3), (0.65, -1)],
        [(0, -1), (0, 1), (0.65, 0.5), (0, 0), (-0.65, 0.5)],
    ]
    points = [
        (
            center[0] + size * (x * math.sin(angle) + y * math.cos(angle)),
            center[1] + size * (-x * math.cos(angle) + y * math.sin(angle)),
            height,
        )
        for x, y in glyphs[index % len(glyphs)]
    ]
    tube("Chiselled dark rune channel", points, size * 0.24, "Rune recess", parent)
    tube(
        "Violet rune inlay",
        [(x, y, z + 0.0025) for x, y, z in points],
        size * 0.14,
        "Ritual violet",
        parent,
    )


def build_stone_basin(root):
    prism("Stone basin foundation", hexagon(0.998), -0.14, -0.075, "Slate", root, 0.006)
    vertices = [(0, 0, 0.011)]
    for radius, height in ((0.16, 0.015), (0.30, 0.035), (0.43, 0.055)):
        for i in range(48):
            angle = i * TAU / 48
            vertices.append(
                (
                    radius * math.cos(angle),
                    radius * math.sin(angle),
                    height + RNG.uniform(-0.014, 0.014),
                )
            )
    faces = [(0, 1 + i, 1 + (i + 1) % 48) for i in range(48)]
    for layer in range(2):
        for i in range(48):
            a = 1 + layer * 48 + i
            b = 1 + layer * 48 + (i + 1) % 48
            faces.append((a, b, b + 48, a + 48))
    mesh("Weathered stone crater", vertices, faces, "Slate", root)
    for i in range(18):
        angle = i * 2.399
        radius = 0.08 + 0.30 * RNG.random()
        build_monolith(
            root,
            (radius * math.cos(angle), radius * math.sin(angle), 0.015),
            (0.025 + RNG.random() * 0.035, 0.025, 0.025 + RNG.random() * 0.025),
        )


def build_volcanic_essence(effects):
    liquid = material("Eruption liquid", (0.20, 0.012, 0.46), 0.08, 0.24, emission=0.14)
    shader = liquid.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Coat Weight"].default_value = 0.35
    shader.inputs["Coat Roughness"].default_value = 0.18
    color_node = liquid.node_tree.nodes.new("ShaderNodeVertexColor")
    color_node.layer_name = "Liquid folds"
    liquid.node_tree.links.new(color_node.outputs["Color"], shader.inputs["Base Color"])
    build_liquid_surface(effects)
    for index in range(24):
        pivot = empty(f"EruptionDroplet{index}", effects)
        build_eruption_droplet(pivot, index, liquid)
        animate_eruption_droplet(pivot, index)


def build_eruption_droplet(pivot, index, liquid):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1)
    drop = bpy.context.object
    for collection in list(drop.users_collection):
        collection.objects.unlink(drop)
    COLLECTION.objects.link(drop)
    drop.name = "Lobed liquid essence droplet"
    drop.parent = pivot
    # Heavy globs, middle-sized beads and fine spray have genuinely different volumes.
    radius = (0.060, 0.022, 0.034, 0.018, 0.026, 0.040, 0.015, 0.024)[index % 8]
    drop.scale = (radius, radius * (0.85 + (index % 3) * 0.13), radius * (1.2 + (index % 4) * 0.2))
    drop.data.materials.append(liquid)
    colors = drop.data.color_attributes.new(name="Liquid folds", type="FLOAT_COLOR", domain="POINT")
    for vertex, color in zip(drop.data.vertices, colors.data):
        x, y, z = vertex.co
        fold = math.sin(x * 7 + index) * math.cos(y * 6 - z * 4)
        ripple = math.sin(x * 19 + y * 13 + z * 17 + index * 0.7)
        vertex.co *= 1 + 0.11 * fold + 0.025 * ripple
        vertex.co.x += 0.12 * (z * z - 0.3) * math.sin(index * 1.3)
        glow = max(0, min(1, 0.5 + fold * 0.35 + ripple * 0.15))
        color.color = (0.045 + 0.22 * glow, 0.003 + 0.025 * glow, 0.12 + 0.36 * glow, 1)
    for polygon in drop.data.polygons:
        polygon.use_smooth = True


def animate_eruption_droplet(pivot, index):
    angle = index * 2.399
    heavy = index % 8 == 0
    duration = 0.90 + (index % 5) * 0.085
    launch = 5.52 + (index % 9) * 0.045
    spread = (0.15 if heavy else 0.27) + (index % 4) * 0.04
    peak = (0.68 if heavy else 0.82) + (index % 5) * 0.11
    for frame in range(1, 242, 2):
        age = (frame - 1) / 30 - launch
        visible = 0 < age < duration
        u = max(0, min(1, age / duration)) if visible else 0
        radius = 0.025 + spread * u
        pivot.location = (
            radius * math.cos(angle), radius * math.sin(angle),
            0.075 + peak * 4 * u * (1 - u),
        )
        size = max(0.001, math.sin(math.pi * u) ** 0.3) if visible else 0.001
        # Stretch briefly on launch, round at the apex, then deform again on descent.
        stretch = 1 + 0.4 * abs(2 * u - 1)
        pivot.scale = (size / math.sqrt(stretch), size / math.sqrt(stretch), size * stretch)
        pivot.rotation_euler = (
            0.7 * math.sin(angle) * (2 * u - 1),
            -0.7 * math.cos(angle) * (2 * u - 1), angle + u * (0.8 if heavy else 2.2),
        )
        pivot.keyframe_insert("rotation_euler", frame=frame)
        pivot.keyframe_insert("location", frame=frame)
        pivot.keyframe_insert("scale", frame=frame)


def build_liquid_surface(effects):
    segments, rows = 96, 32

    def surface(phase):
        vertices = []
        burst = (
            max(0, math.sin(math.pi * (phase - 5.5) / 1.1))
            if 5.5 < phase < 6.6
            else 0
        )
        for row in range(rows + 1):
            radius = 0.002 + 0.465 * row / rows
            for column in range(segments):
                angle = column * TAU / segments
                wave = math.sin(
                    radius * 46 - phase * TAU + math.sin(angle * 3 + phase * TAU / 4)
                )
                height = (
                    0.091
                    + 0.006 * wave
                    + 0.004 * math.sin(angle * 7 - phase * TAU / 2 + radius * 24)
                )
                spout_radius = 0.10 + burst * (0.045 + 0.018 * math.sin(angle * 5 + phase * 9))
                height += (0.055 + burst * 1.05) * math.exp(-((radius / spout_radius) ** 2))
                height += burst * 0.06 * math.sin(radius * 80 + angle * 6 - phase * 18) * math.exp(-radius * 9)
                vertices.append(
                    (
                        radius * math.cos(angle)
                        + burst
                        * 0.035
                        * math.sin(height * 9 + phase * 4)
                        * math.exp(-radius * 12),
                        radius * math.sin(angle)
                        + burst
                        * 0.025
                        * math.sin(height * 13)
                        * math.exp(-radius * 12),
                        height * (1 + burst * 0.16 * math.sin(angle * 5 + radius * 25)),
                    )
                )
        return vertices

    faces = []
    for row in range(rows):
        for column in range(segments):
            a = row * segments + column
            b = row * segments + (column + 1) % segments
            faces.append((a, b, b + segments, a + segments))
    obj = mesh("Churning liquid essence", surface(0), faces, "Essence deep", effects)
    liquid = material("Living liquid", (0.095, 0.003, 0.29), 0.02, 0.55, emission=0.6)
    shader = liquid.node_tree.nodes.get("Principled BSDF")
    color_node = liquid.node_tree.nodes.new("ShaderNodeVertexColor")
    color_node.layer_name = "Liquid depth"
    liquid.node_tree.links.new(color_node.outputs["Color"], shader.inputs["Base Color"])
    # glTF supports vertex colors for base color, but not for emissive color.
    # Keep emission explicitly violet so the exporter cannot substitute white.
    obj.data.materials[0] = liquid
    colors = obj.data.color_attributes.new(
        name="Liquid depth", type="FLOAT_COLOR", domain="POINT"
    )
    for index, color in enumerate(colors.data):
        row, column = divmod(index, segments)
        glow = (0.5 + 0.5 * math.sin(row * 0.48 + column * TAU / segments * 3)) ** 5
        color.color = (0.028 + 0.10 * glow, 0.003 + 0.012 * glow, 0.09 + 0.19 * glow, 1)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.shape_key_add(name="Basis")
    # Baked surface deformation survives GLB export and both renderer backends.
    for step in range(1, 64):
        phase = step / 8
        key = obj.shape_key_add(name=f"Flow{step:02d}")
        for vertex, coordinate in zip(key.data, surface(phase)):
            vertex.co = coordinate
        for frame, value in (
            (1, 0),
            (1 + (step - 1) * 3.75, 0),
            (1 + step * 3.75, 1),
            (1 + (step + 1) * 3.75, 0),
            (241, 0),
        ):
            key.value = value
            key.keyframe_insert("value", frame=frame)


def build_vortex(root):
    prism("Recessed hex foundation", hexagon(), -0.16, -0.09, "Earth", root, 0.006)
    build_stone_basin(root)
    # Outer stone reaches the hex; successive annular terraces descend into a real basin.
    for level, (inner, outer, z, count) in enumerate(
        [(0.69, 1.2, 0.23, 14), (0.51, 0.71, 0.13, 12), (0.40, 0.53, 0.065, 10)]
    ):
        for i in range(count):
            a = i * TAU / count + 0.018
            b = (i + 1) * TAU / count - 0.018
            poly = [
                (inner * math.cos(a), inner * math.sin(a)),
                (outer * math.cos(a), outer * math.sin(a)),
                (outer * math.cos(b), outer * math.sin(b)),
                (inner * math.cos(b), inner * math.sin(b)),
            ]
            for j in range(6):
                angle = j * TAU / 6
                poly = clip(poly, (math.cos(angle), math.sin(angle)), math.sqrt(3) / 2)
            if len(poly) > 2:
                obj = prism(
                    f"Basin terrace {level}-{i}",
                    poly,
                    0,
                    z + RNG.uniform(-0.019, 0.019),
                    "Slate",
                    root,
                    0.016,
                )
                for vertex in obj.data.vertices:
                    if vertex.co.z > 0:
                        vertex.co.z += RNG.uniform(-0.014, 0.014)
    effects = empty("EssenceActive", root)
    build_volcanic_essence(effects)
    orbit = empty("FloatingShards", effects)
    for i in range(3):
        a = i * TAU / 3
        build_monolith(
            orbit,
            (0.46 * math.cos(a), 0.46 * math.sin(a), 0.32 + i * 0.055),
            (0.09, 0.095, 0.21),
        )
    for frame in range(1, 242, 4):
        orbit.rotation_euler.z = (frame - 1) / 240 * TAU
        orbit.keyframe_insert("rotation_euler", frame=frame)


def build_essence_wisps(effects, vortex):
    for i in range(3):
        wisp = empty(f"EssenceWisp{i}", effects)
        vertices = []
        steps = 80
        for j in range(steps + 1):
            t = j / steps
            a = i * TAU / 3 + t * TAU * (1 if vortex else 0.50)
            r = (0.17 if vortex else 0.28) * (1 - 0.67 * t)
            width = 0.036 * math.sin(math.pi * t) ** 0.7
            x = r * math.cos(a)
            y = r * math.sin(a)
            z = 0.045 + t * (0.72 if vortex else 0.51)
            vertices.extend(
                [
                    (x - width * math.cos(a), y - width * math.sin(a), z),
                    (x + width * math.cos(a), y + width * math.sin(a), z),
                ]
            )
        faces = [(j * 2, j * 2 + 1, j * 2 + 3, j * 2 + 2) for j in range(steps)]
        obj = mesh("Flowing essence ribbon", vertices, faces, "Essence veil", wisp)
        obj.data.materials[0].use_backface_culling = False
        tube(
            "Ribbon luminous spine",
            [
                tuple(
                    (vertices[j * 2][k] + vertices[j * 2 + 1][k]) / 2 for k in range(3)
                )
                for j in range(steps + 1)
            ],
            0.0035,
            "Essence core",
            wisp,
        )
        for frame in range(1, 242, 4):
            t = (frame - 1) / 30
            wisp.rotation_euler.z = t * TAU / 8
            burst = max(0, math.sin(math.pi * (t - 5.5) / 1.2)) if 5.5 < t < 6.7 else 0
            wisp.scale.z = 0.80 + 0.15 * math.sin(t * TAU / 4 + i) + 0.50 * burst
            wisp.keyframe_insert("rotation_euler", frame=frame)
            wisp.keyframe_insert("scale", frame=frame)
    for i in range(18):
        particle = empty(f"EssenceMote{i}", effects)
        crystal(
            "Essence droplet",
            (0, 0, 0),
            (0.012, 0.012, 0.027),
            "Essence core",
            particle,
        )
        for frame in range(1, 242, 4):
            t = ((frame - 1) / 120 + i / 18) % 1
            a = i * 2.399 + t * 2
            r = 0.10 + 0.30 * t
            particle.location = (r * math.cos(a), r * math.sin(a), 0.07 + 0.7 * t)
            particle.scale = (math.sin(t * math.pi),) * 3
            particle.keyframe_insert("location", frame=frame)
            particle.keyframe_insert("scale", frame=frame)


def consolidate_static_parts(root):
    for obj in list(root.children_recursive):
        if obj.type == "CURVE":
            bpy.ops.object.select_all(action="DESELECT")
            obj.select_set(True)
            bpy.context.view_layer.objects.active = obj
            bpy.ops.object.convert(target="MESH")
        if obj.type == "MESH":
            bpy.context.view_layer.objects.active = obj
            for modifier in list(obj.modifiers):
                bpy.ops.object.modifier_apply(modifier=modifier.name)
    # Join only siblings with no authored motion. Pivots and independently animated parts survive.
    for parent in [root] + [
        obj for obj in root.children_recursive if obj.type == "EMPTY"
    ]:
        siblings = [
            o
            for o in parent.children
            if o.type == "MESH" and not o.animation_data and not o.data.shape_keys
        ]
        if len(siblings) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in siblings:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = siblings[0]
        bpy.ops.object.join()
        siblings[0].name = f"{parent.name}_Surface"


def export_asset(root, name):
    bpy.context.scene.frame_set(1)
    consolidate_static_parts(root)
    bpy.ops.object.select_all(action="DESELECT")
    root.select_set(True)
    for obj in root.children_recursive:
        obj.select_set(True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / f"{name}.glb"),
        export_format="GLB",
        use_selection=True,
        export_animations=True,
        export_anim_slide_to_zero=True,
        export_animation_mode="SCENE",
        export_frame_range=True,
        export_force_sampling=True,
        export_anim_scene_split_object=False,
        export_extras=True,
    )
    if name == "chest-c2":
        preserve_ritual_stone_tints(OUTPUT / f"{name}.glb")
    triangles = 0
    for obj in root.children_recursive:
        if obj.type == "MESH":
            obj.data.calc_loop_triangles()
            triangles += len(obj.data.loop_triangles)
    return {
        "id": name,
        "triangles": triangles,
        "bytes": (OUTPUT / f"{name}.glb").stat().st_size,
        "hexCircumradius": 1,
        "animationSeconds": 8,
        "source": "Blender MCP construction + generated surface textures",
    }


def preserve_ritual_stone_tints(path):
    # Blender recognizes the texture but drops the constant MixRGB tint on export.
    # Keep the authored stone palette in glTF's standard baseColorFactor.
    data = path.read_bytes()
    json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + json_length])
    for exported in document["materials"]:
        name = exported.get("name", "")
        if name.startswith("Ritual stone"):
            exported["pbrMetallicRoughness"]["baseColorFactor"] = list(MATERIALS[name].diffuse_color)
    encoded = json.dumps(document, separators=(",", ":")).encode()
    encoded += b" " * (-len(encoded) % 4)
    remainder = data[20 + json_length:]
    header = struct.pack("<III", 0x46546C67, 2, 20 + len(encoded) + len(remainder))
    path.write_bytes(header + struct.pack("<II", len(encoded), 0x4E4F534A) + encoded + remainder)


def build_rewards():
    global COLLECTION
    RNG.seed(731)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    ART.mkdir(parents=True, exist_ok=True)
    old = bpy.data.collections.get("Reward Tile Studies")
    if old:
        for obj in list(old.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(old)
    COLLECTION = bpy.data.collections.new("Reward Tile Studies")
    bpy.context.scene.collection.children.link(COLLECTION)
    create_materials()
    scene = bpy.context.scene
    scene.render.fps = 30
    scene.frame_start = 1
    scene.frame_end = 241
    report = []
    for index, (name, builder) in enumerate(
        [
            ("chest-c2", build_arcane_chest),
            ("chest-c3", build_crimson_chest),
            ("rift-r1", build_fissure),
            ("rift-r2", build_vortex),
        ]
    ):
        root = empty(name)
        root["concept"] = name
        if name == "chest-c3":
            build_tile(root)
        builder(root)
        report.append(export_asset(root, name))
        root.location.x = (index % 2) * 2.6
        root.location.y = (index // 2) * 2.6
    scene.frame_set(70)
    (ART / "build-report.json").write_text(json.dumps(report, indent=2))
    bpy.ops.wm.save_as_mainfile(filepath=str(ART / "reward-tile-studies.blend"))
    print(json.dumps(report))


if __name__ == "__main__":
    build_rewards()
