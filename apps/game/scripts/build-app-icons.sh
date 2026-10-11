#!/usr/bin/env bash
# The install icons, favicon and touch icon: the kit's mark in cream on the ground (src/tokens.ts), drawn from
# public/images/logos/realms-mark.svg; the dev set adds a hatched corner (brand.html, the dev environment), no letters.
# Needs ImageMagick 7 (`magick`). Run from apps/game.
set -euo pipefail

MARK=public/images/logos/realms-mark.svg
OUT=public/images
GROUND="#130F0C"
MUTED="#A2926F"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# icon <file> <size> <the mark's width as a percent of the icon>
icon() {
  magick -background none -density 1200 "$MARK" -resize "$(($2 * $3 / 100))x" "$WORK/mark.png"
  magick -size "$2x$2" "xc:$GROUND" "$WORK/mark.png" -gravity center -composite -strip "$1"
}

# hatch <file> <inset> <leg>: muted diagonal stripes in a triangle at the top-right corner, both in percent of the
# icon; a maskable icon insets a smaller one so the launcher's mask keeps part of it clear of the mark.
hatch() {
  local size inset leg stripe lines=""
  size=$(magick identify -format "%w" "$1")
  inset=$((size * $2 / 100))
  leg=$((size * $3 / 100))
  stripe=$(((size + 63) / 64))
  for ((x = -size; x < size; x += stripe * 3)); do lines+="line $x,0 $((x + size)),$size "; done
  magick -size "${size}x${size}" xc:none -stroke "$MUTED" -strokewidth "$stripe" -draw "$lines" "$WORK/stripes.png"
  magick -size "${size}x${size}" xc:none -fill white \
    -draw "polygon $((size - inset - leg)),$inset $((size - inset)),$inset $((size - inset)),$((inset + leg))" \
    "$WORK/corner.png"
  magick "$WORK/stripes.png" "$WORK/corner.png" -compose DstIn -composite "$WORK/hatch.png"
  magick "$1" "$WORK/hatch.png" -compose Over -composite -strip "$1"
}

# set <prefix>: one environment's icons, named game-<prefix>...
set_of_icons() {
  icon "$OUT/game-$1pwa-192x192.png" 192 70
  icon "$OUT/game-$1pwa-512x512.png" 512 70
  # A maskable icon keeps the mark inside the 80% safe circle.
  icon "$OUT/game-$1maskable-icon-512x512.png" 512 54
  icon "$OUT/game-$1apple-touch-icon-180x180.png" 180 66
  icon "$WORK/16.png" 16 88
  icon "$WORK/32.png" 32 84
  icon "$WORK/48.png" 48 80
}

set_of_icons ""
magick "$WORK/16.png" "$WORK/32.png" "$WORK/48.png" "$OUT/game-favicon.ico"

set_of_icons "dev-"
for file in "$OUT"/game-dev-pwa-*.png "$OUT/game-dev-apple-touch-icon-180x180.png" "$WORK"/{32,48}.png; do hatch "$file" 0 33; done
hatch "$OUT/game-dev-maskable-icon-512x512.png" 15 22
magick "$WORK/16.png" "$WORK/32.png" "$WORK/48.png" "$OUT/game-dev-favicon.ico"
