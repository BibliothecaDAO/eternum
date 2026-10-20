"""Sculpt three weak-monster studies from their retained concept turnarounds."""

import math
import runpy
import sys
from pathlib import Path

import bpy
from mathutils import Vector

ART = runpy.run_path(str(Path(__file__).with_name("sculpt-creatures.py")))
Creature, mesh = ART["Creature"], ART["mesh"]
ART["BASE"]["TONES"].update(
    {
        "ghoul": (0.37, 0.29, 0.32),
        "kappa": (0.24, 0.31, 0.16),
        "wraith": (0.12, 0.16, 0.25),
    }
)


class WeakBeast(Creature):
    def ghoul(self):
        self.surface(
            "Lean arched ribs and hollow waist",
            [
                ((0, 0.15, 0.35), 0.12, 0.11),
                ((0, 0.15, 0.53), 0.16, 0.12),
                ((0, 0.12, 0.69), 0.12, 0.10),
                ((0, 0.05, 0.87), 0.21, 0.17),
                ((0, -0.03, 1.00), 0.25, 0.17),
                ((0, -0.12, 1.09), 0.18, 0.13),
                ((0, -0.24, 1.02), 0.10, 0.11),
            ],
        )
        self.surface(
            "Forward bald cranium",
            [
                ((0, -0.23, 0.94), 0.10, 0.10),
                ((0, -0.31, 1.06), 0.15, 0.15),
                ((0, -0.40, 1.09), 0.17, 0.17),
                ((0, -0.48, 1.00), 0.15, 0.13),
                ((0, -0.50, 0.91), 0.12, 0.09),
            ],
        )
        self.surface(
            "Pointed carrion jaw",
            [
                ((0, -0.31, 0.91), 0.11, 0.075),
                ((0, -0.40, 0.78), 0.12, 0.055),
                ((0, -0.50, 0.75), 0.075, 0.04),
                ((0, -0.55, 0.80), 0.04, 0.025),
            ],
        )
        for side in [-1, 1]:
            reach = -0.07 if side == -1 else 0.035
            self.surface(
                "Thin angular reaching arm",
                [
                    ((side * 0.19, -0.06, 1.00), 0.095, 0.10),
                    ((side * 0.32, -0.04, 0.90), 0.085, 0.075),
                    ((side * 0.42, 0.01, 0.73), 0.052, 0.045),
                    ((side * 0.45, -0.11, 0.54), 0.058, 0.05),
                    ((side * 0.46, -0.27 + reach, 0.34), 0.033, 0.035),
                    ((side * 0.46, -0.34 + reach, 0.26), 0.075, 0.045),
                ],
            )
            self.surface(
                "Bent starving hindleg",
                [
                    ((side * 0.11, 0.15, 0.51), 0.10, 0.10),
                    ((side * 0.24, 0.07, 0.37), 0.085, 0.08),
                    ((side * 0.20, 0.25, 0.19), 0.038, 0.04),
                    ((side * 0.20, 0.15, 0.07), 0.04, 0.035),
                    ((side * 0.21, -0.005, 0.035), 0.085, 0.035),
                ],
            )
            self.fingers(side, 0.46, -0.36 + reach, 0.25, "dark", 0.18)
            self.fingers(side, 0.21, -0.02, 0.065, "dark", 0.10, count=3)
        self.unify_skin()
        self.require_connected_skin()
        self.relief("folds")
        self.hollow((0, -0.53, 0.88), (0.105, 0.13, 0.11))
        for side in [-1, 1]:
            self.hollow((side * 0.09, -0.535, 1.025), (0.050, 0.060, 0.039))
            self.surface(
                "Sunken amber eye",
                [
                    ((side * 0.09, -0.516, 1.025), 0.021, 0.020),
                    ((side * 0.09, -0.538, 1.025), 0.024, 0.022),
                    ((side * 0.09, -0.551, 1.025), 0.013, 0.013),
                ],
                "eye",
                False,
                16,
            )
            self.ridge(
                "Jagged brow",
                [
                    (side * 0.035, -0.55, 1.064),
                    (side * 0.095, -0.55, 1.078),
                    (side * 0.15, -0.49, 1.05),
                ],
                [0.018, 0.023, 0.009],
                "skin",
            )
            for i in range(5):
                z = 0.77 + i * 0.046
                width = 0.13 + i * 0.017
                self.ridge(
                    "Raised rib under taut hide",
                    [
                        (side * 0.028, -0.075, z - 0.03),
                        (side * width, -0.135, z),
                        (side * (width + 0.025), 0.005, z + 0.045),
                    ],
                    [0.013, 0.018, 0.009],
                    "skin",
                )
        self.surface(
            "Dark mouth recess",
            [((0, -0.47, 0.84), 0.072, 0.07), ((0, -0.50, 0.86), 0.073, 0.075)],
            "dark",
            False,
            20,
        )
        for i in range(7):
            x = (i - 3) * 0.026
            self.ridge(
                "Uneven upper fang",
                [
                    (x, -0.55, 0.948 - abs(x) * 0.22),
                    (x, -0.572, 0.92 - abs(x) * 0.20),
                    (x, -0.57, 0.89 - abs(x) * 0.11),
                ],
                [0.012, 0.008, 0.001],
            )
            if i % 2 == 0:
                self.ridge(
                    "Lower fang",
                    [
                        (x, -0.54, 0.785 + abs(x) * 0.3),
                        (x, -0.565, 0.83),
                        (x, -0.56, 0.85),
                    ],
                    [0.011, 0.008, 0.001],
                )
        for i in range(8):
            z = 0.65 + i * 0.058
            hit, point, _, _ = self.body.ray_cast(Vector((0, 1, z)), Vector((0, -1, 0)))
            if not hit:
                raise ValueError("The spine ridge must root on the body")
            y = point.y
            self.ridge(
                "Raised spinal process",
                [(0, y - 0.02, z), (0, y + 0.04, z + 0.015), (0, y + 0.055, z + 0.04)],
                [0.025, 0.022, 0.003],
                "skin",
            )
        # A forward neck and long forelimbs carry the scavenger's weight, not a human upright stance.
        for obj in [self.body, *self.details]:
            for vertex in obj.data.vertices:
                z = vertex.co.z
                if z > 0.64:
                    vertex.co.y -= (z - 0.64) * 0.36
                if abs(vertex.co.x) > 0.33 and z < 0.7:
                    weight = min(1, max(0, (0.7 - z) / 0.2))
                    weight = weight * weight * (3 - 2 * weight)
                    vertex.co.z = max(0.012, z - 0.075 * weight)

    def kappa(self):
        self.surface(
            "Stooped round torso",
            [
                ((0, 0.10, 0.30), 0.14, 0.13),
                ((0, 0.09, 0.44), 0.24, 0.20),
                ((0, 0.08, 0.66), 0.28, 0.23),
                ((0, 0.03, 0.86), 0.25, 0.23),
                ((0, -0.07, 0.99), 0.19, 0.16),
            ],
        )
        self.surface(
            "Low broad yokai head",
            [
                ((0, -0.16, 0.76), 0.14, 0.13),
                ((0, -0.24, 0.88), 0.23, 0.19),
                ((0, -0.27, 1.02), 0.24, 0.20),
                ((0, -0.23, 1.10), 0.19, 0.16),
            ],
        )
        for side in [-1, 1]:
            reach = -0.06 if side == -1 else 0.08
            self.surface(
                "Wiry reaching arm",
                [
                    ((side * 0.19, -0.03, 0.85), 0.105, 0.10),
                    ((side * 0.34, -0.02, 0.74), 0.08, 0.075),
                    ((side * 0.41, -0.06, 0.57), 0.045, 0.047),
                    ((side * 0.44, -0.23 + reach, 0.42), 0.054, 0.052),
                    ((side * 0.45, -0.34 + reach, 0.30), 0.032, 0.036),
                    ((side * 0.45, -0.40 + reach, 0.25), 0.074, 0.042),
                ],
            )
            self.surface(
                "Bowed squat leg",
                [
                    ((side * 0.14, 0.11, 0.44), 0.12, 0.12),
                    ((side * 0.29, 0.09, 0.29), 0.11, 0.105),
                    ((side * 0.27, 0.21, 0.14), 0.05, 0.05),
                    ((side * 0.28, 0.07, 0.065), 0.06, 0.043),
                    ((side * 0.28, -0.07, 0.04), 0.10, 0.035),
                ],
            )
            self.fingers(side, 0.45, -0.42 + reach, 0.26, "horn", 0.15)
            self.fingers(side, 0.28, -0.08, 0.065, "horn", 0.10, count=3)
        self.unify_skin()
        self.require_connected_skin()
        self.relief("warty")
        self.hollow((0, -0.23, 1.15), (0.155, 0.14, 0.13))
        self.shell()
        self.crown_bowl()
        self.surface(
            "Cruel hooked beak",
            [
                ((0, -0.40, 0.94), 0.115, 0.055),
                ((0, -0.49, 0.93), 0.10, 0.05),
                ((0, -0.565, 0.875), 0.055, 0.04),
                ((0, -0.55, 0.825), 0.008, 0.012),
            ],
            "horn",
            False,
        )
        for side in [-1, 1]:
            self.hollow((side * 0.13, -0.405, 0.99), (0.055, 0.055, 0.04))
            self.surface(
                "Recessed yokai eye",
                [
                    ((side * 0.13, -0.39, 0.99), 0.026, 0.026),
                    ((side * 0.13, -0.427, 0.99), 0.025, 0.022),
                    ((side * 0.13, -0.44, 0.99), 0.013, 0.015),
                ],
                "eye",
                False,
                16,
            )
            self.ridge(
                "Frowning heavy brow",
                [
                    (side * 0.05, -0.44, 1.025),
                    (side * 0.12, -0.445, 1.055),
                    (side * 0.20, -0.38, 1.045),
                ],
                [0.022, 0.037, 0.012],
                "skin",
            )
            self.ridge(
                "Uneven mouth crease",
                [
                    (side * 0.03, -0.46, 0.85),
                    (side * 0.13, -0.43, 0.84),
                    (side * 0.20, -0.34, 0.82),
                ],
                [0.008, 0.01, 0.003],
                "dark",
            )

    def shell(self):
        points, faces = [], []
        rings, segments = 19, 64
        for ring in range(rings):
            phi = 0.015 + ring / (rings - 1) * (math.pi / 2 - 0.015)
            for i in range(segments):
                theta = math.tau * i / segments
                points.append(
                    (
                        0.33 * math.sin(phi) * math.cos(theta),
                        0.19 + 0.21 * math.cos(phi),
                        0.71 + 0.44 * math.sin(phi) * math.sin(theta),
                    )
                )
        for ring in range(rings - 1):
            for i in range(segments):
                a = ring * segments + i
                b = ring * segments + (i + 1) % segments
                faces.append((a, b, b + segments, a + segments))
        shell = mesh("Curved carapace with sculpted scute seams", points, faces)
        shell["paint"] = "stone"
        bpy.context.view_layer.objects.active = shell
        solid = shell.modifiers.new("Carapace thickness", "SOLIDIFY")
        solid.thickness = 0.027
        bpy.ops.object.modifier_apply(modifier=solid.name)
        self.details.append(shell)
        for cx, cz in [
            (0, 0.71),
            (-0.17, 0.59),
            (0.17, 0.59),
            (-0.16, 0.86),
            (0.16, 0.86),
            (0, 0.99),
            (0, 0.43),
        ]:
            outline = []
            for i in range(7):
                a = math.tau * i / 6
                x = cx + 0.115 * math.cos(a)
                z = cz + 0.135 * math.sin(a)
                q = 1 - (x / 0.33) ** 2 - ((z - 0.71) / 0.44) ** 2
                if q > 0:
                    outline.append((x, 0.19 + 0.21 * math.sqrt(q) + 0.002, z))
            if len(outline) > 2:
                self.ridge(
                    "Irregular shell scute boundary",
                    outline,
                    [0.005] * len(outline),
                    "dark",
                )

    def crown_bowl(self):
        points, faces = [], []
        for ring in range(5):
            r = 0.015 + ring * 0.034
            for i in range(48):
                angle = math.tau * i / 48
                points.append(
                    (
                        r * math.cos(angle),
                        -0.23 + r * 0.85 * math.sin(angle),
                        1.065 + 0.045 * (r / 0.151) ** 2,
                    )
                )
        for ring in range(4):
            for i in range(48):
                a = ring * 48 + i
                b = ring * 48 + (i + 1) % 48
                faces.append((a, b, b + 48, a + 48))
        obj = mesh("Recessed crown water", points, faces)
        obj["paint"] = "skin"
        self.details.append(obj)
        rim = [
            (
                0.163 * math.cos(a),
                -0.23 + 0.14 * math.sin(a),
                1.11 + 0.006 * math.sin(a * 7),
            )
            for a in [math.tau * i / 32 for i in range(33)]
        ]
        self.ridge("Raised crown dish rim", rim, [0.018] * len(rim), "stone")
        for i in range(14):
            a = math.tau * i / 14
            self.ridge(
                "Dark ragged crown fringe",
                [
                    (0.18 * math.cos(a), -0.23 + 0.16 * math.sin(a), 1.10),
                    (0.21 * math.cos(a), -0.23 + 0.19 * math.sin(a), 1.01),
                    (0.20 * math.cos(a), -0.23 + 0.18 * math.sin(a), 0.96),
                ],
                [0.025, 0.022, 0.001],
                "mane",
            )

    def wraith(self):
        self.surface(
            "Narrow bent spectral torso",
            [
                ((0, 0.04, 0.40), 0.08, 0.08),
                ((0.02, 0.03, 0.65), 0.13, 0.10),
                ((0, 0.01, 0.91), 0.19, 0.12),
                ((-0.035, -0.04, 1.10), 0.18, 0.13),
                ((-0.05, -0.08, 1.18), 0.10, 0.10),
            ],
        )
        for side in [-1, 1]:
            reach = -0.12 if side == -1 else 0.02
            self.surface(
                "Angular skeletal arm",
                [
                    ((side * 0.13, 0, 1.03), 0.055, 0.055),
                    ((side * 0.29, -0.01, 0.94), 0.045, 0.04),
                    ((side * 0.39, -0.10, 0.84), 0.026, 0.028),
                    ((side * 0.43, -0.25 + reach, 0.76), 0.026, 0.026),
                    ((side * 0.46, -0.33 + reach, 0.70), 0.052, 0.029),
                ],
            )
            self.fingers(side, 0.46, -0.35 + reach, 0.70, "horn", 0.17)
        self.unify_skin()
        self.require_connected_skin()
        self.hood_and_mask()
        self.tattered_mantle()
        for side in [-1, 1]:
            reach = -0.12 if side == -1 else 0.02
            self.surface(
                "Heavy torn sleeve",
                [
                    ((side * 0.16, 0.01, 1.055), 0.12, 0.11),
                    ((side * 0.28, -0.01, 0.96), 0.105, 0.09),
                    ((side * 0.37, -0.09, 0.85), 0.08, 0.07),
                    ((side * 0.40, -0.19 + reach, 0.80), 0.05, 0.04),
                ],
                "skin",
                False,
            )
            for i in range(3):
                x = side * (0.20 + i * 0.06)
                self.ribbon(
                    "Torn sleeve tail",
                    [
                        (x, 0.04, 0.98 - i * 0.05),
                        (x + side * 0.03, 0.03, 0.78 - i * 0.06),
                        (x + side * 0.04, -0.02, 0.65 - i * 0.04),
                    ],
                    [0.04, 0.035, 0.002],
                )

    def hood_and_mask(self):
        # Open sculpted hood with a thick folded lip; the cavity is real geometry.
        points, faces = [], []
        rings, segments = 11, 40
        for ring in range(rings):
            t = ring / (rings - 1)
            for i in range(segments):
                a = math.tau * i / segments
                width = 0.21 * (1 - 0.76 * t)
                height = 0.30 * (1 - 0.76 * t)
                points.append(
                    (
                        -0.05 + width * math.cos(a),
                        -0.25 + t * 0.28,
                        1.16
                        + height * math.sin(a)
                        + 0.08 * t
                        + 0.10 * max(0, math.sin(a)) ** 6,
                    )
                )
        for ring in range(rings - 1):
            for i in range(segments):
                a = ring * segments + i
                b = ring * segments + (i + 1) % segments
                faces.append((a, b, b + segments, a + segments))
        faces.append(tuple(range((rings - 1) * segments, rings * segments)))
        hood = mesh("Open hollow shroud hood", points, faces)
        hood["paint"] = "skin"
        bpy.context.view_layer.objects.active = hood
        solid = hood.modifiers.new("Heavy cloth thickness", "SOLIDIFY")
        solid.thickness = 0.018
        bpy.ops.object.modifier_apply(modifier=solid.name)
        self.details.append(hood)
        lip = [
            (
                -0.05 + 0.21 * math.cos(a),
                -0.257,
                1.16 + 0.30 * math.sin(a) + 0.10 * max(0, math.sin(a)) ** 6,
            )
            for a in [math.tau * i / 40 for i in range(41)]
        ]
        self.ridge("Folded hood opening", lip, [0.018] * len(lip), "skin")
        self.surface(
            "Elongated eroded bone mask",
            [
                ((-0.05, -0.19, 0.99), 0.018, 0.024),
                ((-0.05, -0.20, 1.10), 0.060, 0.035),
                ((-0.05, -0.20, 1.23), 0.095, 0.045),
                ((-0.05, -0.19, 1.34), 0.08, 0.038),
                ((-0.05, -0.17, 1.37), 0.025, 0.023),
            ],
            "horn",
            False,
        )
        for side in [-1, 1]:
            self.surface(
                "Empty mask eye cavity",
                [
                    ((-0.05 + side * 0.05, -0.239, 1.255), 0.027, 0.036),
                    ((-0.05 + side * 0.05, -0.251, 1.25), 0.028, 0.037),
                ],
                "dark",
                False,
                16,
            )
        self.ridge(
            "Long screaming mouth slit",
            [(-0.05, -0.238, 1.16), (-0.05, -0.241, 1.09), (-0.05, -0.224, 1.025)],
            [0.014, 0.010, 0.002],
            "dark",
        )

    def tattered_mantle(self):
        for i in range(7):
            angle = math.tau * i / 7
            x, y = math.cos(angle), math.sin(angle)
            twist = 0.08 * math.sin(angle * 2)
            lower = -0.04 if i == 2 else 0.035 + 0.09 * (1 + math.sin(i * 2.1))
            self.ribbon(
                "Broad curling shroud strip",
                [
                    (x * 0.18, y * 0.12, 1.05),
                    (x * 0.16, y * 0.13, 0.76),
                    (x * 0.23 + twist, y * 0.17, 0.48),
                    (x * 0.36 + twist, y * 0.23, 0.23),
                    (x * 0.43 + twist, y * 0.26, lower),
                    (x * 0.48 + twist, y * 0.22, lower + 0.12),
                ],
                [0.12, 0.12, 0.10, 0.08, 0.045, 0.001],
                (-y, x),
            )

    def ribbon(self, name, points, widths, across=(1, 0)):
        vertices, faces = [], []
        for i, (point, width) in enumerate(zip(points, widths)):
            for j in range(9):
                u = j / 8 * 2 - 1
                vertices.append(
                    (
                        point[0] + width * u * across[0],
                        point[1]
                        + width * u * across[1]
                        + 0.018 * math.cos(u * math.pi * 2 + i * 0.5),
                        point[2]
                        + 0.018 * math.sin(u * 8 + i)
                        + (0.025 * math.sin(i * 5) if j in [0, 8] else 0),
                    )
                )
        for i in range(len(points) - 1):
            for j in range(8):
                a = i * 9 + j
                faces.append((a, a + 1, a + 10, a + 9))
        obj = mesh(name, vertices, faces)
        obj["paint"] = "skin"
        bpy.context.view_layer.objects.active = obj
        sub = obj.modifiers.new("Flowing cloth sculpt", "SUBSURF")
        sub.levels = 2
        bpy.ops.object.modifier_apply(modifier=sub.name)
        solid = obj.modifiers.new("Frayed cloth thickness", "SOLIDIFY")
        solid.thickness = 0.012
        bpy.ops.object.modifier_apply(modifier=solid.name)
        self.details.append(obj)

    def fingers(self, side, x, y, z, paint, length, count=3):
        for i in range(count):
            finger_x = side * (x + (i - (count - 1) / 2) * 0.045)
            self.surface(
                "Long knuckled finger",
                [
                    ((side * x, y + 0.07, z + 0.055), 0.032, 0.035),
                    ((finger_x, y, z), 0.024, 0.025),
                    ((finger_x + side * 0.012, y - 0.045, z - 0.045), 0.018, 0.018),
                    (
                        (finger_x + side * 0.015, y - 0.09, z - length * 0.70),
                        0.012,
                        0.014,
                    ),
                ],
                "skin",
                True,
                12,
                1,
            )
            self.ridge(
                "Hooked terminal claw",
                [
                    (finger_x + side * 0.015, y - 0.065, z - length * 0.55),
                    (finger_x + side * 0.02, y - 0.13, z - length * 0.85),
                    (finger_x + side * 0.015, y - 0.14, z - length),
                ],
                [0.015, 0.011, 0.001],
                paint,
            )

    def require_connected_skin(self):
        neighbors = [set() for _ in self.body.data.vertices]
        for edge in self.body.data.edges:
            a, b = edge.vertices
            neighbors[a].add(b)
            neighbors[b].add(a)
        reached, pending = {0}, [0]
        while pending:
            for vertex in neighbors[pending.pop()]:
                if vertex not in reached:
                    reached.add(vertex)
                    pending.append(vertex)
        if len(reached) != len(neighbors):
            raise ValueError(
                "Join every finger and limb into the body before surface details"
            )

    def hollow(self, location, size):
        bpy.ops.mesh.primitive_uv_sphere_add(
            segments=24, ring_count=16, location=location
        )
        cutter = bpy.context.object
        cutter.scale = size
        bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
        bpy.context.view_layer.objects.active = self.body
        cut = self.body.modifiers.new("Sculpted anatomical recess", "BOOLEAN")
        cut.operation = "DIFFERENCE"
        cut.object = cutter
        bpy.ops.object.modifier_apply(modifier=cut.name)
        bpy.data.objects.remove(cutter, do_unlink=True)


if __name__ == "__main__":
    species = sys.argv[sys.argv.index("--") + 1]
    if species not in {"ghoul", "kappa", "wraith"}:
        raise ValueError("Choose ghoul, kappa or wraith")
    creature = WeakBeast(species)
    getattr(creature, species)()
    bpy.context.scene["paintingVertical"] = {
        "ghoul": (1.00944, 0.000322),
        "kappa": (0.985848, 0.036607),
        "wraith": (1.006562, 0.002013),
    }[species]
    creature.finish()
