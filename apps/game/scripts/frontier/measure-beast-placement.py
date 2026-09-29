"""Measure uniform beast scaling against decoded ruin triangles and the pointy hex."""

import json
import math
import sys

from mathutils import Vector
from mathutils.bvhtree import BVHTree


def measure_placement(data):
    beast = data["beast"]
    vertices = [Vector(point) for point in beast["vertices"]]
    ruin = data["ruin"]
    # Painted ground is a support surface, not an obstacle for grounded feet.
    obstacles = [face for face in ruin["triangles"] if max(ruin["vertices"][index][1] for index in face) > 0.003]
    ruin_tree = BVHTree.FromPolygons(ruin["vertices"], obstacles, all_triangles=True, epsilon=0.001)
    tile_limit = measure_tile_limit(vertices)
    collision_limit = measure_first_contact(vertices, beast["triangles"], ruin_tree, tile_limit)
    limit = min(tile_limit, collision_limit)
    cap = math.floor((limit - 0.01) * 100) / 100
    if cap < 1:
        raise ValueError("Beast does not fit the ruin courtyard at scale 1")
    return {
        "assetId": data["assetId"],
        "boundsAtScale1": {
            "min": [min(point[axis] for point in vertices) for axis in range(3)],
            "max": [max(point[axis] for point in vertices) for axis in range(3)],
        },
        "tileLimit": tile_limit,
        "firstContactScale": limit,
        "limitingGeometry": "tile" if tile_limit <= collision_limit else "ruin",
        "recommendedMaxScale": cap,
        "orientation": "+Z front; same ground-center origin; uniform scale only",
        "method": "Decoded GLB triangles; 0.005 scale sweep, 18 bisections, 0.001 BVH tolerance; cap has 0.01 scale margin",
    }


def measure_tile_limit(vertices):
    inradius = math.sqrt(3) / 2
    largest_projection = max(
        abs(point.x * math.cos(angle) + point.z * math.sin(angle))
        for point in vertices
        for angle in (0, math.pi / 3, 2 * math.pi / 3)
    )
    return inradius / largest_projection


def measure_first_contact(vertices, triangles, ruin_tree, tile_limit):
    def touches_ruin(scale):
        tree = BVHTree.FromPolygons(
            [point * scale for point in vertices], triangles, all_triangles=True, epsilon=0.001,
        )
        return bool(ruin_tree.overlap(tree))

    low = 0.005
    if touches_ruin(low):
        raise ValueError("The ruin must leave its origin clear")
    while low < tile_limit:
        high = min(low + 0.005, tile_limit)
        if touches_ruin(high):
            for _ in range(18):
                midpoint = (low + high) / 2
                if touches_ruin(midpoint):
                    high = midpoint
                else:
                    low = midpoint
            return low
        low = high
    return tile_limit


print("FRONTIER_PLACEMENT=" + json.dumps(measure_placement(json.load(sys.stdin))))
