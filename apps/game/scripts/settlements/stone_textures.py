"""Bake stone relief once; the game samples shared, ordinary PBR textures."""

import bpy


def bake_limestone(stone, source, pale=False):
    configure_limestone(stone, pale)
    textures = bake_material_textures(stone, source, "limestone", 512, plane_size=2)
    apply_baked_textures(stone, textures, 0.88)
    stone.name = "Weathered limestone"
    return stone


def configure_limestone(stone, pale):
    nodes, links = stone.node_tree.nodes, stone.node_tree.links
    shader = nodes.get("Principled BSDF")
    coordinates = nodes.new("ShaderNodeTexCoord")
    grain = nodes.new("ShaderNodeTexNoise")
    grain.inputs["Scale"].default_value = 220
    grain.inputs["Detail"].default_value = 2
    grain.inputs["Roughness"].default_value = 0.72
    links.new(coordinates.outputs["UV"], grain.inputs["Vector"])
    mineral = nodes.new("ShaderNodeTexNoise")
    mineral.inputs["Scale"].default_value = 3
    mineral.inputs["Detail"].default_value = 4
    links.new(coordinates.outputs["UV"], mineral.inputs["Vector"])
    colors = nodes.new("ShaderNodeValToRGB")
    colors.color_ramp.elements[0].position = 0.18
    colors.color_ramp.elements[0].color = (0.84, 0.82, 0.77, 1) if pale else (0.53, 0.455, 0.325, 1)
    colors.color_ramp.elements[1].position = 0.82
    colors.color_ramp.elements[1].color = (0.92, 0.90, 0.85, 1) if pale else (0.65, 0.575, 0.445, 1)
    links.new(mineral.outputs["Fac"], colors.inputs["Fac"])
    links.new(colors.outputs["Color"], shader.inputs["Base Color"])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.15
    bump.inputs["Distance"].default_value = 0.004
    links.new(grain.outputs["Fac"], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])


def bake_material_textures(material, source, name, resolution, plane_size=1):
    source.mkdir(parents=True, exist_ok=True)
    nodes = material.node_tree.nodes
    bpy.ops.mesh.primitive_plane_add(size=plane_size)
    plane = bpy.context.object
    plane.data.materials.append(material)
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.samples = 1
    scene.render.bake.margin = 8
    scene.render.bake.use_pass_direct = False
    scene.render.bake.use_pass_indirect = False
    textures = {}
    for suffix, kind in [("color", "DIFFUSE"), ("normal", "NORMAL")]:
        image = bpy.data.images.new(f"{name}-{suffix}", width=resolution, height=resolution)
        if kind == "NORMAL":
            image.colorspace_settings.name = "Non-Color"
        target = nodes.new("ShaderNodeTexImage")
        target.image = image
        nodes.active = target
        bpy.ops.object.bake(type=kind)
        image.filepath_raw = str(source / f"{name}-{suffix}.png")
        image.file_format = "PNG"
        image.save()
        textures[kind] = image
    bpy.data.objects.remove(plane, do_unlink=True)
    return textures


def apply_baked_textures(material, textures, roughness):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    shader.inputs["Roughness"].default_value = roughness
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    albedo = nodes.new("ShaderNodeTexImage")
    albedo.image = textures["DIFFUSE"]
    links.new(albedo.outputs["Color"], shader.inputs["Base Color"])
    normal = nodes.new("ShaderNodeTexImage")
    normal.image = textures["NORMAL"]
    decode = nodes.new("ShaderNodeNormalMap")
    links.new(normal.outputs["Color"], decode.inputs["Color"])
    links.new(decode.outputs["Normal"], shader.inputs["Normal"])
