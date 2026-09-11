"""Shared civilian buildings and landmark details for the approved realm progression."""

import math
import bpy
from mathutils import Matrix
from settlement_geometry import block, mesh, beam, material, glowing_material
from timber_defenses import palisade
from fortification_geometry import (
    build_vertical_prism,
    build_horizontal_prism,
    cut_masonry_opening,
    arched_door_outline,
    build_stone_arch,
    build_door_surround,
    wall_path_outline,
    build_square_battlements,
)


def palette():
    return {
        "stone": material("Honey limestone", (0.48, 0.43, 0.33)),
        "stone_light": material("Limestone coping", (0.65, 0.59, 0.46)),
        "stone_dark": material("Foundation stone", (0.29, 0.27, 0.22)),
        "plaster": material("Warm lime plaster", (0.68, 0.61, 0.46)),
        "plaster_light": material("Pale lime plaster", (0.77, 0.70, 0.55)),
        "timber": material("Oak framing", (0.12, 0.065, 0.032)),
        "wood": material("Oak doors", (0.25, 0.12, 0.047)),
        "roof": material("Clay tiles", (0.34, 0.13, 0.055)),
        "roof_edge": material("Dark clay edging", (0.16, 0.06, 0.027)),
        "roof_light": material("Sunlit clay", (0.43, 0.20, 0.085)),
        "thatch": material("Golden reed thatch", (0.47, 0.30, 0.095)),
        "slate": material("Blue slate", (0.07, 0.14, 0.19)),
        "teal_roof": material("Imperial roof", (0.045, 0.19, 0.19)),
        "iron": material("Iron fittings", (0.07, 0.075, 0.065)),
        "shadow": material("Opening shadow", (0.021, 0.027, 0.024)),
        "glass": material("Window glass", (0.13, 0.25, 0.24), 0.48),
        "copper": material("Distillery copper", (0.39, 0.20, 0.08), 0.5),
        "gold": material("Worked bronze", (0.58, 0.36, 0.09), 0.45),
        "teal": glowing_material("Refined essence", (0.025, 0.52, 0.43), 0.45),
        "purple": glowing_material("Raw essence", (0.30, 0.035, 0.47), 0.35),
        "cloth": material("Realm order cloth", (0.35, 0.025, 0.027)),
        "canvas": material("Market linen", (0.68, 0.55, 0.33)),
    }


def roof(m, name, x, y, width, depth, eave, ridge, finish="roof", hip=False):
    """One closed roof volume; shallow course lines follow its slopes."""
    if hip:
        vertices = [
            (x + sx * width / 2, y + sy * depth / 2, eave)
            for sx, sy in [(-1, -1), (1, -1), (1, 1), (-1, 1)]
        ]
        vertices += [(x, y - depth * 0.18, ridge), (x, y + depth * 0.18, ridge)]
        obj = mesh(
            name + " roof",
            vertices,
            [(3, 2, 1, 0), (0, 1, 4), (1, 2, 5, 4), (2, 3, 5), (3, 0, 4, 5)],
            m[finish],
        )
    else:
        obj = build_vertical_prism(
            name + " roof",
            [(x - width / 2, eave), (x + width / 2, eave), (x, ridge)],
            y,
            depth,
            m[finish],
        )
    build_roof_courses(m, name, x, y, width, depth, eave, ridge, finish, hip)

    return obj


def build_roof_courses(m, name, x, y, width, depth, eave, ridge, finish, hip):
    rows = 7
    for row in range(rows):
        low, high = row / rows, (row + 1) / rows
        for sign in [-1, 1]:
            run_low = depth / 2 * (1 - 0.64 * low) if hip else depth / 2
            run_high = depth / 2 * (1 - 0.64 * high) if hip else depth / 2
            vertices = [
                (
                    x + sign * width / 2 * (1 - t),
                    y + sy * run,
                    eave + (ridge - eave) * t + lift,
                )
                for t, run, lift in [(low, run_low, 0.004), (high, run_high, 0.001)]
                for sy in [-1, 1]
            ]
            # Each course projects at its lower edge and tucks into the next.
            mesh(
                name + " roof course",
                vertices,
                [(0, 1, 3, 2)],
                m[finish],
                thickness=0.002,
            )
            seams = max(2, round(depth / 0.07))
            for i in range(1, seams):
                u = (i + (0.35 if row % 2 else 0)) / seams
                if u >= 1:
                    continue
                a = (
                    x + sign * width / 2 * (1 - low),
                    y + (2 * u - 1) * run_low,
                    eave + (ridge - eave) * low + 0.005,
                )
                b = (
                    x + sign * width / 2 * (1 - high),
                    y + (2 * u - 1) * run_high,
                    eave + (ridge - eave) * high + 0.002,
                )
                beam(
                    name + " roof seam",
                    a,
                    b,
                    0.0014,
                    m["roof_edge"] if finish == "roof" else m[finish],
                    4,
                )


