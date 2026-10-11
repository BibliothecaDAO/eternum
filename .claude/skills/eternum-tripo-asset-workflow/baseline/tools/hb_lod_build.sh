#!/usr/bin/env bash
# A character's levels of detail from its bind, with every check: reduce, tuck, rest checks, pose checks, bake.
# Usage: hb_lod_build.sh --char <char.json> --bound <bind npz> [options]
#   --work DIR        working folder (default: the spec's "work")
#   --faces A,B       triangle budget of each level                    (default 13500,4500)
#   --names A,B       name of each level                               (default near,mid)
#   --res A,B         texture size of each level, pixels               (default 1024,512)
#   --weigh SPEC      reduction weights by class, "class:weight,..."   (default head:30,hand_l:6,hand_r:6)
#   --bend A,B        bend allowance per level, degrees                (default 20,10)
#   --helpers LIST    helper joints (default: the spec's)
#   --sets LIST       pose sets for the see-inside check (default: rom, general and the spec's pose_sets)
# Paths are absolute or relative to the current folder. Blender and its Python: see hb_env.sh.
# Writes <work>/reduced-<name>.*, <work>/baked-<name>.* and <work>/lod-build.log (the lines printed here).
set -u
source "$(dirname "${BASH_SOURCE[0]}")/hb_env.sh"
CHAR=""; BOUND=""; WORK=""; FACES="13500,4500"; NAMES="near,mid"; RES="1024,512"; WEIGH="head:30,hand_l:6,hand_r:6"; BEND="20,10"; HELPERS=""; SETS=""
while [ $# -gt 0 ]; do case "$1" in
  --char) CHAR="$2";; --bound) BOUND="$2";; --work) WORK="$2";; --faces) FACES="$2";; --names) NAMES="$2";; --res) RES="$2";; --weigh) WEIGH="$2";; --bend) BEND="$2";; --helpers) HELPERS="$2";; --sets) SETS="$2";;
  *) sed -n 2,15p "$0"; exit 2;; esac; shift 2; done
[ -n "$CHAR" ] && [ -n "$BOUND" ] || { sed -n 2,15p "$0"; exit 2; }
[ -n "$WORK" ] || WORK="$(hb_spec "$CHAR" work)"; [ -n "$HELPERS" ] || HELPERS="$(hb_spec "$CHAR" helpers)"; [ -n "$SETS" ] || SETS="$(hb_spec "$CHAR" sets)"
mkdir -p "$WORK"; LOG="$WORK/lod-build.log"; : > "$LOG"
C="$(hb_path "$CHAR")"; BD="$(hb_path "$BOUND")"
say() { cut -c1-"${1:-330}" | tee -a "$LOG"; }
hb_py hb_reduce.py --char "$C" --bound "$BD" --faces "$FACES" --names "$NAMES" --bend "$BEND" --weigh "$WEIGH" --out-dir "$(hb_path "$WORK")" 2>&1 | grep "^REDUCE\|Error\|Traceback\|line " | say
IFS=, read -ra NM <<< "$NAMES"; IFS=, read -ra RS <<< "$RES"
for i in "${!NM[@]}"; do nm="${NM[$i]}"; rs="${RS[$i]}"; LOW="$(hb_path "$WORK/reduced-$nm.npz")"
  hb_blender hb_tuck.py HB_BOUND="$BD" HB_LOW="$LOW" 2>&1 | grep "^TUCK\|Error\|Traceback" | say
  hb_blender hb_lod_backs.py HB_BOUND="$BD" HB_LOW="$LOW" 2>&1 | grep "^BACK\|Error\|Traceback" | say
  hb_blender hb_lod_see.py HB_BOUND="$BD" HB_LOW="$LOW" HB_STEP=0.002 2>&1 | grep "SEE all\|LOD_SEE\|Error\|Traceback" | say
  hb_py hb_lod_check.py --char "$C" --reduced "$LOW" --bound "$BD" --helpers "$HELPERS" 2>&1 | grep "^LOD\|Error\|Traceback" | say 200
  hb_blender hb_gap_check.py HB_BOUND="$LOW" HB_HELPERS="$HELPERS" HB_SETS="$SETS" HB_TAG="gap-check" 2>&1 | grep "GAP_CHECK_HOLES\|GAP_CHECK_FLAGS\|Error\|Traceback" | say
  hb_blender hb_bake.py HB_CHAR="$C" HB_HIGH="$BD" HB_LOW="$LOW" HB_RES="$rs" 2>&1 | grep "^BAKE\|Error\|Traceback\|line " | say 420
done
echo "LOD_BUILD_DONE" | tee -a "$LOG"
