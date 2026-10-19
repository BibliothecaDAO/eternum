"""Sculpt creature-specific body plans for the lab comparison with the standing beasts."""

import math
import runpy
import sys
from pathlib import Path

import bpy
from mathutils import Vector
from mathutils.noise import noise_vector

BASE = runpy.run_path(str(Path(__file__).with_name("sculpt-beasts.py")))
Sculpt = BASE["Sculpt"]
SOURCE = BASE["SOURCE"]
join = BASE["join"]
mesh = BASE["mesh"]
apply_paint = BASE["apply_paint"]
DESTINATION = SOURCE / "creatures"


class Creature(Sculpt):
    def troll(self):
        self.surface(
            "Arched bog back",
            [
                ((0, 0.22, 0.43), 0.14, 0.16),
                ((0, 0.19, 0.63), 0.22, 0.24),
                ((0, 0.13, 0.91), 0.25, 0.28),
                ((0, 0.06, 1.13), 0.24, 0.20),
                ((0, -0.07, 1.16), 0.18, 0.15),
                ((0, -0.16, 1.04), 0.13, 0.13),
            ],
        )
        self.surface(
            "Low forward skull",
            [
                ((0, -0.13, 0.99), 0.13, 0.12),
                ((0, -0.22, 1.02), 0.18, 0.17),
                ((0, -0.33, 0.94), 0.21, 0.17),
                ((0, -0.39, 0.82), 0.18, 0.13),
                ((0, -0.34, 0.72), 0.13, 0.08),
            ],
        )
        self.surface(
            "Pendulous hooked nose",
            [
                ((0, -0.40, 0.98), 0.055, 0.05),
                ((0, -0.48, 0.94), 0.058, 0.055),
                ((0, -0.54, 0.86), 0.047, 0.045),
                ((0, -0.51, 0.81), 0.025, 0.026),
            ],
        )
        for s in [-1, 1]:
            reach = -0.04 if s == -1 else 0.04
            self.surface(
                "Long bent forelimb",
                [
                    ((s * 0.18, -0.01, 1.02), 0.13, 0.13),
                    ((s * 0.31, -0.04, 0.89), 0.11, 0.10),
                    ((s * 0.40, 0.01, 0.68), 0.072, 0.078),
                    ((s * 0.43, -0.08, 0.51), 0.075, 0.082),
                    ((s * 0.44, -0.22 + reach, 0.24), 0.055, 0.06),
                    ((s * 0.44, -0.31 + reach, 0.12), 0.085, 0.055),
                ],
            )
            self.surface(
                "Folded frog haunch",
                [
                    ((s * 0.12, 0.18, 0.59), 0.12, 0.15),
                    ((s * 0.27, 0.21, 0.46), 0.14, 0.14),
                    ((s * 0.30, 0.12, 0.28), 0.09, 0.10),
                    ((s * 0.23, 0.29, 0.15), 0.048, 0.05),
                    ((s * 0.23, 0.20, 0.07), 0.065, 0.05),
                    ((s * 0.24, 0.07, 0.04), 0.085, 0.035),
                ],
            )
            for i in range(3):
                x = s * (0.38 + i * 0.05)
                self.surface(
                    "Splayed hooked finger",
                    [
                        ((x, -0.27 + reach, 0.18), 0.026, 0.030),
                        ((x, -0.33 + reach, 0.12), 0.024, 0.026),
                        ((x + s * 0.012, -0.40 + reach, 0.07), 0.022, 0.022),
                        ((x + s * 0.018, -0.43 + reach, 0.035), 0.013, 0.014),
                    ],
                    sides=12,
                    subdivision=1,
                )
            self.surface(
                "Pointed swamp ear",
                [
                    ((s * 0.14, -0.24, 0.99), 0.06, 0.065),
                    ((s * 0.23, -0.21, 1.04), 0.047, 0.035),
                    ((s * 0.30, -0.17, 1.12), 0.002, 0.003),
                ],
            )
        self.unify_skin()
        self.relief("warty")
        for s in [-1, 1]:
            self.eye(s * 0.11, 0.96, 0.026)
            self.ridge(
                "Heavy sloping brow",
                [
                    (s * 0.045, self.face_y(s * 0.045, 1.005) - 0.01, 1.005),
                    (s * 0.105, self.face_y(s * 0.105, 1.015) - 0.015, 1.015),
                    (s * 0.16, self.face_y(s * 0.16, 0.99) - 0.008, 0.99),
                ],
                [0.021, 0.032, 0.013],
                "skin",
            )
            self.ridge(
                "Crooked lower tusk",
                [
                    (s * 0.12, self.face_y(s * 0.12, 0.78) - 0.012, 0.78),
                    (s * 0.14, -0.48, 0.83),
                    (s * 0.13, -0.47, 0.90),
                ],
                [0.023, 0.019, 0.001],
            )
        self.mouth(
            [(-0.14, 0.80), (-0.07, 0.785), (0, 0.79), (0.07, 0.78), (0.14, 0.81)]
        )
        for i in range(7):
            x = (i - 3) * 0.065
            z = 1.14 - 0.10 * abs(i - 3) / 3
            self.ridge(
                "Weathered back quill",
                [(x, 0.17, z), (x, 0.21, z + 0.11), (x + 0.012, 0.25, z + 0.16)],
                [0.035, 0.024, 0.001],
                "stone",
            )

    def minotaur(self):
        self.surface(
            "Sloping bison trunk",
            [
                ((0, 0.22, 0.66), 0.12, 0.14),
                ((0, 0.17, 0.85), 0.19, 0.20),
                ((0, 0.12, 1.10), 0.24, 0.25),
                ((0, 0.08, 1.34), 0.25, 0.23),
                ((0, 0.04, 1.48), 0.21, 0.17),
                ((0, -0.08, 1.43), 0.16, 0.13),
            ],
        )
        self.surface(
            "Lowered bull skull",
            [
                ((0, -0.10, 1.30), 0.16, 0.16),
                ((0, -0.22, 1.25), 0.21, 0.19),
                ((0, -0.32, 1.12), 0.18, 0.17),
                ((0, -0.44, 1.00), 0.14, 0.12),
                ((0, -0.51, 0.94), 0.13, 0.075),
                ((0, -0.53, 0.92), 0.10, 0.04),
            ],
        )
        for side in [-1, 1]:
            step = -0.10 if side == -1 else 0.10
            self.surface(
                "Long bovine hock",
                [
                    ((side * 0.14, 0.16, 0.84), 0.11, 0.13),
                    ((side * 0.22, 0.07 + step, 0.67), 0.11, 0.12),
                    ((side * 0.23, -0.03 + step, 0.48), 0.065, 0.07),
                    ((side * 0.22, 0.13 + step, 0.25), 0.046, 0.05),
                    ((side * 0.24, 0.06 + step, 0.12), 0.044, 0.05),
                    ((side * 0.25, -0.01 + step, 0.06), 0.055, 0.045),
                ],
            )
            for split in [-1, 1]:
                x = side * 0.25 + split * 0.035
                self.surface(
                    "Cloven weight bearing hoof",
                    [
                        ((x, 0.04 + step, 0.10), 0.039, 0.05),
                        ((x, -0.025 + step, 0.06), 0.042, 0.055),
                        ((x, -0.10 + step, 0.035), 0.040, 0.025),
                    ],
                    "hoof",
                    False,
                    16,
                    1,
                )
            self.surface(
                "Folded slender forelimb",
                [
                    ((side * 0.19, -0.10, 1.19), 0.085, 0.09),
                    ((side * 0.31, -0.18, 1.04), 0.075, 0.07),
                    ((side * 0.34, -0.24, 0.85), 0.05, 0.055),
                    ((side * 0.25, -0.29, 0.78), 0.045, 0.05),
                    ((side * 0.18, -0.33, 0.86), 0.052, 0.045),
                ],
            )
            for i in range(3):
                x = side * (0.15 + i * 0.025)
                self.surface(
                    "Curled fingers",
                    [
                        ((x, -0.31, 0.87), 0.018, 0.018),
                        ((x, -0.36, 0.84), 0.017, 0.016),
                        ((x, -0.37, 0.80), 0.012, 0.012),
                    ],
                    sides=12,
                    subdivision=1,
                )
            self.ridge(
                "Broad swept bull horn",
                [
                    (side * 0.14, -0.20, 1.28),
                    (side * 0.29, -0.18, 1.29),
                    (side * 0.44, -0.15, 1.24),
                    (side * 0.53, -0.13, 1.28),
                    (side * 0.57, -0.14, 1.40),
                ],
                [0.065, 0.061, 0.043, 0.025, 0.001],
            )
            self.surface(
                "Lateral bovine ear",
                [
                    ((side * 0.15, -0.20, 1.16), 0.05, 0.045),
                    ((side * 0.27, -0.15, 1.15), 0.06, 0.025),
                    ((side * 0.32, -0.12, 1.18), 0.002, 0.002),
                ],
            )
        self.surface(
            "Switching tail",
            [
                ((0, 0.31, 0.80), 0.045, 0.045),
                ((-0.14, 0.40, 0.79), 0.030, 0.030),
                ((-0.29, 0.42, 0.92), 0.023, 0.022),
                ((-0.33, 0.36, 1.06), 0.014, 0.015),
            ],
        )
        self.ridge(
            "Tail tuft",
            [(-0.33, 0.36, 1.10), (-0.35, 0.37, 1.04), (-0.35, 0.40, 0.96)],
            [0.035, 0.049, 0.001],
            "mane",
        )
        self.unify_skin()
        self.relief("hide")
        for side in [-1, 1]:
            self.eye(side * 0.105, 1.18, 0.026)
            self.ridge(
                "Broad nostril",
                [(side * 0.065, -0.516, 0.987), (side * 0.07, -0.535, 0.960)],
                [0.022, 0.022],
                "dark",
            )
            for row in range(6):
                for col in range(4):
                    z = 1.44 - row * 0.09
                    x = side * (0.06 + col * 0.055)
                    y = 0.09 + 0.13 * math.sin(col / 3 * math.pi / 2)
                    self.ridge(
                        "Swept shaggy mane lock",
                        [
                            (x, y, z),
                            (x + side * 0.025, y + 0.045, z - 0.085),
                            (x + side * 0.014, y + 0.02, z - 0.18),
                        ],
                        [0.042, 0.047, 0.001],
                        "mane",
                    )
            for i in range(6):
                x = side * (0.12 + 0.025 * i)
                z = 1.28 - 0.042 * i
                self.ridge(
                    "Hanging cheek mane",
                    [
                        (x, -0.20, z),
                        (x + side * 0.018, -0.25, z - 0.09),
                        (x + side * 0.006, -0.22, z - 0.18),
                    ],
                    [0.035, 0.040, 0.001],
                    "mane",
                )
        self.mouth([(-0.08, 0.925), (0, 0.91), (0.08, 0.925)])

    def cyclops(self):
        self.base = (0.46, 0.29, 0.12)
        self.surface(
            "Sagging pear body",
            [
                ((-0.03, 0.02, 0.30), 0.16, 0.16),
                ((-0.02, -0.01, 0.43), 0.30, 0.25),
                ((0, -0.025, 0.68), 0.38, 0.32),
                ((0.015, 0.01, 0.91), 0.33, 0.26),
                ((0.045, 0.025, 1.12), 0.24, 0.20),
                ((0.065, 0.015, 1.28), 0.19, 0.17),
                ((0.075, 0.025, 1.47), 0.14, 0.13),
                ((0.08, 0.04, 1.56), 0.045, 0.045),
            ],
        )
        self.surface(
            "Underhung crooked jaw",
            [
                ((0.06, -0.13, 1.18), 0.13, 0.10),
                ((0.04, -0.21, 1.10), 0.15, 0.10),
                ((0.025, -0.22, 1.04), 0.12, 0.06),
            ],
        )
        for side in [-1, 1]:
            step = -0.06 if side == -1 else 0.08
            self.surface(
                "Squat bowed leg",
                [
                    ((side * 0.19, 0.04, 0.46), 0.13, 0.14),
                    ((side * 0.28, -0.01 + step, 0.30), 0.115, 0.12),
                    ((side * 0.26, 0.01 + step, 0.15), 0.082, 0.085),
                    ((side * 0.28, -0.10 + step, 0.065), 0.12, 0.065),
                    ((side * 0.28, -0.19 + step, 0.045), 0.10, 0.035),
                ],
            )
            for i in range(3):
                x = side * 0.28 + (i - 1) * 0.056
                self.surface(
                    "Broad uneven toe",
                    [
                        ((x, -0.12 + step, 0.07), 0.032, 0.04),
                        ((x, -0.24 + step, 0.045), 0.030, 0.028),
                        ((x, -0.27 + step, 0.025), 0.019, 0.018),
                    ],
                    sides=12,
                    subdivision=1,
                )
        self.surface(
            "Hanging thin arm",
            [
                ((0.22, 0.005, 1.13), 0.10, 0.10),
                ((0.36, -0.02, 0.99), 0.09, 0.085),
                ((0.45, -0.05, 0.77), 0.055, 0.055),
                ((0.47, -0.09, 0.55), 0.06, 0.06),
                ((0.50, -0.14, 0.28), 0.04, 0.045),
                ((0.49, -0.18, 0.20), 0.067, 0.05),
            ],
        )
        self.surface(
            "Arm resting across belly",
            [
                ((-0.16, -0.01, 1.11), 0.095, 0.10),
                ((-0.32, -0.08, 0.99), 0.08, 0.085),
                ((-0.36, -0.22, 0.85), 0.055, 0.06),
                ((-0.25, -0.32, 0.84), 0.06, 0.055),
                ((-0.08, -0.37, 0.78), 0.055, 0.035),
            ],
        )
        for i in range(4):
            x = -0.14 + i * 0.036
            self.surface(
                "Resting long finger",
                [
                    ((x, -0.36, 0.80), 0.021, 0.022),
                    ((x + 0.02, -0.37, 0.69), 0.021, 0.022),
                    ((x + 0.025, -0.36, 0.62), 0.014, 0.015),
                ],
                sides=12,
                subdivision=1,
            )
            x = 0.43 + i * 0.038
            self.surface(
                "Drooping crooked finger",
                [
                    ((x, -0.17, 0.23), 0.021, 0.025),
                    ((x, -0.24, 0.14), 0.021, 0.022),
                    ((x, -0.27, 0.10), 0.013, 0.014),
                ],
                sides=12,
                subdivision=1,
            )
        self.unify_skin()
        self.relief("folds")
        self.great_eye(0.065, 1.33, 0.115)
        self.mouth(
            [
                (-0.075, 1.115),
                (-0.025, 1.135),
                (0.03, 1.14),
                (0.09, 1.12),
                (0.13, 1.095),
            ]
        )
        for i in range(5):
            x = -0.05 + i * 0.033
            z = 1.123 - abs(i - 2) * 0.009
            y = self.face_y(x, z) - 0.013
            self.ridge(
                "Uneven peg tooth",
                [(x, y, z + 0.018), (x, y - 0.009, z), (x, y - 0.005, z - 0.012)],
                [0.014, 0.015, 0.010],
            )

    def great_eye(self, x, z, size):
        y = self.face_y(x, z) - 0.013
        for name, scale, depth, paint in [
            ("Deep single socket", 1.18, 0, "dark"),
            ("Amber eye", 0.96, 0.009, "eye"),
            ("Single pupil", 0.33, 0.019, "dark"),
        ]:
            vertices = [(x, y - depth - 0.014, z)]
            for i in range(40):
                a = math.tau * i / 40
                vertices.append(
                    (
                        x + math.cos(a) * size * scale,
                        y - depth,
                        z + math.sin(a) * size * scale * 0.9,
                    )
                )
            obj = mesh(
                name, vertices, [(0, 1 + i, 1 + (i + 1) % 40) for i in range(40)]
            )
            obj["paint"] = paint
            self.details.append(obj)
        for side in [-1, 1]:
            self.ridge(
                "Thick single eyelid",
                [
                    (x - size, y, z),
                    (x, y - 0.012, z + side * size * 0.96),
                    (x + size, y, z),
                ],
                [0.022, 0.030, 0.022],
                "skin",
            )

    def wyvern(self):
        self.reptile_body()
        self.throat_plates()
        for obj in [self.body, *self.details]:
            for vertex in obj.data.vertices:
                x, y, z = vertex.co
                if abs(x) > 0.24 and z > 0.30:
                    weight = min(1, (abs(x) - 0.24) / 0.20) * min(1, (z - 0.30) / 0.25)
                    vertex.co.x *= 1 - (0.14 if x > 0 else 0.035) * weight
                    vertex.co.z += (0.10 if x > 0 else -0.04) * weight
                elif abs(x) < 0.22 and z > 1.0:
                    self.turn_head(vertex, 0, -0.20, 0.35, min(1, (z - 1.0) / 0.18))
            obj.data.update()

    def hydra(self):
        self.reptile_body()
        self.throat_plates()
        for obj in [self.body, *self.details]:
            for vertex in obj.data.vertices:
                x, y, z = vertex.co
                if z > 1.0 and abs(x) > 0.18:
                    side = 1 if x > 0 else -1
                    self.turn_head(
                        vertex,
                        side * 0.35,
                        -0.22,
                        side * -0.35,
                        min(1, (z - 1.0) / 0.15),
                    )
                vertex.co.x *= 0.91
                vertex.co.y *= 0.91
            obj.data.update()

    def turn_head(self, vertex, cx, cy, angle, weight):
        x, y, z = vertex.co
        angle *= weight
        vertex.co.x = cx + (x - cx) * math.cos(angle) - (y - cy) * math.sin(angle)
        vertex.co.y = cy + (x - cx) * math.sin(angle) + (y - cy) * math.cos(angle)

    def throat_plates(self):
        for neck in self.necks:
            for index in range(1, 4):
                for step in range(3):
                    center = Vector(neck[index - 1]).lerp(
                        Vector(neck[index]), (step + 1) / 3
                    )
                    width = 0.070 - 0.009 * index
                    x, _, z = center
                    y = self.face_y(x, z) - 0.006
                    self.ridge(
                        "Overlapping throat scute",
                        [
                            (x - width, y + 0.018, z),
                            (x, y - 0.006, z - 0.012),
                            (x + width, y + 0.018, z),
                        ],
                        [0.010, 0.014, 0.010],
                        "horn",
                    )

    def mouth(self, points):
        self.ridge(
            "Uneven mouth cleft",
            [(x, self.face_y(x, z) - 0.008, z) for x, z in points],
            [0.008] * len(points),
            "dark",
        )

    def relief(self, kind):
        normals = [v.normal.copy() for v in self.body.data.vertices]
        for vertex, normal in zip(self.body.data.vertices, normals):
            x, y, z = vertex.co
            grain = noise_vector(vertex.co * 43).x * 0.001
            if kind == "warty":
                grain += max(0, noise_vector(vertex.co * 19).x - 0.30) * 0.018
            elif kind == "folds":
                grain += (
                    math.sin(z * 65 + x * 6) * 0.003 * max(0, 1 - abs(z - 0.65) / 0.5)
                )
            vertex.co += normal * grain
        self.body.data.update()

    def paint_anatomy(self, color, vertex):
        return color

    def finish(self):
        self.hide = bpy.data.images.load(str(SOURCE / "painted-hide.png"))
        self.hide.pack()
        for obj in [self.body, *self.details]:
            self.paint(obj)
        obj = join([self.body, *self.details], self.species + " creature sculpt")
        for vertex in obj.data.vertices:
            vertex.co.z = max(0.012, vertex.co.z)
        bpy.context.scene["species"] = self.species
        bpy.context.scene["deliveryScale"] = 0.8
        bpy.context.scene["concept"] = "creatures/concept.png"
        bpy.context.scene["sculptTriangles"] = sum(
            len(p.vertices) - 2 for p in obj.data.polygons
        )
        painting = DESTINATION / f"{self.species}-paint.png"
        if painting.exists():
            apply_paint(obj, painting)
        bpy.context.preferences.filepaths.save_version = 0
        bpy.ops.wm.save_as_mainfile(
            filepath=str(DESTINATION / f"{self.species}.blend"), compress=True
        )


if __name__ == "__main__":
    species = sys.argv[sys.argv.index("--") + 1]
    creature = Creature(species)
    getattr(creature, species)()
    creature.finish()
