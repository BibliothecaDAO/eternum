"""Supplies and defenses for the open courtyards in the realm progression."""

import math
import bpy
from settlement_geometry import beam, block, mesh, glowing_material


def build_supplies(m, x, y):
    for dx, dy, size in [(0, 0, 0.09), (0.02, -0.095, 0.07)]:
        block("Supply crate", (x + dx, y + dy, size / 2), (size, size, size), m["wood"])
        for offset in [-size * 0.3, size * 0.3]:
            block(
                "Crate strap",
                (x + dx + offset, y + dy, size),
                (0.008, size, 0.005),
                m["iron"],
                0,
            )


def build_courtyard_bench(m, x, y):
    block(
        "Courtyard bench seat",
        (x, y, 0.083),
        (0.075, 0.21, 0.022),
        m["stone_light"],
        0.004,
    )
    for side in [-1, 1]:
        block(
            "Courtyard bench foot",
            (x, y + side * 0.073, 0.036),
            (0.055, 0.03, 0.072),
            m["stone"],
            0.003,
        )


def build_brazier(m, x, y):
    for side in [-1, 1]:
        beam(
            "Brazier splayed leg",
            (x + side * 0.052, y, 0),
            (x + side * 0.028, y, 0.105),
            0.008,
            m["iron"],
            6,
        )
    beam(
        "Brazier rear leg",
        (x, y + 0.052, 0),
        (x, y + 0.026, 0.105),
        0.008,
        m["iron"],
        6,
    )
    build_brazier_bowl(m["iron"], x, y)
    build_brazier_flame(
        glowing_material("Brazier ember", (0.8, 0.18, 0.025), 1.2), x, y, 0.112
    )


def build_weapon_rack(m, x, y):
    for side in [-1, 1]:
        beam(
            "Rack upright",
            (x + side * 0.08, y, 0),
            (x + side * 0.08, y, 0.22),
            0.009,
            m["timber"],
            6,
        )
        beam(
            "Rack foot",
            (x + side * 0.08, y - 0.045, 0.01),
            (x + side * 0.08, y + 0.045, 0.01),
            0.01,
            m["timber"],
            6,
        )
    beam(
        "Rack crossbar", (x - 0.09, y, 0.19), (x + 0.09, y, 0.19), 0.009, m["timber"], 6
    )
    for dx in [-0.047, 0, 0.047]:
        beam(
            "Racked spear shaft",
            (x + dx, y - 0.035, 0.008),
            (x + dx, y - 0.008, 0.27),
            0.004,
            m["wood"],
            6,
        )
        tip = [
            (x + dx - 0.012, y - 0.008, 0.268),
            (x + dx, y - 0.012, 0.268),
            (x + dx + 0.012, y - 0.008, 0.268),
            (x + dx, y - 0.004, 0.268),
            (x + dx, y - 0.008, 0.314),
        ]
        mesh(
            "Racked spearhead",
            tip,
            [(3, 2, 1, 0), (0, 1, 4), (1, 2, 4), (2, 3, 4), (3, 0, 4)],
            m["iron"],
        )


def build_brazier_bowl(mat, x, y):
    sides = 10
    rings = [(0.10, 0.028), (0.137, 0.06), (0.137, 0.052), (0.111, 0.026)]
    vertices = [
        (
            x + r * math.cos(i * math.tau / sides),
            y + r * math.sin(i * math.tau / sides),
            z,
        )
        for z, r in rings
        for i in range(sides)
    ]
    faces = [
        (
            row * sides + i,
            row * sides + (i + 1) % sides,
            (row + 1) * sides + (i + 1) % sides,
            (row + 1) * sides + i,
        )
        for row in range(3)
        for i in range(sides)
    ]
    faces += [tuple(reversed(range(sides))), tuple(range(3 * sides, 4 * sides))]
    mesh("Brazier iron bowl", vertices, faces, mat)


def build_brazier_flame(mat, x, y, base):
    sides = 7
    vertices = [
        (
            x + radius * math.cos(i * math.tau / sides) + bend,
            y + radius * math.sin(i * math.tau / sides),
            base + height,
        )
        for height, radius, bend in [
            (0, 0.024, 0),
            (0.04, 0.036, 0),
            (0.095, 0.017, 0.008),
        ]
        for i in range(sides)
    ]
    vertices.append((x - 0.008, y, base + 0.145))
    faces = [
        (
            row * sides + i,
            row * sides + (i + 1) % sides,
            (row + 1) * sides + (i + 1) % sides,
            (row + 1) * sides + i,
        )
        for row in range(2)
        for i in range(sides)
    ]
    faces += [
        (2 * sides + i, 2 * sides + (i + 1) % sides, 3 * sides) for i in range(sides)
    ]
    faces.append(tuple(reversed(range(sides))))
    flame = mesh("Brazier flame", vertices, faces, mat)
    flame["settlementMotion"] = "flame"


def build_barrel(m, x, y):
    build_turned_prop(
        "Stores barrel",
        m["wood"],
        x,
        y,
        [(0, 0.041), (0.025, 0.048), (0.095, 0.048), (0.125, 0.041)],
    )
    for z in [0.026, 0.091]:
        build_turned_prop(
            "Barrel hoop", m["iron"], x, y, [(z, 0.05), (z + 0.009, 0.05)]
        )
    for dx in [-0.022, 0, 0.022]:
        block(
            "Barrel lid plank", (x + dx, y, 0.127), (0.019, 0.061, 0.005), m["wood"], 0
        )


