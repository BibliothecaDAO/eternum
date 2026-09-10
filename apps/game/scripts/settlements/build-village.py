"""Build a palisaded village of small huts with relationship banners.

Run with Blender --background --python apps/game/scripts/settlements/build-village.py.
Then: node apps/game/scripts/compress-models.mjs --only settlements/village-draft.glb
Geometry uses Z-up, entrance toward -Y. Exported mesh transforms are baked for
the terrain lab's instanced renderer. No biome or ground plate belongs here.
"""

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[4]
OUTPUT = ROOT / "apps/game/public/models/settlements/village-draft.glb"
SOURCE = ROOT / ".context/graphics-lab/realm-progression/village-draft"


def build_village():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    materials = create_materials()
    build_hut_cluster(materials)
    build_fence(materials)
    build_supplies(materials)
    build_campfire(materials)
    build_banner(materials)
    save_asset()


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


def create_materials():
    return {
        "wood": material("Weathered oak", (0.24, 0.115, 0.042)),
        "roof": material("Warm hide roofing", (0.235, 0.112, 0.043)),
        "roof_light": material("Sun faded hide roofing", (0.285, 0.15, 0.068)),
        "roof_dark": material("Dark hide roofing", (0.18, 0.075, 0.028)),
        "awning": material("Settlement entrance cloth", (0.40, 0.030, 0.020)),
        "frame": material("Dark timber frame", (0.085, 0.044, 0.025)),
        "stone": material("Fire ring stone", (0.19, 0.18, 0.16)),
        "charcoal": material("Charred firewood", (0.035, 0.023, 0.015)),
        "ember": glowing_material("Glowing embers", (0.7, 0.055, 0.003), 2),
        "flame": glowing_material("Amber flame", (1.0, 0.20, 0.008), 2.5),
        "flame_core": glowing_material("Golden flame heart", (1.0, 0.62, 0.08), 3),
        "iron": material("Blackened iron", (0.075, 0.085, 0.085), 0.65),
        "banner": material("Red village banner", (0.40, 0.030, 0.020)),
    }


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


def build_hut_cluster(m):
    """Five peer dwellings face the courtyard and leave the gate approach clear."""
    huts = [
        (-0.35, 0.34, 0.18, "roof"),
        (0.04, 0.39, 0.18, "roof_light"),
        (0.40, 0.24, 0.17, "roof"),
        (-0.40, -0.18, 0.18, "roof_dark"),
        (0.39, -0.23, 0.18, "roof_light"),
    ]
    for x, y, radius, roof in huts:
        facing = math.atan2(-0.05 - y, -x)
        build_hut_walls(m, x, y, radius, facing)
        build_hut_roof(m[roof], x, y, radius, facing)
        build_hut_door_cloth(m, x, y, radius, facing)


def hut_point(x, y, radius, angle, height):
    return (x + radius * math.cos(angle), y + radius * math.sin(angle), height)


def build_hut_walls(m, x, y, radius, facing):
    sides = 12
    wall_radius = radius * 0.82
    # The missing front panel is the actual doorway, opening onto the courtyard.
    for side in range(1, sides):
        a = facing + (side - 0.5) * math.tau / sides
        b = a + math.tau / sides
        mesh(
            "Hut timber wall",
            [
                hut_point(x, y, wall_radius, angle, z)
                for angle, z in [(a, 0), (b, 0), (b, 0.18), (a, 0.18)]
            ],
            [(0, 1, 2, 3)],
            m["wood"],
            thickness=0.008,
        )
        beam(
            "Hut wall upright",
            hut_point(x, y, wall_radius, a, 0),
            hut_point(x, y, wall_radius, a, 0.18),
            0.008,
            m["frame"],
            5,
        )
    for side in [-1, 1]:
        angle = facing + side * math.pi / sides
        beam(
            "Door jamb",
            hut_point(x, y, wall_radius, angle, 0),
            hut_point(x, y, wall_radius, angle, 0.18),
            0.012,
            m["frame"],
            6,
        )


