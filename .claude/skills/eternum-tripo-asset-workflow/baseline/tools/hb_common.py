"""Shared paths for the human baseline (run inside Blender 5.2, or with its bundled Python)."""
import os, sys, hashlib
_HERE = os.path.dirname(os.path.abspath(__file__))
HB = os.path.dirname(_HERE)                                   # the baseline folder (the parent of tools/)
OUT = os.path.dirname(HB)                                     # the folder that holds it
def p(*parts):
    """A path under the baseline folder. A path that is absolute stands as it is, also when it arrives split at "/" (p(*s.split("/")))."""
    if parts and parts[0] == "" and len(parts) > 1: return os.path.join(os.sep, *parts[1:])
    return os.path.join(HB, *parts)
def out(*parts): return os.path.join(OUT, *parts)
def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""): h.update(chunk)
    return h.hexdigest()
if _HERE not in sys.path: sys.path.insert(0, _HERE)


def resolve(packet_dir, path):
    """packet-relative path, or 'hb:<path under human-baseline>', or absolute."""
    if path.startswith("hb:"): return p(*path[3:].split("/"))
    return path if os.path.isabs(path) else os.path.join(packet_dir, *path.split("/"))


def load_classes(spec, packet_dir):
    """class table {str(id): {name, kind, bone, region, candidates, colour}} from the spec's inline 'classes' or from a
    packet legend file (labels.legend): {"classes": [{"id", "name", "rgb" [0-255], "kind", "joint", "region", "candidates"}]}."""
    import json
    ls = spec["labels"]
    if "legend" not in ls: return ls["classes"]
    out = {}
    for c in json.load(open(resolve(packet_dir, ls["legend"])))["classes"]:
        d = {"name": c["name"], "kind": c["kind"], "colour": [round(v / 255.0, 4) for v in c["rgb"]]}
        if c.get("joint"): d["bone"] = c["joint"]
        for k in ("region", "candidates", "proposed", "underlay"):
            if c.get(k): d[k] = c[k]
        out[str(int(c["id"]))] = d
    # per-character corrections to the packet's table, decided at the bind gate: {"class name": {"kind"|"bone"|"region": ...}}
    for name, ch in (ls.get("overrides") or {}).items():
        for d in out.values():
            if d["name"] == name:
                d.update(ch)
                if d["kind"] != "rigid": d.pop("bone", None)
    return out
