"""Author the selected Craft Yard, painted surfaces and contact bakes."""

import hashlib
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

SOURCE = Path(__file__).resolve().parents[2] / "asset-sources/workshops"
SWATCH = {"clay": (0, 1), "oak": (1, 1), "stone": (0, 0), "plaster": (1, 0)}


class Workshop:
    def __init__(self, name):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.name = name
        self.rng = random.Random(481)
        self.edit = bpy.data.collections.new("WORKSHOP_EDITABLE")
        self.delivery = bpy.data.collections.new("WORKSHOP_DELIVERY")
        for collection in (self.edit, self.delivery):
            bpy.context.scene.collection.children.link(collection)
        self.paint = bpy.data.images.load(str(SOURCE / "painted-surfaces.png"))
        self.paint.scale(480, 480)
        self.paint.pack()
        self.material = self.make_material()

    def make_material(self):
        mat = bpy.data.materials.new("Workshop painted oak clay limewash and stone")
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = 0.82
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = self.paint
        uv = nodes.new("ShaderNodeUVMap")
        uv.uv_map = "Painted surface"
        links.new(uv.outputs["UV"], tex.inputs["Vector"])
        tint = nodes.new("ShaderNodeVertexColor")
        tint.layer_name = "Contact and tint"
        mix = nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 1
        links.new(tex.outputs["Color"], mix.inputs[1])
        links.new(tint.outputs["Color"], mix.inputs[2])
        links.new(mix.outputs[0], shader.inputs["Base Color"])
        return mat

    def mesh(self, name, verts, faces, surface="oak", tint=(1, 1, 1), uvs=None):
        data = bpy.data.meshes.new(name)
        data.from_pydata(verts, [], faces)
        data.update()
        bm = bmesh.new()
        bm.from_mesh(data)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(data)
        bm.free()
        obj = bpy.data.objects.new(name, data)
        self.edit.objects.link(obj)
        data.materials.append(self.material)
        data.uv_layers.new(name="Painted surface")
        data.color_attributes.new(
            name="Contact and tint", type="FLOAT_COLOR", domain="CORNER"
        )
        uv = data.uv_layers["Painted surface"]
        color = data.color_attributes["Contact and tint"]
        tx, ty = SWATCH[surface]
        tone = (
            self.rng.uniform(0.94, 1.03)
            if surface == "clay"
            else self.rng.uniform(0.88, 1.04)
        )
        for face in data.polygons:
            axes = sorted(range(3), key=lambda a: abs(face.normal[a]))[:2]
            points = [
                data.vertices[data.loops[i].vertex_index].co for i in face.loop_indices
            ]
            limits = [
                (min(p[a] for p in points), max(p[a] for p in points)) for a in axes
            ]
            for loop in face.loop_indices:
                vi = data.loops[loop].vertex_index
                p = data.vertices[vi].co
                sample = (
                    uvs[vi]
                    if uvs
                    else [
                        (p[a] - lo) / max(hi - lo, 0.001)
                        for a, (lo, hi) in zip(axes, limits)
                    ]
                )
                uv.data[loop].uv = (
                    (tx + 0.035 + 0.93 * sample[0]) / 2,
                    (ty + 0.035 + 0.93 * sample[1]) / 2,
                )
                color.data[loop].color = (*(t * tone for t in tint), 1)
        if any(abs(item.color[3] - 1) > 0.0001 for item in color.data):
            raise ValueError(f"{name}: invalid painted color attribute")
        if any(
            not (
                tx / 2 <= item.uv.x <= (tx + 1) / 2
                and ty / 2 <= item.uv.y <= (ty + 1) / 2
            )
            for item in uv.data
        ):
            raise ValueError(f"{name}: painted UV escaped its material swatch")
        data.color_attributes.active_color = color
        return obj

    def contour(self, name, outline, depth, surface="oak", tint=(1, 1, 1)):
        """Extrude an authored face contour; the silhouette carries chips and joinery."""
        n = len(outline)
        verts = [tuple(Vector(p) + Vector(depth) * t) for t in (0, 1) for p in outline]
        faces = [tuple(reversed(range(n))), tuple(range(n, 2 * n))]
        faces += [(i, (i + 1) % n, (i + 1) % n + n, i + n) for i in range(n)]
        return self.mesh(name, verts, faces, surface, tint)

    def timber(self, name, a, b, width, depth=None, tint=(0.61, 0.53, 0.43)):
        """Adzed, tapered timber with an inset end and a worn eight-edge section."""
        a, b = Vector(a), Vector(b)
        axis = (b - a).normalized()
        u = axis.cross(Vector((0, 0, 1)))
        if u.length < 0.1:
            u = Vector((1, 0, 0))
        u.normalize()
        v = axis.cross(u)
        depth = depth or width
        profile = [
            (-0.38, -0.5),
            (0.37, -0.5),
            (0.5, -0.36),
            (0.5, 0.35),
            (0.34, 0.5),
            (-0.37, 0.5),
            (-0.5, 0.34),
            (-0.5, -0.35),
        ]
        verts, uvs = [], []
        for r, along in enumerate((0, 0.08, 0.91, 1)):
            for j, (x, y) in enumerate(profile):
                wear = 0.91 if r in (0, 3) else 1
                p = a.lerp(b, along) + u * (x * width * wear) + v * (y * depth * wear)
                if r in (1, 2):
                    p += u * (0.008 * width * math.sin(j * 3 + r))
                verts.append(tuple(p))
                uvs.append((j / 8, along))
        faces = [tuple(reversed(range(8))), tuple(range(24, 32))]
        faces += [
            (r * 8 + j, r * 8 + (j + 1) % 8, (r + 1) * 8 + (j + 1) % 8, (r + 1) * 8 + j)
            for r in range(3)
            for j in range(8)
        ]
        return self.mesh(name, verts, faces, tint=tint, uvs=uvs)

    def move(self, before, x=0, y=0, yaw=0):
        matrix = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(yaw, 4, "Z")
        for obj in set(self.edit.objects) - before:
            obj.data.transform(matrix)


