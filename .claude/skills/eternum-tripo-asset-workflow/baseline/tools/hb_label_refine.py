"""Move class borders onto the texture's own colour boundaries (runs inside Blender, for the image).

The part-ID maps are drawn by hand over the views and land a few millimetres off the generated surface: a corner of a
steel plate ends up labelled sleeve, a strip of tunic ends up labelled leather. The generator painted the real boundary
into the texture. For each class named in the spec (`labels.refine_by_colour`: a list, or {class: [classes it may trade faces
with]}), every face within `reach` of that class's border is re-decided by colour:

1. Colour of a face = median of four texture samples; compared in (r, g, b, saturation).
2. Each class has a typical colour, taken from its faces away from the border (within 40 mm of it where possible).
3. Working outward from the border, a face changes side when its colour is clearly nearer the other side's typical
   colour than its own (ratio `ratio`), and it touches a face already on that side. Dark creases, rivets and highlights
   look like neither side and do not move.

Only the named class and soft classes exchange faces, unless partners are named (they may then be rigid: a leather
bracer against a hand); generated and guide classes are untouched.
Run after the guide bore and before the border cut. env HB_CHAR = char.json spec. Rewrites <work>/character.npz and
character.json (keeps character-prerefine.*); report in character.json under report.label_refine and on stdout.

Order of work: `labels.patches` (hand corrections), the colour refine above, `snap` (every rigid piece's border onto
the crevice or colour edge where it really meets its neighbours; `labels.snap`: false, or a list of classes),
`fringe` (crevices round rigid pieces; `labels.clean_rims`), `inpaint_hidden` (surface hidden in the rest pose takes
the colour of the nearest visible surface of its class; `labels.inpaint_hidden`). Nothing moves, and nothing that can
be seen in the rest pose changes colour. Writes <work>/rest-visibility.npz (per face: open, visible)."""
import bpy, os, sys, json, shutil, heapq
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p


def texture(work):
    with bpy.data.libraries.load(os.path.join(work, "character.blend"), link=False) as (src, dst): dst.materials = list(src.materials)
    im = None
    for m in dst.materials:
        if m and m.use_nodes:
            bs = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
            if bs and bs.inputs["Base Color"].is_linked: im = bs.inputs["Base Color"].links[0].from_node.image; break
    im = im.copy(); im.scale(1024, 1024); return np.array(im.pixels[:], dtype=np.float32).reshape(1024, 1024, 4)[:, :, :3]


def face_colours(px, uv):
    """Per face: (features, rgb). rgb = median of four texture samples. Features weigh what tells materials apart and
    play down brightness: 3 x chromaticity, 0.5 x brightness, 2 x saturation. With plain rgb a white highlight on a
    steel rivet sat nearer cream cloth than grey steel, and rivets at a plate's rim were relabelled as sleeve."""
    n = px.shape[0]; out = []
    for w in ((1 / 3, 1 / 3, 1 / 3), (2 / 3, 1 / 6, 1 / 6), (1 / 6, 2 / 3, 1 / 6), (1 / 6, 1 / 6, 2 / 3)):
        q = uv[:, 0] * w[0] + uv[:, 1] * w[1] + uv[:, 2] * w[2]; out.append(px[np.clip((q[:, 1] * n).astype(int), 0, n - 1), np.clip((q[:, 0] * n).astype(int), 0, n - 1)])
    c = np.median(np.stack(out), axis=0).astype(float); sat = (c.max(1) - c.min(1)) / (c.max(1) + 1e-3); lum = c @ np.array([0.299, 0.587, 0.114])
    return np.c_[3 * c / (c.sum(1, keepdims=True) + 1e-3), 0.5 * lum, 2 * sat], c


