#!/usr/bin/env bash
# Renders a game skeleton dump (k4_dump_skeleton.test.ts.txt) beside the approved poses with the baseline's renderer.
# Usage, from output/human-baseline:  k4_controller_pass_render.sh <tag> <dump.json (Windows path)> <samples> <sample=pose,...>
set -e
B="/mnt/c/Program Files/Blender Foundation/Blender 5.2/blender.exe"; W='\\wsl.localhost\Ubuntu\home\krumpylumpkins\repos\realms'
export WSLENV=HB_BOUND:HB_TEX:HB_GEAR:HB_VIEWS:HB_RES:HB_OUTDIR:HB_TAG:HB_CELL:K4_DUMP:K4_SAMPLES:K4_APPROVED
export HB_BOUND=../t1-knight-claude/v4/work/bound-r71.npz HB_TEX=../t1-knight-claude/v4/work/character.blend HB_GEAR=../t1-knight-claude/v4/work/gear-fit.json
export HB_VIEWS=${HB_VIEWS:-rt-three-quarter,rt-back-right} HB_RES=${HB_RES:-600} HB_CELL=${HB_CELL:-400} HB_OUTDIR=../t1-knight-claude/v4/review/controller-pass
export HB_TAG="$1" K4_DUMP="$2" K4_SAMPLES="$3" K4_APPROVED="$4"
"$B" -b --factory-startup --python "$W"'\output\t1-knight-claude\v4\scripts\k4_game_pose_render.py' 2>&1 | tr -d '\r' | grep -E "RENDERED|GAME_POSE_SHEET|Traceback|rror"
