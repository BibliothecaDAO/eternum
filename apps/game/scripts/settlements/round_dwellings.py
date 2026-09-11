"""Round timber huts and felt yurts with equal roof-height and footprint controls."""

import math
from mathutils import Vector
from settlement_geometry import mesh, beam


def round_dwelling(
    m,
    name,
    x,
    y,
    radius,
    wall_height,
    peak,
    kind="hut",
    facing=-math.pi / 2,
    relationship=False,
):
    sides = 16 if kind == "yurt" else 12
    wall_radius = radius * (0.92 if kind == "yurt" else 0.82)
    finish = m["canvas"] if kind == "yurt" else m["wood"]

    def point(r, angle, z):
        return (x + r * math.cos(angle), y + r * math.sin(angle), z)

    for side in range(1, sides):
        a = facing + (side - 0.5) * math.tau / sides
        b = a + math.tau / sides
        mesh(
            name + " wall",
            [
                point(wall_radius, a, 0),
                point(wall_radius, b, 0),
                point(wall_radius, b, wall_height),
                point(wall_radius, a, wall_height),
            ],
            [(0, 1, 2, 3)],
            finish,
            thickness=0.007,
        )
        if kind == "hut":
            beam(
                name + " wall upright",
                point(wall_radius, a, 0),
                point(wall_radius, a, wall_height),
                0.007,
                m["frame"],
                5,
            )
    a = facing - math.pi / sides
    b = facing + math.pi / sides
    door_height = wall_height * 0.68
    mesh(
        name + " doorway head",
        [
            point(wall_radius, a, door_height),
            point(wall_radius, b, door_height),
            point(wall_radius, b, wall_height),
            point(wall_radius, a, wall_height),
        ],
        [(0, 1, 2, 3)],
        finish,
        thickness=0.007,
    )
    for angle in [a, b]:
        beam(
            name + " door jamb",
            point(wall_radius, angle, 0),
            point(wall_radius, angle, door_height),
            0.010,
            m["frame"],
            6,
        )
    beam(
        name + " door lintel",
        point(wall_radius, a, door_height),
        point(wall_radius, b, door_height),
        0.009,
        m["frame"],
        6,
    )
    profiles = (
        [
            (wall_height, 1.04),
            (wall_height + (peak - wall_height) * 0.34, 0.85),
            (wall_height + (peak - wall_height) * 0.76, 0.49),
            (peak - 0.015, 0.17),
        ]
        if kind == "yurt"
        else [
            (wall_height, 1.04),
            (wall_height + (peak - wall_height) * 0.36, 0.65),
            (wall_height + (peak - wall_height) * 0.70, 0.30),
        ]
    )
    vertices = [
        point(radius * r, facing + (i - 0.5) * math.tau / sides, z)
        for z, r in profiles
        for i in range(sides)
    ]
    faces = [tuple(reversed(range(sides)))]
    for row in range(len(profiles) - 1):
        faces += [
            (
                row * sides + i,
                row * sides + (i + 1) % sides,
                (row + 1) * sides + (i + 1) % sides,
                (row + 1) * sides + i,
            )
            for i in range(sides)
        ]
    top_ring = sides * (len(profiles) - 1)
    if kind == "yurt":
        faces.append(tuple(range(top_ring, top_ring + sides)))
        beam(
            name + " smoke crown",
            (x, y, peak - 0.015),
            (x, y, peak),
            radius * 0.17,
            m["frame"],
            12,
        )
    else:
        vertices.append((x, y, peak))
        faces += [
            (sides * 2 + i, sides * 2 + (i + 1) % sides, sides * 3)
            for i in range(sides)
        ]
    mesh(name + " roof", vertices, faces, m["roof"])
    if kind == "yurt":
        for z in [wall_height * 0.25, wall_height * 0.85]:
            for i in range(sides):
                a = facing + (i - 0.5) * math.tau / sides
                b = a + math.tau / sides
                if i:
                    beam(
                        name + " tension band",
                        point(wall_radius + 0.005, a, z),
                        point(wall_radius + 0.005, b, z),
                        0.004,
                        m["frame"],
                        5,
                    )
    forward = Vector((math.cos(facing), math.sin(facing), 0))
    right = Vector((-math.sin(facing), math.cos(facing), 0))
    center = Vector((x, y, door_height)) + forward * (wall_radius + 0.009)
    vertices = [
        tuple(center + right * u + forward * d + Vector((0, 0, z)))
        for u, d, z in [
            (-0.05, 0, 0),
            (0.05, 0, 0),
            (0.059, 0.025, -0.024),
            (-0.059, 0.025, -0.024),
        ]
    ]
    cloth = mesh(
        name + " entrance cloth", vertices, [(0, 1, 2, 3)], m["awning"], thickness=0.002
    )
    cloth["settlementMotion"] = "banner"
    cloth["relationshipCloth"] = "trim" if relationship else False
    if not relationship:
        del cloth["relationshipCloth"]
        cloth["orderCloth"] = "trim"
