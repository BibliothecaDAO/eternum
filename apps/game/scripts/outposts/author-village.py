"""Build the selected Canvas & Thatch village and pack its editable source."""

import hashlib
import json
import math
import random
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

SOURCE = Path(__file__).resolve().parents[2] / "asset-sources/outposts"
PAINTING = SOURCE / "village/concept.png"
TILES = {"reed": (0, 1), "wood": (1, 1), "stone": (0, 0), "plaster": (1, 0)}


class Village:
    def __init__(self, name):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.name = name
        self.rng = random.Random(73)
        self.editable = bpy.data.collections.new("OUTPOST_EDITABLE")
        self.production = bpy.data.collections.new("OUTPOST_PRODUCTION")
        for collection in (self.editable, self.production):
            bpy.context.scene.collection.children.link(collection)
        self.atlas = bpy.data.images.load(str(SOURCE / "village/painted-surfaces.png"))
        self.atlas.name = "Painted straw oak fieldstone and limewash"
        self.atlas.scale(480, 480)
        self.atlas.pack()
        self.materials = [
            self.material("Painted village", True),
            self.material("Ownership cloth", False),
            self.material("Hearth and windows", False, True),
        ]

    def material(self, name, textured, glowing=False):
        material = bpy.data.materials.new(name)
        material.use_nodes = True
        material.use_backface_culling = False
        nodes, links = material.node_tree.nodes, material.node_tree.links
        shader = nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = 0.86
        tint = nodes.new("ShaderNodeVertexColor")
        tint.layer_name = "Surface tint"
        color = tint.outputs["Color"]
        if textured:
            tex = nodes.new("ShaderNodeTexImage")
            tex.image = self.atlas
            uv = nodes.new("ShaderNodeUVMap")
            uv.uv_map = "Painted surface"
            links.new(uv.outputs["UV"], tex.inputs["Vector"])
            mix = nodes.new("ShaderNodeMixRGB")
            mix.blend_type = "MULTIPLY"
            mix.inputs[0].default_value = 1
            links.new(tex.outputs["Color"], mix.inputs[1])
            links.new(color, mix.inputs[2])
            color = mix.outputs[0]
        links.new(color, shader.inputs["Base Color"])
        if glowing:
            shader.inputs["Emission Color"].default_value = (1, 0.28, 0.035, 1)
            shader.inputs["Emission Strength"].default_value = 1.1
        return material

    def mesh(
        self, name, verts, faces, tile="wood", tint=(1, 1, 1), material=0, uvs=None
    ):
        data = bpy.data.meshes.new(name)
        data.from_pydata(verts, [], faces)
        data.update()
        bm = bmesh.new()
        bm.from_mesh(data)
        if all(edge.is_manifold for edge in bm.edges):
            bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(data)
        bm.free()
        obj = bpy.data.objects.new(name, data)
        self.editable.objects.link(obj)
        data.materials.append(self.materials[material])
        uv = data.uv_layers.new(name="Painted surface")
        color = data.color_attributes.new(
            name="Surface tint", type="FLOAT_COLOR", domain="CORNER"
        )
        tone = self.rng.uniform(0.88, 1.08)
        tx, ty = TILES[tile]
        for face in data.polygons:
            axes = sorted(range(3), key=lambda a: abs(face.normal[a]))[:2]
            points = [
                data.vertices[data.loops[i].vertex_index].co for i in face.loop_indices
            ]
            bounds = [
                (min(p[a] for p in points), max(p[a] for p in points)) for a in axes
            ]
            for loop in face.loop_indices:
                vertex = data.loops[loop].vertex_index
                point = data.vertices[vertex].co
                sample = (
                    uvs[vertex]
                    if uvs
                    else [
                        (point[a] - lo) / max(hi - lo, 0.001)
                        for a, (lo, hi) in zip(axes, bounds)
                    ]
                )
                uv.data[loop].uv = (
                    (tx + 0.035 + 0.93 * sample[0]) / 2,
                    (ty + 0.035 + 0.93 * sample[1]) / 2,
                )
                color.data[loop].color = (*(v * tone for v in tint), 1)
        data.color_attributes.active_color = color
        return obj

    def timber(self, name, a, b, width, tile="wood", tint=(1, 1, 1)):
        a, b = Vector(a), Vector(b)
        axis = (b - a).normalized()
        u = axis.cross(Vector((0, 0, 1)))
        if u.length < 0.01:
            u = axis.cross(Vector((0, 1, 0)))
        u.normalize()
        v = axis.cross(u)
        vertices = [
            p
            + width * (math.cos(i * math.tau / 5) * u + math.sin(i * math.tau / 5) * v)
            for p in (a, b)
            for i in range(5)
        ]
        faces = [tuple(reversed(range(5))), tuple(range(5, 10))]
        faces += [(i, (i + 1) % 5, (i + 1) % 5 + 5, i + 5) for i in range(5)]
        return self.mesh(name, vertices, faces, tile, tint)

    def block(
        self, name, center, size, tile="wood", tint=(1, 1, 1), material=0, wear=0.03
    ):
        # An eight-sided plan leaves chipped corners in the silhouette.
        x, y, z = center
        w, d, h = size
        cut = min(w, d) * 0.14
        plan = [
            (-w / 2 + cut, -d / 2),
            (w / 2 - cut, -d / 2),
            (w / 2, -d / 2 + cut),
            (w / 2, d / 2 - cut),
            (w / 2 - cut, d / 2),
            (-w / 2 + cut, d / 2),
            (-w / 2, d / 2 - cut),
            (-w / 2, -d / 2 + cut),
        ]
        verts = [
            (
                x + px + self.rng.uniform(-wear, wear) * w,
                y + py + self.rng.uniform(-wear, wear) * d,
                z + zz + self.rng.uniform(-wear, wear) * h,
            )
            for zz in (-h / 2, h / 2)
            for px, py in plan
        ]
        faces = [tuple(reversed(range(8))), tuple(range(8, 16))]
        faces += [(i, (i + 1) % 8, (i + 1) % 8 + 8, i + 8) for i in range(8)]
        return self.mesh(name, verts, faces, tile, tint, material)

    def mark_architecture(self, before):
        for obj in set(self.editable.objects) - before:
            obj["yardArchitecture"] = True

    def transform_new(self, before, x, y, angle):
        matrix = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(angle, 4, "Z")
        for obj in set(self.editable.objects) - before:
            obj.data.transform(matrix)


