"""Give the approved Canvas & Thatch source realm heraldry without changing its architecture."""

from pathlib import Path

import bmesh
import bpy

APP = Path(__file__).resolve().parents[2]


def key(point):
    return tuple(round(value, 6) for value in point)


def remove_fixed_emblem(editable, production, flag):
    stitches = [
        obj for obj in editable.objects if obj.name.startswith("Standard stitched sun")
    ]
    removed = {key(v.co) for obj in [flag, *stitches] for v in obj.data.vertices}
    for obj in production.objects:
        bm = bmesh.new()
        bm.from_mesh(obj.data)
        bmesh.ops.delete(
            bm, geom=[v for v in bm.verts if key(v.co) in removed], context="VERTS"
        )
        bm.to_mesh(obj.data)
        bm.free()
    for obj in stitches:
        bpy.data.objects.remove(obj, do_unlink=True)


def order_surface(obj, role, material):
    obj["citadelOrderSurface"] = role
    obj["orderCloth"] = "banner"
    if "relationshipCloth" in obj:
        del obj["relationshipCloth"]
    obj.data.materials.clear()
    obj.data.materials.append(material)
    uv = obj.data.uv_layers.active
    for axis in range(2):
        lo = min(entry.uv[axis] for entry in uv.data)
        hi = max(entry.uv[axis] for entry in uv.data)
        for entry in uv.data:
            entry.uv[axis] = (entry.uv[axis] - lo) / (hi - lo)
    for entry in obj.data.color_attributes["Surface tint"].data:
        entry.color = (1, 1, 1, 1)


def entrance_badge(editable, material):
    # The existing left entrance post supports the small Order plaque.
    data = bpy.data.meshes.new("Order entrance plaque")
    data.from_pydata(
        [
            (-0.331, -0.777, 0.19),
            (-0.289, -0.777, 0.19),
            (-0.289, -0.777, 0.275),
            (-0.331, -0.777, 0.275),
        ],
        [],
        [(0, 1, 2, 3)],
    )
    uv = data.uv_layers.new(name="Painted surface")
    for entry, pair in zip(uv.data, [(0, 0), (1, 0), (1, 1), (0, 1)]):
        entry.uv = pair
    data.color_attributes.new(name="Surface tint", type="FLOAT_COLOR", domain="CORNER")
    obj = bpy.data.objects.new("Realm / entrance Order", data)
    editable.objects.link(obj)
    order_surface(obj, "gate", material)
    return obj


def prepare():
    editable = bpy.data.collections["OUTPOST_EDITABLE"]
    production = bpy.data.collections["OUTPOST_PRODUCTION"]
    editable.name = "CITADEL_EDITABLE"
    production.name = "CITADEL_PRODUCTION"
    with bpy.data.libraries.load(
        str(APP / "asset-sources/realms/citadel-empire-mix.blend")
    ) as (_, loaded):
        loaded.materials = ["Citadel / Order cloth", "Citadel / Order imprint"]
    flag = editable.objects["Village ownership standard"]
    remove_fixed_emblem(editable, production, flag)
    order_surface(flag, "cloth", loaded.materials[0])
    badge = entrance_badge(editable, loaded.materials[1])
    for obj in (flag, badge):
        clone = obj.copy()
        clone.data = obj.data.copy()
        production.objects.link(clone)
    for obj in [*editable.objects, *production.objects]:
        obj["citadelTier"] = "settlement"
        if obj.get("relationshipCloth"):
            obj["orderCloth"] = "trim"
        uv = obj.data.uv_layers.active
        uv.name = "Baked surface"
        grain = obj.data.uv_layers.new(name="Surface grain")
        for a, b in zip(uv.data, grain.data):
            b.uv = a.uv
        obj.data.uv_layers.active = uv
        uv.active_render = True
    for material in bpy.data.materials:
        if material.node_tree:
            for node in material.node_tree.nodes:
                if node.type == "UVMAP" and node.uv_map == "Painted surface":
                    node.uv_map = "Baked surface"
                if node.type == "NORMAL_MAP" and node.uv_map == "Painted surface":
                    node.uv_map = "Baked surface"
    scene = bpy.context.scene
    scene["citadelTier"] = "settlement"
    scene["citadelWonder"] = False
    scene["realmDirection"] = "canvas-thatch"
    scene["sourceRole"] = (
        "Canvas & Thatch realm; architecture from the approved village source"
    )
