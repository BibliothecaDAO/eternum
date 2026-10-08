# Paintings

Every painting the app draws, served at web widths. `src/shell/paintings.ts` lists them with their widths; a painting
joins this folder only with the screen that draws it.

## The ages: the lore paintings

The four ages wear the paintings of the owner's lore site, "Realms · The Lost Ages" (fetched 2026-10-08), so the app and
the lore show an age by the same picture. Project art, owned by the project like the brand kit.

- `blitz-spires`: Age I, Blitz. Lore site `assets/blitz-spires.webp`, SHA-256 `ebf47ef0…0441f09`
- `frontier-mist`: Age II, Frontier. Lore site `assets/frontier-mist.webp`, SHA-256 `430ccf9f…2702561`
- `eternum-restoration`: Age III, Eternum. Lore site `assets/eternum-restoration.webp`, SHA-256 `e5d05e6f…030fd07`
- `dominion-first-adventurer`: Age IV, Dominion (drawn greyed while it is locked). Made for the project in the lore
  paintings' style, 2026-10-08, from the lore's Dominion lines: `dominion-01-first-adventurer.png`, SHA-256
  `f1b1cf5a…dfbdc2ce626`

The masters are 1536 × 1024; no larger ones exist. Each is served at 800 and at 1536 (the lore site's WebP copied
unchanged; Dominion's PNG converted at quality 78). A full-window stage at 1920 draws them 1.25× enlarged, so the app
only draws them full-window under the dark grade.

```sh
cp "<lore site>/assets/<painting>.webp" <painting>-1536.webp
magick "<master>" -resize 800x -strip -quality 78 <painting>-800.webp
```

## The kit landscapes

The brand kit's landscape paintings (`Realms Eternum Brand Kit v2/Landscape Backgrounds`, 2688 × 1792, no text):

- `dark-plains`: the first visit's hero
- `brooding-plains`: sign-in ("The mist forgets.")
- `stormy`: a failure state
- `winter-fortress`: Profile signed out, a removed device

Each at 800, 1600, 1920 and 2688 px wide (the master's own width, the largest without enlarging it), from the kit's PNG:

```sh
for w in 800 1600 1920 2688; do magick "<Painting>.png" -resize ${w}x -strip -quality 78 <painting>-$w.webp; done
```

WebP only: at the same brushwork AVIF is no smaller (quality 65: 238 KB against WebP's 219 KB at 1920), and at the size
that saves 30 % (quality 55) it smooths the strokes away.
