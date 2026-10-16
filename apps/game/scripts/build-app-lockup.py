"""The app lockup (ruled 7 October 2026): the kit's mark and the word "Realms" in IM Fell English SC, drawn as outlines
in one SVG so the word never depends on a loaded face: the word beside the mark (the phone's top row and the desktop's
top bar; the word's cap height is 0.6 of the mark's height, set 0.36 of it after the mark, centred on it). The status
site (apps/status), which shares no file with the app, gets its own copy.

Run from apps/game: uvx --from 'fonttools[woff]' python -I scripts/build-app-lockup.py
"""

import re

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONT = "public/fonts/im-fell-english-sc-regular.ttf"
MARK = "public/images/logos/realms-mark.svg"
OUT = "public/images/logos/realms-lockup.svg"
OUT_STATUS = "../status/public/realms-lockup.svg"
WORD = "Realms"
MARK_WIDTH, MARK_HEIGHT = 256, 217
CREAM = "#F4EBDC"


def short(value):
    return ("%.1f" % value).rstrip("0").rstrip(".")


def word_outline(cap_height, x, baseline):
    font = TTFont(FONT)
    glyphs, cmap, advances = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    scale = cap_height / font["OS/2"].sCapHeight
    pen = SVGPathPen(glyphs, ntos=short)
    for char in WORD:
        glyph = cmap[ord(char)]
        glyphs[glyph].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += advances[glyph][0] * scale
    return pen.getCommands(), x


def mark_paths():
    return "".join(re.findall(r"<path[^>]*/>", open(MARK).read(), re.S)).replace(f'fill="{CREAM}"', "")


def write(path, width, height, mark_transform, outline):
    with open(path, "w") as out:
        out.write(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {height:.0f}" fill="{CREAM}">'
            f'<title>{WORD}</title><g transform="{mark_transform}">{mark_paths()}</g><path d="{outline}"/></svg>\n'
        )


outline, width = word_outline(MARK_HEIGHT * 0.6, MARK_WIDTH + MARK_HEIGHT * 0.36, MARK_HEIGHT * 0.8)
write(OUT, width, MARK_HEIGHT, "translate(0 0)", outline)
write(OUT_STATUS, width, MARK_HEIGHT, "translate(0 0)", outline)
