# PRD: FastTravel Hex Field And Movement Parity TDD

## Overview

- Feature: render the fast-travel layer as a real hex map surface and restore worldmap-style unit movement on top of it
- Status: In Progress
- Owner: Three.js Team
- Created: 2026-03-12
- Last Updated: 2026-03-12

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                                       |
| ------ | ---------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------- |
| U1     | 2026-03-12 00:00 | Codex  | Created follow-up PRD/TDD for turning the current flat warp-space scene into a real hex field with movement parity scope. |
| U2     | 2026-03-12 00:30 | Codex  | Completed `H0` hex-surface bootstrap with a dedicated field/material seam and stage-level tests.                            |

## Delivery Tracker

- [x] H0: Hex Surface Bootstrap
- [ ] H1: Unit Anchoring On The Surface
- [ ] H2: Movement Parity Slice
- [ ] H3: Hardening And Closeout

## Executive Summary

The current fast-travel scene is now reachable and visually distinct, but it is still not a real hex traversal surface.

Current behavior:

1. black terrain was removed
2. warp-space background and stubbed Spire/army markers exist
3. no visible hex field exists
4. movement semantics do not exist yet in the scene

This PRD defines the next layer of work:

1. render the fast-travel map as a visible hexagon field
2. style that field as pink edges over black space
3. restore movement interaction on those hexes using worldmap-style patterns
4. do the work TDD-first and in slices that avoid copying `worldmap.tsx`

## Problem Statement

The scene now loads, but the player does not perceive it as a navigable hex map.

The current gaps are:

1. the screen reads as a flat background, not a hex surface
2. the existing stub unit marker is not grounded on a visible movement grid
3. there is no click/hover/move traversal language like the world map
4. unit movement/path rendering is not reused in fast travel yet
5. the current fast-travel hydration source is still scene-local demo data

## Product Intent

Visual intent:

1. the background is black, not pink
2. the map identity comes from the hex field itself
3. each visible hex is primarily defined by a pink edge treatment
4. the center/fill of the map should stay restrained so the grid reads clearly
5. Spires and units should feel embedded in the hex field, not floating over a flat plane

Interaction intent:

1. units move on discrete hexes like the world map
2. hover, selection, and path feedback should feel familiar to the player
3. Spires remain the entry/exit anchors
4. movement parity matters more than bespoke fast-travel-only interaction design in the first pass

## Goals

1. add a visible fast-travel hex field
2. style the field as pink edges on black space
3. make units appear on those hexes instead of as disconnected scene markers
4. restore movement/path semantics on that surface
5. reuse shared managers and policies wherever practical

## Non-Goals

1. full art polish for the fast-travel layer
2. redesigning worldmap movement semantics
3. introducing a brand new movement system just for fast travel
4. finalizing authoritative Spire ECS/runtime data in the same PR if a scene-local seam is needed first
5. solving every unrelated `src/three` test-suite issue

## Current State

### Already Implemented

1. registered `FastTravelScene`
2. `WarpTravel` lifecycle shell for fast travel
3. fast-travel chunk hydration/render-state seams
4. stubbed Spire entry/exit mapping policy
5. black-terrain opt-out via `shouldCreateGroundMesh()`

### Not Yet Implemented

1. visible hex field in fast travel
2. fast-travel-specific edge/fill material language for the grid
3. interactive visible hex surface
4. real unit placement and movement reuse through existing managers
5. path rendering / movement parity in fast travel

## Proposed Architecture

### Surface Layer

Introduce a dedicated fast-travel surface seam, tentatively:

1. `client/apps/game/src/three/scenes/fast-travel-hex-field.ts`
2. `client/apps/game/src/three/scenes/fast-travel-surface-material.ts`

Responsibilities:

1. derive visible hexes for the fast-travel window
2. render pink-edge hexes over black background
3. keep the field fully explored by default
4. avoid terrain biome assumptions from the world map

### Interaction Layer

Introduce a dedicated movement seam, tentatively:

