"""Make a fused single-shell character behave like layered armour.
Every rigid class (grouped by joint) is cut free from its neighbours along the label border, and the soft surface is
continued underneath the plate as an 'underlay': a copy of the plate's outer band (30 mm), welded to the surrounding
soft surface at the border and laid on the fitted template body beneath the plate (or, with no template given, relaxed
into a membrane and sunk a little). Plates can then move over cloth without tearing the cloth or opening a hole, and
what a lifted rim uncovers is the body. See `split_underlay` for over-garments and joint fills.

A class marked "underlay": "full" (a shoulder plate: it lifts off and swings away from what it covers) is built in two
layers instead:
  padding  the whole plate is copied, kept in the plate's own shape a clearance inside it and welded to the surrounding
           soft surface at the rim. It is soft: it has the body's own weights, and on top of them it rides with the
           plate as far as `ride_limited` allows (see there). It is the shoulder under the plate.
  lining   a second copy of the plate, 1.2 mm inside it and facing inward, joined to the plate at its rim and rigid on
           the plate's joint, with the plate's own texture. The plate is then a closed shell that is steel inside as
           well as outside, so it still reads as a plate when it tips and shows its underside.
Pure numpy; vertex normals are passed in."""
import heapq
import numpy as np


def split_underlay(V, tris, fcls, classes, VN, width=0.03, depth=0.0025, relax=80, pad_clear=0.0025, ride_len=0.006, lining=0.0012, body=None, fill_width=0.015, fill_depth=0.002, pad_off=0.004, band_fill=False, surf=None, min_clear=0.0005, seen=None, seen_cam=None, seam_smooth=0.003, seam_cap=0.002, tube_cap=0.006, skirts=True, sheet_strips=True, iron_cap=0.004, iron_reach=0.006):
    """Returns (V, VN, tris, fcls, vcls, classes, info, ride). ride = (ride_s [N], ride_cls [N]): how far each vertex rides
    with a plate (0..1) and which plate class; ride_cls is non-zero on padding only. ride_s here is the simple rule (full
    under the dome, fading over `ride_len` at the rim); the bind replaces it with `ride_limited` once weights exist.

    body: optional callable P[n,3] -> (nearest points on the fitted template body [n,3], distances [n]). With it, the
    underlay under a plate rim is not a relaxed membrane but the body itself: each underlay vertex moves onto the
    template body's surface (fully from 15 mm in from the rim), so what a lifted rim uncovers is a neck, a wrist, a
    shoulder with the template's own weights. The same is done:
      * under a soft over-garment's edge (a class with "over": [classes it lies over] and "cut_free": true): it is
        cut free along that border like a plate, and the under-garment continues beneath it. Tried on the Knight's
        cuirass against its sleeves (2026-10-06) and not used there: with the arms overhead the sleeve pulled clear
        of the edge and a hole opened at the front of the armpit. Without "cut_free" the two stay one surface, and
        "over" only gives the border a smooth cut and lets the bind keep the over-garment off the arm;
      * across a seam between two rigid pieces on different joints (bracer and hand), where nothing lies under the seam
        at all: a closed seam gets a cuff through it, nearly flush with the seam, in the texture of the garment the
        outer piece is worn over (the soft class it touches most; a class may name one with "fill_colour"), class
        `joint_fill`. Earlier versions: a copy of both pieces' bands laid on the body crumpled where they have relief
        (`band_fill`, off, keeps it for seams that are not a closed loop); a skin tube well inside the seam read as a plug.
    Per class: "underlay_width" (metres, default `width`), "underlay_colour" (class whose colour the deeper underlay
    takes, e.g. skin under a helmet), "underlay_colour_depth" (metres in from the rim where that starts, default 0.012)."""
    kind = {int(i): c["kind"] for i, c in classes.items()}; bone = {int(i): c.get("bone") for i, c in classes.items()}; name2 = {c["name"]: int(i) for i, c in classes.items()}
    over = {i: [name2[n] for n in classes[str(i)].get("over", []) if n in name2] for i in kind if kind[i] == "soft" and classes[str(i)].get("over") and classes[str(i)].get("cut_free")}
    # over-garments that lie over the same classes (a cuirass and its shoulder straps, both over the sleeves) form one
    # group: they are cut free from the under-garment together and stay joined to each other
    okey = {i: "O:" + "+".join(sorted(classes[str(u)]["name"] for u in over[i])) for i in over}
    group = {i: ("R:" + str(bone[i])) if kind[i] == "rigid" else ("X" if kind[i] == "remove" else (okey[i] if i in over else "S")) for i in kind}
    softg = lambda g_: g_ == "S" or g_.startswith("O:")
    wcls = {i: float(classes[str(i)].get("underlay_width", width)) for i in kind}
    fg = np.array([group[int(c)] for c in fcls]); V = V.copy(); tris = tris.copy(); tris0 = tris.copy(); N = len(V)
    under_id = max(kind) + 1; pad_id = under_id + 1; fill_id = pad_id + 1; lin_id = fill_id + 1
    newV = []; newVN = []; new_tris = []; new_fcls = []; usrc = []; udist = []          # usrc/udist: per new face, forced colour class (-1 none) and distance from the welded border
    info = {"groups": {}, "underlay_faces": 0, "padding_faces": 0, "lining_faces": 0, "joint_fills": []}
    lin_classes = {}; lin_src = []                                   # (index among the new faces, plate face it copies)
    ringv = []                                                       # (underlay vertex, the welded border vertex nearest it along the piece, distance)
    fill_local = []                                                  # (joint-fill vertex, distance round the seam, distance along it) for its texture
    fill_w = []                                                      # (joint-fill vertex, body part's joint, outer piece's joint, share on the outer piece's joint)
    tube_w = []                                                      # (tube vertex, the welded rim vertex it rises from, the piece's joint, share on the piece's joint)
    under_cls = []                                                   # (strip underlay vertex, class of the plate it lies under) for the clearance fit
    frozen = []                                                      # generated vertices that are never moved after they are built (a cuff's inner rings)
    gen_soft = []                                                    # every generated vertex (underlay, padding, fills, linings): held inside the original surface at the end
    rideS = []; rideC = []                                          # aligned with newV
    sm = lambda x: x * x * (3 - 2 * x)
    vfaces = [[] for _ in range(N)]
    for f, t in enumerate(tris):
        for v in t: vfaces[v].append(f)
    # seams between rigid pieces on different joints (found before anything is cut)
    vg = {}
    for f in np.nonzero(np.char.startswith(fg, "R:"))[0]:
        for v in tris[f]: vg.setdefault(int(v), set()).add(fg[f])
    seams = {}
    for v, gs in vg.items():
        if len(gs) >= 2:
            gl = sorted(gs)
            for a_ in range(len(gl)):
                for b_ in range(a_ + 1, len(gl)): seams.setdefault((gl[a_], gl[b_]), []).append(v)
    # Dress closed seams (a wrist) and the rims that get a tube (a helmet's) before anything is cut. Such a border runs
    # along the floor of a crevice, and as generated it wanders up and down the crevice's walls; cut free, every wander
    # is a shard or a tab on a rim when the joint bends. The border's vertices (still shared by both sides here) move
    # onto the border's own smoothed outline (radius and height about its axis, averaged along it). A seam between two
    # rigid pieces: no vertex more than `seam_cap`, and the body part's vertices next to the seam that nothing outside
    # can see (`seen` below 0.1) relax toward their neighbours. A tube's rim: only vertices nothing outside can see,
    # none more than `tube_cap`. Nothing that can be seen at rest moves far; the rest check holds this to account.
    info["seams_dressed"] = []
    def _smooth_loop(L_, sigma):
        # the loop about its own axis, and its outline smoothed round the axis (by angle, not along the loop: a rim that
        # zigzags up and down a crevice wall is long along itself and short round the axis, and only the second average
        # takes the zigzag out). sigma is in metres at the loop's mean radius
        P_ = V[L_].copy(); c_ = P_.mean(0); _, _, vt_ = np.linalg.svd(P_ - c_); n_ = vt_[2]; h_ = (P_ - c_) @ n_; rad_ = P_ - c_ - np.outer(h_, n_); r_ = np.linalg.norm(rad_, axis=1)
        e1_ = vt_[0]; e2_ = np.cross(n_, e1_); th_ = np.arctan2(rad_ @ e2_, rad_ @ e1_); dd = np.abs(th_[:, None] - th_[None, :]); dd = np.minimum(dd, 2 * np.pi - dd) * float(r_.mean())
        w_ = np.exp(-0.5 * (dd / sigma) ** 2); w_ /= w_.sum(1, keepdims=True)
        u_ = rad_ / np.maximum(r_, 1e-9)[:, None]; us_ = w_ @ u_; us_ /= np.maximum(np.linalg.norm(us_, axis=1, keepdims=True), 1e-9)
        return P_, c_, n_, h_, r_, u_, w_ @ h_, w_ @ r_, us_, w_
    tube_loops = {}
    for g in sorted(set(fg.tolist())):
        if g.startswith("R:") and any(classes[str(i)].get("underlay") == "tube" for i in kind if group[i] == g):
            tube_loops[g] = [lp for lp in _border_loops(tris0, fg, g) if len(lp) >= 24 and all(any(softg(fg[f]) for f in vfaces[v]) for v in lp)]
            for lp in tube_loops[g] if (seen is not None and tube_cap > 0) else []:
                # how far each vertex may go depends on how hidden it is (fully under 0.1 seen, not at all over 0.3), and
                # that share is itself smoothed round the rim: moving every other vertex makes a saw of a smooth rim
                L_ = np.array(lp); P_, c_, n_, h_, r_, u_, hs_, rs_, us_, w_ = _smooth_loop(L_, 0.006); Q_ = c_ + u_ * rs_[:, None] + np.outer(hs_, n_); mv = Q_ - P_; ln = np.linalg.norm(mv, axis=1)
                hid_ = np.clip((0.3 - seen(P_, VN[L_])) / 0.2, 0.0, 1.0)
                if seen_cam is not None: hid_ = np.maximum(hid_, (seen_cam(P_) == 0).astype(float))            # or no camera sees it at all (open only to the ground)
                # (moving vertices far off the outline whatever can see them was tried: it showed generated surface under the
                # jaw at rest and did not close the gap it was meant for)
                k_ = w_ @ hid_; k_ = k_ * np.minimum(1.0, tube_cap / np.maximum(ln, 1e-12)); V[L_] = P_ + mv * k_[:, None]
                info["seams_dressed"].append({"rim_of": g[2:], "rim_vertices": int(len(L_)), "share_hidden_mean": round(float(k_.mean()), 2), "moved_mm_p50_max": [round(float(np.median(ln * k_)) * 1000, 2), round(float((ln * k_).max()) * 1000, 2)]})
    for (g1, g2), sv in sorted(seams.items()):
        if len(sv) < 12 or float(np.ptp(V[sv], axis=0).max()) < 0.02 or seam_cap <= 0: continue
        loop = _seam_loop(tris0, fg, g1, g2)
        if loop is None or len(loop) < 12: continue
        L_ = np.array(loop); P_, c_, n_, h_, r_, u_, hs_, rs_, us_, w_ = _smooth_loop(L_, seam_smooth); Q_ = c_ + u_ * rs_[:, None] + np.outer(hs_, n_); mv = Q_ - P_; ln = np.linalg.norm(mv, axis=1); V[L_] = P_ + mv * np.minimum(1.0, seam_cap / np.maximum(ln, 1e-12))[:, None]
        rec = {"between": [g1[2:], g2[2:]], "seam_vertices": int(len(L_)), "moved_mm_p50_max": [round(float(np.median(np.minimum(ln, seam_cap))) * 1000, 2), round(float(np.minimum(ln, seam_cap).max()) * 1000, 2)], "rim_vertices_relaxed": 0}
        bodyc = {int(fcls[f]) for v in sv for f in vfaces[v] if classes[str(int(fcls[f]))]["name"].split("_")[0] in ("hand", "head", "foot", "skin")}
        if seen is not None and bodyc:
            inl = set(int(v) for v in L_); adj = {}
            for f in np.nonzero(np.isin(fcls, list(bodyc)))[0]:
                a, b, c = (int(x) for x in tris0[f])
                for x, y in ((a, b), (b, c), (c, a)): adj.setdefault(x, set()).add(y); adj.setdefault(y, set()).add(x)
            rim = sorted({w for v in inl for w in adj.get(v, ())} - inl); rim = [v for v in rim if not any(fg[f] not in (g1, g2) for f in vfaces[v])]
            if rim:
                rim = np.array(rim); sh = seen(V[rim], VN[rim]); rim = rim[sh < 0.1]; P0 = V[rim].copy()
                for _ in range(3):
                    tgt = np.array([V[sorted(adj[int(v)])].mean(0) for v in rim]) if len(rim) else np.zeros((0, 3)); V[rim] = V[rim] + 0.6 * (tgt - V[rim])
                    mv = V[rim] - P0; ln = np.linalg.norm(mv, axis=1); V[rim] = P0 + mv * np.minimum(1.0, seam_cap / np.maximum(ln, 1e-12))[:, None]
                rec["rim_vertices_relaxed"] = int(len(rim))
        info["seams_dressed"].append(rec)
    def to_body(ids, tfun, inv_src, off=0.0):
        """move new vertices `ids` (indices into newV) toward the body, stopping `off` short of it; tfun(gi) = share of the way (0..1)"""
        if body is None or not len(ids): return
        P_ = np.array([newV[gi] for gi in ids]); Q, _ = body(P_)
        for k_, gi in enumerate(ids):
            mv = Q[k_] - P_[k_]; L = float(np.linalg.norm(mv))
            if L <= off: continue
            mv = mv * ((L - off) / L); L -= off
            if L > 0.03: mv = mv * (0.03 / L)
            newV[gi] = P_[k_] + mv * tfun(gi)
    # Iron the crevices. Where a plate's rim sits on cloth, the cloth as generated runs up the rim's wall to meet it.
    # Cut free, that strip of cloth stands round the opening as a torn edge when the plate lifts (trousers round a knee
    # coming out of a greave's knee top). The soft surface within `iron_reach` of a rigid piece's border that nothing
    # outside can see at rest (`seen` below 0.1, or no camera direction of `seen_cam` reaches it) relaxes toward its
    # surroundings, no vertex more than `iron_cap`; the border vertices themselves (still shared here) take part. What
    # can be seen at rest does not move.
    if seen is not None and iron_cap > 0:
        soft_f = np.nonzero(np.array([softg(g_) for g_ in fg]))[0]; sadj = {}
        for f in soft_f:
            a, b, c = (int(x) for x in tris0[f])
            for x, y in ((a, b), (b, c), (c, a)): sadj.setdefault(x, set()).add(y); sadj.setdefault(y, set()).add(x)
        bset = [v for v in sadj if any(fg[f].startswith("R:") for f in vfaces[v])]; dist_ = {v: 0.0 for v in bset}; hq_ = [(0.0, v) for v in bset]; heapq.heapify(hq_)
        while hq_:
            d_, v = heapq.heappop(hq_)
            if d_ > dist_.get(v, 1e9): continue
            for w in sadj.get(v, ()):
                nd = d_ + float(np.linalg.norm(V[w] - V[v]))
                if nd < iron_reach and nd < dist_.get(w, 1e9): dist_[w] = nd; heapq.heappush(hq_, (nd, w))
        cand = np.array(sorted(v for v in dist_ if not any(fg[f] == "X" for f in vfaces[v])), dtype=np.int64)
        if len(cand):
            hid = seen(V[cand], VN[cand]) < 0.1
            if seen_cam is not None: hid |= seen_cam(V[cand]) == 0
            cand = cand[hid]; P0 = V[cand].copy(); nbr = [np.array(sorted(sadj[int(v)]), dtype=np.int64) for v in cand]
            for _ in range(6):
                tgt = np.array([V[n_].mean(0) for n_ in nbr]); Q_ = V[cand] + 0.5 * (tgt - V[cand]); mv = Q_ - P0; ln = np.linalg.norm(mv, axis=1); V[cand] = P0 + mv * np.minimum(1.0, iron_cap / np.maximum(ln, 1e-12))[:, None]
            ln = np.linalg.norm(V[cand] - P0, axis=1); info["ironed"] = {"hidden_soft_vertices_near_rims": int(len(cand)), "moved_mm_p50_p90_max": [round(float(np.percentile(ln, q_)) * 1000, 2) for q_ in (50, 90, 100)] if len(cand) else [0, 0, 0]}
    pmaps = {}                                                       # per freed group: border vertex -> the group's own copy
    def _skirt(gk, Lv, deep, flip, pname, colour=None):
        """Close the underside of a rim: faces from piece gk's own copies of the rim vertices Lv to the ring `deep` of the
        tube or cuff inside it (a ring that follows gk's joint), facing the tube. Without it a view in under the rim
        meets the inside of the piece's shell, which a renderer that draws one side only does not draw: a hole."""
        nonlocal lin_id
        pm = pmaps.get(gk, {}); n0_ = len(new_tris)
        if not skirts or any(v not in pm for v in Lv): return
        for i_ in range(len(Lv)):
            j_ = (i_ + 1) % len(Lv); p0, p1, d0, d1 = pm[Lv[i_]], pm[Lv[j_]], deep[i_], deep[j_]; srcf = next((f for f in vfaces[Lv[i_]] if fg[f] == gk), None)
            for q_ in ([p0, p1, d1], [p0, d1, d0]):
                if srcf is not None: lin_src.append((len(new_tris), int(srcf)))
                new_tris.append(q_ if flip else [q_[0], q_[2], q_[1]]); new_fcls.append(lin_id); usrc.append(-1); udist.append(0.0)
        lin_classes[str(lin_id)] = {"name": "lining_" + pname, "kind": "rigid", "bone": gk[2:], "colour": [0.3, 0.2, 0.15], "textured": True, "generated": True, "lining_of": pname, "skirt": True}
        info["lining_faces"] += len(new_tris) - n0_; info.setdefault("skirts", []).append({"under": pname, "faces": len(new_tris) - n0_, "class_id": int(lin_id), "colour_from": colour}); lin_id += 1
    order = sorted(g for g in set(fg.tolist()) if g.startswith("R:")) + sorted(g for g in set(fg.tolist()) if g.startswith("O:"))
    for g in order:
        is_over = g.startswith("O:"); gf = np.nonzero(fg == g)[0]; gv = np.unique(tris[gf])
        if is_over:
            # an over-garment is cut free only along its border with the classes it lies over; where a third class meets
            # that border the vertex stays shared, so the cut tapers shut at its ends
            und = set(u for i in over if okey[i] == g for u in over[i])
            border = [int(v) for v in gv if any(int(fcls[f]) in und for f in vfaces[v]) and all(fg[f] == g or int(fcls[f]) in und or fg[f].startswith("R:") or fg[f] == "X" for f in vfaces[v])]   # rigid pieces there have already been cut free
            soft_border = set(border); full = False
        else:
            # border verts: used by faces of this group and by faces of another, non-removed group
            border = [int(v) for v in gv if any(fg[f] != g and fg[f] != "X" for f in vfaces[v])]
            soft_border = set(v for v in border if any(softg(fg[f]) for f in vfaces[v]))
            # a class may ask for a full underlay ("underlay": "full"): the whole area under the plate is closed, for plates
            # that lift off or swing away from what they cover (shoulder plates). Default: a band along the rim.
            full = any(classes[str(i)].get("underlay") == "full" for i in kind if group[i] == g)
        if not border: info["groups"][g] = {"faces": int(len(gf)), "border": 0}; continue
        width_g = 1e9 if full else max(wcls[i] for i in kind if group[i] == g)
        force = next((name2[classes[str(i)]["underlay_colour"]] for i in sorted(kind) if group[i] == g and classes[str(i)].get("underlay_colour") in name2), -1)
        fdepth = min([float(classes[str(i)].get("underlay_colour_depth", 0.012)) for i in kind if group[i] == g] or [0.012])
        # distance from the border inside the piece (Dijkstra over its edges)
        adj = {}
        for f in gf:
            a, b, c = tris[f]
            for x, y in ((a, b), (b, c), (c, a)): adj.setdefault(x, set()).add(y); adj.setdefault(y, set()).add(x)
        dist = {v: 0.0 for v in soft_border}; srcb = {v: v for v in soft_border}; hq = [(0.0, int(v)) for v in soft_border]; heapq.heapify(hq)
        while hq:
            d, v = heapq.heappop(hq)
            if d > dist.get(v, 1e9) or d > width_g * 1.5: continue
            for w in adj.get(v, ()):
                nd = d + float(np.linalg.norm(V[w] - V[v]))
                if nd < dist.get(w, 1e9): dist[w] = nd; srcb[w] = srcb[v]; heapq.heappush(hq, (nd, int(w)))
        # A rim that runs right round a limb (a helmet's round the neck, a bracer's round the forearm) gets a tube, not a
        # strip, when a class of the piece asks for it ("underlay": "tube"): rings from the welded border into the
        # piece, narrowing to `tube_scale` of the rim's own outline. The body under a rim lies inside the rim, so the
        # tube is hidden by construction, and it is a clean surface: a copy of the rim's own faces moved onto the
        # template body kept the rim's rolls and flaps as steps and stood proud wherever the template was wider than
        # the character (the Knight's neck under its helmet).
        tubed = 0; tube_skirts = []
        if not full and not is_over and tube_loops.get(g):
            tsc = min([float(classes[str(i)].get("tube_scale", 0.62)) for i in kind if group[i] == g])
            for lp in tube_loops[g]:
                if not all(v in soft_border for v in lp): continue
                # the rings leave the rim's own outline for its smoothed outline at once (the rim's wanders would run up
                # the tube as pleats), and go over to the piece's joint within the first two rings: a tube that kept the
                # neck's weights further up was swept through by the helmet's rim when the head tipped back
                L_ = np.array(lp); P_, c_, n_, h_, r_, u_, hs_, rs_, us_, w_ = _smooth_loop(L_, 0.008); 
                flipn_ = float((V[gv].mean(0) - c_) @ n_) < 0
                if flipn_: n_ = -n_; h_ = -h_; hs_ = -hs_                                                  # n_ points into the piece
                rings = [[int(v) for v in L_]]; rd = [0.0]; nt0 = len(new_tris)
                for t_, b_, wj_, f_, sg_ in ((0.06, 0.7, 0.35, 0.22, 0.008), (0.16, 1.0, 0.8, 0.5, 0.014), (0.32, 1.0, 1.0, 0.8, 0.022), (0.55, 1.0, 1.0, 0.95, 0.032), (1.0, 1.0, 1.0, 1.0, 0.045)):
                    s_ = 1.0 - (1.0 - tsc) * f_; hf_ = 1.0 - sm(min(1.0, t_ * 2.0)); ring_ = []                  # the first ring is already 8% inside the rim: level with the rim it lay in the crevice under it
                    _, _, _, _, _, _, hs_, rs_, us_, _ = _smooth_loop(L_, sg_)                                   # rounder with every ring: a corner of the rim carried up the tube is a crease down the neck
                    if flipn_: hs_ = -hs_
                    for i_ in range(len(L_)):
                        ud_ = u_[i_] * (1 - b_) + us_[i_] * b_; ud_ = ud_ / max(float(np.linalg.norm(ud_)), 1e-9); rr_ = r_[i_] * (1 - b_) + rs_[i_] * b_; hh_ = h_[i_] * (1 - b_) + hs_[i_] * b_
                        ring_.append(N + len(newV)); gen_soft.append(ring_[-1]); newV.append(c_ + ud_ * rr_ * s_ + n_ * (hf_ * hh_ + t_ * width_g)); newVN.append(ud_); rideS.append(0.0); rideC.append(0)
                        tube_w.append((ring_[-1], int(L_[i_]), g[2:], float(wj_)))
                    rings.append(ring_); rd.append(t_ * width_g)
                P0_ = lambda v_: V[v_] if v_ < N else np.array(newV[v_ - N]); a0, b0, c0 = rings[0][0], rings[0][1], rings[1][1]
                flip = float(np.cross(P0_(b0) - P0_(a0), P0_(c0) - P0_(a0)) @ u_[0]) < 0
                for k_ in range(len(rings) - 1):
                    for i_ in range(len(L_)):
                        a_, b2_ = rings[k_][i_], rings[k_][(i_ + 1) % len(L_)]; c2, d2 = rings[k_ + 1][(i_ + 1) % len(L_)], rings[k_ + 1][i_]
                        for q_ in ([a_, b2_, c2], [a_, c2, d2]): new_tris.append([q_[0], q_[2], q_[1]] if flip else q_); new_fcls.append(under_id); usrc.append(force); udist.append(rd[k_] - fdepth + 0.012)
                tubed += len(new_tris) - nt0; tube_skirts.append(([int(v) for v in L_], rings[3], flip))
        # underlay ring faces
        ring = [] if tubed else [f for f in gf if all(dist.get(int(v), 1e9) < (1e9 if full else wcls[int(fcls[f])]) for v in tris[f])]
        umap = {}
        for f in ring:
            tri = []
            for v in tris[f]:
                v = int(v)
                if v in soft_border: tri.append(v)                                  # welded to the soft surface
                else:
                    if v not in umap:
                        if full:                                                    # padding: the plate's own shape, a clearance inside it
                            s = sm(min(1.0, dist[v] / 0.008)); r_ = sm(min(1.0, dist[v] / ride_len))
                            umap[v] = N + len(newV); newV.append(V[v] - VN[v] * pad_clear * s); newVN.append(VN[v]); rideS.append(r_); rideC.append(int(fcls[f]))
                        else:
                            s = sm(min(1.0, dist[v] / (width * 0.5)))
                            umap[v] = N + len(newV); newV.append(V[v] - VN[v] * depth * s); newVN.append(VN[v]); rideS.append(0.0); rideC.append(0); under_cls.append((umap[v], int(fcls[f])))
                    tri.append(umap[v])
            new_tris.append(tri); new_fcls.append(pad_id if full else under_id); usrc.append(-1 if full else force); udist.append(min(dist.get(int(v), 0.0) for v in tris[f]) - fdepth + 0.012)   # shifted so the bind's 12 mm rule reads this piece's own depth
        uadj = {}
        for tri in new_tris[len(new_tris) - len(ring):]:
            for x, y in ((tri[0], tri[1]), (tri[1], tri[2]), (tri[2], tri[0])): uadj.setdefault(x, set()).add(y); uadj.setdefault(y, set()).add(x)
        ids = np.array(list(umap.values()), dtype=np.int64) - N; inv = {v_: k_ for k_, v_ in umap.items()}; gen_soft += [int(x) for x in umap.values()]
        def smooth(n, keep=0.5):
            P_ = np.array(newV)
            for _ in range(n):
                Q_ = P_.copy()
                for gi in ids:
                    nb = uadj.get(N + gi)
                    if nb: Q_[gi] = keep * P_[gi] + (1 - keep) * np.mean([V[w] if w < N else P_[w - N] for w in nb], axis=0)
                P_ = Q_
            return P_
        if umap and full:
            # padding: a few smoothing passes take out rivets and the rolled rim (border fixed). With a template body it
            # is then the shoulder itself: laid `pad_off` above the body's surface (fully from 15 mm in from the rim),
            # smoothed again and kept at least the clearance under the plate. A copy of the plate's own shape sat just
            # under the steel, cut through the straps beside it and was dented wherever the plate dug in.
            P_ = smooth(6)
            for gi in ids: newV[gi] = P_[gi]
            if body is not None:
                to_body(ids, lambda gi: sm(min(1.0, dist[inv[N + gi]] / 0.015)), inv, off=pad_off); P_ = smooth(4)
                for gi in ids:
                    v0 = inv[N + gi]; s_ = sm(min(1.0, dist[v0] / 0.008)); up = float((P_[gi] - V[v0]) @ VN[v0]) + max(pad_clear * s_, min_clear)
                    newV[gi] = P_[gi] - VN[v0] * up if up > 0 else P_[gi]
            info["padding_faces"] += len(ring)
        elif umap:
            ringv += [(int(nv_), int(srcb[v0_]), float(dist[v0_])) for v0_, nv_ in umap.items()]
            if body is not None:
                # the body under the plate: onto the fitted template's surface, fully from 15 mm in from the rim
                to_body(ids, lambda gi: sm(min(1.0, dist[inv[N + gi]] / 0.015)), inv); P_ = smooth(8); sink = 0.0
            else:
                # no template body given: relax into a membrane hanging from the soft border (border fixed)
                P_ = smooth(relax, keep=0.0) if relax else np.array(newV); sink = depth
            for gi in ids:
                # never above the plate: where the soft border stands higher than the plate (a strap tab lying on a
                # breastplate) the underlay would otherwise span across on top of the steel and show as a patch
                # and never in the plate's own surface: everything but the welded edge itself lies at least `min_clear` under it.
                # A copy of the rim's faces left where they were shares the plate's surface, and two surfaces in one place
                # flicker between their colours in any renderer
                v0 = inv[N + gi]; s = min(1.0, dist[v0] / 0.008); q_ = P_[gi] - VN[v0] * sink * s; up = float((q_ - V[v0]) @ VN[v0]) + max(depth * s, min_clear)
                newV[gi] = q_ - VN[v0] * up if up > 0 else q_
        # free the piece: its faces use fresh copies of the border verts
        pmap = {}
        for v in border:
            pmap[int(v)] = N + len(newV); newV.append(V[v].copy()); newVN.append(VN[v]); rideS.append(0.0); rideC.append(0)
        for f in gf: tris[f] = [pmap.get(int(v), int(v)) for v in tris[f]]
        pmaps[g] = pmap
        for Lv_, deep_, flip_ in tube_skirts: _skirt(g, Lv_, deep_, flip_, next(classes[str(i)]["name"] for i in sorted(kind) if group[i] == g and classes[str(i)].get("underlay") == "tube"))
        lined = full or any(classes[str(i)].get("lining") for i in kind if group[i] == g)
        if lined and lining > 0:
            # lining: the plate again, a little inside itself and facing inward, sharing the plate's rim vertices. Every
            # plate with a full underlay has one; any other plate gets one with "lining": true (a greave whose knee top
            # lifts off the knee shows its inside, which a one-sided renderer draws as a hole)
            ecount = {}
            for f in gf:
                a, b, c = (int(x) for x in tris[f])
                for x, y in ((a, b), (b, c), (c, a)): ecount[(min(x, y), max(x, y))] = ecount.get((min(x, y), max(x, y)), 0) + 1
            rimv = set(v for e, n in ecount.items() if n == 1 for v in e); inv_p = {v_: k_ for k_, v_ in pmap.items()}; lmap = {}
            for f in gf:
                tri = []
                for v in tris[f]:
                    v = int(v)
                    if v in rimv: tri.append(v)
                    else:
                        if v not in lmap:
                            v0 = inv_p.get(v, v); s = min(1.0, dist.get(v0, 1.0) / 0.004)
                            lmap[v] = N + len(newV); gen_soft.append(lmap[v]); newV.append(V[v0] - VN[v0] * lining * s); newVN.append(-VN[v0]); rideS.append(0.0); rideC.append(0)   # held inside the original surface too: where the plate is a thin upstanding rim, a lining offset from one face comes out through the other
                        tri.append(lmap[v])
                lin_src.append((len(new_tris), int(f))); new_tris.append([tri[0], tri[2], tri[1]]); new_fcls.append(lin_id); usrc.append(-1); udist.append(0.0)
            pname = next(classes[str(i)]["name"] for i in sorted(kind) if group[i] == g and (classes[str(i)].get("underlay") == "full" or classes[str(i)].get("lining")))
            lin_classes[str(lin_id)] = {"name": "lining_" + pname, "kind": "rigid", "bone": g[2:], "colour": [0.45, 0.45, 0.47], "textured": True, "generated": True, "lining_of": pname}
            info["lining_faces"] += len(gf); lin_id += 1
        info["groups"][g] = {"faces": int(len(gf)), "border": len(border), "soft_border": len(soft_border), "underlay_faces": len(ring) + tubed, "full": bool(full), "over": bool(is_over), "tube": bool(tubed)}; info["underlay_faces"] += len(ring) + tubed
    # joint fills: under a seam between two rigid pieces on different joints there is no surface at all
    for (g1, g2), sv in sorted(seams.items()):
        if len(sv) < 12 or float(np.ptp(V[sv], axis=0).max()) < 0.02: continue          # a seam under 20 mm across needs no fill (a buckle on a breastplate)
        cands = sorted({int(fcls[f]) for v in sv for f in vfaces[v] if fg[f] in (g1, g2)})
        bodyc = [c for c in cands if classes[str(c)]["name"].split("_")[0] in ("hand", "head", "foot", "skin")]
        src = bodyc[0] if bodyc else min(cands, key=lambda c: int((fcls == c).sum())); fmap = {}; n0 = len(new_tris)
        loop = _seam_loop(tris0, fg, g1, g2)
        if loop is not None and len(loop) >= 12:
            # a closed seam (a wrist): a cuff of the garment worn under the outer piece, from the body part's edge 14 mm into
            # the outer piece. It stretches between the two when the joint bends. (A skin-coloured tube well inside the seam
            # read as a plug.)
            L_ = np.array(loop); c_ = V[L_].mean(0); _, _, vt_ = np.linalg.svd(V[L_] - c_); n_ = vt_[2]
            bg = g1 if any(int(fcls[f]) in bodyc for v in sv for f in vfaces[v] if fg[f] == g1) else g2          # the body part's side
            fb = [f for v in L_ for f in vfaces[v] if fg[f] == bg]; n_ = n_ if float((V[tris0[fb]].mean((0, 1)) - c_) @ n_) > 0 else -n_   # n_ points into the body part
            og = g2 if bg == g1 else g1; oc = sorted({int(fcls[f]) for v in sv for f in vfaces[v] if fg[f] == og}); garment = {}
            for f in np.nonzero(fg == og)[0]:                                             # the soft class the outer piece touches most: what it is worn over
                for v in tris0[f]:
                    for f2 in vfaces[int(v)]:
                        if fg[f2] == "S": garment[int(fcls[f2])] = garment.get(int(fcls[f2]), 0) + 1
            forced = next((name2[classes[str(c)]["fill_colour"]] for c in oc + bodyc if classes[str(c)].get("fill_colour") in name2), None)
            src = forced if forced is not None else (max(garment, key=garment.get) if garment else src)
            h_ = (V[L_] - c_) @ n_; rad_ = V[L_] - c_ - np.outer(h_, n_); rings = []; rm = float(np.linalg.norm(rad_, axis=1).mean())
            e1_ = vt_[0]; e2_ = np.cross(n_, e1_); ang_ = np.unwrap(np.arctan2(rad_ @ e2_, rad_ @ e1_))
            # Rings: the first lies on the seam itself, just inside it, and travels with the body part's edge; the rest run
            # into the outer piece, narrowing, and go over to the outer piece's joint. So the strip that shows when the
            # joint bends starts at the body part's own edge and stretches back into the cuff. (Rings of the seam's full
            # outline came out through the cuff's band at rest; rings laid inside the hand came out through its back.)
            bb_ = str(bone[bodyc[0]]) if bodyc else bg[2:]; ob_ = og[2:]
            # The inner rings leave the seam's own outline for its smoothed outline (a cuff that carried every wander of
            # the seam into the bracer shaded as pleats), and they stay where they are built: pushed about one by one
            # by the hide-at-rest step they crumpled.
            _, c2_, n2_, _, r0_, u0_, hs2_, rs2_, us2_, _ = _smooth_loop(L_, 0.006); sg_ = 1.0 if float(n2_ @ n_) > 0 else -1.0
            # Every ring goes round the axis in one direction. Where the seam doubles back on itself for a vertex or two,
            # a ring that followed it had a bow-tie there: a sliver facing the wrong way, drawn as a black line across
            # the cuff. The rings take each vertex's angle made to rise all the way round.
            sa_ = 1.0 if ang_[-1] >= ang_[0] else -1.0; am_ = ang_ * sa_
            for i_ in range(1, len(am_)): am_[i_] = max(am_[i_], am_[i_ - 1] + 2e-3)
            if am_[-1] - am_[0] > 2 * np.pi - 2e-3: am_ = am_[0] + (am_ - am_[0]) * ((2 * np.pi - 2e-3) / (am_[-1] - am_[0]))
            um_ = np.outer(np.cos(am_ * sa_), e1_) + np.outer(np.sin(am_ * sa_), e2_)
            # Depths and weights go together: when the joint closes on one side, the body part's edge travels into the outer
            # piece (about 7 mm at a wrist bent 30 degrees) and each ring follows by its share of the body part's joint.
            # A ring must still lie deeper than the one before it after that travel, or the strip between them folds
            # over and shows as a dark crease: 0.3 + 7.0 < 5 + 0.6 x 7 < 9 + 0.25 x 7 < 14. (At 3 and 7 mm with shares 1,
            # 0.5, 0 the first ring passed the second.)
            for d_, sh_, hf_, t_, b_ in ((-0.0003, 0.99, 1.0, 0.0, 0.0), (-0.005, 0.90, 0.6, 0.4, 0.7), (-0.009, 0.80, 0.35, 0.75, 1.0), (-0.014, 0.72, 0.2, 1.0, 1.0)):
                ring_ = []
                for i_ in range(len(L_)):
                    ud_ = um_[i_]; rr_ = r0_[i_] * (1 - b_) + rs2_[i_] * b_; hh_ = h_[i_] * (1 - b_) + sg_ * hs2_[i_] * b_
                    ring_.append(N + len(newV)); gen_soft.append(ring_[-1]); newV.append(c_ + ud_ * rr_ * sh_ + n_ * (hf_ * hh_ + d_)); newVN.append(ud_); rideS.append(0.0); rideC.append(0)
                    fill_local.append((ring_[-1], float(ang_[i_] * rm), float(d_))); fill_w.append((ring_[-1], bb_, ob_, float(t_)))
                    if b_ > 0: frozen.append(ring_[-1])
                rings.append(ring_)
            quads = []
            for k_ in range(len(rings) - 1):
                for i_ in range(len(L_)):
                    a_, b_ = rings[k_][i_], rings[k_][(i_ + 1) % len(L_)]; c2, d2 = rings[k_ + 1][(i_ + 1) % len(L_)], rings[k_ + 1][i_]; quads += [[a_, b_, c2], [a_, c2, d2]]
            q0 = quads[0]; nq = np.cross(np.array(newV[q0[1] - N]) - np.array(newV[q0[0] - N]), np.array(newV[q0[2] - N]) - np.array(newV[q0[0] - N])); flip = float(nq @ rad_[0]) < 0
            for q_ in quads: new_tris.append([q_[0], q_[2], q_[1]] if flip else q_); new_fcls.append(fill_id); usrc.append(src); udist.append(1.0)
            if oc: _skirt(og, [int(v) for v in L_], rings[-1], flip, classes[str(oc[0])]["name"], colour=classes[str(src)]["name"])   # the outer piece's rim to the cuff's deepest ring, in the cuff's cloth: what is seen in the mouth of a bracer is the sleeve's end
            info["joint_fills"].append({"between": [g1[2:], g2[2:]], "kind": "cuff", "seam_vertices": len(L_), "faces": len(new_tris) - n0, "colour_from": classes[str(src)]["name"]}); continue
        if not band_fill: continue                                                      # a seam that is not one closed loop gets no fill unless asked for
        for g in (g1, g2):
            gf = np.nonzero(fg == g)[0]; adj = {}
            for f in gf:
                a, b, c = (int(x) for x in tris0[f])
                for x, y in ((a, b), (b, c), (c, a)): adj.setdefault(x, set()).add(y); adj.setdefault(y, set()).add(x)
            dist = {v: 0.0 for v in sv if v in adj}; hq = [(0.0, int(v)) for v in dist]; heapq.heapify(hq)
            while hq:
                d, v = heapq.heappop(hq)
                if d > dist.get(v, 1e9) or d > fill_width * 1.5: continue
                for w in adj.get(v, ()):
                    nd = d + float(np.linalg.norm(V[w] - V[v]))
                    if nd < dist.get(w, 1e9): dist[w] = nd; heapq.heappush(hq, (nd, int(w)))
            for f in gf:
                t = [int(x) for x in tris0[f]]
                if not all(dist.get(v, 1e9) < fill_width for v in t): continue
                tri = []
                for v in t:
                    if v not in fmap: fmap[v] = N + len(newV); newV.append(V[v] - VN[v] * fill_depth); newVN.append(VN[v]); rideS.append(0.0); rideC.append(0)
                    tri.append(fmap[v])
                new_tris.append(tri); new_fcls.append(fill_id); usrc.append(src); udist.append(1.0)
        if not fmap: continue
        ids = np.array(list(fmap.values()), dtype=np.int64) - N; inv = {v_: k_ for k_, v_ in fmap.items()}
        to_body(ids, lambda gi: 1.0, inv)
        for gi in ids:                                                                   # never above either piece
            v0 = inv[N + gi]; up = float((newV[gi] - V[v0]) @ VN[v0]) + fill_depth
            if up > 0: newV[gi] = newV[gi] - VN[v0] * up
        info["joint_fills"].append({"between": [g1[2:], g2[2:]], "seam_vertices": len(sv), "faces": len(new_tris) - n0, "colour_from": classes[str(src)]["name"]})
    # Nothing generated may lie outside the surface as generated: it would show in the rest pose. Padding laid on the
    # template body stood 2 to 4 mm proud of the straps beside the Knight's shoulder plates. Any generated soft vertex
    # that is in front of the nearest original surface, or less than `min_clear` behind it, goes `min_clear` behind it.
    if surf is not None and gen_soft:
        # (not padding, and not the strips under rims: pressed vertex by vertex under the nearest surface, padding took on
        # every strap edge beside the plate and showed as a crumpled shoulder when the plate turned away. Both are hidden
        # as smooth sheets by hide_at_rest.)
        _strip = (set(v_ for v_, _c in under_cls) if sheet_strips else set()) | set(frozen)
        gi_ = np.array(sorted(v_ for v_ in set(gen_soft) if rideC[v_ - N] == 0 and v_ not in _strip), dtype=np.int64) - N; P_ = np.array([newV[i] for i in gi_]); Q_, Nn_ = surf(P_); d_ = ((P_ - Q_) * Nn_).sum(1); m_ = (d_ > -min_clear) & (np.linalg.norm(P_ - Q_, axis=1) < 0.02)
        for k_ in np.nonzero(m_)[0]: newV[gi_[k_]] = Q_[k_] - Nn_[k_] * min_clear
        info["held_inside_original_surface"] = int(m_.sum())
    V2 = np.vstack([V, np.array(newV).reshape(-1, 3)]); VN2 = np.vstack([VN, np.array(newVN).reshape(-1, 3)])
    tris2 = np.vstack([tris, np.array(new_tris, dtype=tris.dtype).reshape(-1, 3)]); fcls2 = np.concatenate([fcls, np.array(new_fcls, dtype=fcls.dtype)])
    classes2 = dict(classes); classes2[str(under_id)] = {"name": "underlay", "kind": "soft", "colour": [0.12, 0.1, 0.1]}
    if info["padding_faces"]: classes2[str(pad_id)] = {"name": "padding", "kind": "soft", "colour": [0.36, 0.2, 0.11], "textured": True}
    if info["joint_fills"]: classes2[str(fill_id)] = {"name": "joint_fill", "kind": "soft", "colour": [0.8, 0.55, 0.45], "textured": True, "generated": True}
    classes2.update(lin_classes)
    ride_s = np.zeros(len(V2)); ride_c = np.zeros(len(V2), np.int32); ride_s[N:] = np.array(rideS, float); ride_c[N:] = np.array(rideC, np.int32)
    # vertex classes from faces (after the split every vertex belongs to one group)
    pri = {"remove": 3, "rigid": 2, "soft": 1}; vcls = np.zeros(len(V2), np.int32); vp = np.zeros(len(V2), np.int32)
    for f, t in enumerate(tris2):
        c = int(fcls2[f]); k = pri[classes2[str(c)]["kind"]] if str(c) in classes2 else 0
        for v in t:
            if k > vp[v]: vp[v] = k; vcls[v] = c
    used = np.zeros(len(V2), bool); used[tris2.ravel()] = True; vcls[~used] = 0
    info["verts_added"] = int(len(V2) - N); info["unused_verts"] = int((~used).sum()); info["_lining_src"] = [(len(tris) + a, b) for a, b in lin_src]
    info["_ring"] = ringv; info["_fill_local"] = fill_local; info["_fill_w"] = fill_w; info["_tube_w"] = tube_w; info["_under_cls"] = under_cls; info["_frozen"] = frozen
    info["_under_src"] = [(len(tris) + k_, int(usrc[k_]), float(udist[k_])) for k_ in range(len(new_tris)) if new_fcls[k_] in (under_id, fill_id)]
    return V2, VN2, tris2, fcls2, vcls, classes2, info, (ride_s, ride_c)


