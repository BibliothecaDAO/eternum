# Frontier attribute glyphs

The four SVG files are the editable source and runtime output. They are hand-authored paths on a 24-unit grid, designed
for 20 px display. No raster master, font, external image, filter or build step is required.

- `battle.svg`: parchment sword blade, gold bevel, guard and grip.
- `logistics.svg`: marching boot with a gold cuff and sole.
- `scouting.svg`: parchment eye, gold iris and dark pupil.
- `support.svg`: a raised forked banner, representing the army's contribution to realm production.

Direction: Frontier design section 3.12, especially mockups 6 and 8. The sword, boot, eye and banner silhouettes retain
the mockups' meaning. These are flat HUD glyphs, distinct from painted board objects.

Palette: `#dfaa54` gold, `#eadfc8` parchment, `#1b1207` ink. The brand's action amber `#e39001` is reserved for
interactive UI rather than painted into passive attribute symbols. Paths use a 1.5-unit ink outline, equivalent to 1.25
px at use size.

Runtime paths: `/images/frontier/attributes/{battle,logistics,scouting,support}.svg`. Render as images at 20 by 20 CSS
pixels; supply accessible names from the surrounding UI. The transparent canvas lets the dark HUD show through. Review
captures at actual size remain outside the repository. No frontend registry or UI wiring is included here.
