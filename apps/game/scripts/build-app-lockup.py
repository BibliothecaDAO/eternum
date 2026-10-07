"""The app lockup (ruled 7 October 2026): the kit's mark and the word "Realms" in IM Fell English SC, drawn as outlines
in one SVG so the word never depends on a loaded face. Proportions follow the painted pass: the word's cap height is
0.6 of the mark's height, set 0.36 of it after the mark, centred on it.

Run from apps/game: uvx --from 'fonttools[woff]' python -I scripts/build-app-lockup.py
"""

import re

from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

FONT = "public/fonts/im-fell-english-sc.woff2"
MARK = "public/images/logos/realms-mark.svg"
OUT = "public/images/logos/realms-lockup.svg"
WORD = "Realms"
MARK_WIDTH, MARK_HEIGHT = 256, 217
CREAM = "#F4EBDC"


def short(value):
    return ("%.1f" % value).rstrip("0").rstrip(".")


def word_outline():
    font = TTFont(FONT)
    glyphs, cmap, advances = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
    scale = MARK_HEIGHT * 0.6 / font["OS/2"].sCapHeight
    baseline = MARK_HEIGHT * 0.8
    x = MARK_WIDTH + MARK_HEIGHT * 0.36
    pen = SVGPathPen(glyphs, ntos=short)
    for char in WORD:
        glyph = cmap[ord(char)]
        glyphs[glyph].draw(TransformPen(pen, (scale, 0, 0, -scale, x, baseline)))
        x += advances[glyph][0] * scale
    return pen.getCommands(), x


def mark_paths():
    return "".join(re.findall(r"<path[^>]*/>", open(MARK).read(), re.S)).replace(f'fill="{CREAM}"', "")


outline, width = word_outline()
with open(OUT, "w") as out:
    out.write(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width:.0f} {MARK_HEIGHT}" fill="{CREAM}">'
        f"<title>{WORD}</title>{mark_paths()}<path d=\"{outline}\"/></svg>\n"
    )
