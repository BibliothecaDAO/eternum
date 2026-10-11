#!/usr/bin/env bash
# A character's game files and the runtime data beside them, from its baked levels and items (numpy only; no Blender window).
# Usage: hb_export_all.sh --char <char.json> --bound <bind npz> --out <export folder> --skin-name <glTF name> [options]
#   --levels A,B          the baked levels to export, as <work>/baked-<name>      (default near,mid)
#   --item NAME:JOINT:GLTF_NAME   an item (<work>/items/<name>/baked-<item-level>), the joint it follows and its glTF name; repeat per item
#   --item-level L        the level the items were baked at                        (default near)
#   --work DIR            working folder (default: the spec's "work")
#   --gear-fit FILE       the gear fit (default <work>/gear-fit.json); used with the bind for the runtime data
#   --helpers LIST        helper joints (default: the spec's)
# Paths are absolute or relative to the current folder. Blender's Python: see hb_env.sh.
# Writes <out>/<level>/skin.glb, <out>/<item-level>/<item>.glb (each with its .json report), <out>/runtime-fit.json and
# <out>/MANIFEST.json (sizes and sha256 of all of them).
set -u
source "$(dirname "${BASH_SOURCE[0]}")/hb_env.sh"
CHAR=""; BOUND=""; OUTD=""; SKIN=""; LEVELS="near,mid"; ITEMS=(); IL=near; WORK=""; GF=""; HELPERS=""
while [ $# -gt 0 ]; do case "$1" in
  --char) CHAR="$2";; --bound) BOUND="$2";; --out) OUTD="$2";; --skin-name) SKIN="$2";; --levels) LEVELS="$2";; --item) ITEMS+=("$2");; --item-level) IL="$2";; --work) WORK="$2";; --gear-fit) GF="$2";; --helpers) HELPERS="$2";;
  *) sed -n 2,15p "$0"; exit 2;; esac; shift 2; done
[ -n "$CHAR" ] && [ -n "$BOUND" ] && [ -n "$OUTD" ] && [ -n "$SKIN" ] || { sed -n 2,15p "$0"; exit 2; }
[ -n "$WORK" ] || WORK="$(hb_spec "$CHAR" work)"; [ -n "$HELPERS" ] || HELPERS="$(hb_spec "$CHAR" helpers)"; [ -n "$GF" ] || GF="$WORK/gear-fit.json"
C="$(hb_path "$CHAR")"; mkdir -p "$OUTD"; FILES=()
for lv in ${LEVELS//,/ }; do mkdir -p "$OUTD/$lv"; FILES+=("$lv/skin.glb")
  hb_py hb_export.py --char "$C" --baked "$(hb_path "$WORK/baked-$lv")" --out "$(hb_path "$OUTD/$lv/skin.glb")" --helpers "$HELPERS" --name "$SKIN" 2>&1 | tail -1 | cut -c1-300
done
for cfg in "${ITEMS[@]}"; do IFS=: read -r it joint gname <<< "$cfg"; mkdir -p "$OUTD/$IL"; FILES+=("$IL/$it.glb")
  hb_py hb_export.py --char "$C" --baked "$(hb_path "$WORK/items/$it/baked-$IL")" --out "$(hb_path "$OUTD/$IL/$it.glb")" --item --joint "$joint" --name "$gname" 2>&1 | tail -1 | cut -c1-300
done
FILES+=("runtime-fit.json")
GFA=(); [ -f "$GF" ] && GFA=(--gear-fit "$(hb_path "$GF")")
hb_py hb_runtime_fit.py --char "$C" --bound "$(hb_path "$BOUND")" "${GFA[@]}" --helpers "$HELPERS" --out "$(hb_path "$OUTD/runtime-fit.json")" 2>&1 | grep "^FIT " | cut -c1-300
"$HB_PYTHON" - "$(hb_path "$OUTD")" "${FILES[@]}" <<'Q'
import hashlib, json, os, sys
d, files = sys.argv[1], sys.argv[2:]; out = {}
for f in files:
    b = open(os.path.join(d, f), "rb").read(); out[f] = {"bytes": len(b), "sha256": hashlib.sha256(b).hexdigest()}
    if f.endswith(".glb"): r = json.load(open(os.path.join(d, f + ".json"))); out[f].update({k: r[k] for k in ("triangles", "vertices_in_file", "places", "joint_count") if k in r}); out[f]["images"] = {k: v["size"] for k, v in r["images"].items()}
json.dump(out, open(os.path.join(d, "MANIFEST.json"), "w"), indent=1)
for f, v in out.items(): print("MANIFEST %-18s %8d bytes  %s  %s" % (f, v["bytes"], v["sha256"][:16], {k: v[k] for k in v if k not in ("bytes", "sha256", "images")}))
Q