def refine(V, tris, fcls, uv, classes, px, names, reach=0.012, ratio=0.6, local=0.04):
    """names: list of class names, or {class name: [classes it may trade faces with]} (null = any soft class)."""
    only = names if isinstance(names, dict) else {n: None for n in names}
    fcls = fcls.copy(); F, _rgb = face_colours(px, uv.astype(float)); FC = V[tris].mean(1); name2 = {c["name"]: int(i) for i, c in classes.items()}; kind = {int(i): c["kind"] for i, c in classes.items()}
    fixed = {int(i) for i, c in classes.items() if c["kind"] == "remove" or c.get("generated")}; E = {}
    for fi, t in enumerate(tris):
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E.setdefault((min(int(a), int(b)), max(int(a), int(b))), []).append(fi)
    nb = [[] for _ in range(len(tris))]
    for fs in E.values():
        if len(fs) == 2: nb[fs[0]].append(fs[1]); nb[fs[1]].append(fs[0])
    has_uv = np.abs(uv).reshape(len(tris), -1).sum(1) > 0; rep = {}
    for nme, partners in only.items():
        if nme not in name2: continue
        cid = name2[nme]; inside = fcls == cid; allowed = None if partners is None else {name2[n] for n in partners if n in name2}
        # distance of every face from the class's border, over face adjacency (both sides)
        seeds = [i for i in np.nonzero(inside)[0] if any(fcls[j] != cid for j in nb[i])] + [j for i in np.nonzero(inside)[0] for j in nb[i] if fcls[j] != cid]
        dist = {int(i): 0.0 for i in seeds}; hq = [(0.0, int(i)) for i in dist]; heapq.heapify(hq)
        while hq:
            d, i = heapq.heappop(hq)
            if d > dist.get(i, 1e9) or d > local: continue
            for j in nb[i]:
                nd = d + float(np.linalg.norm(FC[i] - FC[j]))
                if nd < dist.get(j, 1e9): dist[j] = nd; heapq.heappush(hq, (nd, j))
        dv = np.full(len(tris), 1e9); dv[list(dist)] = list(dist.values())
        def typical(mask):
            m = mask & has_uv & (dv > reach) & (dv < local)
            if m.sum() < 30: m = mask & has_uv & (dv > reach)
            if m.sum() < 30: m = mask & has_uv
            return np.median(F[m], axis=0) if m.any() else None
        mu = {cid: typical(inside)}; flips = {}; order = sorted((d, i) for i, d in dist.items() if d <= reach)
        for d, i in order:
            own = int(fcls[i])
            if own in fixed or not has_uv[i]: continue
            if own == cid:
                cand = {int(fcls[j]) for j in nb[i] if fcls[j] != cid}
            else:
                cand = {cid} if any(fcls[j] == cid for j in nb[i]) else set()
            for t in cand:
                if t in fixed: continue
                # a rigid piece trades faces only with soft classes; a soft one only with soft classes
                other = own if t == cid else t
                if allowed is None:
                    if kind.get(other) != "soft": continue                   # unnamed partners: soft classes only
                elif other not in allowed: continue                          # named partners may be rigid too (a leather bracer against a hand)
                for c_ in (own, t):
                    if c_ not in mu: mu[c_] = typical(fcls == c_)
                if mu[own] is None or mu[t] is None: continue
                d_own = float(np.linalg.norm(F[i] - mu[own])); d_t = float(np.linalg.norm(F[i] - mu[t]))
                if d_t < ratio * d_own:
                    fcls[i] = t; k = (classes[str(own)]["name"], classes[str(t)]["name"]); flips[k] = flips.get(k, 0) + 1; break
        rep[nme] = {"faces_changed": int(sum(flips.values())), "moves": {"%s -> %s" % k: v for k, v in sorted(flips.items(), key=lambda kv: -kv[1])}}
    return fcls, rep


def face_graph(tris):
    """neighbours of every face across its edges (edges with exactly two faces)"""
    E = {}
    for fi, t in enumerate(tris):
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E.setdefault((min(int(a), int(b)), max(int(a), int(b))), []).append(fi)
    nb = [[] for _ in range(len(tris))]
    for fs in E.values():
        if len(fs) == 2: nb[fs[0]].append(fs[1]); nb[fs[1]].append(fs[0])
    return nb


def ray_stats(V, tris, k=24, near=0.012, far=0.5):
    """Per face, from `k` rays over the hemisphere about its normal (rest pose, whole mesh as occluder):
      open     share of rays that meet nothing within `near` (12 mm): low in a crevice where two objects meet
      visible  share of rays that meet nothing within `far`: 0 for surface no outside view can see at rest
      gap      mean distance to what the rays meet, capped at `near` and divided by it: 1 in the open, falling to 0 at
               the floor of a crevice, where the two surfaces that form it run together"""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    bv = BVHTree.FromPolygons([tuple(q) for q in V], [tuple(int(x) for x in t) for t in tris]); FC = V[tris].mean(1)
    FN = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); FN = FN / np.maximum(np.linalg.norm(FN, axis=1, keepdims=True), 1e-18)
    u = np.clip((np.arange(k) + 0.5) / k, 0, 0.9); ct = np.sqrt(1 - u); st = np.sqrt(u); ph = (np.arange(k) + 0.5) * 2.399963; D0 = np.c_[st * np.cos(ph), st * np.sin(ph), ct]
    ref = np.where(np.abs(FN[:, :1]) < 0.9, np.array([[1.0, 0, 0]]), np.array([[0, 1.0, 0]])); T1 = np.cross(FN, ref); T1 /= np.maximum(np.linalg.norm(T1, axis=1, keepdims=True), 1e-18); T2 = np.cross(FN, T1)
    O = FC + FN * 2e-4; opn = np.zeros(len(tris)); vis = np.zeros(len(tris)); gap = np.zeros(len(tris))
    for i in range(len(tris)):
        o = Vector(O[i].tolist()); no = 0; nv = 0; g = 0.0; t1, t2, n = T1[i], T2[i], FN[i]
        for j in range(k):
            d = D0[j, 0] * t1 + D0[j, 1] * t2 + D0[j, 2] * n; hit = bv.ray_cast(o, Vector(d.tolist()), far)
            if hit[0] is None: no += 1; nv += 1; g += 1.0
            elif hit[3] > near: no += 1; g += 1.0
            else: g += hit[3] / near
        opn[i] = no / k; vis[i] = nv / k; gap[i] = g / k
    return opn, vis, gap


