#!/usr/bin/env bash
set -euo pipefail
root=$(cd "$(dirname "$0")/../../../.." && pwd)
output=${1:?Provide a fresh absolute output directory}
case "$output" in /*) ;; *) echo 'Use an absolute output directory'; exit 1;; esac
if [[ -e "$output" ]]; then echo 'Choose a fresh output directory'; exit 1; fi
mkdir -p "$output/raw"
cd "$root"
variant=${2:-current}
case "$variant" in
  current) names="minotaur cyclops"; source_directory="" ;;
  refined) names="troll wyvern hydra minotaur cyclops"; source_directory="refined/" ;;
  *) echo 'Choose current or refined'; exit 1 ;;
esac
for name in $names; do
  blender --background --threads 2 --python-exit-code 1 --python apps/game/scripts/frontier-beasts/export-beast.py -- \
    "apps/game/asset-sources/frontier-beasts/$source_directory$name.blend" "$output/raw/$name.glb" > "$output/$name-export.log" 2>&1
  node apps/game/scripts/outposts/optimize-outpost.mjs "$output/raw/$name.glb" "$output/beast-$name.glb" > "$output/$name-compress.log" 2>&1
done
