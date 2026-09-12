---
name: game-asset-workflow
description:
  Develop and optimize 3D game assets through reference-led concepts, modeling, in-engine polish, compression, and
  runtime loading. Use when creating or substantially redesigning game models or asset families, or optimizing their
  delivery; routine fixes and optimization of approved assets do not require restarting concept exploration.
---

# Game Asset Workflow

Establish the visual direction in images, prove one representative asset in the game, then expand the family. A
beautiful concept is a reference, not evidence of a production-ready model.

## Check prerequisites

Check only the capabilities needed for the requested stage before starting expensive work:

- For concepts, confirm access to the supplied references and an image-generation tool when new artwork is needed.
  Continue from an approved direction without regenerating it.
- For creation, locate editable sources, texture inputs, output paths, and the existing builder. Confirm a compatible
  Blender installation with its Python API, glTF export, and the required baking engine; a modeling connector is
  optional when the reproducible builder can run directly.
- For optimization, verify the project's package manager, installed geometry tools, texture encoder, and runtime decoder
  support. Record tool versions and inspect existing codec settings before replacing them.
- For validation, have a working client/lab, the real lighting and terrain, a browser with graphics support, and any
  account access needed for the requested live interactions. Keep preview artifacts separate from shipped outputs.
- Establish a clean view of the intended worktree and existing changes, plus the target mode, asset footprint, and
  performance baseline. Use the project's established budgets; do not invent a universal triangle or texture limit.

If a prerequisite is missing, identify the affected stage and use an available compatible path where possible. Missing
rendering or generation capability must not be presented as successful visual validation. Eternum setup commands and
known loader constraints are in [the project reference](references/eternum-assets.md).

## Establish the brief

Extract the user's references, gameplay camera, footprint, tier or class distinctions, customization, animation needs,
and target environment. Inspect existing assets and the real scene to establish scale and material quality. Carry
forward decisions already made; ask only for missing information that changes the work.

For Eternum work, read [the material, animation, and delivery reference](references/eternum-assets.md). For fleet work,
also read [the ship direction](references/eternum-ships.md). These capture the current visual contract; later user
decisions take precedence.

## Generate concepts

Use an available image-generation tool for concept artwork; apply its image-generation skill when available. Explicitly
identify reference images and the features to carry over. Save the useful images and prompts with the project's art
artifacts.

Show comparable views at equal scale, including the intended gameplay angle and enough close-up detail to explain
construction. Tier progression should change silhouette, proportions, material treatment, and visual hierarchy rather
than merely adding accessories. Do not hide weak readability behind cinematic lighting or excessive decoration.

When the user wants to choose the direction together, present a concrete concept sheet before committing to detailed
modeling. If the direction is already selected or selection is delegated, continue without requesting another approval.

## Build one representative asset

Use the selected concept as the visual target in Blender or the project's available modeling tools. Image-to-3D
generation may supply a starting mesh, but inspect and rebuild unsuitable topology, hidden surfaces, UVs, and materials.
Do not promise that generated imagery automatically becomes a clean asset.

Make construction convincing before adding surface noise. Worn stone needs readable joints, chipped edges, irregular
courses, and restrained roughness; changing its color alone will not fix synthetic geometry. Roofs need their own
construction detail. Keep these features large enough to read at gameplay zoom without drowning the silhouette in noise.

Separate geometry by animation and customization needs. Establish connected forms, pivots, scale, and
deformation-friendly topology before decorative detail. Keep editable sources and reproducible exports. Choose a
representative asset that proves the difficult forms and animation, rather than generating every variant immediately.

## Polish in the real scene

Render the actual exported model in the game's lab or scene using real terrain, lighting, and gameplay zoom. Compare
against the selected image and existing environment quality. Inspect silhouette, material contrast, joins, texture
resolution, and identification at a glance.

Treat a model as independently controlled parts: body, base, decorations, and effects. A body-scale adjustment must not
silently shrink the tile, pedestal, or ornament size. Place attachments in the intended coordinate space and verify
their size separately from their orbit or offset. Camera-facing behavior is an explicit design choice per part.

