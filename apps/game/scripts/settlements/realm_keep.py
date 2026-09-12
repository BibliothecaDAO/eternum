"""Reusable City keep: a stone keep, an adjoining watchtower, and a gated courtyard.

blender --background --python apps/game/scripts/settlements/build-city.py
node apps/game/scripts/compress-models.mjs --only settlements/city.glb
"""

import math
import sys
from pathlib import Path
import bpy

sys.path.insert(0, str(Path(__file__).resolve().parent))
from settlement_geometry import mesh, block, beam
from fortification_geometry import (
    build_square_battlements,
    build_recessed_doorway,
    cut_masonry_opening,
    straight_wall_section,
    round_wall_section,
    wall_path_outline,
    build_horizontal_prism,
    build_vertical_prism,
    build_stone_arch,
)

KEEP_X, KEEP_Y = 0.14, 0.23
KEEP_WIDTH, KEEP_DEPTH = 0.64, 0.50
KEEP_FRONT = KEEP_Y - KEEP_DEPTH / 2
TOWER_X, TOWER_Y = -0.33, KEEP_Y + 0.08
TERRACE_LEVEL = 0.578
TOWER_ACCESS_WIDTH = 0.22
GATE_Y, GATE_SPRING, GATE_RADIUS = -0.62, 0.35, 0.18


def build_keep(m):
    build_keep_masonry(m)
    build_keep_terraces(m)
    build_rooftop_turret(m)
    build_keep_entrance(m)
    build_keep_banners(m)


def build_keep_masonry(m):
    block(
        "Keep foundation",
        (KEEP_X, KEEP_Y, 0.055),
        (KEEP_WIDTH + 0.045, KEEP_DEPTH + 0.04, 0.11),
        m["stone_dark"],
    )
    block(
        "Squat square keep",
        (KEEP_X, KEEP_Y, 0.33),
        (KEEP_WIDTH, KEEP_DEPTH, 0.44),
        m["stone"],
    )


def build_keep_terraces(m):
    block(
        "Keep flat terrace",
        (KEEP_X, KEEP_Y, 0.564),
        (0.55, 0.41, 0.028),
        m["stone_dark"],
    )
    build_square_battlements(m, "Keep", KEEP_X, KEEP_Y, 0.70, 0.56, 0.55, 0.075)


def build_rooftop_turret(m):
    block(
        "Upper square turret", (KEEP_X, KEEP_Y, 0.724), (0.34, 0.30, 0.292), m["stone"]
    )
    block(
        "Turret flat roof",
        (KEEP_X, KEEP_Y, 0.881),
        (0.28, 0.24, 0.022),
        m["stone_dark"],
    )
    build_square_battlements(m, "Turret", KEEP_X, KEEP_Y, 0.40, 0.36, 0.87, 0.06)
    build_recessed_doorway(
        m,
        "Terrace",
        bpy.data.objects["Upper square turret"],
        KEEP_X,
        KEEP_Y - 0.15,
        0.578,
        0.728,
        0.048,
        0.021,
    )


def build_keep_entrance(m):
    # Cut the entry through both the wall and its raised foundation.
    outline = [(KEEP_X - 0.085, 0.015), (KEEP_X + 0.085, 0.015)]
    outline += [
        (
            KEEP_X + 0.085 * math.cos(i * math.pi / 18),
            0.22 + 0.085 * math.sin(i * math.pi / 18),
        )
        for i in range(19)
    ]
    cutter = build_vertical_prism(
        "Keep foundation entry cutter", outline, KEEP_FRONT, 0.20, m["shadow"]
    )
    cut_masonry_opening(bpy.data.objects["Keep foundation"], cutter)
    build_recessed_doorway(
        m,
        "Keep entrance",
        bpy.data.objects["Squat square keep"],
        KEEP_X,
        KEEP_FRONT,
        0.015,
        0.22,
        0.085,
        0.035,
        0.045,
    )
    for i in range(2):
        height = 0.030 - i * 0.015
        block(
            "Keep threshold step",
            (KEEP_X, KEEP_FRONT - 0.045 - i * 0.045, height / 2),
            (0.24, 0.045, height),
            m["stone_light"],
            bevel=0.001,
        )


def build_keep_banners(m):
    for x in [KEEP_X - 0.21, KEEP_X + 0.21]:
        banner = mesh(
            "Keep order hanging",
            [
                (x - 0.043, KEEP_FRONT - 0.017, 0.455),
                (x + 0.043, KEEP_FRONT - 0.017, 0.455),
                (x + 0.043, KEEP_FRONT - 0.022, 0.34),
                (x, KEEP_FRONT - 0.025, 0.315),
                (x - 0.043, KEEP_FRONT - 0.022, 0.34),
            ],
            [(0, 1, 2, 3, 4)],
            m["cloth"],
            thickness=0.003,
        )
        banner["orderCloth"] = "trim"
        beam(
            "Banner wall bracket",
            (x - 0.052, KEEP_FRONT - 0.027, 0.46),
            (x + 0.052, KEEP_FRONT - 0.027, 0.46),
            0.008,
            m["iron"],
            6,
        )


