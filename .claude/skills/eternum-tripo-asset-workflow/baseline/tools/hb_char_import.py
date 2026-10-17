"""Character import (stage: raw mesh -> working frame, joints, part labels).
env HB_CHAR = path (under human-baseline) of a char.json spec.

1. Import the raw Tripo GLB, rotate to the working frame (faces -Y, left +X, up +Z), register it to the concept's
   front view (silhouette bounding box), scale so the anatomical stature is 0.6 and put the soles at z = 0.
2. Family joints from the packet's front-view landmarks (x, z) with depth (y) read from the mesh cross-section.
3. Part labels: per-view ID maps composed from the packet masks, projected onto visible triangles from the front and
   back views; triangles no view can see take the label of the nearest labelled triangle. Head and hands by geometry.
Writes <work>/character.blend, character.npz (V, tris, cls per vertex, fcls per face), character.json (rig, classes,
registration) and a label preview sheet."""
import bpy, bmesh, os, sys, json, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p, resolve, load_classes
import hb_lib as H, hb_render as R
from hb_sheet import sheet
SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); os.makedirs(WORK, exist_ok=True)
PK = os.path.normpath(p(*SPEC["packet"].split("/")))
def img(path):
    im = bpy.data.images.load(path, check_existing=False); w, h = im.size; a = np.array(im.pixels[:], dtype=np.float32).reshape(h, w, 4)[::-1]; bpy.data.images.remove(im); return a   # row 0 = top
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=p(*SPEC["raw_glb"].split("/")))
meshes = [o for o in bpy.data.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active; ob.name = "HB_char"
bpy.ops.object.parent_clear(type="CLEAR_KEEP_TRANSFORM"); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# A GLB stores a vertex once per UV chart, so the imported mesh is cut along every UV seam. Weld coincident vertices:
# labels, weight inpainting, the split and the stretch measure all need the real surface. UVs are per face corner
# and are not affected.
_nv0 = len(ob.data.vertices); bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="SELECT"); bpy.ops.mesh.remove_doubles(threshold=1e-6); bpy.ops.object.mode_set(mode="OBJECT")
me = ob.data; WELD = {"vertices_raw": _nv0, "vertices_welded": len(me.vertices)}
# raw Tripo frame in Blender: faces +X, left +Y. Working frame: faces -Y, left +X  => (x, y) -> (y, -x)
C = np.array([v.co[:] for v in me.vertices]); C = np.c_[C[:, 1], -C[:, 0], C[:, 2]]
# ---- registration to the front view
man = json.load(open(os.path.join(PK, SPEC["manifest"]))); fv = man["views"]["front"]; LM = fv["locked_anatomical_landmarks"]
front = img(os.path.join(PK, SPEC["views"]["front"])); fg = (front[..., :3].min(-1) < 0.94); ys, xs = np.nonzero(fg)
px0, px1, py0, py1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
floor_a = fv["anatomical_floor_reference_y"]; k = 0.6 / (floor_a - LM["anatomical_head_top"][1])              # metres per pixel at H = 0.6
s = k * (py1 - py0) / (C[:, 2].max() - C[:, 2].min()); C *= s
cx_px = (px0 + px1) / 2; C[:, 0] -= (C[:, 0].max() + C[:, 0].min()) / 2; C[:, 2] -= C[:, 2].min()
z_of = lambda py: (py1 - py) * k; x_of = lambda px: (px - cx_px) * k
C[:, 1] -= (C[:, 1].max() + C[:, 1].min()) / 2
me.vertices.foreach_set("co", C.ravel()); me.update()
reg = {"scale": float(s), "k_m_per_px": float(k), "bbox_px": [int(px0), int(py0), int(px1), int(py1)], "width_ratio_mesh_over_image": float((C[:, 0].max() - C[:, 0].min()) / ((px1 - px0) * k)), "sole_to_anatomical_floor": float(z_of(floor_a))}
tris = np.array([pl.vertices[:] for pl in me.polygons], dtype=np.int32)
assert all(len(pl.vertices) == 3 for pl in me.polygons)
bvh = BVHTree.FromPolygons([tuple(q) for q in C], [tuple(t) for t in tris])
# ---- joints
def depth_mid(x, z, r=0.012, side=None):
    m = (np.abs(C[:, 0] - x) < r) & (np.abs(C[:, 2] - z) < r)
    if m.sum() < 6: m = (np.abs(C[:, 0] - x) < 2.5 * r) & (np.abs(C[:, 2] - z) < 2.5 * r)
    return float((C[m, 1].min() + C[m, 1].max()) / 2) if m.any() else 0.0
