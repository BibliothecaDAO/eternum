"""Project aligned front/back paint; delivery export converts it to ordinary packed UVs."""

import sys
from pathlib import Path
import bpy


def apply_paint(obj, painting):
    image = bpy.data.images.load(str(painting), check_existing=True)
    image.filepath = str(painting.resolve())
    image.reload()
    image.pack()
    create_projection_uvs(obj)
    for material in obj.data.materials:
        paint_material(material, image)
    bpy.context.scene["painting"] = painting.name


def create_projection_uvs(obj):
    for name, center, direction in [("Front paint", 0.25, 1), ("Back paint", 0.75, -1)]:
        layer = obj.data.uv_layers.get(name) or obj.data.uv_layers.new(name=name)
        for loop in obj.data.loops:
            x, _, z = obj.data.vertices[loop.vertex_index].co
            layer.data[loop.index].uv = (
                center + direction * x / 4,
                0.5 + (z - 0.9) / 2,
            )


def paint_material(material, image):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    for node in list(nodes):
        if node.name.startswith("Projection "):
            nodes.remove(node)

    def add(kind, name):
        node = nodes.new(kind)
        node.name = "Projection " + name
        return node

    textures = []
    for name in ["Front paint", "Back paint"]:
        texture = add("ShaderNodeTexImage", name)
        texture.image = image
        uv = add("ShaderNodeUVMap", name + " UV")
        uv.uv_map = name
        links.new(uv.outputs[0], texture.inputs["Vector"])
        textures.append(texture)
    geometry = add("ShaderNodeNewGeometry", "normal")
    separate = add("ShaderNodeSeparateXYZ", "normal axis")
    links.new(geometry.outputs["Normal"], separate.inputs[0])
    blend = add("ShaderNodeMapRange", "side transition")
    blend.inputs["From Min"].default_value = -0.35
    blend.inputs["From Max"].default_value = 0.35
    links.new(separate.outputs["Y"], blend.inputs["Value"])
    paint = add("ShaderNodeMixRGB", "painting")
    links.new(blend.outputs[0], paint.inputs[0])
    for index, texture in enumerate(textures):
        links.new(texture.outputs["Color"], paint.inputs[index + 1])
    links.new(paint.outputs[0], nodes.get("Principled BSDF").inputs["Base Color"])


if __name__ == "__main__":
    source, painting = map(Path, sys.argv[sys.argv.index("--") + 1 :])
    bpy.ops.wm.open_mainfile(filepath=str(source))
    obj = next(obj for obj in bpy.context.scene.objects if obj.type == "MESH")
    apply_paint(obj, painting)
    bpy.context.preferences.filepaths.save_version = 0
    bpy.ops.wm.save_as_mainfile(filepath=str(source), compress=True)