def build_watchtower(m):
    build_watchtower_masonry(m)
    build_watchtower_roof(m)
    build_tower_terrace_access(m)
    # A twelve-sided shaft is rotated to present flat faces to both slit cards.
    face_radius = 0.14 * math.cos(math.pi / 12)
    for z in [0.43, 0.66]:
        block(
            "Tower front arrow slit",
            (TOWER_X, TOWER_Y - face_radius - 0.002, z),
            (0.022, 0.004, 0.095),
            m["shadow"],
            bevel=0,
        )
        block(
            "Tower west arrow slit",
            (TOWER_X - face_radius - 0.002, TOWER_Y, z),
            (0.004, 0.022, 0.095),
            m["shadow"],
            bevel=0,
        )


def build_tower_terrace_access(m):
    join_tower_foundation_to_keep()
    open_keep_parapet_for_tower(m)
    build_tower_access_threshold(m)
    build_recessed_doorway(
        m,
        "Tower terrace",
        bpy.data.objects["Watchtower masonry"],
        TOWER_X + 0.14 * math.cos(math.pi / 12),
        TOWER_Y,
        TERRACE_LEVEL,
        0.728,
        0.048,
        0.021,
        frame_depth=0.044,
        facing=math.pi / 2,
    )


def join_tower_foundation_to_keep():
    # The adjoining foundations share a shaped joint, without intersecting solids.
    trim_against_tower(bpy.data.objects["Keep foundation"])


def open_keep_parapet_for_tower(m):
    cutter = block(
        "Tower passage cutter",
        (-0.18, TOWER_Y, 0.65),
        (0.20, TOWER_ACCESS_WIDTH, 0.20),
        m["shadow"],
        bevel=0,
    )
    cut_masonry_opening(bpy.data.objects["Keep parapet ring"], cutter)
    for obj in list(bpy.context.scene.objects):
        if (
            obj.name.startswith("Keep merlon")
            and obj.location.x < 0
            and abs(obj.location.y - TOWER_Y) < TOWER_ACCESS_WIDTH / 2
        ):
            data = obj.data
            bpy.data.objects.remove(obj, do_unlink=True)
            bpy.data.meshes.remove(data)


def build_tower_access_threshold(m):
    threshold = block(
        "Tower terrace threshold",
        (-0.1925, TOWER_Y, 0.564),
        (0.115, TOWER_ACCESS_WIDTH, 0.028),
        m["stone_dark"],
        bevel=0,
    )
    trim_against_tower(threshold)
    for sign in [-1, 1]:
        shoulder = block(
            "Tower passage shoulder",
            (-0.1925, TOWER_Y + sign * 0.0975, 0.587),
            (0.115, 0.025, 0.018),
            m["stone_light"],
            bevel=0,
        )
        trim_against_tower(shoulder)


def trim_against_tower(masonry):
    tower = bpy.data.objects["Watchtower masonry"]
    cutter = tower.copy()
    cutter.data = tower.data.copy()
    bpy.context.collection.objects.link(cutter)
    cut_masonry_opening(masonry, cutter)


def build_watchtower_masonry(m):
    # Stepped rings form a single skin, including the belts and foundation.
    profile = [(0, 0.16), (0.085, 0.16), (0.105, 0.14)]
    for z in [0.31, 0.548, 0.804]:
        profile.extend([(z, 0.14), (z, 0.154), (z + 0.026, 0.154), (z + 0.026, 0.14)])
    vertices = [
        (
            TOWER_X + r * math.cos(i * math.tau / 12 + math.pi / 12),
            TOWER_Y + r * math.sin(i * math.tau / 12 + math.pi / 12),
            z,
        )
        for z, r in profile
        for i in range(12)
    ]
    faces = [tuple(reversed(range(12)))]
    for level in range(len(profile) - 1):
        for i in range(12):
            j = (i + 1) % 12
            faces.append(
                (
                    level * 12 + i,
                    level * 12 + j,
                    (level + 1) * 12 + j,
                    (level + 1) * 12 + i,
                )
            )
    faces.append(tuple(range(len(vertices) - 12, len(vertices))))
    obj = mesh("Watchtower masonry", vertices, faces, m["stone"])
    obj.data.materials.append(m["stone_light"])
    for face in obj.data.polygons[1:-1]:
        level = (face.index - 1) // 12
        if max(profile[level][1], profile[level + 1][1]) > 0.14:
            face.material_index = 1


def build_watchtower_roof(m):
    # The raised eave clears the first-floor doorway; the roof keeps its original peak.
    bpy.ops.mesh.primitive_cone_add(
        vertices=12,
        radius1=0.195,
        radius2=0,
        depth=0.30,
        location=(TOWER_X, TOWER_Y, 0.98),
    )
    roof = bpy.context.object
    roof.name = "Watchtower clay roof"
    roof.data.materials.append(m["roof"])
    beam(
        "Tower roof finial",
        (TOWER_X, TOWER_Y, 1.13),
        (TOWER_X, TOWER_Y, 1.185),
        0.012,
        m["roof_edge"],
        6,
    )