def lm(n): return x_of(LM[n][0]), z_of(LM[n][1])
Hh = 0.6; J = {}; z_top = z_of(LM["anatomical_head_top"][1]); z_chin = z_of(LM["chin"][1]); hh = z_top - z_chin
zc = z_of(LM["pelvis"][1]); z_hip = zc + 0.040 * Hh; z_neck = z_chin - 0.20 * hh
J["pelvis"] = (0, 0, z_hip + 0.012 * Hh)
for n, f in (("spine_01", 0.089), ("spine_02", 0.22), ("spine_03", 0.40)): J[n] = (0, 0, J["pelvis"][2] + f * (z_neck - J["pelvis"][2]))
J["neck_01"] = (0, 0, z_neck); J["Head"] = (0, 0, z_chin + 0.30 * hh)
for n in ("pelvis", "spine_01", "spine_02", "spine_03", "neck_01", "Head"):
    y = depth_mid(0.0, J[n][2], 0.02); back = float(C[(np.abs(C[:, 0]) < 0.02) & (np.abs(C[:, 2] - J[n][2]) < 0.012), 1].max()) if n != "Head" else y
    J[n] = (0.0, y + (0.12 * (back - y) if n not in ("Head",) else 0.0), J[n][2])
tips = {"Head": (0.0, J["Head"][1], z_top)}
for sfx, side in (("_l", "left"), ("_r", "right")):
    sx, sz = lm(side + "_shoulder"); ex, ez = lm(side + "_elbow"); wx, wz = lm(side + "_wrist"); hx, hz = lm(side + "_hand"); kx, kz = lm(side + "_knee"); hlx, _ = lm(side + "_heel_floor"); tx, _ = lm(side + "_toe_floor")
    sg = 1 if sfx == "_l" else -1
    J["upperarm" + sfx] = (sx, depth_mid(sx, sz), sz); J["clavicle" + sfx] = (0.15 * sx, J["spine_03"][1] - 0.2 * (J["spine_03"][1] - depth_mid(0.0, sz, 0.02)), sz)
    ey = depth_mid(ex, ez); eb = C[(np.abs(C[:, 0] - ex) < 0.012) & (np.abs(C[:, 2] - ez) < 0.012), 1]; J["lowerarm" + sfx] = (ex, ey + 0.10 * (eb.max() - eb.min()) if len(eb) else ey, ez)
    J["hand" + sfx] = (wx, depth_mid(wx, wz), wz); tips["hand" + sfx] = (hx + (hx - wx) * 0.8, depth_mid(hx, hz), hz + (hz - wz) * 0.8)
    J["thigh" + sfx] = (sg * 0.050 * Hh, depth_mid(sg * 0.05 * Hh, z_hip, 0.02), z_hip)
    kb = C[(np.abs(C[:, 0] - kx) < 0.015) & (np.abs(C[:, 2] - kz) < 0.012), 1]; J["calf" + sfx] = (kx, depth_mid(kx, kz, 0.015) - (0.10 * (kb.max() - kb.min()) if len(kb) else 0.0), kz)
    za = 0.045 * Hh + z_of(floor_a); foot = C[(np.sign(C[:, 0]) == sg) & (C[:, 2] < 0.03)]; y_toe, y_heel = float(foot[:, 1].min()), float(foot[:, 1].max()); xa = float(np.median(foot[foot[:, 1] > y_heel - 0.02, 0]))
    xt = float(np.median(foot[foot[:, 1] < y_toe + 0.015, 0]))
    J["foot" + sfx] = (xa, y_heel - 0.28 * (y_heel - y_toe), za); J["ball" + sfx] = (xa + 0.68 * (xt - xa), y_heel - 0.72 * (y_heel - y_toe), 0.012 + z_of(floor_a) * 0.5)
    J["ball_leaf" + sfx] = (xt, y_toe + 0.004, J["ball" + sfx][2]); tips["ball_leaf" + sfx] = (xt, y_toe - 0.01, J["ball" + sfx][2])