def _border_loops(tris, fg, g):
    """The border of group g with everything else, as closed loops of vertices (each in order). Parts of the border that
    are not simple loops (a vertex with other than two border edges) are left out."""
    E = {}
    for f in np.nonzero(fg == g)[0]:
        t = tris[f]
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): k = (min(int(a), int(b)), max(int(a), int(b))); E[k] = E.get(k, 0) + 1
    adj = {}
    for (a, b), n in E.items():
        if n == 1: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    seen = set(); loops = []
    for v0 in sorted(adj):
        if v0 in seen: continue
        comp = [v0]; seen.add(v0); st = [v0]
        while st:
            x = st.pop()
            for w in adj[x]:
                if w not in seen: seen.add(w); comp.append(w); st.append(w)
        if any(len(adj[v]) != 2 for v in comp): continue
        loop = [v0]; prev = None; v = v0
        while True:
            nxt = [w for w in adj[v] if w != prev]; w = nxt[0] if nxt else adj[v][0]
            if w == v0 or len(loop) > len(comp): break
            loop.append(w); prev, v = v, w
        if len(loop) == len(comp): loops.append(loop)
    return loops


def _seam_loop(tris, fg, g1, g2):
    """The seam between two groups as one closed loop of vertices (ordered), or None."""
    E = {}
    for f, t in enumerate(tris):
        if fg[f] not in (g1, g2): continue
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E.setdefault((min(int(a), int(b)), max(int(a), int(b))), set()).add(fg[f])
    adj = {}
    for (a, b), gs in E.items():
        if len(gs) == 2: adj.setdefault(a, []).append(b); adj.setdefault(b, []).append(a)
    if not adj or any(len(v) != 2 for v in adj.values()): return None
    v0 = next(iter(adj)); loop = [v0]; prev = None; v = v0
    while True:
        nxt = [w for w in adj[v] if w != prev]; w = nxt[0] if nxt else adj[v][0]
        if w == v0: break
        loop.append(w); prev, v = v, w
        if len(loop) > len(adj): return None
    return loop if len(loop) == len(adj) else None