def build_enclosure(m):
    path = build_enclosure_path()
    length = sum(section[0] for section in path)
    build_horizontal_prism(
        "Enclosure masonry",
        wall_path_outline(path, 0, length, 0.065),
        0,
        0.48,
        m["stone"],
    )
    build_horizontal_prism(
        "Wall coping",
        wall_path_outline(path, 0, length, 0.083),
        0.48,
        0.51,
        m["stone_light"],
    )
    build_enclosure_merlons(m, path, length)


def build_enclosure_path():
    # Straight curtain walls meet quarter-circle corners tangentially.
    # Only the gate piers remain square, where the front wall meets them at 90 degrees.
    radius, corner_x, front_y, back_y = 0.19, 0.48, GATE_Y + 0.19, 0.43
    return [
        straight_wall_section((-0.33, GATE_Y), (-corner_x, GATE_Y)),
        round_wall_section((-corner_x, front_y), radius, -math.pi / 2, -math.pi),
        straight_wall_section(
            (-corner_x - radius, front_y), (-corner_x - radius, back_y)
        ),
        round_wall_section((-corner_x, back_y), radius, math.pi, math.pi / 2),
        straight_wall_section(
            (-corner_x, back_y + radius), (corner_x, back_y + radius)
        ),
        round_wall_section((corner_x, back_y), radius, math.pi / 2, 0),
        straight_wall_section(
            (corner_x + radius, back_y), (corner_x + radius, front_y)
        ),
        round_wall_section((corner_x, front_y), radius, 0, -math.pi / 2),
        straight_wall_section((corner_x, GATE_Y), (0.33, GATE_Y)),
    ]


def build_enclosure_merlons(m, path, length):
    width = 0.075
    count = round(length / 0.15)
    gap = (length - count * width) / (count + 1)
    for i in range(count):
        start = gap + i * (width + gap)
        build_horizontal_prism(
            "Low battlement",
            wall_path_outline(path, start, start + width, 0.083),
            0.51,
            0.58,
            m["stone_light"],
        )


def build_gate(m):
    build_gate_frame(m)
    build_gate_leaves(m)
    build_gate_fittings(m)


def build_gate_frame(m):
    for sign in [-1, 1]:
        block(
            "Gate jamb",
            (sign * (GATE_RADIUS + 0.035), GATE_Y, GATE_SPRING / 2),
            (0.07, 0.154, GATE_SPRING),
            m["stone_light"],
            bevel=0.001,
        )
        block("Gate pier", (sign * 0.29, GATE_Y, 0.29), (0.08, 0.14, 0.58), m["stone"])
        block(
            "Gate pier coping",
            (sign * 0.29, GATE_Y, 0.595),
            (0.10, 0.17, 0.03),
            m["stone_light"],
        )
    build_stone_arch(
        m,
        "Gate arch voussoir",
        0,
        GATE_Y,
        GATE_SPRING,
        GATE_RADIUS,
        GATE_RADIUS + 0.07,
        0.154,
    )


def build_gate_leaves(m):
    # The crown follows the faceted arch with clearance, including at plank corners.
    radius = GATE_RADIUS - 0.009
    for i in range(10):
        left = -radius + i * 2 * radius / 10 + 0.0012
        right = -radius + (i + 1) * 2 * radius / 10 - 0.0012
        outline = [(left, 0.015), (right, 0.015)]
        outline += [
            (x, GATE_SPRING + math.sqrt(radius * radius - x * x))
            for x in [right, (left + right) / 2, left]
        ]
        build_vertical_prism(
            "Gate oak plank", outline, GATE_Y - 0.014, 0.028, m["wood"]
        )


def build_gate_fittings(m):
    for sign in [-1, 1]:
        for z in [0.075, 0.185]:
            block(
                "Gate iron strap",
                (sign * 0.091, GATE_Y - 0.031, z),
                (0.165, 0.006, 0.015),
                m["iron"],
                bevel=0.001,
            )
            beam(
                "Gate hinge pin",
                (sign * 0.175, GATE_Y - 0.031, z - 0.016),
                (sign * 0.175, GATE_Y - 0.031, z + 0.016),
                0.004,
                m["iron"],
                6,
            )
            block(
                "Gate rear brace",
                (sign * 0.087, GATE_Y + 0.008, z),
                (0.15, 0.016, 0.019),
                m["timber"],
                bevel=0.001,
            )
        block(
            "Gate handle plate",
            (sign * 0.025, GATE_Y - 0.031, 0.132),
            (0.018, 0.006, 0.027),
            m["iron"],
            bevel=0.001,
        )
        bpy.ops.mesh.primitive_torus_add(
            major_radius=0.009,
            minor_radius=0.002,
            major_segments=12,
            minor_segments=4,
            location=(sign * 0.025, GATE_Y - 0.0355, 0.127),
            rotation=(math.pi / 2, 0, 0),
        )
        bpy.context.object.name = "Gate iron ring handle"
        bpy.context.object.data.materials.append(m["iron"])