def build_sack(m, x, y):
    build_turned_prop(
        "Tied grain sack",
        m["canvas"],
        x,
        y,
        [(0, 0.026), (0.018, 0.038), (0.060, 0.035), (0.081, 0.013), (0.095, 0.018)],
    )
    build_turned_prop("Sack tie", m["timber"], x, y, [(0.078, 0.015), (0.086, 0.015)])


def build_stores_canopy(m, x, y):
    """A legible storage bay: cloth overhead, barrels and sacks beneath it."""
    for dx in [-0.13, 0.13]:
        for dy in [-0.10, 0.10]:
            beam(
                "Stores canopy post",
                (x + dx, y + dy, 0),
                (x + dx, y + dy, 0.32),
                0.009,
                m["timber"],
                6,
            )
    mesh(
        "Stores cloth canopy",
        [
            (x + dx, y + dy, z)
            for dx, dy, z in [
                (-0.15, -0.12, 0.30),
                (0.15, -0.12, 0.30),
                (-0.15, 0, 0.345),
                (0.15, 0, 0.345),
                (-0.15, 0.12, 0.32),
                (0.15, 0.12, 0.32),
            ]
        ],
        [(0, 1, 3, 2), (2, 3, 5, 4)],
        m["canvas"],
        thickness=0.003,
    )
    valance = mesh(
        "Stores order valance",
        [
            (x - 0.15, y - 0.12, 0.30),
            (x + 0.15, y - 0.12, 0.30),
            (x + 0.15, y - 0.12, 0.25),
            (x, y - 0.12, 0.235),
            (x - 0.15, y - 0.12, 0.25),
        ],
        [(0, 1, 2, 3, 4)],
        m["cloth"],
        thickness=0.002,
    )
    valance["orderCloth"] = "trim"
    valance["settlementMotion"] = "banner"
    build_barrel(m, x - 0.073, y + 0.035)
    build_barrel(m, x + 0.065, y + 0.025)
    build_sack(m, x - 0.03, y - 0.075)
    build_sack(m, x + 0.075, y - 0.065)


def build_worktable(m, x, y):
    for dx in [-0.087, 0.087]:
        for dy in [-0.04, 0.04]:
            block(
                "Worktable leg",
                (x + dx, y + dy, 0.065),
                (0.016, 0.016, 0.13),
                m["timber"],
                0,
            )
    for dy in [-0.043, 0, 0.043]:
        block(
            "Worktable plank", (x, y + dy, 0.14), (0.23, 0.04, 0.02), m["wood"], 0.001
        )
    block(
        "Courtyard parchment",
        (x - 0.035, y, 0.152),
        (0.095, 0.066, 0.003),
        m["canvas"],
        0,
    )
    build_turned_prop(
        "Table cup", m["copper"], x + 0.072, y + 0.024, [(0.15, 0.012), (0.178, 0.014)]
    )
    beam(
        "Table stool",
        (x + 0.02, y - 0.115, 0.015),
        (x + 0.02, y - 0.115, 0.068),
        0.014,
        m["timber"],
        6,
    )
    beam(
        "Table stool seat",
        (x + 0.02, y - 0.115, 0.068),
        (x + 0.02, y - 0.115, 0.083),
        0.039,
        m["wood"],
        8,
    )


def build_planter(m, x, y):

    build_turned_prop(
        "Court garden urn",
        m["stone_light"],
        x,
        y,
        [(0, 0.04), (0.02, 0.035), (0.08, 0.068), (0.11, 0.066)],
    )
    beam("Planter soil", (x, y, 0.109), (x, y, 0.113), 0.06, m["shadow"], 12)
    for dx, dy, z, radius in [(-0.018, 0, 0.20, 0.065), (0.035, 0.008, 0.17, 0.052)]:
        beam(
            "Garden shrub stem", (x, y, 0.10), (x + dx, y + dy, z), 0.005, m["wood"], 5
        )
        bpy.ops.mesh.primitive_ico_sphere_add(
            subdivisions=1, radius=radius, location=(x + dx, y + dy, z)
        )
        plant = bpy.context.object
        plant.name = "Courtyard garden foliage"
        plant["settlementMotion"] = "foliage"
        plant.scale.z = 0.8
        plant.data.materials.append(m["foliage"])


def build_monument_paving(m, x, y):
    """Individual dressed stones surround the monument without covering the biome."""
    for i in range(10):
        angle = i * math.tau / 10
        stone = block(
            "Monument paving stone",
            (x + 0.183 * math.cos(angle), y + 0.183 * math.sin(angle), 0.009),
            (0.064, 0.086, 0.018),
            m["stone_light"],
            0.004,
        )
        stone.rotation_euler.z = angle


def build_turned_prop(name, mat, x, y, profile):
    sides = 12
    vertices = [
        (
            x + radius * math.cos(i * math.tau / sides),
            y + radius * math.sin(i * math.tau / sides),
            z,
        )
        for z, radius in profile
        for i in range(sides)
    ]
    faces = [tuple(reversed(range(sides)))]
    faces += [
        (
            row * sides + i,
            row * sides + (i + 1) % sides,
            (row + 1) * sides + (i + 1) % sides,
            (row + 1) * sides + i,
        )
        for row in range(len(profile) - 1)
        for i in range(sides)
    ]
    faces.append(tuple(range((len(profile) - 1) * sides, len(profile) * sides)))
    return mesh(name, vertices, faces, mat)
