"""Sculpt surface-ruin guardians and the hovering rift fey from their concept paintings."""

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
        "basilisk": (0.08, 0.23, 0.25),
        "ammit": (0.32, 0.22, 0.12),
        "dark-fey": (0.20, 0.12, 0.24),
    }
)


class SiteBeast(Creature):
    def basilisk(self):
        coil = []
        for i in range(34):
            t = i / 33
            angle = -math.pi / 2 + t * math.tau * 1.15
            radius = 0.32 - 0.14 * t
            width = 0.008 + 0.105 * math.sin(t * math.pi / 2)
            coil.append(
                (
                    (
                        math.cos(angle) * radius,
                        math.sin(angle) * radius + 0.05,
                        0.08 + 0.14 * t,
                    ),
                    width,
                    width,
                )
            )
        self.surface("Compact winding serpent body", coil)
        tip = coil[-1][0]
        self.surface(
            "Upright S-curved neck",
            [
                (tip, 0.12, 0.12),
                ((0.08, 0.12, 0.33), 0.15, 0.14),
                ((-0.05, 0.10, 0.52), 0.17, 0.13),
                ((-0.08, 0.03, 0.76), 0.14, 0.12),
                ((-0.04, -0.06, 0.98), 0.12, 0.11),
                ((0.01, -0.16, 1.10), 0.14, 0.12),
            ],
        )
        self.surface(
            "Crowned reptilian skull",
            [
                ((0.01, -0.14, 1.06), 0.13, 0.10),
                ((0.01, -0.22, 1.16), 0.17, 0.13),
                ((0.01, -0.32, 1.13), 0.17, 0.11),
                ((0.01, -0.40, 1.08), 0.11, 0.07),
            ],
        )
        self.surface(
            "Lower open jaw",
            [
                ((0.01, -0.16, 1.01), 0.10, 0.08),
                ((0.01, -0.26, 0.94), 0.11, 0.045),
                ((0.01, -0.40, 0.95), 0.08, 0.025),
            ],
            connected=True,
        )
        for row in range(3):
            y = 0.24 - row * 0.21
            for side in [-1, 1]:
                self.surface(
                    "Six tucked claw limbs",
                    [
                        ((side * 0.13, y, 0.23), 0.065, 0.06),
                        ((side * 0.25, y - 0.02, 0.22), 0.06, 0.055),
                        ((side * 0.31, y - 0.04, 0.12), 0.038, 0.035),
                        ((side * 0.29, y - 0.10, 0.055), 0.05, 0.035),
                    ],
                )
                for toe in range(3):
                    x = side * (0.255 + toe * 0.027)
                    self.ridge(
                        "Short hooked talon",
                        [
                            (x, y - 0.08, 0.08),
                            (x, y - 0.16, 0.035),
                            (x, y - 0.18, 0.018),
                        ],
                        [0.018, 0.014, 0.001],
                        "horn",
                    )
        self.unify_skin()
        self.require_connected_skin()
        self.relief("warty")
        for side in [-1, 1]:
            x, z = side * 0.112 + 0.01, 1.151
            self.eye_patch(x, self.face_y(x, z) - 0.008, z, 0.032)
            self.ridge(
                "Angled crown brow",
                [
                    (side * 0.035 + 0.01, -0.37, 1.19),
                    (side * 0.115 + 0.01, -0.32, 1.21),
                    (side * 0.17 + 0.01, -0.24, 1.17),
                ],
                [0.018, 0.025, 0.009],
                "horn",
            )
            for i in range(3):
                x = side * (0.06 + i * 0.052)
                self.ridge(
                    "Swept crown spike",
                    [
                        (x, -0.20 + i * 0.035, 1.18 - i * 0.016),
                        (x * 1.25, -0.14 + i * 0.045, 1.32 - i * 0.018),
                        (x * 1.4, -0.08 + i * 0.045, 1.39 - i * 0.025),
                    ],
                    [0.031, 0.022, 0.001],
                    "horn",
                )
            for i in range(3):
                y = -0.28 - i * 0.045
                self.ridge(
                    "Venom fang",
                    [
                        (side * 0.09 + 0.01, y, 1.08),
                        (side * 0.085 + 0.01, y - 0.01, 1.01),
                        (side * 0.07 + 0.01, y - 0.015, 0.97),
                    ],
                    [0.016, 0.011, 0.001],
                    "horn",
                )
        for i in range(9):
            z = 0.40 + i * 0.073
            y = self.face_y(0, z) - 0.009
            width = 0.105 if i < 5 else 0.083
            self.ridge(
                "Overlapping pale throat plate",
                [
                    (-width, y + 0.016, z),
                    (0, y - 0.009, z - 0.018),
                    (width, y + 0.016, z),
                ],
                [0.014, 0.022, 0.014],
                "horn",
            )
        for i in range(4, 30, 3):
            center = Vector(coil[i][0])
            radial = Vector((center.x, center.y - 0.05, 0)).normalized()
            self.ridge(
                "Dorsal coil scute",
                [
                    center + Vector((0, 0, 0.08)),
                    center + radial * 0.035 + Vector((0, 0, 0.14)),
                    center + radial * 0.06 + Vector((0, 0, 0.16)),
                ],
                [0.026, 0.018, 0.001],
                "skin",
            )

    def ammit(self):
        self.surface(
            "Barrel hindquarters and lion shoulders",
            [
                ((0, 0.31, 0.33), 0.12, 0.13),
                ((0, 0.20, 0.40), 0.21, 0.20),
                ((0, 0.02, 0.45), 0.23, 0.22),
                ((0, -0.14, 0.49), 0.23, 0.24),
                ((0, -0.23, 0.61), 0.19, 0.20),
                ((0, -0.25, 0.73), 0.14, 0.14),
            ],
        )
        self.surface(
            "Raised crocodile cranium",
            [
                ((0, -0.20, 0.70), 0.12, 0.11),
                ((0, -0.27, 0.84), 0.17, 0.12),
                ((0, -0.39, 0.88), 0.16, 0.10),
                ((0, -0.52, 0.86), 0.12, 0.065),
                ((0, -0.59, 0.86), 0.10, 0.06),
            ],
        )
        self.surface(
            "Long lower jaw",
            [
                ((0, -0.23, 0.73), 0.13, 0.10),
                ((0, -0.36, 0.70), 0.13, 0.04),
                ((0, -0.50, 0.73), 0.105, 0.032),
                ((0, -0.58, 0.77), 0.08, 0.025),
            ],
        )
        for side in [-1, 1]:
            advance = -0.045 if side < 0 else 0.025
            self.surface(
                "Lion foreleg",
                [
                    ((side * 0.16, -0.15, 0.49), 0.10, 0.12),
                    ((side * 0.21, -0.20, 0.32), 0.075, 0.08),
                    ((side * 0.23, -0.28 + advance, 0.13), 0.055, 0.06),
                    ((side * 0.23, -0.35 + advance, 0.055), 0.09, 0.045),
                ],
            )
            self.surface(
                "Hippo rear haunch",
                [
                    ((side * 0.14, 0.22, 0.37), 0.13, 0.13),
                    ((side * 0.23, 0.25, 0.25), 0.11, 0.10),
                    ((side * 0.25, 0.19, 0.13), 0.065, 0.06),
                    ((side * 0.25, 0.15, 0.05), 0.085, 0.045),
                ],
            )
            for y in [-0.38 + advance, 0.11]:
                for toe in range(3):
                    x = side * (0.20 + toe * 0.033)
                    self.ridge(
                        "Heavy paw claw",
                        [
                            (x, y + 0.03, 0.07),
                            (x, y - 0.015, 0.045),
                            (x, y - 0.05, 0.02),
                        ],
                        [0.02, 0.016, 0.001],
                        "dark",
                    )
        self.surface(
            "Curled crocodile tail",
            [
                ((0, 0.28, 0.36), 0.12, 0.10),
                ((0.16, 0.34, 0.28), 0.10, 0.08),
                ((0.30, 0.28, 0.19), 0.075, 0.065),
                ((0.34, 0.08, 0.13), 0.053, 0.045),
                ((0.29, -0.07, 0.10), 0.029, 0.025),
                ((0.22, -0.14, 0.09), 0.002, 0.003),
            ],
        )
        self.unify_skin()
        self.require_connected_skin()
        self.relief("warty")
        for side in [-1, 1]:
            self.eye_patch(side * 0.12, -0.366, 0.927, 0.026)
            self.ridge(
                "Crocodile brow",
                [
                    (side * 0.075, -0.40, 0.94),
                    (side * 0.13, -0.34, 0.96),
                    (side * 0.16, -0.27, 0.90),
                ],
                [0.018, 0.024, 0.012],
                "skin",
            )
            self.ridge(
                "Broken cheek horn",
                [
                    (side * 0.14, -0.25, 0.79),
                    (side * 0.22, -0.21, 0.91),
                    (side * 0.20, -0.15, 1.02),
                ],
                [0.036, 0.024, 0.001],
                "horn",
            )
            for i in range(6):
                y = -0.30 - i * 0.045
                width = 0.13 - i * 0.009
                self.ridge(
                    "Upper irregular tooth",
                    [
                        (side * width, y, 0.84),
                        (side * (width - 0.005), y, 0.785 - i * 0.003),
                    ],
                    [0.012, 0.001],
                    "horn",
                )
                self.ridge(
                    "Lower irregular tooth",
                    [(side * width, y, 0.735), (side * (width - 0.008), y, 0.78)],
                    [0.011, 0.001],
                    "horn",
                )
        for ring in range(5):
            z = 0.48 + ring * 0.064
            radius = 0.20 - ring * 0.014
            for i in range(11):
                angle = math.tau * i / 11
                x = math.cos(angle) * radius
                y = -0.12 + math.sin(angle) * radius * 0.85
                self.ridge(
                    "Sculpted bronze mane lock",
                    [
                        (x * 0.8, y, z + 0.07),
                        (x * 1.08, y - 0.015, z),
                        (x * 1.16, y + 0.012, z - 0.10),
                    ],
                    [0.035, 0.030, 0.001],
                    "skin",
                )
        for i in range(6):
            self.ridge(
                "Rear dorsal scale",
                [
                    (-0.04, 0.05 + i * 0.04, 0.61 - i * 0.018),
                    (0, 0.05 + i * 0.04, 0.65 - i * 0.018),
                    (0.04, 0.05 + i * 0.04, 0.61 - i * 0.018),
                ],
                [0.015, 0.020, 0.015],
                "skin",
            )

    def dark_fey(self):
        self.surface(
            "Narrow crooked fey torso",
            [
                ((0, 0.04, 0.61), 0.055, 0.045),
                ((0, 0.03, 0.73), 0.07, 0.05),
                ((-0.02, 0, 0.86), 0.055, 0.04),
                ((-0.035, -0.02, 0.98), 0.095, 0.055),
                ((-0.025, -0.06, 1.08), 0.05, 0.045),
            ],
        )
        self.surface(
            "Elongated mask head",
            [
                ((-0.025, -0.07, 1.03), 0.045, 0.045),
                ((-0.025, -0.11, 1.14), 0.075, 0.065),
                ((-0.025, -0.12, 1.23), 0.085, 0.06),
                ((-0.025, -0.08, 1.28), 0.045, 0.045),
            ],
        )
        for side in [-1, 1]:
            self.surface(
                "Thin reaching forearm",
                [
                    ((-0.035 + side * 0.045, -0.02, 0.98), 0.045, 0.04),
                    ((side * 0.15, -0.05, 0.91), 0.032, 0.028),
                    ((side * 0.22, -0.12, 0.80), 0.022, 0.02),
                    ((side * 0.23, -0.22, 0.77), 0.038, 0.023),
                ],
            )
            self.surface(
                "Folded hovering leg",
                [
                    ((side * 0.04, 0.03, 0.68), 0.045, 0.04),
                    ((side * 0.09, -0.06, 0.59), 0.042, 0.035),
                    ((side * 0.08, 0.05, 0.50), 0.024, 0.023),
                    ((side * 0.05, -0.015, 0.40), 0.02, 0.02),
                ],
            )
            for i in range(3):
                x = side * (0.21 + i * 0.025)
                self.surface(
                    "Jointed claw finger",
                    [
                        ((side * 0.23, -0.20, 0.78), 0.021, 0.021),
                        ((x, -0.25, 0.74), 0.017, 0.016),
                        ((x, -0.27, 0.68), 0.012, 0.011),
                    ],
                    sides=12,
                    subdivision=1,
                )
                self.ridge(
                    "Curled finger tip",
                    [(x, -0.27, 0.70), (x, -0.29, 0.66), (x, -0.30, 0.69)],
                    [0.012, 0.009, 0.001],
                    "horn",
                )
            self.ridge(
                "Long curled floating toe",
                [
                    (side * 0.05, -0.01, 0.43),
                    (side * 0.04, -0.07, 0.36),
                    (side * 0.07, -0.10, 0.36),
                    (side * 0.08, -0.10, 0.40),
                ],
                [0.021, 0.016, 0.009, 0.001],
                "horn",
            )
        self.unify_skin()
        self.require_connected_skin()
        self.relief("folds")
        for side in [-1, 1]:
            self.eye_patch(-0.025 + side * 0.035, -0.177, 1.195, 0.022)
            self.ridge(
                "Backward thorn antler",
                [
                    (-0.025 + side * 0.05, -0.08, 1.25),
                    (-0.025 + side * 0.10, -0.02, 1.35),
                    (-0.025 + side * 0.115, 0.05, 1.44),
                ],
                [0.024, 0.018, 0.001],
                "horn",
            )
            self.fey_wing(side, False)
            self.fey_wing(side, True)
        for i in range(7):
            z = 0.72 + i * 0.045
            self.ridge(
                "Overlapping bark breastplate",
                [
                    (-0.04, -0.033, z + 0.025),
                    (-0.015, -0.055, z),
                    (0.04, -0.03, z + 0.025),
                ],
                [0.009, 0.014, 0.009],
                "skin",
            )

    def fey_wing(self, side, lower):
        root = Vector((side * 0.065, 0.025, 0.96 if not lower else 0.84))
        if lower:
            outline = [
                (0.10, 0.05, 0.87),
                (0.27, 0.09, 0.83),
                (0.48, 0.10, 0.76),
                (0.57, 0.10, 0.57),
                (0.50, 0.08, 0.45),
                (0.44, 0.08, 0.51),
                (0.35, 0.06, 0.55),
                (0.28, 0.05, 0.62),
                (0.18, 0.04, 0.69),
            ]
        else:
            outline = [
                (0.10, 0.04, 1.01),
                (0.25, 0.09, 1.22),
                (0.50, 0.13, 1.46),
                (0.65, 0.12, 1.49),
                (0.61, 0.12, 1.38),
                (0.60, 0.11, 1.21),
                (0.52, 0.10, 1.04),
                (0.42, 0.08, 0.96),
                (0.26, 0.06, 0.92),
            ]
        edge = []
        for i, point in enumerate(outline):
            edge.append(Vector((side * point[0], point[1], point[2])))
            if i in [3, 5, 7]:
                x, y, z = outline[i + 1]
                following = Vector((side * x, y, z))
                notch = edge[-1].lerp(following, 0.5)
                edge.extend(
                    [
                        edge[-1].lerp(notch, 0.75),
                        root.lerp(notch, 0.80),
                        following.lerp(notch, 0.75),
                    ]
                )
        vertices = [tuple(root)]
        rings = 8
        for ring in range(1, rings + 1):
            t = ring / rings
            for i, point in enumerate(edge):
                p = root.lerp(point, t)
                p.y += 0.045 * math.sin(t * math.pi) + 0.012 * math.sin(i * 3) * t * t
                vertices.append(tuple(p))
        n = len(edge)
        faces = [(0, 1 + i, 1 + (i + 1) % n) for i in range(n)]
        for ring in range(rings - 1):
            for i in range(n):
                a = 1 + ring * n + i
                b = 1 + ring * n + (i + 1) % n
                faces.append((a, b, b + n, a + n))
        wing = mesh(
            "Curved ragged lower wing" if lower else "Curved ragged upper wing",
            vertices,
            faces,
        )
        wing["paint"] = "skin"
        bpy.context.view_layer.objects.active = wing
        sub = wing.modifiers.new("Sculpted wing membrane", "SUBSURF")
        sub.levels = 2
        bpy.ops.object.modifier_apply(modifier=sub.name)
        solid = wing.modifiers.new("Solid wing edge", "SOLIDIFY")
        solid.thickness = 0.008
        bpy.ops.object.modifier_apply(modifier=solid.name)
        self.details.append(wing)
        for i in [2, 3, 8, 13]:
            end = root.lerp(edge[i], 0.87)
            mid = root.lerp(end, 0.5)
            mid.y += 0.04
            self.ridge(
                "Raised wing vein", [root, mid, end], [0.012, 0.008, 0.002], "skin"
            )

    def eye_patch(self, x, y, z, size):
        self.surface(
            "Recessed dark eye",
            [
                ((x, y + 0.012, z), size, size * 0.7),
                ((x, y - 0.005, z), size * 0.8, size * 0.5),
            ],
            "dark",
            False,
            16,
        )
        self.surface(
            "Small amber pupil",
            [
                ((x, y - 0.01, z), size * 0.30, size * 0.30),
                ((x, y - 0.018, z), size * 0.22, size * 0.22),
            ],
            "eye",
            False,
            12,
        )

    def paint_anatomy(self, color, vertex):
        x, y, z = vertex.co
        if self.species == "ammit":
            if z > 0.45 and -0.33 < y < 0.03:
                return (0.36, 0.16, 0.055)
            if y > 0.06:
                return (0.13, 0.12, 0.11)
        if self.species == "dark-fey" and y < -0.12 and z > 1.07:
            return (0.66, 0.61, 0.48)
        return color


if __name__ == "__main__":
    species = sys.argv[sys.argv.index("--") + 1]
    if species not in {"basilisk", "ammit", "dark-fey"}:
        raise ValueError("Choose basilisk, ammit or dark-fey")
    creature = SiteBeast(species)
    getattr(creature, species.replace("-", "_"))()
    creature.finish()