def cottage(v, x, y, width, depth, wall, rise, yaw):
    before = set(v.editable.objects)
    w, d = width / 2, depth / 2
    v.block(
        "Uneven limewashed walls",
        (0, 0, wall / 2),
        (width, depth, wall),
        "plaster",
    )
    for side in (-1, 1):
        yy = side * d
        v.mesh(
            "Infilled gable",
            [(-w, yy, wall), (w, yy, wall), (0.012, yy, wall + rise - 0.025)],
            [(0, 1, 2)] if side < 0 else [(2, 1, 0)],
            "plaster",
        )
        v.timber(
            "Gable king post", (0, yy, wall - 0.015), (0, yy, wall + rise - 0.02), 0.016
        )
        for xx in (-w * 0.82, w * 0.82):
            v.timber(
                "Gable diagonal brace",
                (xx, yy - side * 0.004, wall),
                (0, yy - side * 0.004, wall + rise * 0.63),
                0.012,
            )
        for xx in (-w + 0.01, w - 0.01):
            v.timber("Crooked oak frame", (xx, yy, 0.04), (xx * 0.96, yy, wall), 0.017)
        v.timber(
            "Heavy gable tie", (-w, yy, wall - 0.025), (w, yy, wall - 0.019), 0.018
        )
        v.timber("Worn sill", (-w, yy - 0.006, 0.09), (w, yy - 0.006, 0.095), 0.018)
        for i in range(5):
            for row in range(1):
                v.block(
                    "Rubble foundation",
                    (-w + (i + 0.5) * width / 5, yy, 0.023 + row * 0.035),
                    (width / 5 - 0.003, 0.044, 0.035),
                    "stone",
                    wear=0.10,
                )
    for side in (-1, 1):
        for i in range(3):
            v.block(
                "Side fieldstone footing",
                (side * w, -d + (i + 0.5) * depth / 3, 0.032),
                (0.04, depth / 3 - 0.004, 0.075),
                "stone",
                wear=0.10,
            )
        v.timber(
            "Side wall brace",
            (side * w, -d + 0.015, 0.10),
            (side * w, d - 0.015, wall - 0.03),
            0.011,
        )
    roof(v, width, depth, wall, rise)
    door(v, 0, -d - 0.018, wall * 0.78)
    window(v, w + 0.008, 0.05, wall * 0.60, yaw=math.pi / 2)
    v.transform_new(before, x, y, yaw)
    v.mark_architecture(before)


