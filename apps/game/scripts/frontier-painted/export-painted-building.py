"""Export one approved painted Frontier building master as a bounded, baked runtime model.

    blender --background --python-exit-code 1 --python export-painted-building.py -- <master.glb> <source.glb>

The master is the approved high-resolution assembly (Y-up, its front turned to the game camera, origin at the tile's
ground centre). The architecture is decimated to its catalogue budget and repainted into one colour atlas (at its
catalogue size) and one normal map, baked from the full-resolution parts. Parts the game drives stay separate: the ground plate, the tier
banner (its numeral composited into a small texture of its own), the castle's ownership cloth (`orderCloth=banner`,
painted at runtime with the realm's order) and the mill's rotor (a looping quarter turn about its axle). Textures are
written at delivery size; `optimize-outpost.mjs` compresses the result.
"""

import hashlib
import json
import math
import sys
from pathlib import Path

import bmesh
import bpy
import numpy as np
from bpy_extras import anim_utils
from mathutils import Matrix, Quaternion, Vector

CATALOGUE = Path(__file__).resolve().parents[2] / "src/three/structures/frontier-painted-buildings.json"
NORMAL_SIZE = 256
GROUND_SIZE = 512
BAKE_SUPERSAMPLE = 2
# The generated masters carry small open holes; decimation would erode one into a dark slit. A rim shorter than this
# is capped before decimating; larger openings (open bottoms on the ground) stay open.
PINHOLE_PERIMETER = 0.2
# Decimation leaves the master's normals behind: shading is smooth only across creases flatter than this, so a hard
# edge stays hard instead of darkening the faces either side of it.
SMOOTH_ANGLE = math.radians(45)
ROTOR_QUARTER_TURN_SECONDS = 2.5
# The quarter turn as morph targets, one per step: the world map's instancing animates morph weights only, and the
# board plays the same clip. A step of 15 degrees blends with under 1% shrink of the sails mid-step.
ROTOR_TURN_STEPS = 6
# Flags and banners keep their ripple with under a third of the master's cloth grid.
CLOTH_TRIANGLE_RATIO = 0.3
# A tier banner holds one heading in the world whichever way the board turns its building (the runtime counter-turns
# it about its pole): broadside to the camera, flying to screen right. The board turns buildings in sixths of a turn.
BANNER_HEADING = 0.0
BOARD_HEADINGS = 6
POLE_CLEARANCE = 0.03
# The game's banner canvas is 256 by 512 with the order emblem centred 205 px from its top; a flag of this aspect
# samples the band round the emblem, so the emblem keeps its proportions.
ORDER_CANVAS = (256, 512)
ORDER_EMBLEM_CENTRE = 205


def export_building(building, master, output):
    entry = catalogue_entry(building)
    load_master(master)
    parts = classify_parts()
    delivery = build_architecture(parts, entry["architectureTriangles"])
    maps = bake_architecture(delivery, parts, entry["atlasSize"])
    rotor = separate_rotor(delivery) if parts["rotor"] else None
    finish_architecture([delivery, rotor] if rotor else [delivery], maps)
    runtime = [delivery]
    if rotor:
        runtime.append(animate_rotor(rotor))
    if parts["banner_cloth"]:
        runtime.append(build_tier_banner(parts, delivery))
    if parts["order_cloth"]:
        runtime.append(build_order_cloth(parts))
    if parts["ground"]:
        runtime.append(build_ground(parts))
    write_delivery(runtime, building, master, output)


def load_master(master):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=str(master))
    meshes = [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]
    for obj in meshes:
        obj.parent = None
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def classify_parts():
    """Sort the master's parts by what the runtime does with them; back-face liners are dropped (the runtime
    material is double-sided)."""
    parts = {
        key: []
        for key in ("architecture", "leaves", "rotor", "banner_cloth", "banner_pole", "numerals", "order_cloth", "ground")
    }
    for obj in [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]:
        role = obj.get("frontier_part", "")
        if role == "backface-liner":
            bpy.data.objects.remove(obj, do_unlink=True)
        elif role == "ground-skin":
            parts["ground"].append(obj)
        elif role == "plant-leaves":
            parts["leaves"].append(obj)
        elif obj.get("orderCloth"):
            parts["order_cloth"].append(obj)
        elif role == "tier-flag" and obj.name.endswith("-cloth"):
            parts["banner_cloth"].append(obj)
        elif role == "tier-flag" and "-numeral-" in obj.name:
            parts["numerals"].append(obj)
        elif "farm-rotor" in obj.name:
            parts["rotor"].append(obj)
        else:
            parts["architecture"].append(obj)
            if role == "tier-flag" and obj.name.endswith("-pole"):
                parts["banner_pole"].append(obj)
    return parts