def roof(w, x, y, width, depth, eave, rise, rows=4, columns=10):
    """Staggered clay courses over a closed timber deck, with seated ridge caps."""
    # The continuous deck closes the underside and gives every tile an actual bearing surface.
    section = [
        (x - width / 2, y - depth / 2, eave - 0.028),
        (x - width / 2, y, eave + rise - 0.028),
        (x - width / 2, y + depth / 2, eave - 0.028),
        (x - width / 2, y + depth / 2, eave - 0.057),
        (x - width / 2, y, eave + rise - 0.057),
        (x - width / 2, y - depth / 2, eave - 0.057),
    ]
    w.contour("Roof underside and continuous boarding", section, (width, 0, 0))
    tile_width = width / columns
    for side in (-1, 1):
        for row in range(rows):
            stagger = (row % 2) * 0.5
            for col in range(columns + (row % 2)):
                left = max(x - width / 2, x - width / 2 + (col - stagger) * tile_width)
                right = min(x + width / 2, x - width / 2 + (col + 1 - stagger) * tile_width)
                # A hairline joint preserves courses; no lifted corners or random gaps in the roof plane.
                left += 0.001
                right -= 0.001
                a, b = row / rows, min(1.035, (row + 1.18) / rows)
                verts, uvs = [], []
                for t in (a, b):
                    for u in (0, 0.25, 0.5, 0.75, 1):
                        xx = left + u * (right - left)
                        yy = y + side * t * depth / 2
                        zz = (
                            eave + rise * (1 - t)
                            + 0.008 * math.sin(u * math.pi)
                            + 0.006 * (rows - row)
                        )
                        verts.append((xx, yy, zz))
                        uvs.append((u, (t - a) / (b - a)))
                faces = [(c, c + 1, c + 6, c + 5) for c in range(4)]
                verts += [(xx, yy, zz - 0.012) for xx, yy, zz in verts]
                uvs += uvs[:]
                faces += [tuple(i + 10 for i in reversed(face)) for face in faces[:]]
                border = [0, 1, 2, 3, 4, 9, 8, 7, 6, 5]
                faces += [
                    (a, b, b + 10, a + 10)
                    for a, b in zip(border, border[1:] + border[:1])
                ]
                tile = w.mesh("Staggered lapped clay tile", verts, faces, "clay", uvs=uvs)
                for face in tile.data.polygons[:4]:
                    face.use_smooth = True
        w.timber(
            "Straight supported eave",
            (x - width / 2, y + side * depth / 2, eave - 0.04),
            (x + width / 2, y + side * depth / 2, eave - 0.04),
            0.035,
        )
    for xx in (x - width / 2, x + width / 2):
        for side in (-1, 1):
            w.timber(
                "Fitted gable fascia",
                (xx, y, eave + rise - 0.025),
                (xx, y + side * depth * 0.52, eave - 0.036),
                0.037,
            )
    # The caps sit on the top course; overlapping end lips follow the same ridge line.
    for i in range(columns):
        xx = x - width / 2 + i * tile_width
        vertices = []
        for end in (0, 1):
            for radius in (0.037, 0.025):
                for j in range(5):
                    angle = j * math.pi / 4
                    vertices.append(
                        (
                            min(x + width / 2, xx + end * tile_width * 1.06),
                            y + radius * math.cos(angle),
                            eave + rise + 0.006 * rows + radius * math.sin(angle),
                        )
                    )
        faces = []
        for j in range(4):
            faces += [
                (j, j + 1, j + 11, j + 10),
                (j + 5, j + 15, j + 16, j + 6),
                (j, j + 5, j + 6, j + 1),
                (j + 10, j + 11, j + 16, j + 15),
            ]
        faces += [(0, 10, 15, 5), (4, 9, 19, 14)]
        w.mesh("Seated clay ridge cap", vertices, faces, "clay")


