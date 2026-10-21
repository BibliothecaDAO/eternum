#!/usr/bin/env bash
# Review renders of one level of detail of a character, the same frames for every level so they can be laid side by side.
# Usage: hb_lod_review.sh --char <char.json> --bound <bind npz> --level <bind|near|mid|...> [options] [set ...]
#   sets: figure game head chest arm leg (default all)
#   --level L          'bind' renders the bind with the generated texture; any other name renders <work>/baked-<L> with its baked maps
#   --work DIR         working folder (default: the spec's "work"); the bind's texture is <work>/character.blend
#   --out DIR          where the sheets go (default <work>/review/lod/<level>)
#   --helpers LIST     helper joints (default: the spec's)
#   --troop-set NAME   the troop's own pose set (default: the first of the spec's pose_sets)
#   --troop-poses A,B  two of its poses: a guard and a cut or similar (default guard-middle,cut-mid, the Knight's)
# Paths are absolute or relative to the current folder. Blender: see hb_env.sh.
# Writes <out>/SHEET-<set>.png and the single frames beside it (rows: poses; columns: views).
set -u
source "$(dirname "${BASH_SOURCE[0]}")/hb_env.sh"
CHAR=""; BOUND=""; LV=""; WORK=""; OUTD=""; HELPERS=""; TSET=""; TPOSES="guard-middle,cut-mid"; ONLY=""
while [ $# -gt 0 ]; do case "$1" in
  --char) CHAR="$2"; shift 2;; --bound) BOUND="$2"; shift 2;; --level) LV="$2"; shift 2;; --work) WORK="$2"; shift 2;; --out) OUTD="$2"; shift 2;;
  --helpers) HELPERS="$2"; shift 2;; --troop-set) TSET="$2"; shift 2;; --troop-poses) TPOSES="$2"; shift 2;;
  -*) sed -n 2,14p "$0"; exit 2;; *) ONLY="$ONLY $1"; shift;; esac; done
[ -n "$CHAR" ] && [ -n "$LV" ] || { sed -n 2,14p "$0"; exit 2; }
[ -n "$WORK" ] || WORK="$(hb_spec "$CHAR" work)"; [ -n "$HELPERS" ] || HELPERS="$(hb_spec "$CHAR" helpers)"; [ -n "$TSET" ] || TSET="$(hb_spec "$CHAR" pose_sets | cut -d, -f1)"
[ -n "$OUTD" ] || OUTD="$WORK/review/lod/$LV"; mkdir -p "$OUTD"
if [ "$LV" = bind ]; then [ -n "$BOUND" ] || { echo "--bound is needed for the bind" >&2; exit 2; }; BASE=(HB_BOUND="$(hb_path "$BOUND")" HB_TEX="$(hb_path "$WORK/character.blend")")
else BASE=(HB_BOUND="$(hb_path "$WORK/baked-$LV.npz")" HB_BAKED="$(hb_path "$WORK/baked-$LV")"); fi
BASE+=(HB_HELPERS="$HELPERS" HB_OUTDIR="$(hb_path "$OUTD")" HB_ENGINE=CYCLES)
IFS=, read -r P1 P2 <<< "$TPOSES"; T1="$TSET:$P1"; T2="$TSET:$P2"
run() {  # name focus size views poses res cell
  if [ -n "$ONLY" ] && ! echo "$ONLY " | grep -q " $1 "; then return; fi
  local n; n=$(echo "$4" | tr ',' '\n' | wc -l); local F=()
  if [ -n "$2" ]; then F=(HB_FOCUS="$2" HB_FOCUS_SIZE="$3"); fi
  hb_blender hb_pose_render.py "${BASE[@]}" "${F[@]}" HB_TAG="$1" HB_VIEWS="$4" HB_COLS="$n" HB_POSES="$5" HB_RES="$6" HB_CELL="$7" > "$OUTD/render-$1.log" 2>&1
  grep -hE "POSE_SHEET|Traceback|MISSING|Error" "$OUTD/render-$1.log" | cut -c1-240
}
run figure ""         ""    "rt-front,rt-back,rt-left,rt-three-quarter"            "rest:rest,$T1,$T2,general:walk-passing-l,general:reach-down" 700 420
run game   ""         ""    "rt-front-above,rt-back-above"                          "rest:rest,$T1,$T2,general:walk-passing-l,general:reach-down,rom:knee-135" 700 420
run head   Head       0.09  "rt-front,rt-left,rt-three-quarter,top"                 "rest:rest,rom:head-yaw75" 700 420
run chest  spine_03   0.13  "rt-front,rt-back,rt-left,rt-three-quarter"             "rest:rest,$T1" 700 420
run arm    lowerarm_l 0.10  "rt-front,rt-back,rt-left,rt-back-above"                "rest:rest,general:walk-passing-l,$T1" 700 420
run leg    calf_r     0.12  "rt-front,rt-back,rt-right,rt-three-quarter"            "rest:rest,rom:knee-135,general:reach-down" 700 420
echo "LOD_REVIEW_DONE $LV"
