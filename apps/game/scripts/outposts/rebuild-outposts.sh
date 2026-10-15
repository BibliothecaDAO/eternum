#!/usr/bin/env bash
set -euo pipefail
outpost_blender=${OUTPOST_BLENDER:-blender}
outpost_output=${1:?Provide an external build directory}
shift
outpost_assets=("$@")
if [ ${#outpost_assets[@]} -eq 0 ]; then outpost_assets=(camp village stragglers shrine well); fi
for asset in "${outpost_assets[@]}"; do
  case "$asset" in
    camp|village|stragglers|shrine|well) ;;
    *) echo "Unknown outpost: $asset. Choose camp, village, stragglers, shrine or well." >&2; exit 1 ;;
  esac
done
mkdir -p "$outpost_output/models"
for asset in "${outpost_assets[@]}"; do
  outpost_source=$asset
  if [ "$asset" = village ]; then outpost_source=village-longhouse; fi
  "$outpost_blender" --background --threads 2 "apps/game/asset-sources/outposts/$outpost_source.blend" --python-exit-code 1 --python apps/game/scripts/outposts/export-outpost.py -- "$outpost_output/$asset-raw.glb" > "$outpost_output/$asset-export.log" 2>&1
  pnpm --dir apps/game optimize:outposts "$outpost_output/$asset-raw.glb" "$outpost_output/models/$asset.glb" > "$outpost_output/$asset-compress.log" 2>&1
  pnpm --dir apps/game --silent verify:outposts "$outpost_output/models/$asset.glb" > "$outpost_output/$asset-verified.json"
done
