# Eternum S2 Worldmap Movement Visual Refresh PRD

Date: 2026-03-14
Status: Proposed
Scope: `client/apps/game/src/three` worldmap movement-selection visuals, action-highlight data shaping, scene-owned highlight/hover/pulse managers, selected tests

## Implementation Tracking

- [x] Phase 0: Audit Lock and Test Harness
- [x] Phase 1: Highlight Metadata Expansion
- [x] Phase 2: Layered Highlight Rendering
- [x] Phase 3: Selection and Hover Harmonization
- [ ] Phase 4: Camera-Distance Tuning and Scene Parity
- [ ] Phase 5: Cleanup, Diagnostics, and Ship Guardrails

## 1. Objective

Improve the visual appearance of army movement and exploration feedback on the worldmap without changing movement rules,
action availability, or renderer compatibility.

This PRD covers:

- reachable movement field visuals for selected armies,
- frontier exploration visuals for adjacent unexplored hexes,
- selected-army pulse treatment,
- hover treatment on actionable hexes,
- test-first rollout for the new visual stack,
- WebGPU-safe implementation constraints for all new materials.

This PRD does not cover the separate gameplay FX pipeline used for persistent `compass`, `travel`, and reward FX. That
work is already tracked by `docs/prd/eternum-s2/eternum-s2-webgpu-fx-compat-prd-2026-03-14.md`.

## 2. Problem Statement

The current movement-selection visuals are functional but visually weak.

Today, when a player selects an army:

1. action paths are computed correctly,
2. reachable and frontier hexes are deduped into a flat highlight set,
3. those hexes are rendered as simple translucent fills,
4. the selected army receives a separate pulse,
5. hover feedback is handled by a generic overlay manager.

The result is readable, but it lacks hierarchy and material richness:

- reachable movement cells and destination cells do not have enough visual separation,
- exploration frontier cells rely mostly on a single blue fill color,
- the selected-army pulse competes with the action field instead of anchoring it,
- hover, pulse, and highlight layers feel like adjacent systems rather than one intentional visual language,
- the current rendering stack is visually flat because it is mostly `MeshBasicMaterial` fills with light opacity
  modulation.

This is especially noticeable after the WebGPU portability work, because the old shader paths were replaced with safer
stock-material implementations and no new visual language replaced them.

## 3. Confirmed Current-State Findings

### 3.1 Movement logic is not the problem

The action graph is already correct.

- `ArmyActionManager.findActionPaths()` classifies explored reachable cells as `ActionType.Move`.
- It classifies adjacent unexplored cells as `ActionType.Explore`.
- It stops traversal through unexplored, occupied, chest, or structure cells as intended.

This means the redesign should not alter pathfinding or action semantics.

Primary references:

- `packages/core/src/managers/army-action-manager.ts`
- `packages/core/src/utils/action-paths.ts`

### 3.2 The current highlight output is too lossy for a richer design

`ActionPaths.getHighlightedHexes()` flattens each path, drops the origin, dedupes by hex key, and returns only:

- `hex`
- `actionType`

That is enough for a flat color fill, but not enough for a richer visual treatment.

Specifically, the renderer cannot currently distinguish:

- route cell vs destination cell,
- frontier destination vs intermediate shared route,
- unique endpoint vs shared path segment,
- nearest frontier vs distant path terminal.

That missing metadata is the main design constraint for a better-looking result.

### 3.3 The current movement field renderer is visually simple

`HighlightHexManager` currently:

- renders one instanced rounded hex mesh,
- uses `MeshBasicMaterial`,
- colors by action type,
- animates scale-on entry,
- applies one shared opacity pulse,
- adds one launch glow on the first highlight only.

This is performant and portable, but visually limited.

### 3.4 Selection and hover are separate systems with overlapping visual roles

The worldmap currently layers:

- highlight field via `HighlightHexManager`,
- army/structure pulse via `SelectionPulseManager`,
- hover fill/outline via `HoverHexManager`.

Each manager is internally coherent, but the three do not share a clear visual hierarchy or palette contract.

### 3.5 WebGPU constraints remain important

The movement-selection field itself is no longer a custom shader path, which is good. However:

- new visuals must remain compatible with `three/webgpu`,
- the design should avoid raw `ShaderMaterial`,
- the design should prefer stock materials or a tightly isolated TSL path only if stock materials prove inadequate.

### 3.6 Persistent exploration FX is a separate gap