def camera_hidden(V, tris):
    """Per face: True when no camera can see it at rest. 17 outside directions (eight round the figure, level and from
    35 degrees above, and straight down from the top); the game's camera and the rest check look from the side and
    from above, never from below. The floor of the crevice under a helmet's rim is open to the ground and to no camera,
    and its baked shadow is near black."""
    from mathutils import Vector
    from mathutils.bvhtree import BVHTree
    import math
    bv = BVHTree.FromPolygons([tuple(q) for q in V], [tuple(int(x) for x in t) for t in tris]); FC = V[tris].mean(1)
    dirs = [Vector((math.cos(a) * c, math.sin(a) * c, s_)) for a in np.arange(8) * math.pi / 4 for c, s_ in ((1.0, 0.0), (math.cos(math.radians(35)), math.sin(math.radians(35))))] + [Vector((0.0, 0.0, 1.0))]
    out = np.ones(len(tris), bool)
    for i in range(len(tris)):
        o = Vector(FC[i].tolist())
        for d in dirs:
            if bv.ray_cast(o + d * 3e-4, d, 0.5)[0] is None: out[i] = False; break
    return out


def snap(V, tris, fcls, uv, classes, px, gap, nb, zone=0.010, sigma=0.002, wo=1.0, wc=0.5, wp=0.25, max_change=0.3, only=None):
    """Move each rigid piece's border onto the line where it really meets its neighbours.

    Two objects fused in one generated surface meet in a crevice, usually with a change of colour. Within `zone` of a
    piece's current border, on both sides, every face gets a height
        h = wo x (1 - gap)  +  wc x colour-edge  +  wp x exp(-distance from the current border / sigma)
    (gap: `ray_stats`, 0 at a crevice's floor; colour-edge: the largest colour difference to a neighbouring face, 0..1).
    The share of blocked rays is no use here: under a rolled rim it is the same all the way across, and the border
    stayed on the rim's outer edge with the rim's underside left on the wrong side. The faces outside the
    zone keep their side and flood inward, lowest heights first, so the two sides meet on the ridge of h: the crevice
    floor, or the colour edge, or, where there is neither, the border as it was. A piece narrower than twice the zone
    gets a narrower zone; a piece whose area would change by more than `max_change` is left alone.
    Faces that leave the piece take the class of the nearest face outside it. Returns (fcls, report)."""
    fcls = fcls.copy(); F, _ = face_colours(px, uv.astype(float)); FC = V[tris].mean(1); A = np.linalg.norm(np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]), axis=1) / 2
    fixed = {int(i) for i, c in classes.items() if c["kind"] == "remove" or c.get("generated")}; has_uv = np.abs(uv).reshape(len(tris), -1).sum(1) > 0
    edge = np.zeros(len(tris))
    for i in range(len(tris)):
        if nb[i] and has_uv[i]: edge[i] = min(1.0, float(np.max(np.linalg.norm(F[nb[i]] - F[i], axis=1))) / 0.6)
    rep = {}
    for cid, c in sorted(classes.items(), key=lambda kv: int(kv[0])):
        cid = int(cid)
        if c["kind"] != "rigid" or cid in fixed or (only is not None and c["name"] not in only): continue
        inside = fcls == cid
        if inside.sum() < 20: continue
        isfixed = np.isin(fcls, list(fixed))                                              # a bore's channel, a guide: never a neighbour to trade with
        seeds = [int(i) for i in np.nonzero(inside)[0] if any(fcls[j] != cid and not isfixed[j] for j in nb[i])]; seeds += [int(j) for i in seeds for j in nb[i] if fcls[j] != cid and not isfixed[j]]
        if not seeds: continue
        dist = {i: 0.0 for i in set(seeds)}; hq = [(0.0, i) for i in dist]; heapq.heapify(hq)
        while hq:
            d, i = heapq.heappop(hq)
            if d > dist.get(i, 1e9) or d > 0.03: continue
            for j in nb[i]:
                nd = d + float(np.linalg.norm(FC[i] - FC[j]))
                if nd < dist.get(j, 1e9): dist[j] = nd; heapq.heappush(hq, (nd, j))
        deep = max([d for i, d in dist.items() if inside[i]] or [0.0]); z = min(zone, 0.4 * deep)
        if z < 0.0015: rep[c["name"]] = {"skipped": "piece too small"}; continue
        zs = {i for i, d in dist.items() if d <= z and int(fcls[i]) not in fixed}
        h = {i: wo * (1.0 - gap[i]) + wc * edge[i] + wp * float(np.exp(-dist[i] / sigma)) for i in zs}
        h = {i: 0.5 * h[i] + 0.5 * float(np.mean([h[j] for j in nb[i] if j in h] or [h[i]])) for i in zs}          # one smoothing pass against ray and texture noise
        lab = {}; hq = []; n_ = 0
        for i in zs:
            for j in nb[i]:
                if j not in zs and not isfixed[j]: heapq.heappush(hq, (h[i], n_, i, 1 if fcls[j] == cid else 0)); n_ += 1
        while hq:
            lvl, _, i, l = heapq.heappop(hq)
            if i in lab: continue
            lab[i] = l
            for j in nb[i]:
                if j in zs and j not in lab: heapq.heappush(hq, (max(lvl, h[j]), n_, j, l)); n_ += 1
        gain = [i for i, l in lab.items() if l == 1 and fcls[i] != cid]; lose = [i for i, l in lab.items() if l == 0 and fcls[i] == cid]
        a0 = float(A[inside].sum()); a1 = a0 + float(A[gain].sum()) - float(A[lose].sum())
        if a0 <= 0 or abs(a1 - a0) / a0 > max_change: rep[c["name"]] = {"skipped": "area change %.2f" % ((a1 - a0) / max(a0, 1e-18))}; continue
        moves = {}
        for i in gain: k = "%s -> %s" % (classes[str(int(fcls[i]))]["name"], c["name"]); moves[k] = moves.get(k, 0) + 1
        fcls[gain] = cid; todo = set(lose); q = [i for i in lose if any(fcls[j] != cid and j not in todo for j in nb[i])]; new = {}
        while q:                                                                         # faces that leave take the nearest outside class
            nxt = []
            for i in q:
                if i in new: continue
                src = [j for j in nb[i] if (j not in todo and fcls[j] != cid and not isfixed[j]) or j in new]
                if not src: continue
                new[i] = int(new[src[0]]) if src[0] in new else int(fcls[src[0]]); nxt += [j for j in nb[i] if j in todo and j not in new]
            q = nxt
        for i, t in new.items():
            k = "%s -> %s" % (c["name"], classes[str(t)]["name"]); moves[k] = moves.get(k, 0) + 1; fcls[i] = t
        rep[c["name"]] = {"zone_mm": round(z * 1000, 1), "faces_in_zone": len(zs), "gained": len(gain), "lost": len(new), "area_change": round((a1 - a0) / a0, 4), "moves": dict(sorted(moves.items(), key=lambda kv: -kv[1])[:6])}
    return fcls, rep