def plaster_wall(w, name, a, b, height, gable=0):
    x0, y0 = a
    x1, y1 = b
    direction = Vector((x1 - x0, y1 - y0, 0)).normalized()
    normal = Vector((-direction.y, direction.x, 0)) * 0.035
    outline = [(x0, y0, 0.09), (x1, y1, 0.09), (x1, y1, height)]
    if gable:
        outline.append(((x0 + x1) / 2, (y0 + y1) / 2, height + gable))
    outline.append((x0, y0, height))
    outline = [tuple(Vector(point) - normal / 2) for point in outline]
    w.contour(name, outline, normal, "plaster", (0.93, 0.92, 0.85))
    w.timber("Wall sill", (x0, y0, 0.14), (x1, y1, 0.14), 0.047)
    w.timber("Wall plate", (x0, y0, height), (x1, y1, height), 0.060)
    for t in (0, 0.5, 1):
        x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        w.timber("Mortised wall upright", (x, y, 0.10), (x, y, height), 0.060)
    for t0, t1 in ((0.04, 0.44), (0.56, 0.96)):
        w.timber(
            "Diagonal wall brace",
            (x0 + (x1 - x0) * t0, y0 + (y1 - y0) * t0, 0.19),
            (x0 + (x1 - x0) * t1, y0 + (y1 - y0) * t1, height - 0.05),
            normal.length * 1.3,
        )


def paving(w):
    # Each exposed stone is an irregular polygon; no slab hides the terrain contact.
    for row in range(7):
        for col in range(8):
            x = (col - 3.5) * 0.18 + (row % 2) * 0.085
            y = (row - 3) * 0.20
            if abs(x) > 0.72 or abs(x) + abs(y) * 0.58 > 0.97:
                continue
            outline = []
            for dx, dy in [
                (-0.079, -0.075),
                (0.005, -0.093),
                (0.078, -0.067),
                (0.085, 0.020),
                (0.045, 0.086),
                (-0.064, 0.077),
                (-0.084, 0.008),
            ]:
                outline.append(
                    (
                        x + dx + w.rng.uniform(-0.008, 0.008),
                        y + dy + w.rng.uniform(-0.008, 0.008),
                        0.022 + w.rng.uniform(-0.003, 0.003),
                    )
                )
            w.contour(
                "Worn yard flagstone",
                outline,
                (0, 0, -0.030),
                "stone",
                (0.90, 0.91, 0.90),
            )