J["root"] = (0.0, 0.0, 0.0)
for b in ("clavicle", "upperarm", "lowerarm", "hand", "thigh", "calf", "foot", "ball", "ball_leaf"):       # symmetric joints: mean of both sides
    l, r = np.array(J[b + "_l"]), np.array(J[b + "_r"]); m = (l + r * np.array([-1, 1, 1])) / 2; J[b + "_l"] = tuple(m); J[b + "_r"] = tuple(m * np.array([-1, 1, 1]))
rig = H.make_rig({k_: np.array(v, float) for k_, v in J.items()}, {k_: np.array(v, float) for k_, v in tips.items()})
# ---- labels
LS = SPEC["labels"]; classes = load_classes(SPEC, PK); nF = len(tris); FC = (C[tris[:, 0]] + C[tris[:, 1]] + C[tris[:, 2]]) / 3
FN = np.cross(C[tris[:, 1]] - C[tris[:, 0]], C[tris[:, 2]] - C[tris[:, 0]]); FN /= np.maximum(np.linalg.norm(FN, axis=1, keepdims=True), 1e-12)
# view -> (direction toward the camera, mesh axis that runs along the image's x, its sign). 'left' is the profile whose
# nose points to image-left (camera on the character's left), 'right' the profile whose nose points to image-right.
VIEW = {"front": (np.array([0, -1.0, 0]), 0, 1.0), "back": (np.array([0, 1.0, 0]), 0, -1.0), "left": (np.array([1.0, 0, 0]), 1, 1.0), "right": (np.array([-1.0, 0, 0]), 1, -1.0)}
ids = sorted(int(i) for i in classes); votes = np.zeros((nF, max(ids) + 2)); idmaps = {}
src = LS.get("id_png") or LS.get("id_maps")
# Front and back vote first. A profile can only confirm a class where the front and back views place it: a profile
# pixel of class c is accepted for a face only if the face lies within c's left-right extent seen from front and back.
# This rejects profile pixels of a drawn arm that covers the torso, and arms drawn slightly differently in profile.
xr = None; side_rejected = 0
# A profile says nothing reliable about the arms: in an A-pose they point at the camera, and the drawn profile arm never
# matches the mesh's arm exactly. Profile pixels of arm pieces, and faces on the arm beyond the shoulder plate, get no
# profile vote; front and back see nearly the whole arm, and the strip they miss is settled by growing along creases.
arm_cls = {int(i) for i, c in classes.items() if c.get("region") == "arm" or str(c.get("bone", c.get("joint", ""))).startswith(("lowerarm", "hand")) or c["kind"] == "remove"}
def _segd(Pt, a, b):
    ab = b - a; tt = np.clip(((Pt - a) @ ab) / max(float(ab @ ab), 1e-12), 0, 1); return np.linalg.norm(Pt - (a + np.outer(tt, ab)), axis=1), tt
arm_face = np.zeros(nF, bool)
for sfx in ("_l", "_r"):
    sh_, el_, wr_ = (np.array(J[n_ + sfx], float) for n_ in ("upperarm", "lowerarm", "hand")); tp_ = np.array(tips["hand" + sfx], float)
    du, tu = _segd(FC, sh_, el_); arm_face |= (du < 0.06) & (tu > 0.45) & (np.sign(FC[:, 0]) == (1 if sfx == "_l" else -1))
    for a_, b_ in ((el_, wr_), (wr_, tp_)): arm_face |= _segd(FC, a_, b_)[0] < 0.06
