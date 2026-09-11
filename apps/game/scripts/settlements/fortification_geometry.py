"""Shared fortification masonry, openings, and clean battlement joins."""

import math
import bpy
from mathutils import Matrix
from settlement_geometry import block, mesh


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


def build_horizontal_prism(name, outline, bottom, top, mat):
    count = len(outline)
    vertices = [(x, y, z) for z in [bottom, top] for x, y in outline]
    faces = [tuple(reversed(range(count))), tuple(range(count, 2 * count))]
    faces += [
        (i, (i + 1) % count, (i + 1) % count + count, i + count) for i in range(count)
    ]
    return mesh(name, vertices, faces, mat)


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