def roof(v, width, depth, wall, rise):
    w, d = width * 0.61, depth * 0.59
    courses, strips = 4, 8
    for side in (-1, 1):
        for row in range(courses):
            for col in range(strips):
                # Thick lapped strips follow a bowed roof; the staggered ragged eaves are geometry.
                a = row / courses
                b = min(1.045, (row + 1.22) / courses)
                yy = -d + col * 2 * d / strips
                span = 2 * d / strips
                offset = v.rng.uniform(-0.005, 0.005)
                vertices, uvs = [], []
                for u in (a, (a + b) / 2, b):
                    for edge in (0, 1):
                        y = yy + edge * span + offset
                        sag = 0.010 * math.sin((y + d) / (2 * d) * math.pi)
                        z = (
                            wall
                            + rise * (1 - u)
                            - sag
                            + 0.020 * math.sin(u * math.pi)
                            + 0.012
                            + (courses - row) * 0.003
                        )
                        if u == b:
                            z += v.rng.uniform(-0.004, 0.002)
                        vertices.append((side * w * u, y, z))
                        uvs.append((col / strips + edge / strips, 1 - u))
                vertices += [(px, py, pz - 0.014) for px, py, pz in vertices[4:6]]
                uvs += uvs[4:6]
                v.mesh(
                    "Lapped hand-bound straw",
                    vertices,
                    [
                        tuple(reversed(face)) if side > 0 else face
                        for face in [(0, 1, 3, 2), (2, 3, 5, 4), (4, 5, 7, 6)]
                    ],
                    "reed",
                    (1, 0.95, 0.80),
                    uvs=uvs,
                )
        for yy in (-d - 0.008, d + 0.008):
            v.timber(
                "Rough hewn gable verge",
                (side * w, yy, wall - 0.005),
                (0, yy, wall + rise + 0.025),
                0.015,
            )
    for i in range(7):
        y0 = -d + i * 2 * d / 7
        v.timber(
            "Wrapped ridge bundle",
            (0, y0, wall + rise + 0.024),
            (0, y0 + 2 * d / 7 - 0.004, wall + rise + 0.023),
            0.025,
            "reed",
        )


def door(v, x, y, height):
    v.block(
        "Recessed doorway",
        (x, y, height / 2),
        (0.092, 0.014, height),
        tint=(0.05, 0.04, 0.03),
    )
    for side in (-1, 1):
        v.timber(
            "Door jamb",
            (x + side * 0.050, y - 0.01, 0.02),
            (x + side * 0.048, y - 0.01, height),
            0.010,
        )
    v.timber(
        "Door lintel",
        (x - 0.052, y - 0.01, height),
        (x + 0.052, y - 0.01, height + 0.004),
        0.012,
    )
    v.block(
        "Closed split plank door",
        (x, y - 0.025, height * 0.48),
        (0.084, 0.014, height * 0.92),
    )
    v.block(
        "Worn doorstep", (x, y - 0.046, 0.012), (0.125, 0.07, 0.025), "stone", wear=0.10
    )