for vname, layers in sorted(src.items(), key=lambda kv: kv[0] in ("left", "right")):
    if vname in ("left", "right") and xr is None:
        lab0 = votes.argmax(1); ok0 = votes.max(1) > 0; xr = {}
        for i_ in ids:
            m0 = ok0 & (lab0 == i_)
            if m0.sum() >= 20: xr[i_] = (float(np.percentile(FC[m0, 0], 1)) - 0.012, float(np.percentile(FC[m0, 0], 99)) + 0.012)
    view = img(os.path.join(PK, SPEC["views"][vname])); fgv = view[..., :3].min(-1) < 0.94; ysv, xsv = np.nonzero(fgv); vx0, vx1, vy1 = xsv.min(), xsv.max() + 1, ysv.max() + 1; vcx = (vx0 + vx1) / 2
    if isinstance(layers, str):                                     # one flat-colour ID image: nearest legend colour
        im_ = img(resolve(PK, layers))[..., :3]; cols = np.array([classes[str(i)]["colour"] for i in ids]); idm = np.zeros(im_.shape[:2], np.int32); best = np.full(im_.shape[:2], 9.0)
        for i_, col in zip(ids, cols):
            dd = ((im_ - col) ** 2).sum(-1); m = dd < best; best[m] = dd[m]; idm[m] = i_
        idm[(best > 0.02) | (im_.min(-1) > 0.97)] = 0                # background or an unknown colour
    else:
        idm = np.where(fgv, 1, 0).astype(np.int32)
        for path, cid in layers:
            m = img(os.path.join(PK, path))[..., 0] > 0.5; idm[m] = cid
    idmaps[vname] = idm; d, axis_, flip = VIEW[vname]
    facing = FN @ d
    for f in np.nonzero(facing > 0.15)[0]:
        q = FC[f]; hit = bvh.ray_cast(Vector((q + d * 0.0008).tolist()), Vector(d.tolist()), 2.0)
        if hit[0] is not None: continue                                                      # occluded from this view
        px = int(round(vcx + flip * q[axis_] / k)); py = int(round(vy1 - q[2] / k))
        if 0 <= px < idm.shape[1] and 0 <= py < idm.shape[0] and idm[py, px] > 0:
            c_ = int(idm[py, px])
            if vname in ("left", "right") and (arm_face[f] or c_ in arm_cls): side_rejected += 1; continue
            if vname in ("left", "right") and c_ in xr and not (xr[c_][0] <= q[0] <= xr[c_][1]): side_rejected += 1; continue
            votes[f, c_] += facing[f]
# keep the composed ID maps and legend beside the work files: the format a packet's own ID maps must follow
os.makedirs(os.path.join(WORK, "id"), exist_ok=True)
for vname, idm in idmaps.items():
    rgb = np.ones((*idm.shape, 4), np.float32)
    for i_ in ids: rgb[idm == i_, :3] = classes[str(i_)]["colour"]
    im2 = bpy.data.images.new("id_" + vname, idm.shape[1], idm.shape[0], alpha=False); im2.pixels[:] = rgb[::-1].ravel(); im2.filepath_raw = os.path.join(WORK, "id", vname + ".png"); im2.file_format = "PNG"; im2.save(); bpy.data.images.remove(im2)
json.dump({"background": [255, 255, 255], "classes": [{"id": i_, "name": classes[str(i_)]["name"], "rgb": [int(round(v * 255)) for v in classes[str(i_)]["colour"]], "kind": classes[str(i_)]["kind"], **({"joint": classes[str(i_)]["bone"]} if classes[str(i_)].get("bone") else {}), **({"region": classes[str(i_)]["region"]} if classes[str(i_)].get("region") else {}), **({"candidates": classes[str(i_)]["candidates"]} if classes[str(i_)].get("candidates") else {})} for i_ in ids]}, open(os.path.join(WORK, "id", "legend.json"), "w"), indent=1)
fcls = votes.argmax(1); seen = votes.max(1) > 0
# Faces no view saw (tops of shoulders, helmet and arms face none of the four cameras) and the jagged borders left by
# per-triangle sampling are both settled the same way: labels grow outward over the surface from faces we are sure of,
# and crossing a crease costs far more than crossing flat surface. A plate's rim is a crease, so borders settle on rims.
import heapq
bm = bmesh.new(); bm.from_mesh(me); bm.faces.ensure_lookup_table(); NB = [[] for _ in range(nF)]; NBE = [[] for _ in range(nF)]
for e in bm.edges:
    if len(e.link_faces) == 2:
        a_, b_ = e.link_faces[0].index, e.link_faces[1].index; ln = float(np.linalg.norm(FC[a_] - FC[b_])); cr = ln * (1.0 + 25.0 * (1.0 - math.cos(e.calc_face_angle(0.0))))
        NB[a_].append((b_, ln, cr)); NB[b_].append((a_, ln, cr)); el_ = e.calc_length(); NBE[a_].append((b_, el_)); NBE[b_].append((a_, el_))
