"""Export an editable creature sculpt as one bounded, painted runtime mesh."""

import hashlib
import json
import math
import sys
from pathlib import Path

import bpy


def export_beast(source, output):
    bpy.ops.wm.open_mainfile(filepath=str(source))
    configure_bake()
    sculpt, delivery = prepare_delivery(source.stem)
    unwrap_delivery(delivery)
    paintings = bake_surface(sculpt, delivery, source.stem)
    finish_material(delivery, paintings)
    write_delivery(delivery, source, output)


def configure_bake():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 16
    scene.render.threads_mode = "FIXED"
    scene.render.threads = 2
    bake = scene.render.bake
    bake.margin = 6
    bake.use_pass_direct = False
    bake.use_pass_indirect = False
    bake.use_pass_color = True
    bake.cage_extrusion = 0.008
    bake.max_ray_distance = 0.04


def prepare_delivery(name):
    scene = bpy.context.scene
    objects = [obj for obj in scene.objects if obj.type == "MESH"]
    if len(objects) != 1:
        raise ValueError("Export requires one sculpt with its facial details")
    sculpt = objects[0]
    for vertex in sculpt.data.vertices:
        vertex.co *= scene.get("deliveryScale", 0.8)
    delivery = sculpt.copy()
    delivery.data = sculpt.data.copy()
    scene.collection.objects.link(delivery)
    delivery.name = name + " delivery"
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = delivery
    delivery.select_set(True)
    triangles = triangle_count(delivery)
    if triangles > 18000:
        decimate = delivery.modifiers.new("Delivery topology", "DECIMATE")
        decimate.ratio = 18000 / triangles
        bpy.ops.object.modifier_apply(modifier=decimate.name)
    for vertex in delivery.data.vertices:
        x, y, z = vertex.co
        if z < 0 or any(
            x * math.cos(i * math.pi / 3) + y * math.sin(i * math.pi / 3)
            > math.sqrt(3) / 2
            for i in range(6)
        ):
            raise ValueError("Creature leaves its radius-one hex")
    return sculpt, delivery


def unwrap_delivery(delivery):
    uv = delivery.data.uv_layers.new(name="Delivery UV")
    delivery.data.uv_layers.active_index = len(delivery.data.uv_layers) - 1
    uv.active_render = True
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=0.018)
    bpy.ops.object.mode_set(mode="OBJECT")


def bake_surface(sculpt, delivery, name):
    images = {}
    # Color follows the delivery UVs directly; normals transfer from the high-resolution sculpt.
    for kind in ["DIFFUSE", "NORMAL"]:
        bpy.context.scene.render.bake.use_selected_to_active = kind == "NORMAL"
        sculpt.select_set(kind == "NORMAL")
        sculpt.hide_render = kind != "NORMAL"
        size = 256 if kind == "NORMAL" else 1024
        image = bpy.data.images.new(
            name + " " + kind, width=size, height=size, alpha=False
        )
        if kind == "NORMAL":
            image.colorspace_settings.name = "Non-Color"
        for material in delivery.data.materials:
            nodes = material.node_tree.nodes
            target = nodes.new("ShaderNodeTexImage")
            target.image = image
            nodes.active = target
        bpy.ops.object.bake(type=kind)
        image.pack()
        images[kind] = image
    sculpt.select_set(False)
    return images


def finish_material(delivery, images):
    material = bpy.data.materials.new("Painted hide with baked contact and normals")
    material.use_nodes = True
    nodes, links = material.node_tree.nodes, material.node_tree.links
    shader = nodes.get("Principled BSDF")
    shader.inputs["Roughness"].default_value = 0.85
    color = nodes.new("ShaderNodeTexImage")
    color.image = images["DIFFUSE"]
    normal = nodes.new("ShaderNodeTexImage")
    normal.image = images["NORMAL"]
    normalmap = nodes.new("ShaderNodeNormalMap")
    links.new(color.outputs["Color"], shader.inputs["Base Color"])
    links.new(normal.outputs["Color"], normalmap.inputs["Color"])
    links.new(normalmap.outputs["Normal"], shader.inputs["Normal"])
    delivery.data.materials.clear()
    delivery.data.materials.append(material)
    for face in delivery.data.polygons:
        face.material_index = 0
    for layer in list(delivery.data.uv_layers):
        if layer.name != "Delivery UV":
            delivery.data.uv_layers.remove(layer)
    for attribute in list(delivery.data.color_attributes):
        delivery.data.color_attributes.remove(attribute)


def triangle_count(obj):
    return sum(len(face.vertices) - 2 for face in obj.data.polygons)


def write_delivery(delivery, source, output):
    delivery["sourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
    delivery["species"] = source.stem
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_extras=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    print(
        json.dumps(
            {
                "species": source.stem,
                "triangles": triangle_count(delivery),
                "bytes": output.stat().st_size,
            }
        )
    )


if __name__ == "__main__":
    export_beast(*map(Path, sys.argv[sys.argv.index("--") + 1 :]))