def build_hut_roof(mat, x, y, radius, facing):
    # Three broad overlapping hide courses read as a simple cone at map scale.
    sides = 12
    peak, eave = 0.43, 0.16
    for course in range(3):
        upper = course / 3
        lower = min(1.04, (course + 1) / 3 + 0.035)
        vertices = [
            hut_point(
                x,
                y,
                radius * t,
                facing + (side - 0.5) * math.tau / sides,
                peak - (peak - eave) * t + 0.005 * course,
            )
            for t in [upper, lower]
            for side in range(sides)
        ]
        if course == 0:
            vertices = [vertices[0], *vertices[sides:]]
            faces = [(0, i + 1, (i + 1) % sides + 1) for i in range(sides)]
        else:
            faces = [
                (i, i + sides, (i + 1) % sides + sides, (i + 1) % sides)
                for i in range(sides)
            ]
        mesh("Layered conical hide roof", vertices, faces, mat, thickness=0.004)


def build_hut_door_cloth(m, x, y, radius, facing):
    # Small entrance valances carry relationship color without adding another large roof.
    forward = Vector((math.cos(facing), math.sin(facing), 0))
    right = Vector((-math.sin(facing), math.cos(facing), 0))
    center = Vector((x, y, 0.18)) + forward * radius * 0.85
    vertices = [
        tuple(center + right * u + forward * depth + Vector((0, 0, z)))
        for u, depth, z in [
            (-0.052, 0, 0),
            (0.052, 0, 0),
            (0.065, 0.045, -0.03),
            (-0.065, 0.045, -0.03),
        ]
    ]
    cloth = mesh(
        "HutRelationshipCloth", vertices, [(0, 1, 2, 3)], m["awning"], thickness=0.003
    )
    cloth["relationshipCloth"] = True


def build_fence(m):
    """Angular defensive enclosure with a wide, unobstructed southern entrance."""
    corners = [
        (-0.25, -0.62),
        (-0.64, -0.44),
        (-0.70, 0.20),
        (-0.45, 0.65),
        (0.45, 0.65),
        (0.70, 0.20),
        (0.64, -0.44),
        (0.25, -0.62),
    ]
    for start, end in zip(corners, corners[1:]):
        count = max(2, round(math.dist(start, end) / 0.075))
        height = 0.25
        for i in range(count):
            t = i / count
            x = start[0] + (end[0] - start[0]) * t
            y = start[1] + (end[1] - start[1]) * t
            if (x, y) != corners[0]:
                build_stake(m, x, y, height)
        for z in [0.055, height * 0.65]:
            beam("Palisade cross rail", (*start, z), (*end, z), 0.014, m["frame"], 6)
    for x in [-0.25, 0.25]:
        build_stake(m, x, -0.62, 0.35, radius=0.038)
        for z in [0.09, 0.23]:
            beam(
                "Gate iron band", (x, -0.62, z), (x, -0.62, z + 0.025), 0.041, m["iron"]
            )


def build_stake(m, x, y, height, radius=0.028):
    beam("Palisade timber", (x, y, 0), (x, y, height - 0.075), radius, m["wood"], 6)
    bpy.ops.mesh.primitive_cone_add(
        vertices=6,
        radius1=radius,
        radius2=0,
        depth=0.075,
        location=(x, y, height - 0.0375),
    )
    bpy.context.object.name = "Sharpened palisade tip"
    bpy.context.object.data.materials.append(m["wood"])


def build_supplies(m):
    # One deliberate supply cluster; the approach and central muster yard stay empty.
    for x, y, size in [(-0.51, 0.07, 0.09), (-0.49, -0.025, 0.07)]:
        block("Supply crate", (x, y, size / 2), (size, size, size), m["wood"])
        for offset in [-size * 0.3, size * 0.3]:
            block(
                "Crate strap", (x + offset, y, size), (0.012, size, 0.008), m["iron"], 0
            )


