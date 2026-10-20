"""Sculpt the Wraith from its retained concept turnaround."""

import math
import runpy
import sys
from pathlib import Path

import bpy

ART = runpy.run_path(str(Path(__file__).with_name("sculpt-creatures.py")))
Creature, mesh = ART["Creature"], ART["mesh"]
ART["BASE"]["TONES"]["wraith"] = (0.12, 0.16, 0.25)


class WeakBeast(Creature):
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
                pleat = 1 + 0.035 * math.sin(a * 6 + t * 2)
                width = 0.21 * (1 - 0.76 * t) * pleat
                height = 0.30 * (1 - 0.76 * t) * pleat
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
        for side in [-1, 1]:
            self.ridge(
                "Carved mask brow",
                [
                    (-0.05 + side * 0.015, -0.245, 1.285),
                    (-0.05 + side * 0.052, -0.258, 1.30),
                    (-0.05 + side * 0.080, -0.226, 1.275),
                ],
                [0.008, 0.014, 0.004],
                "horn",
            )
            self.ridge(
                "Raised mask cheek edge",
                [
                    (-0.05 + side * 0.070, -0.228, 1.225),
                    (-0.05 + side * 0.044, -0.244, 1.155),
                    (-0.05 + side * 0.018, -0.230, 1.055),
                ],
                [0.008, 0.011, 0.002],
                "horn",
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

    def finish(self):
        bpy.context.scene["paintingVertical"] = (1.006562, 0.002013)
        super().finish()

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


if __name__ == "__main__":
    species = sys.argv[sys.argv.index("--") + 1]
    if species != "wraith":
        raise ValueError("Choose wraith")
    creature = WeakBeast(species)
    creature.wraith()
    creature.finish()