def bench(w, x, y, width=0.48, depth=0.23, yaw=0):
    before = set(w.edit.objects)
    # One continuous trestle profile includes spread feet, shoulders and lap-joint notches.
    profile = [
        (-0.17, 0, 0.027),
        (-0.11, 0, 0.027),
        (-0.072, 0, 0.28),
        (0.072, 0, 0.28),
        (0.11, 0, 0.027),
        (0.17, 0, 0.027),
        (0.116, 0, 0.32),
        (0.07, 0, 0.335),
        (-0.07, 0, 0.335),
        (-0.116, 0, 0.32),
    ]
    profile = [(px * depth / 0.32, py, pz) for px, py, pz in profile]
    for xx in (-width * 0.38, width * 0.38):
        obj = w.contour(
            "Carved trestle with splayed feet",
            profile,
            (0, 0.065, 0),
            tint=(0.70, 0.59, 0.43),
        )
        obj.data.transform(
            Matrix.Translation((xx, 0, 0)) @ Matrix.Rotation(math.pi / 2, 4, "Z")
        )
    for row in range(3):
        yy = (row - 1) * depth / 3
        w.timber(
            "Worn worktop plank",
            (-width / 2, yy, 0.342),
            (width / 2, yy, 0.342),
            depth / 3 - 0.004,
            0.045,
            (1.06, 0.98, 0.79),
        )
    w.timber(
        "Trestle stretcher",
        (-width * 0.4, 0, 0.13),
        (width * 0.4, 0, 0.13),
        0.049,
        0.060,
    )
    for xx in (-width * 0.47, width * 0.47):
        w.timber(
            "Bench end vise",
            (xx, -depth * 0.60, 0.29),
            (xx, -depth * 0.60, 0.40),
            0.055,
            0.080,
            (0.60, 0.48, 0.32),
        )
    # Small carpenter's plane: hollow handle silhouette and a raked dark iron blade.
    w.contour(
        "Jack plane sole",
        [
            (-0.09, -0.04, 0.374),
            (0.075, -0.04, 0.374),
            (0.085, -0.04, 0.396),
            (-0.08, -0.04, 0.401),
        ],
        (0, 0.058, 0),
        tint=(0.43, 0.33, 0.23),
    )
    w.contour(
        "Plane blade",
        [
            (-0.016, -0.025, 0.397),
            (0.009, -0.025, 0.400),
            (0.029, -0.025, 0.447),
            (0.011, -0.025, 0.447),
        ],
        (0, 0.028, 0),
        "stone",
        (0.15, 0.17, 0.18),
    )
    w.move(before, x, y, yaw)


def tool_rack(w, x, y, z):
    w.timber("Tool rail", (x - 0.19, y, z), (x + 0.19, y, z), 0.037)
    # Serrations are silhouette topology, not an alpha card.
    edge = [
        (x - 0.09, y - 0.021, z - 0.035),
        (x - 0.01, y - 0.021, z - 0.035),
        (x - 0.042, y - 0.021, z - 0.30),
    ]
    edge += [
        (x - 0.080 + (0.010 if i % 2 else 0), y - 0.021, z - 0.30 + i * 0.024)
        for i in range(12)
    ]
    w.contour("Hanging carpenter saw", edge, (0, 0.008, 0), "stone", (0.20, 0.23, 0.24))
    w.timber(
        "Saw grip",
        (x - 0.105, y - 0.026, z - 0.005),
        (x + 0.002, y - 0.026, z - 0.005),
        0.028,
        0.026,
        (0.42, 0.32, 0.22),
    )
    w.timber(
        "Mallet handle",
        (x + 0.12, y - 0.025, z - 0.25),
        (x + 0.12, y - 0.025, z - 0.025),
        0.020,
        0.022,
        (0.85, 0.70, 0.49),
    )
    w.timber(
        "Mallet head",
        (x + 0.069, y - 0.025, z - 0.06),
        (x + 0.17, y - 0.025, z - 0.06),
        0.050,
        0.043,
        (0.55, 0.43, 0.28),
    )


def lumber(w, x, y, elevation=0):
    for row in range(3):
        for col in range(3):
            w.timber(
                "Stacked sawn oak",
                (x - 0.18, y + (col - 1) * 0.054, 0.09 + row * 0.038 + elevation),
                (x + 0.18, y + (col - 1) * 0.054, 0.09 + row * 0.038 + elevation),
                0.049,
                0.030,
                (1.02, 0.88, 0.65),
            )


