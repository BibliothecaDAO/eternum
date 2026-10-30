#!/usr/bin/env bash
# Every brand image the app and the status page serve, exported from the Realms Brand Kit v3 folder, so a new kit is one
# run: the parent mark by displayed size (the kit's README: lettered above 120 px, contour 64-120 px, small below 64 px),
# each age's transparent lockup, the install icons (each surface's mark by the size it shows it, gold on Hearth) and the
# favicon (the small globe's master, resampled; the dev sets add a hatched corner), and the share card (the lettered
# mark on a painting under Hearth at 80%, the deck's page 19).
# Needs ImageMagick 7 (`magick`). Run from apps/game: bash scripts/build-brand.sh <Realms-Brand-Kit-v3 folder>
set -euo pipefail

KIT=${1:?usage: build-brand.sh <Realms-Brand-Kit-v3 folder>}
LOGOS=public/images/logos
OUT=public/images
STATUS=../status/public
HEARTH=$(node -p 'require("./src/brand/palette.json").brand.hearth')
MUTED=$(node -p 'require("./src/brand/palette.json").brand.muted')
LETTERED="$KIT/01-Logos/Realms/Lettered/realms-lettered-gold.png"
CONTOUR="$KIT/01-Logos/Realms/Contour/realms-contour-gold.png"
SMALL="$KIT/01-Logos/Realms/Small/realms-small-master.png"
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# web <master> <out.webp> <width>: the master cropped to its art and written at that width (twice its largest use).
web() {
  magick "$1" -trim +repage -resize "$3x" -strip -quality 90 -define webp:method=6 "$2"
}

# icon <master> <file> <size> <the mark's width as a percent of the icon>: the mark centred on Hearth.
icon() {
  magick "$1" -trim +repage -resize "$(($3 * $4 / 100))x" "$WORK/mark.png"
  magick -size "$3x$3" "xc:$HEARTH" "$WORK/mark.png" -gravity center -composite -strip "$2"
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

# The favicon: the kit's small globe master as it is, padded to square, to be resampled to each of the .ico's sizes,
# its ground left clear (owner, 29 October 2026: "just use realms-small-master.png from the brand kit as the favicon
# its not hard ?").
magick "$SMALL" -gravity center -background none -extent "%[fx:max(w,h)]x%[fx:max(w,h)]" "$WORK/globe.png"

# set_of_icons <prefix>: one environment's install icons, named game-<prefix>..., each in the kit's drawing for the size
# its surface shows it at (small below 64, contour 64-120, lettered above): an iPhone's home screen (60 pt: 120 and
# 180 px) and an Android launcher (48 dp: 192 px and the maskable icon) the small globe; an iPad's (76 and 83.5 pt: 152
# and 167 px) the contour; the 512 px icon, which Chrome's splash and a desktop's dock show at about 128, the lettered
# mark. Then the favicon's three frames.
set_of_icons() {
  icon "$SMALL" "$OUT/game-$1pwa-192x192.png" 192 88
  icon "$LETTERED" "$OUT/game-$1pwa-512x512.png" 512 88
  # A maskable icon keeps the globe inside the 80% safe circle.
  icon "$SMALL" "$OUT/game-$1maskable-icon-512x512.png" 512 78
  for size in 120 180; do icon "$SMALL" "$OUT/game-$1apple-touch-icon-${size}x$size.png" "$size" 88; done
  for size in 152 167; do icon "$CONTOUR" "$OUT/game-$1apple-touch-icon-${size}x$size.png" "$size" 88; done
  for size in 16 32 48; do magick "$WORK/globe.png" -resize "${size}x$size" -strip "$WORK/$size.png"; done
}

# The parent mark by the size it is drawn: the first frame's (240 px), the bar's (28 px), the loader's (96 px).
web "$LETTERED" "$LOGOS/realms-lettered.webp" 480
web "$SMALL" "$LOGOS/realms-small.webp" 112
web "$CONTOUR" "$LOGOS/realms-contour.webp" 192
# Each age's complete lockup (emblem, title and Realms stamp), with real alpha, for its painting: Play's cards.
for age in blitz frontier eternum; do
  web "$KIT/01-Logos/${age^}/Transparent/$age-lockup.png" "$LOGOS/$age-lockup.webp" 640
done
# The status page's header mark (40 px); that site shares no file with the app.
web "$SMALL" "$STATUS/realms-small.webp" 160

# ico <file>: the favicon's three frames, each with its full alpha (left to itself, the writer gives a frame of few
# colours a one-bit mask, every faint pixel solid).
ico() {
  magick "$WORK/16.png" "$WORK/32.png" "$WORK/48.png" -type TrueColorAlpha "$1"
}

set_of_icons ""
ico "$OUT/game-favicon.ico"

set_of_icons "dev-"
for file in "$OUT"/game-dev-pwa-*.png "$OUT"/game-dev-apple-touch-icon-*.png "$WORK"/{32,48}.png; do hatch "$file" 0 33; done
hatch "$OUT/game-dev-maskable-icon-512x512.png" 15 22
ico "$OUT/game-dev-favicon.ico"

# The share card, 1200 x 630: the first visit's painting under Hearth at 80%, the lettered mark at its middle.
magick "$OUT/landscapes/dark-plains-1600.webp" -resize "1200x630^" -gravity center -extent 1200x630 \
  \( -size 1200x630 "xc:$HEARTH" -alpha set -channel A -evaluate set 80% +channel \) -composite \
  \( "$LETTERED" -trim +repage -resize x380 \) -gravity center -composite -strip "$OUT/covers/og-image.png"