def window(m, name, body, x, y, bottom, width, height, facing=0, gold=False):
    radius = width / 2
    outline = arched_door_outline(0, bottom, bottom + height - radius, radius)
    placement = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(facing, 4, "Z")
    cutter = build_vertical_prism(name + " cutter", outline, 0.012, 0.05, m["shadow"])
    cutter.matrix_world = placement @ cutter.matrix_world
    cut_masonry_opening(body, cutter)
    panel = build_vertical_prism(name + " glass", outline, 0.034, 0.004, m["glass"])
    panel.matrix_world = placement @ panel.matrix_world
    surround = dict(m, stone_light=m["gold"] if gold else m["stone_light"])
    parts = build_stone_arch(
        surround,
        name + " arch",
        0,
        0,
        bottom + height - radius,
        radius,
        radius + 0.008,
        0.012,
    )
    for sign in [-1, 1]:
        parts.append(
            block(
                name + " jamb",
                (sign * (radius + 0.004), 0, bottom + (height - radius) / 2),
                (0.008, 0.012, height - radius),
                surround["stone_light"],
                0,
            )
        )
    parts.append(
        block(
            name + " mullion",
            (0, -0.003, bottom + height * 0.47),
            (0.005, 0.012, height * 0.92),
            surround["stone_light"],
            0,
        )
    )
    for part in parts:
        part.matrix_world = placement @ part.matrix_world


def crystal(m, name, x, y, bottom, radius, height):
    vertices = [(x, y, bottom), (x, y, bottom + height)]
    vertices += [
        (
            x + radius * math.cos(i * math.tau / 6),
            y + radius * math.sin(i * math.tau / 6),
            bottom + height * 0.44,
        )
        for i in range(6)
    ]
    faces = [(0, 2 + (i + 1) % 6, 2 + i) for i in range(6)] + [
        (1, 2 + i, 2 + (i + 1) % 6) for i in range(6)
    ]
    return mesh(name, vertices, faces, m["teal"])


def well(m, x, y):
    ring(m, "Well stone", x, y, 0.063, 0.039, 0, 0.10)
    beam("Well water", (x, y, 0.014), (x, y, 0.018), 0.038, m["glass"], 12)
    for sign in [-1, 1]:
        beam(
            "Well post",
            (x + sign * 0.07, y, 0),
            (x + sign * 0.07, y, 0.225),
            0.008,
            m["timber"],
            6,
        )
    roof(m, "Well", x, y, 0.19, 0.15, 0.21, 0.26, "roof")
    beam(
        "Well spindle",
        (x - 0.075, y, 0.165),
        (x + 0.075, y, 0.165),
        0.009,
        m["wood"],
        8,
    )
    build_well_bucket(m, x + 0.095, y - 0.075)


def build_well_bucket(m, x, y):
    ring(m, "Well bucket", x, y, 0.023, 0.019, 0, 0.042, "wood", 10)
    beam("Bucket base", (x, y, 0), (x, y, 0.003), 0.019, m["wood"], 10)
    for side in [-1, 1]:
        beam(
            "Bucket handle side",
            (x + side * 0.02, y, 0.035),
            (x + side * 0.02, y, 0.057),
            0.002,
            m["iron"],
            5,
        )
    beam(
        "Bucket handle", (x - 0.02, y, 0.057), (x + 0.02, y, 0.057), 0.002, m["iron"], 5
    )


