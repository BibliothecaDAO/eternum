# Eternum asset construction and delivery

Read this for realm, spire, reward, or terrain work. Paths below are relative to the repository root. Inspect the
current implementations and recent commits before exporting; these notes describe the approved direction, not permission
to redesign unrelated assets.

## Material and construction direction

- Stone quality comes from construction as well as texture: uneven courses, fine fractures, worn edges, and restrained
  surface relief. Avoid flat synthetic walls and randomly displaced geometry. Carry the same craftsmanship into roofs,
  with readable tile courses and slight variation.
- Realm progression increases precision and purity: settlement is modest and handmade, city is more substantial, kingdom
  has lighter worked stone, empire has pale refined stone with fine joints and subtle wear. Higher tiers should not
  become uniformly dirty or lose all surface detail.
- Raw essence is purple; refined essence is teal. Use the actual resource palette as the reference, including engraved
  channels and effects.
- Keep gameplay silhouettes and one-hex footprints legible beside neighboring assets. Review all tiers together at equal
  scale, then inspect the representative tier close up.

## Approved realm details

- Kingdom's exterior entrance is closed by the raised drawbridge itself, without a second door. Empire's ornate gates
  fill the whole entrance, including the arch; do not leave an uncovered gap above a rectangular gate.
- Settlement keeps the central approach clear. Barrels and crates sit beside it, not in the middle of the entrance.
- For villages, camps, and realms, ownership selects green or red: owned is green, everything else red. Preserve the
  order emblem on every ownership-colored cloth panel, including small hangings. Ship customization is a separate
  contract.
- Normalize each cloth panel's UVs before merging compatible static geometry, and preserve its customization metadata.
  One shared UV range over the entire merged object can make smaller emblems disappear or stretch.

## Spire and reward motion

- The spire has two separated, levitating obelisks around a purple energy sphere. Each obelisk ends in one tip at both
  ends. Teal channels are engraved in the middle of the inward-facing stone, not attached as strips outside the edges.
- Keep the base fixed. Only the obelisks rotate: slow start, acceleration through a complete turn, then a pause. The
  model holds its world orientation rather than facing the camera.
- Preserve the approved sphere and its small visible energy surges. Judge silhouette displacement at gameplay distance;
  a shader effect that exists but cannot be seen does not satisfy the visual brief.
- Spire and essence-rift placements have independent animation phases. Shared geometry and materials must not
  accidentally synchronize every instance.
- The chest body and lid use a 0.7 presentation scale. Its hex pedestal remains full size. Hovering gems retain their
  dimensions while their centers and orbit move inward and lower with the chest. Measure component bounds before and
  after export; scaling a shared parent changes more than the chest.

## Terrain experiments

The ethereal terrain direction favors fractured stone and flowing rifts. Judge biome repetition separately from the
purple rift lines: changing the lines alone will not fix repeated background texture. Inspect broad areas at gameplay
zoom, with variations that preserve continuous terrain and readable tiles. A terrain draft is not an approved production
replacement; retain its experimental status until validated.

## Existing pipeline

| Family  | Editable source                                                                                           | Optimization from repository root                |
| ------- | --------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| Realms  | `apps/game/scripts/settlements/build-{settlement,city,kingdom,empire}.py` and shared construction helpers | `pnpm --dir apps/game run optimize:realms`       |
| Spire   | `apps/game/scripts/spires/build-spire.py`                                                                 | `pnpm --dir apps/game run optimize:spire`        |
| Rewards | `apps/game/scripts/reward-tiles/build-reward-tiles.py`                                                    | `pnpm --dir apps/game run optimize:reward-tiles` |
| Fleet   | `apps/game/scripts/fleet/build-fleet.py` and `fleet-model.py`                                             | `pnpm --dir apps/game run optimize:fleet`        |

Inspect each builder's arguments and output paths before running it. Regenerate only the intended assets.
`stone_textures.py` supplies the shared stone bake; the construction helpers own realm material treatment and roof
detail. Extend those sources instead of duplicating the stone shader or editing only a binary export.

Realm and spire compression is centralized in `apps/game/scripts/optimize-structure-models.mjs`. The current structure
instancing path skips scaled child nodes. Draco preserves the baked transforms used here; Meshopt quantization can
introduce node scale. Rewards and ships use their own Meshopt-compatible paths. Verify this constraint against the
loader when changing the pipeline, rather than converting every GLB to the same codec.

Use fresh source exports for optimization. The verification command inspects already compressed assets without
recompressing them. Preserve texture resolution and normal detail when the existing settings already meet the target; do
not spend quality for a cosmetic byte reduction.

## Loading and verification

The dashboard's shared model prefetch contains the terrain prop catalog. Entity models belong to the selected mode and
visible scene. Inspect `play-asset-manifest.ts`, the mode-specific asset maps, and the visible-model preload plan
together. A building that cannot be constructed may still need to render: do not use buildability rules as a blanket
asset exclusion.

Blitz must not request spires or other unsupported Eternum assets. A lab import or asset in the public build directory
does not prove it downloads in a game. Conversely, a lab preview does not prove live placement, selection, or travel is
integrated.

For loading changes, inspect a cold production-preview dashboard in a fresh browser context. Wait for prefetch
completion, collect actual GLB requests, then check the relevant mode entry when available. Confirm the intended models
render after deferred loading. Report dashboard and live-world validation separately.

Run the relevant commands without rebuilding unrelated families:

```bash
pnpm --dir apps/game run verify:structures
pnpm --dir apps/game run verify:reward-tiles
pnpm --dir apps/game run verify:assets
```

Use `pnpm test [files]` from `apps/game` for focused behavioral regressions; the asset gate has its own configuration.
Before shipping, follow repository requirements for `pnpm run format`, `pnpm run knip`, and applicable type/build
checks. If a test pins an incidental design detail, assess its purpose rather than automatically updating an assertion
to match a new mesh.

Keep before/after measurements with the change: bytes by asset family, triangles, primitive/draw counts, texture formats
and dimensions, node transforms, cold-entry requests, and runtime screenshots. Compare runtime draw calls at
representative density; a GLB primitive count alone is not a full scene profile. Preserve animation, markings, and
material quality through compression, and disclose any remaining live-world validation gap.
