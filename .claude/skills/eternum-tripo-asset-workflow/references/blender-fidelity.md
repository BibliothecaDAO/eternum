# Preserve source fidelity and inspect the entire model

## Source lineage and material preservation

Keep temporary `raw-provider/` immutable during approval/baking, one compact editable source, and exports separate. Use
[retention](retention.md) at handoff; do not accumulate full-detail saves in the repository. Record the selected raw
file hash and its part-to-Blender-object mapping. Import the actual generated geometry; donors/proxies may provide rig,
scale or comparison only. Retain original coordinates and materials in a reference collection while assembling a working
copy.

Before editing, inventory mesh topology, vertex colours, UV layers, image dimensions, shader map roles, armatures and
shape keys. Confirm base colour is colour data and normal/roughness/metallic maps use the correct non-colour treatment.
Do not replace distinct PBR materials with one palette shader, bake over UVs, remove face features, or auto-project all
parts because the renderer loaded successfully. Geometry detail, normal-map detail and texture-painted detail are
separate; a painted buckle cannot substitute for a protruding buckle where the concept requires one.

Use local retopology, patching, sculpting or weight transfer where needed. Full remeshing/rebaking loses information:
preserve the source, justify it, and compare a small affected region first. Retopology should preserve shape and baked
surface detail. Increasing polygons through subdivision cannot reconstruct missing anatomy. Keep armour and equipment
separate when swaps require it; retain covered source surfaces and use explicit runtime visibility masks where valid.

## All-angle evidence, at three stages

Inspect actual raw Tripo output before model approval, the repaired Blender source, and the round-tripped final GLB. Use
the same orientation, fit scale, background, material lighting and camera presets. Capture:

- front, back, left, right, true top, bottom, elevated front and elevated rear;
- original materials and neutral clay for each;
- close-ups of face/scalp/neck, shoulders/underarms, wrists/grips, garment joins, saddle/girth/stirrups/reins and shield
  back for riders, or roofs/eaves/interiors/doors/props for buildings;
- range-of-motion extremes on affected joints, especially seams hidden in the rest pose.

The review helper `scripts/blender_review.py` creates evaluated snapshots in a temporary scene, reports topology and
renders these eight directions. Select the intended collection explicitly. Use a new output directory per revision;
retain its report with source/export hashes. See its docstring for invocation and axis parameters. It cannot detect all
self-intersections, judge a face or declare a design approved. Open the resulting images and record visible findings,
including a separate top/underside decision. Fit views of a whole army cannot replace single-model inspection.

Check boundary and non-manifold edges, loose/disconnected fragments, degenerate faces, reversed/inconsistent normals,
missing thickness, hidden interiors and garment/body poke-through. Inspect suspect geometry with face orientation,
backface culling and wireframe. A boundary at a deliberately open cuff or hair card can be correct; document intended
openings and examine what is visible through them. A watertight intersecting assembly can still be wrong. Do not close
all boundaries blindly or use double-sided shading to hide missing faces. Fix the identified defect, including visible
inside surfaces where needed, then recheck from top and bottom. Topology counts are findings, never a beauty score.

## Change discipline

For every meaningful edit, record target objects, purpose, protected anatomy/materials, before/after views, and a
recoverable file. Compare original concept → approved raw Tripo → current candidate at equal scale. Do not normalize
away a proportion change with per-image autosizing. Changes to one sleeve must not also reauthor face/hair/materials.
When an edit damages unrelated features, revert that edit instead of covering the damage with another object.

## Rig and runtime

Use the rigging reference for poses. Test continuous pose transitions, not just finite matrices or two endpoints.
Inspect pinching, separation, armour deformation, saddle contact and equipment clearance. Evaluate actual exported
weights/bind matrices/sockets in Three.js; Blender constraints do not transfer automatically.

The fidelity master has no inherited mobile polygon ceiling. An initial candidate may be heavy; measure it before
choosing retopology/LODs, texture compression, atlasing or instancing. Keep matched reference evidence; retain an
unreduced source only while it is needed locally for approval, baking or comparison. Compare each reduced export for
silhouette, face, material and seam loss at close and gameplay cameras. Reject visual regression even if file size or
triangle count improves. Avoid automatic material merging or dropping normals in every Low model: decide from observed
cost and appearance. Export a small representative asset before batching a family.

## Working-surface repair economics

Before microdetail repair, measure source density, deformation seams, UV/map roles and the real runtime cost. Keep
approved raw geometry immutable while in active use and keep selected full-detail comparison captures. If an
exact-topology patch chain repeatedly fails at one seam, diagnose the moving boundary and compare a rig-aware deform
surface with baked source detail. Preserve silhouette, readable raised geometry, materials, UV intent and local
contacts; exact vertex identity is not required for a derived working surface. Consolidate successful edits into a
reproducible recipe, with source/working/export hashes. A localized fault calls for a localized fix; a component
regeneration is a separate spend/design decision.

For an iterative repair, capture the failing region, relevant opposite/top/underside view and affected ROM poses at
locked framing. Reuse unrelated evidence only when its source, pose and rendering contract still match. Run the full
matched packet at a review milestone or when a change can affect the whole model. The review helper accepts `--framing`
(a saved JSON center and orthographic scale), `--views`, `--modes` and `--frame`; its default remains the complete
16-image packet. Inspect images and record findings; capture alone is not review.

When reduction opens scattered cracks, check coincident split vertices before repairing each hole. On a working copy, a
scale-aware weld can let neighbouring faces collapse together while retaining face-corner UVs. Compare materials and
clay, verify weights across moving joins, and keep deliberate openings separate. A successful Paladin experiment used a
1 micrometre weld; that tolerance is evidence for that source, not a universal setting.