def grow(lab_, open_):
    lab_ = lab_.copy(); dist = np.where(open_, np.inf, 0.0); hq = [(0.0, int(f)) for f in np.nonzero(~open_)[0] if any(open_[g] for g, _, _ in NB[f])]; heapq.heapify(hq)
    while hq:
        d_, f = heapq.heappop(hq)
        if d_ > dist[f]: continue
        for g, _, c in NB[f]:
            if open_[g] and d_ + c < dist[g]: dist[g] = d_ + c; lab_[g] = lab_[f]; heapq.heappush(hq, (d_ + c, g))
    return lab_
lab = grow(np.where(seen, fcls, 0), ~seen)
rest_ = np.nonzero(lab == 0)[0]
if len(rest_):
    sidx = np.nonzero(lab > 0)[0]
    for f in rest_: lab[f] = lab[sidx[np.argmin(((FC[sidx] - FC[f]) ** 2).sum(1))]]
# border clean-up: reopen a band along every class border (7 mm, or half the depth of a thin piece) and regrow it
depth_ = np.full(nF, np.inf); hq = [(0.0, f) for f in range(nF) if any(lab[g] != lab[f] for g, _, _ in NB[f])]
for _, f in hq: depth_[f] = 0.0
heapq.heapify(hq)
while hq:
    d_, f = heapq.heappop(hq)
    if d_ > depth_[f]: continue
    for g, ln, _ in NB[f]:
        if lab[g] == lab[f] and d_ + ln < depth_[g]: depth_[g] = d_ + ln; heapq.heappush(hq, (d_ + ln, g))
comp = np.full(nF, -1); dmax = []
for f0 in range(nF):
    if comp[f0] != -1: continue
    cid_ = len(dmax); comp[f0] = cid_; st = [f0]; mx_ = 0.0
    while st:
        f = st.pop(); mx_ = max(mx_, depth_[f] if np.isfinite(depth_[f]) else 1.0)
        for g, _, _ in NB[f]:
            if comp[g] == -1 and lab[g] == lab[f0]: comp[g] = cid_; st.append(g)
    dmax.append(mx_)
BAND = float(os.environ.get("HB_LABEL_BAND", "0.007")); open_b = depth_ < np.minimum(BAND, 0.5 * np.array(dmax)[comp]); reopened = int(open_b.sum())
before_ = lab.copy(); lab = grow(lab, open_b); border_moved = int((lab != before_).sum())
# saw teeth: a face whose perimeter is mostly shared with one other class takes that class (up to 8 passes)
teeth = 0
for _ in range(8):
    new = lab.copy(); ch = 0
    for f in range(nF):
        if len(NBE[f]) < 2: continue
        tot = 0.0; w_ = {}
        for g, el_ in NBE[f]: tot += el_; w_[lab[g]] = w_.get(lab[g], 0.0) + el_
        bl = max(w_, key=w_.get)
        if bl != lab[f] and w_[bl] > 0.6 * tot: new[f] = bl; ch += 1
    lab = new; teeth += ch
    if ch == 0: break
names = rig["names"]; rest = rig["rest"]; name2id = {c["name"]: int(i) for i, c in classes.items()}
# geometry rules apply only to a legend that has a catch-all 'soft' class (masks that do not draw head and hands)
SOFT_ID = name2id.get("soft", -1); soft_plain = lab == SOFT_ID
if "head" in name2id: lab[soft_plain & (FC[:, 2] > z_chin - 0.004) & (np.abs(FC[:, 0]) < 0.06)] = name2id["head"]
for sfx in ("_l", "_r"):
    if "hand" + sfx in name2id:
        w = rest[names.index("hand" + sfx)]; e = rest[names.index("lowerarm" + sfx)]; ax = H.unit(w - e); t = (FC - w) @ ax
        lab[(lab == SOFT_ID) & (t > 0.010) & (np.linalg.norm(FC - w, axis=1) < 0.07)] = name2id["hand" + sfx]
# small islands (< 40 faces) of any class take the surrounding majority
seenf = np.zeros(nF, bool); small = 0
for f0 in range(nF):
    if seenf[f0]: continue
    comp = [f0]; seenf[f0] = True; st = [f0]; border = []
    while st:
        f = st.pop()
        for e in bm.faces[f].edges:
            for g in e.link_faces:
                if g.index == f: continue
                if lab[g.index] == lab[f0]:
                    if not seenf[g.index]: seenf[g.index] = True; comp.append(g.index); st.append(g.index)
                else: border.append(lab[g.index])
    if len(comp) < 40 and border:
        vals, cnt = np.unique(border, return_counts=True); lab[comp] = vals[np.argmax(cnt)]; small += 1
