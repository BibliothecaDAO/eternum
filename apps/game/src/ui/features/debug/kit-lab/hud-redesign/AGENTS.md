# HUD review constraints

| Rule                                                                                  | Enforcement                                                                                     |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Tile inspection follows only the active scene                                         | `useSelectedTile` scene union and `selected-tile-summary.test.tsx` switching regression         |
| Native occupancy does not require an entity ID                                        | `hasTileOccupier`, shared marker resolver and `painted-minimap.test.tsx` zero-ID/group behavior |
| Fixtures must mount the production HUD views; no separate lab presentation            | `ArenaHudView` and shared panel views; browser proof requires the production entry              |
| Transfer means donkey; troop portraits include their real tier                        | Production semantic icon/resource mappings and the nine-portrait production component test      |
| Floating command paintings stay inside their own circles                              | Browser proof checks transparent dock and inscribed image bounds                                |
| Minimap badges and crowding come from the icon lab                                    | Shared `HexMarker` / `MarkerClusters`; native-hex containment proof                             |
| Use the shipped minimap renderer and pass fixture facts at its boundary               | `HexMinimapView`; no store-module substitutions                                                 |
| Keep a single live renderer while changing fixture scale                              | `HudRedesignLab` owns its lifecycle; browser proof checks canvas identity                       |
| Use origin's Facets art in the HUD, one strong suggestion and readable command images | Source inventory plus `inspectHudReview` / `judgeHudReview` in the browser proof                |
| Cover less map than the current reference at 1440×900                                 | Rectangle-union gate in `review.mjs`, checked for every desktop fixture                         |
| A historical capture comparison preserves the full frame and zoom                     | Backdrop dimensions gate; recorded rejected picker regression                                   |
| Test the recurrent failures against actual prior evidence                             | `rejected-hud-1.json` and `review.test.ts` run in the regular client test suite                 |

The owner selected Realm / World map, compact rows and bottom-centre command bubbles. No presentation toggles or Current
reconstruction remain. Keep the tool feature map in this README and `src/lab/README.md` current.
