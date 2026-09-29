# Realm stills

A realm drawn outside the game (the doorway, the home realm card) shows the still for its castle level.

## Tier stills

`settlement.webp`, `city.webp`, `kingdom.webp` and `empire.webp` are the castle levels 0 to 3 (Tier I to IV), each 1200
× 900 WebP. They are captures of the realm view itself, so the castle, the board's ground and its plot outlines are the
ones the game renders. All four share one camera, one light and one crop, so an upgrade reads as the castle growing on
the same board.

To capture them, run the game's dev server (`pnpm dev` in `apps/game`). Open a Frontier game's realm view as a
spectator, `/g/<chain>/<game>/map?spectate=true`, in a browser whose local storage holds `eternum:dev-mode` = `1`, with
a 1600 × 1200 viewport at device scale 1.5. Then, in that page only:

1. From `getActiveGameStore()` in `/src/sync/active-game-client.ts`, remove the shown realm's `Building` rows, all but
   its centre `10:10`. Rewrite its `Structure` row with `base.level` set to the level to capture and `metadata.order`
   set to `0`, so the banners carry no player's Order.
2. In the dev GUI, check "Override Time" and set "Day Progress" to 42. Uncheck "Evolving weather" and force "sunny".
3. Set the local zoom to 9, with `useCameraZoomStore.getState().setLocalDistance(9)` from
   `/src/hooks/store/use-camera-zoom-store.ts`.
4. For each level, wait for the board to redraw, then screenshot the 800 × 600 CSS pixels at (400, 190). Save the
   screenshot here as quality 86 WebP.

The edits live in the capture page's own store; nothing is written anywhere else.
