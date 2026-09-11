"""The Kingdom's donjon, drawbridge and open fortified courtyard."""

import math
import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from courtyard_props import (
    build_weapon_rack,
    build_brazier,
    build_stores_canopy,
    build_worktable,
    build_barrel,
)
import realm_keep as keep
from settlement_geometry import block, beam, save_asset
from fortification_geometry import build_square_battlements, build_recessed_doorway
from town_architecture import (
    palette,
    ring,
    build_gold_finial,
    heraldic_hanging,
    roof,
    window,
    round_tower,
    curtain,
    gatehouse,
    trim_to_neighbor,
    banner,
    crystal,
    sky_bridge,
)

DONJON_UPPER_WINDOW_BASE = 1.16


def build_kingdom():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    m = palette()
    donjon = build_donjon(m)
    left = round_tower(m, "Kingdom west tower", -0.50, 0.29, 0.13, 1.04, 1.37)
    right = round_tower(m, "Kingdom east tower", 0.52, -0.015, 0.12, 0.87, 1.15)
    sky_bridge(m, "Kingdom upper passage", -0.31, 0.29, 0.26, 0.80, [donjon, left])
    build_recessed_doorway(
        m,
        "Keep passage",
        donjon,
        -0.24,
        0.29,
        0.80,
        0.93,
        0.045,
        0.011,
        facing=-math.pi / 2,
    )
    build_recessed_doorway(
        m,
        "Tower passage",
        left,
        -0.50 + 0.13 * math.cos(math.pi / 16),
        0.29,
        0.80,
        0.93,
        0.045,
        0.011,
        facing=math.pi / 2,
    )
    walls = curtain(m, keep.build_enclosure_path(), 0.52)
    for wall in walls:
        for tower in [left, right]:
            trim_to_neighbor(wall, tower)
    gatehouse(m, drawbridge=True)
    build_royal_details(m)
    build_weapon_rack(m, -0.43, -0.10)
    build_worktable(m, -0.36, -0.32)
    build_barrel(m, -0.53, -0.32)
    build_stores_canopy(m, 0.39, -0.32)
    build_brazier(m, -0.25, -0.08)
    banner(m, "Kingdom order banner", 0.60, -0.36, 1.34, height=0.30)
    crystal(m, "Kingdom gate gem", 0, -0.692, 0.405, 0.017, 0.053)
    save_asset(
        "kingdom",
        "donjon, great hall, round towers and drawbridge",
        "Runtime order heraldry and wind",
    )


def build_donjon(m):
    body = block(
        "Royal donjon masonry",
        (-0.02, 0.33, 0.68),
        (0.44, 0.42, 1.36),
        m["stone"],
        0.018,
    )
    build_recessed_doorway(
        m, "Royal donjon", body, -0.02, 0.12, 0.012, 0.265, 0.085, 0.024
    )
    for z in [0.48, 0.86, DONJON_UPPER_WINDOW_BASE]:
        for x in [-0.125, 0.085]:
            window(m, "Donjon window", body, x, 0.12, z, 0.054, 0.14)
    for z in [0.58, DONJON_UPPER_WINDOW_BASE]:
        window(m, "Donjon rear window", body, -0.02, 0.54, z, 0.07, 0.17, math.pi)
    for z in [0.43, 0.82, DONJON_UPPER_WINDOW_BASE - 0.045]:
        # The upper course sits below both window rows at the banner mounting line.
        for y in [0.113, 0.547]:
            block(
                "Donjon string course",
                (-0.02, y, z),
                (0.44, 0.014, 0.025),
                m["stone_light"],
                0.001,
            )
        for x in [-0.247, 0.207]:
            if x < 0 and z == 0.82:
                continue
            block(
                "Donjon side course",
                (x, 0.33, z),
                (0.014, 0.42, 0.025),
                m["stone_light"],
                0.001,
            )
    build_square_battlements(m, "Donjon", -0.02, 0.33, 0.48, 0.46, 1.36, 0.06)
    roof(m, "Donjon crown", -0.02, 0.33, 0.33, 0.31, 1.40, 1.85, "slate", hip=True)
    build_great_hall(m)
    heraldic_hanging(m, "Donjon order hanging", -0.02, 0.111, 1.11, 0.11, 0.25)
    return body


def build_great_hall(m):
    body = block(
        "Royal great hall masonry",
        (0.36, 0.35, 0.445),
        (0.25, 0.34, 0.89),
        m["stone"],
        0.005,
    )
    roof(m, "Royal great hall", 0.36, 0.35, 0.275, 0.37, 0.89, 1.16, "slate", hip=True)
    for z in [0.39, 0.73]:
        window(m, "Great hall arched window", body, 0.36, 0.18, z, 0.07, 0.13)
    build_recessed_doorway(m, "Great hall", body, 0.36, 0.18, 0.008, 0.21, 0.065, 0.014)


def build_royal_details(m):
    for x, y, width, depth, eave, ridge in [
        (-0.02, 0.33, 0.33, 0.31, 1.40, 1.85),
        (0.36, 0.35, 0.275, 0.37, 0.89, 1.16),
    ]:
        for side in [-1, 1]:
            tip = (x, y + side * depth * 0.18, ridge + 0.006)
            for edge in [-1, 1]:
                beam(
                    "Royal roof brass hip",
                    (x + edge * width / 2, y + side * depth / 2, eave + 0.005),
                    tip,
                    0.004,
                    m["gold"],
                    6,
                )
            build_gold_finial(m, "Royal roof", tip[0], tip[1], ridge + 0.01, 0.014)
        beam(
            "Royal roof brass ridge",
            (x, y - depth * 0.18, ridge + 0.006),
            (x, y + depth * 0.18, ridge + 0.006),
            0.005,
            m["gold"],
            6,
        )
    for x, y, radius, height in [(-0.50, 0.29, 0.13, 1.04), (0.52, -0.015, 0.12, 0.87)]:
        ring(
            m,
            "Royal tower brass course",
            x,
            y,
            radius + 0.004,
            radius - 0.008,
            height * 0.81,
            height * 0.81 + 0.015,
            "gold",
            16,
        )
    for side in [-1, 1]:
        heraldic_hanging(m, "Royal gate pennant", side * 0.25, -0.69, 0.46, 0.065, 0.21)


if __name__ == "__main__":
    build_kingdom()
