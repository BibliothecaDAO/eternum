# PRD: FastTravel Outline Space Render TDD

## Overview

- Feature: convert the current fast-travel visual surface into true pink hex outlines over black space
- Status: Draft
- Owner: Three.js Team
- Created: 2026-03-12
- Last Updated: 2026-03-12

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                  |
| ------ | ---------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| U1     | 2026-03-12 00:00 | Codex  | Created follow-up PRD/TDD for fixing the remaining filled-surface / purple-background fast-travel look. |

## Executive Summary

The fast-travel scene now has a hex field and movement parity, but the rendered result still does not read as outlined
pink hexes in black space.

Observed result from the latest screenshot:

1. the field still reads as a large filled purple slab
2. the background is still purple instead of black
3. hover feedback still paints a filled interior on at least one hex
4. the intended outline-only layer is either hidden, visually dominated, or both

This PRD defines the follow-up slice to fix that.

## Problem Statement

The current fast-travel scene is functionally close, but visually wrong.

The likely causes are now narrow and concrete:

1. `InteractiveHexManager` is still drawing a translucent filled instanced surface through `interactiveHexMaterial`
2. shared sky / storm / day-night code is still mutating `scene.background`
3. hover feedback is still using a filled hover mesh instead of outline-only feedback
4. the dedicated fast-travel outline layer is not the only visible surface contributor

## Product Intent

Target look:

1. the screen background is black
2. the hex field is defined by pink outlines only
3. there is no visible shaded fill across the fast-travel surface
4. hover and selection feel integrated, but they do not reintroduce filled hex centers
5. the scene should read like floating navigation glyphs in space, not a biome slab

## Goals

1. remove visible filled-surface rendering from fast travel
2. lock the active fast-travel background to black
3. preserve hex interaction and pathing while hiding the picking surface
4. convert hover/selection feedback to outline-compatible visuals
5. keep the changes isolated to fast travel without regressing worldmap behavior

## Non-Goals

1. changing fast-travel movement logic
2. redesigning Spire placement
3. rewriting shared post-processing for all scenes
4. introducing a new art pass for units or Spires
5. solving unrelated renderer polish outside fast travel

## Current State

### What Is Working

1. fast-travel hex generation exists
2. outline geometry for the fast-travel field exists
3. movement/path wiring exists
4. fast-travel interaction routes through the shared scene shell

### What Is Failing Visually

1. the interactive picking mesh is still visible as a filled surface
2. the fast-travel background is still being overridden by shared atmosphere updates
3. hover uses filled feedback through `HoverHexManager`
4. outline-only intent is not enforced at the scene composition level

## Root Cause Hypothesis

### R1: Picking Surface Is Still Rendering

File:

1. `client/apps/game/src/three/shaders/border-hex-material.ts`

Current behavior:

1. `interactiveHexMaterial` is a translucent filled `MeshStandardMaterial`
2. `FastTravelScene` currently uses `InteractiveHexManager` for input and therefore also inherits that visible surface
   unless explicitly hidden

### R2: Shared Atmosphere Still Owns The Background

Files:

1. `client/apps/game/src/three/scenes/hexagon-scene.ts`
2. `client/apps/game/src/three/effects/day-night-cycle.ts`

Current behavior:

1. `HexagonScene.update()` still runs storm/day-night updates by default
2. `DayNightCycleManager` mutates `scene.background`
3. fast travel currently inherits that path, so black background assignments are not authoritative for the full frame

### R3: Hover Feedback Reintroduces Filled Hexes

File:

1. `client/apps/game/src/three/managers/hover-hex-manager.ts`

Current behavior:

1. hover rendering still creates a filled `ShapeGeometry` mesh using `hoverHexMaterial`
2. even if the base field is outline-only, hover can still visually reintroduce a filled center

## Proposed Architecture

### A1: Fast-Travel Visual Isolation

Update:

1. `client/apps/game/src/three/scenes/fast-travel.ts`
2. possibly `client/apps/game/src/three/scenes/hexagon-scene.ts`

Responsibilities:

1. disable shared storm/day-night background mutation for fast travel
2. treat black as the authoritative background color for the full fast-travel frame
3. keep weather/background changes scene-specific rather than global-by-default

### A2: Invisible Picking Surface

Update:

1. `client/apps/game/src/three/managers/interactive-hex-manager.ts`
2. or a fast-travel-specific wrapper seam in `fast-travel.ts`

Responsibilities:

1. keep the instanced interactive mesh for raycasting
2. make that mesh visually invisible in fast travel
3. ensure visible field rendering comes only from the dedicated outline layer

### A3: Outline-Compatible Hover And Selection

Update:

1. `client/apps/game/src/three/managers/hover-hex-manager.ts`
2. `client/apps/game/src/three/scenes/fast-travel.ts`

Responsibilities:

1. use outline-only hover in fast travel
2. avoid filled hover centers
3. preserve selection/path readability without turning the surface back into a shaded tile set

## Reuse Strategy

Reuse directly where practical:

1. `InteractiveHexManager` for raycasting only
2. `PathRenderer`
3. `SelectedHexManager`
4. `SelectionPulseManager`
5. existing fast-travel outline geometry/material seam

Do not reuse visually as-is:

1. `interactiveHexMaterial`
2. default hover fill treatment
3. shared worldmap sky/background assumptions

