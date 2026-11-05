"""Cut the mesh along smooth plate borders (numpy only).

A generated mesh has no edges along the rim of a plate, so a border drawn by labelling whole triangles is a saw: teeth
several millimetres long. Once the plate is cut free and moves, every tooth shows as a torn shard. This tool gives each
rigid piece a smooth border without moving any vertex:

1. For the piece, give every vertex the share of its surrounding surface that is labelled as the piece (0..1) and smooth
   that value over a few rings near the border.
2. The border is where the smoothed value crosses one half. Triangles it crosses are split along it (new vertices lie
   on existing edges, so the surface is unchanged; texture coordinates are interpolated).
3. Faces are relabelled by the side of the line they are on, which also removes spikes and islands near the border.

A piece whose area would change by more than `max_change` is left as it was.

Before the cut, `close_labels` closes slits, notches and holes in each rigid piece and removes its spikes.

4. Stray islands are then removed (`merge_islands`): a small patch of a rigid class away from the piece itself (it would
   stay stiff inside moving cloth) goes to the class around it, and a small patch of a soft class enclosed by a rigid
   piece (it would stay behind as a hole when the piece moves) joins the piece.

env HB_CHAR = char.json spec. Reads and rewrites <work>/character.npz and character.json (keeps character-precut.*);
writes <work>/border-cut.json."""
import os, sys, json, shutil
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from hb_common import p


def perimeter(V, tris, mask):
    E = {}
    for fi in np.nonzero(mask)[0]:
        a, b, c = (int(x) for x in tris[fi])
        for x, y in ((a, b), (b, c), (c, a)): k = (min(x, y), max(x, y)); E[k] = E.get(k, 0) + 1
    return float(sum(np.linalg.norm(V[a] - V[b]) for (a, b), n in E.items() if n == 1))


