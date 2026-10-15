# HUD comparison

Choose a HUD while keeping the live terrain, lighting and camera fixed. Open `/lab/kit/hud/redesign`; the kit's
component page links here. This extends UI kit & HUD. No game orders are sent.

The controls switch Current HUD / A, 3 / 25 / 220 structures, three naming pairs, two list treatments and two dock
positions. Current reconstructs the classic layout on fixture facts with the shipped structure rows, filter chips,
production badges and minimap. A puts holdings and the realm panel on the left, and suggestion, events and selected tile
on the right, using the same bronze panels and primary button as the War room. Phone Map / Holdings stays unchanged.
Current's lab callbacks preview selection, favorites and sheets; they are not a logged-in game. Historical screenshots
remain the pixel reference. B's resource shelf, the ledger and wide minimap were rejected for obscuring more than the
current HUD.

| Feature           | Reach it                                                                                            |
| ----------------- | --------------------------------------------------------------------------------------------------- |
| Compare layouts   | Current HUD / A · Guided rails; the renderer and camera stay mounted                                |
| Camera            | Drag exposed terrain, wheel to zoom, Reset camera in the toolbar                                    |
| Structures        | Scale selector; A: category filters, search, sort, select a row                                     |
| Large list        | 220 structures; search Lastwatch, or choose Attention groups and open Running                       |
| Resources         | Named circles and owned amounts; badge is building count, ring is supply                            |
| Production        | Smart / Idle / Custom; Production detail opens six readings and Input rules                         |
| Commands          | Build, Production, Military, Transfer; Trade joins the 220/Eternum fixture command mask             |
| Suggestion/events | Level up to City opens its preview; scout event selects Northern grassland                          |
| Minimap           | The shipped hex renderer uses the terrain fixture's cells and structures; drag pans the live camera |
| Marker values     | Realm level and army strength stay attached to the rendered markers during navigation               |
| Phone             | Map / Holdings at the foot; the holdings panel provides list and production controls                |
| Inventory         | Noticed units in the lab toolbar expands the per-group inventory                                    |
| Evidence frame    | Add `capture=1` to remove lab chrome; 1440×900 desktop or 390×844 phone                             |

## Proof

Start the client from the repository root:

```sh
pnpm --dir apps/game dev --host 127.0.0.1 --port 4192
pnpm --dir apps/game prepare:hud-proof
```

Run the emitted `evidence/hud/lab-proof-driver.js` with the Playwright browser tool's filename input. The retained
driver opens the real lab, drives the visible controls and writes screenshots to a new timestamped directory. Save its
returned record as `proof.json` there. It closes the rendering page to `about:blank`, including on failure. Keep the dev
server running while this review is awaiting a choice. The game proof remains `prove:play --game …` after an
implementation pick.

The driver captures the current desktop fixture, six A baselines, desktop/phone searches, grouped scrolling and expert
sheets. It checks Trade's mode mask, all terrain hexes and structures, the live canvas surviving layout switches, camera
drag and minimap navigation. `review.mjs` rejects crop/zoom of the historical comparison, an unready or undersized live
canvas, visible KitIcon art, a dot-grid minimap, a missing primary, command paintings below 44px and excessive map
cover. `review.test.ts` rejects the measured first picker with all six original failures. Component tests exercise the
shared minimap's coordinate normalization and the shipped structure row's selection/action boundary.

## Boundaries and measurements

`HexMinimapView` is the shipped render path with facts passed in. `HexMinimap` continues to read production facts and
pass them to that view. `StructureStatusRowView` similarly accepts the realm action; its production wrapper still
supplies the existing action. The lab passes painted art through the minimap marker-art seam. No module substitutions or
separate static viewer entry remain. The lab uses the existing terrain renderer's settlement-regrowth fixture, game
lighting and models; its two army value markers are illustrative fixture readings, not moving world armies.

The 3/25/220 fixtures stress the holdings list. They do not spawn 220 settlements or model an economy. Resource
readings, VP and clock are fixed. View naming previews the chosen radio state; it does not enter a player's realm. Modal
bodies preview layout and selection, without transactions. Integration follows the owner's choice.

A noticed unit is a semantic reading: a label/value pair, row, resource token, control, title or explanation. At least
12 vertical and 3 horizontal pixels must survive viewport/scroll clipping. Terrain, shadows and hidden panels do not
count. Counts are inventory, not usability scores. Full frame coverage is the clipped union of HUD frame rectangles over
1,296,000 pixels, excluding shadows and tool chrome. Historical reference frames are annotated in `review.mjs`; current
lab captures additionally record their actual DOM frames. Neither comparison is a performance measurement.

The added cost is fixture data, this lab view, a browser proof and small view boundaries in the shared components. It
replaces the disposable standalone picker, cropped image, custom dot map, import substitutions and rejected layout
paths.
