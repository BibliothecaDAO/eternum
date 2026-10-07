#!/usr/bin/env bash
# The install icons, favicon and touch icon: the kit's mark in cream on the ground (src/tokens.ts), drawn from
# public/images/logos/realms-mark.svg. Needs ImageMagick 7 (`magick`). Run from apps/game.
set -euo pipefail

MARK=public/images/logos/realms-mark.svg
OUT=public/images
GROUND="#130F0C"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# icon <file> <size> <the mark's width as a percent of the icon>
icon() {
  magick -background none -density 1200 "$MARK" -resize "$(($2 * $3 / 100))x" "$WORK/mark.png"
  magick -size "$2x$2" "xc:$GROUND" "$WORK/mark.png" -gravity center -composite -strip "$1"
}

icon "$OUT/game-pwa-192x192.png" 192 70
icon "$OUT/game-pwa-512x512.png" 512 70
# A maskable icon keeps the mark inside the 80% safe circle.
icon "$OUT/game-maskable-icon-512x512.png" 512 54
icon "$OUT/game-apple-touch-icon-180x180.png" 180 66
icon "$WORK/16.png" 16 88
icon "$WORK/32.png" 32 84
icon "$WORK/48.png" 48 80
magick "$WORK/16.png" "$WORK/32.png" "$WORK/48.png" "$OUT/game-favicon.ico"