`WorldmapScene` currently suppresses explore movement FX in native WebGPU. That means some exploration feedback is
already missing in that backend, but fixing that belongs to the FX compatibility PRD, not this visual-refresh PRD.

## 4. Goals

1. Make reachable movement cells, exploration frontier cells, and the selected origin clearly distinct at a glance.
2. Preserve current gameplay semantics and action availability.
3. Preserve WebGPU compatibility and avoid reintroducing unsupported shader techniques.
4. Keep the runtime cost in the same performance class as the current instanced approach.
5. Land the redesign through TDD with explicit red/green slices for data shaping, rendering, cleanup, and scene
   integration.

## 5. Non-Goals

- Changing movement, exploration, stamina, or occupancy rules.
- Reworking army pathfinding.
- Solving the separate WebGPU black-screen FX issue.
- Replacing the label stack.
- Redesigning unrelated worldmap terrain or structure materials.
- Introducing backend-specific visual branches for WebGPU vs legacy WebGL, except where absolutely required by material
  support.

## 6. Design Principles

### 6.1 Preserve gameplay meaning

The new visuals must make existing rules easier to read, not reinterpret them.

### 6.2 Build hierarchy, not noise

The design should create a visual hierarchy:

1. selected origin,
2. route field,
3. terminal destinations,
4. frontier exploration cells,
5. hover emphasis.

It should not increase saturation or animation everywhere equally.

### 6.3 Keep the renderer path pragmatic

The first pass should stay backend-neutral and portable:

- instancing where practical,
- stock materials where sufficient,
- one isolated material factory if more control is required.

Direct WGSL or ad hoc custom shader work is not the first move.

### 6.4 Separate data shaping from rendering

The renderer should consume richer highlight descriptors instead of inferring meaning from raw action paths inline.

### 6.5 Selection systems should look related

Highlight field, hover, and selection pulse should share one palette and intensity model so the scene reads as a single
designed interaction state.

## 7. Proposed Visual Direction

## 7.1 Movement Field

Reachable explored movement cells should become a lower-intensity route field:

- softer fill than today,
- visible edge or rim treatment,
- lower pulse amplitude,
- clear but subordinate to frontier exploration cells.

Intended read: "this is traversable space."

## 7.2 Exploration Frontier

Exploration cells should become the strongest action terminals in the field:

- brighter cyan-blue edge treatment,
- more energetic pulse or shimmer than route cells,
- optional endpoint accent ring or beacon treatment,
- stronger destination emphasis than ordinary move endpoints.

Intended read: "this is the unexplored frontier you can reveal."

## 7.3 Route Endpoints

Destination cells for move/help/attack/chest actions should receive endpoint emphasis distinct from shared route cells.

That emphasis may be expressed as:

- a second smaller inset shape,
- a brighter rim-only overlay,
- a destination marker ring,
- or a stronger opacity/brightness curve than mid-route cells.

The core requirement is that endpoint cells must stop looking identical to all path segments.

## 7.4 Selected Origin

The selected army pulse should anchor the field rather than overpower it.

Direction:

- make it ring-dominant rather than fill-dominant,
- keep it clearly visible under units,
- harmonize its palette with move/explore colors,
- preserve structure-specific pulse differentiation where needed.

## 7.5 Hover

Hover should become contextual:

- when no army is selected, hover remains generic,
- when an army is selected and the hovered hex is actionable, hover should amplify the existing action style rather than
  introducing an unrelated fill,
- outline-only or edge-weighted hover is preferred over a heavy extra fill.

## 8. Proposed Technical Design

### 8.1 Introduce richer highlight descriptors

Add a pure resolver layer that converts `ActionPaths` into render-oriented descriptors.

Proposed shape:

```ts
type ActionHighlightKind =
  | "route"
  | "destination"
  | "frontier"
  | "support"
  | "attack"
  | "chest"
  | "create-army";

interface ActionHighlightDescriptor {
  hex: { col: number; row: number };
  actionType: ActionType;
  kind: ActionHighlightKind;
  isEndpoint: boolean;
  isSharedRoute: boolean;
  pathDepth: number;
}
```

This data should be produced by a pure helper close to `ActionPaths`, not by ad hoc scene logic.

### 8.2 Split rendering into semantic layers

Replace the one-layer movement highlight field with layered render groups.

Recommended first-pass layers:

1. base route layer
2. endpoint accent layer
3. frontier emphasis layer
4. optional launch glow / entry burst layer

Each layer may still use instancing, but they should not all share identical opacity and scale behavior.

