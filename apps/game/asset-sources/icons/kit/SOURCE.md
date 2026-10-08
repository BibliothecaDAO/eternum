# Kit icons: Icons 2, the gilded family

The kit's icon codes (`src/ui/design-system/kit/kit-icon.tsx`) drawn as one family, as the owner chose (Icons 2, 8
October 2026): every icon a painted master in the menu icons' hand, then one scripted treatment.

- `manifest.json` lists each master, its subject, and the treatment: the output size (128 px), the share of the square
  the subject fills (84 %), the gold ramp its light and shade map onto, and the keyline.
- `masters/` holds the masters made for the kit in the menu icons' hand (`../menus/approved/ui-chest.png` and
  `ui-camp.png` as the reference), each approved by the owner as made on 8 October 2026: the B, C, D, E and F sections
  of the icon brief (the hourglass, the resources and research sides, the seal, slots, store limit, clock and Back, the
  site marks and the rift, the six Blitz rating tiers). The other masters the manifest lists are the menu icons' own
  approved masters, reused as they are.
- `pnpm icons:kit:build` (from apps/game) writes `public/image-icons/kit/<slug>.png`; the masters are never edited.
  `scripts/icons/kit-icon-pipeline.test.mjs` (run by `pnpm verify:assets`) holds every published icon to what its master
  makes.

The three Ethereal reach marks (depth I to III, owner approved as made) joined with the Spire card and the research tree
that draw them.

Not yet in the family: the building renders (Farm, Workshop, Barracks, Hut wait for their illustrations), the army
attributes (their Aspects' sigils, ruled) and Discord (its brand mark).
