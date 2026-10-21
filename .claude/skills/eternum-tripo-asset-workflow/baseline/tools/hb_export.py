"""Write a baked character (or a baked item) as a plain GLB (numpy and the standard library only; no Blender).

The file is written directly, so that what is in it is exactly what the baseline holds: the vertices in the bind's own
places, the authored normals, the tangents the normal map was baked in, the weights as bound, the joints at their rest
positions with world-aligned frames. Nothing is re-ordered, re-normalised or re-interpreted by an exporter.

  frame      the baseline works in +Z up, -Y forward, +X the character's left. The game is +Y up, +Z forward, +X left:
             (x, y, z) -> (x, z, -y), a pure rotation, applied to positions, normals, tangents and joints alike
  skeleton   --joints <order file or the built-in family order>; helper joints after the core ones. Every joint is a
             node with a translation from its parent and no rotation; inverse bind matrices are plain translations
  weights    the bind's weights with the helper joints' derived (hb_helpers.add_helpers), the four largest, re-normalised
  vertices   one per distinct (place, normal, texture corner, tangent); JOINTS_0 unsigned bytes, the rest floats
  material   one: colour (sRGB), metallic-roughness and occlusion from the one ORM image, normal; single-sided; the
             three PNG files are embedded as they are
  no clips, one scene, one root node holding the mesh node and the root joint

  python hb_export.py --char <char.json> --baked <stem under human-baseline, e.g. ../x/work/baked-near> --out <glb>
                      [--helpers elbow_half,knee_half,upperarm_twist] [--name T1_Knight_Default]
                      [--item --joint hand_r]      (a rigid item: no skin; its vertices in its own frame)
Also writes <glb>.json: counts, bounds, joint order, hashes. Prints EXPORT lines."""
import argparse, json, os, sys, struct, hashlib
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H, hb_helpers as HH

GAME_ORDER = ["root", "pelvis", "spine_01", "spine_02", "spine_03", "clavicle_l", "upperarm_l", "lowerarm_l", "hand_l", "clavicle_r", "upperarm_r", "lowerarm_r", "hand_r", "neck_01", "Head",
              "thigh_l", "calf_l", "foot_l", "ball_l", "ball_leaf_l", "thigh_r", "calf_r", "foot_r", "ball_r", "ball_leaf_r"]
C = np.array([[1.0, 0, 0], [0, 0, 1.0], [0, -1.0, 0]])                              # working frame -> game frame


def to_game(a): return np.asarray(a, float) @ C.T


def pad4(b, fill=b"\x00"): return b + fill * ((4 - len(b) % 4) % 4)


class Glb:
    def __init__(self): self.bin = bytearray(); self.views = []; self.acc = []
    def view(self, data, target=None):
        off = len(self.bin); self.bin += pad4(bytes(data)); v = {"buffer": 0, "byteOffset": off, "byteLength": len(data)}
        if target: v["target"] = target
        self.views.append(v); return len(self.views) - 1
    def accessor(self, arr, ctype, typ, target=None, minmax=False, normalized=False):
        a = np.ascontiguousarray(arr); v = self.view(a.tobytes(), target); d = {"bufferView": v, "componentType": ctype, "count": int(len(a)), "type": typ}
        if minmax: d["min"] = [float(x) for x in a.reshape(len(a), -1).min(0)]; d["max"] = [float(x) for x in a.reshape(len(a), -1).max(0)]
        if normalized: d["normalized"] = True
        self.acc.append(d); return len(self.acc) - 1
    def write(self, path, doc):
        doc["buffers"] = [{"byteLength": len(self.bin)}]; doc["bufferViews"] = self.views; doc["accessors"] = self.acc; js = pad4(json.dumps(doc, separators=(",", ":")).encode("utf8"), b" "); bn = bytes(self.bin)
        out = struct.pack("<III", 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(bn)) + struct.pack("<II", len(js), 0x4E4F534A) + js + struct.pack("<II", len(bn), 0x004E4942) + bn; open(path, "wb").write(out); return out