def inpaint_hidden(V, tris, fcls, uv, classes, vis, nb, hidden=0.09, seen=0.3, reach=0.015, opn=None, gap=None, band=0.015, cam_hidden=None):
    """Give surface that no outside view can see in the rest pose the colour of the nearest visible surface of its own
    class. A generated texture has baked shadow, or nothing sensible, where one object covers another (under a
    helmet's flap, inside a cuff, under a plate's rim); it shows as a dark ring when the covering piece moves away.
    A face with `visible` below `hidden` takes one texel from the nearest face of its class with `visible` above
    `seen`, if one lies within `reach` along the class. Faces that can be seen at rest are never touched, so the rest
    pose looks as it did.

    Only where one piece covers another: the face must lie within `band` of a rigid piece's border along the surface,
    or in a crevice (fewer than half its rays free for 12 mm, `opn`). Surface that is hidden at rest by something
    standing off it is left alone: the skirt behind a fist held at the hip was recoloured as one flat blotch, and
    showed as soon as the arm moved (Knight, 2026-10-06). Within the band, a face at a crevice's floor (`gap` under a
    half) is also recoloured when up to a quarter of its rays escape: a rim's baked shadow runs a little way out of
    the crevice; so is a face beside a piece that no camera direction reaches (`cam_hidden`). Returns (uv, report)."""
    uv = uv.copy(); FC = V[tris].mean(1); has_uv = np.abs(uv).reshape(len(tris), -1).sum(1) > 0
    fixed = {int(i) for i, c in classes.items() if c["kind"] == "remove" or c.get("generated")}; rep = {}; total = 0
    kind = {int(i): c["kind"] for i, c in classes.items()}; near = np.zeros(len(tris), bool); bd = {}
    for i in range(len(tris)):
        ci = int(fcls[i])
        if any(int(fcls[j]) != ci and (kind.get(ci) == "rigid" or kind.get(int(fcls[j])) == "rigid") for j in nb[i]): bd[i] = 0.0
    hq = [(0.0, i) for i in bd]; heapq.heapify(hq)
    while hq:
        d, i = heapq.heappop(hq)
        if d > bd.get(i, 1e9): continue
        near[i] = True
        for j in nb[i]:
            nd = d + float(np.linalg.norm(FC[i] - FC[j]))
            if nd < band and nd < bd.get(j, 1e9): bd[j] = nd; heapq.heappush(hq, (nd, j))
    covered = near | ((opn < 0.5) if opn is not None else True)
    hid = (vis < hidden) & covered
    if gap is not None: hid |= near & (vis < 0.25) & (gap < 0.5)
    if cam_hidden is not None: hid |= near & cam_hidden                              # beside a piece and open only to the ground (the floor under a rim)
    # (Tried 2026-10-07 and removed, each made the collar under the Knight's helmet worse than plain nearest colour:
    # taking colours only from surface in the open; giving each face its neighbourhood's median colour; evening the
    # result out among neighbours. Where two materials meet under a rim they turned a plain dark band into a patchwork
    # of cream and brown spikes.)
    src = {int(i): int(i) for i in np.nonzero((vis >= seen) & ~hid & has_uv & ~np.isin(fcls, list(fixed)))[0]}; dist = {i: 0.0 for i in src}; hq = [(0.0, i) for i in src]; heapq.heapify(hq)
    while hq:
        d, i = heapq.heappop(hq)
        if d > dist.get(i, 1e9) or d > reach: continue
        for j in nb[i]:
            if fcls[j] != fcls[i]: continue
            nd = d + float(np.linalg.norm(FC[i] - FC[j]))
            if nd < dist.get(j, 1e9) and nd <= reach: dist[j] = nd; src[j] = src[i]; heapq.heappush(hq, (nd, j))
    for i, s_ in src.items():
        if i == s_ or not hid[i] or int(fcls[i]) in fixed: continue
        uv[i] = uv[s_].mean(0); n_ = classes[str(int(fcls[i]))]["name"]; rep[n_] = rep.get(n_, 0) + 1; total += 1
    # hidden faces with no visible face of their own class within reach along the class (the floor of a deep crevice,
    # a scrap of one garment under another's rim): the nearest visible face of the same kind within 20 mm, in space.
    # Left alone they stay as baked: near black, and they read as a hole when the rim lifts.
    left = np.array([i for i in np.nonzero(hid & has_uv)[0] if i not in src and int(fcls[i]) not in fixed], dtype=np.int64); far = 0
    if len(left):
        sk = np.array(sorted(i for i, s_ in src.items() if i == s_), dtype=np.int64); kf = np.array([kind.get(int(c), "soft") for c in fcls])
        for i in left:
            m_ = kf[sk] == kf[i]
            if not m_.any(): continue
            c_ = sk[m_]; d_ = np.linalg.norm(FC[c_] - FC[i], axis=1); j = int(np.argmin(d_))
            if d_[j] <= 0.02: uv[i] = uv[c_[j]].mean(0); far += 1; n_ = classes[str(int(fcls[i]))]["name"]; rep[n_] = rep.get(n_, 0) + 1
    return uv, {"faces_hidden_at_rest": int((vis < hidden).sum()), "of_them_under_or_beside_a_piece": int(((vis < hidden) & covered).sum()), "faces_recoloured": total + far, "of_them_from_another_class_nearby": far, "by_class": dict(sorted(rep.items(), key=lambda kv: -kv[1])[:14])}