def ride_limited(V, tris, fcls, classes, W, rig, ride_cls, poses, helpers=(), cls=None, lam=2.0):
    """How far each padding vertex rides with its plate: as far as it can while no padding edge stretches by more than
    (1 + lam) times in any of `poses`.

    `travel` of a vertex is the distance between where the plate would carry it and where the body's own weights put
    it, the largest over the poses. Riding is free where the two agree (the arm side of a shoulder plate) and costs
    stretch where they do not (the neck side and the flanks, which lie over the torso). Ride is 0 at the welded rim and
    may grow by lam / travel per metre along the padding, so it is the shortest-path distance from the rim with that
    cost, capped at 1. Before 2026-10-06 padding rode fully everywhere and faded over the last 6 mm at the rim; with
    the arms overhead that band was pulled into sheets 5 to 20 times its length over the back of the shoulder.
    Returns (ride [N], report)."""
    import hb_lib as H, hb_helpers as HH
    pad = ride_cls > 0; pv = np.nonzero(pad)[0]; name2 = {c["name"]: int(i) for i, c in classes.items()}
    if not len(pv) or "padding" not in name2: return np.zeros(len(V)), {"padding_verts": 0}
    def skinner(rs):
        rg = dict(rig); rg["ride"] = (rs, ride_cls); rg, Wc = HH.add_helpers(V, W, rg, list(helpers), cls, classes); ix, vl = H.dense_to_top4(Wc); return rg, ix[pv], vl[pv]
    rgA, ixA, vlA = skinner(np.zeros(len(V))); rgB, ixB, vlB = skinner(pad.astype(float)); D = np.zeros(len(pv)); Vs = V[pv]
    for q in poses:
        A_, P_ = H.solve_pose(rgA, q["targets"]); D = np.maximum(D, np.linalg.norm(H.skin(Vs, ixA, vlA, rgA, A_, P_) - H.skin(Vs, ixB, vlB, rgB, A_, P_), axis=1))
    Dv = np.zeros(len(V)); Dv[pv] = D; padf = tris[fcls == name2["padding"]]; adj = {}
    for a, b in np.unique(np.sort(np.vstack([padf[:, [0, 1]], padf[:, [1, 2]], padf[:, [2, 0]]]), axis=1), axis=0): adj.setdefault(int(a), []).append(int(b)); adj.setdefault(int(b), []).append(int(a))
    dist = {v: 0.0 for v in adj if not pad[v]}; hq = [(0.0, v) for v in dist]; heapq.heapify(hq)
    while hq:
        d_, v = heapq.heappop(hq)
        if d_ > dist.get(v, 1e9) or d_ >= 1.0: continue
        for w in adj[v]:
            nd = d_ + lam * float(np.linalg.norm(V[w] - V[v])) / max(Dv[w], Dv[v], 1e-4)
            if nd < dist.get(w, 1e9): dist[w] = nd; heapq.heappush(hq, (nd, w))
    ride = np.zeros(len(V))
    for v in pv: ride[v] = min(1.0, dist.get(int(v), 1.0))
    return ride, {"stretch_limit": round(1 + lam, 2), "poses": len(poses), "padding_verts": int(len(pv)), "travel_mm_p50_p90_max": [round(float(np.percentile(D, 50)) * 1000, 1), round(float(np.percentile(D, 90)) * 1000, 1), round(float(D.max()) * 1000, 1)],
                  "ride_mean": round(float(ride[pv].mean()), 3), "share_riding_fully": round(float((ride[pv] > 0.99).mean()), 3), "share_under_0.2": round(float((ride[pv] < 0.2).mean()), 3)}


