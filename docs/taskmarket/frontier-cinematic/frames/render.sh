#!/usr/bin/env bash
# Renders frames.html into the end cards and the optional start cards. Needs Google Chrome (set CHROME to override its path).
set -euo pipefail

here="$(cd "$(dirname "$0")" && pwd)"
chrome="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"

render() {
  local frame="$1" width="$2" height="$3"
  "$chrome" --headless --disable-gpu --hide-scrollbars --allow-file-access-from-files \
    --force-device-scale-factor=1 --virtual-time-budget=5000 \
    --window-size="$width,$height" \
    --screenshot="$here/$frame-${width}x${height}.png" \
    "file://$here/frames.html?frame=$frame&w=$width&h=$height" 2>/dev/null
}

for frame in start end; do
  render "$frame" 1920 1080
  render "$frame" 1080 1920
done