### 8.3 Keep stock-material compatibility in the first pass

Preferred first-pass material strategy:

- `MeshBasicMaterial` or `MeshStandardMaterial` with transparent instanced geometry,
- separate materials per layer,
- additive or tone-mapped accent layer only where required,
- no raw `ShaderMaterial`.

If the frontier look cannot be achieved adequately with stock materials, isolate the effect behind one material factory
that is explicitly categorized as WebGPU-safe.

### 8.4 Add a shared palette contract

Create a single palette resolver for:

- move route,
- move endpoint,
- explore frontier,
- attack/help/chest/create-army,
- army selection pulse,
- hover emphasis.

This prevents color drift between `HighlightHexManager`, `SelectionPulseManager`, and `HoverHexManager`.

### 8.5 Narrow worldmap changes to orchestration

`WorldmapScene` should keep doing:

- compute action paths,
- publish state,
- send descriptors to the highlight manager,
- show selection pulse,
- coordinate hover state.

It should not own detailed palette or layer-shaping logic.

## 9. Product Requirements

### R1. Movement visuals must preserve semantic correctness

- Explored traversable cells remain visually distinct from unexplored frontier cells.
- Occupied or blocked cells must not appear traversable.
- Action availability must be unchanged.

Acceptance:

- Existing action-path behavior remains intact.
- Visual redesign does not change which clicks are legal.

### R2. Destination cells must be visually distinguishable from route cells

The current flattening is not sufficient. The new renderer must be able to visually call out endpoints.

Acceptance:

- At least one destination-specific treatment exists for reachable terminals.
- Shared route cells remain visually quieter than endpoints.

### R3. Frontier exploration must be the strongest movement affordance

Blue frontier exploration cells should feel intentionally different from general move space.

Acceptance:

- Frontier exploration cells have their own layer or endpoint treatment.
- They remain readable at close, medium, and far worldmap camera distances.

### R4. Selection pulse, hover, and highlight field must share one visual language

Acceptance:

- Shared palette contract exists.
- Hover does not look like a fourth unrelated system.
- Selection pulse supports the action field instead of competing with it.

### R5. New rendering must remain WebGPU-safe

Acceptance:

- No raw `ShaderMaterial` is introduced by this project unless explicitly isolated and tested as WebGPU-safe.
- New highlight materials are scene-owned and disposed correctly.
- The implementation runs under `legacy-webgl`, `webgl2-fallback`, and `webgpu`.

### R6. Performance must remain bounded

Acceptance:

- Highlight rendering remains instanced or equivalently bounded.
- The redesign does not allocate one mesh per highlight cell.
- Highlight creation and teardown stay in the same performance class as the current system.

## 10. TDD Delivery Plan

## Phase 0: Audit Lock and Test Harness

Purpose:

- freeze the current behavior contract,
- create pure test seams before any rendering changes,
- ensure the redesign starts from failing tests instead of exploratory implementation.

Tests first:

- add failing tests for a new highlight-descriptor resolver,
- add failing tests asserting current action-path semantics are preserved,
- add failing tests for scene-owned material isolation and disposal in the new highlight stack,
- add failing tests that document WebGPU-safe material usage expectations for the redesigned managers.

Deliverables:

- descriptor test harness,
- palette contract test harness,
- highlight manager lifecycle test harness.

## Phase 1: Highlight Metadata Expansion

Purpose:

- produce the richer semantic data the renderer needs.

Implementation:

- add a pure helper such as `action-highlight-descriptors.ts`,
- derive endpoint, frontier, shared-route, and depth metadata from `ActionPaths`,
- keep `ActionPaths.getPaths()` behavior unchanged.

Tests first:

- destination cell is marked `isEndpoint = true`,
- intermediate route cell is not marked as endpoint,
- frontier exploration cell is classified as `frontier`,
- shared route segments are marked `isSharedRoute = true`,
- dedupe still occurs by hex key without losing endpoint/frontier meaning.

Acceptance:

- no rendering changes yet,
- new descriptor output is correct and deterministic.

## Phase 2: Layered Highlight Rendering

Purpose:

- replace the current one-layer flat fill with a layered field.

Implementation:

- refactor `HighlightHexManager` to accept descriptors instead of plain action paths,
- introduce multiple render layers with their own materials and counts,
- keep instancing and scene ownership,
- preserve existing entry animation only where it still helps the new look.

Tests first:

