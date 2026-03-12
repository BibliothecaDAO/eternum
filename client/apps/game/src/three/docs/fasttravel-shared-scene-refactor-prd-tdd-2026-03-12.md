# PRD: Fast-Travel Shared Scene Refactor TDD

## Overview

- Feature: shared Three.js scene refactor to support a future fast-travel unit layer
- Status: Draft
- Owner: Three.js Team
- Created: 2026-03-12
- Last Updated: 2026-03-12

## Document Update Log

| Update | Date (UTC)       | Author | Change                                                                                                                                                    |
| ------ | ---------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| U1     | 2026-03-12 00:00 | Codex  | Created detailed TDD PRD for shared scene extraction ahead of fast-travel layer implementation, with milestones, fail-first slices, and open questions. |
| U2     | 2026-03-12 00:00 | Codex  | Resolved scope decisions: shared abstraction named `WarpTravel`, future scene enum/bootstrap included now, and shared navigation boundary added in scope. |

## Executive Summary

We need a new unit-travel scene that behaves like the world map from a rendering and interaction perspective, but we
should not build it by copying `worldmap.tsx`.

The current architecture already has a reusable low-level shell in `HexagonScene`, but the higher-level world map
runtime still mixes:

1. shared scene lifecycle and camera behavior
2. shared chunked hex-window orchestration
3. world-specific ECS, action-path, and selection rules

This PRD focuses only on refactoring and hardening the shared code first. The fast-travel scene itself is intentionally
out of scope until the shared seams are extracted and protected by tests.

## Problem Statement

`WorldmapScene` is currently the closest behavioral match for the future fast-travel layer, but it is too coupled to
world-map semantics to reuse safely as-is.

Current risks:

1. Copying `worldmap.tsx` will duplicate chunking, label-group lifecycle, manager fanout, and scene-switching logic.
2. Refactoring without fail-first coverage risks regressions in chunk switching, label visibility, store subscription
   cleanup, and manager update convergence.
3. The future fast-travel scene will need the same camera UX, render-window updates, and unit rendering, but not the
   same terrain/exploration/action-path rules.

## Goals

1. Extract the shared worldmap-like scene logic into a reusable intermediate abstraction.
2. Preserve current world map behavior through fail-first regression tests.
3. Make the future fast-travel scene a small concrete scene, not a forked clone.
4. Keep the first delivery strictly focused on refactor safety, not new gameplay.

## Confirmed Decisions

1. The new shared abstraction will be named `WarpTravel`.
2. The refactor will add the future scene enum/bootstrap now.
3. The refactor will extract a shared navigation boundary now.

## Non-Goals

1. Implementing the fast-travel scene itself.
2. Implementing Spire traversal UX or navigation flows.
3. Changing unit rendering, movement, or ownership behavior.
4. Changing existing world-map gameplay semantics.
5. Replacing the existing manager model.

## Current State

### Existing Reusable Base

`HexagonScene` already provides:

1. scene initialization
2. camera/view control
3. input routing
4. interactive hex registration
5. visibility and frustum services
6. biome model loading
7. shared update loop
8. teardown lifecycle

### Worldmap-Specific Overload

`WorldmapScene` currently layers on:

1. chunk switching and prefetch
2. hex-grid matrix caching
3. manager label-group attachment
4. army/structure/chest subscriptions
5. world-specific action paths and selection logic
6. UI store and shortcut wiring
7. scene switch-off and resume behavior

### Reuse Hypothesis

The right refactor target is a new intermediate abstraction named `WarpTravel`.

This abstraction should sit between `HexagonScene` and `WorldmapScene`.

## Proposed Architecture

## Layering

1. `HexagonScene`
   - unchanged low-level shell
2. `WarpTravel`
   - new shared worldmap-like runtime and navigation boundary
3. `WorldmapScene`
   - refit to use `WarpTravel`
4. future fast-travel scene
   - built on `WarpTravel`

## Shared Responsibilities To Extract

These should move out of `WorldmapScene` into the new shared base if they can be expressed without world-specific ECS
rules:

1. chunk-key resolution from camera/focus point
2. chunk-switch orchestration
3. forced refresh lifecycle
4. pinned-neighborhood bookkeeping
5. directional prefetch queue orchestration
6. interactive render-window hex registration
7. terrain matrix cache lifecycle
8. scene-level chunk bounds registration
9. shared label-group attach/detach lifecycle
10. manager chunk-update fanout
11. shared switch-off and resume scaffolding
12. shared scene-navigation boundary for future Spire travel

## Responsibilities That Must Stay Scene-Specific

These remain in `WorldmapScene` and later in the fast-travel scene adapter:

1. how chunk data is hydrated
2. what terrain visibility means
3. what entities exist on a hex
4. how action paths are derived
5. what selection means
6. what UI state is written
7. what subscriptions are opened
8. how cross-scene navigation is triggered

