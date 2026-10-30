"""Reduce a bound character to a triangle budget (numpy only).

A bound mesh is the generated surface cut into pieces, with underlay, linings and cuffs built under and between them:
about a hundred thousand triangles. A game skin has a budget of a tenth of that. This takes edges away one at a time,
cheapest first, always keeping one of the edge's own two vertices, so that every vertex of the result is a vertex of
the bind with its weights, its class and its place untouched. Nothing is interpolated and nothing is re-skinned.

What may not happen, and how it is prevented:
  a plate goes soft           a vertex of a rigid piece is only ever merged into another vertex of the same piece's joint
  a rim changes shape         an edge on an open border is only merged along that border, and every border edge adds a
                              plane through itself to its vertices' error, so corners of a rim are the last to go. The
                              rim of a thin sheet (a plate and its lining, a strap's edge: an edge whose two faces look
                              opposite ways) is treated the same way: without that it is drawn back into the sheet at no
                              cost and what lies under the plate shows in wedges along its edge
  a surface folds             a merge that turns a face over, or squashes it to nothing, is refused; so is one that
                              would leave a face more than about 70 degrees from the way it faced in the bind (small
                              turns over many merges otherwise add up to a face that looks inward: a hole, drawn one-sided)
  a joint loses its loops     where a vertex is weighted to more than one joint the cost of removing it is multiplied
                              (bend), so elbows, knees, shoulders, hips and wrists keep more of their triangles; and a
                              merge from one joint's surface into another's costs more again (span)
  hidden surface comes out    the line where surface that shows meets generated surface (the underlay's edge under a
                              plate's rim) may move in under the plate but never outward
  the mesh stops being a      a merge is refused unless its two vertices share exactly the neighbours their common faces
  surface                     give them (two on a surface, one on a border). A line where three surfaces meet (a skirt under
                              a rim where it lands on the underlay) is a rim like any other: its vertices leave only along it
  a mouth opens               a plate that is a tube round a limb (a bracer) is closed in the bind by the limb's own bulk in
                              its open end. Reduced, the limb is thinner there and a view from above goes past it to the
                              inside of the plate, which is not drawn: a hole. Classes named under "reduce": {"mouths": [..]}
                              in the character's spec (or --mouths) get every open rim closed with a funnel built from the
                              reduced rim, in the plate's lining class

Cost of a merge: the sum of squared distances from the kept vertex to the planes of the faces round both (area
weighted), times the multipliers: bend (1 + bend x (1 - the largest weight)), class (--weigh, e.g. head:3,hand_l:2 for
pieces whose shape reads at a distance, skirt_front_*:2 for a class and all that start like it; generated surface 0.4
where it is bound whole to one joint, because there it is never seen; at the joints it costs as much as any other).

  python hb_reduce.py --char <char.json under human-baseline> --bound <bound npz under human-baseline>
                      --faces 13500,4500 --names near,mid [--weigh head:3,hand_l:2,hand_r:2] [--bend 6]
                      (--bend may be one figure per level, e.g. 30,14)
                      [--span 4]  how many times dearer a merge is that takes a vertex of one joint's surface into
                      another joint's (it leaves faces reaching across the joint, which a bend collapses); one figure per level
                      [--rim 0.0005,0.004]  how far a rim (an open border, the edge of a thin sheet, the line where shown
                      surface meets hidden) may stray from where it ran in the bind, metres, one figure per level
Writes <work>/reduced-<name>.npz and .json (or under --out-dir, a path under human-baseline) in the bind's own format (V, tris, W, cls, fcls, ride, CN; rig and classes),
so every baseline tool reads it as a bind, and `keep` (the bind's vertex index of each vertex). Levels are nested: the
second is reduced from the first. Prints REDUCE lines."""
import argparse, json, os, sys, heapq, time, collections
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p
import hb_lib as H

GEN = ("underlay", "padding", "joint_fill")


