# Ideal model and game-quality comparison

This stage follows Blender assembly/repair/diagnostic rigging and precedes final Eternum integration. Use this skill's
[quality-preset reference](quality-presets.md) for preset discovery, optimization and acceptance. This file defines the
Eternum review-page section and retained records; implement it with the next commissioned model review, using the
existing comparison site rather than another viewer.

## Required review section

Label the section **Runtime model & quality presets**. Compare current game-ready exports and selected matched reference
images. Each panel shows asset identity, version, preset ID/mapping, source hash, texture/triangle costs and validation
status. Do not label the highest reduced preset an unreduced Ideal. Concept/raw lineage can remain as labelled images
and metadata; full-detail meshes are temporary local references under [retention](retention.md).

Use synchronized orbit/zoom and named front/back/left/right/top/bottom/elevated views. Lock the same camera framing,
world scale, pose/time, equipment, authored palette and formation composition. Offer texture/clay inspection, pause/ROM
selection, close/gameplay views and saved comparison links. Preset selection must actually load the selected
export/maps; changing shadows alone cannot stand in for an asset tier. Conversely, label renderer-only presets honestly
when that is what the game defines. Count and composition should stay unchanged while switching quality.

Offer **Asset fidelity** mode with a common renderer setup and **In-game preset** mode with real engine settings.
Display which mode is active and the relevant settings. Save camera/preset/pose/palette/composition state so feedback
identifies an exact comparison. Share URLs restore exact asset/preset versions, camera, pose/time, placements, counts
and Paladin coat order. Dispose replaced GPU resources, pause inactive panels, load models/maps lazily and reuse
compatible geometry and textures. Measure texture residency, draws and frame time for the composition separately from
the multi-panel review page.

For troop comparisons, expose every count for the declared category: 1–6 foot soldiers or 1–3 mounted units. Keep human
scale and composition synchronized across ideal/preset panels. Show both complete-unit and full-hex triangle costs, the
T/2T allocation and the measured result. Include maximum-count formation/ROM clearance evidence; one isolated rider or a
shared mesh's stored triangle count is not the complete mounted-unit/full-hex workload. Paladin counts 1/2/3 show coat
A, A/B and A/B/C in stable slots; foot Knights and crossbowmen need no identity texture pool.

Show a per-preset review table with triangle/texture/memory/draw costs, measured runtime evidence, visible deviations,
remaining defects and acceptance status. Use `assets/quality-review.md` as the asset-record companion. Diff/overlay
inspection is useful for finding loss but must not become an automatic style score. Maintain original materials/scale
and all-angle evidence even when comparing cost improvements.

## Shareable game-instance comparison

Alongside the neutral art workshop, compose multiple troop formations and buildings with actual game assets, terrain,
lighting, camera, loader and renderer. Run existing Three.js procedural motion on real rigged exports. Do not substitute
Blender clips, static pose loops or mock terrain for this stage. Label unavailable gameplay integration honestly. The
share URL restores placements, counts, asset/preset versions, palette, coat order, camera and motion state. Keep this
responsive through lazy loading and geometry/texture reuse; record composed-scene draw, texture and frame costs.

## Review execution

1. Record reference hashes and selected matched captures after visual/ROM review; retain the compact editable runtime
   source and current delivery exports under [retention](retention.md).
2. Resolve engine presets and create independently traceable derivatives through
   [quality-preset optimization](quality-presets.md).
3. Load and round-trip exact runtime exports; compare with matched reference evidence under identical viewing
   conditions.
4. Inspect all angles, defining details, top/underside and test poses. Log visible losses and repair issues, not merely
   successful loading or numerical budget compliance.
5. Review the actual engine setting combinations and measure their representative-density costs independently.
6. Retain fidelity, structural, performance and user/delegated-review outcomes separately; publish when commissioned.

The current Blender review helper auto-fits one collection's views. Independently auto-fitted captures from different
quality versions are not a matched comparison: use the synchronized runtime section or an explicitly shared camera
rig/framing derived once from the ideal. A neutral render is not proof of actual game-preset behaviour.

## Revision and continuity

Every preset recipe cites the ideal hash, original concept and approved raw-source lineage. A preset-only request edits
that derivative/recipe, preserving the ideal. An approved change to the ideal creates a new baseline and marks dependent
presets stale until updated; do not display old green results against a new master. Persist the baseline, mapping,
comparison state and remaining defects in the asset record so a resumed task cannot silently normalize a degraded tier
as the new design target.

## Evidence reuse and selective checks

Save the camera center and orthographic scale from the detailed reference once, and pass the same framing to candidate
captures; independent auto-fit can conceal proportion changes. Record exact source/export hashes, tool version,
view/mode/pose options and comparison state in the asset brief. A geometry/weights edit invalidates affected ROM and
surface views; a texture edit invalidates material views and maps; a loader/runtime edit invalidates its round-trip or
procedural evidence. Use targeted checks during repair and the full all-angle packet at coherent visual milestones. No
stale or missing capture can be marked visually accepted.

A compact review report may index images and topology findings, but its status remains `human inspection pending` until
actual review. Keep the existing comparison route and separate the multi-panel fidelity viewer from a representative
single-preset performance benchmark.