def fence(m):
    # One uninterrupted perimeter ends at the two southern entrance posts.
    path = [
        (-0.17, -0.62),
        (-0.60, -0.48),
        (-0.66, 0.36),
        (-0.44, 0.58),
        (0.44, 0.58),
        (0.66, 0.36),
        (0.60, -0.48),
        (0.17, -0.62),
    ]
    palisade(dict(m, frame=m["timber"]), path, height=0.55, gate_height=0.65)


def ring(m, name, x, y, outer, inner, bottom, top, finish="stone_light", sides=16):
    loops = [
        [
            (
                x + r * math.cos(i * math.tau / sides + math.pi / sides),
                y + r * math.sin(i * math.tau / sides + math.pi / sides),
                z,
            )
            for i in range(sides)
        ]
        for z, r in [(bottom, outer), (top, outer), (bottom, inner), (top, inner)]
    ]
    faces = []
    for i in range(sides):
        j = (i + 1) % sides
        faces += [
            (i, j, j + sides, i + sides),
            (i + 2 * sides, i + 3 * sides, j + 3 * sides, j + 2 * sides),
            (i + sides, j + sides, j + 3 * sides, i + 3 * sides),
            (i, i + 2 * sides, j + 2 * sides, j),
        ]
    return mesh(name, sum(loops, []), faces, m[finish])


def round_tower(m, name, x, y, radius, height, peak, finish="slate", imperial=False):
    sides = 16
    # Every radius change is a connected part of this one masonry skin.
    profile = [(0, radius + 0.014), (0.045, radius + 0.014), (0.07, radius)]
    for z in [height * 0.36, height * 0.70]:
        profile += [
            (z, radius),
            (z, radius + 0.008),
            (z + 0.018, radius + 0.008),
            (z + 0.018, radius),
        ]
    profile += [(height - 0.035, radius), (height, radius + 0.016)]
    vertices = [
        (
            x + r * math.cos(i * math.tau / sides + math.pi / sides),
            y + r * math.sin(i * math.tau / sides + math.pi / sides),
            z,
        )
        for z, r in profile
        for i in range(sides)
    ]
    faces = [tuple(reversed(range(sides)))]
    for level in range(len(profile) - 1):
        faces += [
            (
                level * sides + i,
                level * sides + (i + 1) % sides,
                (level + 1) * sides + (i + 1) % sides,
                (level + 1) * sides + i,
            )
            for i in range(sides)
        ]
    faces.append(tuple(range(len(vertices) - sides, len(vertices))))
    body = mesh(name + " masonry", vertices, faces, m["stone"])
    facing_radius = radius * math.cos(math.pi / sides)
    for facing, wx, wy in [
        (0, x, y - facing_radius),
        (math.pi / 2, x + facing_radius, y),
        (math.pi, x, y + facing_radius),
    ]:
        window(
            m,
            name + " tower window",
            body,
            wx,
            wy,
            height * 0.57,
            0.035,
            height * 0.15,
            facing,
            imperial,
        )
    ring(
        m,
        name + " crown",
        x,
        y,
        radius + 0.026,
        radius - 0.018,
        height,
        height + 0.036,
        "stone_light",
    )
    for i in range(8):
        angle = i * math.tau / 8
        b = block(
            name + " merlon",
            (
                x + (radius + 0.005) * math.cos(angle),
                y + (radius + 0.005) * math.sin(angle),
                height + 0.065,
            ),
            (0.034, 0.034, 0.058),
            m["stone_light"],
            0.001,
        )
        b.rotation_euler.z = angle
    cone_roof(m, name, x, y, radius - 0.022, height + 0.036, peak, finish, imperial)
    return body


def cone_roof(m, name, x, y, radius, bottom, peak, finish, imperial=False, finial=True):
    if imperial:
        build_imperial_roof(m, name, x, y, radius, bottom, peak, finish)
    else:
        bpy.ops.mesh.primitive_cone_add(
            vertices=12,
            radius1=radius,
            radius2=0,
            depth=peak - bottom,
            location=(x, y, (peak + bottom) / 2),
        )
        bpy.context.object.name = name + " conical roof"
        bpy.context.object.data.materials.append(m[finish])
    if finial:
        beam(
            name + " finial",
            (x, y, peak),
            (x, y, peak + 0.035),
            0.004,
            m["gold" if imperial else "copper"],
            6,
        )
        if imperial:
            build_gold_finial(m, name, x, y, peak + 0.035, radius * 0.12)