def build_architecture(parts, budget):
    """One welded copy of the architecture (and the rotor, separated again after the bake), decimated to budget and
    unwrapped onto a fresh atlas."""
    copies = []
    for obj in parts["architecture"] + parts["rotor"]:
        copy = duplicate(obj)
        copy.data.materials.clear()
        copy.data.materials.append(bake_target_material("rotor" if obj in parts["rotor"] else "architecture"))
        for face in copy.data.polygons:
            face.material_index = 0
        copies.append(copy)
    delivery = join(copies, "architecture")
    weld(delivery)
    close_pinholes(delivery)
    decimate(delivery, budget)
    shade_by_angle(delivery)
    unwrap(delivery)
    return delivery


def bake_architecture(delivery, parts, atlas_size):
    """Colour and normals from the full-resolution parts by ray; leaves paint the planter's plants."""
    configure_bake()
    sources = parts["architecture"] + parts["rotor"] + parts["leaves"]
    maps = {"NORMAL": bake_map(delivery, sources, "NORMAL", NORMAL_SIZE, "Non-Color")}
    strengths = [emission_strength(material) for material in source_materials(sources) if has_emission(material)]
    if strengths:
        with rewired_to_emission(sources, "emissive"):
            maps["EMISSION"] = bake_map(delivery, sources, "EMIT", atlas_size, "sRGB")
        maps["EMISSION_STRENGTH"] = max(strengths)
    with rewired_to_emission(sources, "base"):
        maps["COLOR"] = bake_map(delivery, sources, "EMIT", atlas_size, "sRGB")
    return maps


def finish_architecture(objects, maps):
    """One material for the architecture and the rotor: they share the atlas."""
    material = runtime_material(
        "Painted architecture", maps["COLOR"], maps["NORMAL"], maps.get("EMISSION"), maps.get("EMISSION_STRENGTH", 1.0)
    )
    for obj in objects:
        obj.data.materials.clear()
        obj.data.materials.append(material)
        for face in obj.data.polygons:
            face.material_index = 0
        keep_only_uv_layer(obj, "Atlas")
    objects[0]["frontierPart"] = "architecture"


def separate_rotor(delivery):
    """The rotor's faces (its bake-target material slot) into an object of their own; it keeps its atlas UVs."""
    slot = next(index for index, material in enumerate(delivery.data.materials) if material.name.endswith("rotor"))
    rotor_faces = {face.index for face in delivery.data.polygons if face.material_index == slot}
    bm = bmesh.new()
    bm.from_mesh(delivery.data)
    bm.faces.ensure_lookup_table()
    rotor_bm = bm.copy()
    rotor_bm.faces.ensure_lookup_table()
    bmesh.ops.delete(rotor_bm, geom=[f for f in rotor_bm.faces if f.index not in rotor_faces], context="FACES")
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.index in rotor_faces], context="FACES")
    bm.to_mesh(delivery.data)
    bm.free()
    mesh = bpy.data.meshes.new("rotor")
    rotor_bm.to_mesh(mesh)
    rotor_bm.free()
    rotor = bpy.data.objects.new("rotor", mesh)
    bpy.context.scene.collection.objects.link(rotor)
    return rotor


def animate_rotor(rotor):
    """Turn the rotor a quarter about its axle, step by step through morph targets in model space (the instancing
    path draws a part's geometry without its node transform): its four equal sails make the loop seamless."""
    hub, axle = rotor_axis(rotor)
    rotor.shape_key_add(name="rest", from_mix=False)
    rest = [vertex.co.copy() for vertex in rotor.data.vertices]
    targets = []
    for step in range(1, ROTOR_TURN_STEPS + 1):
        target = rotor.shape_key_add(name=f"turn {step}", from_mix=False)
        turn = Quaternion(axle, step * math.pi / 2 / ROTOR_TURN_STEPS).to_matrix()
        for index, point in enumerate(rest):
            target.data[index].co = hub + turn @ (point - hub)
        targets.append(target)
    key_turn_steps(rotor, targets)
    rotor["frontierPart"] = "rotor"
    return rotor


