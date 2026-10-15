# HUD review constraints

| Rule                                                                             | Enforcement                                                                     |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Use the shipped minimap renderer and pass fixture facts at its boundary          | `HexMinimapView`; no store-module substitutions                                 |
| Keep a single live renderer while comparing HUD layouts                          | `HudRedesignLab` owns its lifecycle; browser proof checks canvas identity       |
| Use existing painted art, a single strong suggestion and readable command images | `inspectHudReview` / `judgeHudReview` in the browser proof                      |
| Cover less map than the current reference at 1440×900                            | Rectangle-union gate in `review.mjs`, checked for every offered desktop fixture |
| A historical capture comparison preserves the full frame and zoom                | Backdrop dimensions gate; recorded rejected picker regression                   |
| Test the recurrent failures against actual prior evidence                        | `rejected-hud-1.json` and `review.test.ts` run in the regular client test suite |

Judge the actual screenshots beside the untouched classic and War room references before offering a layout. Geometry
checks cannot decide whether a UI belongs in a strategy game. Remove a worse candidate from the controls and retain its
rejection evidence. Keep the tool feature map in this README and `src/lab/README.md` current.
