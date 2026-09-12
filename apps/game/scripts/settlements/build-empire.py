"""An imperial palace crowned by worked essence and raised bridges."""

import math
import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from construction_finish import finish_construction
from courtyard_props import (
    build_courtyard_bench,
    build_planter,
    build_monument_paving,
    build_worktable,
)
import realm_keep as keep
from settlement_geometry import block, beam, material, save_asset
from fortification_geometry import (
    build_horizontal_prism,
    build_recessed_doorway,
    build_door_surround,
)
from town_architecture import (
    palette,
    heraldic_hanging,
    window,
    round_tower,
    curtain,
    trim_to_neighbor,
    banner,
    crystal,
    ring,
    cone_roof,
    sky_bridge,
)


def build_empire():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    m = palette("empire")
    m["foliage"] = material("Imperial courtyard leaves", (0.16, 0.27, 0.075))
    palace = build_palace(m)
    towers = [
        round_tower(
            m,
            "Imperial " + side + " tower",
            sign * 0.47,
            0.235,
            0.145,
            1.32,
            1.70,
            "teal_roof",
            True,
        )
        for sign, side in [(-1, "west"), (1, "east")]
    ]
    for sign, tower in zip([-1, 1], towers):
        sky_bridge(
            m,
            "Imperial elevated bridge",
            sign * 0.30,
            0.235,
            0.23,
            1.0,
            [palace, tower],
        )
    walls = curtain(m, keep.build_enclosure_path(), 0.55)
    for sign in [-1, 1]:
        tower = round_tower(
            m,
            "Ceremonial gate tower",
            sign * 0.29,
            -0.55,
            0.068,
            0.68,
            0.88,
            "teal_roof",
            True,
        )
        for wall in walls:
            trim_to_neighbor(wall, tower)
    build_imperial_gate(m)
    build_imperial_ornament(m)
    build_gem_monument(m)
    build_monument_paving(m, 0, -0.30)
    for sign in [-1, 1]:
        build_courtyard_bench(m, sign * 0.46, -0.19)
        for y in [-0.38, 0.0]:
            build_planter(m, sign * 0.47, y)
    build_worktable(m, -0.30, -0.18)
    banner(m, "Imperial order banner", 0.565, -0.27, 1.58, span=-0.23, height=0.37)
    finish_construction(m, "empire")
    save_asset(
        "empire",
        "ivory palace, elevated bridges, open courtyard and teal crown",
        "Runtime order heraldry, wind and rotating refined essence",
    )


def build_palace(m):
    x, y = 0, 0.26
    radius = 0.31
    sides = 8
    outline = [
        (
            radius * math.cos(i * math.tau / sides + math.pi / sides),
            y + radius * math.sin(i * math.tau / sides + math.pi / sides),
        )
        for i in range(sides)
    ]
    body = build_horizontal_prism(
        "Imperial palace masonry", outline, 0, 1.62, m["stone"]
    )
    face_y = y - radius * math.cos(math.pi / 8)
    build_recessed_doorway(
        m, "Imperial palace", body, 0, face_y, 0.065, 0.35, 0.108, 0.027
    )
    for z in [0.56, 1.07]:
        window(m, "Palace tall front window", body, 0, face_y, z, 0.09, 0.36, gold=True)
        for sign in [-1, 1]:
            window(
                m,
                "Palace side window",
                body,
                sign * radius * math.cos(math.pi / 8),
                y,
                z,
                0.09,
                0.36,
                sign * math.pi / 2,
                True,
            )
    for i in range(8):
        angle = i * math.tau / 8 + math.pi / 8
        # Continuous corner pillars follow the palace's octagonal plan.
        beam(
            "Palace corner shaft",
            (radius * math.cos(angle), y + radius * math.sin(angle), 0.05),
            (radius * math.cos(angle), y + radius * math.sin(angle), 1.62),
            0.022,
            m["stone_light"],
            6,
        )
    for i in range(8):
        angle = i * math.tau / 8 + math.pi / 8
        px, py = radius * math.cos(angle), y + radius * math.sin(angle)
        beam(
            "Palace buttress foot",
            (px, py, 0),
            (px, py, 0.14),
            0.036,
            m["stone_light"],
            6,
        )
        beam(
            "Palace pillar capital",
            (px, py, 1.51),
            (px, py, 1.59),
            0.031,
            m["stone_light"],
            6,
        )
    ring(m, "Imperial crown ring", 0, y, 0.336, 0.289, 1.62, 1.68, "stone_light", 8)
    for i in range(8):
        angle = i * math.tau / 8
        merlon = block(
            "Imperial crown merlon",
            (0.314 * math.cos(angle), y + 0.314 * math.sin(angle), 1.711),
            (0.042, 0.042, 0.062),
            m["stone_light"],
            0.002,
        )
        merlon.rotation_euler.z = angle
    for z in [0.48, 1.01, 1.55]:
        ring(
            m, "Palace stone course", 0, y, 0.324, 0.31, z, z + 0.035, "stone_light", 8
        )
    cone_roof(
        m, "Imperial crown", 0, y, 0.283, 1.68, 2.20, "teal_roof", True, finial=False
    )
    crown = crystal(m, "Imperial refined essence crown", 0, y, 2.22, 0.055, 0.22)
    crown["settlementMotion"] = "spin"
    for sign in [-1, 1]:
        beam(
            "Crown gemstone prong",
            (sign * 0.060, y, 2.12),
            (sign * 0.043, y, 2.25),
            0.007,
            m["gold"],
            6,
        )
    for i in range(3):
        h = 0.06 - i * 0.018
        block(
            "Palace entrance step",
            (0, face_y - 0.045 - i * 0.035, h / 2),
            (0.25 + i * 0.025, 0.035, h),
            m["stone_light"],
            0.001,
        )
    return body


