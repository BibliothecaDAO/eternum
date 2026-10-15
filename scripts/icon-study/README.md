# Icon direction study

Purpose: choose one icon grammar for resources, controls and the minimap before changing the game.

The picker is a standalone review surface; no live game state or account is needed.

## Reproduce

From the repository root, after `pnpm install --frozen-lockfile`:

```sh
pnpm icons:study:prove /home/djizus/projects/eternum-lanes/evidence/icons
```

The proof command also runs the inventory and raster checks. Inventory writes a new dated scan and updates only its
landing link. Verification writes pixel occupancy and duplicate checks. Give verification a new output directory for
each run. The proof command rebuilds the picker, starts it on port 4193, opens an isolated browser, exercises the real
size, label, density, reading, download, inventory and selection controls, records screenshots and assertions in a new
timestamped folder, then closes its browser and server. It never starts the game or WebGL. Python's Pillow package is
required for inventory image dimensions.

The shared browser was occupied during this study; the proof uses the permitted browser CLI fallback. Screenshot content
is checked as well as DOM state. A typed test reading proves the interaction only; it is not a recognition study.

Open `evidence/icons/viewer/index.html` directly to review, or serve the evidence root with:

```sh
pnpm icons:study:serve /home/djizus/projects/eternum-lanes/evidence/icons
```

Then visit `http://127.0.0.1:4193/viewer/`. Stop the server after review. The generated HTML includes the catalog and
script so it also works without a server; fonts and styles remain sibling files.

## Feature map

- `/viewer/`: three directions side by side, each with the same catalog, HUD strip and minimap.
- Size buttons: inspect every sample at 16, 24 or 32 actual CSS pixels.
- Labels: hide the names, choose a sample, write a reading, then reveal the intended reading. Download the record.
- Density: compare 20 and 220 structures plus armies on the same 320 × 240 fixture.
- Theme radio buttons: choose a direction for review; the choice changes no game files and resets on reload.
- Inventory link: source locations, formats, intrinsic sizes, code references, current-style contact sheet.

First view has four groups: introduction, comparison controls, three theme columns, ownership legend. Each column has
three jobs to compare: HUD, minimap, catalog. The sole decision is a theme choice; inspection controls stay secondary.
The catalog is grouped into eight families so a long list does not become a single decision.

## Sources and build

Edit semantic geometry and intended readings in `catalog.mjs`, then run `pnpm icons:study:author`. This produces the 321
review SVG masters under `apps/game/asset-sources/icon-study`. All resources come from `ResourcesIds`; a missing
geometry stops authoring. Survey keeps open contours, Banner uses solid shapes and transparent cuts, and Signal
quantizes the silhouette to a 16-cell vector grid. The three grammars share object metaphors for a fair comparison.

`pnpm icons:study:build <output-directory>` packs the SVG masters into a namespaced sprite and generates the picker. The
picker has one SVG-use renderer for every family. No raster imagery, external fonts or network calls are required.
Builds are deterministic. Authored sources are retained for review; viewer/sprite outputs stay outside the repository.

## Phase boundary and migration

No production icons are replaced in this study. Keeping proposals separate is required until a direction is picked. The
cost is one source catalog, three sets of SVG masters, an inventory script, a sprite/viewer builder and verification
scripts. No runtime state, setting or dependency is added to the game.

After approval, one chosen set supplies a typed semantic `Icon` component: name, size, accessible label. Decorative
icons take the accessible name from their enclosing control. Resource IDs map exhaustively to semantic names; callers
cannot construct filenames. Minimap markers compose the same symbol with owner shape and level/strength value from
confirmed game facts. Strength bands must use the agreed game measure, not these fixture numbers. The strategic 3D layer
may bake the same SVG into its existing texture atlas; it must not acquire a second art catalog.

Migrate GameIcon, KitIcon, ResourceIcon, direct action images, emoji statuses and minimap label consumers; then delete
old renderers, imports, builders and unreferenced files in the same change. Directional arrows become rotations within
the typed renderer. No compatibility wrapper or persisted theme switch. Before deletion, rescan remaining references and
exercise resource, army, build, transfer and minimap paths through the game's existing proof command. The picker proof
does not substitute for that live-game proof.

Brand marks and Order sigils need the owner's decision before alteration. Their current names and semantics must not
silently become ordinary action glyphs. The 220-site fixture shows that per-site values do not fit at every zoom; choose
a density policy before wiring the markers. Exact fantasy resource recognition remains unproven until people try the
label-hidden comparison.