# ---- pivots on the limbs' own centrelines. Landmarks are drawn on a clothed figure and sit where the artist judged the
# joint; the mesh says where the limb actually is. A pivot off the limb's own line makes the limb swing out of its
# socket when it turns. Arms: shoulder, elbow and wrist are moved onto lines fitted through the cross-section centres of
# the upper arm and forearm. Legs: the hip is moved sideways onto the line through the thigh's cross-section centres.
def _line(pts):
    c = pts.mean(0); _, _, vt = np.linalg.svd(pts - c); return c, vt[0]
def _proj(q, line): return line[0] + line[1] * float((np.asarray(q) - line[0]) @ line[1])
def _centres(P, a, b, fracs, half=0.004):
    ax = H.unit(b - a); L = float(np.linalg.norm(b - a)); t = (P - a) @ ax; e1 = H.unit(np.cross(ax, [0, 1.0, 0])); e2 = np.cross(ax, e1); out = []
    for fr in fracs:
        q = P[np.abs(t - fr * L) < half]
        if len(q) < 12: continue
        u = (q - a) @ e1; w = (q - a) @ e2; out.append(a + ax * fr * L + e1 * (u.min() + u.max()) / 2 + e2 * (w.min() + w.max()) / 2)
    return np.array(out)
cname = {int(i): c for i, c in classes.items()}; fside = np.sign(FC[:, 0]); PIV = {}
def _faces(pred): return np.array([pred(cname[int(c)]) if int(c) in cname else False for c in lab])
arm_f = _faces(lambda c: c.get("region") == "arm" or str(c.get("bone", "")).startswith("lowerarm")); leg_f = _faces(lambda c: c.get("region") == "leg" or str(c.get("bone", "")).startswith(("thigh", "calf")))
Jn = {k_: np.array(v, float) for k_, v in J.items()}
for sfx, sg in (("_l", 1), ("_r", -1)):
    P = C[np.unique(tris[arm_f & (fside == sg)])]
    if len(P) > 200:
        sh, el, wr = Jn["upperarm" + sfx], Jn["lowerarm" + sfx], Jn["hand" + sfx]
        cu = _centres(P, sh, el, np.linspace(0.45, 1.0, 8)); cf = _centres(P, el, wr, np.linspace(0.1, 0.9, 8))
        if len(cu) >= 3 and len(cf) >= 3:
            lu, lf = _line(cu), _line(cf); nsh = _proj(sh, lu); nwr = _proj(wr, lf); nel = (_proj(el, lu) + _proj(el, lf)) / 2
            band = P[np.abs((P - el) @ H.unit(el - sh)) < 0.006]; nel = nel + np.array([0, 0.10 * float(band[:, 1].max() - band[:, 1].min()) if len(band) > 8 else 0.0, 0])   # hinge toward the outside of the bend
            for nme, new in (("upperarm", nsh), ("lowerarm", nel), ("hand", nwr)):
                if np.linalg.norm(new - Jn[nme + sfx]) < 0.03: Jn[nme + sfx] = new
    P = C[np.unique(tris[leg_f & (fside == sg)])]
    if len(P) > 200:
        zk = Jn["calf" + sfx][2]; cz = []
        for z_ in np.arange(zk + 0.015, zc - 0.008, 0.008):
            q = P[np.abs(P[:, 2] - z_) < 0.004]
            if len(q) >= 12: cz.append([(q[:, 0].min() + q[:, 0].max()) / 2, (q[:, 1].min() + q[:, 1].max()) / 2, z_])
        if len(cz) >= 3:
            cz = np.array(cz); kx = np.polyfit(cz[:, 2], cz[:, 0], 1); hx = float(np.polyval(kx, Jn["thigh" + sfx][2]))
            outer = float(np.abs(P[np.abs(P[:, 2] - zc) < 0.02, 0]).max()) if (np.abs(P[:, 2] - zc) < 0.02).any() else abs(hx) * 2
            hx = sg * float(np.clip(abs(hx), 0.40 * outer, 0.60 * outer))                        # hip joints sit about halfway out to the hip's outer surface
            Jn["thigh" + sfx] = np.array([hx, depth_mid(hx, Jn["thigh" + sfx][2], 0.02), Jn["thigh" + sfx][2]])