def key_turn_steps(rotor, targets):
    """One step at full weight at each key, linear between: constant speed through the loop."""
    frames = ROTOR_QUARTER_TURN_SECONDS * bpy.context.scene.render.fps
    for step in range(len(targets) + 1):
        frame = 1 + round(step * frames / len(targets))
        for index, target in enumerate(targets, start=1):
            target.value = 1.0 if index == step else 0.0
            target.keyframe_insert("value", frame=frame)
    animation = rotor.data.shape_keys.animation_data
    animation.action.name = "rotor"
    # Keys come in eased, which would stop the sails at every step.
    for curve in anim_utils.action_get_channelbag_for_slot(animation.action, animation.action_slot).fcurves:
        for key in curve.keyframe_points:
            key.interpolation = "LINEAR"


def build_tier_banner(parts, architecture):
    """The tier banner's cloth with its numeral composited into its texture; its far side samples the texture
    mirrored, so the numeral reads the right way round from either side. It is turned about its pole to the set's
    held heading, and records that pole for the runtime that keeps it there."""
    banner = join([duplicate(obj) for obj in parts["banner_cloth"]], "tier-banner")
    decimate(banner, round(triangle_count(banner) * CLOTH_TRIANGLE_RATIO))
    front = front_direction(parts["numerals"])
    texture = composite_banner_texture(parts["banner_cloth"][0], parts["numerals"])
    mirror_far_side(banner, front)
    pole = pole_axis(parts["banner_pole"][0])
    turn_about_pole(banner, pole, BANNER_HEADING - heading_of(banner, pole))
    require_clear_at_every_heading(banner, architecture, pole)
    # model space as the runtime reads it: Y up, so the master's Y becomes -Z
    banner["poleAxis"] = [round(pole.x, 5), round(-pole.y, 5)]
    banner.data.materials.clear()
    banner.data.materials.append(runtime_material("Tier banner", texture))
    keep_only_uv_layer(banner, banner.data.uv_layers.active.name)
    banner["frontierPart"] = "tier-banner"
    return banner


def build_order_cloth(parts):
    """Every castle flag in one ownership cloth: the runtime paints the order's banner onto it. Each flag spans the
    canvas's width from its pole and the band round the emblem in height; its far side is mirrored."""
    cloth = join([duplicate(obj) for obj in parts["order_cloth"]], "order-cloth")
    decimate(cloth, round(triangle_count(cloth) * CLOTH_TRIANGLE_RATIO))
    aspect = flag_aspect(parts["order_cloth"][0])
    band = ORDER_CANVAS[0] / aspect / ORDER_CANVAS[1]
    centre = 1 - ORDER_EMBLEM_CENTRE / ORDER_CANVAS[1]
    layer = cloth.data.uv_layers.active
    for loop in layer.data:
        loop.uv = (loop.uv[0], centre + (loop.uv[1] - 0.5) * band)
    mirror_far_side(cloth, Vector((0, -1, 0)))
    cloth.data.materials.clear()
    cloth.data.materials.append(runtime_material("Order cloth", order_cloth_texture(parts["order_cloth"][0])))
    keep_only_uv_layer(cloth, layer.name)
    cloth["orderCloth"] = "banner"
    cloth["orderUvConvention"] = "Each flag spans u 0..1 from its pole and the emblem band in v; its far side is mirrored"
    cloth["frontierPart"] = "order-cloth"
    return cloth


def build_ground(parts):
    ground = join([duplicate(obj) for obj in parts["ground"]], "ground")
    image = first_image(parts["ground"][0])
    texture = resized_copy(image, GROUND_SIZE, GROUND_SIZE, "ground")
    ground.data.materials.clear()
    ground.data.materials.append(runtime_material("Ground plate", texture))
    keep_only_uv_layer(ground, ground.data.uv_layers.active.name)
    ground["frontierPart"] = "ground"
    return ground