def build_imperial_roof(m, name, x, y, radius, bottom, peak, finish):
    sides = 12
    rise = peak - bottom
    profile = [
        (radius, bottom),
        (radius * 0.91, bottom + rise * 0.17),
        (radius * 0.37, bottom + rise * 0.66),
    ]
    vertices = [
        (
            x + r * math.cos(i * math.tau / sides),
            y + r * math.sin(i * math.tau / sides),
            z,
        )
        for r, z in profile
        for i in range(sides)
    ]
    tip = len(vertices)
    vertices.append((x, y, peak))
    faces = [tuple(reversed(range(sides)))]
    faces += [
        (
            row * sides + i,
            row * sides + (i + 1) % sides,
            (row + 1) * sides + (i + 1) % sides,
            (row + 1) * sides + i,
        )
        for row in range(len(profile) - 1)
        for i in range(sides)
    ]
    faces += [
        (
            (len(profile) - 1) * sides + i,
            (len(profile) - 1) * sides + (i + 1) % sides,
            tip,
        )
        for i in range(sides)
    ]
    mesh(name + " swept roof", vertices, faces, m[finish])
    rib_profile = profile + [(0, peak)]
    for i in range(6):
        angle = i * math.tau / 6
        for (r1, z1), (r2, z2) in zip(rib_profile, rib_profile[1:]):
            beam(
                name + " gilded roof rib",
                (x + r1 * math.cos(angle), y + r1 * math.sin(angle), z1 + 0.003),
                (x + r2 * math.cos(angle), y + r2 * math.sin(angle), z2 + 0.003),
                max(0.002, radius * 0.024),
                m["gold"],
                6,
            )


def build_gold_finial(m, name, x, y, bottom, radius):
    vertices = [(x, y, bottom), (x, y, bottom + radius * 4)]
    vertices += [
        (
            x + radius * math.cos(i * math.tau / 4),
            y + radius * math.sin(i * math.tau / 4),
            bottom + radius * 1.3,
        )
        for i in range(4)
    ]
    faces = [(0, 2 + (i + 1) % 4, 2 + i) for i in range(4)]
    faces += [(1, 2 + i, 2 + (i + 1) % 4) for i in range(4)]
    mesh(name + " golden spear finial", vertices, faces, m["gold"])


def heraldic_hanging(m, name, x, y, top, width, height, facing=0):
    def point(u, z):
        return (x + u * math.cos(facing), y + u * math.sin(facing), z)

    cloth = mesh(
        name,
        [
            point(-width / 2, top),
            point(width / 2, top),
            point(width / 2, top - height * 0.85),
            point(0, top - height),
            point(-width / 2, top - height * 0.85),
        ],
        [(0, 1, 2, 3, 4)],
        m["cloth"],
        thickness=0.002,
    )
    cloth["orderCloth"] = "trim"
    beam(
        name + " gilt crossbar",
        point(-width * 0.65, top + 0.008),
        point(width * 0.65, top + 0.008),
        0.005,
        m["gold"],
        6,
    )


def curtain(m, path, height):
    length = sum(section[0] for section in path)
    objects = [
        build_horizontal_prism(
            "Curtain masonry",
            wall_path_outline(path, 0, length, 0.065),
            0,
            height,
            m["stone"],
        ),
        build_horizontal_prism(
            "Curtain coping",
            wall_path_outline(path, 0, length, 0.082),
            height,
            height + 0.026,
            m["stone_light"],
        ),
    ]
    count = round(length / 0.145)
    width = 0.068
    gap = (length - count * width) / (count + 1)
    for i in range(count):
        start = gap + i * (width + gap)
        objects.append(
            build_horizontal_prism(
                "Curtain merlon",
                wall_path_outline(path, start, start + width, 0.082),
                height + 0.026,
                height + 0.093,
                m["stone_light"],
            )
        )
    return objects