def build_campfire(m):
    """A raised stone hearth occupies the yard without covering its native ground."""
    for i in range(10):
        angle = i * math.tau / 10
        stone = block(
            "Hearth stone",
            (0.145 * math.cos(angle), -0.07 + 0.145 * math.sin(angle), 0.025),
            (0.075, 0.05, 0.05),
            m["stone"],
            bevel=0.012,
        )
        stone.rotation_euler.z = angle + math.pi / 2
    for i in range(3):
        angle = i * math.pi / 3
        dx, dy = 0.12 * math.cos(angle), 0.12 * math.sin(angle)
        beam(
            "Charred stacked log",
            (-dx, -0.07 - dy, 0.035 + i * 0.013),
            (dx, -0.07 + dy, 0.035 + i * 0.013),
            0.023,
            m["charcoal"],
            7,
        )
    for i in range(7):
        angle = i * math.tau / 7
        block(
            "Hot ember",
            (0.065 * math.cos(angle), -0.07 + 0.065 * math.sin(angle), 0.052),
            (0.035, 0.026, 0.012),
            m["ember"],
            bevel=0.004,
        )
    for x, y, radius, height in [
        (0, -0.07, 0.075, 0.29),
        (-0.065, -0.055, 0.04, 0.21),
        (0.06, -0.09, 0.04, 0.23),
    ]:
        build_flame(m["flame"], x, y, radius, height)
    build_flame(m["flame_core"], 0, -0.105, 0.047, 0.17)


def build_flame(mat, x, y, radius, height):
    sides = 7
    vertices = [
        (
            x + radius * scale * math.cos(i * math.tau / sides) + bend,
            y + radius * scale * math.sin(i * math.tau / sides),
            0.055 + height * t,
        )
        for t, scale, bend in [(0, 0.65, 0), (0.3, 1, 0), (0.65, 0.5, 0.012)]
        for i in range(sides)
    ]
    vertices.append((x - 0.018, y, 0.055 + height))
    faces = [
        (
            row * sides + i,
            row * sides + (i + 1) % sides,
            (row + 1) * sides + (i + 1) % sides,
            (row + 1) * sides + i,
        )
        for row in range(2)
        for i in range(sides)
    ]
    faces.extend(
        (2 * sides + i, 2 * sides + (i + 1) % sides, 3 * sides) for i in range(sides)
    )
    flame = mesh("Campfire flame", vertices, faces, mat)
    flame["settlementMotion"] = "flame"


def build_banner(m):
    x, y = 0.47, 0.49
    beam("Banner pole", (x, y, 0.02), (x, y, 0.90), 0.012, m["wood"])
    beam(
        "Banner crossbar", (x - 0.025, y, 0.865), (x + 0.19, y, 0.865), 0.009, m["wood"]
    )
    vertices, uv = [], []
    for row in range(9):
        v = row / 8
        for col in range(9):
            u = col / 8
            vertices.append(
                (
                    x + 0.012 + u * 0.15,
                    y - 0.014 + 0.012 * math.sin(u * math.tau + v * 2),
                    0.855 - v * 0.29 + 0.04 * abs(2 * u - 1) * v**6,
                )
            )
            uv.append((u, 1 - v))
    faces = [
        (j * 9 + i, (j + 1) * 9 + i, (j + 1) * 9 + i + 1, j * 9 + i + 1)
        for j in range(8)
        for i in range(8)
    ]
    banner = mesh("VillageBanner", vertices, faces, m["banner"], uv, thickness=0.0015)
    banner["relationshipCloth"] = True
    banner["settlementMotion"] = "banner"


def save_asset():
    SOURCE.mkdir(parents=True, exist_ok=True)
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    bake_instance_transforms()
    bpy.ops.wm.save_as_mainfile(filepath=str(SOURCE / "village-draft.blend"))
    consolidate_static_materials()
    export_glb()
    write_asset_report()


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


def export_glb():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(
        filepath=str(OUTPUT),
        export_format="GLB",
        use_selection=True,
        export_extras=True,
        export_yup=True,
    )


def write_asset_report():
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
        "sourceConcept": "User palisade reference; five small conical huts, uniform palisade, open yard, no ground mesh",
        "sizeBlenderXYZ": [round(b - a, 4) for a, b in bounds],
        "triangles": triangles,
        "meshCount": len(meshes),
        "uncompressedBytes": OUTPUT.stat().st_size,
        "groundMesh": False,
        "animation": "Runtime wind banner and flickering campfire",
        "relationshipBanner": "VillageBanner",
    }
    (SOURCE / "report.json").write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report))


if __name__ == "__main__":
    build_village()