def write_delivery(runtime, building, master, output):
    runtime[0]["masterSha256"] = hashlib.sha256(master.read_bytes()).hexdigest()
    runtime[0]["frontierBuilding"] = building
    for obj in bpy.context.scene.objects:
        obj.select_set(obj in runtime)
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        use_selection=True,
        export_yup=True,
        export_extras=True,
        export_apply=True,
        export_animations=any(obj.data.shape_keys for obj in runtime),
        export_morph_normal=False,
        export_cameras=False,
        export_lights=False,
    )
    print(
        json.dumps(
            {
                "building": building,
                "triangles": {obj.name: triangle_count(obj) for obj in runtime},
                "bytes": output.stat().st_size,
            }
        )
    )


# ---------------------------------------------------------------------------------------------------------- geometry


def join(objects, name):
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    if len(objects) > 1:
        bpy.ops.object.join()
    joined = bpy.context.view_layer.objects.active
    joined.name = name
    joined.data.name = name
    for key in list(joined.keys()):
        del joined[key]
    return joined


def duplicate(obj):
    copy = obj.copy()
    copy.data = obj.data.copy()
    bpy.context.scene.collection.objects.link(copy)
    return copy


def weld(obj):
    """The master splits vertices along its UV seams; welded, a seam cannot open into a crack as decimation runs."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(obj.data)
    bm.free()


def close_pinholes(obj):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    for rim in boundary_rims(bm):
        if sum(edge.calc_length() for edge in rim) < PINHOLE_PERIMETER:
            bmesh.ops.holes_fill(bm, edges=rim, sides=0)
    bm.to_mesh(obj.data)
    bm.free()


def boundary_rims(bm):
    """The open edges, grouped into the rims they form."""
    unvisited = {edge for edge in bm.edges if edge.is_boundary}
    rims = []
    while unvisited:
        rim, stack = [], [unvisited.pop()]
        while stack:
            edge = stack.pop()
            rim.append(edge)
            for vertex in edge.verts:
                for neighbour in vertex.link_edges:
                    if neighbour in unvisited:
                        unvisited.remove(neighbour)
                        stack.append(neighbour)
        rims.append(rim)
    return rims


def decimate(obj, budget):
    triangles = triangle_count(obj)
    if triangles <= budget:
        return
    modifier = obj.modifiers.new("Delivery topology", "DECIMATE")
    modifier.ratio = budget / triangles
    modifier.use_collapse_triangulate = True
    make_active(obj)
    bpy.ops.object.modifier_apply(modifier=modifier.name)
    # A collapse can leave a face doubling another; drop it now rather than in the glTF exporter, after the bake.
    obj.data.validate()


def shade_by_angle(obj):
    make_active(obj)
    if obj.data.has_custom_normals:
        bpy.ops.mesh.customdata_custom_splitnormals_clear()
    obj.data.shade_smooth()
    obj.data.set_sharp_from_angle(angle=SMOOTH_ANGLE)


def make_active(obj):
    bpy.ops.object.select_all(action="DESELECT")
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj


def unwrap(obj):
    layer = obj.data.uv_layers.new(name="Atlas")
    obj.data.uv_layers.active = layer
    make_active(obj)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.004)
    bpy.ops.object.mode_set(mode="OBJECT")


def rotor_axis(rotor):
    """The hub is the rotor's centroid (its sails are four-fold symmetric about the axle); the axle is the direction
    the sails spread least along."""
    points = np.array([vertex.co[:] for vertex in rotor.data.vertices])
    centre = points.mean(axis=0)
    _, vectors = np.linalg.eigh(np.cov((points - centre).T))
    axle = Vector(vectors[:, 0]).normalized()
    if axle.dot(Vector((0, -1, 0))) < 0:
        axle = -axle
    return Vector(centre), axle


def mirror_far_side(obj, front):
    """Faces turned away from the front sample the texture mirrored left to right."""
    layer = obj.data.uv_layers.active
    for face in obj.data.polygons:
        if face.normal.dot(front) < 0:
            for loop_index in face.loop_indices:
                u, v = layer.data[loop_index].uv
                layer.data[loop_index].uv = (1 - u, v)


def pole_axis(pole):
    points = [vertex.co for vertex in pole.data.vertices]
    return Vector((sum(p.x for p in points) / len(points), sum(p.y for p in points) / len(points), 0.0))


def heading_of(cloth, pole):
    """The way the cloth flies from its pole, as an angle about the vertical axis."""
    points = [vertex.co for vertex in cloth.data.vertices]
    centre = sum(points, Vector()) / len(points)
    return math.atan2(centre.y - pole.y, centre.x - pole.x)


def turn_about_pole(obj, pole, angle):
    obj.data.transform(Matrix.Translation(pole) @ Matrix.Rotation(angle, 4, "Z") @ Matrix.Translation(-pole))


def require_clear_at_every_heading(banner, architecture, pole):
    """A held banner swings about its pole relative to its building as the board turns it: at none of the board's
    headings may it meet the building (its own pole, which its sleeve wraps, aside)."""
    from mathutils.bvhtree import BVHTree

    faces = [face.vertices for face in architecture.data.polygons if (face.center - pole).xy.length > POLE_CLEARANCE]
    building = BVHTree.FromPolygons([vertex.co for vertex in architecture.data.vertices], faces)
    for step in range(BOARD_HEADINGS):
        turn = Matrix.Translation(pole) @ Matrix.Rotation(2 * math.pi * step / BOARD_HEADINGS, 4, "Z") @ Matrix.Translation(-pole)
        cloth = BVHTree.FromPolygons([turn @ vertex.co for vertex in banner.data.vertices], [f.vertices for f in banner.data.polygons])
        if cloth.overlap(building):
            raise ValueError(f"The held banner meets its building at board heading {step}")


def front_direction(numerals):
    front = [obj for obj in numerals if obj.name.endswith("-front")]
    normal = sum((face.normal for face in front[0].data.polygons), Vector()) if front else Vector((0, -1, 0))
    return normal.normalized()


def flag_aspect(cloth):
    """Width along the flag's fly over its height."""
    points = np.array([vertex.co[:] for vertex in cloth.data.vertices])
    horizontal = points[:, :2] - points[:, :2].mean(axis=0)
    _, vectors = np.linalg.eigh(np.cov(horizontal.T))
    width = np.ptp(horizontal @ vectors[:, 1])
    return width / np.ptp(points[:, 2])