def padding_uv(V, tris, fcls, UV, classes, src_name, res=512, ride=None, anchor=None, names=("padding",), mode="planar", local=None):
    # anchor(u0, v0, u1, v1) -> (u, v): the point of the patch the rim band collapses to (a texel of the patch's typical colour)
    """Give padding faces (or the faces of the classes in `names`: padding, linings) texture coordinates inside a clean
    patch of an existing class's texture (leather for shoulder padding). The patch is the largest axis-aligned rectangle of the UV map covered only by that class; padding is laid
    out flat on its own best-fit plane at the source's texel density and mirrored back and forth to stay inside the patch."""
    name2 = {c["name"]: int(i) for i, c in classes.items()}; names = [n for n in names if n in name2]
    if not names or src_name not in name2: return UV, {"error": "no padding or no class " + str(src_name)}
    pf = np.nonzero(np.isin(fcls, [name2[n] for n in names]))[0]; sf = np.nonzero(fcls == name2[src_name])[0]; suv = UV[sf].astype(float)
    a3 = np.linalg.norm(np.cross(V[tris[sf, 1]] - V[tris[sf, 0]], V[tris[sf, 2]] - V[tris[sf, 0]]), axis=1) / 2
    e1 = suv[:, 1] - suv[:, 0]; e2 = suv[:, 2] - suv[:, 0]; auv = np.abs(e1[:, 0] * e2[:, 1] - e1[:, 1] * e2[:, 0]) / 2; ok = auv > 1e-10
    if ok.sum() < 20: return UV, {"error": "source class has no texture coordinates"}
    m_per_uv = float(np.median(np.sqrt(a3[ok] / auv[ok]))); mask = np.zeros((res, res), bool)
    for t in suv[ok]:
        p = t * res; x0, y0 = np.floor(p.min(0)).astype(int); x1, y1 = np.ceil(p.max(0)).astype(int); x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, res - 1), min(y1, res - 1)
        if x1 < x0 or y1 < y0: continue
        gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5); d = (p[1, 1] - p[2, 1]) * (p[0, 0] - p[2, 0]) + (p[2, 0] - p[1, 0]) * (p[0, 1] - p[2, 1])
        if abs(d) < 1e-12: continue
        l1 = ((p[1, 1] - p[2, 1]) * (gx - p[2, 0]) + (p[2, 0] - p[1, 0]) * (gy - p[2, 1])) / d; l2 = ((p[2, 1] - p[0, 1]) * (gx - p[2, 0]) + (p[0, 0] - p[2, 0]) * (gy - p[2, 1])) / d
        mask[y0:y1 + 1, x0:x1 + 1] |= (l1 >= 0) & (l2 >= 0) & (l1 + l2 <= 1)
    other = np.zeros((res, res), bool)                                   # texels used by any other class are not clean
    ouv = (UV[fcls != name2[src_name]].reshape(-1, 2) * res).astype(int); okp = (ouv[:, 0] >= 0) & (ouv[:, 0] < res) & (ouv[:, 1] >= 0) & (ouv[:, 1] < res) & (np.abs(UV[fcls != name2[src_name]].reshape(-1, 2)).sum(1) > 0)
    other[ouv[okp, 1], ouv[okp, 0]] = True; mask &= ~other
    h = np.zeros(res, int); best = (0, 0, 0, 0, 0)                        # largest rectangle of clean texels (histogram method)
    for y in range(res):
        h = np.where(mask[y], h + 1, 0); st = []
        for x in range(res + 1):
            cur = h[x] if x < res else 0; start = x
            while st and st[-1][1] >= cur:
                sx, sh = st.pop(); area = sh * (x - sx)
                if area > best[0] and min(sh, x - sx) >= 6: best = (area, sx, y - sh + 1, x - 1, y)
                start = sx
            st.append((start, cur))
    if best[0] == 0: return UV, {"error": "no clean patch found"}
    _, x0, y0, x1, y1 = best; cu, cv = (x0 + x1 + 1) / 2 / res, (y0 + y1 + 1) / 2 / res; hu, hv = (x1 - x0 + 1) / 2 / res * 0.85, (y1 - y0 + 1) / 2 / res * 0.85
    tri = lambda z: 1.0 - np.abs(np.mod(z + 1.0, 4.0) - 2.0); anchored = None
    if anchor is not None:
        try:
            au, av = anchor(x0 / res, y0 / res, (x1 + 1) / res, (y1 + 1) / res); hu = min(hu, au - x0 / res, (x1 + 1) / res - au) * 0.95; hv = min(hv, av - y0 / res, (y1 + 1) / res - av) * 0.95; cu, cv = au, av; anchored = [round(float(au), 4), round(float(av), 4)]
        except Exception as e: anchored = "failed: " + str(e)[:80]
    par = {}
    def find(x):
        while par.setdefault(x, x) != x: par[x] = par[par[x]]; x = par[x]
        return x
    for f in pf:
        a, b, c = (int(v) for v in tris[f]); par[find(b)] = find(a); par[find(c)] = find(a)
    UV = UV.copy(); groups = {}
    for f in pf: groups.setdefault(find(int(tris[f, 0])), []).append(f)
    for fs in groups.values():
        fs = np.array(fs); vs = np.unique(tris[fs]); P = V[vs]; c = P.mean(0); _, _, vt = np.linalg.svd(P - c)
        if local is not None and all(int(v) in local for v in vs):                 # coordinates given by whoever built the piece (round and along a cuff)
            loc = {int(v): (local[int(v)][0] / m_per_uv, local[int(v)][1] / m_per_uv) for v in vs}
        elif mode == "azimuthal":
            # a dome (shoulder padding): distance and bearing from its top, measured on a sphere through it. A flat
            # projection smears the pattern down the dome's sides.
            fn = np.cross(V[tris[fs, 1]] - V[tris[fs, 0]], V[tris[fs, 2]] - V[tris[fs, 0]]).sum(0); ap = fn / max(float(np.linalg.norm(fn)), 1e-18)
            q = P - c; perp = q - np.outer(q @ ap, ap); R0 = max(float(np.linalg.norm(perp, axis=1).max()), 1e-4); o = c - ap * R0; dvec = P - o; R = float(np.linalg.norm(dvec, axis=1).mean()); dvec = dvec / np.maximum(np.linalg.norm(dvec, axis=1, keepdims=True), 1e-18)
            e1 = np.cross(ap, [0, 0, 1.0]); e1 = e1 / max(float(np.linalg.norm(e1)), 1e-9) if np.linalg.norm(e1) > 1e-6 else np.array([1.0, 0, 0]); e2 = np.cross(ap, e1)
            ang = np.arccos(np.clip(dvec @ ap, -1, 1)); az = np.arctan2(dvec @ e2, dvec @ e1); loc = {int(v): (R * ang[k_] * np.cos(az[k_]) / m_per_uv, R * ang[k_] * np.sin(az[k_]) / m_per_uv) for k_, v in enumerate(vs)}
        else: loc = {int(v): ((V[v] - c) @ vt[0] / m_per_uv, (V[v] - c) @ vt[1] / m_per_uv) for v in vs}
        for f in fs:
            for k in range(3):
                a_, b_ = loc[int(tris[f, k])]; r_ = 1.0 if ride is None else float(ride[int(tris[f, k])])      # the rim band stretches when the plate moves: give it one even colour, not a pattern to smear
                UV[f, k] = (cu + r_ * hu * tri(a_ / hu), cv + r_ * hv * tri(b_ / hv))
    return UV, {"source": src_name, "patch_uv": [round(x0 / res, 4), round(y0 / res, 4), round((x1 + 1) / res, 4), round((y1 + 1) / res, 4)], "patch_mm": [round(2 * hu / 0.85 * m_per_uv * 1000, 1), round(2 * hv / 0.85 * m_per_uv * 1000, 1)], "metres_per_uv": round(m_per_uv, 4), "padding_faces": int(len(pf)), "pieces": len(groups), "anchor_uv": anchored}


