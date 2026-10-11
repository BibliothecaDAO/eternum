# Ornament

The image treatment's textures and corners, drawn as SVG by hand: the files are their own source, and they scale to any
size with no raster master.

- `grain.svg`: a fine grain laid over every painting on the desktop (fractal noise, 240 px tile).
- `leather.svg`: the leather ground of plates and the rail on the desktop (coarser noise, 300 px tile).
- `corner-*.svg`: a plate's engraved corner, one rule pair with a lozenge and a curl, drawn for the top left and turned
  for the other three, in the kit's gold.

`src/index.css` (`.plate`, `.painted`, `.grain`, `.leather`) is their only reader.
