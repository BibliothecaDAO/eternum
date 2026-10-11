# Runtime quality presets derived from an ideal model

## Stage boundary

Begin after the detailed Blender assembly, repairs and diagnostic rigging establish the intended appearance. Freeze the
visual reference, rig/attachment contract and matched reference captures. Record hashes and actual review status.
High-density meshes/maps are temporary baking and comparison inputs, governed by [retention](retention.md); retain a
compact editable runtime source at handoff. Provider quality is distinct from runtime presets.

When a task explicitly commissions only a source study, retain it temporarily for review and defer preset generation.
When integration is requested, perform this stage before final export acceptance and engine registration. It is part of
game suitability work, not an extra prerequisite for creating a detailed concept or master.

## Discover requirements

Inspect the active engine's preset configuration, real IDs and defaults, loader/compression support, material pipeline,
LOD selection and target hardware. Record code paths/revision and per-preset settings. Separate an asset quality tier
from distance LOD and renderer quality: these can combine differently. Do not assume existing review labels such as
High/Balanced/Low match actual engine presets. Where the engine defines no asset budgets, measure representative density
and propose explicit targets instead of inventing universal face counts, texture sizes or decimation ratios.

For troops, apply [the family count and allocation rule](troop-families.md): foot soldiers display 1–6, mounted units
1–3, with mounted-derived human scale shared across types. At the same preset/LOD, one complete foot soldier has
geometry allowance T and one complete rider/mount/equipment assembly 2T, so either full hex allows 6T. Record per-unit
and full-hex costs; measure other resources separately. The ideal master is outside this runtime allocation.

## Derive and measure

Create each preset from the same retained compact editable source (or the temporary detailed input while baking). Store
recipe, source/parent hash, export hash and engine-preset mapping. Avoid cascading one reduced tier into another, which
compounds loss. Shared intermediate retopology/bakes are acceptable when traceable to the ideal and every output is
still checked directly against it.

Choose optimizations from measured cost: region-aware retopology/reduction, preservation of joint loops and silhouette,
normal/detail baking, texture resolution/compression/mips, material/draw consolidation, instancing, LOD and supported
rig reduction. Preserve UV seams, material roles, equipment dimensions and functional sockets. Do not flatten PBR
materials or drop normal maps simply because a tier is named Low. Recheck maps and shading after baking or compression;
raw texture-file bytes do not measure decoded/GPU memory.

Record triangles/vertices, material/mesh/draw counts, joints/influences, texture dimensions/formats/residency estimates,
compressed transfer size and load time. Measure CPU/GPU/frame time where supported on a recorded device/backend and
representative scene density. Separate cold/warm loading as relevant. The multi-panel comparison's workload is not the
single-preset performance benchmark. Unknown device evidence remains unknown, not a pass.

## Controlled fidelity comparison

Keep matched reference images or the temporary local source visible beside the candidate. Synchronize framing,
camera/orbit/zoom, object transforms, world scale, viewport size, background, lighting, exposure/tone mapping, authored
palette, formation composition, animation pose/time and root position. Do not independently autosize each model: that
can hide proportion or bounding changes. Capture the same front/back/left/right/top/bottom/elevated cameras,
close/gameplay views and affected ROM extremes.

Provide two clearly labelled modes:

1. **Asset fidelity:** the same renderer settings for ideal and preset exports, to expose geometry/material/texture
   loss.
2. **In-game preset:** actual preset settings, including resolution, shadows and post-processing where applicable, to
   show the delivered experience. The ideal panel remains a labelled fixed reference; this mode is not an isolated
   measure of mesh loss.

Reference frames must match their recorded source. Identify them as renders and disable unsupported live pose
synchronization. Do not require a hosted full-detail export or substitute a reduced mesh labelled unreduced Ideal.

## Fidelity record and acceptance

Inspect every preset against the ideal, not just neighbouring quality levels. Record each visual dimension separately:

- silhouette, proportions and human/mount/prop scale;
- face/hair/readability and defining costume or building details;
- material identity, wood/leather/metal grain, roughness and normal detail;
- openings/interiors, joins, top/underside, attachment contact and authored palette;
- deformation, moving seams, socket alignment and distance-LOD transition stability.

Retain synchronized before/after captures, visible losses, benefit/cost, repair action, and
visual/structural/performance statuses. Optional pixel overlays, difference images or mesh-distance measurements locate
changes under identical conditions; they do not judge art quality. No universal image-similarity score approves a
preset. Do not demand pixel identity across different renderer settings.

Iterate to minimize visible deviation within each real budget. Lower presets may lose documented microdetail while
preserving identity, silhouette and functional geometry; missing surfaces, floating equipment or broken grips are
faults, not acceptable quality options. Escalate an unresolved budget/fidelity tradeoff with a concrete comparison and
recommendation. Do not solve it by changing the ideal reference.

A changed ideal gets a new version/hash and invalidates its dependent preset acceptance until affected recipes and
comparisons are refreshed. A preset-only repair preserves the ideal and unrelated tiers. Keep the original concept and
approved Tripo lineage and matched captures available to detect design drift; raw payload retention is bounded.

## Early feasibility before source polish

At first technical assembly, inventory complete-unit triangles, materials/draws, maps, joints, deformation cost,
loader/decoder support and representation switching. Establish semantic roots, contact frames and a manageable rig-aware
working surface before expensive microdetail patching. This feasibility pass does not reduce or approve the detailed
source. When visual acceptance of a current review-ready export is still pending, preserve it as an immutable technical
baseline and mark derivative fidelity provisional. Record user ideal acceptance separately. Experimental
triangle/texture envelopes in a plan are hypotheses, not enacted client limits.

Build each delivered representation from a traceable source and recipe. Keep renderer quality, asset representation,
distance LOD and gameplay tier distinct. Validate clip-free output in the actual procedural runtime. Use target-device
measurements for device claims; missing phone access is an outstanding production gate.
