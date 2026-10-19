"""Author the five lab sculpts from anatomical section cages, then paint the unified surfaces."""

import math
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
    "minotaur": (0.125, 0.17, 0.22),
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
    for i, (center, wide, deep) in enumerate(sections):
        tangent = Vector(sections[min(i + 1, len(sections) - 1)][0]) - Vector(
            sections[max(0, i - 1)][0]
        )
        tangent.normalize()
        across = tangent.cross(Vector((0, 1, 0)))
        if across.length < 0.1:
            across = Vector((1, 0, 0))
        across.normalize()
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

    def biped(self):
        troll = self.species == "troll"
        bull = self.species == "minotaur"
        # Broad chest narrows through the ribs, then opens into the pelvis.
        self.surface(
            "Torso cage",
            [
                ((0, 0.045, 0.47), 0.10, 0.09),
                ((0, 0.035, 0.55), 0.19, 0.13),
                ((0, 0.025, 0.68), 0.16 if bull else 0.21, 0.13 if bull else 0.17),
                ((0, 0.02, 0.80), 0.20, 0.15),
                ((0, 0.035, 0.96), 0.30, 0.19),
                ((0, 0.055, 1.07), 0.26, 0.17),
                ((0, 0.035, 1.13), 0.15, 0.13),
            ],
        )
        self.surface(
            "Neck and skull cage",
            [
                ((0, 0.015, 1.02), 0.14, 0.12),
                ((0, -0.025, 1.15), 0.125, 0.13),
                ((0, -0.07, 1.21), 0.12, 0.115),
                ((0, -0.075, 1.28), 0.155, 0.14),
                ((0, -0.065, 1.39), 0.15, 0.125),
                ((0, -0.035, 1.48), 0.115, 0.10),
                ((0, -0.025, 1.51), 0.05, 0.055),
            ],
        )
        for s in [-1, 1]:
            # Elbows, wrists and knuckles have their own narrow sections, not inflated tubes.
            self.surface(
                "Shoulder to hand cage",
                [
                    ((s * 0.21, 0.035, 1.04), 0.145, 0.15),
                    ((s * 0.32, 0.005, 1.02), 0.155, 0.14),
                    ((s * 0.39, -0.015, 0.92), 0.12, 0.115),
                    ((s * 0.43, -0.025, 0.81), 0.09, 0.08),
                    ((s * 0.43, -0.045, 0.75), 0.075, 0.075),
                    ((s * 0.46, -0.065, 0.67), 0.105, 0.09),
                    ((s * 0.47, -0.11, 0.56), 0.072, 0.065),
                    ((s * 0.46, -0.14, 0.49), 0.052, 0.05),
                    ((s * 0.465, -0.165, 0.43), 0.075, 0.055),
                    ((s * 0.47, -0.17, 0.38), 0.065, 0.04),
                ],
            )
            for finger in range(4):
                x = s * (0.415 + finger * 0.035)
                z = 0.385 - abs(finger - 1.5) * 0.006
                self.surface(
                    "Articulated finger",
                    [
                        ((x, -0.17, z + 0.04), 0.020, 0.023),
                        ((x, -0.19, z - 0.015), 0.019, 0.022),
                        ((x, -0.21, z - 0.055), 0.017, 0.019),
                        ((x, -0.24, z - 0.065), 0.012, 0.013),
                    ],
                    sides=12,
                    subdivision=1,
                )
            self.surface(
                "Opposed thumb",
                [
                    ((s * 0.41, -0.16, 0.45), 0.031, 0.035),
                    ((s * 0.375, -0.205, 0.42), 0.025, 0.025),
                    ((s * 0.37, -0.24, 0.38), 0.018, 0.021),
                ],
                sides=12,
            )
            self.surface(
                "Leg anatomy cage",
                [
                    ((s * 0.11, 0.035, 0.57), 0.13, 0.13),
                    ((s * 0.155, 0.025, 0.47), 0.13, 0.12),
                    ((s * 0.19, -0.045, 0.36), 0.105, 0.09),
                    ((s * 0.20, -0.075, 0.30), 0.075, 0.075),
                    ((s * 0.195, -0.015, 0.23), 0.083, 0.075),
                    ((s * 0.185, 0.04, 0.14), 0.053, 0.053),
                    ((s * 0.185, 0.02, 0.07), 0.057, 0.055),
                ],
            )
            self.surface(
                "Foot cage",
                [
                    ((s * 0.185, 0.06, 0.065), 0.055, 0.05),
                    ((s * 0.185, -0.015, 0.06), 0.075, 0.055),
                    ((s * 0.185, -0.095, 0.05), 0.09, 0.047),
                    ((s * 0.185, -0.19, 0.043), 0.085, 0.038),
                ],
                sides=20,
            )
            if not bull:
                for toe in range(4):
                    x = s * (0.12 + toe * 0.042)
                    self.surface(
                        "Toe",
                        [
                            ((x, -0.13, 0.045), 0.025, 0.027),
                            ((x, -0.205, 0.035), 0.022, 0.025),
                            ((x, -0.23, 0.035), 0.014, 0.020),
                        ],
                        sides=12,
                        subdivision=1,
                    )
            self.surface(
                "Pointed ear",
                [
                    ((s * 0.12, -0.02, 1.37), 0.055, 0.035),
                    ((s * 0.21, 0.0, 1.40), 0.045, 0.025),
                    ((s * 0.265, 0.025, 1.43), 0.005, 0.008),
                ],
                sides=12,
            )
        print("Unifying anatomy", flush=True)
        self.unify_skin()
        print("Sculpting planes and face", flush=True)
        self.sculpt_biped_face()
        print("Carving facial and material details", flush=True)
        self.biped_details()
        if bull:
            for obj in [self.body, *self.details]:
                for v in obj.data.vertices:
                    x, y, z = v.co
                    if z > 1.10:
                        v.co.z -= 0.085 * min(1, (z - 1.10) / 0.10)
                    if 0.80 < z < 1.12:
                        v.co.x *= 1 + 0.10 * math.sin(math.pi * (z - 0.80) / 0.32)
                    if abs(x) > 0.23 and 0.85 < z < 1.1:
                        v.co.z += 0.035 * math.sin(math.pi * (z - 0.85) / 0.25)
        if troll:
            for obj in [self.body, *self.details]:
                for v in obj.data.vertices:
                    # The troll carries its skull forward and its weight on longer arms.
                    z = v.co.z
                    if z > 1.0:
                        t = min(1, (z - 1.0) / 0.35)
                        v.co.y -= 0.14 * t
                        v.co.z -= 0.12 * t
                    if abs(v.co.x) > 0.33 and 0.28 < z < 0.85:
                        v.co.z -= 0.09 * math.sin(math.pi * (z - 0.28) / 0.57)

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
        self.body = obj
        for face in obj.data.polygons:
            face.use_smooth = True

    def sculpt_biped_face(self):
        bull = self.species == "minotaur"
        cyclops = self.species == "cyclops"
        normals = [v.normal.copy() for v in self.body.data.vertices]
        for v, normal in zip(self.body.data.vertices, normals):
            x, y, z = v.co
            if y < -0.045:
                front = min(1, max(0, (-y - 0.045) / 0.055))
                push = 0
                for s in [-1, 1]:
                    push += 0.064 * gaussian(x, z, s * 0.14, 0.98, 0.15, 0.105)
                    push += 0.035 * gaussian(x, z, s * 0.075, 0.83, 0.07, 0.045)
                    push += 0.025 * gaussian(x, z, s * 0.065, 0.76, 0.06, 0.045)
                    push += 0.023 * gaussian(x, z, s * 0.062, 0.69, 0.06, 0.045)
                    push += 0.03 * gaussian(x, z, s * 0.34, 0.94, 0.08, 0.13)
                    push += 0.03 * gaussian(x, z, s * 0.47, 0.66, 0.065, 0.105)
                    push += 0.025 * gaussian(x, z, s * 0.165, 0.43, 0.08, 0.11)
                    push += 0.02 * gaussian(x, z, s * 0.2, 0.30, 0.065, 0.05)
                    push += 0.032 * gaussian(x, z, s * 0.10, 1.30, 0.065, 0.07)
                    push -= 0.025 * gaussian(x, z, s * 0.14, 1.25, 0.045, 0.075)
                push -= 0.014 * gaussian(x, z, 0, 0.98, 0.021, 0.13)
                if cyclops:
                    push -= 0.050 * gaussian(x, z, 0, 1.385, 0.09, 0.055)
                    push += 0.055 * gaussian(x, z, 0, 1.44, 0.11, 0.035)
                else:
                    for s in [-1, 1]:
                        push -= 0.035 * gaussian(x, z, s * 0.075, 1.38, 0.045, 0.035)
                        push += 0.046 * gaussian(x, z, s * 0.075, 1.42, 0.065, 0.025)
                push += (0.135 if bull else 0.085) * gaussian(
                    x, z, 0, 1.29, 0.105 if bull else 0.045, 0.070
                )
                push += (0.075 if bull else 0.06) * gaussian(
                    x, z, 0, 1.23, 0.105, 0.035
                )
                push -= 0.020 * gaussian(x, z, 0, 1.25, 0.09, 0.008)
                v.co.y -= push * front
            # Deliberate skin folds and fine pores sit below the anatomical planes.
            n = noise_vector(v.co * 53)
            v.co += normal * (n.x * 0.0012)
            v.co.z = max(0.012, v.co.z)
        self.body.data.update()

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

    def biped_details(self):
        bull = self.species == "minotaur"
        if self.species == "cyclops":
            self.eye(0, 1.385, 0.053)
        else:
            for s in [-1, 1]:
                self.eye(s * 0.075, 1.38, 0.025)
        for s in [-1, 1]:
            x = s * (0.052 if bull else 0.022)
            y = self.face_y(x, 1.29)
            self.ridge(
                "Nostril",
                [(x, y - 0.004, 1.297), (x + s * 0.009, y - 0.006, 1.285)],
                [0.012, 0.015],
                "dark",
            )
            if bull:
                self.ridge(
                    "Swept ivory horn",
                    [
                        (s * 0.115, -0.015, 1.46),
                        (s * 0.23, 0.005, 1.49),
                        (s * 0.34, 0.035, 1.55),
                        (s * 0.38, 0.025, 1.66),
                        (s * 0.34, -0.01, 1.75),
                    ],
                    [0.06, 0.054, 0.038, 0.018, 0.001],
                )
            else:
                y = self.face_y(s * 0.07, 1.24)
                self.ridge(
                    "Lower tusk",
                    [
                        (s * 0.07, y, 1.23),
                        (s * 0.09, y - 0.035, 1.27),
                        (s * 0.085, y - 0.025, 1.34),
                    ],
                    [0.022, 0.018, 0.001],
                )
        mouth = []
        for x in [-0.09, -0.045, 0, 0.045, 0.09]:
            z = 1.247 + 0.018 * (abs(x) / 0.09) ** 2
            mouth.append((x, self.face_y(x, z) - 0.004, z))
        self.ridge("Mouth cleft", mouth, [0.005, 0.008, 0.008, 0.008, 0.005], "dark")
        self.cloth()
        if bull:
            for s in [-1, 1]:
                for i in range(9):
                    x = s * (0.07 + 0.024 * i)
                    self.ridge(
                        "Carved mane lock",
                        [
                            (x, 0.03, 1.49 - i * 0.029),
                            (x + s * 0.045, 0.06, 1.40 - i * 0.036),
                            (x + s * 0.025, 0.04, 1.24 - i * 0.034),
                        ],
                        [0.045, 0.05, 0.001],
                        "mane",
                    )
                for i in range(5):
                    x = s * (0.09 + i * 0.014)
                    self.ridge(
                        "Cheek mane",
                        [
                            (x, -0.06, 1.36 - i * 0.023),
                            (x + s * 0.05, -0.08, 1.30 - i * 0.026),
                            (x + s * 0.04, -0.09, 1.21 - i * 0.026),
                        ],
                        [0.025, 0.035, 0.001],
                        "mane",
                    )
            for s in [-1, 1]:
                for split in [-1, 1]:
                    x = s * 0.185 + split * 0.039
                    self.surface(
                        "Split hoof",
                        [
                            ((x, 0.015, 0.09), 0.041, 0.075),
                            ((x, -0.055, 0.055), 0.044, 0.05),
                            ((x, -0.18, 0.035), 0.04, 0.033),
                        ],
                        "hoof",
                        False,
                        16,
                        1,
                    )
        if self.species == "troll":
            for s in [-1, 1]:
                for i in range(5):
                    x = s * (0.075 + i * 0.055)
                    self.ridge(
                        "Shoulder stone crest",
                        [
                            (x, 0.12, 1.04),
                            (x, 0.14, 1.16 + 0.03 * math.sin(i)),
                            (x + s * 0.035, 0.15, 1.10),
                        ],
                        [0.045, 0.035, 0.001],
                        "stone",
                    )

    def cloth(self):
        vertices = []
        for level in range(5):
            for i in range(48):
                a = math.tau * i / 48
                fold = 0.009 * math.cos(a * 12)
                z = 0.61 - level * 0.045
                if level == 4:
                    z -= 0.04 * (0.5 + 0.5 * math.sin(a * 7))
                vertices.append(
                    (
                        (0.195 + fold) * math.cos(a),
                        0.025 + (0.155 + fold) * math.sin(a),
                        z,
                    )
                )
        faces = []
        for level in range(4):
            for i in range(48):
                a = level * 48 + i
                b = level * 48 + (i + 1) % 48
                faces.append((a, b, b + 48, a + 48))
        obj = mesh("Folding hide apron", vertices, faces)
        obj["paint"] = "leather"
        self.details.append(obj)
        activate(obj)
        solid = obj.modifiers.new("Hide thickness", "SOLIDIFY")
        solid.thickness = 0.006
        bpy.ops.object.modifier_apply(modifier=solid.name)
        for i in range(12):
            a = math.tau * i / 12
            self.ridge(
                "Bound hide belt",
                [
                    (0.20 * math.cos(a), 0.025 + 0.16 * math.sin(a), 0.605),
                    (
                        0.20 * math.cos(a + 0.26),
                        0.025 + 0.16 * math.sin(a + 0.26),
                        0.62,
                    ),
                    (
                        0.20 * math.cos(a + 0.52),
                        0.025 + 0.16 * math.sin(a + 0.52),
                        0.605,
                    ),
                ],
                [0.009, 0.009, 0.009],
                "horn",
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
        x, y, z = vertex.co
        if not self.reptile:
            eye_mask = gaussian(
                x,
                z,
                0 if self.species == "cyclops" else 0.075,
                1.38,
                0.075,
                0.045,
            )
            if self.species != "cyclops":
                eye_mask += gaussian(x, z, -0.075, 1.38, 0.075, 0.045)
            if y < -0.10:
                color = tuple(c * (1 - 0.50 * eye_mask) for c in color)
            if z < 0.18:
                color = tuple(c * 0.65 for c in color)
            if self.species == "minotaur" and z < 0.115:
                color = (0.022, 0.019, 0.017)
            if y < -0.08:
                crease = 0
                for side in [-1, 1]:
                    crease += gaussian(x, z, side * 0.14, 0.91, 0.13, 0.018) * 0.38
                    crease += gaussian(x, z, side * 0.075, 0.79, 0.065, 0.012) * 0.25
                    crease += gaussian(x, z, side * 0.07, 0.72, 0.06, 0.012) * 0.2
                crease += gaussian(x, z, 0, 0.95, 0.012, 0.15) * 0.35
                color = tuple(c * (1 - min(0.6, crease)) for c in color)
            if self.species == "minotaur" and y < -0.18:
                muzzle = gaussian(x, z, 0, 1.29, 0.14, 0.09)
                color = tuple(
                    c * (1 - muzzle) + muzzle * t
                    for c, t in zip(color, (0.16, 0.105, 0.075))
                )
                nose = gaussian(x, z, 0, 1.29, 0.08, 0.035)
                color = tuple(c * (1 - 0.65 * nose) for c in color)
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
    sculpt = Sculpt(species)
    if sculpt.reptile:
        sculpt.reptile_body()
    else:
        sculpt.biped()
    sculpt.finish()