def build_imperial_ornament(m):
    for z in [0.515, 1.045, 1.585]:
        ring(m, "Palace gold inlay", 0, 0.26, 0.328, 0.312, z, z + 0.012, "gold", 8)
    for side in [-1, 1]:
        heraldic_hanging(
            m,
            "Imperial facade hanging",
            side * 0.215,
            0.041,
            1.47,
            0.105,
            0.43,
            side * math.pi / 4,
        )
        for z in [0.45, 1.09]:
            ring(
                m,
                "Imperial tower gold inlay",
                side * 0.47,
                0.235,
                0.153,
                0.14,
                z,
                z + 0.014,
                "gold",
                16,
            )
        beam(
            "Imperial entrance gold jamb",
            (side * 0.122, -0.044, 0.12),
            (side * 0.122, -0.044, 0.36),
            0.007,
            m["gold"],
            6,
        )


def build_imperial_gate(m):
    build_door_surround(m, "Imperial gateway", 0, -0.62, 0, 0.37, 0.175, 0.047, 0.15)
    for sign in [-1, 1]:
        build_imperial_gate_leaf(m, sign)
    block("Gateway keystone", (0, -0.71, 0.574), (0.065, 0.038, 0.09), m["gold"], 0.005)
    crystal(m, "Gateway essence crest", 0, -0.735, 0.565, 0.022, 0.075)


def build_imperial_gate_leaf(m, sign):
    radius, spring, bottom, y = 0.175, 0.37, 0.006, -0.67
    for x in [sign * radius, 0]:
        top = spring + math.sqrt(max(0, radius * radius - x * x))
        beam("Gate leaf stile", (x, y, bottom), (x, y, top), 0.005, m["gold"], 6)
    for z in [0.012, 0.18, spring]:
        beam("Gate leaf rail", (sign * radius, y, z), (0, y, z), 0.005, m["gold"], 6)
    for i in range(1, 5):
        x = sign * radius * i / 5
        top = spring + math.sqrt(radius * radius - x * x)
        beam("Full height gate spindle", (x, y, bottom), (x, y, top), 0.004, m["iron"], 6)
    for i in range(12):
        a, b = i * math.pi / 24, (i + 1) * math.pi / 24
        beam("Arched gate crown",
             (sign * radius * math.cos(a), y, spring + radius * math.sin(a)),
             (sign * radius * math.cos(b), y, spring + radius * math.sin(b)),
             0.005, m["gold"], 6)


def build_gem_monument(m):
    x, y = 0, -0.30
    beam("Monument lower plinth", (x, y, 0), (x, y, 0.045), 0.11, m["stone_dark"], 8)
    beam(
        "Monument stepped base",
        (x, y, 0.045),
        (x, y, 0.075),
        0.092,
        m["stone_light"],
        8,
    )
    beam("Monument pedestal", (x, y, 0.075), (x, y, 0.19), 0.063, m["stone"], 8)
    beam("Monument capital", (x, y, 0.19), (x, y, 0.215), 0.085, m["gold"], 8)
    gem = crystal(m, "Courtyard refined essence", x, y, 0.265, 0.065, 0.30)
    gem["settlementMotion"] = "spin"
    for i in range(3):
        a = i * math.tau / 3
        beam(
            "Monument bronze cradle",
            (0.065 * math.cos(a), y + 0.065 * math.sin(a), 0.205),
            (0.045 * math.cos(a), y + 0.045 * math.sin(a), 0.33),
            0.008,
            m["gold"],
            6,
        )


if __name__ == "__main__":
    build_empire()