def cut_class(V, tris, fcls, uv, cid, iters=10, rings=3, max_change=0.2, protect=(), against=None):
    """protect: class ids whose faces are never split or relabelled (a guide not yet bored, a bore's channel).
    against: class ids; cut only the part of the border the piece shares with these classes (an over-garment's edge
    against the garment under it). Faces of any other class, and everything away from that border, keep their labels."""
    nV = len(V); inside = fcls == cid; A = np.linalg.norm(np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]), axis=1) / 2
    prot = np.isin(fcls, list(protect)); free = ~prot
    num = np.zeros(nV); den = np.zeros(nV); np.add.at(num, tris[inside].ravel(), np.repeat(A[inside], 3)); np.add.at(den, tris[free].ravel(), np.repeat(A[free], 3)); phi = num / np.maximum(den, 1e-18)
    E = np.unique(np.sort(np.vstack([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]]), axis=1), axis=0)
    active = (phi > 0) & (phi < 1); zone_f = np.ones(len(tris), bool)
    if against is not None:
        ag = np.isin(fcls, list(against)); va = np.zeros(nV, bool); va[tris[ag].ravel()] = True; vi = np.zeros(nV, bool); vi[tris[inside].ravel()] = True; active &= va & vi
    if not active.any(): return None
    for _ in range(rings):
        grow = active.copy(); grow[E[active[E[:, 0]], 1]] = True; grow[E[active[E[:, 1]], 0]] = True; active = grow
    if against is not None:
        zone_f = active[tris].all(1) & (inside | ag)                                  # only faces of the two garments, inside the smoothed band
        hold = np.zeros(nV, bool); hold[tris[~zone_f].ravel()] = True; active &= ~hold    # vertices shared with anything outside the band keep their value, so the cut meets the old border there
    deg = np.bincount(E.ravel(), minlength=nV).astype(float)
    for _ in range(iters):
        acc = np.zeros(nV); np.add.at(acc, E[:, 0], phi[E[:, 1]]); np.add.at(acc, E[:, 1], phi[E[:, 0]]); phi[active] = 0.5 * phi[active] + 0.5 * acc[active] / np.maximum(deg[active], 1)
    phi = np.where(np.abs(phi - 0.5) < 1e-4, 0.5 + 1e-4, phi); s = phi > 0.5; st = s[tris]; allin = st.all(1) & free & zone_f; mixed = st.any(1) & ~st.all(1) & free & zone_f
    area_before = float(A[inside].sum()); area_after = float(A[inside & ~zone_f].sum()) + float(A[allin].sum())          # split faces are added below
    # the label a vertex's neighbourhood has outside the piece
    out_lab = np.zeros(nV, np.int64); best = np.zeros(nV)
    for c in np.unique(fcls[~inside]):
        acc = np.zeros(nV); m = fcls == c; np.add.at(acc, tris[m].ravel(), np.repeat(A[m], 3)); upd = acc > best; out_lab[upd] = c; best[upd] = acc[upd]
    for _ in range(40):                                                                # vertices deep inside the piece: take a neighbour's
        need = best == 0
        if not need.any(): break
        for a, b in ((0, 1), (1, 0)):
            m = need[E[:, a]] & ~need[E[:, b]]; out_lab[E[m, a]] = out_lab[E[m, b]]; best[E[m, a]] = 1e-9
    newV = []; emap = {}; T2 = []; F2 = []; U2 = []
    def mid(a, b, ua, ub):
        t = min(0.75, max(0.25, (0.5 - phi[a]) / (phi[b] - phi[a]))); k = (min(a, b), max(a, b))      # kept away from the ends: no sliver triangles
        if k not in emap: emap[k] = nV + len(newV); newV.append(V[a] + (V[b] - V[a]) * t)
        return emap[k], ua + (ub - ua) * t
    def outside(fi, verts):
        if fcls[fi] != cid: return int(fcls[fi])
        vals, cnt = np.unique(out_lab[list(verts)], return_counts=True); return int(vals[np.argmax(cnt)])
    keep = ~mixed; ol = out_lab[tris[keep]]; maj = np.where(ol[:, 1] == ol[:, 2], ol[:, 1], ol[:, 0])       # the majority outside label of a face's corners
    Fk = np.where(prot[keep] | ~zone_f[keep], fcls[keep], np.where(allin[keep], cid, np.where(fcls[keep] != cid, fcls[keep], maj)))
    for fi in np.nonzero(mixed)[0]:
        v = [int(x) for x in tris[fi]]; u = uv[fi].astype(float)
        k = [i_ for i_ in range(3) if st[fi, i_] != st[fi, (i_ + 1) % 3] and st[fi, i_] != st[fi, (i_ + 2) % 3]][0]        # the corner alone on its side
        a, b, c = v[k], v[(k + 1) % 3], v[(k + 2) % 3]; ua, ub, uc = u[k], u[(k + 1) % 3], u[(k + 2) % 3]
        pab, uab = mid(a, b, ua, ub); pac, uac = mid(a, c, ua, uc); la = cid if s[a] else outside(fi, (a,)); lbc = cid if s[b] else outside(fi, (b, c))
        T2 += [[a, pab, pac], [pab, b, c], [pab, c, pac]]; U2 += [np.array([ua, uab, uac]), np.array([uab, ub, uc]), np.array([uab, uc, uac])]; F2 += [la, lbc, lbc]
        frac = np.linalg.norm(np.cross(np.array(newV[pab - nV]) - V[a], np.array(newV[pac - nV]) - V[a])) / 2 / max(A[fi], 1e-18)
        area_after += A[fi] * (frac if s[a] else 1 - frac)
    if area_before <= 0 or abs(area_after - area_before) / area_before > max_change: return {"skipped": True, "area_change": round((area_after - area_before) / max(area_before, 1e-18), 3)}
    V2 = np.vstack([V, np.array(newV).reshape(-1, 3)]); T2 = np.vstack([tris[keep], np.array(T2, dtype=tris.dtype).reshape(-1, 3)]); F2 = np.concatenate([Fk.astype(fcls.dtype), np.array(F2, dtype=fcls.dtype)]); U2 = np.vstack([uv[keep], np.array(U2, dtype=uv.dtype).reshape(-1, 3, 2)])
    return V2, T2, F2, U2, {"faces_split": int(mixed.sum()), "vertices_added": len(newV), "area_change": round((area_after - area_before) / area_before, 4)}


