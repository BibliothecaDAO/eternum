"""Build the approved fleet from the detailed Ironwind modeling workflow.

Blender uses Z-up and +Y forward. Each ship owns its collection and keeps
the runtime scale, sail UVs, mast clearance and player-print contract.
"""

import math
from pathlib import Path

import bmesh
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "apps/game/public/models/ships"
CLASSES = {
    "knight": (0.016, 0.048, 0.11),
    "crossbowman": (0.016, 0.095, 0.047),
    "paladin": (0.48, 0.43, 0.29),
}
TAU = math.tau


def new_collection(army, tier):
    name = f"Detailed fleet {army} T{tier}"
    previous = bpy.data.collections.get(name)
    if previous:
        for obj in list(previous.objects):
            bpy.data.objects.remove(obj, do_unlink=True)
        bpy.data.collections.remove(previous)
    collection = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(collection)
    root = bpy.data.objects.new(f"ship-{army}-t{tier}", None)
    collection.objects.link(root)
    root["hullLength"] = 4.2
    root["gameScale"] = 0.3
    root["designSource"] = "Detailed fleet, derived from approved Ironwind rebuild"
    root["armyClass"] = army
    root["tier"] = tier
    return collection, root


def finish_material(name, color, metal=0, roughness=0.55, timber=False):
    mat = bpy.data.materials.new("Fleet " + name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Metallic"].default_value = metal
    shader.inputs["Roughness"].default_value = roughness
    if timber:
        tex = mat.node_tree.nodes.new("ShaderNodeTexImage")
        tex.image = bpy.data.images.load(
            str(Path(__file__).parent / "textures/ironwind-oak.png"),
            check_existing=True,
        )
        mat.node_tree.links.new(tex.outputs["Color"], shader.inputs["Base Color"])
    return mat


def create_sail_material(army):
    material = finish_material("Ownership sail", (1, 1, 1), 0, 0.92)
    material["ownershipColor"] = True
    shader = material.node_tree.nodes.get("Principled BSDF")
    texture = material.node_tree.nodes.new("ShaderNodeTexImage")
    texture.image = bpy.data.images.load(
        str(Path(__file__).parent / f"textures/{army}-sail.png"), check_existing=True
    )
    material.node_tree.links.new(texture.outputs["Color"], shader.inputs["Base Color"])
    return material


def create_materials(army, tier):
    return {
        "oak": finish_material("Carved oak", (0.32, 0.14, 0.035), timber=True),
        "enamel": finish_material("Class enamel", CLASSES[army], 0.12, 0.4),
        "gold": finish_material(
            "Aged brass",
            (0.35, 0.19, 0.055) if tier == 1 else (0.58, 0.32, 0.065),
            0.68,
            0.32,
        ),
        "goldlight": finish_material("Brass edge", (0.72, 0.47, 0.13), 0.64, 0.28),
        "iron": finish_material("Gunmetal", (0.024, 0.035, 0.042), 0.72, 0.31),
        "dark": finish_material("Recess", (0.014, 0.012, 0.009)),
        "rope": finish_material("Braided hemp", (0.32, 0.22, 0.10), 0, 0.95),
        "sail": create_sail_material(army),
        "cloth": finish_material("Ivory canvas", (0.86, 0.79, 0.62), 0, 0.92),
        "glass": finish_material("Amber glazing", (0.23, 0.105, 0.026), 0.25, 0.22),
    }


class Workshop:
    def __init__(self, army, tier):
        self.army, self.tier = army, tier
        self.collection, self.root = new_collection(army, tier)
        self.materials = create_materials(army, tier)

    def surface(
        self,
        name,
        vertices,
        faces,
        material,
        uv=None,
        smooth=False,
        bevel=0,
        thickness=0,
    ):
        data = bpy.data.meshes.new(name)
        data.from_pydata(vertices, [], faces)
        data.update()
        obj = bpy.data.objects.new(name, data)
        self.collection.objects.link(obj)
        obj.parent = self.root
        data.materials.append(self.materials[material])
        layer = data.uv_layers.new(name="UVMap")
        for face in data.polygons:
            face.use_smooth = smooth
            for loop in face.loop_indices:
                vi = data.loops[loop].vertex_index
                x, y, z = vertices[vi]
                layer.data[loop].uv = (
                    uv[vi]
                    if uv is not None
                    else (y * 0.55 + x * 0.12, z * 0.4 + x * 0.25)
                )
        bpy.context.view_layer.objects.active = obj
        if thickness:
            mod = obj.modifiers.new("Timber thickness", "SOLIDIFY")
            mod.thickness = thickness
            bpy.ops.object.modifier_apply(modifier=mod.name)
        if bevel:
            mod = obj.modifiers.new("Crafted edge", "BEVEL")
            mod.width = bevel
            mod.segments = 2 if bevel >= 0.03 else 1
            bpy.ops.object.modifier_apply(modifier=mod.name)
        return obj

    def block(self, name, center, size, material, bevel=0.01):
        x, y, z = center
        a, b, c = [v / 2 for v in size]
        verts = [
            (x + dx * a, y + dy * b, z + dz * c)
            for dz in [-1, 1]
            for dy in [-1, 1]
            for dx in [-1, 1]
        ]
        return self.surface(
            name,
            verts,
            [
                (0, 2, 3, 1),
                (4, 5, 7, 6),
                (0, 1, 5, 4),
                (2, 6, 7, 3),
                (0, 4, 6, 2),
                (1, 3, 7, 5),
            ],
            material,
            bevel=bevel,
        )

    def sweep(self, name, points, radius, material, sides=8):
        verts = []
        for i, p in enumerate(points):
            tangent = Vector(points[min(i + 1, len(points) - 1)]) - Vector(
                points[max(0, i - 1)]
            )
            rotation = tangent.to_track_quat("Z", "Y")
            verts.extend(
                tuple(
                    Vector(p)
                    + rotation
                    @ Vector(
                        (
                            radius * math.cos(j * TAU / sides),
                            radius * math.sin(j * TAU / sides),
                            0,
                        )
                    )
                )
                for j in range(sides)
            )
        faces = [
            (
                i * sides + j,
                i * sides + (j + 1) % sides,
                (i + 1) * sides + (j + 1) % sides,
                (i + 1) * sides + j,
            )
            for i in range(len(points) - 1)
            for j in range(sides)
        ]
        faces += [
            tuple(reversed(range(sides))),
            tuple(range(len(verts) - sides, len(verts))),
        ]
        return self.surface(name, verts, faces, material, smooth=True)

    def turned(self, name, base, axis, profile, material, sides=12):
        rotation = Vector(axis).to_track_quat("Z", "Y")
        verts = [
            tuple(
                Vector(base)
                + rotation
                @ Vector(
                    (r * math.cos(j * TAU / sides), r * math.sin(j * TAU / sides), z)
                )
            )
            for r, z in profile
            for j in range(sides)
        ]
        faces = [
            (
                i * sides + j,
                i * sides + (j + 1) % sides,
                (i + 1) * sides + (j + 1) % sides,
                (i + 1) * sides + j,
            )
            for i in range(len(profile) - 1)
            for j in range(sides)
        ]
        uv = [(z * 0.5, j / sides) for r, z in profile for j in range(sides)]
        return self.surface(name, verts, faces, material, uv, smooth=True)


# Authored stations create a rounded transom and a swept bow, not mirrored pointed ends.
STATIONS = [
    (-2.1, 0.33),
    (-1.83, 0.64),
    (-1.3, 0.81),
    (-0.55, 0.86),
    (0.3, 0.82),
    (1.05, 0.64),
    (1.64, 0.38),
    (2.1, 0),
]


def beam(y):
    for i in range(len(STATIONS) - 1):
        a, wa = STATIONS[i]
        b, wb = STATIONS[i + 1]
        if a <= y <= b:
            t = (y - a) / (b - a)
            # Hermite slopes preserve a fair continuous sheer across authored sections.
            before = STATIONS[max(0, i - 1)]
            after = STATIONS[min(len(STATIONS) - 1, i + 2)]
            ma = (wb - before[1]) / (b - before[0])
            mb = (after[1] - wa) / (after[0] - a)
            return max(
                0,
                (2 * t**3 - 3 * t * t + 1) * wa
                + (t**3 - 2 * t * t + t) * (b - a) * ma
                + (-2 * t**3 + 3 * t * t) * wb
                + (t**3 - t * t) * (b - a) * mb,
            )
    raise ValueError(f"Longitudinal station outside hull: {y}")


def sheer(y):
    return 1.00 + 0.18 * (max(y, 0) / 2.1) ** 3 + 0.24 * (max(-y, 0) / 2.1) ** 3


def section(y, t, side):
    bottom = -0.3 + 0.26 * (abs(y) / 2.1) ** 4
    return (
        side * beam(y) * math.sin(t * math.pi / 2) ** 0.55,
        y,
        bottom + (sheer(y) - bottom) * t,
    )


def deck_edge(y):
    bottom = -0.3 + 0.26 * (abs(y) / 2.1) ** 4
    return section(y, (0.68 - bottom) / (sheer(y) - bottom), 1)[0] - 0.045


def ribbon(work, name, side, low, high, material, thickness=0.025):
    verts = []
    uv = []
    for i in range(41):
        y = -2.1 + i * 4.2 / 40
        for t in [low, high]:
            verts.append(section(y, t, side))
            uv.append((i / 40, t * 0.8))
    faces = [(2 * i, 2 * i + 1, 2 * i + 3, 2 * i + 2) for i in range(40)]
    if side == 1:
        faces = [tuple(reversed(face)) for face in faces]
    return work.surface(name, verts, faces, material, uv, True, 0.005, thickness)


def build_hull(work):
    build_strakes(work)
    build_transom(work)
    build_deck(work)
    build_bulwarks(work)
    build_prow(work)


def build_strakes(work):
    for side in [-1, 1]:
        for course in range(9):
            ribbon(
                work,
                f"Oak strake {side} {course}",
                side,
                course * 0.085,
                (course + 1) * 0.085 + 0.002,
                "oak",
            )
        ribbon(
            work,
            "Painted upperworks",
            side,
            0.765,
            1,
            "enamel",
            0.06,
        )
        for t in [0.18, 0.7, 0.78, 1]:
            points = [section(-2.1 + 4.2 * i / 40, t, side) for i in range(41)]
            work.sweep(
                "Brass rubbing strake", points, 0.023 if t < 1 else 0.041, "gold"
            )
        for y in [-1.7, -1.05, -0.3, 0.45, 1.15, 1.7]:
            # Copper fasteners follow the timber surface instead of sitting on a flat plane.
            for t in [0.22, 0.4, 0.58, 0.73, 0.87, 0.97]:
                x, _, z = section(y, t, side)
                work.turned(
                    "Clench nail",
                    (x + side * 0.025, y, z),
                    (side, 0, 0),
                    [(0, 0), (0.012, 0), (0.011, 0.009), (0, 0.012)],
                    "gold",
                    8,
                )


def build_transom(work):
    verts = []
    for side in [-1, 1]:
        verts.extend(section(-2.1, t / 20, side) for t in range(21))
    faces = [(i, i + 1, 22 + i, 21 + i) for i in range(20)]
    work.surface("Curved transom", verts, faces, "oak", thickness=0.04)
    work.sweep(
        "Transom rail",
        [(-0.33, -2.1, 1.24), (0, -2.14, 1.25), (0.33, -2.1, 1.24)],
        0.047,
        "gold",
    )
    work.surface(
        "Rudder blade",
        [(0, -2.12, 0.17), (0, -2.27, 0.1), (0, -2.27, -0.27), (0, -2.08, -0.3)],
        [(0, 1, 2, 3)],
        "oak",
        thickness=0.07,
        bevel=0.018,
    )
    for z in [-0.13, 0.05]:
        work.block("Rudder hinge", (0, -2.12, z), (0.13, 0.12, 0.035), "iron")


def build_deck(work):
    # Long boards with staggered butt joints and grain along the hull's length.
    for row in range(15):
        x = -0.735 + row * 0.105
        for segment in range(5):
            start = -2.05 + segment * 0.82 + (row % 2) * 0.23
            end = min(2.05, start + 0.805)
            if start >= 2.05:
                continue
            ys = [start + (end - start) * i / 16 for i in range(17)]
            valid = [y for y in ys if deck_edge(y) > abs(x) + 0.049]
            if len(valid) < 2:
                continue
            y0, y1 = valid[0], valid[-1]
            work.block(
                "Deck board",
                (x, (y0 + y1) / 2, 0.657),
                (0.098, y1 - y0, 0.045),
                "oak",
                0.004,
            )
            for y in [y0 + 0.03, y1 - 0.03]:
                work.turned(
                    "Deck peg",
                    (x, y, 0.682),
                    (0, 0, 1),
                    [(0, 0), (0.008, 0), (0.008, 0.004), (0, 0.004)],
                    "dark",
                    6,
                )
    work.block("Hatch frame", (0, 0.87, 0.71), (0.55, 0.52, 0.085), "gold", 0.018)
    work.block("Hatch recess", (0, 0.87, 0.76), (0.47, 0.44, 0.022), "dark", 0.01)
    for x in [-0.19, -0.095, 0, 0.095, 0.19]:
        work.block("Hatch grating", (x, 0.87, 0.78), (0.025, 0.43, 0.025), "oak", 0.004)
    for y in [0.72, 0.82, 0.92, 1.02]:
        work.block("Hatch grating", (0, y, 0.777), (0.44, 0.018, 0.022), "oak", 0.003)


def build_bulwarks(work):
    for side in [-1, 1]:
        verts = []
        for i in range(41):
            y = -2.1 + 4.2 * i / 40
            verts.extend(
                [
                    (side * max(0, beam(y) - 0.065), y, sheer(y) - 0.015),
                    (side * max(0, deck_edge(y)), y, 0.68),
                ]
            )
        work.surface(
            "Inner oak bulwark",
            verts,
            [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(40)],
            "oak",
            smooth=True,
        )
        for y in [-1.85, -1.45, -1.05, -0.65, -0.25, 0.15, 0.55, 0.95, 1.35, 1.75]:
            x = side * beam(y)
            z = sheer(y)
            work.block(
                "Gunwale binding", (x, y, z - 0.10), (0.074, 0.07, 0.27), "gold", 0.012
            )
            work.block(
                "Gunwale oak cap", (x, y, z + 0.032), (0.13, 0.2, 0.06), "oak", 0.018
            )
            work.turned(
                "Binding rivet",
                (x + side * 0.045, y, z - 0.11),
                (side, 0, 0),
                [(0, 0), (0.025, 0), (0.025, 0.012), (0, 0.025)],
                "goldlight",
                10,
            )


def build_prow(work):
    work.sweep(
        "Integrated swept stem",
        [
            (0, 2.08, -0.05),
            (0, 2.105, 0.26),
            (0, 2.13, 0.65),
            (0, 2.15, 1.05),
            (0, 2.08, 1.21),
        ],
        0.061,
        "gold",
        10,
    )
    work.turned(
        "Tapered bowsprit",
        (0, 1.18, 0.91),
        (0, 0.93, 0.37),
        [(0, 0), (0.067, 0), (0.06, 0.52), (0.039, 1.27), (0, 1.28)],
        "oak",
        12,
    )
    for distance in [0.18, 0.56, 1.09, 1.2]:
        axis = Vector((0, 0.93, 0.37)).normalized()
        p = Vector((0, 1.18, 0.91)) + axis * distance
        work.turned(
            "Bowsprit ferrule",
            p,
            axis,
            [(0.064, 0), (0.069, 0.012), (0.066, 0.04), (0.05, 0.043)],
            "gold",
            12,
        )
    for side in [-1, 1]:
        pts = []
        for i in range(45):
            angle = i / 44 * math.pi * 3.2
            radius = 0.14 * (1 - i / 55)
            y = 1.66 + radius * math.cos(angle)
            pts.append((side * (beam(y) + 0.038), y, 1.02 + radius * math.sin(angle)))
        work.sweep("Carved bow volute", pts, 0.024, "goldlight")


def build_quarterdeck(work):
    # Curved stern walls and mouldings are lofted to the ship, not a rectangular cabin block.
    ys = [-2.04 + i * 1.09 / 32 for i in range(33)]
    for side in [-1, 1]:
        verts = [
            p
            for y in ys
            for p in [
                (side * beam(y) * 0.84, y, 0.69),
                (side * beam(y) * 0.89, y, 1.30),
            ]
        ]
        work.surface(
            "Sternhouse panel",
            verts,
            [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(32)],
            "enamel",
            smooth=True,
            thickness=0.035,
        )
        for z in [0.73, 1.13, 1.31]:
            work.sweep(
                "Gallery moulding",
                [(side * beam(y) * 0.91, y, z) for y in ys],
                0.025,
                "gold",
            )
        for y in [-1.78, -1.46, -1.15]:
            x = side * beam(y) * 0.91
            work.block(
                "Window recess", (x, y, 1.015), (0.02, 0.21, 0.22), "dark", 0.035
            )
            work.block(
                "Amber window",
                (x + side * 0.012, y, 1.015),
                (0.017, 0.16, 0.17),
                "glass",
                0.03,
            )
            arch = [
                (x + side * 0.031, y + 0.102 * math.cos(a), 1.035 + 0.115 * math.sin(a))
                for a in [i * math.pi / 16 for i in range(17)]
            ]
            work.sweep("Window arch", arch, 0.014, "goldlight")
            work.sweep(
                "Window mullion",
                [(x + side * 0.027, y, 0.93), (x + side * 0.027, y, 1.1)],
                0.009,
                "gold",
            )
        for y in [-1.94, -1.61, -1.29, -0.98]:
            x = side * beam(y) * 0.91
            work.turned(
                "Gallery baluster",
                (x, y, 1.32),
                (0, 0, 1),
                [
                    (0, 0),
                    (0.035, 0),
                    (0.023, 0.04),
                    (0.018, 0.14),
                    (0.03, 0.2),
                    (0, 0.22),
                ],
                "gold",
                10,
            )
        work.sweep(
            "Gallery handrail",
            [(side * beam(y) * 0.92, y, 1.54) for y in ys],
            0.035,
            "oak",
        )
    for i in range(12):
        y = -1.99 + i * 0.088
        work.block(
            "Quarterdeck board",
            (0, y, 1.315),
            (beam(y) * 1.8, 0.083, 0.052),
            "oak",
            0.008,
        )
    work.block(
        "Sternhouse front", (0, -0.953, 1.0), (1.36, 0.04, 0.61), "enamel", 0.025
    )
    work.block("Cabin door", (0, -0.92, 0.94), (0.31, 0.025, 0.44), "oak", 0.025)
    for x in [-0.18, 0.18]:
        work.block("Door jamb", (x, -0.89, 0.94), (0.035, 0.035, 0.49), "gold")
    work.turned(
        "Door handle",
        (0.095, -0.885, 0.94),
        (0, 1, 0),
        [(0, 0), (0.015, 0), (0.015, 0.01), (0, 0.02)],
        "goldlight",
        8,
    )
    for i in range(7):
        work.block(
            "Stair tread",
            (0.49, -0.37 - i * 0.085, 0.7 + i * 0.092),
            (0.32, 0.12, 0.062),
            "oak",
            0.008,
        )
    for x in [0.30, 0.68]:
        work.sweep(
            "Stair stringer", [(x, -0.32, 0.64), (x, -0.94, 1.24)], 0.025, "gold"
        )


def build_artillery(work):
    for side in [-1, 1]:
        for y in {
            1: [-0.35, 0.5],
            2: [-0.82, -0.24, 0.36, 1.0],
            3: [-1.08, -0.58, -0.08, 0.42, 1.0],
        }[work.tier]:
            x, _, z = section(y, 0.58, side)
            work.block(
                "Gunport brass frame",
                (x + side * 0.022, y, z),
                (0.04, 0.24, 0.215),
                "gold",
                0.025,
            )
            work.block(
                "Gunport shadow",
                (x + side * 0.048, y, z),
                (0.035, 0.185, 0.16),
                "dark",
                0.014,
            )
            profile = [
                (0, 0),
                (0.065, 0),
                (0.068, 0.04),
                (0.054, 0.16),
                (0.06, 0.18),
                (0.06, 0.215),
                (0.039, 0.216),
                (0.034, 0.14),
                (0, 0.14),
            ]
            work.turned(
                "Hollow bronze cannon", (x, y, z), (side, 0, 0), profile, "iron", 16
            )
            work.turned(
                "Muzzle reinforcement",
                (x + side * 0.178, y, z),
                (side, 0, 0),
                [(0.06, 0), (0.066, 0.008), (0.066, 0.024), (0.06, 0.034)],
                "gold",
                16,
            )
            flap = work.block(
                "Raised gunport lid",
                (x + side * 0.055, y, z + 0.15),
                (0.13, 0.21, 0.035),
                "enamel",
                0.012,
            )
            center = Vector((x + side * 0.055, y, z + 0.15))
            for vertex in flap.data.vertices:
                relative = vertex.co - center
                angle = side * 0.34
                vertex.co = center + Vector(
                    (
                        relative.x * math.cos(angle) + relative.z * math.sin(angle),
                        relative.y,
                        -relative.x * math.sin(angle) + relative.z * math.cos(angle),
                    )
                )


def sail_position(u, v, y, top, width, height):
    x = (u - 0.5) * width * (1 - 0.08 * v)
    z = top - v * height + 0.13 * (2 * u - 1) ** 2 * v
    belly = 0.42 * math.sin(v * math.pi) * math.sin(u * math.pi)
    folds = 0.014 * math.sin(u * math.pi * 12) * math.sin(v * math.pi)
    return (x, y + 0.14 + belly + folds, z)


def build_canvas(work, index, y, top, width, height):
    cols, rows = 32, 28
    verts = [
        sail_position(i / cols, j / rows, y, top, width, height)
        for j in range(rows + 1)
        for i in range(cols + 1)
    ]
    uv = [(i / cols, 1 - j / rows) for j in range(rows + 1) for i in range(cols + 1)]
    faces = [
        (
            j * (cols + 1) + i,
            j * (cols + 1) + i + 1,
            (j + 1) * (cols + 1) + i + 1,
            (j + 1) * (cols + 1) + i,
        )
        for j in range(rows)
        for i in range(cols)
    ]
    sail = work.surface(f"Sail_{index}", verts, faces, "sail", uv, True)
    sail["clothMastStart"] = [0, 0.54, -y]
    sail["clothMastEnd"] = [0, top + 0.52, -y]
    sail["clothMastRadius"] = 0.063
    for side in [0, 1]:
        clew = sail_position(side, 1, y, top, width, height)
        work.sweep(
            "Clew sheet",
            [clew, ((side * 2 - 1) * beam(y) * 0.86, y - 0.3, 0.94)],
            0.009,
            "rope",
            6,
        )
    # Tied canvas head is pinned in the runtime; the hems and print share its UVs.
    for i in range(13):
        x = (i / 12 - 0.5) * width
        work.sweep(
            "Sail lacing",
            [(x, y + 0.08, top + 0.055), (x, y + 0.16, top - 0.026)],
            0.009,
            "rope",
            6,
        )


def build_rigging(work):
    specs = {
        1: [(0.05, 3.35, 2.20, 2.08)],
        2: [(0.38, 3.46, 2.2, 2.02), (-1.25, 2.95, 1.35, 1.25)],
        3: [(0.5, 3.65, 2.2, 2.13), (-1.2, 3.60, 1.95, 1.65)],
    }[work.tier]
    for index, (y, top, width, height) in enumerate(specs):
        work.turned(
            "Tapered mast",
            (0, y, 0.54),
            (0, 0, 1),
            [
                (0, 0),
                (0.082, 0),
                (0.067, 0.42),
                (0.05, top - 0.3),
                (0.026, top - 0.02),
                (0, top - 0.02),
            ],
            "oak",
            14,
        )
        for z in [0.64, 0.87, top + 0.34]:
            work.turned(
                "Mast brass collar",
                (0, y, z),
                (0, 0, 1),
                [(0.079, 0), (0.088, 0.02), (0.088, 0.048), (0.068, 0.06)],
                "gold",
                14,
            )
        work.turned(
            "Yard",
            (-width * 0.55, y + 0.065, top + 0.045),
            (1, 0, 0),
            [
                (0, 0),
                (0.035, 0),
                (0.052, width * 0.3),
                (0.058, width * 0.55),
                (0.052, width * 0.8),
                (0.035, width * 1.1),
                (0, width * 1.1),
            ],
            "oak",
            12,
        )
        for x in [-width * 0.53, -width * 0.28, 0, width * 0.28, width * 0.53]:
            work.turned(
                "Yard rope binding",
                (x - 0.025, y + 0.065, top + 0.045),
                (1, 0, 0),
                [(0.055, 0), (0.061, 0.01), (0.061, 0.04), (0.055, 0.05)],
                "rope",
                10,
            )
        build_crows_nest(work, y, top)
        build_shrouds(work, y, top)
        build_canvas(work, index, y, top, width, height)
        build_flag(work, index, y, top + 0.48)
    work.sweep(
        "Backstay",
        [
            (0, -2.02, 0.95 if work.tier == 1 else 1.5),
            (0, specs[-1][0], specs[-1][1] + 0.22),
        ],
        0.01,
        "rope",
        6,
    )


def build_crows_nest(work, y, top):
    work.turned(
        "Crows nest bowl",
        (0, y, top + 0.08),
        (0, 0, 1),
        [(0.055, 0), (0.18, 0.045), (0.2, 0.075), (0.2, 0.105), (0.055, 0.105)],
        "oak",
        16,
    )
    for i in range(8):
        angle = i * TAU / 8
        x, dy = 0.18 * math.cos(angle), 0.18 * math.sin(angle)
        work.sweep(
            "Nest stanchion",
            [(x, y + dy, top + 0.17), (x, y + dy, top + 0.34)],
            0.012,
            "gold",
            6,
        )
    work.turned(
        "Nest railing",
        (0, y, top + 0.32),
        (0, 0, 1),
        [(0.177, 0), (0.206, 0), (0.206, 0.033), (0.177, 0.033), (0.177, 0)],
        "goldlight",
        20,
    )


def build_shrouds(work, y, top):
    for side in [-1, 1]:
        head = Vector((0, y, top + 0.15))
        feet = [
            Vector((side * beam(y) * 0.93, y - 0.14 - i * 0.16, 1.02)) for i in range(3)
        ]
        for foot in feet:
            work.sweep("Shroud", [foot, head], 0.01, "rope", 6)
            work.turned(
                "Deadeye",
                foot,
                (side, 0, 0),
                [(0, 0), (0.043, 0), (0.043, 0.025), (0, 0.025)],
                "oak",
                10,
            )
        for i in range(1, 15):
            t = i / 16
            work.sweep(
                "Ratline",
                [feet[0].lerp(head, t), feet[-1].lerp(head, t)],
                0.006,
                "rope",
                5,
            )


def build_flag(work, index, y, top):
    verts = []
    uv = []
    for i in range(25):
        t = i / 24
        for edge in [0, 1]:
            verts.append(
                (
                    0.63 * t,
                    y + 0.055 * math.sin(t * TAU),
                    top + 0.13 - edge * 0.18 * (1 - 0.4 * t),
                )
            )
            uv.append((t, edge))
    work.surface(
        f"Pennant_{index}",
        verts,
        [(i * 2, i * 2 + 1, i * 2 + 3, i * 2 + 2) for i in range(24)],
        "enamel",
        uv,
        True,
    )


def build_fittings(work):
    for x, y in [(-0.34, 1.12), (0.28, 0.10), (-0.39, -0.6)]:
        profile = [
            (0, 0),
            (0.09, 0),
            (0.106, 0.055),
            (0.115, 0.15),
            (0.106, 0.245),
            (0.09, 0.29),
            (0, 0.29),
        ]
        work.turned("Coopered barrel", (x, y, 0.69), (0, 0, 1), profile, "oak", 14)
        for z in [0.735, 0.915]:
            work.turned(
                "Barrel iron hoop",
                (x, y, z),
                (0, 0, 1),
                [(0.104, 0), (0.115, 0.007), (0.115, 0.026), (0.108, 0.033)],
                "iron",
                14,
            )
    before_helm = set(work.root.children)
    # Wheel, hub, handles and pedestal on the raised deck.
    work.block("Helm pedestal", (0, -1.42, 1.43), (0.09, 0.14, 0.22), "oak")
    for i in range(8):
        a = i * TAU / 8
        work.sweep(
            "Wheel spoke",
            [(0, -1.42, 1.63), (0.19 * math.cos(a), -1.42, 1.63 + 0.19 * math.sin(a))],
            0.016,
            "oak",
        )
    work.turned(
        "Wheel rim",
        (0, -1.42, 1.63),
        (0, 1, 0),
        [(0.135, 0), (0.157, 0), (0.157, 0.025), (0.135, 0.025), (0.135, 0)],
        "gold",
        20,
    )
    for side in [-1, 1]:
        y = -1.86
        x = side * 0.42
        work.turned(
            "Stern lantern",
            (x, y, 1.38),
            (0, 0, 1),
            [
                (0, 0),
                (0.075, 0),
                (0.062, 0.04),
                (0.062, 0.2),
                (0.087, 0.215),
                (0, 0.32),
            ],
            "gold",
            8,
        )
        work.turned(
            "Lantern amber",
            (x, y, 1.43),
            (0, 0, 1),
            [(0.059, 0), (0.059, 0.14)],
            "glass",
            8,
        )
        for i in range(4):
            a = i * math.pi / 2
            work.sweep(
                "Lantern mullion",
                [
                    (x + 0.063 * math.cos(a), y + 0.063 * math.sin(a), 1.43),
                    (x + 0.063 * math.cos(a), y + 0.063 * math.sin(a), 1.57),
                ],
                0.008,
                "gold",
                5,
            )
    if work.tier == 1:
        for obj in set(work.root.children) - before_helm:
            for vertex in obj.data.vertices:
                vertex.co.z -= 0.60
    build_shields(work)


def build_shields(work):
    for side in [-1, 1]:
        y = -0.48
        x = side * (beam(y) + 0.055)
        points = [
            (x, y - 0.13, 1.05),
            (x, y + 0.13, 1.05),
            (x, y + 0.115, 0.87),
            (x, y, 0.74),
            (x, y - 0.115, 0.87),
        ]
        work.surface(
            "Class escutcheon",
            points,
            [(0, 1, 2, 3, 4)],
            "enamel",
            thickness=0.025,
            bevel=0.01,
        )
        work.sweep("Shield border", points + [points[0]], 0.014, "goldlight")
        x += side * 0.02
        if work.army == "knight":
            work.sweep(
                "Shield sword", [(x, y, 0.79), (x, y, 0.995)], 0.015, "goldlight"
            )
            work.sweep(
                "Shield crossguard",
                [(x, y - 0.065, 0.93), (x, y + 0.065, 0.93)],
                0.013,
                "goldlight",
            )
        elif work.army == "crossbowman":
            work.sweep("Shield bolt", [(x, y, 0.80), (x, y, 1.015)], 0.013, "goldlight")
            work.sweep(
                "Shield bow",
                [
                    (x, y - 0.075, 0.9),
                    (x, y - 0.05, 0.96),
                    (x, y, 0.975),
                    (x, y + 0.05, 0.96),
                    (x, y + 0.075, 0.9),
                ],
                0.011,
                "goldlight",
            )
        else:
            for i in range(8):
                a = i * TAU / 8
                work.sweep(
                    "Shield sun ray",
                    [
                        (x, y + 0.035 * math.cos(a), 0.925 + 0.035 * math.sin(a)),
                        (x, y + 0.078 * math.cos(a), 0.925 + 0.078 * math.sin(a)),
                    ],
                    0.01,
                    "goldlight",
                    6,
                )
            work.turned(
                "Shield sun",
                (x, y, 0.925),
                (side, 0, 0),
                [(0, 0), (0.028, 0), (0.028, 0.01), (0, 0.015)],
                "goldlight",
                12,
            )


def merge_static_materials(work):
    groups = {}
    for obj in list(work.root.children):
        if not obj.name.startswith(("Sail_", "Pennant_")):
            groups.setdefault(obj.data.materials[0].name, []).append(obj)
    for name, objects in groups.items():
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        objects[0].name = name


def export_ship(work):
    bpy.ops.object.select_all(action="DESELECT")
    work.root.select_set(True)
    for obj in work.root.children:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = work.root
    OUTPUT.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT / f"{work.army}-t{work.tier}.glb"),
        use_selection=True,
        export_format="GLB",
        export_extras=True,
        export_animations=False,
    )