for b_ in ("upperarm", "lowerarm", "hand", "thigh"):
    l_, r_ = Jn[b_ + "_l"], Jn[b_ + "_r"]; m_ = (l_ + r_ * np.array([-1, 1, 1])) / 2
    for sfx, mm in (("_l", m_), ("_r", m_ * np.array([-1, 1, 1]))):
        PIV[b_ + sfx] = [round(float(x) * 1000, 1) for x in (mm - np.array(J[b_ + sfx], float))]; J[b_ + sfx] = tuple(mm)
rig = H.make_rig({k_: np.array(v, float) for k_, v in J.items()}, {k_: np.array(v, float) for k_, v in tips.items()}); names = rig["names"]; rest = rig["rest"]
fa = me.attributes.get("hb_cls") or me.attributes.new("hb_cls", "INT", "FACE"); fa.data.foreach_set("value", lab.astype(np.int32))
bm.free()
# per-vertex class: rigid wins over soft at shared vertices (the plate edge belongs to the plate)
order = {int(i): (2 if c["kind"] == "rigid" else 1 if c["kind"] == "soft" else 3) for i, c in classes.items()}
vcls = np.zeros(len(C), np.int32); vpri = np.zeros(len(C), np.int32)
for f in range(nF):
    c = int(lab[f]); pr = order.get(c, 0)
    for v in tris[f]:
        if pr > vpri[v]: vpri[v] = pr; vcls[v] = c
area = np.linalg.norm(np.cross(C[tris[:, 1]] - C[tris[:, 0]], C[tris[:, 2]] - C[tris[:, 0]]), axis=1) / 2
rep = {"registration": reg, "weld": WELD, "faces": int(nF), "seen_by_views": float(seen.mean()), "small_islands_merged": small, "profile_votes_rejected": int(side_rejected), "border_faces_reopened": reopened, "saw_teeth_removed": teeth, "border_faces_relabelled": border_moved, "pivot_shift_mm": PIV,
       "class_area_cm2": {classes[str(c)]["name"]: round(float(area[lab == c].sum()) * 1e4, 1) for c in sorted(set(lab.tolist()))},
       "joints": {n: [round(float(x), 4) for x in rest[i]] for i, n in enumerate(names)}}
uvl = me.uv_layers.active.data; UV = np.array([[uvl[li].uv[:] for li in pl.loop_indices] for pl in me.polygons], dtype=np.float32)
np.savez_compressed(os.path.join(WORK, "character.npz"), V=C, tris=tris, cls=vcls, fcls=lab.astype(np.int32), uv=UV)
json.dump({"rig": H.rig_to_json(rig), "classes": classes, "report": rep}, open(os.path.join(WORK, "character.json"), "w"), indent=1)
# ---- label preview
R.setup_scene(900); base_slots = len(me.materials); slot = {}
for cid, c in classes.items():
    m = bpy.data.materials.new("cls_" + c["name"]); m.use_nodes = True; b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"); b.inputs["Base Color"].default_value = (*c["colour"], 1); b.inputs["Roughness"].default_value = 0.8
    me.materials.append(m); slot[int(cid)] = len(me.materials) - 1
paths = []
for v in ("rt-front", "rt-three-quarter", "rt-back", "rt-left"):
    R.frame([ob], R.VIEWS[v]); fp = os.path.join(WORK, f"label-tex-{v}.png"); R.render(fp); paths.append(fp)
for pl in me.polygons: pl.material_index = slot[int(lab[pl.index])]
for v in ("rt-front", "rt-three-quarter", "rt-back", "rt-left"):
    R.frame([ob], R.VIEWS[v]); fp = os.path.join(WORK, f"label-flat-{v}.png"); R.render(fp); paths.append(fp)
for pl in me.polygons: pl.material_index = 0
sheet(paths, 4, 560, os.path.join(WORK, "SHEET-labels.png"))
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(WORK, "character.blend"))
print("CHAR", json.dumps(rep))