1. `fast-travel-movement-policy.ts`
2. `fast-travel-occupancy-policy.ts`

Responsibilities:

1. define which hexes are traversable
2. determine unit origin/target semantics
3. provide path input to reused movement/path managers
4. gate Spire entry/exit nodes without forking worldmap behavior

### Scene Wiring

Update:

1. `client/apps/game/src/three/scenes/fast-travel.ts`

Responsibilities:

1. replace the current background-only surface with a real hex field
2. wire the field into `InteractiveHexManager`
3. anchor unit visuals to hydrated hex coordinates
4. reuse `ArmyManager` / path rendering where practical
5. keep scene-local demo seams isolated until authoritative runtime data replaces them

## Reuse Strategy

Reuse directly where possible:

1. `InteractiveHexManager`
2. `HoverHexManager`
3. `SelectedHexManager`
4. `SelectionPulseManager`
5. `ArmyManager`
6. `PathRenderer`
7. `WarpTravel`

Do not copy wholesale:

1. `WorldmapScene.updateHexagonGrid()`
2. worldmap-specific explored biome rendering
3. worldmap-only structure/chest assumptions
4. worldmap action-path code that assumes terrain or exploration rules that do not exist in fast travel

## TDD Operating Model

### Iron Rule

No fast-travel surface or movement code lands without a failing test first.

### Per-Slice Protocol

1. `RED`
   - add one failing test for one concrete behavior
   - run only the targeted test
   - confirm the failure is caused by the missing behavior
2. `GREEN`
   - implement the smallest possible change
   - rerun the targeted test
3. `REFACTOR`
   - extract shared seams only after green
   - rerun the affected cluster

### Required Test Commands

1. target loop:
   - `pnpm --dir client/apps/game test src/three/scenes/fast-travel-*.test.ts`
2. focused fast-travel cluster:
   - `pnpm --dir client/apps/game test src/three/scenes/fast-travel*.test.ts src/three/scene-navigation-boundary.test.ts`
3. shared regression cluster:
   - `pnpm --dir client/apps/game test src/three/scenes/warp-travel*.test.ts src/three/scenes/worldmap-shared-runtime.test.ts`
4. optional module gate:
   - `pnpm --dir client/apps/game test src/three`

## Scope

### In Scope

1. visible fast-travel hex field
2. pink edge / black background visual treatment
3. fully explored field assumptions
4. unit anchoring on hexes
5. movement/path parity on the fast-travel surface
6. Spire-aware traversal constraints on that surface

### Out of Scope

1. full shader-art pass beyond the pink-edge/black-space identity
2. replacing worldmap path logic everywhere
3. full live-data backend cleanup if a scene seam is sufficient first
4. unrelated worldmap terrain rendering work
5. solving the unrelated jsdom / `ResourcesIds` suite blockers in the same implementation PR

## Milestones

### H0: Hex Surface Bootstrap (0.5-1 day)

Objective:

Render a visible fast-travel hex field instead of a flat background.

Deliverables:

1. failing-first tests for visible hex-window generation
2. black background with pink-edge hex surface
3. no-terrain fast-travel surface material/policy

Exit Criteria:

1. the fast-travel scene clearly reads as a hex map
2. the field is fully explored from first render

### H1: Unit Anchoring On The Surface (1 day)

Objective:

Place units and Spires on the hex field instead of as disconnected markers.

Deliverables:

1. failing-first tests for unit/spire placement on visible hexes
2. scene wiring from hydrated state into hex-grounded visuals
3. surface-aware visibility refresh on camera movement

Exit Criteria:

1. units and Spires visually belong to the hex map
2. scrolling/panning keeps the visible surface consistent

### H2: Movement Parity Slice (2-3 days)

Objective:

Bring back worldmap-style movement semantics on the fast-travel hex surface.

Deliverables:

1. failing-first tests for traversable hex selection
2. movement origin/target policy for fast travel
3. reused path rendering for unit movement
4. fast-travel unit update loop through reused managers where possible

