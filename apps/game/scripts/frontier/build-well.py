"""Build a roofless Frontier well with an open basin and working winch fittings."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frontier_geometry import (
    block,
    clear_scene,
    create_stone,
    export_structure,
    material,
    mesh,
    ring_stone,
)
from settlement_geometry import beam


def build_well():
    clear_scene()
    stone = create_stone()
    timber = material("Well aged oak", (0.20, 0.095, 0.035))
    rope = material("Well hemp rope", (0.48, 0.32, 0.15))
    iron = material("Well forged iron", (0.055, 0.06, 0.065), 0.52)
    water = material("Well clear blue water", (0.035, 0.24, 0.34), 0.23)
    build_masonry_basin(stone)
    build_water_surface(water)
    build_winch(stone, timber, rope, iron)
    build_bucket(timber, rope, iron)
    export_structure("well")


def build_masonry_basin(stone):
    for course in range(3):
        for index in range(12):
            angle = (index + (course % 2) * 0.5) * math.tau / 12
            ring_stone(
                "Well wall course", (0, 0, course * 0.14),
                0.29, 0.41, angle + 0.012, angle + math.tau / 12 - 0.012,
                0.134, stone,
            )
    for index in range(12):
        angle = index * math.tau / 12
        ring_stone(
            "Well coping", (0, 0, 0.42),
            0.275, 0.445, angle + 0.009, angle + math.tau / 12 - 0.009,
            0.095, stone,
        )


def build_water_surface(water):
    vertices = [(0, 0, 0.29)]
    vertices.extend(
        (0.29 * math.cos(index * math.tau / 48), 0.29 * math.sin(index * math.tau / 48), 0.29)
        for index in range(48)
    )
    mesh("Still well water", vertices, [(0, index + 1, (index + 1) % 48 + 1) for index in range(48)], water)


def build_winch(stone, timber, rope, iron):
    for side in (-1, 1):
        x = side * 0.465
        block("Winch stone footing", (x, 0.055, 0.07), (0.18, 0.21, 0.14), stone, 0.008)
        block("Winch upright", (x, 0.055, 0.53), (0.09, 0.115, 0.94), timber, 0.008)
        block("Iron post collar", (x, 0.055, 0.16), (0.10, 0.125, 0.048), iron)
        beam("Axle bearing", (x - 0.06, 0.055, 0.83), (x + 0.06, 0.055, 0.83), 0.064, iron)
    block("Winch top rail", (0, 0.055, 0.935), (1.04, 0.09, 0.085), timber, 0.005)
    beam("Oak spindle", (-0.55, 0.055, 0.83), (0.55, 0.055, 0.83), 0.038, timber, sides=16)
    for index in range(8):
        x = -0.095 + index * 0.027
        for segment in range(16):
            angle = segment * math.tau / 16
            next_angle = (segment + 1) * math.tau / 16
            start = (x, 0.055 + 0.046 * math.cos(angle), 0.83 + 0.046 * math.sin(angle))
            end = (x, 0.055 + 0.046 * math.cos(next_angle), 0.83 + 0.046 * math.sin(next_angle))
            beam("Wound hemp rope", start, end, 0.010, rope, sides=6)
    beam("Winch crank", (0.56, 0.055, 0.83), (0.56, -0.03, 0.69), 0.021, iron)
    beam("Crank handle", (0.555, -0.03, 0.69), (0.65, -0.03, 0.69), 0.026, timber)


def build_bucket(timber, rope, iron):
    beam("Hanging bucket rope", (0, 0.009, 0.83), (0, 0.009, 0.63), 0.012, rope)
    for index in range(10):
        angle = index * math.tau / 10
        ring_stone(
            "Bucket stave", (0, 0.009, 0.37),
            0.061, 0.081, angle + 0.02, angle + math.tau / 10 - 0.02,
            0.16, timber,
        )
    beam("Bucket floor", (0, 0.009, 0.37), (0, 0.009, 0.385), 0.066, timber, sides=10)
    for z in (0.395, 0.505):
        for index in range(12):
            angle = index * math.tau / 12
            next_angle = (index + 1) * math.tau / 12
            start = (0.083 * math.cos(angle), 0.009 + 0.083 * math.sin(angle), z)
            end = (0.083 * math.cos(next_angle), 0.009 + 0.083 * math.sin(next_angle), z)
            beam("Bucket hoop", start, end, 0.009, iron, sides=6)
    for side in (-1, 1):
        beam("Bucket handle", (side * 0.078, 0.009, 0.51), (side * 0.060, 0.009, 0.62), 0.009, iron)
        beam("Bucket handle crown", (side * 0.060, 0.009, 0.62), (0, 0.009, 0.635), 0.009, iron)


if __name__ == "__main__":
    build_well()