def craft_yard(w):
    paving(w)
    plaster_wall(w, "Rear workshop wall", (-0.58, 0.49), (0.58, 0.49), 0.63)
    plaster_wall(w, "Left hall return", (-0.58, 0.49), (-0.58, 0.10), 0.63, 0.22)
    roof(w, 0, 0.31, 1.29, 0.56, 0.65, 0.22, rows=3, columns=10)
    for x in (-0.57, 0.57):
        w.timber("Hall front upright", (x, 0.065, 0.03), (x, 0.065, 0.67), 0.071)
        w.timber(
            "Hall knee brace",
            (x, 0.065, 0.46),
            (x - math.copysign(0.16, x), 0.065, 0.64),
            0.039,
        )
    w.timber("Hall open beam", (-0.61, 0.065, 0.65), (0.61, 0.065, 0.65), 0.064)
    before = set(w.edit.objects)
    plaster_wall(w, "Wing outer wall", (-0.35, 0.18), (0.35, 0.18), 0.50)
    plaster_wall(w, "Wing gable", (-0.35, -0.18), (-0.35, 0.18), 0.50, 0.12)
    roof(w, 0, 0, 0.78, 0.46, 0.52, 0.12, rows=3, columns=6)
    for x in (-0.35, 0.35):
        w.timber("Wing post", (x, -0.18, 0.035), (x, -0.18, 0.54), 0.060)
    w.timber("Wing beam", (-0.37, -0.18, 0.52), (0.37, -0.18, 0.52), 0.060)
    w.move(before, 0.52, -0.20, math.pi / 2)
    bench(w, 0.035, -0.40, 0.48, 0.23, math.pi / 2)
    tool_rack(w, -0.13, 0.445, 0.55)
    lumber(w, 0.52, -0.20)
    before = set(w.edit.objects)
    for yy in (-0.51, 0.26):
        w.timber("Hoist upright", (-0.57, yy, 0.025), (-0.57, yy, 0.82), 0.072)
        end = yy + (0.18 if yy < 0 else -0.18)
        w.timber("Hoist knee", (-0.57, yy, 0.58), (-0.57, end, 0.79), 0.045)
    w.timber("Hoist top beam", (-0.57, -0.60, 0.81), (-0.57, 0.34, 0.81), 0.080)
    # Pulley cheek profile and rope are separate from the load; static rig at rest.
    cheek = [
        (-0.603, -0.26, 0.78),
        (-0.536, -0.26, 0.78),
        (-0.526, -0.26, 0.71),
        (-0.548, -0.26, 0.675),
        (-0.590, -0.26, 0.675),
        (-0.615, -0.26, 0.71),
    ]
    w.contour("Iron pulley cheeks", cheek, (0, 0.042, 0), "stone", (0.14, 0.17, 0.19))
    for yy in (-0.245, -0.216):
        w.timber(
            "Taut hemp hoist rope",
            (-0.57, yy, 0.70),
            (-0.57, yy, 0.39),
            0.010,
            0.010,
            (0.85, 0.78, 0.58),
        )
    lumber(w, -0.53, -0.23, elevation=0.10)
    for yy in (-0.29, -0.18):
        w.timber(
            "Sling",
            (-0.70, yy, 0.175),
            (-0.57, -0.23, 0.39),
            0.009,
            0.009,
            (0.75, 0.67, 0.46),
        )
        w.timber(
            "Sling",
            (-0.36, yy, 0.175),
            (-0.57, -0.23, 0.39),
            0.009,
            0.009,
            (0.75, 0.67, 0.46),
        )

    w.move(before, -0.08, -0.025)