def triangle_count(obj):
    return sum(len(face.vertices) - 2 for face in obj.data.polygons)


def catalogue_entry(building):
    """The building's triangle budget and atlas size, from the set's catalogue (the asset gate reads the same)."""
    entries = json.loads(CATALOGUE.read_text())
    entry = next((entry for entry in entries if entry["id"] == building), None)
    if entry is None:
        raise ValueError(f"{building} is not in the painted building catalogue")
    return entry


def keep_only_uv_layer(obj, name):
    for layer in list(obj.data.uv_layers):
        if layer.name != name:
            obj.data.uv_layers.remove(layer)
    for attribute in list(obj.data.color_attributes):
        obj.data.color_attributes.remove(attribute)


# ------------------------------------------------------------------------------------------------------------ baking


def configure_bake():
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 4
    bake = scene.render.bake
    bake.use_selected_to_active = True
    bake.cage_extrusion = 0.012
    bake.max_ray_distance = 0.04
    bake.margin = 8
    bake.normal_space = "TANGENT"


def bake_map(delivery, sources, kind, size, colorspace):
    """One map, baked at twice the delivery size and scaled down."""
    image = bpy.data.images.new(f"{delivery.name} {kind}", size * BAKE_SUPERSAMPLE, size * BAKE_SUPERSAMPLE, alpha=False)
    image.colorspace_settings.name = colorspace
    for material in delivery.data.materials:
        nodes = material.node_tree.nodes
        target = next((node for node in nodes if node.type == "TEX_IMAGE"), None) or nodes.new("ShaderNodeTexImage")
        target.image = image
        nodes.active = target
    bpy.ops.object.select_all(action="DESELECT")
    for obj in sources:
        obj.select_set(True)
    delivery.select_set(True)
    bpy.context.view_layer.objects.active = delivery
    bpy.ops.object.bake(type=kind)
    image.scale(size, size)
    image.pack()
    return image


def source_materials(sources):
    return {slot.material for obj in sources for slot in obj.material_slots if slot.material}


