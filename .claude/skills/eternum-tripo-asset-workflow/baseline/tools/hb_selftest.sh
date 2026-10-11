#!/usr/bin/env bash
# Baseline self-test: rebuild the template data (when the MakeHuman sources are in place, see template/SOURCE.md), run the harness on it
# with and without helpers, check the pose library.
# Needs Blender 5.2 (HB_BLENDER, default `blender` on PATH) and its bundled Python (HB_PYTHON); see hb_env.sh.
# The harness reports go to HB_SELFTEST_OUT (default: a new temporary folder), not into the baseline folder.
set -u
source "$(dirname "${BASH_SOURCE[0]}")/hb_env.sh"; W="$(dirname "$HB_TOOLS")"; O="${HB_SELFTEST_OUT:-$(mktemp -d)}"; mkdir -p "$O"; echo "reports in $O"
if [ -f "$W/template/mpfb/base.obj" ]; then hb_py hb_template_build.py | cut -c1-200; else echo "template not rebuilt: template/mpfb/base.obj is not present (template/SOURCE.md)"; fi
hb_py hb_harness.py "$(hb_path "$W/template/template.npz")" --sets rom --out "$(hb_path "$O/template-none.harness.json")" | grep -E "elbow.outer|knee.outer|stretch"
hb_py hb_harness.py "$(hb_path "$W/template/template.npz")" --sets rom --helpers elbow_half,knee_half --out "$(hb_path "$O/template-elbow_half+knee_half.harness.json")" | grep -E "elbow.outer|knee.outer|stretch"
hb_py hb_pose_check.py
