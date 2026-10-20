"""Author the production sculpts from anatomical section cages, then paint the unified surfaces."""

import math
import runpy
import sys
from pathlib import Path

import bpy
import bmesh
from mathutils import Vector
from mathutils.noise import noise_vector

sys.path.insert(0, str(Path(__file__).resolve().parent))
from beast_paint import apply_paint

SOURCE = Path(__file__).resolve().parents[2] / "asset-sources/frontier-beasts"
TONES = {
    "cyclops": (0.38, 0.38, 0.23),
    "troll": (0.27, 0.32, 0.22),
    "wyvern": (0.42, 0.105, 0.045),
    "hydra": (0.075, 0.19, 0.29),
}


def activate(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def mesh(name, vertices, faces):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(data)
    bm.free()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    for face in data.polygons:
        face.use_smooth = True
    return obj


def section_surface(name, sections, sides=24, subdivision=2):
    """Sweep individually shaped elliptical sections; coordinates carry the pose and anatomy."""
    vertices, faces = [], []
    previous_across = None
    for i, (center, wide, deep) in enumerate(sections):
        tangent = Vector(sections[min(i + 1, len(sections) - 1)][0]) - Vector(
            sections[max(0, i - 1)][0]
        )
        tangent.normalize()
        across = (
            previous_across - tangent * previous_across.dot(tangent)
            if previous_across is not None
            else tangent.cross(Vector((0, 1, 0)))
        )
        if across.length < 0.1:
            axis = min(
                (Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))),
                key=lambda candidate: abs(candidate.dot(tangent)),
            )
            across = axis - tangent * axis.dot(tangent)
        across.normalize()
        previous_across = across.copy()
        front = tangent.cross(across).normalized()
        for j in range(sides):
            angle = math.tau * j / sides
            point = (
                Vector(center)
                + across * (math.cos(angle) * wide)
                + front * (math.sin(angle) * deep)
            )
            vertices.append(point)
    faces.append(tuple(reversed(range(sides))))
    for i in range(len(sections) - 1):
        for j in range(sides):
            a = i * sides + j
            b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    faces.append(tuple(range((len(sections) - 1) * sides, len(sections) * sides)))
    obj = mesh(name, vertices, faces)
    if subdivision:
        activate(obj)
        sub = obj.modifiers.new("Section cage subdivision", "SUBSURF")
        sub.levels = subdivision
        bpy.ops.object.modifier_apply(modifier=sub.name)
    return obj


def join(parts, name):
    activate(parts[0])
    for part in parts:
        part.select_set(True)
    bpy.ops.object.join()
    obj = bpy.context.object
    obj.name = name
    return obj


def gaussian(x, y, cx, cy, sx, sy):
    return math.exp(-2 * ((x - cx) ** 2 / sx**2 + (y - cy) ** 2 / sy**2))


