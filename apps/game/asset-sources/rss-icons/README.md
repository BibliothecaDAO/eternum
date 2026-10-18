# Approved resource and model icons

The production set keeps every shipped icon except Essence, Research, all 18 relics, Farm, Workers Hut and five map
landmarks. Troops retain all nine original poses, palettes and tier designs unchanged. Labor and UI glyphs stay.
Workshop keeps its existing icon until its dedicated model is available. No category templates or unwired proposals
remain.

Essence and Research are the approved violet vessel and cyan research flask. The relic masters restore the exact
original bytes from revision `b636c768616959a27e2ef45665e2c317fda9b40c`, before the Facets replacement. Farm, Workers
Hut, camp, rift, spire and chest use their actual GLBs. The Hyperstructure site uses the runtime foundation-only model
kit. The chest uses its runtime material treatment and body scale. No replacement geometry is invented for these icons.

Production masters, source paths and SHA-256 hashes are in `../facets/catalog.json`; reviews are in its `verdicts.json`.
The common transparent normalizer fits the visible artwork to 880 of 1024 px and delivers quality-90 WebP at 64/128/256.
The semantic map and production renderers keep their existing paths. Construction cards retain their model thumbnails.

## Rebuild and verify

From the repository root:

- `node scripts/icons/import-resource-selection.mjs` restores the 20 approved historical masters from their pinned git
  sources.
- Start the client: `pnpm --dir apps/game dev --host 127.0.0.1 --port 4193 --strictPort`.
- `node scripts/icons/render-models.mjs https://127.0.0.1:4193 <new-evidence-directory>` rerenders seven model masters
  with the shared building-thumbnail renderer and refreshes their source hashes. It uses the client's loader and module
  graph so compressed textures and node materials render together correctly. It releases each graphics context after
  capture.
- `pnpm icons:build` delivers production masters. Pass icon IDs to rebuild only selected art.
- `pnpm icons:study` refreshes lab comparisons; `pnpm icons:study --check` verifies them.
- `pnpm icons:check` verifies meanings, original relic bytes, model sources, master hashes and exact source-driven
  deliveries. Negative controls corrupt a model, master and delivery and require each check to fail.
- `pnpm icons:prove <new-evidence-root> https://127.0.0.1:4193 --resources` drives the comparison on desktop and phone,
  verifies exact historical/before/current URLs, image decoding, pixel sizes and overflow, and saves screenshots.

## Lab

`/lab/kit/resource-icons` opens Relics, with Resources, Models, Kept and Inventory also available. It compares actual
16/24/32/40 px images; Current uses the game's production `Icon`. Model rows show the uncropped source render next to
the delivered icon. Relics show Old (production) beside Facets style (proposal). Prefer 40 px for the larger sheet, with
32 px the practical minimum. The lab does not change the HUD's chosen sizes.

`catalog.json` pins the before snapshot at `a4d7b4eefd02ca1b9be646cda56aaac70d4afef0`. `history.json` retains all 58
historical resource mappings: 57 exact PNGs plus the old SAT text glyph. LORDS stays the official SVG in production. The
archive costs about 9.6 MiB. Before snapshots and seven model reference images replace the rejected template masters,
prompts and deliveries. There is one production asset path and no additional gameplay state or settings.

## Facets-style relic review

The owner requested the same old relic designs in the shipped Facets style. `relics/catalog.json` records all 18
designs, the production baseline, original master hashes, the two shipped style references (Knight T2 and Wheat), review
master hashes and proposal verdicts. Exact prompts and transparent masters are kept beside it. Each edit uses its own
old relic as the composition reference; the shipped references provide only brushwork, material planes and lighting.

Tier cues remain intrinsic to the paintings: bronze/steel winged boots, sword/axe, round/kite shields, eye/compass,
map/treasure chest, wall/castle, pickaxe/furnace, gloves/hammer and barracks/rally horn. No external tier system or
plaque replaces them. Gold appears only where the old subject has gold; no decorative frame is added.

`pnpm icons:study` normalizes the proposals with the existing Facets normalizer and emits quality-90 WebP at 64/128/256
under `public/lab/rss-icons/relics/`. `--check` verifies exact sources and regenerated deliveries and rejects missing or
unwired masters, prompts or deliveries. These files are consumed only by the resource lab. Production masters,
deliveries, catalog and semantic mappings remain those of `7a0ee1cded3fe9a5f6618a55c3bd72dc9def318c`.

This review replaces the relic lab's three-way historical comparison with the requested two-way design-preserving
comparison. It adds 18 masters, 18 prompts and 54 deliveries, without a new route, renderer, player setting or gameplay
state. The owner's decision is pending; no proposal is presented as approved production art.