def build_class_equipment(work):
    if work.army == "knight":
        build_artillery(work)
    elif work.army == "crossbowman":
        build_ballista(work)
    else:
        build_sacred_fittings(work)


def build_ballista(work):
    y = 1.13
    z = 0.93
    span = {1: 0.78, 2: 0.98, 3: 1.12}[work.tier]
    work.block(
        "Ballista timber carriage", (0, y, 0.83), (0.36, 0.44, 0.22), "oak", 0.025
    )
    for x in [-0.19, 0.19]:
        for dy in [-0.15, 0.15]:
            work.turned(
                "Carriage wheel",
                (x, y + dy, 0.8),
                (1, 0, 0),
                [(0, 0), (0.07, 0), (0.075, 0.035), (0, 0.045)],
                "iron",
                10,
            )
    work.turned(
        "Ballista turntable",
        (0, y, z),
        (0, 0, 1),
        [(0, 0), (0.17, 0), (0.19, 0.03), (0.17, 0.065), (0, 0.065)],
        "gold",
        16,
    )
    work.block(
        "Ballista stock", (0, y + 0.06, z + 0.14), (0.095, 0.7, 0.1), "oak", 0.012
    )
    work.block(
        "Bolt channel", (0, y + 0.08, z + 0.193), (0.042, 0.65, 0.012), "dark", 0.002
    )
    for dy in [0.12] if work.tier < 3 else [0.06, 0.19]:
        points = [
            (-span / 2, y + dy - 0.07, z + 0.22),
            (-span * 0.32, y + dy + 0.09, z + 0.23),
            (0, y + dy + 0.15, z + 0.235),
            (span * 0.32, y + dy + 0.09, z + 0.23),
            (span / 2, y + dy - 0.07, z + 0.22),
        ]
        work.sweep(
            "Laminated ballista limb",
            points,
            0.025 if work.tier == 1 else 0.033,
            "oak",
            8,
        )
        work.sweep(
            "Ballista limb inlay",
            [(x, yy, zz + 0.025) for x, yy, zz in points],
            0.012,
            "goldlight",
            6,
        )
        work.sweep(
            "Drawn bowstring",
            [points[0], (0, y - 0.24, z + 0.22), points[-1]],
            0.008,
            "rope",
            5,
        )
    work.turned(
        "Siege bolt",
        (0, y - 0.19, z + 0.215),
        (0, 1, 0),
        [(0, 0), (0.013, 0), (0.013, 0.65), (0.035, 0.66), (0, 0.8)],
        "iron",
        8,
    )
    for side in [-1, 1]:
        work.surface(
            "Bolt fletching",
            [
                (0, y - 0.18, z + 0.215),
                (side * 0.065, y - 0.12, z + 0.215),
                (0, y + 0.01, z + 0.215),
            ],
            [(0, 1, 2)],
            "enamel",
            thickness=0.01,
        )
    if work.tier > 1:
        work.turned(
            "Windlass drum",
            (-0.11, y - 0.18, z + 0.14),
            (1, 0, 0),
            [(0, 0), (0.05, 0), (0.05, 0.22), (0, 0.22)],
            "gold",
            12,
        )
        work.sweep(
            "Windlass crank",
            [
                (0.12, y - 0.18, z + 0.14),
                (0.19, y - 0.18, z + 0.14),
                (0.19, y - 0.18, z + 0.22),
                (0.24, y - 0.18, z + 0.22),
            ],
            0.014,
            "iron",
            6,
        )
        work.block(
            "Bolt rack", (-0.25, y - 0.24, 0.99), (0.13, 0.34, 0.045), "gold", 0.008
        )
        for i in range(3):
            x = -0.295 + i * 0.043
            work.turned(
                "Spare bolt",
                (x, y - 0.39, 1.03),
                (0, 1, 0),
                [(0, 0), (0.01, 0), (0.01, 0.27), (0.022, 0.28), (0, 0.35)],
                "iron",
                6,
            )