def seam_sides(V, tris, fcls, classes, reach=0.01, dead=0.0005, mode="lip", lip_reach=0.006):
    """Where two rigid pieces on different joints meet in a closed seam (a bracer's cuff round a wrist), give the other
    piece the body-part faces that belong to it. The inner lip of a cuff overhangs the wrist, and its underside is
    easily labelled hand; rigid on the hand it swings out of the cuff as a ring of shards when the wrist bends.
    mode "lip" (default): body-part faces within `lip_reach` of the seam that face the seam's axis (skin faces away
    from it; the underside of an overhanging lip faces it). mode "plane": every body-part face on the other piece's
    side of the seam's plane, up to `reach`. One direction only: nothing of the other piece is given to the body
    part. Returns (fcls, report)."""
    fcls = fcls.copy(); kind = {int(i): c["kind"] for i, c in classes.items()}; bone = {int(i): c.get("bone") for i, c in classes.items()}; name = {int(i): c["name"] for i, c in classes.items()}
    body = {i for i in kind if kind[i] == "rigid" and name[i].split("_")[0] in ("hand", "head", "foot")}; FC = V[tris].mean(1); E = {}; rep = []
    for fi, t in enumerate(tris):
        c = int(fcls[fi])
        if kind.get(c) != "rigid" or classes[str(c)].get("generated"): continue
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E.setdefault((min(int(a), int(b)), max(int(a), int(b))), set()).add(c)
    seams = {}
    for (a, b), cs in E.items():
        if len(cs) == 2:
            c1, c2 = sorted(cs)
            if bone[c1] != bone[c2]: seams.setdefault((c1, c2), set()).update((a, b))
    for (c1, c2), sv in seams.items():
        bp = [c for c in (c1, c2) if c in body]
        if len(bp) != 1 or len(sv) < 12: continue
        b_ = bp[0]; o_ = c2 if b_ == c1 else c1; P = V[sorted(sv)]; ctr = P.mean(0)
        if float(np.ptp(P, axis=0).max()) < 0.02: continue
        _, sing, vt = np.linalg.svd(P - ctr); n = vt[2]; rad = float(np.linalg.norm(P - ctr, axis=1).max())
        mo = (fcls == o_) & (np.linalg.norm(FC - ctr, axis=1) < 3 * rad)
        if float((FC[mo].mean(0) - ctr) @ n) < 0: n = -n                         # n points to the other piece's side
        ax = (FC - ctr) @ n
        if mode == "plane": m = (fcls == b_) & (np.linalg.norm(FC - ctr, axis=1) < 1.5 * rad) & (ax > dead) & (ax < reach)
        else:
            rv = FC - ctr - np.outer(ax, n); rr = np.linalg.norm(rv, axis=1); FN = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); FN /= np.maximum(np.linalg.norm(FN, axis=1, keepdims=True), 1e-18)
            m = (fcls == b_) & (np.abs(ax) < lip_reach) & (rr < 2.0 * rad) & ((FN * rv).sum(1) / np.maximum(rr, 1e-9) < -0.1)
        fcls[m] = o_; rep.append({"seam": [name[b_], name[o_]], "mode": mode, "seam_vertices": len(sv), "faces_moved": int(m.sum()), "plane_fit_mm": round(float(sing[2] / np.sqrt(len(P))) * 1000, 2)})
    return fcls, rep