def bake_sculpted_surfaces(w, model):
    """Bake the worn high-resolution architecture onto the unwrapped delivery mesh."""
    sculpt = bpy.data.collections.new("WORKSHOP_SCULPT")
    bpy.context.scene.collection.children.link(sculpt)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in w.edit.objects:
        high = obj.copy()
        high.data = obj.data.copy()
        sculpt.objects.link(high)
        high.select_set(True)
        bpy.context.view_layer.objects.active = high
    bpy.ops.object.join()
    high = bpy.context.object
    high.name = w.name + " / worn architecture sculpt"
    bevel = high.modifiers.new("Rounded adze marks and worn tile edges", "BEVEL")
    bevel.width = 0.0025
    bevel.segments = 3
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = 0.6
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    subdiv = high.modifiers.new("Surface sculpt resolution", "SUBSURF")
    subdiv.subdivision_type = "SIMPLE"
    subdiv.levels = 2
    wear = bpy.data.textures.new("Fine worn construction relief", type="CLOUDS")
    wear.noise_scale = 0.026
    wear.noise_depth = 2
    displace = high.modifiers.new("Worn oak clay and limestone relief", "DISPLACE")
    displace.texture = wear
    displace.strength = 0.0014
    # The dense editable sculpt keeps its original painted UVs; delivery gets a unique bake layout.
    bpy.ops.object.select_all(action="DESELECT")
    model.select_set(True)
    bpy.context.view_layer.objects.active = model
    model.data.uv_layers.new(name="Sculpt bake")
    model.data.uv_layers.active_index = 1
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.008)
    bpy.ops.object.mode_set(mode="OBJECT")
    material = w.material.copy()
    material.name = "Painted workshop with sculpted normals"
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get("Principled BSDF")
    model.data.materials.clear()
    model.data.materials.append(material)
    bake = bpy.context.scene.render.bake
    bake.target = "IMAGE_TEXTURES"
    bake.use_selected_to_active = True
    bake.cage_extrusion = 0.006
    bake.max_ray_distance = 0.015
    high.select_set(True)
    image = bpy.data.images.new(
        w.name + " / sculpted normals", width=240, height=240, alpha=False
    )
    image.colorspace_settings.name = "Non-Color"
    target = nodes.new("ShaderNodeTexImage")
    target.image = image
    nodes.active = target
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=3)
    image.pack()
    bake.use_selected_to_active = False
    sculpt.hide_render = True
    sculpt.hide_viewport = True
    uv = nodes.new("ShaderNodeUVMap")
    uv.uv_map = "Sculpt bake"
    links.new(uv.outputs["UV"], target.inputs["Vector"])
    normal = nodes.new("ShaderNodeNormalMap")
    normal.uv_map = "Sculpt bake"
    normal.inputs["Strength"].default_value = 0.4
    links.new(target.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], shader.inputs["Normal"])
    model.data.uv_layers.active_index = 0
    model.data.uv_layers[0].active_render = True
    bpy.ops.object.select_all(action="DESELECT")
    model.select_set(True)
    bpy.context.view_layer.objects.active = model


def finish(w):
    configure_contact_bake()
    model = consolidate_delivery(w)
    bake_sculpted_surfaces(w, model)
    bake_contact_shading(model)
    save_workshop_source(w, model)


def configure_contact_bake():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2


def consolidate_delivery(w):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in w.edit.objects:
        # Keep the source on the same radius-one footprint as the shipped family.
        obj.data.transform(Matrix.Scale(0.94, 4))
        clone = obj.copy()
        clone.data = obj.data.copy()
        w.delivery.objects.link(clone)
        clone.select_set(True)
        bpy.context.view_layer.objects.active = clone
    bpy.ops.object.join()
    model = bpy.context.object
    model.name = w.name + " / painted mesh"
    w.edit.hide_render = True
    w.edit.hide_viewport = True
    triangles = sum(len(face.vertices) - 2 for face in model.data.polygons)
    reduce = model.modifiers.new("Delivery retopology budget", "DECIMATE")
    reduce.ratio = min(1, 6100 / triangles)
    reduce.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=reduce.name)
    return model


def bake_contact_shading(model):
    colors = model.data.color_attributes["Contact and tint"]
    original = [tuple(c.color) for c in colors.data]
    bpy.context.scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.bake(type="AO")
    for item, tint in zip(colors.data, original):
        contact = 0.68 + 0.32 * max(0, min(1, item.color[0]))
        item.color = (*(c * contact for c in tint[:3]), 1)


def save_workshop_source(w, model):
    scene = bpy.context.scene
    scene["conceptPainting"] = w.name + ".png"
    scene["conceptSha256"] = hashlib.sha256(
        (SOURCE / (w.name + ".png")).read_bytes()
    ).hexdigest()
    scene["surfaceSha256"] = hashlib.sha256(
        (SOURCE / "painted-surfaces.png").read_bytes()
    ).hexdigest()
    scene["sourceRole"] = "Craft Yard: production Workshop, ResourceLabor outside the central keep"
    scene["groundContact"] = "Z=0 terrain top, open flagstones, no plinth"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(
        filepath=str(SOURCE / (w.name + ".blend")), compress=True
    )
    print(w.name, sum(len(p.vertices) - 2 for p in model.data.polygons), "triangles")


def main():
    workshop = Workshop("craft-yard")
    craft_yard(workshop)
    finish(workshop)


if __name__ == "__main__":
    main()
