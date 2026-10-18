# Resource icon study

All 34 paintings are proposals displayed by `/lab/kit/resource-icons`. The production semantic map is unchanged.
`catalog.json` records the confusion groups, lore and two options per changed resource. `verdicts.json` records the
visual comparison against the shipped art at 40, 20 and 16 px. A recommendation is not owner approval.

The material and troop masters use the correspondingly named shipped Facets master as their style reference. All relic
options use `../facets/masters/stamina-relic-2.png` as a material and lighting reference, with their own effect motif
specified in the prompt. Each prompt belongs to the same-named master; no master is a sheet crop.

From the repository root, `pnpm icons:study` delivers each transparent master through the existing Facets
`normalizeMaster` function and the same quality-90 WebP encoder at 64, 128 and 256 px. Output is confined to
`apps/game/public/lab/rss-icons`. `pnpm icons:study --check` regenerates the bytes in memory, verifies every delivery
and the source hashes, checks the reviews, and rejects sources or deliveries without a lab catalog entry.

`pnpm icons:prove <evidence-root> https://127.0.0.1:4193 --resources` drives the lab using the existing icon evidence
runner. Start the client first with `pnpm --dir apps/game dev --host 127.0.0.1 --port 4193 --strictPort`. The lab also
has name, greyscale and silhouette controls. No live game or login is needed.

The default **Old vs new** page compares every resource with the pre-Facets set, shipped art and any A/B proposals.
Inventory also offers **Old**, and the Materials, Troops and Relics comparisons include the old painting. All versions
use the same 40/20/16 px slots. Non-square originals are contained without distortion; their pixels and margins remain
unchanged.

`history.json` records the exact source path, git blob, SHA-256 and dimensions of each historical image. The source is
`b636c768616959a27e2ef45665e2c317fda9b40c`, immediately before the full replacement in
`301ca1d55a2a95ac6899a445cc4ea33db7d15b88` on 15 October 2026. The archived `ResourceIcon` renderer, rather than the old
remote `img` metadata, determines the resource-to-image mapping. It used numeric PNGs for 56 resources, the trade
thumbnail for Donkey, and an orange text glyph for SAT. The September menu-art change added resource pipeline notes but
did not replace these numeric paintings. The later official LORDS correction remains in the shipped column.

`scripts/icons/resource-history.mjs`, called by `pnpm icons:study`, restores the 57 original files byte for byte under
`public/lab/rss-icons/history`. Check mode compares them against the pinned git revision, verifies the catalog and
rejects unwired files. Rebuilding/checking the archive requires that commit in local git history. The archive costs
about 9.6 MiB in lab assets; it replaces no production asset and adds no production renderer. Every file is displayed in
the review. The browser proof checks the 58 historical rows, exact artwork URLs, decoded images, sizes and controls at
desktop and phone widths.

The ring and chip surfaces follow the showcase style sheet and remain scoped to this lab. The ring holds the requested
40 px painting in a 44 px well, with a 52 px outer rim; the showcase currently puts a 30 px painting in that well. Chips
hold 20 px and 16 px paintings. Inventory screenshots extend the viewport vertically to fit all 58 resources without
scaling the icons; phone comparisons use 390×844.