def window(v, x, y, z, yaw=0):
    before = set(v.editable.objects)
    v.block(
        "Recessed warm window",
        (0, -0.002, z),
        (0.086, 0.014, 0.075),
        tint=(1, 0.4, 0.06),
        material=2,
        wear=0,
    )
    for a in (-0.046, 0, 0.046):
        v.timber(
            "Window mullion", (a, -0.014, z - 0.043), (a, -0.014, z + 0.043), 0.006
        )
    for h in (z - 0.043, z + 0.043):
        v.timber("Window surround", (-0.052, -0.014, h), (0.052, -0.014, h), 0.008)
    v.transform_new(before, x, y, yaw)


def awning(v, x, y, width, depth, height):
    vertices, uvs = [], []
    for row in range(5):
        for col in range(7):
            u, t = col / 6, row / 4
            vertices.append(
                (
                    x + (u - 0.5) * width,
                    y + t * depth,
                    height
                    + 0.035 * t
                    - (0.045 + 0.025 * math.sin(t * math.pi)) * math.sin(u * math.pi),
                )
            )
            uvs.append((u, t))
    v.mesh(
        "Patched sagging canvas shelter",
        vertices,
        [
            (r * 7 + c, r * 7 + c + 1, (r + 1) * 7 + c + 1, (r + 1) * 7 + c)
            for r in range(4)
            for c in range(6)
        ],
        "plaster",
        (0.92, 0.87, 0.71),
        uvs=uvs,
    )
    for xx in (x - width / 2, x + width / 2):
        v.timber("Shelter stake", (xx, y, 0.005), (xx, y, height + 0.02), 0.016)