class Mesh:
    def __init__(self, V, tris, W, fcls, classes, weigh, bend):
        self.V = V; self.F = [list(map(int, t)) for t in tris]; self.alive = np.ones(len(tris), bool); self.fcls = fcls; n = len(V)
        self.vf = [set() for _ in range(n)]
        for i, (a, b, c) in enumerate(self.F): self.vf[a].add(i); self.vf[b].add(i); self.vf[c].add(i)
        self.gone = np.zeros(n, bool); self.ver = np.zeros(n, np.int64)
        _n = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); self.nref = _n / np.maximum(np.linalg.norm(_n, axis=1, keepdims=True), 1e-30); self.REF = 0.35; self.FOLD = float(os.environ.get("HB_REDUCE_FOLD", "-0.3")); self.FOLD_RIGID = float(os.environ.get("HB_REDUCE_FOLD_RIGID", "0.0"))       # the way each face faces in the bind; a face may not end up further than acos(REF) from it
        nm = {int(k): c for k, c in classes.items()}; kind = np.array([nm[int(c)]["kind"] == "rigid" for c in fcls]); maxw = W.max(1); top = W.argmax(1)
        self.top = top; self.span = 1.0
        rig_v = np.zeros(n, bool); rig_v[tris[kind].ravel()] = True; self.rj = np.where(rig_v & (maxw > 0.999), top, -1)                 # the joint a rigid piece's vertex belongs to, or -1
        gen = np.array([(nm[int(c)]["name"] in GEN) or bool(nm[int(c)].get("lining_of")) or bool(nm[int(c)].get("generated")) for c in fcls])
        wname = {}
        for item in (weigh or "").split(","):
            if ":" in item: k_, v_ = item.split(":"); wname[k_] = float(v_)
        def wof(name):
            if name in wname: return wname[name]
            for k_, v_ in wname.items():
                if k_.endswith("*") and name.startswith(k_[:-1]): return v_
            return 1.0
        fw = np.array([wof(nm[int(c)]["name"]) for c in fcls]); vm = np.zeros(n); vg = np.zeros(n); cnt = np.zeros(n)
        for k in range(3): np.add.at(vm, tris[:, k], fw); np.add.at(vg, tris[:, k], fw * np.where(gen, 0.4, 1.0)); np.add.at(cnt, tris[:, k], 1.0)
        # generated surface is cheap to take away where it is bound whole to one joint (under a plate that moves with it, it is never seen); where the body bends
        # it is what closes the gap when a plate lifts off, and it costs what any other surface costs
        self.cmul = np.where(maxw < 0.98, vm, vg) / np.maximum(cnt, 1); self.maxw = maxw; self.set_bend(bend)
        # error quadrics: planes of the faces round each vertex, area weighted; border edges add a plane through themselves
        P0, P1, P2 = V[tris[:, 0]], V[tris[:, 1]], V[tris[:, 2]]; nrm = np.cross(P1 - P0, P2 - P0); ar = np.linalg.norm(nrm, axis=1); nn = nrm / np.maximum(ar, 1e-30)[:, None]; pl = np.concatenate([nn, -(nn * P0).sum(1, keepdims=True)], 1)
        Kf = np.einsum("fi,fj->fij", pl, pl) * (ar / 2)[:, None, None]; self.Q = np.zeros((n, 4, 4))
        for k in range(3): np.add.at(self.Q, tris[:, k], Kf)
        e = np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]]); fidx = np.tile(np.arange(len(tris)), 3); es = np.sort(e, axis=1); u, inv, c = np.unique(es, axis=0, return_inverse=True, return_counts=True); inv = inv.ravel()
        self.locked = np.zeros(n, bool); self.locked[u[c > 2].ravel()] = True                                                           # on an edge shared by more than two faces: a line where three surfaces meet (see below)
        bmask = c[inv] == 1; self.border = np.zeros(n, bool); self.border[e[bmask].ravel()] = True; self.n_border_edges = int((c == 1).sum())
        for (a, b), f in zip(e[bmask], fidx[bmask]):
            d = V[b] - V[a]; L = np.linalg.norm(d); m = np.cross(d, nn[f]); ml = np.linalg.norm(m)
            if ml < 1e-20: continue
            m /= ml; q = np.append(m, -m @ V[a]); Kb = np.outer(q, q) * (L * L) * 30.0; self.Q[a] += Kb; self.Q[b] += Kb
        # Fold edges: an edge whose two faces look nearly opposite ways (FOLD is the cosine, -0.3), or, on a rigid piece, more than a right angle apart (FOLD_RIGID, 0.0) is the rim of a sheet: where a plate's face turns into
        # its edge band, the band into the lining, the edge of a strap, a helmet's brim. (At first only edges whose faces look nearly opposite ways counted. A
        # plate with an edge band a millimetre wide has no such edge, only two square ones, and its band, which the generator paints dark, grew into black
        # wedges on the plate's face. Square creases on cloth are wrinkles and are not kept: keeping every crease over 70 degrees left the mid level short of
        # its budget and let more layers cross.)
        # The planes of its two faces say nothing about where the rim runs: both pass through it, and a vertex slid back along the sheet stays on both, so the
        # rim would be drawn back into the sheet at no cost and what lies under the plate would show in wedges along its edge. Each fold edge therefore adds a
        # plane through itself square to each of its faces, as a border edge does, and a vertex on a fold leaves only along the fold (see cost).
        order = np.argsort(inv, kind="stable"); fs_ = fidx[order]; first = np.concatenate([[0], np.cumsum(c)[:-1]]); k2 = np.nonzero(c == 2)[0]; f1, f2 = fs_[first[k2]], fs_[first[k2] + 1]
        dots_ = (nn[f1] * nn[f2]).sum(1); sharp = ((dots_ < self.FOLD) | (kind[f1] & kind[f2] & (dots_ < self.FOLD_RIGID))) & (ar[f1] > 1e-14) & (ar[f2] > 1e-14); self.n_fold_edges = int(sharp.sum())
        # The line where surface that shows meets generated surface that is meant to stay hidden (the underlay's edge, which lies a little way in under a plate's
        # rim) may not move outward: hidden surface would come out from under the plate. It may move inward freely (the surface that shows then reaches further
        # in under the plate, which nobody sees), so hidden surface costs a reduction few triangles. See cost.
        self.n_hide_edges = int(((gen[f1] != gen[f2]) & ~sharp).sum()); self.genf = gen.copy(); self.foldnb = [set() for _ in range(n)]
        # Borders, folds and these lines are all "rims" below. A rim may not stray further than rim_tol from where it ran in the bind: each rim edge carries how
        # far the rim vertices already merged away along it lay from it, and a merge that would take that past rim_tol is refused (see cost). Without a hard
        # limit the budget is met by cutting the corners off rims, a plate's edge is drawn back by millimetres and what lies under it shows.
        self.rimdev = {}; self.rim_tol = float("inf")
        for a, b in e[bmask]: self.foldnb[int(a)].add(int(b)); self.foldnb[int(b)].add(int(a))
        # A line where more than two faces share each edge (a skirt's lower edge on the underlay, 127 edges under the helmet) was left alone altogether at first.
        # Every vertex on it then outlives the reduction and holds its ring of faces with it: a tenth of the 4,500 triangle level sat round that one unseen
        # line. It is a rim too: a vertex on it leaves only along it, the faces on the merged edge go (three, not two), and it may stray no further than rim_tol.
        for k in np.nonzero(c > 2)[0]:
            a, b = int(u[k][0]), int(u[k][1]); self.foldnb[a].add(b); self.foldnb[b].add(a); d = V[b] - V[a]; L = np.linalg.norm(d)
            for f in fs_[first[k]:first[k] + c[k]]:
                m = np.cross(d, nn[f]); ml = np.linalg.norm(m)
                if ml < 1e-20: continue
                m /= ml; q = np.append(m, -m @ V[a]); Kb = np.outer(q, q) * (L * L) * 30.0; self.Q[a] += Kb; self.Q[b] += Kb
        for (a, b), fa_, fb_ in zip(u[k2[sharp]], f1[sharp], f2[sharp]):
            a, b = int(a), int(b); self.foldnb[a].add(b); self.foldnb[b].add(a); d = V[b] - V[a]; L = np.linalg.norm(d)
            for f in (fa_, fb_):
                m = np.cross(d, nn[f]); ml = np.linalg.norm(m)
                if ml < 1e-20: continue
                m /= ml; q = np.append(m, -m @ V[a]); Kb = np.outer(q, q) * (L * L) * 30.0; self.Q[a] += Kb; self.Q[b] += Kb
        self.nfaces = int(len(tris))

    def set_bend(self, bend): self.mult = self.cmul * (1.0 + bend * (1.0 - self.maxw))

    def neighbours(self, v):
        out = set()
        for f in self.vf[v]: out.update(self.F[f])
        out.discard(v); return out

    def is_border_edge(self, a, b): return len(self.vf[a] & self.vf[b]) == 1

    def cost(self, u, v):
        """cost of merging u into v (v stays), or None if it may not be done"""
        if self.rj[u] >= 0 and self.rj[u] != self.rj[v]: return None
        shared = self.vf[u] & self.vf[v]; ns = len(shared); seam = bool(self.locked[u] and self.locked[v] and ns > 2)                     # along a line where three surfaces meet
        if ns == 0 or (ns > 2 and not seam) or (self.locked[u] and not seam): return None                                              # a vertex on such a line leaves only along it (and then as a rim vertex, below)
        if self.border[u] and ns != 1 and not seam: return None                                                                        # a border vertex leaves only along its border
        gu = [self.genf[f] for f in self.vf[u]]
        if any(gu) and not all(gu):                                                                                                    # u stands on the line between shown and hidden surface: it may go along that line, or in under (to a vertex of hidden surface only), never out
            if not all(self.genf[f] for f in self.vf[v]):
                sh = [self.genf[f] for f in shared]
                if not (len(sh) == 2 and sh[0] != sh[1]): return None
        if self.foldnb[u]:
            if v not in self.foldnb[u] or len(self.foldnb[u]) > 2: return None                                                         # a vertex on a rim leaves only along the rim; one where rims meet stays
            if len(self.foldnb[u]) == 2:                                                                                               # ... and only if the rim then still runs within rim_tol of where it ran
                w = next(x for x in self.foldnb[u] if x != v)
                if self.rim_after(u, v, w) > self.rim_tol: return None
        if not self.border[u] and ns != 2 and not seam: return None
        q = np.append(self.V[v], 1.0); return float(q @ (self.Q[u] + self.Q[v]) @ q) * float(self.mult[u]) * (self.span if self.top[u] != self.top[v] else 1.0)     # (a merge from one joint's surface into another's leaves faces that reach across the joint, and those are the ones a bend collapses)

    def rim_after(self, u, v, w):
        """how far the rim would have strayed along its new edge (w, v) once u is merged into v: u's own distance from that edge, on top of what the two edges it replaces already carry"""
        a, b, q = self.V[w], self.V[v], self.V[u]; ab = b - a; t = min(1.0, max(0.0, float((q - a) @ ab) / max(float(ab @ ab), 1e-30)))
        return float(np.linalg.norm(q - (a + t * ab))) + max(self.rimdev.get((min(u, w), max(u, w)), 0.0), self.rimdev.get((min(u, v), max(u, v)), 0.0))

    def can(self, u, v):
        shared = self.vf[u] & self.vf[v]; nu, nv = self.neighbours(u), self.neighbours(v)
        if len(nu & nv) != len(shared): return False                                                                                   # the two share exactly the neighbours their common faces give them
        Vv = self.V
        for f in self.vf[u] - shared:
            a, b, c = self.F[f]; p0, p1, p2 = Vv[a], Vv[b], Vv[c]; n0 = np.cross(p1 - p0, p2 - p0)
            q0, q1, q2 = (Vv[v] if a == u else p0), (Vv[v] if b == u else p1), (Vv[v] if c == u else p2); n1 = np.cross(q1 - q0, q2 - q0); l0, l1 = np.linalg.norm(n0), np.linalg.norm(n1)
            if l1 < 1e-14 or (l0 > 1e-14 and float(n0 @ n1) < 0.2 * l0 * l1): return False                                                 # a face would turn over or vanish
            if float(n1 @ self.nref[f]) < self.REF * l1: return False                                                                    # ... or would end up turned too far from the way it faced in the bind (each merge may turn a face a little: without this the turns add up until it faces backward)
        return True

    def merge(self, u, v):
        shared = self.vf[u] & self.vf[v]
        for f in shared:
            self.alive[f] = False
            for w in self.F[f]: self.vf[w].discard(f)
        for f in list(self.vf[u]):
            self.F[f] = [v if w == u else w for w in self.F[f]]; self.vf[v].add(f)
        if len(self.foldnb[u]) == 2 and v in self.foldnb[u]:
            w = next(x for x in self.foldnb[u] if x != v); self.rimdev[(min(w, v), max(w, v))] = self.rim_after(u, v, w)
        for w in self.foldnb[u]:                                                                                                       # u's place on its rim is taken by v
            self.foldnb[w].discard(u)
            if w != v: self.foldnb[w].add(v); self.foldnb[v].add(w)
        self.foldnb[u] = set()
        self.vf[u] = set(); self.gone[u] = True; self.Q[v] = self.Q[v] + self.Q[u]; self.ver[v] += 1; self.ver[u] += 1; self.nfaces -= len(shared)
        if self.border[u]: self.border[v] = True
        return self.neighbours(v)