def fringe(V, tris, fcls, uv, classes, px, band=0.012, radius=0.005, share=0.6, dark=0.0, passes=2):
    """Clean the crevices round rigid pieces: the strip of soft surface a plate's rim covers or shades, which shows
    when the plate lifts. In a generated mesh that strip is a fringe of mixed labels (spikes of sleeve in leather) and
    of baked shadow.
      * A soft face within `band` of a rigid piece's border takes the soft class that holds more than `share` of the
        soft surface within `radius` of it, if that is not its own (spikes and slivers go; real borders stay).
      * Faces that changed are given one plain texel of their new class's typical colour.
      * `dark` > 0 also flattens faces darker than `dark` x their class's median brightness (baked crevice shadow).
        Off by default: on the Knight (0.55) it painted cream flecks on shadowed steel that was labelled sleeve.
    Returns (fcls, uv, report). Only soft faces change; nothing moves."""
    fcls = fcls.copy(); uv = uv.copy(); _feat, F = face_colours(px, uv.astype(float)); lum = F[:, :3] @ np.array([0.299, 0.587, 0.114]); FC = V[tris].mean(1)
    FN = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); A = np.linalg.norm(FN, axis=1) / 2; FN = FN / np.maximum(2 * A[:, None], 1e-18)
    kind = {int(i): c["kind"] for i, c in classes.items()}; fixed = {int(i) for i, c in classes.items() if c["kind"] == "remove" or c.get("generated")}
    fk = np.array([kind.get(int(c), "soft") for c in fcls]); softf = (fk == "soft") & ~np.isin(fcls, list(fixed)); rigf = (fk == "rigid") & ~np.isin(fcls, list(fixed)); E = {}
    for fi, t in enumerate(tris):
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E.setdefault((min(int(a), int(b)), max(int(a), int(b))), []).append(fi)
    nb = [[] for _ in range(len(tris))]
    for fs in E.values():
        if len(fs) == 2: nb[fs[0]].append(fs[1]); nb[fs[1]].append(fs[0])
    dist = {int(i): 0.0 for i in np.nonzero(softf)[0] if any(rigf[j] for j in nb[i])}; hq = [(0.0, i) for i in dist]; heapq.heapify(hq)
    while hq:
        d, i = heapq.heappop(hq)
        if d > dist.get(i, 1e9) or d > band: continue
        for j in nb[i]:
            if not softf[j]: continue
            nd = d + float(np.linalg.norm(FC[i] - FC[j]))
            if nd < dist.get(j, 1e9): dist[j] = nd; heapq.heappush(hq, (nd, j))
    cand = np.array(sorted(i for i, d in dist.items() if d <= band), dtype=np.int64); has_uv = np.abs(uv).reshape(len(tris), -1).sum(1) > 0; orig = fcls.copy()
    key = np.floor(FC / radius).astype(np.int64); grid = {}
    for i in np.nonzero(softf)[0]: grid.setdefault(tuple(key[i]), []).append(int(i))
    grid = {k: np.array(v) for k, v in grid.items()}
    for _ in range(passes):
        new = {}
        for i in cand:
            k = key[i]; c = np.concatenate([grid[(k[0] + a, k[1] + b, k[2] + e)] for a in (-1, 0, 1) for b in (-1, 0, 1) for e in (-1, 0, 1) if (k[0] + a, k[1] + b, k[2] + e) in grid])
            c = c[(np.linalg.norm(FC[c] - FC[i], axis=1) < radius) & (FN[c] @ FN[i] > 0)]
            if len(c) < 3: continue
            vals = np.unique(fcls[c]); ar = np.array([A[c][fcls[c] == v_].sum() for v_ in vals]); top = int(vals[int(np.argmax(ar))])
            if top != int(fcls[i]) and float(ar.max() / ar.sum()) > share: new[int(i)] = top
        if not new: break
        for i, t in new.items(): fcls[i] = t
    changed = cand[fcls[cand] != orig[cand]]; inband = np.zeros(len(tris), bool); inband[cand] = True; anchors = {}; med = {}
    def anchor(c):
        if c not in anchors:
            m = (fcls == c) & has_uv & ~inband
            if m.sum() < 5: m = (fcls == c) & has_uv
            anchors[c] = None
            if m.sum() >= 5:
                idx = np.nonzero(m)[0]; mu = np.median(F[idx, :3], axis=0); j = idx[int(np.argmin(((F[idx, :3] - mu) ** 2).sum(1)))]; anchors[c] = uv[j].mean(0); med[c] = float(np.median(lum[idx]))
        return anchors[c]
    darkf = [int(i) for i in cand if has_uv[i] and anchor(int(fcls[i])) is not None and lum[i] < dark * med[int(fcls[i])]] if dark > 0 else []
    flat = sorted(set(int(i) for i in changed) | set(darkf)); done = 0
    for i in flat:
        a_ = anchor(int(fcls[i]))
        if a_ is not None: uv[i] = a_; done += 1
    moves = {}
    for i in changed: k = "%s -> %s" % (classes[str(int(orig[i]))]["name"], classes[str(int(fcls[i]))]["name"]); moves[k] = moves.get(k, 0) + 1
    return fcls, uv, {"band_mm": band * 1000, "faces_in_band": int(len(cand)), "faces_relabelled": int(len(changed)), "dark_faces": len(darkf), "faces_given_plain_colour": done, "moves": dict(sorted(moves.items(), key=lambda kv: -kv[1])[:14])}