def build_sacred_fittings(work):
    # Openwork halos and solid carved feathers keep the Paladin silhouette readable.
    y = 1.42
    center = 1.25 if work.tier == 1 else 1.4
    radius = 0.13 if work.tier == 1 else 0.18
    work.turned(
        "Solar prow medallion",
        (0, y, center),
        (0, 1, 0),
        [
            (radius * 0.72, 0),
            (radius, 0),
            (radius, 0.025),
            (radius * 0.72, 0.025),
            (radius * 0.72, 0),
        ],
        "goldlight",
        20,
    )
    for i in range(10):
        a = i * TAU / 10
        work.sweep(
            "Solar ray",
            [
                (radius * math.cos(a), y, center + radius * math.sin(a)),
                (radius * 1.3 * math.cos(a), y, center + radius * 1.3 * math.sin(a)),
            ],
            0.012,
            "goldlight",
            6,
        )
    work.sweep("Prow altar support", [(0, y, 1.04), (0, y, center)], 0.038, "gold", 10)
    if work.tier == 1:
        return
    for side in [-1, 1]:
        for i in range(5 if work.tier == 2 else 7):
            length = 0.30 + i * 0.045
            x0 = side * 0.07
            yy = 1.57 - i * 0.065
            zz = 1.09 + i * 0.018
            verts = [
                (x0, yy, zz),
                (side * (0.18 + length * 0.55), yy - 0.16, zz + 0.10),
                (side * (0.18 + length), yy - 0.36, zz + 0.22),
                (side * (0.11 + length * 0.45), yy - 0.22, zz + 0.015),
            ]
            work.surface(
                "Carved wing feather",
                verts,
                [(0, 1, 2, 3)],
                "goldlight",
                thickness=0.025,
                bevel=0.012,
            )
            work.sweep("Feather spine", [verts[0], verts[2]], 0.01, "gold", 6)
    work.block("Reliquary plinth", (0, 0.81, 0.81), (0.35, 0.38, 0.1), "gold", 0.018)
    work.block("Enamel reliquary", (0, 0.81, 0.96), (0.28, 0.31, 0.22), "enamel", 0.025)
    work.turned(
        "Reliquary crown",
        (0, 0.81, 1.075),
        (0, 0, 1),
        [(0, 0), (0.16, 0), (0.13, 0.045), (0, 0.13)],
        "goldlight",
        8,
    )
    if work.tier == 3:
        build_dragon_figurehead(work)


