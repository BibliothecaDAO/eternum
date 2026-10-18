#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../../../.." && pwd)
build_dir=${1:?Provide a fresh absolute output directory outside the checkout}
case "$build_dir" in /*) ;; *) echo 'Use an absolute output directory' >&2; exit 1;; esac
if [[ -e "$build_dir" ]]; then echo 'Choose a fresh output directory; earlier exports are evidence' >&2; exit 1; fi
mkdir -p "$build_dir/raw"
cd "$root"
for name in craft-yard; do
  "${WORKSHOP_BLENDER:-blender}" --background "apps/game/asset-sources/workshops/$name.blend" --threads 2 \
    --python-exit-code 1 --python apps/game/scripts/workshops/export-workshop.py -- "$build_dir/raw/$name.glb" > "$build_dir/$name-export.log" 2>&1
  node apps/game/scripts/outposts/optimize-outpost.mjs "$build_dir/raw/$name.glb" "$build_dir/$name.glb" > "$build_dir/$name-compress.log" 2>&1
  node apps/game/scripts/outposts/verify-outpost.mjs "$build_dir/$name.glb" > "$build_dir/$name-metrics.json"
done
