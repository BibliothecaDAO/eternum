"""Continuous defensive palisades with a single southern gate opening."""

import math
from settlement_geometry import mesh, beam


def palisade(m, path, height, gate_height, spacing=0.06):
    for start, end in zip(path, path[1:]):
        count = math.ceil(math.dist(start, end) / spacing)
        for i in range(count):
            if start == path[0] and i == 0:
                continue
            t = i / count
            stake(
                m,
                start[0] + (end[0] - start[0]) * t,
                start[1] + (end[1] - start[1]) * t,
                height,
            )
        for z in [height * 0.20, height * 0.68]:
            beam("Palisade cross rail", (*start, z), (*end, z), 0.014, m["frame"], 6)
    for x, y in [path[0], path[-1]]:
        stake(m, x, y, gate_height, 0.037)
        for z in [0.10, gate_height - 0.15]:
            beam("Gate iron band", (x, y, z), (x, y, z + 0.025), 0.039, m["iron"], 8)


def stake(m, x, y, height, radius=0.028):
    sides = 8
    vertices = [
        (
            x + radius * math.cos(i * math.tau / sides),
            y + radius * math.sin(i * math.tau / sides),
            z,
        )
        for z in [0, height - 0.08]
        for i in range(sides)
    ]
    vertices.append((x, y, height))
    faces = [tuple(reversed(range(sides)))]
    faces += [
        (i, (i + 1) % sides, (i + 1) % sides + sides, i + sides) for i in range(sides)
    ]
    faces += [(i + sides, (i + 1) % sides + sides, sides * 2) for i in range(sides)]
    mesh("Palisade timber", vertices, faces, m["wood"])