Exit Criteria:

1. units move on the fast-travel hexes like a real traversal map
2. path feedback feels consistent with the world map

### H3: Hardening And Closeout (0.5-1 day)

Objective:

Lock the surface/movement rollout and split remaining follow-up work.

Deliverables:

1. targeted fast-travel suite green
2. shared runtime suite green
3. documented follow-up for authoritative Spire/runtime data
4. documented visual polish backlog

Exit Criteria:

1. the hex-surface delivery is regression-safe
2. remaining interaction/data gaps are explicit

## Prioritized Slice Backlog

1. S1 (P0): Add failing test proving fast travel prepares a visible hex window instead of background-only render state.
2. S2 (P0): Add failing test proving fast-travel surface styling is black background plus pink-edge hex treatment.
3. S3 (P0): Add failing test proving `FastTravelScene` opts into `InteractiveHexManager` for the visible surface.
4. S4 (P1): Add failing test proving hydrated units and Spires are anchored to visible hexes.
5. S5 (P1): Add failing test proving camera movement refreshes the visible fast-travel surface.
6. S6 (P1): Add failing test proving fast-travel units can resolve traversable target hexes.
7. S7 (P1): Add failing test proving path visualization is driven for moving fast-travel units.
8. S8 (P1): Add failing test proving Spire entry/exit hexes remain explicit movement anchors.
9. S9 (P2): Document authoritative data follow-up and remaining polish backlog.

## Test Strategy

### New Test Files

1. `client/apps/game/src/three/scenes/fast-travel-hex-field.test.ts`
2. `client/apps/game/src/three/scenes/fast-travel-surface-material.test.ts`
3. `client/apps/game/src/three/scenes/fast-travel-movement-policy.test.ts`
4. `client/apps/game/src/three/scenes/fast-travel-scene-surface.test.ts`

### Existing Test Files Likely To Expand

1. `client/apps/game/src/three/scenes/fast-travel.test.ts`
2. `client/apps/game/src/three/scenes/fast-travel-hydration.test.ts`
3. `client/apps/game/src/three/scenes/fast-travel-rendering.test.ts`
4. `client/apps/game/src/three/scene-navigation-boundary.test.ts`

### Test Method

1. use pure helper tests first for surface/movement policies
2. use source-reading tests only where scene instantiation is too expensive
3. keep scene-level tests narrow and focused on orchestration
4. rerun shared `WarpTravel` regressions after each milestone

## Functional Requirements

1. the fast-travel scene renders a real hex field
2. the field is black-background, pink-edge, and fully explored
3. units and Spires are positioned on actual hexes
4. unit movement/path semantics exist on those hexes
5. entry/exit still centers on Spire travel

## Non-Functional Requirements

1. preserve current shared runtime contracts
2. avoid copying large worldmap blocks into fast travel
3. keep the surface render path isolated from terrain-biome assumptions
4. keep movement reuse manager-driven where possible
5. keep the fast-travel test cluster deterministic and small

## Risks

1. movement parity may tempt a direct `worldmap.tsx` copy-paste
2. the current demo hydration seam may blur the line between placeholder and real runtime data
3. interactive-hex reuse may expose hidden terrain assumptions from the world map
4. pink-edge styling may need a dedicated material to avoid affecting shared worldmap hover/selection visuals

## Mitigations

1. extract small shared policies instead of copying scene code
2. keep demo-data seams explicit and replaceable
3. isolate fast-travel surface material code from shared worldmap materials where styling differs
4. lock movement parity behavior with focused tests before visual polish

## Success Criteria

1. the scene reads immediately as a hex map
2. the fast-travel layer is black-space with pink hex edges
3. units move on that surface with familiar path feedback
4. shared runtime behavior remains green

## Follow-Up Backlog

1. replace scene-local demo data with authoritative Spire/runtime queries
2. add deeper visual polish after movement parity lands
3. evaluate whether a shared `WarpTravel` hex-surface helper should be extracted after the fast-travel implementation stabilizes