Check animation through complete cycles and its supported extremes: attachments, intersections, grounding, loop
continuity, and footprint while turning. Keep ownership and class markings legible while deforming. Validate resource
cost with representative on-screen density, not a single isolated beauty render.

## Expand the family

Once the representative asset meets the visual target in-engine, derive remaining tiers and classes using the
established design language. Share animation, material customization, and asset loading where the runtime supports it,
while retaining meaningful silhouettes.

## Optimize assets and loading

Inspect the project's existing export, compression, and loading pipeline and recent optimization commits before adding
another path. Record a baseline for delivered bytes, triangles, draw calls, materials, texture dimensions, and
cold-entry model requests. Optimize the measured cost while preserving the approved appearance.

- Inspect topology as well as file size: remove unused data, degenerate triangles, and genuinely hidden surfaces; weld
  duplicate vertices only where normals, UV seams, and deformation allow it. Merge compatible static parts where this
  reduces draw calls. Preserve animated pivots, morph targets, attachment names, customization metadata, decal UVs, and
  bounds. Reuse materials and textures where appropriate; retain independent animation phases for separate placements.
- Simplify geometry or add levels of detail only when the measured cost warrants it and the runtime supports them.
  Compare silhouette, shading, and animation after each reduction. Geometry compression reduces delivery size; it does
  not by itself reduce triangles or draw calls. Record those measures separately.
- Bake procedural materials into runtime-supported textures when needed. Apply the project's geometry compression and
  GPU texture compression, such as Draco or Meshopt and KTX2, using settings appropriate to color, normals, and masks.
  Preserve editable sources and reproducible export/optimization commands. Avoid repeatedly recompressing lossy textures
  or blindly decimating an already optimized asset.
- Verify codec output through the actual loader. Compression can alter transforms as well as buffers; check child
  transforms, hierarchy, and decoder support against the current loader rather than imposing one codec on every asset
  family.
- Audit cold entry and mode changes. Prefetch only assets useful to that entry point; load entity variants when the
  selected mode or visible scene needs them. Do not warm a union of every mode's model catalog. Confirm network requests
  in a fresh browser context, and ensure shared caches and disposal respect resource ownership.

Compare the compressed exports in the real scene at gameplay zoom and close range, through full animation cycles and
representative object density. Check silhouettes, stone/roof detail, markings, normal maps, seams, and missing parts.
Record before/after bytes and draw calls; distinguish static asset counts from measured frame performance.
Software-rendered previews can verify appearance, but cannot establish target-device GPU performance. Do not call a
lossy codec lossless; report the visual comparison and settings instead.

Prefer tests for durable behavior: bounds, supported transforms/codecs, attachment continuity, metadata, and
mode-specific requests. Do not add tests that freeze incidental vertex counts, stone colors, or the current
implementation of an approved cosmetic tweak. Use visual comparison for aesthetic decisions; run the required repository
checks and relevant existing asset gates.

## Make the asset ready to ship

Treat readiness as a concrete gate for the requested integration:

- The final compressed export matches the approved concept and in-game refinements at the gameplay camera. Compare the
  delivered asset, not only the editable source or an earlier preview.
- Editable sources, texture inputs, and reproducible export/optimization commands are retained in the project's intended
  locations. The committed asset is the one that was verified.
- The intended runtime loader, materials, customization, animations, bounds, and resource disposal work together. For a
  live-game asset, verify placement, selection, labels, and relevant interactions in its supported modes; a lab preview
  alone establishes only lab readiness.
- Asset cost and cold-load behavior meet the measured target without visible regression. Report before/after bytes and
  draws, actual requests, and any target-device performance limitations.
- Required checks pass, and the change is reviewable with runtime captures and clear evidence, fix, verification, and
  non-goals. State any unverified integration explicitly rather than calling the asset fully shipped.

Commit and publish within the user's existing authorization. In the handoff, distinguish concept images, source renders,
and actual in-game captures, and identify whether the result is a preview, an integrated asset, or an opened release
change. Preserve the user's chosen scope; a request for a concept does not authorize shipping.