def reduce(M, target, say=None):
    heap = []; tick = 0
    def push(u, v):
        nonlocal tick
        c = M.cost(u, v)
        if c is not None: tick += 1; heapq.heappush(heap, (c, tick, u, v, int(M.ver[u]), int(M.ver[v])))
    for u in range(len(M.V)):
        if M.gone[u]: continue
        for v in M.neighbours(u): push(u, v)
    done = refused = 0; t0 = time.time()
    while M.nfaces > target and heap:
        c, _, u, v, su, sv = heapq.heappop(heap)
        if M.gone[u] or M.gone[v] or M.ver[u] != su or M.ver[v] != sv: continue
        if M.cost(u, v) is None: continue                                                           # the faces round it have changed since it was queued
        if not M.can(u, v): refused += 1; continue
        ring = M.merge(u, v); done += 1                                                             # only the kept vertex's error changed: only its edges are costed again
        for x in ring: push(v, x); push(x, v)
        if say and done % 10000 == 0: say("  %d merges, %d faces left (%.0f s)" % (done, M.nfaces, time.time() - t0))
    return {"merges": done, "refused": refused, "faces": M.nfaces, "reached": M.nfaces <= target, "last_cost": c if done else None}


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--char", required=True); ap.add_argument("--bound", required=True); ap.add_argument("--faces", default="13500,4500"); ap.add_argument("--names", default="near,mid"); ap.add_argument("--weigh", default="head:3,hand_l:2,hand_r:2"); ap.add_argument("--bend", default="6"); ap.add_argument("--out-dir", dest="out_dir", default=None); ap.add_argument("--rim", default="0.0005,0.004"); ap.add_argument("--span", default="4"); ap.add_argument("--mouths", default=None); a = ap.parse_args(); bends = [float(x) for x in str(a.bend).split(",")]; rims = [float(x) for x in str(a.rim).split(",")]
    SPEC = json.load(open(p(*a.char.split("/")))); WORK = p(*SPEC["work"].split("/")); bp = p(*a.bound.split("/")); d = np.load(bp); meta = json.load(open(bp[:-4] + ".json")); classes = meta["classes"]
    V = d["V"].astype(float); tris = d["tris"].astype(np.int64); W = d["W"].astype(float); fcls = d["fcls"]
    # A plate's lining is the plate again, 1.2 mm inside itself and facing inward (hb_split.py). Reduced by itself it ends up with its own
    # corners, and where the plate is hollow its flat faces stand in front of the plate's: culled from outside, but throwing their shadow on the plate. So
    # linings of that kind are left out here and built again from each level's own reduced plate (below); their faces count toward the level's budget.
    nm0 = {int(k): c for k, c in classes.items()}; byname = {c["name"]: k for k, c in nm0.items()}; LINED = {k: byname[c["lining_of"]] for k, c in nm0.items() if c.get("lining_of") and not c.get("skirt") and c["lining_of"] in byname}
    if LINED: keep_f = ~np.isin(fcls, list(LINED)); tris = tris[keep_f]; fcls = fcls[keep_f]
    # Mouths (see the top of this file): plates whose open rims are closed with a funnel at each level. The funnel is a class of its own, "mouth_<plate>",
    # bound like the plate and painted as the plate's lining if it has one (a bracer's is the cuff's cloth, one texel), else as the plate, darkened by
    # "mouth_tone" (0.6): what is seen in a mouth is in the plate's shadow, and at the lining's own tone the funnel reads as a pale lid.
    MOUTHS = {}; classes = dict(classes); RS = SPEC.get("reduce", {})
    for m in (a.mouths.split(",") if a.mouths is not None else RS.get("mouths", [])):
        if m not in byname: continue
        lin = next((c["name"] for c in nm0.values() if c.get("lining_of") == m), m); new_id = max(int(k) for k in classes) + 1; MOUTHS[byname[m]] = new_id
        classes[str(new_id)] = {"name": "mouth_" + m, "kind": "rigid", "bone": nm0[byname[m]]["bone"], "colour": [0.25, 0.2, 0.17], "textured": True, "generated": True, "lining_of": m, "skirt": True, "mouth": True, "paint_as": lin, "tone": float(RS.get("mouth_tone", 0.6))}
    def open_rims(Tall, Fall, pid):
        """the open rims of class pid in a mesh: closed loops of edges that belong to one face only, each as the vertices in the order that face runs them"""
        e_ = np.concatenate([Tall[:, [0, 1]], Tall[:, [1, 2]], Tall[:, [2, 0]]]); ff = np.tile(np.arange(len(Tall)), 3); es_ = np.sort(e_, axis=1); _, inv_, c_ = np.unique(es_, axis=0, return_inverse=True, return_counts=True); one = (c_[inv_.ravel()] == 1) & (Fall[ff] == pid)
        nxt = {int(x): int(y) for x, y in e_[one]}; loops = []
        while nxt:
            s0 = next(iter(nxt)); L_ = [s0]; x = nxt.pop(s0)
            while x != s0 and x in nxt: L_.append(x); x = nxt.pop(x)
            if x == s0 and len(L_) >= 3: loops.append(L_)
        return loops
    M = Mesh(V, tris, W, fcls, classes, a.weigh, bends[0])
    print("REDUCE from %s: %d vertices, %d faces, %d border edges, %d fold edges (rims of thin sheets), %d edges where shown surface meets hidden, %d vertices locked (edges shared by more than two faces)" % (a.bound, len(V), len(tris), M.n_border_edges, M.n_fold_edges, M.n_hide_edges, int(M.locked.sum())), flush=True)
    for lv, (target, name) in enumerate(zip([int(x) for x in a.faces.split(",")], a.names.split(","))):
        bend_lv = bends[min(lv, len(bends) - 1)]; M.set_bend(bend_lv); M.rim_tol = rims[min(lv, len(rims) - 1)]; M.span = [float(x) for x in str(a.span).split(",")][min(lv, len(str(a.span).split(",")) - 1)]
        def lined_now():                                                                           # faces still to be added to what the reduction leaves: a lining face for every face of a lined plate, a funnel face for every edge of a mouth
            fa_ = np.nonzero(M.alive)[0]; n_ = int(np.isin(fcls[fa_], list(set(LINED.values()))).sum())
            if MOUTHS: Ta_ = np.array([M.F[f] for f in fa_], np.int64); n_ += sum(len(L_) for pid in MOUTHS for L_ in open_rims(Ta_, fcls[fa_], pid))
            return n_
        ratio = lined_now() / max(M.nfaces, 1); r = reduce(M, int(target / (1 + ratio) * 1.04), say=lambda s: print(s, flush=True))      # the linings to come are as many faces as their plates then have: first to a little over where both should fit,
        for _ in range(16):                                                                         # then down by what is over until they do
            over = M.nfaces + lined_now() - target
            if over <= 0: break
            r2 = reduce(M, M.nfaces - max(1, int(np.ceil(over / (1 + ratio))))); r["merges"] += r2["merges"]; r["refused"] += r2["refused"]
            if not r2["merges"]: break
        fa = np.nonzero(M.alive)[0]; T = np.array([M.F[f] for f in fa], np.int64); keep = np.unique(T); remap = np.full(len(V), -1, np.int64); remap[keep] = np.arange(len(keep)); T2 = remap[T]; V2 = V[keep]; F2 = fcls[fa]
        Wk = W[keep]; clsk = d["cls"][keep]; extra = {k: d[k][keep] for k in ("ride", "ride_cls") if k in d.files}; lin_rep = {}
        for lid, pid in LINED.items():
            gf = np.nonzero(F2 == pid)[0]
            if not len(gf): continue
            Tg = T2[gf]; e = np.sort(np.concatenate([Tg[:, [0, 1]], Tg[:, [1, 2]], Tg[:, [2, 0]]]), axis=1); ue, cnt = np.unique(e, axis=0, return_counts=True); rimv = np.unique(ue[cnt == 1]); inner = np.unique(Tg)      # (every vertex of the plate gets a lining vertex of its own, the rim's too)
            fnp = np.cross(V2[Tg[:, 1]] - V2[Tg[:, 0]], V2[Tg[:, 2]] - V2[Tg[:, 0]]); fa_ = np.linalg.norm(fnp, axis=1); fu_ = fnp / np.maximum(fa_[:, None], 1e-30)
            # which way is in: along the plate's faces round the vertex, counting only those that look within 75 degrees of the largest of them (at a corner of
            # the plate's edge band the band's own faces look sideways and would turn the lining out through the plate)
            big = np.full(len(V2), -1, np.int64); bigA = np.zeros(len(V2))
            for k in range(3):
                for f_, v_ in enumerate(Tg[:, k]):
                    if fa_[f_] > bigA[v_]: bigA[v_] = fa_[f_]; big[v_] = f_
            vnp = np.zeros((len(V2), 3))
            for k in range(3):
                okk = (fu_ * fu_[big[Tg[:, k]]]).sum(1) > 0.25; np.add.at(vnp, Tg[okk, k], fnp[okk])
            vnp /= np.maximum(np.linalg.norm(vnp, axis=1, keepdims=True), 1e-30)
            dist = np.sqrt(((V2[inner][:, None, :] - V2[rimv][None, :, :]) ** 2).sum(-1)).min(1) if len(rimv) else np.full(len(inner), 1.0); sc = np.minimum(1.0, dist / 0.004)
            # 0.3 mm in at the rim and 1.2 mm in from 4 mm inside it. (The bind's lining shares the plate's rim. At a low level of detail most of a plate's
            # vertices are on its rim, the lining would lie in the plate's own faces, and two faces in one place shadow each other.)
            lmap = np.arange(len(V2)); lmap[inner] = len(V2) + np.arange(len(inner)); newV = V2[inner] - vnp[inner] * (0.0003 + 0.0009 * sc)[:, None]
            V2 = np.concatenate([V2, newV]); Wk = np.concatenate([Wk, Wk[inner]]); clsk = np.concatenate([clsk, np.full(len(inner), lid, clsk.dtype)]); keep = np.concatenate([keep, keep[inner]]); extra = {k: np.concatenate([v, v[inner]]) for k, v in extra.items()}
            T2 = np.concatenate([T2, lmap[Tg][:, [0, 2, 1]]]); F2 = np.concatenate([F2, np.full(len(gf), lid, F2.dtype)]); lin_rep[classes[str(lid)]["name"]] = int(len(gf))
        mouth_rep = {}
        for pid, lid in MOUTHS.items():
            pv_ = np.unique(T2[F2 == pid])
            for L_ in open_rims(T2, F2, pid):
                R_ = V2[L_]; c0 = R_.mean(0); nn_ = np.zeros(3)
                for i_ in range(len(L_)): nn_ += np.cross(R_[i_] - c0, R_[(i_ + 1) % len(L_)] - c0)
                rad = float(np.linalg.norm(R_ - c0, axis=1).mean())
                if np.linalg.norm(nn_) < 1e-12 or rad < 0.005: continue                               # not a mouth: a slit, or a hole a few millimetres across
                nn_ /= np.linalg.norm(nn_); nin = nn_ if float((V2[pv_].mean(0) - c0) @ nn_) > 0 else -nn_   # into the plate: toward the middle of it
                # the funnel's point: on the mouth's axis, three quarters of the mouth's radius inside it. From each rim edge a face to that point, running the
                # edge the other way than the plate's face does, so the surface carries on over the rim and looks out of the mouth
                apex = len(V2); V2 = np.concatenate([V2, (c0 + nin * 0.75 * rad)[None]]); Wk = np.concatenate([Wk, Wk[L_[:1]]]); clsk = np.concatenate([clsk, np.full(1, lid, clsk.dtype)]); keep = np.concatenate([keep, keep[L_[:1]]]); extra = {k: np.concatenate([v, v[L_[:1]]]) for k, v in extra.items()}
                nf_ = np.array([[L_[(i_ + 1) % len(L_)], L_[i_], apex] for i_ in range(len(L_))], np.int64); T2 = np.concatenate([T2, nf_]); F2 = np.concatenate([F2, np.full(len(nf_), lid, F2.dtype)])
                fn_ = np.cross(V2[nf_[:, 1]] - V2[nf_[:, 0]], V2[nf_[:, 2]] - V2[nf_[:, 0]]); mouth_rep.setdefault(classes[str(pid)]["name"], []).append({"rim_edges": len(L_), "radius_mm": round(rad * 1000, 1), "faces_looking_out_of_the_mouth": int(((fn_ @ nin) < 0).sum())})
        r["faces"] = int(len(T2)); r["reached"] = bool(len(T2) <= target); r["linings_built_from_the_reduced_plates"] = lin_rep; r["mouths_closed"] = mouth_rep
        nm = {int(k): c for k, c in classes.items()}; by = collections.Counter(nm[int(c)]["name"] for c in F2); gen = sum(n for k, n in by.items() if k in GEN or k.startswith("lining_")); rigid = sum(n for k, n in by.items() if any(nm[i]["name"] == k and nm[i]["kind"] == "rigid" for i in nm))
        e = np.sort(np.concatenate([T2[:, [0, 1]], T2[:, [1, 2]], T2[:, [2, 0]]]), axis=1); _, c_ = np.unique(e, axis=0, return_counts=True)
        r.update({"name": name, "target": target, "vertices": int(len(keep)), "faces_generated": int(gen), "faces_rigid": int(rigid), "border_edges": int((c_ == 1).sum()), "edges_shared_by_more_than_two": int((c_ > 2).sum()), "from": a.bound, "weigh": a.weigh, "bend": bend_lv, "rim_tol_mm": M.rim_tol * 1000, "rim_strayed_mm_max": round(max(M.rimdev.values() or [0.0]) * 1000, 3),
                  "faces_by_class": dict(sorted(by.items(), key=lambda kv: -kv[1]))})
        CN = H.corner_normals_lod(V2, T2, F2, classes).astype(np.float16)                           # (not corner_normals: see hb_lib)
        out = os.path.join(p(*a.out_dir.split("/")) if a.out_dir else WORK, "reduced-%s" % name); np.savez_compressed(out + ".npz", V=V2, tris=T2, W=Wk.astype(np.float32), cls=clsk, fcls=F2, CN=CN, keep=keep, **extra)
        m2 = dict(meta); m2["classes"] = classes; m2["reduce"] = r; json.dump(m2, open(out + ".json", "w"), indent=1)
        print("REDUCE %-5s %d faces (%d vertices) after %d merges, %d refused; generated %d, rigid %d; border edges %d (bind %d); reached target: %s" % (name, r["faces"], r["vertices"], r["merges"], r["refused"], gen, rigid, r["border_edges"], M.n_border_edges, r["reached"]), flush=True)
