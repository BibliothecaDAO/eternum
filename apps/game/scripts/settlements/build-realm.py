"""Lowest realm: a stone keep, an adjoining watchtower, and a gated courtyard.

blender --background --python apps/game/scripts/settlements/build-realm.py
node apps/game/scripts/compress-models.mjs --only settlements/realm-settlement-draft.glb
"""

import math
import sys
from pathlib import Path
import bpy
from mathutils import Matrix

sys.path.insert(0, str(Path(__file__).resolve().parent))
from settlement_geometry import material, mesh, block, beam, save_asset

KEEP_X, KEEP_Y = 0.14, 0.23
KEEP_WIDTH, KEEP_DEPTH = 0.64, 0.50
KEEP_FRONT = KEEP_Y - KEEP_DEPTH / 2
TOWER_X, TOWER_Y = -0.33, KEEP_Y + 0.08
TERRACE_LEVEL = 0.578
TOWER_ACCESS_WIDTH = 0.22
GATE_Y, GATE_SPRING, GATE_RADIUS = -0.62, 0.21, 0.18


def build_realm():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    m = create_materials()
    build_keep(m)
    build_watchtower(m)
    build_enclosure(m)
    build_gate(m)
    build_order_banner(m)
    save_asset(
        "realm-settlement-draft",
        "realm-progression-v3.png and square battlement keep reference; lowest realm, no ground mesh",
        "Runtime wind banner; order heraldry",
    )


def create_materials():
    return {
        "stone": material("Warm limestone", (0.42, 0.37, 0.27)),
        "stone_light": material("Limestone coping", (0.53, 0.48, 0.36)),
        "stone_dark": material("Limestone mortar", (0.28, 0.25, 0.19)),
        "timber": material("Dark oak framing", (0.105, 0.055, 0.028)),
        "wood": material("Oak doors", (0.23, 0.11, 0.04)),
        "roof": material("Burnished clay roof", (0.31, 0.11, 0.043)),
        "roof_edge": material("Dark roof edging", (0.16, 0.060, 0.027)),
        "shadow": material("Recessed openings", (0.025, 0.022, 0.016)),
        "iron": material("Forged iron", (0.065, 0.071, 0.07)),
        "cloth": material("Realm order cloth", (0.27, 0.035, 0.025)),
    }


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


def build_square_battlements(m, name, x, y, width, depth, base, thickness):
    parapet_height, merlon_height = 0.046, 0.066
    build_parapet_ring(m, name, x, y, width, depth, base, thickness, parapet_height)
    build_roof_merlons(
        m, name, x, y, width, depth, base + parapet_height, thickness, merlon_height
    )


def build_parapet_ring(m, name, x, y, width, depth, base, thickness, height):
    # One watertight ring owns the four corners; adjoining rails never overlap.
    loops = [
        [
            (x + sx * w / 2, y + sy * d / 2, z)
            for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        ]
        for z in [base, base + height]
        for w, d in [(width, depth), (width - 2 * thickness, depth - 2 * thickness)]
    ]
    faces = []
    for i in range(4):
        j = (i + 1) % 4
        faces.extend(
            [
                (i, j, j + 8, i + 8),
                (i + 4, i + 12, j + 12, j + 4),
                (i + 8, j + 8, j + 12, i + 12),
                (i, i + 4, j + 4, j),
            ]
        )
    mesh(f"{name} parapet ring", sum(loops, []), faces, m["stone_light"])


def build_roof_merlons(m, name, x, y, width, depth, base, thickness, height):
    xs = merlon_centers(x, width, thickness)
    ys = merlon_centers(y, depth, thickness)
    centers = [(edge_x, edge_y) for edge_x in xs for edge_y in [ys[0], ys[-1]]]
    centers += [(edge_x, edge_y) for edge_x in [xs[0], xs[-1]] for edge_y in ys[1:-1]]
    for edge_x, edge_y in centers:
        block(
            f"{name} merlon",
            (edge_x, edge_y, base + height / 2),
            (thickness, thickness, height),
            m["stone_light"],
            bevel=0.002,
        )


def merlon_centers(center, span, width):
    count = max(3, round((span / width + 1) / 2))
    return [
        center - (span - width) / 2 + i * (span - width) / (count - 1)
        for i in range(count)
    ]