def emission_strength(material):
    return principled(material).inputs["Emission Strength"].default_value


def has_emission(material):
    shader = principled(material)
    return bool(shader and (shader.inputs["Emission Color"].is_linked and shader.inputs["Emission Strength"].default_value > 0))


class rewired_to_emission:
    """Temporarily route each source material's base colour (or emissive colour) to an Emission output, so EMIT bakes
    the albedo exactly, unlit and regardless of metalness."""

    def __init__(self, sources, channel):
        self.materials = source_materials(sources)
        self.channel = channel
        self.restore = []

    def __enter__(self):
        for material in self.materials:
            tree = material.node_tree
            output = next((node for node in tree.nodes if node.type == "OUTPUT_MATERIAL"), None)
            if output is None:
                continue
            previous = output.inputs["Surface"].links[0].from_socket if output.inputs["Surface"].is_linked else None
            emission = tree.nodes.new("ShaderNodeEmission")
            source = channel_socket(material, self.channel)
            if isinstance(source, tuple):
                emission.inputs["Color"].default_value = source
            elif source is not None:
                tree.links.new(source, emission.inputs["Color"])
            tree.links.new(emission.outputs["Emission"], output.inputs["Surface"])
            self.restore.append((tree, output, previous, emission))
        return self

    def __exit__(self, *exc):
        for tree, output, previous, emission in self.restore:
            if previous is not None:
                tree.links.new(previous, output.inputs["Surface"])
            tree.nodes.remove(emission)
        return False


def channel_socket(material, channel):
    shader = principled(material)
    if shader is None:
        return tuple(material.diffuse_color) if channel == "base" else (0.0, 0.0, 0.0, 1.0)
    socket = shader.inputs["Base Color" if channel == "base" else "Emission Color"]
    if socket.is_linked:
        return socket.links[0].from_socket
    if channel == "emissive":
        return (0.0, 0.0, 0.0, 1.0)
    return tuple(socket.default_value)


def principled(material):
    if not material.use_nodes:
        return None
    return next((node for node in material.node_tree.nodes if node.type == "BSDF_PRINCIPLED"), None)


# --------------------------------------------------------------------------------------------------------- materials


def bake_target_material(role):
    material = bpy.data.materials.get(f"bake target {role}") or bpy.data.materials.new(f"bake target {role}")
    material.use_nodes = True
    return material


def runtime_material(name, color, normal=None, emission=None, emission_strength=1.0):
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.use_backface_culling = False
    tree = material.node_tree
    shader = principled(material)
    shader.inputs["Roughness"].default_value = 0.85
    shader.inputs["Metallic"].default_value = 0.0
    color_node = tree.nodes.new("ShaderNodeTexImage")
    color_node.image = color
    tree.links.new(color_node.outputs["Color"], shader.inputs["Base Color"])
    if normal is not None:
        normal_node = tree.nodes.new("ShaderNodeTexImage")
        normal_node.image = normal
        normal_map = tree.nodes.new("ShaderNodeNormalMap")
        tree.links.new(normal_node.outputs["Color"], normal_map.inputs["Color"])
        tree.links.new(normal_map.outputs["Normal"], shader.inputs["Normal"])
    if emission is not None:
        emission_node = tree.nodes.new("ShaderNodeTexImage")
        emission_node.image = emission
        tree.links.new(emission_node.outputs["Color"], shader.inputs["Emission Color"])
        shader.inputs["Emission Strength"].default_value = emission_strength
    return material


# ---------------------------------------------------------------------------------------------------------- textures


def first_image(obj):
    for slot in obj.material_slots:
        if slot.material and slot.material.use_nodes:
            for node in slot.material.node_tree.nodes:
                if node.type == "TEX_IMAGE" and node.image:
                    return node.image
    raise ValueError(f"{obj.name} has no texture")


def material_factor(obj):
    """A cloth's colour factor (the MULTIPLY mix behind its base colour), or white."""
    for slot in obj.material_slots:
        if not (slot.material and slot.material.use_nodes):
            continue
        for node in slot.material.node_tree.nodes:
            if node.type == "MIX" and node.blend_type == "MULTIPLY":
                return np.array(node.inputs["B"].default_value[:3]) if not node.inputs["B"].is_linked else np.ones(3)
    return np.ones(3)


