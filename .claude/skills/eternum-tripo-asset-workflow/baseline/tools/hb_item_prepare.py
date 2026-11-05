"""Put a removable item (a sword, a shield) into the baseline's own file form, so the same reduce, bake and export
tools take it (runs in Blender: it reads the item's blend file).

env HB_CHAR char.json (path under human-baseline; its "gear" names the gear spec, its work folder takes the output)
    HB_ITEM the item's name in the gear spec
Writes <work>/items/<name>/item.npz and item.json (V, tris, uv, CN, one rigid class on the item's joint; vertices in
the item's own frame, as the sockets in gear-fit.json expect), and <work>/items/<name>/tex/{color,orm,normal}.<ext>
(the images its material uses, copied as they are). Prints ITEM lines."""
import bpy, os, sys, json, shutil
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H

if __name__ == "__main__":
    SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); G = {i["name"]: i for i in json.load(open(p(*SPEC["gear"].split("/"))))["items"]}; it = G[os.environ["HB_ITEM"]]; out = os.path.join(WORK, "items", it["name"]); os.makedirs(os.path.join(out, "tex"), exist_ok=True)
    blend = p(*it["blend"].split("/"))
    with bpy.data.libraries.load(blend, link=False) as (src, dst): dst.objects = [it["object"]]
    o = dst.objects[0]; me = o.data; me.calc_loop_triangles(); V = np.array([(o.matrix_world @ v.co)[:] for v in me.vertices], float); lt = me.loop_triangles; tris = np.array([t.vertices[:] for t in lt], np.int64); loops = np.array([t.loops[:] for t in lt], np.int64)
    # One vertex per place. An item cut along its texture seams or sharp edges (the Knight's sword came in 66 pieces) cannot be reduced: every cut is an
    # open border, and a border is only ever merged along itself. Texture corners and normals are kept per face corner below, so the cuts lose nothing.
    _k = np.round(V / 1e-6).astype(np.int64); _, _f, _i = np.unique(_k, axis=0, return_index=True, return_inverse=True); welded = int(len(V) - len(_f)); V = V[_f]; tris = _i.ravel()[tris]
    ul = me.uv_layers.active; uvl = np.zeros(len(me.loops) * 2, np.float32); ul.data.foreach_get("uv", uvl); uv = uvl.reshape(-1, 2)[loops]
    nl = np.zeros(len(me.loops) * 3, np.float32)
    try: me.corner_normals.foreach_get("vector", nl)
    except Exception: me.loops.foreach_get("normal", nl)
    R3 = np.array(o.matrix_world.to_3x3(), float); CN = nl.reshape(-1, 3)[loops] @ np.linalg.inv(R3); CN /= np.maximum(np.linalg.norm(CN, axis=2, keepdims=True), 1e-20)
    # the material's three images
    mat = me.materials[0]; bs = next(n for n in mat.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); found = {}
    def image_behind(sock):
        seen = set(); todo = [sock]
        while todo:
            s = todo.pop()
            for l in s.links:
                n = l.from_node
                if n.as_pointer() in seen: continue
                seen.add(n.as_pointer())
                if n.type == "TEX_IMAGE" and n.image: return n.image
                todo += [i for i in n.inputs if i.is_linked]
        return None
    for key, sock in (("color", "Base Color"), ("orm", "Roughness"), ("normal", "Normal")):
        im = image_behind(bs.inputs[sock]); assert im is not None, "no image behind " + sock; src_path = bpy.path.abspath(im.filepath, library=im.library) if im.filepath else ""
        ext = os.path.splitext(src_path)[1].lower() if src_path else ".png"; dstp = os.path.join(out, "tex", key + (ext if ext in (".png", ".jpg", ".jpeg") else ".png"))
        if src_path and os.path.exists(src_path) and not im.packed_file: shutil.copyfile(src_path, dstp)
        else: im.filepath_raw = dstp; im.file_format = "PNG"; im.save()
        found[key] = {"image": im.name, "from": src_path or "(packed)", "size": list(im.size), "file": os.path.basename(dstp)}
    char = json.load(open(os.path.join(WORK, "character.json"))); rig = char["rig"]; ji = rig["names"].index(it["joint"]); W = np.zeros((len(V), len(H.CORE)), np.float32); W[:, ji] = 1.0
    classes = {"1": {"name": it["name"], "kind": "rigid", "bone": it["joint"], "colour": [0.6, 0.6, 0.6]}}
    np.savez_compressed(os.path.join(out, "item.npz"), V=V, tris=tris, W=W, cls=np.ones(len(V), np.int32), fcls=np.ones(len(tris), np.int32), uv=uv.astype(np.float32), CN=CN.astype(np.float16))
    json.dump({"rig": rig, "classes": classes, "item": {"name": it["name"], "blend": it["blend"], "object": it["object"], "joint": it["joint"], "triangles": int(len(tris)), "vertices": int(len(V)), "vertices_welded": welded, "images": found, "bounds_mm": [(V.min(0) * 1000).round(1).tolist(), (V.max(0) * 1000).round(1).tolist()]}}, open(os.path.join(out, "item.json"), "w"), indent=1)
    print("ITEM %s: %d triangles, %d vertices (%d welded), images %s" % (it["name"], len(tris), len(V), welded, json.dumps(found)))