def hearth_and_goods(v, x, y):
    for i in range(11):
        angle = i * math.tau / 11
        cx, cy = x + 0.105 * math.cos(angle), y + 0.105 * math.sin(angle)
        vertices = [
            (
                cx + radius * math.cos(j * math.tau / 7),
                cy + radius * math.sin(j * math.tau / 7),
                z,
            )
            for radius, z in ((0.024, 0.005), (0.035, 0.022), (0.022, 0.044))
            for j in range(7)
        ]
        faces = [
            (r * 7 + j, r * 7 + (j + 1) % 7, (r + 1) * 7 + (j + 1) % 7, (r + 1) * 7 + j)
            for r in range(2)
            for j in range(7)
        ]
        faces += [tuple(reversed(range(7))), tuple(range(14, 21))]
        stone = v.mesh(
            "Rounded hearth fieldstone", vertices, faces, "stone", (0.75, 0.81, 0.91)
        )
        for face in stone.data.polygons:
            face.use_smooth = True
    for i in range(3):
        v.timber(
            "Charred hearth log",
            (x - 0.05, y - 0.025 + i * 0.024, 0.025),
            (x + 0.05, y + 0.005 + i * 0.02, 0.035),
            0.016,
            tint=(0.30, 0.20, 0.13),
        )
        angle = i * math.tau / 3
        v.mesh(
            "Banked amber embers",
            [
                (x + 0.055 * math.cos(angle), y + 0.055 * math.sin(angle), 0.035),
                (
                    x + 0.055 * math.cos(angle + 2),
                    y + 0.055 * math.sin(angle + 2),
                    0.035,
                ),
                (x + 0.02 * math.cos(angle), y + 0.02 * math.sin(angle), 0.105),
            ],
            [(0, 1, 2)],
            tint=(1, 0.23, 0.018),
            material=2,
        )
    v.block("Shared hearth bench", (x, y - 0.23, 0.045), (0.24, 0.075, 0.020))
    for xx in (x - 0.085, x + 0.085):
        v.block("Bench foot", (xx, y - 0.23, 0.020), (0.025, 0.055, 0.04))
    for dx, dy in ((-0.18, 0.06), (-0.14, -0.12), (0.16, -0.13), (0.17, 0.08)):
        v.block("Hearth stool", (x + dx, y + dy, 0.0225), (0.045, 0.045, 0.045))
    for i in range(5):
        v.timber(
            "Stacked split firewood",
            (-0.48 + (i % 3) * 0.026, 0.10, 0.02 + (i // 3) * 0.025),
            (-0.48 + (i % 3) * 0.026, 0.20, 0.02 + (i // 3) * 0.025),
            0.013,
        )


def pack_source(v):
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    bake_painted_relief(v)
    for obj in list(v.editable.objects):
        marker = obj.data.attributes.new(
            name="_YARD_ARCHITECTURE", type="FLOAT", domain="POINT"
        )
        marker.data.foreach_set(
            "value", [float(bool(obj.get("yardArchitecture")))] * len(obj.data.vertices)
        )
        clone = obj.copy()
        clone.data = obj.data.copy()
        v.production.objects.link(clone)
    # Body and cloth remain separate for the runtime ownership material.
    for cloth in (False, True):
        bpy.ops.object.select_all(action="DESELECT")
        objects = [
            obj
            for obj in v.production.objects
            if bool(obj.get("relationshipCloth")) == cloth
        ]
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = objects[0]
        bpy.ops.object.join()
        model = bpy.context.object
        model.name = v.name + (" / ownership cloth" if cloth else " / painted body")
        if not cloth:
            bake_contact(model, v)
    v.editable.hide_render = True
    v.editable.hide_viewport = True
    scene["assetId"] = v.name
    scene["conceptPainting"] = "village/concept.png"
    scene["conceptSha256"] = hashlib.sha256(
        (SOURCE / scene["conceptPainting"]).read_bytes()
    ).hexdigest()
    scene["groundContact"] = "Local Z zero is terrain top; no plinth"
    scene["sourceRole"] = "Canvas & Thatch village; export OUTPOST_PRODUCTION"
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(
        filepath=str(SOURCE / (v.name + ".blend")), compress=True
    )
    print(
        json.dumps(
            {
                "name": v.name,
                "triangles": sum(
                    len(p.vertices) - 2
                    for o in v.production.objects
                    for p in o.data.polygons
                ),
            }
        )
    )


def bake_contact(model, v):
    # Store contact shading in vertices, retaining the painted atlas UVs at full resolution.
    v.editable.hide_render = True
    original = [
        tuple(item.color) for item in model.data.color_attributes["Surface tint"].data
    ]
    bpy.context.scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.bake(type="AO")
    for item, tint in zip(model.data.color_attributes["Surface tint"].data, original):
        ao = 0.82 + 0.18 * min(1, max(0, item.color[0]))
        item.color = (*(value * ao for value in tint[:3]), 1)
    v.editable.hide_render = False


def bake_painted_relief(v):
    """Bake the painted fibers and masonry relief onto the same atlas coordinates."""
    v.editable.hide_render = True
    bpy.ops.mesh.primitive_plane_add(size=1)
    swatch = bpy.context.object
    material = bpy.data.materials.new("Painted relief bake")
    material.use_nodes = True
    swatch.data.materials.append(material)
    nodes, links = material.node_tree.nodes, material.node_tree.links
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = v.atlas
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.18
    bump.inputs["Distance"].default_value = 0.006
    links.new(tex.outputs["Color"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], nodes.get("Principled BSDF").inputs["Normal"])
    relief = bpy.data.images.new(
        "Painted village relief", width=240, height=240, alpha=False
    )
    relief.colorspace_settings.name = "Non-Color"
    target = nodes.new("ShaderNodeTexImage")
    target.image = relief
    nodes.active = target
    bpy.context.scene.render.bake.target = "IMAGE_TEXTURES"
    bpy.ops.object.bake(type="NORMAL", normal_space="TANGENT", margin=0)
    relief.pack()
    bpy.data.objects.remove(swatch, do_unlink=True)
    nodes, links = v.materials[0].node_tree.nodes, v.materials[0].node_tree.links
    uv = next(n for n in nodes if n.type == "UVMAP")
    tex = nodes.new("ShaderNodeTexImage")
    tex.image = relief
    normal = nodes.new("ShaderNodeNormalMap")
    normal.uv_map = "Painted surface"
    links.new(uv.outputs["UV"], tex.inputs["Vector"])
    links.new(tex.outputs["Color"], normal.inputs["Color"])
    links.new(normal.outputs["Normal"], nodes.get("Principled BSDF").inputs["Normal"])
    v.editable.hide_render = False


def canvas_shelter(v):
    before = set(v.editable.objects)
    awning(v, -0.12, 0.21, 0.56, 0.28, 0.47)
    for x in (-0.40, 0.16):
        v.timber("Rear shelter post", (x, 0.49, 0), (x, 0.49, 0.525), 0.012)
        v.timber("Canvas ridge lashing", (x, 0.20, 0.49), (x, 0.50, 0.52), 0.008)
    v.mark_architecture(before)
    for x, y, h in ((-0.28, 0.38, 0.08), (-0.04, 0.38, 0.10), (0.09, 0.25, 0.07)):
        v.block("Sheltered provision chest", (x, y, h / 2), (0.13, 0.11, h))
        v.timber("Chest lid binding", (x - 0.067, y, h), (x + 0.067, y, h), 0.007)
    for x, y in ((-0.30, 0.23), (0.10, 0.44)):
        barrel(v, x, y)
    v.transform_new(before, -0.09, -0.02, 0)


def barrel(v, x, y):
    count = 10
    rings = [(0.006, 0.032), (0.025, 0.037), (0.10, 0.037), (0.12, 0.032)]
    verts = [
        (
            x + radius * math.cos(i * math.tau / count),
            y + radius * math.sin(i * math.tau / count),
            z,
        )
        for z, radius in rings
        for i in range(count)
    ]
    faces = [
        (
            r * count + i,
            r * count + (i + 1) % count,
            (r + 1) * count + (i + 1) % count,
            (r + 1) * count + i,
        )
        for r in range(3)
        for i in range(count)
    ]
    faces += [tuple(reversed(range(count))), tuple(range(3 * count, 4 * count))]
    v.mesh("Provision barrel staves", verts, faces)
    for z in (0.025, 0.095):
        band = [
            (
                x + 0.039 * math.cos(i * math.tau / count),
                y + 0.039 * math.sin(i * math.tau / count),
                h,
            )
            for h in (z, z + 0.008)
            for i in range(count)
        ]
        v.mesh(
            "Barrel iron hoop",
            band,
            [
                (i, (i + 1) % count, (i + 1) % count + count, i + count)
                for i in range(count)
            ],
            "stone",
            (0.26, 0.28, 0.27),
        )


def canvas_tent(v):
    before = set(v.editable.objects)
    width, depth, peak = 0.31, 0.30, 0.34
    for side in (-1, 1):
        vertices = []
        for row in range(6):
            u = row / 5
            for col in range(6):
                t = col / 5
                vertices.append(
                    (
                        side * width * 0.5 * u,
                        (t - 0.5) * depth,
                        peak * (1 - u)
                        + 0.035 * u
                        - 0.028 * math.sin(t * math.pi) * math.sin(u * math.pi),
                    )
                )
        faces = [
            (r * 6 + c, r * 6 + c + 1, (r + 1) * 6 + c + 1, (r + 1) * 6 + c)
            for r in range(5)
            for c in range(5)
        ]
        if side > 0:
            faces = [tuple(reversed(face)) for face in faces]
        v.mesh(
            "Sewn canvas tent",
            vertices,
            faces,
            "plaster",
            uvs=[(c / 5, r / 5) for r in range(6) for c in range(6)],
        )
        v.mesh(
            "Open tent flap",
            [
                (side * width / 2, -depth / 2, 0.02),
                (side * 0.06, -depth / 2 - 0.01, 0.02),
                (0, -depth / 2, peak),
            ],
            [(0, 1, 2)],
            "plaster",
        )
        strip = v.mesh(
            "Tent ownership seam",
            [
                (0, -depth / 2 - 0.012, peak + 0.004),
                (side * 0.018, -depth / 2 - 0.012, peak - 0.012),
                (side * (width / 2 + 0.01), -depth / 2 - 0.012, 0.035),
                (side * (width / 2 - 0.008), -depth / 2 - 0.012, 0.035),
            ],
            [(0, 1, 2, 3)],
            material=1,
        )
        strip["relationshipCloth"] = "trim"
    for y in (-depth / 2, depth / 2):
        v.timber("Tent ridge upright", (0, y, 0), (0, y, peak + 0.04), 0.010)
    v.timber(
        "Tent ridge pole",
        (0, -depth / 2 - 0.03, peak),
        (0, depth / 2 + 0.03, peak),
        0.010,
    )
    v.transform_new(before, 0.25, 0.22, 0)
    v.mark_architecture(before)


def yard_fence(v):
    count, radius = 16, 0.81
    points = [
        (
            radius * math.cos(i * math.tau / count),
            radius * math.sin(i * math.tau / count),
        )
        for i in range(count)
    ]
    for index, (x, y) in enumerate(points):
        if index == 12:
            continue
        vertices = [
            (
                x + 0.028 * math.cos(a * math.tau / 5),
                y + 0.028 * math.sin(a * math.tau / 5),
                z,
            )
            for z in (-0.01, 0.30)
            for a in range(5)
        ] + [(x + 0.004, y, 0.35)]
        faces = [(a, (a + 1) % 5, (a + 1) % 5 + 5, a + 5) for a in range(5)]
        faces += [(a + 5, (a + 1) % 5 + 5, 10) for a in range(5)] + [
            tuple(reversed(range(5)))
        ]
        v.mesh("Rough pointed yard post", vertices, faces)
        if index in (11, 12):
            continue
        nx, ny = points[(index + 1) % count]
        for z in (0.11, 0.25):
            v.timber("Open yard rail", (x, y, z), (nx, ny, z + 0.008), 0.012)
        for t in (0.25, 0.5, 0.75):
            xx, yy = x + t * (nx - x), y + t * (ny - y)
            v.timber("Spaced fence pale", (xx, yy, 0.02), (xx + 0.006, yy, 0.28), 0.020)


def village_standard(v):
    before = set(v.editable.objects)
    x, y, top = 0.30, 0.50, 0.78
    v.timber("Village standard post", (x, y, -0.012), (x, y, top + 0.015), 0.014)
    v.timber(
        "Standard crossbar",
        (x - 0.015, y, top - 0.03),
        (x + 0.18, y, top - 0.03),
        0.010,
    )
    vertices = [
        (x + col * 0.032, y + 0.018 * math.sin(col * 0.9), top - 0.04 - row * 0.055)
        for row in range(5)
        for col in range(6)
    ]
    faces = [
        (r * 6 + c, (r + 1) * 6 + c, (r + 1) * 6 + c + 1, r * 6 + c + 1)
        for r in range(4)
        for c in range(5)
    ]
    cloth = v.mesh(
        "Village ownership standard",
        vertices,
        faces,
        material=1,
        uvs=[(c / 5, 1 - r / 4) for r in range(5) for c in range(6)],
    )
    cloth["relationshipCloth"] = "trim"
    center = (x + 0.08, y - 0.022, top - 0.15)
    for i in range(8):
        angle = i * math.tau / 8
        v.mesh(
            "Standard stitched sun",
            [
                center,
                (
                    center[0] + 0.026 * math.sin(angle - 0.14),
                    center[1],
                    center[2] + 0.026 * math.cos(angle - 0.14),
                ),
                (
                    center[0] + 0.042 * math.sin(angle),
                    center[1],
                    center[2] + 0.042 * math.cos(angle),
                ),
                (
                    center[0] + 0.026 * math.sin(angle + 0.14),
                    center[1],
                    center[2] + 0.026 * math.cos(angle + 0.14),
                ),
            ],
            [(0, 1, 2, 3)],
            "plaster",
            (1, 0.65, 0.19),
        )

    v.mark_architecture(before)


def main():
    if not PAINTING.is_file():
        raise ValueError(
            "Retain the selected Canvas & Thatch painting before authoring the village"
        )
    v = Village("village-canvas-thatch")
    cottage(v, -0.44, -0.04, 0.30, 0.32, 0.24, 0.18, 0)
    cottage(v, 0.42, -0.13, 0.29, 0.31, 0.24, 0.18, 0)
    canvas_shelter(v)
    canvas_tent(v)
    hearth_and_goods(v, -0.015, -0.24)
    yard_fence(v)
    village_standard(v)
    pack_source(v)


if __name__ == "__main__":
    main()
