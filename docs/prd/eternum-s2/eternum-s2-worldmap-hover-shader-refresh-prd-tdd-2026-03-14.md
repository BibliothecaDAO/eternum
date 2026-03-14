# Eternum S2 Worldmap Hover Shader Refresh PRD

Date: 2026-03-14
Status: Proposed
Scope: `client/apps/game/src/three` worldmap hover hex visuals, isolated hover shader/TSL material, hover manager lifecycle, selected scene wiring and tests

## Implementation Tracking

- [x] Phase 0: Audit Lock and Hover Harness
- [x] Phase 1: Hover Shader Contract and Material Factory
- [x] Phase 2: Hover Manager Integration and Lifecycle
- [x] Phase 3: Worldmap Contextual Wiring and Fast-Travel Parity
- [x] Phase 4: Camera Tuning, Diagnostics, and Ship Guardrails

## 1. Objective

Replace the current flat worldmap hover fill with a more intentional, animated hover treatment built as one isolated
shader/TSL path.

The new hover should read like an arcane survey scan:

- edge-weighted instead of slab-filled,
- animated without becoming noisy,
- readable over mixed terrain and structures,
- compatible with the current worldmap interaction stack,
- and isolated enough that it does not reopen general renderer-portability risk.

This PRD covers:

- base worldmap hover visuals when the player moves over a hex,
- contextual hover styling when the hovered hex is actionable,
- the hover material factory and manager ownership model,
- WebGPU-safe shader isolation,
- and TDD rollout for the hover stack.

This PRD does not cover:

- movement field highlights,
- selection pulse ownership pulses,
- persistent travel/compass/reward FX,
- or fast-travel path rendering beyond preserving its outline-only hover policy.

## 2. Problem Statement

The current hover hex is still visually treated as a flat plane.

Today the hover stack is:

1. a translucent `MeshBasicMaterial` fill,
2. an outline model layered above it,
3. pulse by opacity and color only.

That keeps the behavior functional, but the main fill reads like a literal painted tile rather than an intentional hover
effect. In practice:

- the center fill overwhelms terrain detail,
- the cyan slab competes with selection and action highlights,
- the effect does not feel materially distinct from other flat overlays,
- and the animated state is too close to “tinted plane + outline”.

The screenshot review for this work confirms the read: the hovered shrubland tile is perceptible, but it looks like a
blue polygon sheet placed on the map rather than a premium interaction effect.

## 3. Confirmed Current-State Findings

### 3.1 Hover currently relies on stock-material fill + model outline

`HoverHexManager` currently:

- creates a hex `ShapeGeometry` fill mesh,
- uses one `MeshBasicMaterial`,
- loads `/models/outline_pink_small.glb`,
- toggles between `fill` and `outline` visual modes,
- pulses by color interpolation and opacity only.

That is coherent, but materially flat.

### 3.2 The right abstraction seam already exists

Hover rendering is already isolated behind:

- `HoverHexManager`,
- `InteractiveHexManager`,
- and worldmap scene-level palette/mode decisions.

That means the shader work can be confined to the hover manager and a small material factory instead of leaking into the
whole scene.

### 3.3 Fast travel already needs outline-only hover

`FastTravelScene` explicitly switches the shared hover manager to outline mode. That behavior must remain intact.

### 3.4 WebGPU safety still matters

Recent renderer work deliberately retired broad custom shader usage in the worldmap. Reintroducing ad hoc
`ShaderMaterial` broadly would be a regression.

However, this hover treatment is a good candidate for a single isolated shader/TSL path because:

- it is visually self-contained,
- it has a small input surface,
- it is easy to inventory and test,
- and it can be kept out of the movement/highlight managers.

## 4. Goals

1. Make base worldmap hover feel premium rather than planar.
2. Preserve current interaction semantics and hover targets.
3. Keep fast-travel outline-only behavior intact.
4. Isolate the shader/TSL implementation to one manager/material factory.
5. Keep the new path testable, disposable, and renderer-safe.

## 5. Non-Goals

- Reworking movement highlight rendering again.
- Replacing the current action-palette contract.
- Introducing a general-purpose shader framework for all overlays.
- Converting unrelated Three managers to TSL.
- Redesigning fast-travel hover away from outline-only.

## 6. Design Direction

## 6.1 Visual Language

The hover should become an edge-biased scan rather than a filled slab.

Recommended look:

- bright outer rim,
- thinner inner contour,
- moving diagonal scan band,
- lightly broken-up interior energy,
- minimal center opacity so terrain still reads through.

