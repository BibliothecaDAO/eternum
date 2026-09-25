"""Shared stone treatment and baked, ground-centered Frontier structure exports."""

import math
import sys
import tempfile
from pathlib import Path

import bpy

ROOT = Path(__file__).resolve().parents[4]
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "settlements"))
from settlement_geometry import (
    bake_instance_transforms,
    block,
    consolidate_static_materials,
    export_glb,
    material,
    mesh,
)
from stone_textures import bake_limestone


def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)


def create_stone():
    stone = material("Frontier limestone", (0.53, 0.455, 0.325))
    with tempfile.TemporaryDirectory(prefix="frontier-stone-") as directory:
        bake_limestone(stone, Path(directory), pale=False)
        for node in stone.node_tree.nodes:
            if node.type == "TEX_IMAGE":
                node.image.pack()
    return stone


def arch_stone(name, center, inner, outer, start, end, depth, stone):
    x, y, z = center
    outline = [
        (x + radius * math.cos(angle), z + radius * math.sin(angle))
        for radius, angle in ((inner, start), (outer, start), (outer, end), (inner, end))
    ]
    vertices = [(px, y + side * depth / 2, pz) for side in (-1, 1) for px, pz in outline]
    obj = mesh(
        name,
        vertices,
        [
            (0, 1, 2, 3), (7, 6, 5, 4),
            (4, 5, 1, 0), (5, 6, 2, 1), (6, 7, 3, 2), (7, 4, 0, 3),
        ],
        stone,
    )
    bevel_edges(obj, 0.007)
    return obj


def bevel_edges(obj, width):
    bpy.context.view_layer.objects.active = obj
    bevel = obj.modifiers.new("Worn edges", "BEVEL")
    bevel.width = width
    bevel.segments = 1
    bpy.ops.object.modifier_apply(modifier=bevel.name)


def ring_stone(name, center, inner, outer, start, end, height, stone):
    x, y, z = center
    outline = [
        (x + radius * math.cos(angle), y + radius * math.sin(angle))
        for radius, angle in ((inner, start), (outer, start), (outer, end), (inner, end))
    ]
    vertices = [(px, py, level) for level in (z, z + height) for px, py in outline]
    obj = mesh(
        name,
        vertices,
        [
            (3, 2, 1, 0), (4, 5, 6, 7),
            (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7),
        ],
        stone,
    )
    bevel_edges(obj, 0.006)
    return obj


def export_structure(asset_id):
    bake_instance_transforms()
    validate_tile_footprint()
    consolidate_static_materials()
    output = ROOT / "apps/game/public/models/frontier" / f"{asset_id}.glb"
    output.parent.mkdir(parents=True, exist_ok=True)
    export_glb(output, active_vertex_colors=True)
    print(f"Exported {asset_id}: {output.stat().st_size} bytes")


def validate_tile_footprint():
    # The inscribed circle fits every orientation of a radius-one hex tile.
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        for vertex in obj.data.vertices:
            x, y, z = vertex.co
            if math.hypot(x, y) > math.sqrt(3) / 2 or z < -0.001:
                raise ValueError(f"{obj.name} extends outside its ground-centered tile")