def close_labels(V, tris, fcls, classes, protect=(), radius=0.005, hi=0.62, lo=0.2, passes=2, only=None):
    """Close slits, notches and holes in rigid pieces, and remove their spikes, before the border is cut.
    For every face near a rigid piece's border, take the piece's share of the surface area within `radius` of the face
    (same-facing faces only). A face outside the piece joins it when the share is above `hi`: it lies in a slit, a
    notch or a hole, which would stay behind as a crack or a hole in the plate when the plate moves. A face of the piece
    leaves it when the share is below `lo`: it is a spike of plate reaching into cloth. A straight border has a share
    of one half and does not move. Returns (fcls, report)."""
    fcls = fcls.copy(); FC = V[tris].mean(1); FN = np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]); A = np.linalg.norm(FN, axis=1) / 2; FN = FN / np.maximum(2 * A[:, None], 1e-18)
    key = np.floor(FC / radius).astype(np.int64); grid = {}
    for i, k in enumerate(map(tuple, key)): grid.setdefault(k, []).append(i)
    grid = {k: np.array(v) for k, v in grid.items()}; prot = np.isin(fcls, list(protect)); rep = {"radius_mm": radius * 1000, "join_above": hi, "leave_below": lo, "classes": {}}
    def near(i):
        k = key[i]; c = np.concatenate([grid[(k[0] + a, k[1] + b, k[2] + e)] for a in (-1, 0, 1) for b in (-1, 0, 1) for e in (-1, 0, 1) if (k[0] + a, k[1] + b, k[2] + e) in grid])
        return c[(np.linalg.norm(FC[c] - FC[i], axis=1) < radius) & (FN[c] @ FN[i] > 0) & ~prot[c]]
    for cid, c in sorted(classes.items(), key=lambda kv: int(kv[0])):
        cid = int(cid)
        if c["kind"] != "rigid" or c.get("generated") or cid in protect or (fcls == cid).sum() < 20 or (only is not None and c["name"] not in only): continue
        joined = left = 0
        for _ in range(passes):
            inside = fcls == cid; vin = np.zeros(len(V), bool); vin[tris[inside].ravel()] = True; vout = np.zeros(len(V), bool); vout[tris[~inside].ravel()] = True; bv = np.nonzero(vin & vout)[0]
            if not len(bv): break
            cand = set()
            for v in bv:
                k = tuple(np.floor(V[v] / radius).astype(np.int64))
                for a in (-1, 0, 1):
                    for b in (-1, 0, 1):
                        for e in (-1, 0, 1):
                            g = grid.get((k[0] + a, k[1] + b, k[2] + e))
                            if g is not None: cand.update(g[np.linalg.norm(FC[g] - V[v], axis=1) < radius].tolist())
            flips = []
            for i in cand:
                if prot[i]: continue
                nb = near(i)
                if len(nb) < 3: continue
                share = float(A[nb][fcls[nb] == cid].sum() / max(A[nb].sum(), 1e-18))
                if fcls[i] != cid and share > hi: flips.append((i, cid))
                elif fcls[i] == cid and share < lo:
                    oth = nb[fcls[nb] != cid]; vals = np.unique(fcls[oth]); flips.append((i, int(vals[np.argmax([A[oth][fcls[oth] == v_].sum() for v_ in vals])])))
            if not flips: break
            for i, t in flips:
                if t == cid: joined += 1
                else: left += 1
                fcls[i] = t
        if joined or left: rep["classes"][c["name"]] = {"faces_joined": joined, "faces_left": left}
    rep["faces_changed"] = int(sum(v["faces_joined"] + v["faces_left"] for v in rep["classes"].values()))
    return fcls, rep


def merge_islands(V, tris, fcls, classes, protect=(), max_area=2e-4, max_share=0.25, enclosed=0.6, passes=3):
    """Relabel stray islands next to rigid pieces. An island is a connected group of faces of one class smaller than
    `max_area` (2 cm2) and than `max_share` of that class's largest group. A rigid island takes the class most of its
    outline touches; a soft island takes a rigid class if that class holds at least `enclosed` of its outline.
    Returns (fcls, list of changes)."""
    fcls = fcls.copy(); kind = {int(k): c["kind"] for k, c in classes.items()}; name = {int(k): c["name"] for k, c in classes.items()}; E = {}
    for fi, t in enumerate(tris):
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E.setdefault((min(int(a), int(b)), max(int(a), int(b))), []).append(fi)
    pairs = np.array([fs for fs in E.values() if len(fs) == 2]); A = np.linalg.norm(np.cross(V[tris[:, 1]] - V[tris[:, 0]], V[tris[:, 2]] - V[tris[:, 0]]), axis=1) / 2; done = []
    for _ in range(passes):
        par = np.arange(len(tris))
        def find(x):
            while par[x] != x: par[x] = par[par[x]]; x = par[x]
            return x
        for a, b in pairs[fcls[pairs[:, 0]] == fcls[pairs[:, 1]]]: par[find(a)] = find(b)
        root = np.array([find(i) for i in range(len(tris))]); area = np.zeros(len(tris)); np.add.at(area, root, A); big = {}
        for r in np.unique(root): big[int(fcls[r])] = max(big.get(int(fcls[r]), 0.0), float(area[r]))
        small = {int(r) for r in np.unique(root) if area[r] < max_area and area[r] < max_share * big[int(fcls[r])] and int(fcls[r]) not in protect}
        if not small: break
        touch = {}
        for a, b in pairs[fcls[pairs[:, 0]] != fcls[pairs[:, 1]]]:
            for x, y in ((a, b), (b, a)):
                rx = int(root[x])
                if rx in small and int(fcls[y]) not in protect: touch.setdefault(rx, {}); touch[rx][int(fcls[y])] = touch[rx].get(int(fcls[y]), 0) + 1
        changed = 0
        for r, cnt in touch.items():
            c = int(fcls[r]); top = max(cnt, key=cnt.get); share = cnt[top] / sum(cnt.values())
            if kind.get(c) == "rigid" or (kind.get(top) == "rigid" and share >= enclosed):
                m = root == r; fcls[m] = top; changed += 1; done.append({"from": name[c], "to": name[top], "faces": int(m.sum()), "mm2": round(float(area[r]) * 1e6, 1), "outline_share": round(share, 2)})
        if not changed: break
    return fcls, done