def build_dragon_figurehead(work):
    # A lofted neck and faceted head, with sculpted brows and tapered horns.
    rings = [
        (1.88, 1.08, 0.085),
        (2.03, 1.22, 0.09),
        (2.07, 1.39, 0.075),
        (2.17, 1.45, 0.07),
    ]
    verts = [
        (
            r * math.cos(j * TAU / 10),
            y + r * 0.55 * math.sin(j * TAU / 10),
            z + r * math.sin(j * TAU / 10),
        )
        for y, z, r in rings
        for j in range(10)
    ]
    work.surface(
        "Dragon neck",
        verts,
        [
            (
                i * 10 + j,
                i * 10 + (j + 1) % 10,
                (i + 1) * 10 + (j + 1) % 10,
                (i + 1) * 10 + j,
            )
            for i in range(3)
            for j in range(10)
        ],
        "gold",
        smooth=True,
    )
    work.block(
        "Dragon muzzle", (0, 2.205, 1.44), (0.15, 0.23, 0.11), "goldlight", 0.025
    )
    work.block("Dragon jaw", (0, 2.20, 1.388), (0.115, 0.19, 0.025), "gold", 0.008)
    for side in [-1, 1]:
        work.turned(
            "Dragon horn",
            (side * 0.06, 2.08, 1.48),
            (side * 0.2, -0.5, 1),
            [(0, 0), (0.03, 0), (0.025, 0.08), (0, 0.21)],
            "goldlight",
            8,
        )
        work.block(
            "Dragon eye",
            (side * 0.077, 2.16, 1.474),
            (0.015, 0.045, 0.024),
            "glass",
            0.006,
        )
        work.sweep(
            "Dragon brow",
            [(side * 0.07, 2.12, 1.49), (side * 0.084, 2.2, 1.5)],
            0.015,
            "goldlight",
            6,
        )