The navigation boundary itself can be shared, but scene-specific mapping, authorization, and gameplay rules must remain
concrete-scene concerns.

## Design Constraints

1. The extraction must preserve current `WorldmapScene` behavior.
2. No production extraction change lands without a failing test first.
3. Shared base logic must not reference world-only concepts like explored tiles, chest rules, or world-only URL
   semantics.
4. The first merged refactor should add the future scene enum/bootstrap without activating the scene.

## TDD Operating Model

### Iron Rule

No shared refactor lands without a red-green-refactor loop and targeted regression coverage.

### Per-Slice Protocol

1. `RED`
   - write one failing test for one extraction seam or regression case
   - run only the targeted test file
   - confirm the failure is the intended missing seam or regression guard
2. `GREEN`
   - implement the minimum change to pass
   - re-run the targeted test
3. `REFACTOR`
   - move code only after behavior is locked
   - re-run the affected cluster

### Required Test Commands

1. Targeted loop:
   - `pnpm --dir client/apps/game test client/apps/game/src/three/<path>/<file>.test.ts`
2. Shared module gate:
   - `pnpm --dir client/apps/game test src/three`
3. Quality gate for touched files:
   - `pnpm --dir client/apps/game exec eslint src/three`

## Scope

### In Scope

1. New shared scene abstraction for worldmap-style chunked hex runtime.
2. Refactoring `WorldmapScene` to consume that abstraction.
3. Test harness additions needed to validate the shared abstraction.
4. Regression tests for setup, resume, switch-off, chunk switching, and manager fanout.
5. Future scene enum/bootstrap preparation as part of the shared seam rollout.
6. Shared navigation boundary extraction for future Spire travel.

### Out of Scope

1. New fast-travel scene rendering or gameplay beyond dormant registration and boundary plumbing.
2. Spire enter/exit implementation beyond shared boundary extraction.
3. World-map UI changes unrelated to the refactor.
4. New asset loading or model changes.
5. Broad rewrite of `ArmyManager` or `StructureManager` beyond shared-scene extraction needs.

## Milestones

### M0: Baseline Behavior Lock (1 day)

Objective:

Freeze the current worldmap shared-runtime behavior before extraction.

Deliverables:

1. Failing-first tests for setup/resume/switch-off parity.
2. Failing-first tests for chunk switch and forced refresh fanout.
3. Baseline list of methods and state that must remain behaviorally stable.

Exit Criteria:

1. Shared-runtime expectations are encoded in tests before code motion starts.
2. No extraction begins without at least one failing test per seam.

### M1: Shared Lifecycle Extraction (1-2 days)

Objective:

Extract worldmap lifecycle behaviors that are structurally shared and not domain-specific.

Target Areas:

1. label-group attach/detach
2. manager label visibility lifecycle
3. setup vs resume flow symmetry
4. switch-off cleanup symmetry
5. common scene-level refresh entry points
6. shared navigation boundary wiring

Deliverables:

1. new shared base scene file
2. new tests for lifecycle parity
3. `WorldmapScene` rewritten to delegate lifecycle scaffolding
4. dormant future-scene bootstrap integrated without gameplay activation

Exit Criteria:

1. `WorldmapScene` behavior remains green.
2. Shared lifecycle methods are no longer embedded directly in `worldmap.tsx`.

### M2: Shared Chunk Runtime Extraction (2-3 days)

Objective:

Extract the chunk-window orchestration that is structurally reusable for another scene.

Target Areas:

1. chunk key resolution
2. chunk switch gating and transition token plumbing
3. forced refresh path
4. directional prefetch queue orchestration
5. render-window interactive hex updates
6. chunk-bounds registration
7. future-scene bootstrap compatibility

Deliverables:

1. shared chunk-runtime methods in the new base scene
2. regression tests for switch, refresh, and no-op cases
3. `WorldmapScene` reduced to domain-specific chunk hydration and selection behavior
4. dormant future scene enum/bootstrap wired through shared runtime contracts

Exit Criteria:

1. Shared chunk orchestration is extracted without behavior drift.
2. Existing worldmap chunk tests remain green.

### M3: Manager Fanout Hardening (1-2 days)

Objective:

Lock the contract between the shared scene runtime and existing render managers.

Target Areas:

1. army-manager chunk update fanout
2. structure-manager chunk update fanout
3. label-group presence across setup/resume/switch-off
4. manager update ordering during chunk switch vs forced refresh
5. shared navigation boundary call ordering relative to scene switch

Deliverables:

1. shared-scene tests that assert manager calls and ordering
2. minimal adapter points for manager registration in the new base scene

Exit Criteria:

1. Managers remain reusable without scene-specific leakage into the shared base.
2. No regressions in current label or visibility behavior.

### M4: Refactor Closeout and Fast-Travel Readiness (0.5-1 day)

