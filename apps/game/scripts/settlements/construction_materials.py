"""Baked dressed-stone courses and shared grain for realm roofs and coping."""

from pathlib import Path

from construction_styles import STYLES
from stone_textures import bake_limestone, bake_material_textures, apply_baked_textures

ROOT = Path(__file__).resolve().parents[4]
ROOF_FINISHES = ("roof", "slate", "teal_roof")


def prepare_construction_materials(materials, tier):
    style = STYLES[tier]
    source = ROOT / ".context/graphics-lab/realm-progression" / tier
    names = {key: material.name for key, material in materials.items()}
    coping = bake_limestone(materials["stone_light"], source, pale=True)
    coping.name = names["stone_light"]
    configure_masonry(materials["stone"], style)
    textures = bake_material_textures(materials["stone"], source, "masonry", 1024)
    apply_baked_textures(materials["stone"], textures, 0.92)
    for key in ("stone_dark", *ROOF_FINISHES):
        finish = coping.copy()
        finish.name = names[key]
        materials[key] = finish
        if key in ROOF_FINISHES:
            finish["tileWear"] = style.edge_wear
    return materials


def configure_masonry(material, style):
    nodes, links = material.node_tree.nodes, material.node_tree.links
    nodes.clear()
    output = nodes.new("ShaderNodeOutputMaterial")
    shader = nodes.new("ShaderNodeBsdfPrincipled")
    links.new(shader.outputs["BSDF"], output.inputs["Surface"])
    coordinates, noise = warped_stone_coordinates(nodes, links, style)
    courses = stone_courses(nodes, links, coordinates, style)
    cracks = localized_fractures(nodes, links, coordinates, noise, style)
    shade_and_relieve_stone(nodes, links, shader, courses, cracks, style)


def warped_stone_coordinates(nodes, links, style):
    uv = nodes.new("ShaderNodeTexCoord")
    noise = nodes.new("ShaderNodeTexNoise")
    noise.inputs["Scale"].default_value = 23
    links.new(uv.outputs["UV"], noise.inputs["Vector"])
    scale = nodes.new("ShaderNodeVectorMath")
    scale.operation = "SCALE"
    scale.inputs[3].default_value = style.edge_wear * 4.5
    links.new(noise.outputs["Color"], scale.inputs[0])
    warped = nodes.new("ShaderNodeVectorMath")
    warped.operation = "ADD"
    links.new(uv.outputs["UV"], warped.inputs[0])
    links.new(scale.outputs[0], warped.inputs[1])
    return warped.outputs[0], noise.outputs["Fac"]


def stone_courses(nodes, links, coordinates, style):
    courses = nodes.new("ShaderNodeTexBrick")
    courses.offset = 0.43
    settings = {
        "Scale": 1, "Mortar Size": style.joint_width, "Mortar Smooth": 0.012,
        "Brick Width": 0.20, "Row Height": 0.105,
        "Color1": style.stone_shades[0], "Color2": style.stone_shades[1], "Mortar": style.mortar_color,
    }
    for key, value in settings.items():
        courses.inputs[key].default_value = value
    links.new(coordinates, courses.inputs["Vector"])
    return courses


def localized_fractures(nodes, links, coordinates, noise, style):
    fractures = nodes.new("ShaderNodeTexVoronoi")
    fractures.feature = "DISTANCE_TO_EDGE"
    fractures.inputs["Scale"].default_value = 9
    links.new(coordinates, fractures.inputs["Vector"])
    line = nodes.new("ShaderNodeMapRange")
    line.inputs["From Min"].default_value = style.joint_width * 0.8
    line.inputs["From Max"].default_value = style.joint_width * 5
    line.inputs["To Min"].default_value = 1
    line.inputs["To Max"].default_value = 0
    links.new(fractures.outputs["Distance"], line.inputs["Value"])
    patches = nodes.new("ShaderNodeMath")
    patches.operation = "GREATER_THAN"
    patches.inputs[1].default_value = style.crack_threshold
    links.new(noise, patches.inputs[0])
    cracks = nodes.new("ShaderNodeMath")
    cracks.operation = "MULTIPLY"
    links.new(line.outputs["Result"], cracks.inputs[0])
    links.new(patches.outputs[0], cracks.inputs[1])
    return cracks.outputs[0]


def shade_and_relieve_stone(nodes, links, shader, courses, cracks, style):
    shade = nodes.new("ShaderNodeMixRGB")
    shade.inputs[2].default_value = style.mortar_color
    links.new(cracks, shade.inputs[0])
    links.new(courses.outputs["Color"], shade.inputs[1])
    links.new(shade.outputs[0], shader.inputs["Base Color"])
    height = nodes.new("ShaderNodeMath")
    height.operation = "SUBTRACT"
    height.inputs[0].default_value = 1
    links.new(courses.outputs["Fac"], height.inputs[1])
    damage = nodes.new("ShaderNodeMath")
    damage.operation = "MULTIPLY"
    damage.inputs[1].default_value = style.crack_depth
    links.new(cracks, damage.inputs[0])
    chipped = nodes.new("ShaderNodeMath")
    chipped.operation = "SUBTRACT"
    links.new(height.outputs[0], chipped.inputs[0])
    links.new(damage.outputs[0], chipped.inputs[1])
    bump = nodes.new("ShaderNodeBump")
    bump.inputs["Strength"].default_value = 0.75
    bump.inputs["Distance"].default_value = style.joint_depth
    links.new(chipped.outputs[0], bump.inputs["Height"])
    links.new(bump.outputs["Normal"], shader.inputs["Normal"])
