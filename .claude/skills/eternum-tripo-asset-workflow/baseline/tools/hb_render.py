"""Neutral review renders (EEVEE, orthographic; HB_ENGINE=CYCLES for CPU rendering without a graphics context) shared by
all stages."""
import bpy, math, os
from mathutils import Vector, Matrix

def setup_scene(res=1000):
    sc = bpy.context.scene
    if os.environ.get("HB_ENGINE", "").upper() == "CYCLES":
        # CPU path tracing: needs no graphics context. EEVEE crashes in background mode when Windows cannot give Blender
        # an OpenGL context (screen locked or asleep, display driver reset); set HB_ENGINE=CYCLES then.
        sc.render.engine = "CYCLES"; sc.cycles.device = "CPU"; sc.cycles.samples = int(os.environ.get("HB_SAMPLES", "6")); sc.cycles.use_adaptive_sampling = False
        sc.cycles.max_bounces = 1; sc.cycles.diffuse_bounces = 1; sc.cycles.glossy_bounces = 1; sc.cycles.transmission_bounces = 0; sc.cycles.caustics_reflective = False; sc.cycles.caustics_refractive = False
        sc.cycles.use_denoising = os.environ.get("HB_DENOISE", "1") == "1"; sc.render.use_persistent_data = True        # keep textures and scene data between frames: most of a frame's time was reloading them
        try:
            sc.cycles.denoiser = "OPENIMAGEDENOISE"; sc.cycles.denoising_prefilter = "FAST"; sc.cycles.denoising_quality = "FAST"
        except Exception: pass
    else:
        try:
            sc.render.engine = "BLENDER_EEVEE"
        except TypeError:
            sc.render.engine = "BLENDER_EEVEE_NEXT"
    sc.render.resolution_x = sc.render.resolution_y = res
    sc.render.film_transparent = False
    sc.view_settings.view_transform = "Standard"
    w = sc.world or bpy.data.worlds.new("World"); sc.world = w
    w.use_nodes = True
    bg = next(n for n in w.node_tree.nodes if n.type == "BACKGROUND")
    bg.inputs[0].default_value = (0.42, 0.42, 0.42, 1); bg.inputs[1].default_value = 0.9
    for name, rot, e in (("KEY", (50, 0, 35), 3.2), ("FILL", (60, 0, -140), 1.2), ("RIM", (70, 0, 180), 1.5)):
        if name in bpy.data.objects: continue
        l = bpy.data.lights.new(name, "SUN"); l.energy = e
        o = bpy.data.objects.new(name, l); sc.collection.objects.link(o)
        o.rotation_euler = [math.radians(a) for a in rot]
    if "CAM" not in bpy.data.objects:
        c = bpy.data.cameras.new("CAM"); c.type = "ORTHO"
        o = bpy.data.objects.new("CAM", c); sc.collection.objects.link(o)
    sc.camera = bpy.data.objects["CAM"]
    return sc

def one_sided(m):
    """Draw a material's front faces only, as a game renderer does unless told otherwise (a glTF material is one-sided
    by default). Review renders made two-sided hide every hole a player would see, and show the backs of linings and
    skirts that a player never sees."""
    if m is None or not m.use_nodes or m.get("hb_one_sided"): return
    m.use_backface_culling = True; nt = m.node_tree; out = next((n for n in nt.nodes if n.type == "OUTPUT_MATERIAL" and n.is_active_output), None)
    if out is None or not out.inputs["Surface"].is_linked: return
    src = out.inputs["Surface"].links[0].from_socket; geo = nt.nodes.new("ShaderNodeNewGeometry"); tr = nt.nodes.new("ShaderNodeBsdfTransparent"); mix = nt.nodes.new("ShaderNodeMixShader")
    nt.links.new(geo.outputs["Backfacing"], mix.inputs[0]); nt.links.new(src, mix.inputs[1]); nt.links.new(tr.outputs[0], mix.inputs[2]); nt.links.new(mix.outputs[0], out.inputs["Surface"]); m["hb_one_sided"] = True
    try: bpy.context.scene.cycles.transparent_max_bounces = 24
    except Exception: pass


def clay_material():
    m = bpy.data.materials.get("HB_CLAY")
    if m: return m
    m = bpy.data.materials.new("HB_CLAY"); m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (0.75, 0.75, 0.75, 1); b.inputs["Roughness"].default_value = 0.6
    return m

VIEWS = {  # Blender frame: +X forward (actor faces +X), +Z up, -Y = anatomical right
    "front": Vector((1, 0, 0)), "back": Vector((-1, 0, 0)),
    "right": Vector((0, -1, 0)), "left": Vector((0, 1, 0)),
    "top": Vector((0, 0, 1)), "underside": Vector((0, 0, -1)),
    "three-quarter": Vector((1, -0.8, 0.45)).normalized(),
    "rt-three-quarter-back": Vector((0.8, 1, 0.45)).normalized(),
    # runtime frame (actor faces -Y, left = +X)
    "rt-front": Vector((0, -1, 0)), "rt-back": Vector((0, 1, 0)), "rt-right": Vector((-1, 0, 0)), "rt-left": Vector((1, 0, 0)),
    "rt-three-quarter": Vector((-0.8, -1, 0.45)).normalized(),
    "rt-back-right": Vector((-0.8, 1, 0.25)).normalized(), "rt-back-left": Vector((0.8, 1, 0.25)).normalized(), "rt-back-low": Vector((0, 1, -0.5)).normalized(),
    # the see-inside check's two views from above (hb_gap_check.py: 35 degrees down), so what it flags can be looked at
    "rt-back-above": Vector((0, 0.819, 0.574)), "rt-front-above": Vector((0, -0.819, 0.574)),
}

def frame(objs_or_bounds, direction, pad=1.12):
    if isinstance(objs_or_bounds, tuple):
        mn, mx = objs_or_bounds
    else:
        pts = [o.matrix_world @ Vector(c) for o in objs_or_bounds for c in o.bound_box]
        mn = Vector([min(p[i] for p in pts) for i in range(3)]); mx = Vector([max(p[i] for p in pts) for i in range(3)])
    ctr = (mn + mx) / 2; size = (mx - mn).length
    cam = bpy.data.objects["CAM"]
    cam.location = ctr + direction * size * 3
    up = Vector((0, 0, 1)) if abs(direction.z) < 0.99 else Vector((-1, 0, 0)) * (1 if direction.z > 0 else -1)
    z = direction.normalized(); x = up.cross(z).normalized(); y = z.cross(x)
    cam.matrix_world = Matrix((x, y, z)).transposed().to_4x4() @ Matrix.Identity(4)
    cam.location = ctr + direction * size * 3
    # ortho scale from projected extent
    corners = [Vector((a, b, c)) for a in (mn.x, mx.x) for b in (mn.y, mx.y) for c in (mn.z, mx.z)]
    ext = max(max(abs((q - ctr).dot(x)) for q in corners), max(abs((q - ctr).dot(y)) for q in corners)) * 2
    cam.data.ortho_scale = ext * pad
    cam.data.clip_start = 0.001; cam.data.clip_end = size * 10

def render(path):
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

def with_clay(objs):
    """context helper: swap to clay, returns restore fn"""
    saved = {o: [s.material for s in o.material_slots] for o in objs}
    m = clay_material()
    for o in objs:
        for s in o.material_slots: s.material = m
    def restore():
        for o, ms in saved.items():
            for s, mm in zip(o.material_slots, ms): s.material = mm
    return restore
