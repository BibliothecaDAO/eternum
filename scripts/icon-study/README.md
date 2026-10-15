# Painted icon study

Choose a painted icon family by comparing it with shipped art in real kit components. The lab view replaces the rejected
standalone glyph picker and its geometry builder. It adds two sample families, a scoped art provider and a small
fixture; the production icon map remains the default until a direction is picked.

## Reproduce and review

After workspace dependencies and packages are built:

```sh
pnpm icons:study:prove /home/djizus/projects/eternum-lanes/evidence/icons
```

This exports the retained masters, starts the real client on port 4193 if needed, opens `/lab/kit/icons`, exercises its
controls and saves assertions, screenshots, readings and a command transcript in a new timestamped directory. It closes
its isolated browser and leaves the review server running. The client needs the same local environment as the game.

The shared browser may be occupied; the runner uses the browser CLI fallback. It never enters a match or sends a game
transaction. Its typed reading verifies the interaction, not human recognition. No performance timings are collected.

## Feature map

- `/lab/kit/icons`: Shipped, Fieldwork and Facets switch actual PriceChip, Button and OrderBar art. The URL remembers
  it.
- Confirm Move or Explore: spend fixture wheat and stamina. Reset fixture restores the original values.
- Size: compare every old/new pair at 24, 32 or 64 CSS pixels on the client's `frontier-card` surface.
- Minimap: inspect 12/16 px emblems, ownership shapes and value badges. Switch 20-site detail to 220-site sector counts;
  open a sector to inspect each counted entity. The fixture has six or eighteen armies respectively.
- Hide labels, Read this icon, enter a reading, Reveal meaning, Download readings.
- Existing source inventory remains in the external evidence directory; rerun
  `icons:study:inventory <output-directory>`.

First view has four groups: title, comparison controls, live component fixture and minimap. The catalogue is grouped by
family below it. The review decision is which painted direction to continue; inspection controls are secondary.

## Source and export lever

`apps/game/asset-sources/icon-study-painted` retains 52 square transparent masters, one shared style, two direction
blocks and one subject prompt per icon. `catalog.json` maps all 26 subjects to shipped counterparts. `verdicts.json`
records editorial comparison at 32/64 px; the builder refuses missing verdicts or anything marked worse.

```sh
pnpm icons:study:requests > /path/outside/repo/requests.json
pnpm icons:study:review /path/to/new/review-directory
pnpm icons:study:build
```

The request command assembles exact prompts and reference paths. `paint-batch.mjs` is the image-operation bridge: pass
requests and three host callbacks (`generate`, `persist`, `preview`). Each request is one transparent painting; the
bridge retains the returned master through `persist` and presents it through `preview`. This bridge was used to produce
the samples. It requires a host image operation; Node alone cannot paint a new master. Keep returned originals outside
the repo, and copy approved source pixels into `masters/<direction>/<subject>.png`.

The export command crops alpha bounds, centres the subject in a transparent 1024 square with consistent padding, then
writes 12/16/24/32/64/256 PNGs and a 2048×1024 atlas plus coordinates for each direction to
`apps/game/public/lab-icons`. Metadata is removed during export. Exports rerun deterministically from retained source
pixels. Model and seed controls are not exposed by the image operation used here; prompt reruns are new candidates, not
identical pixel regeneration.

`paint-review.mjs` uses the same normalization as export to produce old/new contact sheets before publication. Rejected
candidates stay in external evidence, never in the lab's exported candidate catalogue.

## Full replacement after selection

`kit-migration.json` covers all 85 current KitIcon codes. Every family receives painted art: stores, troops, actions,
sites, app controls, research, progression, Orders and ratings. Remove all gilded treatments. Named Orders retain their
identity and colours in painted materials; Discord keeps its recognizable brand mark without a gilded frame.

`semantic-map.json` preserves the prior inventory's 107 meanings without its rejected geometry. This is a coverage map;
use the painted sample's current metaphors when they supersede the old proposal. Lightning means stamina only. Victory
uses laurel/trophy, not lightning; sites have their own subjects, not a shared crown. Owner circle/square/triangle and
external value badges remain separate from subject art.

After selection, generate missing paintings, migrate GameIcon, KitIcon, ResourceIcon, direct images, emoji statuses and
minimap consumers to one typed semantic renderer, then delete the old renderers and unreferenced assets. The lab
provider and direction switch are review tools, not a player preference or compatibility path. Re-run the inventory and
exercise real resource, army, build, transfer and minimap paths before shipping the chosen set.
