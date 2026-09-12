"""A broad civilian timber hall inside a defensive palisade, with an open yard."""

import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from construction_finish import finish_construction
from courtyard_props import build_supplies, build_barrel
from settlement_geometry import block, beam, save_asset
from fortification_geometry import build_recessed_doorway, build_vertical_prism
from town_architecture import palette, fence, roof, window, banner


def build_realm():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    m = palette("settlement")
    build_hall(m)
    banner(m, "Settlement order banner", 0.51, -0.22, 1.13, span=-0.22, height=0.34)
    build_barrel(m, -0.42, -0.23)
    build_barrel(m, -0.42, -0.35)
    build_barrel(m, 0.42, -0.22)
    build_supplies(m, 0.39, -0.35)
    fence(m)
    finish_construction(m, "settlement")
    save_asset(
        "settlement",
        "Timber hall: broad gable, heavy framing, defensive palisade and open yard",
        "Runtime order heraldry",
    )


def build_hall(m):
    x, y, front = 0, 0.20, -0.055
    width, depth, eave, ridge = 0.78, 0.51, 0.61, 1.06
    block(
        "Hall foundation",
        (x, y, 0.035),
        (width + 0.02, depth + 0.02, 0.07),
        m["stone_dark"],
        0.003,
    )
    body = block(
        "Hall masonry", (x, y, 0.34), (width, depth, 0.54), m["plaster"], 0.003
    )
    roof(m, "Hall thatch", x, y, width + 0.08, depth + 0.06, eave, ridge, "thatch")
    build_vertical_prism(
        "Hall plaster gable",
        [(-0.39, eave), (0.39, eave), (0, ridge - 0.015)],
        front - 0.034,
        0.008,
        m["plaster_light"],
    )
    build_hall_framing(m, front, eave, ridge)
    build_side_framing(m, width, depth, y, eave)
    build_recessed_doorway(
        dict(m, stone_light=m["timber"]),
        "Hall entrance",
        body,
        0,
        front,
        0.008,
        0.27,
        0.095,
        0.020,
    )
    for sign in [-1, 1]:
        window(m, "Hall shutter window", body, sign * 0.255, front, 0.31, 0.09, 0.16)
        window(
            m,
            "Hall side window",
            body,
            sign * width / 2,
            y,
            0.27,
            0.10,
            0.17,
            sign * 1.5707963267948966,
        )
        cloth = block(
            "Hall order hanging",
            (sign * 0.15, front - 0.014, 0.49),
            (0.065, 0.004, 0.16),
            m["cloth"],
            0,
        )
        cloth["orderCloth"] = "trim"
    block(
        "Hall doorstep",
        (0, front - 0.058, 0.012),
        (0.25, 0.09, 0.024),
        m["stone_light"],
        0.002,
    )


def build_hall_framing(m, front, eave, ridge):
    for sign in [-1, 1]:
        block(
            "Hall corner post",
            (sign * 0.374, front - 0.012, 0.335),
            (0.03, 0.026, 0.55),
            m["timber"],
            0.001,
        )
        beam(
            "Hall gable verge",
            (sign * 0.415, front - 0.044, eave),
            (0, front - 0.044, ridge),
            0.014,
            m["timber"],
            4,
        )
        beam(
            "Hall gable brace",
            (sign * 0.35, front - 0.044, eave + 0.02),
            (0, front - 0.044, 0.89),
            0.012,
            m["timber"],
            4,
        )
        beam(
            "Hall knee brace",
            (sign * 0.36, front - 0.025, 0.42),
            (sign * 0.20, front - 0.025, 0.59),
            0.011,
            m["timber"],
            4,
        )
    for z, width in [(0.095, 0.78), (0.60, 0.81), (0.79, 0.53)]:
        block(
            "Hall tie beam",
            (0, front - 0.044, z),
            (width, 0.026, 0.026),
            m["timber"],
            0.001,
        )
    block(
        "Hall king post",
        (0, front - 0.044, (eave + ridge) / 2),
        (0.022, 0.025, ridge - eave),
        m["timber"],
        0,
    )


def build_side_framing(m, width, depth, y, eave):
    for sign in [-1, 1]:
        x = sign * width / 2
        for offset in [-depth / 2, depth / 2]:
            block(
                "Hall side upright",
                (x, y + offset, 0.34),
                (0.028, 0.028, 0.54),
                m["timber"],
                0.001,
            )
        for z in [0.095, eave - 0.015]:
            block(
                "Hall side sill", (x, y, z), (0.028, depth, 0.028), m["timber"], 0.001
            )
        for direction in [-1, 1]:
            beam(
                "Hall side knee brace",
                (x, y + direction * 0.24, 0.41),
                (x, y + direction * 0.10, 0.59),
                0.009,
                m["timber"],
                4,
            )
    block(
        "Hall rear tie beam",
        (0, y + depth / 2, eave - 0.015),
        (width, 0.028, 0.028),
        m["timber"],
        0.001,
    )


if __name__ == "__main__":
    build_realm()