def hide_at_rest(V, tris, gen, n0, bvh, inward, passes=8, clear=0.0005, up=0.03, down=0.012, ignore=0.0003, cap=0.012, sheet=None, taper=6, fixed=None):
    """Move generated faces under the surface as generated, so nothing built shows in the rest pose.

    Holding every generated vertex under the nearest original surface is not enough: a face whose corners lie under
    the two sides of a crevice (a helmet's rim and the collar below it, a shoulder plate's inner rim and the leather
    beside it) spans the crevice in front of its floor, and shows. So this tests points across each generated face
    (`gen`: face mask). A point is hidden when the first original surface outward along the face normal is met from
    behind (it is under a plate), and is proud when instead an original surface faces it from within `down` behind it.
    Every generated corner (index >= n0; welded corners stay) of a face with a point proud by more than `ignore` moves
    by the deepest such distance plus `clear`, in the direction `inward(points)` gives: into the body, never along the
    face normal, which near a thin rim leads out through the rim's other side. Repeats until nothing is proud; no
    corner moves more than `cap` in all.

    `sheet` (vertex mask): surfaces that are seen whole when a plate turns away (shoulder padding). Their moves are
    spread into their surroundings after every round (`taper` times: a corner moves at least the mean of its
    neighbours), so the sheet sinks as a sheet. Moved corner by corner it came out crumpled. Not for anything near
    layered thin surfaces: spread there, the moves drew vertices into the gaps between the layers and one out through
    a cheek (tried on all underlay, 2026-10-06).
    `bvh` is the original mesh. Returns V and a report."""
    from mathutils import Vector
    V0 = V.copy(); gf = np.nonzero(gen)[0]; gv = np.unique(tris[gf]); gv = gv[gv >= n0]; total = np.zeros(len(V)); D = np.zeros_like(V0)
    if fixed is not None: gv = gv[~fixed[gv]]                                         # `fixed`: generated vertices that stay where they were built
    mov = np.zeros(len(V), bool); mov[gv] = True
    if not len(gv): return V0, {"generated_vertices_moved_under_the_original_surface": 0}
    D[gv] = inward(V0[gv]); deepest = 0.0; left = 0
    bary = [(1 / 3, 1 / 3, 1 / 3), (.5, .5, 0), (0, .5, .5), (.5, 0, .5), (.8, .1, .1), (.1, .8, .1), (.1, .1, .8)]
    sv = np.zeros(len(V), bool)
    if sheet is not None: sv[gv] = sheet[gv]
    sf = gf[sv[tris[gf]].any(1)]; ea = np.concatenate([tris[sf][:, [0, 1]], tris[sf][:, [1, 2]], tris[sf][:, [2, 0]]]) if len(sf) else np.zeros((0, 2), np.int64); ea = np.vstack([ea, ea[:, ::-1]]); svi = np.nonzero(sv)[0]
    def proud(Vc):
        push = np.zeros(len(Vc)); n_left = 0; deep = 0.0
        for f in gf:
            t = tris[f]; P = Vc[t]; n = np.cross(P[1] - P[0], P[2] - P[0]); L = np.linalg.norm(n)
            if L < 1e-14 or not mov[t].any(): continue
            n = n / L; nv = Vector(n.tolist()); worst = 0.0
            for w in bary:
                q = Vector((P[0] * w[0] + P[1] * w[1] + P[2] * w[2]).tolist()); u = bvh.ray_cast(q + nv * 1e-4, nv, up)
                if u[0] is not None and u[1].dot(nv) > 0: continue                      # under an original surface
                dn = bvh.ray_cast(q - nv * 1e-4, -nv, down)
                if dn[0] is None or dn[1].dot(nv) <= 0: continue                        # nothing facing it from behind: inside a shell
                worst = max(worst, dn[3])
            if worst > ignore:
                n_left += 1; deep = max(deep, worst)
                for k in range(3):
                    if mov[t[k]]: push[t[k]] = max(push[t[k]], worst + clear)
        return push, n_left, deep
    for _ in range(passes):
        push, left, deep = proud(V0 + D * total[:, None]); deepest = max(deepest, deep); push = np.minimum(push, cap - total)
        if not (push > 1e-6).any(): break
        total = total + np.maximum(push, 0.0)
        for _t in range(taper if len(svi) else 0):
            s_ = np.zeros(len(V0)); c_ = np.zeros(len(V0)); np.add.at(s_, ea[:, 0], total[ea[:, 1]]); np.add.at(c_, ea[:, 0], 1.0)
            total[svi] = np.minimum(np.maximum(total[svi], s_[svi] / np.maximum(c_[svi], 1.0)), cap)
    return V0 + D * total[:, None], {"generated_vertices_moved_under_the_original_surface": int((total > 1e-6).sum()), "of_them_in_sheets": int((total[svi] > 1e-6).sum()), "deepest_mm": round(deepest * 1000, 2), "furthest_moved_mm": round(float(total.max()) * 1000, 2), "faces_still_proud": int(left)}
