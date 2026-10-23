#!/usr/bin/env bash
# Rebuild the painted Frontier building deliveries into a fresh external directory for review:
#   rebuild.sh /absolute/output                     compress the committed editable sources
#   rebuild.sh /absolute/output /absolute/masters   first export each approved master, <masters>/<id>/game.glb
# Review the result in the lab, copy an approved set to apps/game/asset-sources/frontier-painted (sources/) and
# apps/game/public/models/frontier/painted, then run `pnpm --dir apps/game verify:painted-buildings`. Set
# FRONTIER_PAINTED_BLENDER to Blender 5.2's executable if it is not on PATH.
set -euo pipefail
root=$(cd "$(dirname "$0")/../../../.." && pwd)
output=${1:?Provide a fresh absolute output directory}
masters=${2:-}
case "$output" in /*) ;; *) echo 'Use an absolute output directory'; exit 1;; esac
if [[ -e "$output" ]]; then echo 'Choose a fresh output directory'; exit 1; fi
mkdir -p "$output/sources"
cd "$root"
scripts=apps/game/scripts/frontier-painted
names=$(node -e 'for (const building of require("./apps/game/src/three/structures/frontier-painted-buildings.json")) console.log(building.id)')
for name in $names; do
  if [[ -n "$masters" ]]; then
    "${FRONTIER_PAINTED_BLENDER:-blender}" --background --threads 2 --python-exit-code 1 \
      --python "$scripts/export-painted-building.py" -- \
      "$masters/$name/game.glb" "$output/sources/$name.glb" > "$output/$name-export.log" 2>&1
  else
    cp "apps/game/asset-sources/frontier-painted/$name.glb" "$output/sources/$name.glb"
  fi
  node apps/game/scripts/outposts/optimize-outpost.mjs "$output/sources/$name.glb" "$output/$name.glb" > "$output/$name-compress.log" 2>&1
  node "$scripts/stamp-source.mjs" "$output/sources/$name.glb" "$output/$name.glb"
done
