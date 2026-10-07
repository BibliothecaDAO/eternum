# Kit landscapes

The brand kit's landscape paintings (`Realms Eternum Brand Kit v2/Landscape Backgrounds`, 2688 × 1792, no text), served
at web sizes. One painting per age, so a player learns the ages by sight (brand.html, Key art):

- `twilight-tundra`: Age I, Blitz
- `wheat`: Age II, Frontier
- `castle`: Age III, Eternum
- `hidden-castle`: Age IV, Dominion (drawn greyed)
- `dark-plains`: the first visit's hero
- `stormy`: a failure state

Each at 800 and 1600 px wide, from the kit's PNG master:

```sh
magick "<Painting>.png" -resize 800x -strip -quality 78 <painting>-800.webp
magick "<Painting>.png" -resize 1600x -strip -quality 78 <painting>-1600.webp
```

The masters stay in the kit; a painting joins this folder only with the screen that draws it.
