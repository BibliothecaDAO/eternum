"""Build a palisaded village of three broad yurts with relationship banners.

Run with Blender --background --python apps/game/scripts/settlements/build-village.py.
Then: node apps/game/scripts/compress-models.mjs --only settlements/village.glb
Geometry uses Z-up, entrance toward -Y. Exported mesh transforms are baked for
the terrain lab's instanced renderer. No biome or ground plate belongs here.
"""

import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from courtyard_props import build_supplies
from round_dwellings import round_dwelling
from timber_defenses import palisade
from town_architecture import banner
from settlement_geometry import (
    material,
    glowing_material,
    mesh,
    block,
    beam,
    save_asset,
)

YURT_RADIUS = 0.26
YURT_WALL_HEIGHT = 0.39
YURT_ROOF_PEAK = 0.56
PALISADE_HEIGHT = 0.52
GATE_POST_HEIGHT = 0.60


def build_village():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    materials = create_materials()
    build_yurt_cluster(materials)
    build_fence(materials)
    build_courtyard_hearth(materials)
    build_supplies(materials, 0.35, 0.29)
    build_banner(materials)
    save_asset(
        "village",
        "village: three broad felt yurts with shallow rounded roofs, palisade and central campfire",
        "Runtime wind banner and flickering campfire",
    )


def create_materials():
    return {
        "canvas": material("Yurt felt", (0.56, 0.47, 0.32)),
        "wood": material("Weathered oak", (0.24, 0.115, 0.042)),
        "roof": material("Warm hide roofing", (0.235, 0.112, 0.043)),
        "roof_light": material("Sun faded hide roofing", (0.285, 0.15, 0.068)),
        "roof_dark": material("Dark hide roofing", (0.18, 0.075, 0.028)),
        "awning": material("Settlement entrance cloth", (0.40, 0.030, 0.020)),
        "frame": material("Dark timber frame", (0.085, 0.044, 0.025)),
        "stone": material("Fire ring stone", (0.19, 0.18, 0.16)),
        "charcoal": material("Charred firewood", (0.035, 0.023, 0.015)),
        "ember": glowing_material("Glowing embers", (0.7, 0.055, 0.003), 2),
        "flame": glowing_material("Amber flame", (1.0, 0.20, 0.008), 2.5),
        "flame_core": glowing_material("Golden flame heart", (1.0, 0.62, 0.08), 3),
        "iron": material("Blackened iron", (0.075, 0.085, 0.085), 0.65),
        "banner": material("Red village banner", (0.40, 0.030, 0.020)),
    }


def build_yurt_cluster(m):
    """A rear apex and two evenly spaced shoulders separate all roofs from the south camera."""
    yurts = [
        (-0.12, 0.38, "roof_light"),
        (-0.41, -0.16, "roof_light"),
        (0.41, -0.16, "roof_light"),
    ]
    for x, y, roof in yurts:
        facing = math.atan2(-0.05 - y, -x)
        dwelling_materials = dict(m, roof=m[roof])
        round_dwelling(
            dwelling_materials,
            "Camp yurt",
            x,
            y,
            YURT_RADIUS,
            YURT_WALL_HEIGHT,
            YURT_ROOF_PEAK,
            "yurt",
            facing,
            True,
        )


def build_fence(m):
    """Angular defensive enclosure with a wide, unobstructed southern entrance."""
    corners = [
        (-0.25, -0.62),
        (-0.64, -0.44),
        (-0.70, 0.20),
        (-0.45, 0.65),
        (0.45, 0.65),
        (0.70, 0.20),
        (0.64, -0.44),
        (0.25, -0.62),
    ]
    corners = [(x * 1.065, y * 1.065) for x, y in corners]
    palisade(m, corners, PALISADE_HEIGHT, GATE_POST_HEIGHT, spacing=0.075)


def build_courtyard_hearth(m):
    before = set(bpy.context.scene.objects)
    build_campfire(m)
    # Leave walking space around the hearth as well as between the dwellings.
    placement = (
        Matrix.Translation((0, -0.28, 0))
        @ Matrix.Diagonal((0.82, 0.82, 1, 1))
        @ Matrix.Translation((0, 0.07, 0))
    )
    for obj in set(bpy.context.scene.objects) - before:
        obj.matrix_world = placement @ obj.matrix_world


def build_campfire(m):
    """A raised stone hearth occupies the yard without covering its native ground."""
    for i in range(10):
        angle = i * math.tau / 10
        stone = block(
            "Hearth stone",
            (0.145 * math.cos(angle), -0.07 + 0.145 * math.sin(angle), 0.025),
            (0.075, 0.05, 0.05),
            m["stone"],
            bevel=0.012,
        )
        stone.rotation_euler.z = angle + math.pi / 2
    for i in range(3):
        angle = i * math.pi / 3
        dx, dy = 0.12 * math.cos(angle), 0.12 * math.sin(angle)
        beam(
            "Charred stacked log",
            (-dx, -0.07 - dy, 0.035 + i * 0.013),
            (dx, -0.07 + dy, 0.035 + i * 0.013),
            0.023,
            m["charcoal"],
            7,
        )
    for i in range(7):
        angle = i * math.tau / 7
        block(
            "Hot ember",
            (0.065 * math.cos(angle), -0.07 + 0.065 * math.sin(angle), 0.052),
            (0.035, 0.026, 0.012),
            m["ember"],
            bevel=0.004,
        )
    for x, y, radius, height in [
        (0, -0.07, 0.075, 0.29),
        (-0.065, -0.055, 0.04, 0.21),
        (0.06, -0.09, 0.04, 0.23),
    ]:
        build_flame(m["flame"], x, y, radius, height)
    build_flame(m["flame_core"], 0, -0.105, 0.047, 0.17)


def build_flame(mat, x, y, radius, height):
    sides = 7
    vertices = [
        (
            x + radius * scale * math.cos(i * math.tau / sides) + bend,
            y + radius * scale * math.sin(i * math.tau / sides),
            0.055 + height * t,
        )
        for t, scale, bend in [(0, 0.65, 0), (0.3, 1, 0), (0.65, 0.5, 0.012)]
        for i in range(sides)
    ]
    vertices.append((x - 0.018, y, 0.055 + height))
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
    faces.extend(
        (2 * sides + i, 2 * sides + (i + 1) % sides, 3 * sides) for i in range(sides)
    )
    faces.append(tuple(reversed(range(sides))))
    flame = mesh("Campfire flame", vertices, faces, mat)
    flame["settlementMotion"] = "flame"


def build_banner(m):
    # A raised banner on the east edge clears the roof silhouettes from the game camera.
    banner_materials = dict(m, timber=m["wood"], gold=m["iron"], cloth=m["banner"])
    banner(banner_materials, "VillageBanner", 0.65, 0.13, 1.28, span=-0.22, height=0.32)
    cloth = bpy.data.objects["VillageBanner"]
    del cloth["orderCloth"]
    cloth["relationshipCloth"] = "banner"


if __name__ == "__main__":
    build_village()
