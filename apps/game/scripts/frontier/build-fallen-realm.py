"""Build one reusable fallen-realm ruin, leaving the courtyard clear for beasts."""

import math
import random
import sys
from pathlib import Path

import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from frontier_geometry import (
    arch_stone,
    block,
    clear_scene,
    create_stone,
    export_structure,
    material,
    mesh,
    ring_stone,
)
from settlement_geometry import beam


def build_fallen_realm():
    clear_scene()
    stone = create_stone()
    roof = material("Fallen realm charred roof", (0.050, 0.038, 0.043))
    timber = material("Fallen realm charred timber", (0.035, 0.026, 0.025))
    build_broken_enclosure(stone)
    build_gate(stone, timber)
    build_ruined_watchtower(stone, roof, timber)
    build_keep_remains(stone, timber)
    build_rubble(stone)
    weather_masonry(stone)
    build_mist_stain(stone)
    export_structure("fallen-realm-ruin")


def build_broken_enclosure(stone):
    course_counts = [2, 3, 2, 1, 2, 3, 3, 2, 2, 1, 2, 3, 2, 2, 1, 1, 2, 2]
    for index, courses in enumerate(course_counts):
        # The front three bays are the gateway, not a second wall behind it.
        if index in (12, 13, 14):
            continue
        angle = index * math.tau / 18
        for course in range(courses):
            ring_stone(
                "Broken curtain wall", (0, 0, course * 0.11),
                0.635, 0.725, angle + 0.012, angle + math.tau / 18 - 0.012,
                0.103, stone,
            )
        if courses == 3:
            ring_stone(
                "Surviving merlon", (0, 0, 0.33),
                0.625, 0.74, angle + 0.05, angle + 0.19, 0.095, stone,
            )


def build_gate(stone, timber):
    for side in (-1, 1):
        for course in range(3):
            block(
                "Gate pier", (side * 0.23, -0.60, 0.053 + course * 0.106),
                (0.12, 0.16, 0.10), stone, 0.009,
            )
    for index in range(7):
        angle = index * math.pi / 7
        arch_stone(
            "Fractured gate arch", (0, -0.60, 0.32),
            0.17, 0.29, angle + 0.012, angle + math.pi / 7 - 0.012, 0.16, stone,
        )
    for index in range(4):
        plank = block(
            "Splintered gate plank", (-0.15 + index * 0.055, -0.585, 0.115),
            (0.048, 0.035, 0.22 - index * 0.04), timber, 0.002,
        )
        plank.rotation_euler.y = -0.12 + index * 0.04


def build_ruined_watchtower(stone, roof, timber):
    x, y = -0.43, 0.40
    for course in range(6):
        for index in range(12):
            if course >= 3 and index in (7, 8):
                continue
            if course == 5 and index in (6, 9, 10):
                continue
            angle = (index + (course % 2) * 0.5) * math.tau / 12
            ring_stone(
                "Watchtower masonry", (x, y, course * 0.102),
                0.118, 0.168, angle + 0.01, angle + math.tau / 12 - 0.01,
                0.097, stone,
            )
    build_torn_roof(x, y, roof, timber)


def build_torn_roof(x, y, roof, timber):
    for index in range(10):
        if index in (4, 6, 7, 9):
            continue
        start, end = index * math.tau / 10, (index + 1) * math.tau / 10
        vertices = [
            (x + 0.19 * math.cos(start), y + 0.19 * math.sin(start), 0.61),
            (x + 0.19 * math.cos(end), y + 0.19 * math.sin(end), 0.61),
            (x + (0.035 if index == 5 else 0), y, 0.81 if index == 5 else 0.92),
        ]
        mesh("Clay roof remnant", vertices, [(0, 1, 2)], roof, thickness=0.012)
    for angle in (6 * math.tau / 10, 8 * math.tau / 10):
        beam(
            "Exposed roof rafter",
            (x + 0.185 * math.cos(angle), y + 0.185 * math.sin(angle), 0.60),
            (x, y, 0.91), 0.015, timber,
        )


def build_keep_remains(stone, timber):
    for row in range(4):
        for index in range(4 - row):
            block(
                "Collapsed keep course", (0.04 + index * 0.115, 0.55, 0.054 + row * 0.108),
                (0.108, 0.13, 0.10), stone, 0.01,
            )
    beam("Burned roof joist", (0.05, 0.54, 0.43), (0.39, 0.50, 0.20), 0.021, timber)


def build_rubble(stone):
    for index, (x, y, width, height) in enumerate([
        (0.47, 0.22, 0.11, 0.08),
        (-0.49, -0.25, 0.10, 0.07),
        (0.35, -0.48, 0.13, 0.08), (0.39, 0.42, 0.08, 0.09),
    ]):
        rubble = block("Fallen masonry", (x, y, height / 2), (width, width * 0.75, height), stone, 0.015)
        rubble.rotation_euler.z = index * 0.71


def weather_masonry(stone):
    bpy.context.view_layer.update()
    variation = random.Random(271)
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or obj.data.materials[0] != stone:
            continue
        shade = variation.uniform(0.24, 0.43)
        color = obj.data.color_attributes.new(name="Weathering", type="FLOAT_COLOR", domain="CORNER")
        for loop in obj.data.loops:
            point = obj.matrix_world @ obj.data.vertices[loop.vertex_index].co
            creep = 0.5 + 0.5 * math.sin(point.x * 31 + point.y * 19)
            wet = max(0, 1 - point.z / (0.17 + creep * 0.16))
            dry = (shade * 0.83, shade * 0.99, shade * 1.16)
            moss = (0.09, 0.16 + creep * 0.055, 0.115)
            color.data[loop.index].color = tuple(a * (1 - wet) + b * wet for a, b in zip(dry, moss)) + (1,)
        obj.data.color_attributes.active_color = color


def build_mist_stain(stone):
    # Replaces two rubble blocks within the existing triangle budget; no terrain slab.
    vertices = [(0, 0, 0.002)]
    for radius in (0.29, 0.45):
        for index in range(24):
            angle = index * math.tau / 24
            edge = radius * (1 + 0.055 * math.sin(index * 2.3))
            vertices.append((edge * math.cos(angle), edge * math.sin(angle), 0.001))
    faces = []
    for index in range(24):
        a, b = index + 1, (index + 1) % 24 + 1
        faces.extend([(0, a, b), (a, a + 24, b + 24, b)])
    stain = mesh("Mist-darkened courtyard", vertices, faces, stone)
    color = stain.data.color_attributes.new(name="Weathering", type="FLOAT_COLOR", domain="CORNER")
    for loop in stain.data.loops:
        index = loop.vertex_index
        tint = (0.065, 0.085, 0.155) if index == 0 else (0.11, 0.14, 0.22) if index <= 24 else (0.16, 0.21, 0.11)
        color.data[loop.index].color = (*tint, 1)
    stain.data.color_attributes.active_color = color


if __name__ == "__main__":
    build_fallen_realm()