def split_vertices(V, tris, CN, UV, TG):
    """one vertex per distinct (place, normal, texture corner, tangent)"""
    F = len(tris); vid = tris.reshape(-1); n = CN.reshape(-1, 3).astype(float); n /= np.maximum(np.linalg.norm(n, axis=1, keepdims=True), 1e-20); uv = UV.reshape(-1, 2).astype(float); tg = TG.reshape(-1, 4).astype(float)
    t = tg[:, :3] - n * (tg[:, :3] * n).sum(1, keepdims=True); tl = np.linalg.norm(t, axis=1, keepdims=True); bad = tl[:, 0] < 1e-6
    if bad.any():                                                                     # a corner with no usable tangent (a face with no area in the layout): any direction across the normal
        alt = np.cross(n[bad], np.array([0.0, 0.0, 1.0])); al = np.linalg.norm(alt, axis=1, keepdims=True); alt = np.where(al < 1e-6, np.cross(n[bad], np.array([1.0, 0.0, 0.0])), alt); t[bad] = alt; tl = np.linalg.norm(t, axis=1, keepdims=True)
    t /= np.maximum(tl, 1e-20); sgn = np.where(tg[:, 3] < 0, -1.0, 1.0)
    key = np.concatenate([vid[:, None].astype(np.int64), np.round(n * 2047).astype(np.int64), np.round(uv * 16384).astype(np.int64), np.round(t * 511).astype(np.int64), sgn[:, None].astype(np.int64)], 1)
    _, first, inv = np.unique(key, axis=0, return_index=True, return_inverse=True); inv = inv.ravel()
    return vid[first], n[first], uv[first], np.concatenate([t[first], sgn[first, None]], 1), inv.reshape(F, 3), int(bad.sum())


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--baked", required=True); ap.add_argument("--out", required=True); ap.add_argument("--helpers", default=""); ap.add_argument("--name", default="Character"); ap.add_argument("--item", action="store_true"); ap.add_argument("--joint", default=None); a = ap.parse_args()
    stem = p(*a.baked.split("/")); d = np.load(stem + ".npz"); meta = json.load(open(stem + ".json")); out = p(*a.out.split("/")); os.makedirs(os.path.dirname(out), exist_ok=True)
    V = d["V"].astype(float); tris = d["tris"].astype(np.int64); CN = d["CN"].astype(float); UV = d["uv"].astype(float); TG = d["tangent"].astype(float); classes = meta.get("classes")
    vid, N, UVs, T4, idx, no_tan = split_vertices(V, tris, CN, UV, TG); G = Glb(); rep = {"source": a.baked, "triangles": int(len(tris)), "vertices_in_file": int(len(vid)), "places": int(len(V)), "corners_without_a_tangent": no_tan}
    pos = to_game(V[vid]).astype(np.float32); nrm = to_game(N).astype(np.float32); tan = np.concatenate([to_game(T4[:, :3]), T4[:, 3:]], 1).astype(np.float32); uvf = np.stack([UVs[:, 0], 1.0 - UVs[:, 1]], 1).astype(np.float32)        # glTF texture rows run down
    it = idx.astype(np.uint32 if len(vid) > 65535 else np.uint16)
    attrs = {"POSITION": G.accessor(pos, 5126, "VEC3", 34962, minmax=True), "NORMAL": G.accessor(nrm, 5126, "VEC3", 34962), "TANGENT": G.accessor(tan, 5126, "VEC4", 34962), "TEXCOORD_0": G.accessor(uvf, 5126, "VEC2", 34962)}
    nodes = []; skins = None; mesh_node = {"mesh": 0, "name": a.name + "_mesh"}
    if not a.item:
        rig = H.rig_from_json(meta["rig"]); helpers = [h for h in a.helpers.split(",") if h]
        # The file's weights must be the ones every check was run on: hb_harness.load_bound hands add_helpers the "ride" data too (padding under a plate
        # is bound to the plate's joint). The first export left it out, and 263 places of padding under the Knight's shoulder plates were written with their
        # template weights (collarbone and spine) instead of the plates' joint. Found by posing the file and comparing with the baseline's skinning.
        if "ride" in d.files: rig["ride"] = (d["ride"].astype(float), d["ride_cls"].astype(np.int64))
        rig, Wh = HH.add_helpers(V, d["W"].astype(float), rig, helpers, d["cls"] if "cls" in d.files else None, classes); names = list(rig["names"]); order = GAME_ORDER + [n for n in names if n not in GAME_ORDER]
        assert sorted(order) == sorted(names), "joint names differ from the family's: %s" % sorted(set(order) ^ set(names))
        to_file = np.array([order.index(n) for n in names]); ti, tv = H.dense_to_top4(Wh); tv = tv[vid].astype(np.float64); ti = ti[vid]; tv = np.where(tv < 1e-5, 0.0, tv); tv /= tv.sum(1, keepdims=True); ji = np.where(tv > 0, to_file[ti], 0)
        w32 = tv.astype(np.float32); w32[:, 0] += (1.0 - w32.sum(1, dtype=np.float64)).astype(np.float32)                                   # the largest takes the rounding, so each row sums to one in the file's own floats
        srt = np.argsort(-w32, axis=1); w32 = np.take_along_axis(w32, srt, 1); ji = np.take_along_axis(ji, srt, 1)
        attrs["JOINTS_0"] = G.accessor(ji.astype(np.uint8), 5121, "VEC4", 34962); attrs["WEIGHTS_0"] = G.accessor(w32, 5126, "VEC4", 34962)
        rest = to_game(np.array(rig["rest"], float)); par = [int(x) for x in rig["parent"]]
        for n in order:
            j = names.index(n); pj = par[j]; nd = {"name": n, "translation": [float(x) for x in (rest[j] - (rest[pj] if pj >= 0 else 0.0))]}; ch = [order.index(names[k]) for k in range(len(names)) if par[k] == j]
            if ch: nd["children"] = ch
            nodes.append(nd)
        ibm = np.tile(np.eye(4, dtype=np.float32), (len(order), 1, 1))
        for k, n in enumerate(order): ibm[k][3, :3] = -rest[names.index(n)]                                                               # column-major: the translation is the last column, written as the last row of the transposed array
        skins = [{"name": a.name + "_rig", "joints": list(range(len(order))), "inverseBindMatrices": G.accessor(ibm.reshape(-1, 16), 5126, "MAT4"), "skeleton": order.index("root")}]; mesh_node["skin"] = 0
        roots = [order.index(names[k]) for k in range(len(names)) if par[k] < 0]; nodes.append(mesh_node); nodes.append({"name": a.name, "children": [len(nodes) - 1] + roots})
        rep.update({"joints": order, "joint_count": len(order), "helpers": [n for n in order if n not in GAME_ORDER], "max_influences": int((w32 > 0).sum(1).max()), "weight_sum_error_max": float(np.abs(w32.astype(np.float64).sum(1) - 1).max()), "feet_lowest_y": float(pos[:, 1].min())})
    else:
        nodes.append(dict(mesh_node, name=a.name)); rep["item_joint"] = a.joint
    prim = {"attributes": attrs, "indices": G.accessor(it.reshape(-1), 5125 if it.dtype == np.uint32 else 5123, "SCALAR", 34963), "material": 0, "mode": 4}
    imgs = []; texs = []
    for k in ("color", "orm", "normal"):
        b = open(stem + "-%s.png" % k, "rb").read(); assert b[:8] == b"\x89PNG\r\n\x1a\n", "not a PNG: " + k; w, h = struct.unpack(">II", b[16:24]); imgs.append({"name": "%s-%s" % (os.path.basename(stem), k), "mimeType": "image/png", "bufferView": G.view(b)}); texs.append({"sampler": 0, "source": len(imgs) - 1})
        rep.setdefault("images", {})[k] = {"size": [int(w), int(h)], "bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
    mat = {"name": a.name + "_PBR", "doubleSided": False, "pbrMetallicRoughness": {"baseColorTexture": {"index": 0}, "metallicRoughnessTexture": {"index": 1}, "metallicFactor": 1.0, "roughnessFactor": 1.0}, "occlusionTexture": {"index": 1}, "normalTexture": {"index": 2, "scale": 1.0}}
    doc = {"asset": {"version": "2.0", "generator": "human-baseline hb_export.py"}, "scene": 0, "scenes": [{"name": a.name, "nodes": [len(nodes) - 1]}], "nodes": nodes, "meshes": [{"name": a.name + "_mesh", "primitives": [prim]}], "materials": [mat],
           "textures": texs, "images": imgs, "samplers": [{"magFilter": 9729, "minFilter": 9987, "wrapS": 10497, "wrapT": 10497}]}
    if skins: doc["skins"] = skins
    raw = G.write(out, doc); rep.update({"file": a.out, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest(), "bounds_game_frame": {"min": [float(x) for x in pos.min(0)], "max": [float(x) for x in pos.max(0)]}, "material": {"double_sided": False, "maps": ["baseColor", "metallicRoughness+occlusion (one ORM image)", "normal"]}})
    json.dump(rep, open(out + ".json", "w"), indent=1)
    print("EXPORT %s: %d triangles, %d vertices in file (%d places), %s, %.2f MB, sha256 %s" % (a.out, rep["triangles"], rep["vertices_in_file"], rep["places"], ("%d joints, at most %d influences" % (rep["joint_count"], rep["max_influences"])) if not a.item else "rigid item", len(raw) / 1e6, rep["sha256"][:16]))