def build_keep_entrance(m):
    spring, radius, outer_radius = 0.16, 0.085, 0.142
    door_radius = radius - 0.004
    frame_y = KEEP_FRONT - 0.035
    door_y = KEEP_FRONT - 0.029
    outline = [(KEEP_X - door_radius, 0.015), (KEEP_X + door_radius, 0.015)]
    outline += [
        (
            KEEP_X + door_radius * math.cos(i * math.pi / 18),
            spring + door_radius * math.sin(i * math.pi / 18),
        )
        for i in range(19)
    ]
    build_vertical_prism("Arched oak keep door", outline, door_y, 0.012, m["wood"])
    for sign in [-1, 1]:
        block(
            "Keep doorway jamb",
            (KEEP_X + sign * (radius + outer_radius) / 2, frame_y, spring / 2),
            (outer_radius - radius, 0.072, spring),
            m["stone_light"],
            bevel=0.001,
        )
    build_stone_arch(
        m, "Keep arch stone", KEEP_X, frame_y, spring, radius, outer_radius, 0.072
    )
    for z in [0.075, 0.145]:
        block(
            "Keep door strap",
            (KEEP_X, door_y - 0.01, z),
            (0.15, 0.008, 0.014),
            m["iron"],
            bevel=0.001,
        )
    for i in range(2):
        height = 0.052 - i * 0.026
        block(
            "Keep threshold step",
            (KEEP_X, frame_y - 0.071 - i * 0.07, height / 2),
            (0.27, 0.07, height),
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


def build_recessed_doorway(
    m,
    name,
    masonry,
    x,
    y,
    bottom,
    spring,
    radius,
    frame_width,
    frame_depth=0.032,
    facing=0,
):
    placement = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(facing, 4, "Z")
    outline = arched_door_outline(0, bottom, spring, radius)
    cutter = build_vertical_prism(
        f"{name} opening cutter", outline, -0.025, 0.11, m["shadow"]
    )
    cutter.matrix_world = placement @ cutter.matrix_world
    cut_masonry_opening(masonry, cutter)
    parts = build_door_surround(
        m, name, 0, 0, bottom, spring, radius, frame_width, frame_depth
    )
    parts += build_oak_access_door(
        m, name, 0, 0.024, bottom + 0.003, spring, radius - 0.003
    )
    for part in parts:
        part.matrix_world = placement @ part.matrix_world


def arched_door_outline(x, bottom, spring, radius):
    return [(x - radius, bottom), (x + radius, bottom)] + [
        (
            x + radius * math.cos(i * math.pi / 18),
            spring + radius * math.sin(i * math.pi / 18),
        )
        for i in range(19)
    ]


def cut_masonry_opening(masonry, cutter):
    bpy.context.view_layer.objects.active = masonry
    modifier = masonry.modifiers.new("Architectural opening", "BOOLEAN")
    modifier.operation = "DIFFERENCE"
    modifier.solver = "EXACT"
    modifier.object = cutter
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    data = cutter.data
    bpy.data.objects.remove(cutter, do_unlink=True)
    bpy.data.meshes.remove(data)


def build_door_surround(m, name, x, face_y, bottom, spring, radius, width, depth):
    parts = []
    for sign in [-1, 1]:
        parts.append(
            block(
                f"{name} doorway jamb",
                (x + sign * (radius + width / 2), face_y, (bottom + spring) / 2),
                (width, depth, spring - bottom),
                m["stone_light"],
                bevel=0.001,
            )
        )
    parts += build_stone_arch(
        m, f"{name} arch stone", x, face_y, spring, radius, radius + width, depth
    )
    return parts


def build_oak_access_door(m, name, x, y, bottom, spring, radius):
    parts = [
        build_vertical_prism(
            f"{name} oak door",
            arched_door_outline(x, bottom, spring, radius),
            y,
            0.01,
            m["wood"],
        )
    ]
    height = spring + radius - bottom
    for fraction in [0.25, 0.65]:
        parts.append(
            block(
                f"{name} door strap",
                (x, y - 0.008, bottom + height * fraction),
                (radius * 1.8, 0.006, 0.009),
                m["iron"],
                bevel=0.0007,
            )
        )
    parts.append(
        block(
            f"{name} door latch",
            (x + radius * 0.5, y - 0.012, bottom + height * 0.45),
            (0.008, 0.008, 0.014),
            m["iron"],
            bevel=0.001,
        )
    )
    return parts


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
        0.208,
        m["stone"],
    )
    build_horizontal_prism(
        "Wall coping",
        wall_path_outline(path, 0, length, 0.083),
        0.208,
        0.238,
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


def straight_wall_section(start, end):
    return (math.dist(start, end), "straight", start, end)


def round_wall_section(center, radius, start_angle, end_angle):
    return (
        radius * abs(end_angle - start_angle),
        "round",
        center,
        (radius, start_angle, end_angle),
    )


def wall_path_station(path, distance):
    for length, kind, start, end in path:
        if distance <= length + 1e-8:
            t = min(1, max(0, distance / length))
            if kind == "straight":
                tangent = ((end[0] - start[0]) / length, (end[1] - start[1]) / length)
                point = (
                    start[0] + tangent[0] * length * t,
                    start[1] + tangent[1] * length * t,
                )
            else:
                radius, a, b = end
                angle = a + (b - a) * t
                point = (
                    start[0] + radius * math.cos(angle),
                    start[1] + radius * math.sin(angle),
                )
                tangent = (math.sin(angle), -math.cos(angle))
            return point, (-tangent[1], tangent[0])
        distance -= length
    raise ValueError("Wall station lies beyond the enclosure path")


def wall_path_outline(path, start, end, width):
    # Sampling the same path for masonry, coping and merlons keeps their edges aligned.
    count = max(1, math.ceil((end - start) / 0.02))
    distances = {start + (end - start) * i / count for i in range(count + 1)}
    boundary = 0
    for section in path:
        boundary += section[0]
        if start < boundary < end:
            distances.add(boundary)
    stations = [wall_path_station(path, distance) for distance in sorted(distances)]
    return [
        (
            point[0] + sign * normal[0] * width / 2,
            point[1] + sign * normal[1] * width / 2,
        )
        for sign, samples in [(-1, stations), (1, reversed(stations))]
        for point, normal in samples
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
            0.238,
            0.306,
            m["stone_light"],
        )


def build_horizontal_prism(name, outline, bottom, top, mat):
    count = len(outline)
    vertices = [(x, y, z) for z in [bottom, top] for x, y in outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces += [
        (i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)
    ]
    return mesh(name, vertices, faces, mat)


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
        block("Gate pier", (sign * 0.29, GATE_Y, 0.16), (0.08, 0.14, 0.32), m["stone"])
        block(
            "Gate pier coping",
            (sign * 0.29, GATE_Y, 0.335),
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


def build_vertical_prism(name, outline, y, depth, mat):
    count = len(outline)
    vertices = [
        (x, face_y, z) for face_y in [y - depth / 2, y + depth / 2] for x, z in outline
    ]
    faces = [tuple(range(count)), tuple(reversed(range(count, 2 * count)))]
    faces += [
        (i, i + count, (i + 1) % count + count, (i + 1) % count) for i in range(count)
    ]
    return mesh(name, vertices, faces, mat)


def build_stone_arch(m, name, x, y, spring, inner_radius, outer_radius, depth):
    stones = []
    for i in range(9):
        # Symmetric mortar joints; the first and last stones sit flat on the jambs.
        a = i * math.pi / 9 + (0.006 if i else 0)
        b = (i + 1) * math.pi / 9 - (0.006 if i < 8 else 0)
        outline = [
            (x + r * math.cos(angle), spring + r * math.sin(angle))
            for r, angle in [
                (inner_radius, a),
                (outer_radius, a),
                (outer_radius, b),
                (inner_radius, b),
            ]
        ]
        stones.append(build_vertical_prism(name, outline, y, depth, m["stone_light"]))
    return stones


def build_order_banner(m):
    x, y = 0.49, -0.13
    beam("Realm banner pole", (x, y, 0.02), (x, y, 1.065), 0.012, m["timber"])
    beam(
        "Banner crossbar",
        (x - 0.025, y, 1.025),
        (x + 0.19, y, 1.025),
        0.009,
        m["timber"],
    )
    vertices, uv = [], []
    for row in range(9):
        v = row / 8
        for col in range(9):
            u = col / 8
            vertices.append(
                (
                    x + u * 0.17,
                    y - 0.014 + 0.01 * math.sin(u * math.tau + v * 2),
                    1.015 - v * 0.32 + 0.035 * abs(2 * u - 1) * v**6,
                )
            )
            uv.append((u, 1 - v))
    faces = [
        (j * 9 + i, (j + 1) * 9 + i, (j + 1) * 9 + i + 1, j * 9 + i + 1)
        for j in range(8)
        for i in range(8)
    ]
    banner = mesh(
        "Realm order banner", vertices, faces, m["cloth"], uv, thickness=0.0015
    )
    banner["orderCloth"] = "banner"
    banner["settlementMotion"] = "banner"


if __name__ == "__main__":
    build_realm()