class Sculpt:
    def __init__(self, species):
        bpy.ops.wm.read_factory_settings(use_empty=True)
        self.species = species
        self.skin_parts, self.details = [], []
        self.reptile = species in ["wyvern", "hydra"]
        self.base = TONES[species]

    def surface(
        self, name, sections, paint="skin", connected=True, sides=24, subdivision=2
    ):
        obj = section_surface(name, sections, sides, subdivision)
        obj["paint"] = paint
        (self.skin_parts if connected else self.details).append(obj)
        return obj

    def ridge(self, name, points, widths, paint="horn"):
        return self.surface(
            name, [(p, w, w * 0.8) for p, w in zip(points, widths)], paint, False, 12, 2
        )

    def unify_skin(self):
        obj = join(self.skin_parts, "Unified anatomical sculpt")
        self.skin_parts = [obj]
        remesh = obj.modifiers.new("Continuous sculpt topology", "REMESH")
        remesh.mode = "VOXEL"
        remesh.voxel_size = 0.006
        bpy.ops.object.modifier_apply(modifier=remesh.name)
        smooth = obj.modifiers.new("Relax anatomical joins", "SMOOTH")
        smooth.factor = 0.65
        smooth.iterations = 5
        bpy.ops.object.modifier_apply(modifier=smooth.name)
        sub = obj.modifiers.new("Sculpt resolution", "SUBSURF")
        sub.levels = 1
        bpy.ops.object.modifier_apply(modifier=sub.name)
        count = sum(len(p.vertices) - 2 for p in obj.data.polygons)
        if count > 140000:
            reduce = obj.modifiers.new("Sculpt density", "DECIMATE")
            reduce.ratio = 140000 / count
            bpy.ops.object.modifier_apply(modifier=reduce.name)
        topology = bmesh.new()
        topology.from_mesh(obj.data)
        bmesh.ops.remove_doubles(topology, verts=list(topology.verts), dist=0.0001)
        bmesh.ops.dissolve_degenerate(topology, edges=list(topology.edges), dist=0.0001)
        bmesh.ops.delete(
            topology,
            geom=[v for v in topology.verts if not v.link_faces],
            context="VERTS",
        )
        topology.to_mesh(obj.data)
        topology.free()
        obj.data.validate()
        self.body = obj
        for face in obj.data.polygons:
            face.use_smooth = True

    def face_y(self, x, z):
        hit, point, _, _ = self.body.ray_cast(Vector((x, -2, z)), Vector((0, 1, 0)))
        if not hit:
            raise ValueError(f"Face detail misses {x}, {z}")
        return point.y

    def eye(self, x, z, size):
        y = self.face_y(x, z) - 0.003
        for name, scale, depth, paint in [
            ("Socket", 1.25, 0, "dark"),
            ("Iris", 0.86, 0.003, "eye"),
            ("Pupil", 0.30, 0.006, "dark"),
        ]:
            vertices = [(x, y - depth - 0.008, z)]
            for i in range(24):
                a = math.tau * i / 24
                vertices.append(
                    (
                        x + math.cos(a) * size * scale,
                        y - depth,
                        z + math.sin(a) * size * scale * 0.62,
                    )
                )
            obj = mesh(
                name, vertices, [(0, 1 + i, 1 + (i + 1) % 24) for i in range(24)]
            )
            obj["paint"] = paint
            self.details.append(obj)
        for s in [-1, 1]:
            self.ridge(
                "Sculpted eyelid",
                [
                    (x - size, y, z),
                    (x, y - 0.005, z + s * size * 0.65),
                    (x + size, y, z),
                ],
                [0.009, 0.014, 0.009],
                "skin",
            )

    def reptile_body(self):
        hydra = self.species == "hydra"
        self.necks = []
        self.surface(
            "Reptile torso cage",
            [
                ((0, 0.29, 0.27), 0.11, 0.10),
                ((0, 0.16, 0.38), 0.19, 0.17),
                ((0, -0.02, 0.47), 0.21, 0.18),
                ((0, -0.17, 0.55), 0.18, 0.17),
                ((0, -0.21, 0.64), 0.13, 0.12),
            ],
        )
        self.surface(
            "Tapering coiled tail",
            [
                ((0, 0.26, 0.30), 0.12, 0.10),
                ((0.12, 0.43, 0.24), 0.10, 0.08),
                ((0.29, 0.48, 0.15), 0.075, 0.055),
                ((0.42, 0.34, 0.09), 0.045, 0.04),
                ((0.43, 0.10, 0.07), 0.025, 0.026),
                ((0.34, -0.07, 0.11), 0.009, 0.012),
                ((0.27, -0.11, 0.18), 0.001, 0.002),
            ],
        )
        if hydra:
            paths = [
                [
                    (-0.11, -0.16, 0.54),
                    (-0.21, -0.19, 0.77),
                    (-0.33, -0.12, 0.99),
                    (-0.38, -0.17, 1.20),
                    (-0.35, -0.25, 1.34),
                ],
                [
                    (0, -0.13, 0.59),
                    (0.015, -0.055, 0.91),
                    (0, 0.015, 1.17),
                    (0, -0.05, 1.46),
                    (0, -0.14, 1.61),
                ],
                [
                    (0.11, -0.15, 0.56),
                    (0.26, -0.19, 0.77),
                    (0.37, -0.13, 0.98),
                    (0.37, -0.21, 1.12),
                    (0.33, -0.31, 1.22),
                ],
            ]
            for points in paths:
                self.reptile_neck(points)
        else:
            self.reptile_neck(
                [
                    (0, -0.19, 0.57),
                    (0, -0.22, 0.77),
                    (0, -0.13, 0.96),
                    (0, -0.16, 1.12),
                    (0, -0.24, 1.24),
                ]
            )
        for side in [-1, 1]:
            for y, front in (
                [(-0.16, True), (0.20, False)] if hydra else [(0.10, False)]
            ):
                self.surface(
                    "Powerful haunch and hock",
                    [
                        ((side * 0.13, y, 0.43), 0.10, 0.12),
                        ((side * 0.24, y - 0.04, 0.35), 0.105, 0.10),
                        ((side * 0.26, y - 0.11, 0.24), 0.07, 0.07),
                        ((side * 0.25, y + 0.005, 0.13), 0.042, 0.05),
                        ((side * 0.25, y - 0.04, 0.055), 0.04, 0.035),
                    ],
                )
                self.surface(
                    "Splayed reptile foot",
                    [
                        ((side * 0.25, y - 0.01, 0.06), 0.045, 0.045),
                        ((side * 0.25, y - 0.08, 0.045), 0.08, 0.035),
                        ((side * 0.25, y - 0.17, 0.035), 0.065, 0.026),
                    ],
                )
                for toe in [-1, 0, 1]:
                    x = side * 0.25 + toe * 0.045
                    self.surface(
                        "Long reptile toe",
                        [
                            ((x, y - 0.12, 0.04), 0.019, 0.023),
                            ((x + toe * 0.012, y - 0.20, 0.03), 0.016, 0.019),
                            ((x + toe * 0.015, y - 0.24, 0.025), 0.009, 0.012),
                        ],
                        sides=12,
                        subdivision=1,
                    )
                    self.ridge(
                        "Ivory talon",
                        [
                            (x + toe * 0.01, y - 0.19, 0.035),
                            (x + toe * 0.02, y - 0.25, 0.026),
                            (x + toe * 0.02, y - 0.28, 0.015),
                        ],
                        [0.015, 0.010, 0.001],
                    )
        if not hydra:
            self.wings()
        self.unify_skin()
        normals = [v.normal.copy() for v in self.body.data.vertices]
        for v, normal in zip(self.body.data.vertices, normals):
            x, y, z = v.co
            # Staggered scale rows sculpted into the hide, with shallow bevels between cells.
            row = math.floor(z / 0.035)
            u = (x / 0.038 + (0.5 if row % 2 else 0)) % 1
            w = (z / 0.035) % 1
            scale = max(0, 1 - ((u - 0.5) / 0.5) ** 2) * max(
                0, 1 - ((w - 0.5) / 0.5) ** 2
            )
            v.co += normal * (0.0018 * scale + 0.0005 * noise_vector(v.co * 60).x)
            v.co.z = max(0.012, v.co.z)
        self.body.data.update()
        for points in self.necks:
            self.reptile_face(points[-1])
            self.dorsal_crest(points)

    def reptile_neck(self, points):
        self.necks.append(points)
        self.surface(
            "Sculpted S neck",
            [
                (p, w, d)
                for p, w, d in zip(
                    points,
                    [0.12, 0.105, 0.080, 0.067, 0.075],
                    [0.115, 0.10, 0.073, 0.063, 0.065],
                )
            ],
        )
        x, y, z = points[-1]
        # The crown, jaw hinge and broad nose are shaped in the skull's longitudinal cage.
        self.surface(
            "Angular reptile skull",
            [
                ((x, y + 0.055, z), 0.045, 0.045),
                ((x, y + 0.01, z + 0.015), 0.09, 0.075),
                ((x, y - 0.07, z + 0.005), 0.10, 0.067),
                ((x, y - 0.15, z - 0.035), 0.075, 0.044),
                ((x, y - 0.235, z - 0.045), 0.058, 0.038),
                ((x, y - 0.26, z - 0.04), 0.05, 0.03),
            ],
        )
        for side in [-1, 1]:
            self.surface(
                "Cranial brow ridge",
                [
                    ((x + side * 0.065, y + 0.015, z + 0.06), 0.025, 0.02),
                    ((x + side * 0.075, y - 0.055, z + 0.07), 0.032, 0.023),
                    ((x + side * 0.068, y - 0.13, z + 0.03), 0.015, 0.014),
                ],
                sides=12,
            )

    def reptile_face(self, head):
        x, y, z = head
        for side in [-1, 1]:
            self.eye(x + side * 0.065, z + 0.02, 0.021)
            self.ridge(
                "Swept cranial horn",
                [
                    (x + side * 0.06, y + 0.015, z + 0.055),
                    (x + side * 0.105, y + 0.10, z + 0.13),
                    (x + side * 0.12, y + 0.17, z + 0.20),
                ],
                [0.03, 0.02, 0.001],
            )
            self.ridge(
                "Nasal opening",
                [
                    (x + side * 0.032, y - 0.24, z - 0.025),
                    (x + side * 0.041, y - 0.245, z - 0.045),
                ],
                [0.009, 0.011],
                "dark",
            )
            self.ridge(
                "Jaw seam",
                [
                    (x + side * 0.078, y - 0.095, z - 0.045),
                    (x + side * 0.068, y - 0.16, z - 0.068),
                    (x + side * 0.045, y - 0.25, z - 0.063),
                ],
                [0.004, 0.005, 0.004],
                "dark",
            )
            for tooth in range(4):
                t = tooth / 3
                self.ridge(
                    "Small exposed fang",
                    [
                        (
                            x + side * (0.069 - 0.018 * t),
                            y - 0.12 - 0.105 * t,
                            z - 0.057,
                        ),
                        (
                            x + side * (0.068 - 0.018 * t),
                            y - 0.122 - 0.105 * t,
                            z - 0.078,
                        ),
                    ],
                    [0.006, 0.001],
                )

    def dorsal_crest(self, points):
        samples = []
        for a, b in zip(points, points[1:]):
            for step in range(5):
                t = step / 5
                samples.append(Vector(a).lerp(Vector(b), t))
        for i, point in enumerate(samples[3:-1]):
            t = (i + 3) / (len(samples) - 1)
            radius = 0.11 * (1 - t) + 0.063 * t
            x, y, z = point
            if i % 2 == 0:
                self.ridge(
                    "Neck dorsal crest",
                    [
                        (x, y + radius * 0.8, z),
                        (x, y + radius + 0.07, z + 0.04),
                        (x, y + radius + 0.025, z + 0.06),
                    ],
                    [0.019, 0.011, 0.001],
                    "skin",
                )

    def wings(self):
        for side in [-1, 1]:
            shoulder = (side * 0.12, -0.03, 0.62)
            elbow = (side * 0.36, 0.01, 0.82)
            wrist = (side * 0.47, -0.02, 1.15)
            self.surface(
                "Wing arm cage",
                [(shoulder, 0.06, 0.06), (elbow, 0.047, 0.045), (wrist, 0.026, 0.026)],
            )
            tips = [
                (side * 0.68, 0.08, 0.99),
                (side * 0.65, 0.13, 0.52),
                (side * 0.48, 0.18, 0.30),
                (side * 0.18, 0.16, 0.35),
            ]
            for tip in tips:
                self.ridge(
                    "Wing finger",
                    [wrist, Vector(wrist).lerp(Vector(tip), 0.5), tip],
                    [0.022, 0.014, 0.005],
                    "skin",
                )
            self.ridge(
                "Wing thumb claw",
                [wrist, (side * 0.50, -0.04, 1.22), (side * 0.53, -0.05, 1.18)],
                [0.021, 0.014, 0.001],
            )
            # Curved membrane panels sag between the finger bones; scalloped edges leave a clear wing silhouette.
            for a, b in zip(tips, tips[1:]):
                vertices = []
                faces = []
                for row in range(13):
                    t = row / 12
                    for col in range(9):
                        u = col / 8
                        edge = Vector(a).lerp(Vector(b), u)
                        edge.z += 0.055 * math.sin(math.pi * u)
                        point = Vector(wrist).lerp(edge, t)
                        point.y += 0.055 * math.sin(math.pi * u) * math.sin(math.pi * t)
                        vertices.append(point)
                for row in range(12):
                    for col in range(8):
                        i = row * 9 + col
                        faces.append((i, i + 1, i + 10, i + 9))
                obj = mesh("Tensioned wing membrane", vertices, faces)
                obj["paint"] = "membrane"
                self.details.append(obj)
                activate(obj)
                solid = obj.modifiers.new("Membrane thickness", "SOLIDIFY")
                solid.thickness = 0.004
                bpy.ops.object.modifier_apply(modifier=solid.name)

    def paint(self, obj):
        kind = obj.get("paint", "skin")
        palette = {
            "skin": self.base,
            "horn": (0.66, 0.53, 0.32),
            "dark": (0.012, 0.009, 0.008),
            "eye": (1, 0.39, 0.015),
            "mane": (0.055, 0.044, 0.035),
            "leather": (0.11, 0.055, 0.025),
            "hoof": (0.035, 0.030, 0.025),
            "stone": (0.28, 0.31, 0.22),
            "membrane": (0.48, 0.24, 0.085),
        }
        tone = palette[kind]
        layer = obj.data.color_attributes.new(
            name="Anatomical paint", type="FLOAT_COLOR", domain="POINT"
        )
        for v in obj.data.vertices:
            x, y, z = v.co
            grain = noise_vector(v.co * 17).x
            brush = noise_vector(Vector((x * 7, y * 8, z * 15))).y
            value = 0.93 + 0.10 * grain + 0.075 * brush
            color = tuple(c * value for c in tone)
            if kind == "skin":
                # Warm highlights on front planes; cooler shadows around sockets and joints.
                light = max(0, min(1, (-v.normal.y + 0.25) / 1.25))
                color = tuple(c * (0.80 + 0.40 * light) for c in color)
                color = self.paint_anatomy(color, v)
            layer.data[v.index].color = (*color, 1)
        mat = bpy.data.materials.new("Paint " + obj.name)
        mat.use_nodes = True
        nodes, links = mat.node_tree.nodes, mat.node_tree.links
        shader = nodes.get("Principled BSDF")
        shader.inputs["Roughness"].default_value = 0.84
        color = nodes.new("ShaderNodeVertexColor")
        color.layer_name = layer.name
        ao = nodes.new("ShaderNodeAmbientOcclusion")
        ao.inputs["Distance"].default_value = 0.09
        mix = nodes.new("ShaderNodeMixRGB")
        mix.blend_type = "MULTIPLY"
        mix.inputs[0].default_value = 0.55
        links.new(color.outputs["Color"], mix.inputs[1])
        links.new(ao.outputs["Color"], mix.inputs[2])
        links.new(mix.outputs[0], shader.inputs["Base Color"])
        tex = nodes.new("ShaderNodeTexImage")
        tex.image = self.hide
        tex.projection = "BOX"
        tex.projection_blend = 0.35
        coord = nodes.new("ShaderNodeTexCoord")
        links.new(coord.outputs["Generated"], tex.inputs["Vector"])
        bump = nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.12
        bump.inputs["Distance"].default_value = 0.009
        links.new(tex.outputs["Color"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], shader.inputs["Normal"])
        obj.data.materials.clear()
        obj.data.materials.append(mat)

    def paint_anatomy(self, color, vertex):
        return color

    def finish(self):
        print("Painting anatomical surface", flush=True)
        self.hide = bpy.data.images.load(str(SOURCE / "painted-hide.png"))
        self.hide.pack()
        for obj in [self.body, *self.details]:
            self.paint(obj)
        obj = join([self.body, *self.details], self.species + " refined sculpt")
        # Sources use the same world-space dimensions as the runtime family.
        for v in obj.data.vertices:
            v.co.z = max(0.012, v.co.z)
        bpy.context.scene["species"] = self.species
        bpy.context.scene["deliveryScale"] = 0.8
        bpy.context.scene["concept"] = "concept.png"
        bpy.context.scene["sculptTriangles"] = sum(
            len(p.vertices) - 2 for p in obj.data.polygons
        )
        painting = SOURCE / "refined" / f"{self.species}-paint.png"
        if painting.exists():
            apply_paint(obj, painting)
        if self.species == "hydra":
            for vertex in obj.data.vertices:
                vertex.co.x *= 0.93
                vertex.co.y *= 0.93
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(
            filepath=str(SOURCE / "refined" / f"{self.species}.blend"), compress=True
        )


if __name__ == "__main__":
    species = sys.argv[sys.argv.index("--") + 1]
    if species in {"troll", "cyclops"}:
        creature_type = runpy.run_path(
            str(Path(__file__).with_name("sculpt-creatures.py"))
        )["Creature"]
        sculpt = creature_type(species)
        getattr(sculpt, species)()
    elif species == "wraith":
        creature_type = runpy.run_path(
            str(Path(__file__).with_name("sculpt-weak-beasts.py"))
        )["WeakBeast"]
        sculpt = creature_type(species)
        sculpt.wraith()
    elif species in {"wyvern", "hydra"}:
        sculpt = Sculpt(species)
        sculpt.reptile_body()
    else:
        raise ValueError("Choose troll, wyvern, hydra, wraith or cyclops")
    sculpt.finish()
