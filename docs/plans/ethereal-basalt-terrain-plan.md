# Ethereal basalt terrain

Accepted implementation, 15 September 2026. Branch: `codex/ethereal-basalt-terrain`.

## Visual and gameplay contract

The ethereal layer uses dark, regular basalt hexagonal slabs, with narrow joints, shallow relief and no slab emission.
The actual spire source is the size and material reference. Red, orange, gold, blue and pink light flows along the
larger gameplay hex borders. The fog state uses opaque charcoal mist with a faint soft basalt pattern; it never draws
hidden terrain, borders or buildings beneath a transparent cover.

Surface spires force this visual terrain on their own hex only. Authoritative biomes, movement costs and exploration
rules remain unchanged. Existing map creation already generates paired surface/ethereal spires and pre-explores them;
no contract or map-generation change is needed. `TileOccupier.Spire` selects the visual override, including after reload.

Both landmark sources and runtime exports lose their authored ground bases and ground veins. Their upper emissions,
portal motion and mine machinery remain. Occupied basalt tiles have a level 0.12 support surface across the full hex,
so mine posts, cart and ladders stay grounded through all six rotations. Model-local Y=0 meets that surface. The spire's
authored hovering motion remains intentional.

## Implementation

- Carry whole-layer and per-cell presentation through worldmap capture, request signatures, workers and prepared pages.
  Preserve those fields when authoritative content is captured at commit time. Include spires in terrain occupancy.
- Use the same terrain and height sampler in the lab and live scene. Replace the old lab-only flat Bare-biome shortcut.
- Skip world water, props and settlement substitutions on basalt cells. Unknown cells produce no basalt or neon mesh.
- Share reusable detailed basalt geometry near the camera and a cheaper distant representation. Keep deterministic
  layout, materials, height sampling and occupied support consistent. Avoid a mesh or draw call per slab.
- Draw inward half-border strips so each hex owns its side of a shared edge. Canonical edge coordinates give both sides
  matching colors and flow. Use local additive light diffusion compatible with WebGPU and WebGL2, without requiring
  screen-space bloom. Respect reduced motion, game-end freeze and the existing exploration reveal.
- Bound prepared-page cache retention by bytes as well as page count; a cell-count limit alone cannot bound terrain
  memory when geometry complexity changes.
- Refresh existing spire and structure placements when terrain pages complete. Move model matrices, labels and cosmetic
  attachments together without reloading models or changing authoritative state.
- Refit and export both editable landmarks through the existing Draco/KTX loader path. Keep rebuild instructions in
  [the ethereal asset source record](../../apps/game/public/models/ethereal/SOURCE.md).

## Evidence driving the geometry design

The original spire base had 61 clipped basalt columns, approximately 0.14 radius, with median height 0.0806. The first
procedural version matched the appearance but expanded every slab into per-page arrays. A measured 24×24 explored page
used 152.89 MiB and 1,005,217 triangles; sixteen pages would retain 2.389 GiB before GPU allocation. This is why the final
implementation uses shared geometry and distance detail rather than the plan's initial expanded page buffers.

The mine's baseless compressed export is 130,784 bytes, six primitives and 27,346 triangles; the spire is 564,268 bytes,
25 primitives and 11,712 triangles. Source checks verify all mine foundations and cart contacts at zero, all six rotated
footprints, structural connections and equipment clearance. Spire validation verifies unchanged upper transforms across
241 poses and the preserved eight-second animation. These source checks are separate from runtime visual acceptance.

## Acceptance

1. Explored, covered, frontier and reveal states use the same visibility rules as existing terrain; no hidden details
   leak and switching layers cannot reuse the wrong page presentation.
2. Clean basalt, subtle relief and five-color flowing borders read at gameplay and close zoom, including neighboring
   mines and spires. Surface spire overrides stop exactly at their own hex.
3. Mine contacts remain grounded in all rotations. Spire animation, portal composition and intentional levitation remain
   correct through a full cycle. Late terrain completion updates all existing placements.
4. WebGPU and forced WebGL2 compile and display the terrain, assets, fog and borders. Reduced motion and freeze stop
   movement. Density checks include a real production-size page and bounded cache/geometry ownership.
5. Focused terrain, presentation, structure and asset checks pass, followed by repository format, knip and applicable
   type/build checks. Capture actual runtime evidence and disclose any missing live-world prerequisite.

Current verification evidence and exact command results are retained in the task's ignored
`.context/ethereal-layer/biome-tiles` directory and summarized in the implementation handoff.