This should feel like “arcane survey” rather than “neon carpet”.

## 6.2 Composition

The hover effect should be built from these visual components:

1. outer border energy,
2. inner contour ring,
3. one traveling scan band,
4. subtle noise/dither breakup in the center,
5. optional corner-tip accent at the six vertices.

The center should remain mostly transparent. The important read is the perimeter and the scan motion.

## 6.3 Behavioral Rules

- Generic worldmap hover remains available when no entity is selected.
- Contextual actionable hover still uses the shared worldmap palette contract.
- Fast travel stays outline-only and must not instantiate the hover shader fill.
- Deselection must restore the generic hover state cleanly.

## 7. Proposed Technical Design

## 7.1 Add an isolated hover material factory

Create a dedicated hover material factory, for example:

- `client/apps/game/src/three/shaders/hover-hex-material.ts`

Responsibilities:

- create one isolated hover material,
- own the shader/TSL node graph or shader source,
- expose a small uniform/control surface,
- document WebGPU compatibility expectations.

Preferred first choice:

- TSL / WebGPU-safe node material path.

Allowed fallback:

- one isolated `ShaderMaterial` if TSL proves insufficient,
- but only if explicitly inventoried and tested as the single allowed hover shader path.

## 7.2 Drive the effect in hex-local space

The shader should operate in a local coordinate space aligned to the hex.

Core signals:

- signed-distance or radialized hex edge mask,
- line mask for outer and inner borders,
- animated scan line based on time and local coordinates,
- low-amplitude noise for alpha breakup.

This keeps the hover crisp and consistent regardless of terrain texture below it.

## 7.3 Keep the manager contract narrow

`HoverHexManager` should continue to own:

- the hover mesh,
- hover material lifecycle,
- hover visibility,
- palette/intensity application,
- outline attachment behavior where required.

`WorldmapScene` should continue to own:

- contextual mode selection,
- deciding generic vs actionable hover,
- feeding palette choices,
- and coordinating hover with selection state.

## 7.4 Preserve outline-only mode as a first-class path

The new hover shader should be disabled entirely when outline-only mode is active.

That means:

- no hidden fill mesh left visible,
- no unnecessary shader material animation while in outline-only mode,
- and no changes to fast-travel’s current outline-only expectation.

## 7.5 Add explicit runtime controls

The hover shader should expose a compact parameter surface such as:

- `time`,
- `baseColor`,
- `accentColor`,
- `intensity`,
- `scanSpeed`,
- `scanWidth`,
- `borderThickness`,
- `innerRingThickness`,
- `centerAlpha`.

Do not expose a large debug surface initially. Keep it small and intentional.

## 8. Product Requirements

### R1. Base hover must no longer read as a flat filled tile

Acceptance:

- the hover center is mostly transparent,
- the main emphasis comes from border/scan treatment,
- terrain remains visible through the effect.

### R2. Contextual actionable hover must still follow the shared worldmap palette

Acceptance:

- generic hover uses the generic palette,
- actionable hover uses action-tied colors,
- palette drift between hover and highlight systems is avoided.

### R3. Fast-travel outline-only mode must be preserved

Acceptance:

- fast travel still uses outline-only hover,
- the fill shader path is not active there,
- existing fast-travel hover tests remain valid or are extended.

### R4. Shader work must remain isolated

Acceptance:

- a single hover material factory owns the shader/TSL path,
- no shader logic is embedded directly inside `WorldmapScene`,
- the material is disposed with the hover manager.

### R5. The new path must remain renderer-safe

Acceptance:

- TSL is preferred for portability,
- if raw `ShaderMaterial` is used, it is the single allowed hover exception,
- the path is explicitly covered by tests/inventory.

## 9. TDD Delivery Plan

## Phase 0: Audit Lock and Hover Harness

Purpose:

- lock down the current hover manager lifecycle and scene role,
- establish the test seam before material work begins.

Tests first:

- add failing tests for the hover material factory interface,
- add failing tests documenting outline-only mode preservation,
- add failing tests for hover material ownership/disposal,
- add failing tests for shared palette application through the hover manager.

Deliverables:

- hover material factory harness,
- hover manager lifecycle harness,
- fast-travel hover contract harness.

## Phase 1: Hover Shader Contract and Material Factory

Purpose:

- land the isolated shader/TSL path independently of scene wiring.

Implementation:

