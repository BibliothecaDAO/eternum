"""Polish the approved Forum banner and Ward finials in their packed sources."""

from pathlib import Path

import bmesh
import bpy
from mathutils import Vector


def key(point):
    return tuple(round(value, 6) for value in point)


def join_into(target, addition):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in (target, addition):
        obj.hide_set(False)
        obj.select_set(True)
    bpy.context.view_layer.objects.active = target
    bpy.ops.object.join()


def copy_region(source, points, offset, collection):
    mesh = source.data.copy()
    bm = bmesh.new()
    bm.from_mesh(mesh)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if key(v.co) not in points], context="VERTS")
    for vertex in bm.verts:
        vertex.co += offset
    bm.to_mesh(mesh)
    bm.free()
    obj = bpy.data.objects.new("Second terrace standard", mesh)
    collection.objects.link(obj)
    return obj


def second_forum_banner(editable, production):
    offset = Vector((0.94, 0, 0))
    architecture = production.objects["Citadel / age architecture"]
    for name in ("Banner / grounded oak pole", "Banner / anchored crossbar", "Order / cloth"):
        original = editable.objects[name]
        points = {key(v.co) for v in original.data.vertices}
        clone = original.copy()
        clone.data = original.data.copy()
        clone.name = name + " / opposite terrace"
        editable.objects.link(clone)
        for vertex in clone.data.vertices:
            vertex.co += offset
        target = next(o for o in production.objects if o.get("citadelOrderSurface") == "cloth") if name == "Order / cloth" else architecture
        join_into(target, copy_region(target, points, offset, production))


def teal_finials(editable, production):
    architecture = production.objects["Citadel / age architecture"]
    finials = [obj for obj in editable.objects if obj.name.startswith("Roof / finial")]
    removed = {key(v.co) for obj in finials for v in obj.data.vertices}
    bm = bmesh.new()
    bm.from_mesh(architecture.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if key(v.co) in removed], context="VERTS")
    bm.to_mesh(architecture.data)
    bm.free()
    material = bpy.data.materials["Citadel / Age accents"].copy()
    material.name = "Citadel / Refined essence"
    shader = material.node_tree.nodes.get("Principled BSDF")
    for link in list(shader.inputs["Emission Color"].links):
        material.node_tree.links.remove(link)
    shader.inputs["Emission Color"].default_value = (0.025, 0.72, 0.53, 1)
    shader.inputs["Emission Strength"].default_value = 1.6
    shader.inputs["Roughness"].default_value = 0.23
    for obj in finials:
        points = [v.co for v in obj.data.vertices]
        center = sum(points, Vector()) / len(points)
        lo, hi = min(v.z for v in points), max(v.z for v in points)
        middle = lo + (hi - lo) * 0.42
        vertices = [(center.x, center.y, lo), (center.x, center.y, hi)]
        vertices += [(center.x + x, center.y + y, middle) for x, y in ((.035, 0), (0, .035), (-.035, 0), (0, -.035))]
        faces = [(0, 2 + (i + 1) % 4, 2 + i) for i in range(4)] + [(1, 2 + i, 2 + (i + 1) % 4) for i in range(4)]
        mesh = bpy.data.meshes.new("Faceted teal gem")
        mesh.from_pydata(vertices, [], faces)
        mesh.materials.append(material)
        for name in ("Baked surface", "Surface grain"):
            uv = mesh.uv_layers.new(name=name)
            for loop in uv.data:
                loop.uv = (.5, .5)
        tint = mesh.color_attributes.new(name="Surface tint", type="FLOAT_COLOR", domain="CORNER")
        for value in tint.data:
            value.color = (.09, .65, .48, 1)
        obj.data = mesh
        obj["constructionRole"] = "Refined essence"
        clone = obj.copy()
        clone.data = mesh.copy()
        production.objects.link(clone)
        join_into(architecture, clone)


def revise():
    source = Path(bpy.data.filepath)
    if source.name not in {"citadel-terraced-forum.blend", "citadel-twin-ward.blend"}:
        raise ValueError("Open the packed Forum or Twin Ward source")
    if bpy.context.scene.get("realmAccentRevision") == 22:
        print("Realm accents already applied")
        return
    editable = bpy.data.collections["CITADEL_EDITABLE"]
    production = bpy.data.collections["CITADEL_PRODUCTION"]
    if source.name == "citadel-terraced-forum.blend":
        second_forum_banner(editable, production)
    else:
        teal_finials(editable, production)
    bpy.context.scene["realmAccentRevision"] = 22
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)


if __name__ == "__main__":
    revise()
