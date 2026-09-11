"""Shared Blender geometry and export for settlement drafts."""

import json
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]


def material(name, color, roughness=0.85):
    result = bpy.data.materials.new(name)
    result.diffuse_color = (*color, 1)
    result.use_nodes = True
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = (*color, 1)
    shader.inputs["Roughness"].default_value = roughness
    return result


def glowing_material(name, color, strength):
    result = material(name, color)
    shader = result.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Emission Color"].default_value = (*color, 1)
    shader.inputs["Emission Strength"].default_value = strength
    return result


def mesh(name, vertices, faces, mat, uv=None, thickness=0):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    layer = data.uv_layers.new(name="UVMap")
    for face in data.polygons:
        for loop in face.loop_indices:
            index = data.loops[loop].vertex_index
            x, y, z = vertices[index]
            layer.data[loop].uv = uv[index] if uv else (x * 2 + y * 0.3, z * 2 + y)
    if thickness:
        bpy.context.view_layer.objects.active = obj
        modifier = obj.modifiers.new("Material thickness", "SOLIDIFY")
        modifier.thickness = thickness
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def block(name, center, size, mat, bevel=0.003):
    bpy.ops.mesh.primitive_cube_add(size=1, location=center)
    obj = bpy.context.object
    obj.name = name
    obj.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("Worn edges", "BEVEL")
        modifier.width = bevel
        modifier.segments = 1
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def beam(name, start, end, radius, mat, sides=8):
    direction = Vector(end) - Vector(start)
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=sides,
        radius=radius,
        depth=direction.length,
        location=(Vector(start) + Vector(end)) / 2,
    )
    obj = bpy.context.object
    obj.name = name
    obj.rotation_euler = direction.to_track_quat("Z", "Y").to_euler()
    obj.data.materials.append(mat)
    return obj


def save_asset(name, concept, animation):
    output = ROOT / f"apps/game/public/models/settlements/{name}.glb"
    source = ROOT / f".context/graphics-lab/realm-progression/{name}"
    source.mkdir(parents=True, exist_ok=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    bake_instance_transforms()
    bpy.ops.wm.save_as_mainfile(filepath=str(source / f"{name}.blend"))
    consolidate_static_materials()
    export_glb(output)
    write_asset_report(output, source, concept, animation)


def bake_instance_transforms():
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in meshes:
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def consolidate_static_materials():
    # Static geometry is consolidated by material; the imprint surface stays separate.
    for mat in bpy.data.materials:
        group = [
            obj
            for obj in list(bpy.context.scene.objects)
            if obj.type == "MESH"
            and obj.data.materials
            and obj.data.materials[0] == mat
            and not obj.get("relationshipCloth")
            and not obj.get("orderCloth")
            and not obj.get("settlementMotion")
        ]
        if len(group) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in group:
            obj.select_set(True)
        bpy.context.view_layer.objects.active = group[0]
        bpy.ops.object.join()
        group[0].name = mat.name


def export_glb(output):
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_yup=True,
    )


def write_asset_report(output, source, concept, animation):
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    vertices = [
        obj.matrix_world @ vertex.co for obj in meshes for vertex in obj.data.vertices
    ]
    bounds = [
        [min(v[i] for v in vertices), max(v[i] for v in vertices)] for i in range(3)
    ]
    triangles = sum(
        sum(len(face.vertices) - 2 for face in obj.data.polygons) for obj in meshes
    )
    report = {
        "sourceConcept": concept,
        "sizeBlenderXYZ": [round(b - a, 4) for a, b in bounds],
        "triangles": triangles,
        "meshCount": len(meshes),
        "uncompressedBytes": output.stat().st_size,
        "groundMesh": False,
        "animation": animation,
    }
    (source / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))
