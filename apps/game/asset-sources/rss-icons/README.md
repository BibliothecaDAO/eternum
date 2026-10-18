# Resource and landmark icons

Production resources Stone through Dragonhide use the live pre-Facets designs from `638fd7fb410`. All 22 source images
match the committed historical archive byte for byte. Essence uses the shipped square violet bottle from `301ca1d55a2`.
Research keeps the shipped book and flask, with teal liquid. Production uses the 18 approved Facets repaints of the
original relic designs. Troop poses, tier palettes, Labor and UI glyph artwork remain unchanged. Every delivery uses the
tighter crop. Workshop retains its existing artwork while its dedicated model is prepared.

Farm, Workers Hut, camp, rift, spire and chest use actual GLBs. Hyperstructure uses the completed runtime model, entity
17 at 100% construction, including its shaft and crown. The chest contains only `ChestBody`, with the runtime material
presentation; its tile, pedestal, seals and orbit gems are excluded. The rift's Earth surface and spire's ground outcrop
are excluded. Model files and construction-card thumbnails are unchanged. Realm marker frames are fitted to the tighter
crops so the painted subjects clear the ownership rims. Their painted footprints remain larger than before; the catalog
proof checks visible subject extent, rim clearance and overlay order.

## One crop and delivery path

`normalizeMaster` measures 8-connected subject pixels at alpha 128, ignoring isolated components smaller than 0.1% of
the visible pixels (minimum four pixels). It crops those bounds and fits the longest side to 920 of 1024 px (89.8%). The
remaining border protects the subject from clipping. Faint glow and stray export specks cannot count as subject padding.
WebP uses quality 90, alpha quality 100 and effort 6 at 64/128/256. The shared `deliverIcon` exporter checks the encoded
bytes before writing. Production checks also reject any delivery below 85% subject fill, with no exceptions. Original
masters and historical comparison bytes remain intact as sources.

The normalizer and regression tests live in `scripts/icons/`. The real undersized hammer delivery is retained as a
negative-control fixture. An alpha-bound check cannot identify an unwanted terrain tile: model subject selection is also
inspected visually. The catalog pins model inputs and source hashes.

## Rebuild and verify

From the repository root:

- `pnpm icons:import` restores 23 selected masters from committed, hash-verified archives: 22 live resources and shipped
  Essence. The approved relic paintings are their own committed production masters. Research's teal edit and model
  renders are their own committed masters.
- Start the client: `pnpm --dir apps/game dev --host 127.0.0.1 --port 4193 --strictPort`.
- `node scripts/icons/render-models.mjs https://127.0.0.1:4193 <new-evidence-directory>` rerenders seven model masters
  with the shared building-thumbnail renderer and refreshes their source hashes. It uses the client's compressed-model
  loader and releases each graphics context after capture.
- `pnpm icons:build` delivers production masters. Pass IDs to rebuild only selected art.
- `pnpm icons:study` refreshes normalized model references and the comparison manifest; `pnpm icons:study --check`
  verifies committed before snapshots and historical source hashes. Production delivery verification belongs to
  `icons:check`.
- `pnpm icons:check` checks meanings, selected source bytes, model inputs, delivery bytes and fill for every production
  icon. Its negative tests reject changed historical bytes, model inputs, masters, deliveries and undersized art.
- `pnpm icons:prove <new-evidence-root> https://127.0.0.1:4193 --resources` presses all five comparison tabs on desktop
  and phone, verifies the active tab, image decoding, exact URLs, pixel/frame sizes and overflow, then passes its
  records through the shared proof collector. A failed navigation or assertion makes the command fail.

These commands need no historical Git objects. The committed archives and their independent SHA-256 pins are the
sources. Revision/path/blob fields describe provenance; they are not runtime dependencies. To acquire a different
historical selection, explicitly fetch its source revision in a full checkout, extract its documented original paths,
review them, and commit the archive plus hashes. Never make CI fetch that history implicitly.

## Lab

`/lab/kit/resource-icons` opens **Relics**: the previous production artwork beside the selected Facets paintings. Each
pair uses actual 16/24/32/40 px images and a HUD chip with 28 px art. Current chips use `HudRelic` and the production
semantic icon path; historical chips reuse its styling with the archived image. Phone columns remain side by side. HUD
sizes are unchanged.

**Resources** compares the previous paintings with the selected 22 live resource designs, Essence and Research.
**Models** compares the previous icons with subject-only current icons and a tightly cropped model reference. **Kept**
shows the existing Labor, nine troop tiers, Workshop and UI glyph designs with the common crop. **Inventory** retains
all 58 historical resource comparisons. LORDS remains the official SVG.

`catalog.json` pins the before snapshot at `d79d9985eea0d6fe63990a3f8be8f4c93ecb2c89` and hashes every before image.
`history.json` maps 57 committed original PNGs plus the old SAT text glyph. There is one production semantic path.

## Selected Facets relics

The 18 approved masters and exact prompts live in `../facets/{masters,prompts}/`. The production catalog pins each
master's SHA-256 and original review revision; production verdicts record the owner's 2026-10-18 selection and the
individual design. The repaints preserve each relic's symbol, composition and tier distinction. Their style references
were the shipped Knight T2 and Wheat paintings. No decorative frame or external tier plaque is added.

Tier pairs are bronze/steel winged boots, sword/axe, round/kite shields, eye/compass, map/treasure chest, wall/castle,
pickaxe/furnace, gloves/hammer and barracks/rally horn. `icons:build` delivers them through the common normalizer into
`public/icons/facets/{64,128,256}/`; `Icon`, `resourceMeaning` and the semantic catalog remain the only production path.

The separate proposal catalog, masters, prompts, exporter and 54 lab deliveries are removed. Old production files are
replaced at their existing URLs. The 64/128 px previous deliveries remain only as the wired **Before** comparison;
`catalog.json` records their hashes and `relicsBefore` revision. Original PNGs remain used by **Inventory** and its
historical-source checks. The previous 256 px deliveries have no retained copy. This replaces the review pipeline with
the existing production pipeline and adds no player setting or alternate renderer.