def trim_to_neighbor(obj, neighbor):
    cutter = neighbor.copy()
    cutter.data = neighbor.data.copy()
    bpy.context.collection.objects.link(cutter)
    cut_masonry_opening(obj, cutter)


def gatehouse(m, drawbridge=False, imperial=False):
    height = 0.60 if drawbridge else 0.55
    body = block(
        "Gatehouse masonry",
        (0, -0.62, height / 2),
        (0.66, 0.11, height),
        m["stone"],
        0.003,
    )
    cutter = build_vertical_prism(
        "Gate opening",
        arched_door_outline(0, -0.01, 0.235, 0.125),
        -0.62,
        0.24,
        m["shadow"],
    )
    cut_masonry_opening(body, cutter)
    build_door_surround(m, "Outer gate", 0, -0.675, 0, 0.235, 0.125, 0.036, 0.048)
    if imperial:
        block(
            "Gatehouse coping",
            (0, -0.62, height + 0.015),
            (0.66, 0.13, 0.03),
            m["stone_light"],
            0.001,
        )
    else:
        build_square_battlements(m, "Gatehouse", 0, -0.62, 0.66, 0.15, height, 0.035)
    if drawbridge:
        block(
            "Drawbridge deck", (0, -0.728, 0.023), (0.24, 0.30, 0.018), m["wood"], 0.001
        )
        for sign in [-1, 1]:
            beam(
                "Drawbridge chain",
                (sign * 0.114, -0.683, 0.39),
                (sign * 0.114, -0.86, 0.035),
                0.004,
                m["iron"],
                6,
            )
        for i in range(9):
            block(
                "Drawbridge plank seam",
                (0, -0.59 - i * 0.031, 0.033),
                (0.225, 0.002, 0.002),
                m["timber"],
                0,
            )
    if imperial:
        crystal(m, "Gate refined essence", 0, -0.70, 0.45, 0.025, 0.08)
    return body


def sky_bridge(m, name, center, y, width, floor, neighbors):
    depth = 0.15
    body = block(
        name + " masonry",
        (center, y, floor - 0.105),
        (width, depth, 0.21),
        m["stone_light"],
        0,
    )
    cutter = build_vertical_prism(
        name + " arch cutter",
        arched_door_outline(center, floor - 0.24, floor - 0.16, width * 0.31),
        y,
        depth + 0.04,
        m["shadow"],
    )
    cut_masonry_opening(body, cutter)
    parts = [body]
    for sign in [-1, 1]:
        parts.append(
            block(
                name + " parapet",
                (center, y + sign * 0.065, floor + 0.042),
                (width, 0.02, 0.084),
                m["stone"],
                0.002,
            )
        )
        parts.append(
            block(
                name + " coping",
                (center, y + sign * 0.065, floor + 0.091),
                (width, 0.027, 0.014),
                m["stone_light"],
                0.001,
            )
        )
    for part in parts:
        for neighbor in neighbors:
            trim_to_neighbor(part, neighbor)


def banner(m, name, x, y, top, span=-0.16, height=0.27, base=0):
    beam(name + " pole", (x, y, base), (x, y, top + 0.035), 0.008, m["timber"], 8)
    beam(
        name + " crossbar", (x - 0.015, y, top), (x + span, y, top), 0.006, m["gold"], 6
    )
    vertices = []
    uv = []
    for row in range(9):
        v = row / 8
        for col in range(9):
            u = col / 8
            vertices.append(
                (
                    x + span * u,
                    y - 0.013 + 0.008 * math.sin(u * math.tau + v * 2),
                    top - 0.012 - v * height + 0.025 * abs(2 * u - 1) * v**6,
                )
            )
            uv.append((u, 1 - v))
    faces = [
        (j * 9 + i, (j + 1) * 9 + i, (j + 1) * 9 + i + 1, j * 9 + i + 1)
        for j in range(8)
        for i in range(8)
    ]
    obj = mesh(name, vertices, faces, m["cloth"], uv, thickness=0.0015)
    obj["orderCloth"] = "banner"
    obj["settlementMotion"] = "banner"
