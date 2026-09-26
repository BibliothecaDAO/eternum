# Realm card stills

`ground.webp` is the realm card's backdrop on the home screen: the board's grass field from the three-quarter angle
every still shares, 1200 × 900 WebP. It makes no biome claim. The realm's tier castle joins it on the same field once
the directory carries the realm's level.

The editable source is `apps/game/scripts/realm-card/render-still.html`. It seeds its ground noise, so every render is
the same field. With `?tier=Settlement|City|Kingdom|Empire` it also loads that tier's model from
`public/models/settlements/` through the game's own loader and wears the ground to earth where the castle stands.

To render a still, start the game's dev server (`pnpm dev` in `apps/game`), open `/scripts/realm-card/render-still.html`
(add `?tier=` for a castle), and use "Save still". Put the file here under the name the link gives it.