if __name__ == "__main__":
    SPEC = json.load(open(p(*os.environ["HB_CHAR"].split("/")))); WORK = p(*SPEC["work"].split("/")); npz = os.path.join(WORK, "character.npz"); js = os.path.join(WORK, "character.json")
    d = np.load(npz); meta = json.load(open(js)); V, tris, fcls, uv = d["V"].astype(float), d["tris"], d["fcls"], d["uv"]; classes = meta["classes"]; rep = {}; n0 = len(tris)
    for c_ in classes.values(): c_.update(SPEC["labels"].get("overrides", {}).get(c_["name"], {}))      # the spec's overrides decide kinds and layering here too
    protect = [int(k) for k, c in classes.items() if c["kind"] == "remove" or c.get("generated")]
    fcls, closed = close_labels(V, tris, fcls, classes, protect=protect)
    # plates that lift off what they cover (shoulder plates) show every slit and notch: close them harder
    lifting = [c["name"] for c in classes.values() if c.get("underlay") == "full"]
    if lifting:
        fcls, closed2 = close_labels(V, tris, fcls, classes, protect=protect, radius=0.007, hi=0.5, lo=0.2, only=lifting); closed["lifting_plates"] = closed2; closed["faces_changed"] += closed2["faces_changed"]
    fcls, isl0 = merge_islands(V, tris, fcls, classes, protect=protect)
    for cid, c in sorted(classes.items(), key=lambda kv: int(kv[0])):
        if c["kind"] != "rigid" or c.get("generated"): continue
        cid = int(cid); m = fcls == cid
        if m.sum() < 20: continue
        per0 = perimeter(V, tris, m); res = cut_class(V, tris, fcls, uv, cid, protect=protect)
        if res is None: continue
        if isinstance(res, dict): rep[c["name"]] = res; continue
        V, tris, fcls, uv, info = res; info["border_mm"] = [round(per0 * 1000, 1), round(perimeter(V, tris, fcls == cid) * 1000, 1)]; rep[c["name"]] = info
    # over-garments (a soft class with "over": [...]) get the same smooth edge, only where they meet what they lie over
    name2 = {c["name"]: int(k) for k, c in classes.items()}
    for cid, c in sorted(classes.items(), key=lambda kv: int(kv[0])):
        if c["kind"] != "soft" or not c.get("over"): continue
        ag = [name2[n] for n in c["over"] if n in name2]; cid = int(cid); per0 = perimeter(V, tris, fcls == cid); res = cut_class(V, tris, fcls, uv, cid, protect=protect, against=ag)
        if res is None: continue
        if isinstance(res, dict): rep[c["name"]] = res; continue
        V, tris, fcls, uv, info = res; info["border_mm"] = [round(per0 * 1000, 1), round(perimeter(V, tris, fcls == cid) * 1000, 1)]; info["against"] = c["over"]; rep[c["name"]] = info
    fcls, isl = merge_islands(V, tris, fcls, classes, protect=protect); isl = isl0 + isl
    for f in (npz, js):
        bak = f.replace("character.", "character-precut.")
        shutil.copyfile(f, bak)
    order = {int(i): (2 if c["kind"] == "rigid" else 1 if c["kind"] == "soft" else 3) for i, c in classes.items()}; vcls = np.zeros(len(V), np.int32); vpri = np.zeros(len(V), np.int32)
    for f_, t_ in enumerate(tris):
        c_ = int(fcls[f_]); pr = order.get(c_, 0)
        for v in t_:
            if pr > vpri[v]: vpri[v] = pr; vcls[v] = c_
    np.savez_compressed(npz, V=V.astype(d["V"].dtype), tris=tris, cls=vcls, fcls=fcls.astype(np.int32), uv=uv)
    tot = {"triangles": [n0, int(len(tris))], "border_mm_total": [round(sum(v["border_mm"][0] for v in rep.values() if "border_mm" in v), 1), round(sum(v["border_mm"][1] for v in rep.values() if "border_mm" in v), 1)]}
    tot["islands_merged"] = len(isl); tot["faces_changed_by_closing"] = closed["faces_changed"]
    meta.setdefault("report", {})["border_cut"] = {"total": tot, "classes": rep, "islands": isl, "closing": closed}; json.dump(meta, open(js, "w"), indent=1); json.dump({"total": tot, "classes": rep, "islands": isl, "closing": closed}, open(os.path.join(WORK, "border-cut.json"), "w"), indent=1)
    print("BORDER_CUT", json.dumps(tot))
    for i_ in isl: print("   island", json.dumps(i_))
    for k, v in rep.items(): print("  ", k, json.dumps(v))