Objective:

End the refactor with a stable seam ready for the fast-travel scene follow-up PRD/implementation.

Deliverables:

1. documentation update describing the new shared scene layer
2. residual-risk list
3. follow-up backlog for fast-travel scene implementation
4. clear contract for future Spire enter/exit implementation

Exit Criteria:

1. The shared scene seam is stable and test-protected.
2. The next PR can implement the fast-travel scene without reopening the shared refactor.

## Prioritized Slice Backlog

1. S1 (P0): Add failing test proving setup and resume run the same shared label-group and manager-label lifecycle.
2. S2 (P0): Add failing test proving switch-off detaches shared label groups and manager labels symmetrically.
3. S3 (P0): Add failing test proving shared refresh entry point no-ops when switched off.
4. S4 (P0): Add failing test proving chunk switch fanout updates all registered managers with the same transition token.
5. S5 (P1): Add failing test proving forced refresh on the current chunk does not drift chunk identity.
6. S6 (P1): Add failing test proving directional prefetch orchestration is shared and scene-agnostic.
7. S7 (P1): Add failing test proving interactive hex registration stays bounded to the active render window after
   extraction.
8. S8 (P1): Add failing test proving shared navigation boundary can register the future scene without affecting current
   worldmap behavior.
9. S9 (P1): Extract shared lifecycle methods into `WarpTravel`.
10. S10 (P1): Extract shared chunk-runtime methods into `WarpTravel`.
11. S11 (P1): Extract shared navigation boundary for future Spire transitions.
12. S12 (P2): Update docs and add follow-up backlog for fast-travel scene implementation.

## Test Strategy

### New Test Files

1. `client/apps/game/src/three/scenes/warp-travel.test.ts`
2. `client/apps/game/src/three/scenes/worldmap-shared-runtime.test.ts`

### Existing Test Files Likely To Expand

1. `client/apps/game/src/three/scenes/worldmap-lifecycle.test.ts`
2. `client/apps/game/src/three/scenes/worldmap-chunk-policy.test.ts`
3. `client/apps/game/src/three/scenes/worldmap-runtime-lifecycle.test.ts`
4. `client/apps/game/src/three/scene-manager.test.ts`
5. `client/apps/game/src/three/game-renderer-policy.test.ts`

### Test Method

1. Prefer seam tests over large integration tests.
2. Use fixtures and controlled async helpers already present in `src/three/scenes/worldmap-test-harness.ts`.
3. Assert behavior through shared contracts:
   - manager calls
   - transition token propagation
   - label-group scene membership
   - switch-off cleanup side effects
   - navigation boundary registration and dormant no-op behavior
4. Only add jsdom-heavy scene tests where policy/unit tests cannot protect the seam.

## Functional Requirements

1. Shared lifecycle behavior is extracted without changing worldmap setup, resume, and switch-off behavior.
2. Shared chunk fanout updates registered managers consistently during chunk switch and forced refresh.
3. Shared runtime methods do not directly depend on world-only gameplay semantics.
4. Future scene enum/bootstrap exists without changing current worldmap behavior.
5. Shared navigation boundary exists without activating Spire travel behavior.

## Non-Functional Requirements

1. Refactor must preserve current performance-sensitive chunk logic behavior.
2. No new flaky tests.
3. No net-new lint debt in touched files.
4. Shared base names and contracts must be explicit enough to support a second scene cleanly.
5. Navigation boundary contracts must be explicit enough to support Spire travel without reworking scene ownership again.

## Risks

1. Extracting too much at once will blur shared vs scene-specific responsibilities and cause behavior drift.
2. Extracting too little will leave the future fast-travel scene still requiring a worldmap fork.
3. Tests may accidentally lock current incidental behavior instead of intended contracts.
4. Manager lifecycle and label ownership are easy regression points during scene-base extraction.
5. Adding dormant scene/bootstrap code may accidentally affect current routing or scene selection.

## Mitigations

1. Extract in thin vertical slices, not one broad move.
2. Lock only the behavioral contracts that matter for reuse.
3. Keep world-specific ECS and selection logic in `WorldmapScene`.
4. Keep dormant future-scene registration behind no-op behavior until the follow-up implementation PR.
5. Treat navigation boundary extraction as plumbing only, not gameplay activation.

## Success Criteria

1. A new shared scene base exists and `WorldmapScene` uses it.
2. Shared runtime behavior is protected by new tests.
3. Existing `src/three` tests remain green.
4. The follow-up fast-travel scene PR can focus on data adapters and Spire mapping instead of redoing scene architecture.

## Recommended Execution Order

1. Execute M0 and lock the shared behavior with failing tests.
2. Execute M1 and M2 as small extraction slices.
3. Execute M3 with manager and navigation-boundary hardening.
4. Stop after M4 and publish a separate follow-up PRD for the actual fast-travel scene.