- route and frontier descriptors populate different render buckets,
- clearing highlights disposes or hides all layers correctly,
- repeated highlight updates do not leak scene objects,
- manager instances keep material state isolated from each other,
- no path uses `ShaderMaterial` in the first-pass implementation.

Acceptance:

- movement field visually separates route, endpoint, and frontier roles,
- lifecycle remains clean.

## Phase 3: Selection and Hover Harmonization

Purpose:

- align pulse and hover with the new field.

Implementation:

- add a shared palette resolver used by `HighlightHexManager`, `SelectionPulseManager`, and `HoverHexManager`,
- tune selected-army pulse toward a ring-led treatment,
- switch actionable hover to use contextual emphasis rather than an unrelated full fill where appropriate.

Tests first:

- army selection applies the shared army palette,
- structure selection still keeps structure-specific differentiation,
- hover state updates do not reintroduce stale fill after deselection,
- fast-travel-specific outline-only hover behavior remains intact.

Acceptance:

- movement selection reads as one coherent interaction system.

## Phase 4: Camera-Distance Tuning and Scene Parity

Purpose:

- make the new visuals readable across camera states and backend modes.

Implementation:

- tune opacity, scale, render order, and y offsets by view distance where necessary,
- verify the field remains legible without overwhelming the terrain,
- confirm parity across worldmap scene modes.

Tests first:

- add unit tests for any distance-based resolver introduced,
- add scene-level tests covering selection clear, reselection, and chunk refresh interactions,
- add regression tests ensuring the highlight manager still tolerates empty and large highlight sets.

Acceptance:

- visuals remain readable at close, medium, and far zoom,
- no stale highlight artifacts survive selection changes or chunk refreshes.

## Phase 5: Cleanup, Diagnostics, and Ship Guardrails

Purpose:

- finalize ownership, diagnostics, and rollout confidence.

Implementation:

- remove obsolete highlight constants and dead visual branches,
- add lightweight diagnostics for active highlight buckets if needed,
- document the final palette and layering contract.

Tests first:

- add regression tests for disposal and scene re-init,
- add inventory tests proving no disallowed shader path was reintroduced,
- add snapshot-like structural tests for layer counts where useful.

Acceptance:

- final system is maintainable, scene-owned, and guarded against visual-regression backsliding.

## 11. Recommended File Plan

Expected primary touch points:

- `packages/core/src/utils/action-paths.ts`
- `packages/core/src/utils/` new highlight-descriptor helper
- `client/apps/game/src/three/managers/highlight-hex-manager.ts`
- `client/apps/game/src/three/managers/selection-pulse-manager.ts`
- `client/apps/game/src/three/managers/hover-hex-manager.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/hexagon-scene.ts`
- selected tests under `client/apps/game/src/three/managers` and `client/apps/game/src/three/scenes`

## 12. Risks

### 12.1 Data-shape risk

If descriptor shaping is under-specified, the renderer will not be able to distinguish route from endpoint cleanly.

Mitigation:

- land descriptor tests before any material work.

### 12.2 Visual overdesign risk

Too many layers, too much bloom, or too much additive blending will make the field noisy.

Mitigation:

- keep hierarchy explicit,
- prefer quieter route layers and stronger frontier terminals.

### 12.3 Performance regression risk

Multiple per-hex meshes or per-frame allocations could regress large movement fields.

Mitigation:

- preserve instancing,
- keep descriptors pure and reusable,
- test manager cleanup and update behavior directly.

### 12.4 WebGPU compatibility risk

A visually attractive but unsupported material path would undo the portability work.

Mitigation:

- first pass uses stock materials,
- any non-stock material must be isolated and explicitly tested.

## 13. Open Design Questions

1. Should move endpoints receive the same endpoint treatment as attack/help/chest endpoints, or should only frontier
   exploration get a strong terminal accent?
2. Do we want the selected-army origin pulse to keep any filled surface, or should it become ring-only?
3. Should hover on actionable hexes brighten the existing action layer, or should it add a separate thin outline layer?
4. Is one shared palette sufficient, or do army- and structure-selection pulses still need separate palette families?
5. If stock materials are visually insufficient for frontier shimmer, do we accept a small isolated TSL material in
   this PRD or defer that to a follow-up?

## 14. Definition of Done

This project is done when:

- movement route cells, endpoints, and frontier exploration cells are visually distinct,
- army selection, hover, and highlight visuals feel like one system,
- no gameplay semantics changed,
- the implementation remains WebGPU-safe,
- and the full redesign landed through failing tests first, then minimal implementation, then cleanup.
