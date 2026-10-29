#!/usr/bin/env bash
# Every brand image the app and the status page serve, exported from the Realms Brand Kit v3 folder, so a new kit is one
# run: the parent mark by displayed size (the kit's README: lettered above 120 px, contour 64-120 px, small below 64 px),
# each age's transparent lockup, the install icons and favicon (the contour globe, gold on Hearth; the dev set adds a
# hatched corner), and the share card (the lettered mark on a painting under Hearth at 80%, the deck's page 19).
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

# web <master> <out.webp> <size>: the master cropped to its art and written at that size, an ImageMagick geometry
# ("480x" a width, "x480" a height), about twice its largest use.
web() {
  magick "$1" -trim +repage -resize "$3" -strip -quality 90 -define webp:method=6 "$2"
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

# exact <kit export> <file>: one of the kit's exact-size exports, unchanged, on Hearth.
exact() {
  magick "$1" -background "$HEARTH" -flatten -strip "$2"
}

# set_of_icons <prefix>: one environment's icons, named game-<prefix>...; the globe fills the icon as the kit's own
# exports do, and the favicon's sizes take the small globe (the kit's 32 and 48 px exports).
set_of_icons() {
  icon "$CONTOUR" "$OUT/game-$1pwa-192x192.png" 192 88
  icon "$CONTOUR" "$OUT/game-$1pwa-512x512.png" 512 88
  # A maskable icon keeps the globe inside the 80% safe circle.
  icon "$CONTOUR" "$OUT/game-$1maskable-icon-512x512.png" 512 78
  icon "$CONTOUR" "$OUT/game-$1apple-touch-icon-180x180.png" 180 88
  icon "$SMALL" "$WORK/16.png" 16 100
  exact "$KIT/01-Logos/Realms/Small/realms-small-32.png" "$WORK/32.png"
  exact "$KIT/01-Logos/Realms/Small/realms-small-48.png" "$WORK/48.png"
}

# The parent mark by the size it is drawn: the first frame's (240 px), the bar's (28 px), the loader's (96 px).
web "$LETTERED" "$LOGOS/realms-lettered.webp" 480x
web "$SMALL" "$LOGOS/realms-small.webp" 112x
web "$CONTOUR" "$LOGOS/realms-contour.webp" 192x
# Each age's lockup above its Realms stamp, with real alpha, for its painting: Play's cards (owner, 29 October 2026:
# "so I think we can remove the realms below frontier & blitz"; the parent mark stays in the bar). It is the kit's own
# composition, emblem over title, cut at a row between the title and the stamp: every kit lockup draws its title above
# row 724 and its stamp from row 760 of its 1536x1024 canvas. The cut row must be empty, so a kit that moves the stamp
# stops the build instead of cutting through its art.
STAMP_CUT=740
for age in blitz frontier eternum; do
  lockup="$KIT/01-Logos/${age^}/Transparent/$age-lockup.png"
  if [[ $(magick "$lockup" -crop "1536x1+0+$STAMP_CUT" -format "%[fx:maxima.a]" info:) != 0 ]]; then
    echo "$lockup has art on row $STAMP_CUT: the stamp moved, read its rows again" >&2
    exit 1
  fi
  magick "$lockup" -crop "1536x$STAMP_CUT+0+0" +repage "$WORK/$age-lockup.png"
  # By height, as the cards draw it (at most 9rem, a lead's): its art's width varies by age.
  web "$WORK/$age-lockup.png" "$LOGOS/$age-lockup.webp" x480
done
# The status page's header mark (40 px); that site shares no file with the app.
web "$SMALL" "$STATUS/realms-small.webp" 160x

set_of_icons ""
magick "$WORK/16.png" "$WORK/32.png" "$WORK/48.png" "$OUT/game-favicon.ico"

set_of_icons "dev-"
for file in "$OUT"/game-dev-pwa-*.png "$OUT/game-dev-apple-touch-icon-180x180.png" "$WORK"/{32,48}.png; do hatch "$file" 0 33; done
hatch "$OUT/game-dev-maskable-icon-512x512.png" 15 22
magick "$WORK/16.png" "$WORK/32.png" "$WORK/48.png" "$OUT/game-dev-favicon.ico"

# The share card, 1200 x 630: the first visit's painting under Hearth at 80%, the lettered mark at its middle.
magick "$OUT/landscapes/dark-plains-1600.webp" -resize "1200x630^" -gravity center -extent 1200x630 \
  \( -size 1200x630 "xc:$HEARTH" -alpha set -channel A -evaluate set 80% +channel \) -composite \
  \( "$LETTERED" -trim +repage -resize x380 \) -gravity center -composite -strip "$OUT/covers/og-image.png"
