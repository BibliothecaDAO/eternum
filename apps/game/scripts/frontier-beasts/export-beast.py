"""Export a saved creature sculpt through a bounded mesh and painted color/normal bake."""
import hashlib
import json
import math
import sys
from pathlib import Path
import bpy

source, output = map(Path, sys.argv[sys.argv.index("--")+1:])
bpy.ops.wm.open_mainfile(filepath=str(source))
scene = bpy.context.scene
scene.render.engine = "CYCLES"
scene.cycles.samples = 16
scene.render.threads_mode = "FIXED"
scene.render.threads = 2
objects = [o for o in scene.objects if o.type == "MESH"]
if len(objects) != 1:
    raise ValueError("Export requires one connected sculpt with its facial details")
obj = objects[0]
bpy.context.view_layer.objects.active = obj
obj.select_set(True)
triangles = sum(len(p.vertices)-2 for p in obj.data.polygons)
if triangles > 18000:
    decimate = obj.modifiers.new("Delivery topology", "DECIMATE")
    decimate.ratio = 18000 / triangles
    bpy.ops.object.modifier_apply(modifier=decimate.name)
# Keep the same world-scale footprint as the shipped beasts.
for v in obj.data.vertices:
    v.co *= .8
    if v.co.z < 0 or any(v.co.x*math.cos(i*math.pi/3)+v.co.y*math.sin(i*math.pi/3) > math.sqrt(3)/2 for i in range(6)):
        raise ValueError("Creature leaves its radius-one hex")
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.uv.smart_project(angle_limit=1.15, island_margin=.018)
bpy.ops.object.mode_set(mode="OBJECT")
scene.render.bake.margin = 6
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
images = {}
for kind in ["DIFFUSE", "NORMAL"]:
    image = bpy.data.images.new(source.stem+" "+kind, width=512, height=512, alpha=False)
    if kind == "NORMAL": image.colorspace_settings.name = "Non-Color"
    for material in obj.data.materials:
        nodes = material.node_tree.nodes
        target = nodes.new("ShaderNodeTexImage")
        target.image = image
        nodes.active = target
    bpy.ops.object.bake(type=kind)
    image.pack()
    images[kind] = image
mat = bpy.data.materials.new("Painted hide with baked contact and normals")
mat.use_nodes = True
nodes, links = mat.node_tree.nodes, mat.node_tree.links
shader = nodes.get("Principled BSDF")
shader.inputs["Roughness"].default_value = .85
color = nodes.new("ShaderNodeTexImage"); color.image = images["DIFFUSE"]
normal = nodes.new("ShaderNodeTexImage"); normal.image = images["NORMAL"]
normalmap = nodes.new("ShaderNodeNormalMap")
links.new(color.outputs["Color"], shader.inputs["Base Color"])
links.new(normal.outputs["Color"], normalmap.inputs["Color"])
links.new(normalmap.outputs["Normal"], shader.inputs["Normal"])
obj.data.materials.clear()
obj.data.materials.append(mat)
for face in obj.data.polygons: face.material_index = 0
obj["sourceSha256"] = hashlib.sha256(source.read_bytes()).hexdigest()
obj["species"] = source.stem
output.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.export_scene.gltf(filepath=str(output), export_format="GLB", use_selection=True,
    export_yup=True, export_extras=True, export_animations=False, export_cameras=False, export_lights=False)
print(json.dumps({"species":source.stem,"triangles":sum(len(p.vertices)-2 for p in obj.data.polygons),"bytes":output.stat().st_size}))