## TDD Operating Model

### Iron Rule

No fast-travel render-isolation change lands without a failing test first.

### Per-Slice Protocol

1. `RED`
   - add one failing test for one specific visual contract
   - run only the targeted test
   - confirm the failure is because the contract is not met yet
2. `GREEN`
   - make the smallest scene/material change that satisfies the contract
   - rerun the targeted test
3. `REFACTOR`
   - extract any shared helper only after green
   - rerun the fast-travel cluster

## Required Test Commands

1. target loop:
   - `pnpm --dir client/apps/game test src/three/scenes/fast-travel-visual-*.test.ts`
2. focused fast-travel cluster:
   - `pnpm --dir client/apps/game test src/three/scenes/fast-travel*.test.ts`
3. shared regression cluster:
   - `pnpm --dir client/apps/game test src/three/scenes/warp-travel.test.ts src/three/scenes/worldmap-shared-runtime.test.ts`

## Milestones

### O0: Background Isolation

Objective:

Keep fast travel black for the whole frame.

Deliverables:

1. failing-first test proving fast travel opts out of shared storm/day-night background mutation
2. authoritative black background for the active fast-travel scene

Exit Criteria:

1. the screenshot background reads black instead of purple
2. fast travel no longer depends on shared sky colors for its backdrop

### O1: Invisible Interaction Surface

Objective:

Preserve hex picking without rendering a filled field.

Deliverables:

1. failing-first test proving the interactive hex mesh is hidden or fully transparent in fast travel
2. fast-travel scene still routes click/hover through the manager
3. only the dedicated outline layer remains visually present

Exit Criteria:

1. the large filled purple slab disappears
2. interaction still works on the same visible hex window

### O2: Outline-Compatible Feedback

Objective:

Make hover/selection/path feedback match the outline-only field.

Deliverables:

1. failing-first test proving fast-travel hover does not use a filled center
2. outline-compatible hover/selection treatment
3. no blue/purple filled hover tile in the scene

Exit Criteria:

1. hovered and selected hexes still read clearly
2. no feedback layer reintroduces a shaded hex fill

### O3: Hardening

Objective:

Lock the outline-space render path and verify no shared-scene regressions.

Deliverables:

1. fast-travel cluster green
2. shared runtime cluster green
3. explicit follow-up notes for any remaining renderer-level cleanup

Exit Criteria:

1. the scene reliably reads as pink outlines in black space
2. worldmap / warp-travel shared runtime behavior stays green

## Prioritized Slice Backlog

1. [x] S1 (P0): Add failing test proving fast travel disables shared background mutation.
2. [x] S2 (P0): Add failing test proving the interactive hex mesh is not visibly shaded in fast travel.
3. [x] S3 (P0): Add failing test proving outline geometry is the only visible base-surface contributor.
4. [x] S4 (P1): Add failing test proving hover feedback is outline-only in fast travel.
5. [x] S5 (P1): Add failing test proving selection/path feedback does not reintroduce a filled tile center.
6. [x] S6 (P1): Run fast-travel and shared runtime regression suites.

## Test Strategy

### New Test Files

1. `client/apps/game/src/three/scenes/fast-travel-visual-isolation.test.ts`
2. `client/apps/game/src/three/scenes/fast-travel-interaction-surface.test.ts`
3. `client/apps/game/src/three/scenes/fast-travel-hover-visuals.test.ts`

### Existing Test Files Likely To Expand

1. `client/apps/game/src/three/scenes/fast-travel-rendering.test.ts`
2. `client/apps/game/src/three/scenes/fast-travel-scene-surface.test.ts`
3. `client/apps/game/src/three/scenes/fast-travel-scene-movement.test.ts`

### Test Method

1. use source-reading tests for scene orchestration seams
2. use pure helper/material tests for palette and visibility contracts
3. avoid adding expensive renderer integration tests unless needed to prove a real regression
4. rerun shared runtime suites after visual isolation lands

## Functional Requirements

1. the fast-travel background renders black
2. the visible field is outline-only
3. hover does not paint a filled center
4. selection/path feedback remains readable
5. interaction still works through the same visible hex surface

## Non-Functional Requirements

1. do not regress worldmap visuals
2. keep fast-travel-specific visual overrides isolated from shared worldmap defaults
3. preserve deterministic, focused tests
4. avoid expensive scene-wide refactors unless a small seam is insufficient

## Risks

1. hiding the interactive mesh could accidentally break raycasting if done destructively
2. disabling shared atmosphere paths in fast travel could expose hidden assumptions in `HexagonScene`
3. hover/selection feedback might become too subtle once fill is removed

## Mitigations

1. hide the picking surface visually, but do not remove the underlying instanced mesh from raycast ownership
2. isolate fast-travel background behavior behind a scene-specific override
3. keep outline hover and pulse feedback bright enough to read over black space

## Success Criteria

1. the surface reads as pink outlined hexes, not a purple slab
2. the backdrop reads as black space, not shared sky color
3. hover/selection feedback is compatible with outline-only presentation
4. fast-travel interaction remains intact

## Follow-Up Backlog

1. consider a general scene-level hook for opting out of shared background mutation
2. evaluate whether `InteractiveHexManager` needs a formal visual-mode API for non-worldmap scenes
3. decide whether hover/selection should share one outline-only feedback asset across fast travel and future abstract
   scenes
