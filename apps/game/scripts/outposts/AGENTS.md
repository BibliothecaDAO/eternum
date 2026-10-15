# Outpost delivery

| Rule                                                      | Enforcement                                                                                                                                                                           |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Retain the selected village painting with its source.     | `export-outpost.py` verifies the painting path and SHA-256.                                                                                                                           |
| Keep village roofs, walls and canvas away from the fence. | `verify-outpost.mjs` requires `_YARD_ARCHITECTURE` and checks its decoded vertices within radius 0.70; the fixed fence centerline is radius 0.81. The asset suite runs this verifier. |

Match the selected painting's architectural proportions. A village progresses from camp through permanent buildings, not
a forced height increase. Do not stretch geometry to satisfy a tier height comparison. The shared export reads packed
sources; only intentional source authoring regenerates them.