if __name__ == "__main__":
    SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); npz = os.path.join(WORK, "character.npz"); js = os.path.join(WORK, "character.json")
    names = SPEC["labels"].get("refine_by_colour", []); patches = SPEC["labels"].get("patches", [])
    d = np.load(npz); meta = json.load(open(js)); V, tris, fcls, uv = d["V"].astype(float), d["tris"].astype(np.int64), d["fcls"].copy(), d["uv"]; classes = meta["classes"]
    for k_, c_ in classes.items():                                              # the spec's overrides decide kinds here too
        c_.update(SPEC["labels"].get("overrides", {}).get(c_["name"], {}))
    # patches: hand corrections where the ID maps put a class on the wrong piece. {"box": [x0,y0,z0,x1,y1,z1] (metres,
    # working frame), "from": [class names] (optional), "to": class name, "why": text}. "to" may name a class the
    # legend does not have if the patch describes it: "class": {"kind": "soft", "region": "head"} (the throat below the
    # jaw, which a packet labels as head: rigid, it swings out as a flap when the head tips back). "facing": [x, y, z, c]
    # keeps only faces whose normal is within arccos(c) of that direction
    name2 = {c["name"]: int(i) for i, c in classes.items()}; FC = V[tris].mean(1); prep = []
    for pt in patches:
        if pt["to"] not in name2:
            nid = max(int(i) for i in classes) + 1; nc = dict(pt["class"]); nc["name"] = pt["to"]; nc["patched"] = True; nc.setdefault("colour", [1.0, 0.78, 0.55]); nc.update(SPEC["labels"].get("overrides", {}).get(pt["to"], {}))
            classes[str(nid)] = nc; name2[pt["to"]] = nid
        b_ = np.array(pt["box"], float); m_ = np.all((FC > b_[:3]) & (FC < b_[3:]), axis=1)
        if pt.get("from"): m_ &= np.isin(fcls, [name2[n] for n in pt["from"] if n in name2])
        if pt.get("facing"):                                                    # only faces that face a direction: [x, y, z, least cosine] (the underside of a jaw: [0, 0, -1, 0.3])
            fn_ = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); fn_ /= np.maximum(np.linalg.norm(fn_, axis=1, keepdims=True), 1e-18)
            dv_ = np.array(pt["facing"][:3], float); m_ &= fn_ @ (dv_ / np.linalg.norm(dv_)) >= float(pt["facing"][3])
        fcls[m_] = name2[pt["to"]]; prep.append({"to": pt["to"], "from": pt.get("from"), "faces": int(m_.sum()), "why": pt.get("why", "")})
    fnew, rep = refine(V, tris, fcls, uv, classes, texture(WORK), names) if names else (fcls, {})
    rep = {"patches": prep, "by_colour": rep}; uv = np.array(uv)
    L = SPEC["labels"]; px = texture(WORK); nb = face_graph(tris); opn = vis = gap = None
    if L.get("snap", True) or L.get("inpaint_hidden", True): opn, vis, gap = ray_stats(V, tris)
    if L.get("snap", True):
        fnew, rep["snap"] = snap(V, tris, fnew, uv, classes, px, gap, nb, only=L["snap"] if isinstance(L.get("snap"), list) else None)
    if L.get("seam_sides", True): fnew, rep["seams"] = seam_sides(V, tris, fnew, classes, mode="plane" if L.get("seam_sides") == "plane" else "lip")
    if L.get("clean_rims", True):
        cr = L.get("clean_rims"); fnew, uv, rep["rims"] = fringe(V, tris, fnew, uv, classes, px, dark=float(cr.get("dark", 0.0)) if isinstance(cr, dict) else 0.0)
    if L.get("inpaint_hidden", True):
        uv, rep["hidden"] = inpaint_hidden(V, tris, fnew, uv, classes, vis, nb, opn=opn, gap=gap, cam_hidden=camera_hidden(V, tris))
        np.savez_compressed(os.path.join(WORK, "rest-visibility.npz"), open=opn.astype(np.float32), visible=vis.astype(np.float32), gap=gap.astype(np.float32))
    # Repaint (off unless the spec asks): every face of a class takes one plain texel of another class's colour, e.g.
    # {"neck": {"from": "head", "tone": 0.7}} for a throat whose painted shadow under the chin shows as a dark block
    # when the head tips back. Unlike everything else here this changes surface that is visible at rest, so it is the
    # user's decision, and the rest check fails at that joint by design.
    for cn_, rp_ in (L.get("repaint") or {}).items():
        ids_ = {c["name"]: int(i) for i, c in classes.items()}
        if cn_ not in ids_ or rp_.get("from") not in ids_: continue
        sf_ = np.nonzero((fnew == ids_[rp_["from"]]) & (np.abs(uv).reshape(len(tris), -1).sum(1) > 0))[0]; cu_ = uv[sf_].mean(1); n_ = px.shape[0]
        col_ = px[np.clip((cu_[:, 1] * n_).astype(int), 0, n_ - 1), np.clip((cu_[:, 0] * n_).astype(int), 0, n_ - 1)].astype(float); lm_ = col_.mean(1); t_ = float(rp_.get("tone", 0.5))
        lo_, hi_ = np.quantile(lm_, [max(0.0, t_ - 0.08), min(1.0, t_ + 0.08)]); med_ = np.median(col_[(lm_ >= lo_) & (lm_ <= hi_)], axis=0); a_ = cu_[int(np.argmin(((col_ - med_) ** 2).sum(1)))]
        m_ = fnew == ids_[cn_]; uv = np.array(uv); uv[m_] = a_; rep.setdefault("repainted", {})[cn_] = {"faces": int(m_.sum()), "from": rp_["from"], "tone": t_, "texel": [float(a_[0]), float(a_[1])], "approved": rp_.get("approved", "")}
    for f in (npz, js): shutil.copyfile(f, f.replace("character.", "character-prerefine."))
    order = {int(i): (2 if c["kind"] == "rigid" else 1 if c["kind"] == "soft" else 3) for i, c in classes.items()}; vcls = np.zeros(len(V), np.int32); vpri = np.zeros(len(V), np.int32)
    for f_, t_ in enumerate(tris):
        c_ = int(fnew[f_]); pr = order.get(c_, 0)
        for v in t_:
            if pr > vpri[v]: vpri[v] = pr; vcls[v] = c_
    np.savez_compressed(npz, V=d["V"], tris=d["tris"], cls=vcls, fcls=fnew.astype(np.int32), uv=uv); meta.setdefault("report", {})["label_refine"] = rep; json.dump(meta, open(js, "w"), indent=1)
    print("LABEL_REFINE", json.dumps(rep))
