"""Build the single-use Frontier shrine from stone courses and a sun relief."""

import math
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frontier_geometry import arch_stone, block, clear_scene, create_stone, export_structure, material, mesh
from settlement_geometry import beam


def build_shrine():
    clear_scene()
    stone = create_stone()
    gold = material("Shrine aged gold", (0.75, 0.46, 0.12), 0.42)
    gold.node_tree.nodes.get("Principled BSDF").inputs["Metallic"].default_value = 0.25
    build_steps(stone)
    build_devotional_arch(stone)
    build_sun_relief(gold)
    build_altar(stone, gold)
    export_structure("shrine")


def build_steps(stone):
    block("Lower worn step", (0, -0.16, 0.035), (0.84, 0.63, 0.07), stone, 0.012)
    block("Upper worn step", (0, -0.07, 0.105), (0.69, 0.45, 0.07), stone, 0.009)


def build_devotional_arch(stone):
    for side in (-1, 1):
        for course in range(4):
            width = 0.17 + (course % 2) * 0.012
            block(
                "Arch pier course",
                (side * 0.365, 0.10, 0.21 + course * 0.14),
                (width, 0.23, 0.133),
                stone,
                0.008,
            )
        block("Pier footing", (side * 0.365, 0.10, 0.165), (0.23, 0.29, 0.05), stone)
    for index in range(9):
        start = index * math.pi / 9 + 0.009
        end = (index + 1) * math.pi / 9 - 0.009
        arch_stone("Arch voussoir", (0, 0.10, 0.70), 0.28, 0.455, start, end, 0.24, stone)
    block("Raised keystone", (0, 0.10, 1.115), (0.12, 0.26, 0.14), stone, 0.008)


def build_sun_relief(gold):
    beam("Sun suspension", (0, 0.085, 0.84), (0, 0.085, 1.01), 0.012, gold)
    beam("Sun disc", (0, 0.055, 0.72), (0, 0.095, 0.72), 0.112, gold, sides=24)
    beam("Raised sun center", (0, 0.039, 0.72), (0, 0.05, 0.72), 0.085, gold, sides=24)
    for index in range(12):
        angle = index * math.tau / 12
        tip = 0.215 if index % 2 == 0 else 0.178
        outline = [(0.108, angle - 0.14), (tip, angle), (0.108, angle + 0.14)]
        vertices = [
            (radius * math.sin(theta), y, 0.72 + radius * math.cos(theta))
            for y in (0.066, 0.09)
            for radius, theta in outline
        ]
        mesh("Sun ray", vertices, [(2, 1, 0), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)], gold)


def build_altar(stone, gold):
    block("Altar foot", (0, -0.055, 0.18), (0.34, 0.27, 0.075), stone, 0.008)
    block("Altar plinth", (0, -0.035, 0.275), (0.27, 0.22, 0.16), stone, 0.008)
    slab = block("Inclined altar tablet", (0, -0.075, 0.38), (0.37, 0.28, 0.055), stone, 0.007)
    slab.rotation_euler.x = math.radians(22)
    plaque = block("Tablet gold inlay", (0, 0, 0), (0.29, 0.20, 0.009), gold, 0.005)
    plaque.parent = slab
    plaque.location = (0, 0, 0.033)
    for x in (-0.075, 0, 0.075):
        for offset, length in ((-0.025, 0.072), (0.037, 0.032)):
            rune = block("Raised dedication", (0, 0, 0), (0.012, length, 0.008), stone, 0.001)
            rune.parent = slab
            rune.location = (x, offset, 0.041)


if __name__ == "__main__":
    build_shrine()