def build_flagship_gallery(work):
    ys = [-2.0 + i * 0.78 / 20 for i in range(21)]
    for side in [-1, 1]:
        verts = [
            point
            for y in ys
            for point in [
                (side * beam(y) * 0.83, y, 1.32),
                (side * beam(y) * 0.77, y, 1.91),
            ]
        ]
        work.surface(
            "Royal upper gallery",
            verts,
            [(2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1) for i in range(20)],
            "enamel",
            smooth=True,
            thickness=0.035,
        )
        for z, factor in [(1.37, 0.84), (1.86, 0.80), (1.94, 0.81)]:
            work.sweep(
                "Royal cornice",
                [(side * beam(y) * factor, y, z) for y in ys],
                0.028,
                "gold",
            )
        for y in [-1.82, -1.57, -1.32]:
            x = side * beam(y) * 0.825
            work.block(
                "Royal window recess", (x, y, 1.63), (0.025, 0.18, 0.35), "dark", 0.025
            )
            work.block(
                "Royal window glass",
                (x + side * 0.012, y, 1.63),
                (0.018, 0.14, 0.28),
                "glass",
                0.025,
            )
            work.sweep(
                "Royal window arch",
                [
                    (
                        x + side * 0.028,
                        y + 0.10 * math.cos(a),
                        1.69 + 0.15 * math.sin(a),
                    )
                    for a in [i * math.pi / 12 for i in range(13)]
                ],
                0.014,
                "goldlight",
                6,
            )
            work.sweep(
                "Royal window mullion",
                [(x + side * 0.027, y, 1.48), (x + side * 0.027, y, 1.78)],
                0.009,
                "gold",
                6,
            )
    # A low cambered roof closes the upper gallery and integrates its tier silhouette.
    verts = []
    for y in ys:
        w = beam(y) * 0.83
        verts.extend(
            (w * u, y, 1.94 + 0.075 * (1 - u * u)) for u in [-1, -0.5, 0, 0.5, 1]
        )
    work.surface(
        "Royal cambered roof",
        verts,
        [
            (i * 5 + j, (i + 1) * 5 + j, (i + 1) * 5 + j + 1, i * 5 + j + 1)
            for i in range(20)
            for j in range(4)
        ],
        "oak",
        smooth=True,
        thickness=0.045,
    )
    work.block(
        "Upper gallery front", (0, -1.21, 1.63), (1.16, 0.04, 0.59), "enamel", 0.025
    )
    work.block(
        "Royal front crest", (0, -1.18, 1.64), (0.19, 0.025, 0.26), "gold", 0.025
    )


