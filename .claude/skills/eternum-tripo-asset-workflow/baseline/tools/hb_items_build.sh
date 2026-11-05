#!/usr/bin/env bash
# A character's removable items as game items: into the baseline's file form, reduced, baked, rendered beside their sources.
# Usage: hb_items_build.sh --char <char.json> --item <name>[:faces[:fold_rigid]] [--item ...] [options]
#   --item NAME:FACES:FOLD   an item named in the spec's gear file, its triangle budget (default 500) and its HB_REDUCE_FOLD_RIGID
#                            (default 0.0; the Knight's shield uses -0.3: only edges whose faces look nearly opposite ways count as rims)
#   --work DIR               working folder (default: the spec's "work"); each item goes to <work>/items/<name>/
#   --res N                  texture size, pixels (default 512)
#   --orm MODE               HB_ORM (default keep: the item's own ORM is the corrected one its material uses)
#   --lookup MODE            HB_LOOKUP (default normal: each texel's source is looked for along its normal; single-layer objects whose relief the reduction flattens)
#   --review-out DIR         where the render sheets go (default <work>/review/lod/items)
# Settings that differ from a character's: no class weights and no bend (one rigid piece).
# Paths are absolute or relative to the current folder. Blender and its Python: see hb_env.sh.
# Writes <work>/items/<item>/{item,reduced-near,baked-near}.* and the sheets.
set -u
source "$(dirname "${BASH_SOURCE[0]}")/hb_env.sh"
CHAR=""; WORK=""; ITEMS=(); RES=512; ORM=keep; LOOKUP=normal; ROUT=""
while [ $# -gt 0 ]; do case "$1" in
  --char) CHAR="$2";; --work) WORK="$2";; --item) ITEMS+=("$2");; --res) RES="$2";; --orm) ORM="$2";; --lookup) LOOKUP="$2";; --review-out) ROUT="$2";;
  *) sed -n 2,14p "$0"; exit 2;; esac; shift 2; done
[ -n "$CHAR" ] && [ ${#ITEMS[@]} -gt 0 ] || { sed -n 2,14p "$0"; exit 2; }
[ -n "$WORK" ] || WORK="$(hb_spec "$CHAR" work)"; [ -n "$ROUT" ] || ROUT="$WORK/review/lod/items"; C="$(hb_path "$CHAR")"; mkdir -p "$ROUT"
for cfg in "${ITEMS[@]}"; do IFS=: read -r it faces foldr <<< "$cfg"; faces="${faces:-500}"; foldr="${foldr:-0.0}"; d="$WORK/items/$it"; D="$(hb_path "$d")"
  hb_blender hb_item_prepare.py HB_CHAR="$C" HB_ITEM="$it" 2>&1 | grep "^ITEM\|Error\|Traceback" | cut -c1-80
  hb_pyenv hb_reduce.py HB_REDUCE_FOLD_RIGID="$foldr" -- --char "$C" --bound "$D/item.npz" --faces "$faces" --names near --weigh "" --bend 0 --out-dir "$D" 2>&1 | grep "^REDUCE near\|Error\|Traceback" | cut -c1-200
  hb_blender hb_bake.py HB_CHAR="$C" HB_HIGH="$D/item.npz" HB_LOW="$D/reduced-near.npz" HB_RES="$RES" HB_TEX="$D/tex" HB_OUTDIR="$D" HB_ORM="$ORM" HB_LOOKUP="$LOOKUP" 2>&1 | grep "^BAKE layout\|^BAKE lookup\|^BAKE_DONE\|Error\|Traceback\|line " | cut -c1-330
  for k in color orm normal; do cp -f "$d/tex/$k.png" "$d/source-$k.png"; done
  for lv in source near; do if [ $lv = source ]; then bound="$D/item.npz"; baked="$D/source"; else bound="$D/baked-near.npz"; baked="$D/baked-near"; fi
    hb_blender hb_pose_render.py HB_BOUND="$bound" HB_BAKED="$baked" HB_POSES="rest:rest" HB_TAG="$it-$lv" HB_VIEWS="rt-front,rt-back,rt-left,rt-three-quarter,top" HB_COLS=5 HB_RES=800 HB_CELL=420 HB_OUTDIR="$(hb_path "$ROUT")" HB_ENGINE=CYCLES 2>&1 | grep -i "POSE_SHEET\|error\|Traceback" | cut -c130-300
  done
done; echo ITEMS_BUILD_DONE