def pixels(image):
    width, height = image.size
    data = np.empty(width * height * 4, dtype=np.float32)
    image.pixels.foreach_get(data)
    return data.reshape(height, width, 4)


def image_from(array, name):
    height, width = array.shape[:2]
    image = bpy.data.images.new(name, width, height, alpha=False)
    image.pixels.foreach_set(np.ascontiguousarray(array, dtype=np.float32).ravel())
    image.pack()
    return image


def resized_copy(image, width, height, name):
    copy = image.copy()
    copy.name = name
    copy.scale(width, height)
    copy.pack()
    return copy


def composite_banner_texture(cloth, numerals):
    """Weave times the cloth's colour, with the numeral decal laid over the square it covers on the cloth; front on
    the left half, back (mirrored) on the right."""
    weave = resample(pixels(first_image(cloth)), 256, 256)
    weave[..., :3] = linear_to_srgb(srgb_to_linear(weave[..., :3]) * material_factor(cloth))
    front = [obj for obj in numerals if obj.name.endswith("-front")]
    if front:
        u0, u1, v0, v1 = decal_rectangle(cloth, front[0])
        weave = overlay(weave, pixels(first_image(front[0])), u0, u1, v0, v1)
    return image_from(weave, "tier banner")


def decal_rectangle(cloth, decal):
    """Where the decal sits in the cloth's UV space: the cloth's UVs interpolated at the points nearest the decal's
    corners."""
    from mathutils.bvhtree import BVHTree
    from mathutils.interpolate import poly_3d_calc

    tree = BVHTree.FromObject(cloth, bpy.context.evaluated_depsgraph_get())
    layer, decal_layer = cloth.data.uv_layers.active, decal.data.uv_layers.active
    corners = []
    for loop in decal.data.loops:
        u, v = decal_layer.data[loop.index].uv
        if min(abs(u), abs(1 - u)) > 1e-4 or min(abs(v), abs(1 - v)) > 1e-4:
            continue
        location, _, index, _ = tree.find_nearest(decal.data.vertices[loop.vertex_index].co)
        face = cloth.data.polygons[index]
        weights = poly_3d_calc([cloth.data.vertices[i].co for i in face.vertices], location)
        corners.append(sum((Vector(layer.data[i].uv) * w for i, w in zip(face.loop_indices, weights)), Vector((0, 0))))
    corners = np.array(corners)
    return corners[:, 0].min(), corners[:, 0].max(), corners[:, 1].min(), corners[:, 1].max()


def overlay(base, decal, u0, u1, v0, v1):
    height, width = base.shape[:2]
    x0, x1 = int(round(u0 * width)), int(round(u1 * width))
    y0, y1 = int(round(v0 * height)), int(round(v1 * height))
    patch = resample(decal, x1 - x0, y1 - y0)
    alpha = patch[..., 3:4]
    region = base[y0:y1, x0:x1]
    region[..., :3] = region[..., :3] * (1 - alpha) + patch[..., :3] * alpha
    return base


def order_cloth_texture(cloth):
    """The cloth as the review saw it (weave times its red), for views without the runtime's order painting."""
    weave = resample(pixels(first_image(cloth)), 128, 256)
    weave[..., :3] = linear_to_srgb(srgb_to_linear(weave[..., :3]) * material_factor(cloth))
    return image_from(weave, "order cloth")


def resample(array, width, height):
    """Nearest-neighbour resample of an image array (row 0 at the bottom, as Blender stores pixels)."""
    rows = (np.arange(height) * array.shape[0] / height).astype(int)
    cols = (np.arange(width) * array.shape[1] / width).astype(int)
    return array[rows][:, cols].copy()


def srgb_to_linear(values):
    return np.where(values <= 0.04045, values / 12.92, ((values + 0.055) / 1.055) ** 2.4)


def linear_to_srgb(values):
    values = np.clip(values, 0, 1)
    return np.where(values <= 0.0031308, values * 12.92, 1.055 * values ** (1 / 2.4) - 0.055)


if __name__ == "__main__":
    master, output = map(Path, sys.argv[sys.argv.index("--") + 1 :])
    export_building(output.stem, master, output)