def shape_tier_hull(work):
    # Transform the whole hull assembly together so joinery and fittings remain attached.
    if work.tier == 2:
        return
    for obj in work.root.children:
        for vertex in obj.data.vertices:
            y = vertex.co.y
            if work.tier == 1:
                vertex.co.x *= 1.025
                vertex.co.z *= 0.92
            else:
                vertex.co.x *= 1.045 - 0.012 * y


def weld_static_meshes(work):
    for obj in work.root.children:
        if obj.name.startswith(("Sail_", "Pennant_")):
            continue
        mesh = bmesh.new()
        mesh.from_mesh(obj.data)
        bmesh.ops.remove_doubles(mesh, verts=list(mesh.verts), dist=0.000001)
        bmesh.ops.dissolve_degenerate(mesh, edges=list(mesh.edges), dist=0.0000001)
        mesh.to_mesh(obj.data)
        mesh.free()
        obj.data.update()


def build_ship(army, tier):
    if army not in CLASSES or tier not in (1, 2, 3):
        raise ValueError(f"Unknown fleet variant: {army} T{tier}")
    work = Workshop(army, tier)
    build_hull(work)
    if tier > 1:
        build_quarterdeck(work)
    if tier == 3:
        build_flagship_gallery(work)
    build_class_equipment(work)
    build_fittings(work)
    shape_tier_hull(work)
    build_rigging(work)
    merge_static_materials(work)
    weld_static_meshes(work)
    export_ship(work)
    return work.root
