#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../../../.." && pwd)
output=${1:?Provide a fresh absolute output directory}
case "$output" in /*) ;; *) echo 'Use an absolute output directory'; exit 1;; esac
if [[ -e "$output" ]]; then echo 'Choose a fresh output directory'; exit 1; fi
mkdir -p "$output/raw"
cd "$root"
names="troll wyvern hydra wraith cyclops"
variant=${2:-refined}
case "$variant" in refined|creatures) ;; *) echo 'Choose refined or creatures'; exit 1;; esac
source_directory="apps/game/asset-sources/frontier-beasts/refined"
if [[ "$variant" = creatures ]]; then
  names="wyvern hydra ghoul kappa basilisk ammit dark-fey"
  source_directory="apps/game/asset-sources/lab/frontier-beasts"
fi
for name in $names; do
  blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/frontier-beasts/export-beast.py -- \
    "$source_directory/$name.blend" "$output/raw/$name.glb" > "$output/$name-export.log" 2>&1
  node apps/game/scripts/outposts/optimize-outpost.mjs "$output/raw/$name.glb" "$output/beast-$name.glb" > "$output/$name-compress.log" 2>&1
done
