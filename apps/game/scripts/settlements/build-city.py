"""Build the City: the approved keep within its open fortified courtyard."""

import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from construction_finish import finish_construction
from courtyard_props import build_brazier, build_supplies, build_barrel, build_sack
import realm_keep as keep
from settlement_geometry import block, beam, save_asset
from town_architecture import palette, roof, banner, window, well
from fortification_geometry import build_recessed_doorway


def build_city():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    m = palette("city")
    build_city_keep(m)
    keep.build_enclosure(m)
    keep.build_gate(m)
    build_courtyard_homes(m)
    well(m, -0.27, -0.005)
    build_brazier(m, -0.19, -0.47)
    build_supplies(m, 0.21, -0.08)
    build_barrel(m, 0.53, -0.075)
    build_sack(m, 0.42, -0.07)
    banner(m, "City order banner", 0.575, -0.39, 1.30, span=-0.23, height=0.36)
    finish_construction(m, "city")
    save_asset(
        "city",
        "attached round tower, terracotta keep, two courtyard homes and closed oak gate",
        "Runtime order heraldry and wind",
    )


def build_city_keep(m):
    keep.build_keep(m)
    keep.build_watchtower(m)
    build_keep_windows(m)
    roof(
        m,
        "City upper keep",
        keep.KEEP_X,
        keep.KEEP_Y,
        0.27,
        0.23,
        0.892,
        1.17,
        hip=True,
    )
    transform = Matrix.Translation((0, 0.08, 0)) @ Matrix.Diagonal((0.9, 0.9, 1.20, 1))
    for obj in bpy.context.scene.objects:
        obj.matrix_world = transform @ obj.matrix_world


def build_keep_windows(m):
    main = bpy.data.objects["Squat square keep"]
    upper = bpy.data.objects["Upper square turret"]
    for y in [keep.KEEP_Y - 0.12, keep.KEEP_Y + 0.12]:
        window(
            m,
            "Keep east window",
            main,
            keep.KEEP_X + keep.KEEP_WIDTH / 2,
            y,
            0.24,
            0.065,
            0.18,
            math.pi / 2,
        )
    window(
        m,
        "Upper keep east window",
        upper,
        keep.KEEP_X + 0.17,
        keep.KEEP_Y,
        0.64,
        0.085,
        0.18,
        math.pi / 2,
    )
    window(
        m,
        "Upper keep rear window",
        upper,
        keep.KEEP_X,
        keep.KEEP_Y + 0.15,
        0.64,
        0.085,
        0.18,
        math.pi,
    )
    for sign in [-1, 1]:
        # Raised corner stones break up the broad lower facade without covering its cloth.
        for row in range(4):
            block(
                "Keep dressed corner",
                (
                    keep.KEEP_X + sign * 0.297,
                    keep.KEEP_FRONT - 0.006,
                    0.16 + row * 0.10,
                ),
                (0.046 if row % 2 else 0.062, 0.018, 0.045),
                m["stone_light"],
                0.001,
            )


def build_courtyard_homes(m):
    # Two subordinate rooflines flank a continuous gate-to-keep lane.
    build_courtyard_home(
        m, "West courtyard home", -0.43, -0.31, 0.54, 0.77, math.pi / 2
    )
    build_courtyard_home(
        m, "East courtyard home", 0.43, -0.28, 0.59, 0.83, -math.pi / 2
    )


def build_courtyard_home(m, name, x, y, eave, ridge, facing):
    width, depth = 0.25, 0.28
    block(
        name + " foundation",
        (x, y, 0.025),
        (width, depth, 0.05),
        m["stone_dark"],
        0.002,
    )
    body = block(
        name + " plaster",
        (x, y, (eave + 0.05) / 2),
        (width, depth, eave - 0.05),
        m["plaster"],
        0.002,
    )
    roof(m, name, x, y, width + 0.045, depth + 0.045, eave, ridge)
    sign = 1 if facing > 0 else -1
    build_recessed_doorway(
        dict(m, stone_light=m["timber"]),
        name,
        body,
        x + sign * width / 2,
        y,
        0.01,
        0.23,
        0.045,
        0.014,
        facing=facing,
    )
    window(m, name + " upper window", body, x, y - depth / 2, eave - 0.17, 0.07, 0.115)
    for sx in [-1, 1]:
        for sy in [-1, 1]:
            block(
                name + " corner timber",
                (x + sx * (width / 2 - 0.008), y + sy * depth / 2, eave / 2),
                (0.017, 0.018, eave),
                m["timber"],
                0.001,
            )
    for z in [0.065, eave - 0.018]:
        block(
            name + " front tie beam",
            (x, y - depth / 2 - 0.004, z),
            (width, 0.02, 0.022),
            m["timber"],
            0.001,
        )
    for sign in [-1, 1]:
        beam(
            name + " gable verge",
            (x + sign * (width / 2 + 0.02), y - depth / 2 - 0.025, eave),
            (x, y - depth / 2 - 0.025, ridge),
            0.008,
            m["timber"],
            4,
        )


if __name__ == "__main__":
    build_city()
