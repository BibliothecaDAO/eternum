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

The ring and chip surfaces follow the current showcase style sheet, scoped to this lab so this branch remains on its
release-polish base. The ring holds the requested 40 px painting in a 44 px well, with a 52 px outer rim; the showcase
currently puts a 30 px painting in that well. Chips hold 20 px and 16 px paintings. Inventory screenshots extend the
viewport vertically to fit all 58 resources without scaling the icons; phone comparisons use 390×844.
