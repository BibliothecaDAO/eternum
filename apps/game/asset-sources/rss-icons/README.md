# Icon style sheet

This lab lets the owner choose category templates before the remaining resources are reskinned. Production artwork,
semantic mappings and icon sizes are unchanged. The previous per-icon A/B candidates are removed from this branch.

Nine resource templates cover 55 meanings: provisions, timber, rock and ore, metals, crystals, rare fragments, reagents,
people and troops, and relics. Donkey, LORDS and SAT retain their shipped marks, bringing the inventory to 58. Each
template records silhouette, framing, light, outline, value, palette slots, a 16 px detail budget and ring/chip fit. The
catalog assigns every resource once. Its 21 paintings are two or three samples per template, not a completed set.

The eight material/portrait anchors use shipped Facets artwork as style references. Their reskins use the category
anchor as the edit target, preserving framing, pose, light and large value shapes while changing hue, material and one
feature. Exact prompts accompany the masters. The three relic samples use one bolt, sword or shield shared between
tiers, with a separate consistent I/II mark. Compare 16/24/32/40 px; 40 px is recommended for the larger relic sheet, 32
px the proposed minimum. Old and Shipped retain their actual tier paintings.

**Other families** records template rules and shipped examples for structures/buildings, map landmarks and the liked UI
glyphs. These examples reuse production Icon, with no duplicated deliveries. Troop portrait samples are in **Templates →
People and troops**. Construction cards continue to use actual model thumbnails. Map ownership rims, shape cues and
value/level badges remain the existing production behavior.

## Review and proof

Open `/lab/kit/resource-icons`. Templates is the default; the category selector focuses one template. Inventory compares
the complete historical and shipped sets. Findings retains 17 confusion groups. Hide names, Greyscale and Silhouette
expose dependence on labels or colour. The four display sizes are actual pixels, not magnified previews.

From the repository root:

- `pnpm --dir apps/game dev --host 127.0.0.1 --port 4193 --strictPort`
- `pnpm icons:study`
- `pnpm icons:study --check`
- `pnpm icons:prove <new-evidence-root> https://127.0.0.1:4193 --resources`

The existing Facets normalizer fits transparent art to 880 of 1024 px, then delivers quality-90 WebP at 64/128/256. The
build verifies unique assignment, two or three samples per category, reviews and exact master/delivery hashes. It
rejects unwired masters, prompts or deliveries. The public manifest carries the review catalog for browser proof. The
browser proof drives the real controls on desktop and phone, checks exact old/shipped/proposal URLs, decodes every
displayed image, checks dimensions, tier marks and overflow, and captures each category.

## Historical set

`history.json` pins revision `b636c768616959a27e2ef45665e2c317fda9b40c`, before the full replacement in
`301ca1d55a2a95ac6899a445cc4ea33db7d15b88` on 15 October 2026. It records the source path, git blob, SHA-256 and
dimensions of each image. The archived ResourceIcon renderer determines the mapping: 56 numeric PNGs, the trade
thumbnail for Donkey, and an orange text glyph for SAT. LORDS remains the official SVG in the shipped column.

`scripts/icons/resource-history.mjs`, called by the build/check command, restores the 57 files byte for byte. The
archive requires the pinned commit in local git history and costs about 9.6 MiB of lab assets.

The change replaces 34 per-icon A/B candidates with 21 template samples. Its costs are the existing lab route, 21
masters and their three deliveries, prompts, catalog, reviews and proof steps. No production system is added.