- add `hover-hex-material.ts`,
- implement outer rim, inner contour, scan band, and center alpha breakup,
- expose a minimal uniform/node control surface,
- add any shader inventory registration needed for guardrails.

Tests first:

- material factory returns the expected material kind,
- material exposes the expected configurable inputs,
- no extra shader path is introduced outside the isolated factory,
- factory output is per-manager owned rather than globally mutated.

Acceptance:

- a single isolated shader/TSL hover material exists,
- no scene wiring changes yet beyond local harness use.

## Phase 2: Hover Manager Integration and Lifecycle

Purpose:

- replace the flat hover fill with the new material in the manager.

Implementation:

- update `HoverHexManager` to use the new material factory,
- keep outline loading/attachment behavior intact,
- update animation timing to drive the shader time input,
- ensure hide/show/dispose properly handle the new material.

Tests first:

- showing hover attaches the shader-backed mesh cleanly,
- hiding hover does not leave stale fill visible,
- dispose releases the material and geometry,
- outline-only mode bypasses the fill path.

Acceptance:

- the manager owns and cleans up the new hover material correctly.

## Phase 3: Worldmap Contextual Wiring and Fast-Travel Parity

Purpose:

- reconnect the new hover effect to gameplay context without breaking fast travel.

Implementation:

- wire worldmap generic/actionable hover through the new hover material,
- keep the shared palette contract intact,
- preserve fast-travel outline-only mode explicitly.

Tests first:

- actionable hover still uses contextual palette input,
- deselection restores generic hover cleanly,
- fast-travel hover remains outline-only,
- no stale actionable fill survives scene mode changes.

Acceptance:

- worldmap hover feels integrated with selection/highlight state,
- fast travel still behaves as before.

## Phase 4: Camera Tuning, Diagnostics, and Ship Guardrails

Purpose:

- make the hover readable across views and defend against regression.

Implementation:

- tune border thickness, center alpha, and scan amplitude by camera view if needed,
- add lightweight diagnostics for hover mode/material state,
- add or extend shader inventory/guard tests.

Tests first:

- add unit tests for any camera-view hover tuning policy,
- add regression tests for repeated hover show/hide cycles,
- add inventory tests proving only the isolated hover shader path exists.

Acceptance:

- hover remains legible across close/medium/far views,
- diagnostics exist for material/mode sanity checks,
- and the isolated shader path is explicitly guarded.

## 10. Recommended File Plan

Expected primary touch points:

- `client/apps/game/src/three/managers/hover-hex-manager.ts`
- `client/apps/game/src/three/managers/interactive-hex-manager.ts`
- `client/apps/game/src/three/scenes/worldmap.tsx`
- `client/apps/game/src/three/scenes/fast-travel.ts`
- `client/apps/game/src/three/shaders/` new hover material factory
- selected tests under `client/apps/game/src/three/managers` and `client/apps/game/src/three/scenes`

Likely new tests:

- `hover-hex-material.test.ts`
- `hover-hex-manager.shader-lifecycle.test.ts`
- updates to `hover-hex-manager.test.ts`
- updates to `fast-travel-hover-visuals.test.ts`

## 11. Risks

### 11.1 Overdesigned hover risk

Too much motion or center fill will make the effect noisy and undermine readability.

Mitigation:

- keep the center mostly transparent,
- prioritize border/scan hierarchy over full-surface glow.

### 11.2 Shader portability risk

An attractive but backend-fragile hover shader would reopen renderer issues.

Mitigation:

- prefer TSL,
- isolate the path,
- inventory and test it explicitly.

### 11.3 Scene leakage risk

If the hover manager does not fully own the material lifecycle, scene transitions may leave stale resources.

Mitigation:

- explicit lifecycle tests,
- explicit dispose checks,
- explicit outline-only bypass tests.

## 12. Open Design Questions

1. Do we want a subtle six-corner accent in the first pass, or should the first iteration stop at rim + inner contour +
   scan band?
2. Should the center breakup use simple dither first, or true noise in the initial shader?
3. Do we want camera-view-specific border thickness immediately, or only if readability fails in testing?
4. If TSL cannot express the desired diagonal scan cleanly, do we accept a single isolated `ShaderMaterial` here?

## 13. Definition of Done

This project is done when:

- worldmap base hover no longer reads like a flat plane,
- contextual hover still matches the shared palette language,
- fast-travel outline-only mode is preserved,
- the shader/TSL path is isolated and disposable,
- and the rollout lands through explicit failing tests first, then minimal implementation, then guardrails.
