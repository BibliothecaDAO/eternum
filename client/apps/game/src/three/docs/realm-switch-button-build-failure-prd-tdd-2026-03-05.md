# PRD Scope + TDD Plan: Button-Build Failure After Realm Switch

## Overview

- Feature: Ensure button-triggered construction remains reliable across realm switches.
- Status: Scoped
- Owner: Core Managers + Worldmap/Hexception + Settlement UI
- Created: 2026-03-05
- Last Updated: 2026-03-05

## Implementation Progress

- [ ] M1: Reproduce the user-reported button flow failure with deterministic red tests
- [ ] M2: Make optimistic build reconciliation scene-agnostic across world/local views
- [ ] M3: Preserve button-level pending continuity across structure/realm changes
- [ ] M4: Add listener/timer lifecycle hardening to prevent side-effect regressions
- [ ] M5: Regression suite for multi-build, realm switch, and delayed indexer timing

## User Scenario (Reported)

1. Click build button in construction UI (build #1).
2. Click build button again (build #2).
3. Switch to a different realm.
4. Click build button again (build #3).
5. Build #3 fails (user-observed failure in this flow).

Important clarification:

1. This flow is button-driven (`SelectPreviewBuildingMenu`), not direct hex-click placement.

## Problem Statement

Button-based construction after a realm switch can fail or appear to fail due to lifecycle gaps between:

1. optimistic operation tracking in core,
2. scene-specific authoritative reconciliation wiring, and
3. UI-local pending state reset on structure/realm change.

Current result is inconsistent continuity when switching realms during or between optimistic builds.

## Current Findings

1. Optimistic build operations are registered in `TileManager.placeBuilding` and rely on authoritative reconciliation/failure/stale paths.
2. Authoritative reconciliation is currently wired from `WorldmapScene` structure-building updates.
3. `WorldmapScene.onSwitchOff` disposes world update subscriptions, including reconciliation path.
4. `Hexception` subscribes to per-building tile updates but not structure-building reconciliation callbacks.
5. `SelectPreviewBuildingMenu` resets component-local pending maps on `entityId` change.

## Goals

1. Button-based build flow works reliably before and after realm switch.
2. Reconciliation does not depend on which map scene is currently active.
3. UI pending indicators remain coherent through realm switch without stale carryover.
4. No timer/listener leaks or duplicate reconciliation side effects.

## Non-Goals

1. Rewrite provider transaction confirmation behavior.
2. Re-architect all build UI modules.
3. Redesign construction UX visuals.

## Scope

### In Scope

1. `packages/core/src/managers/tile-manager.ts`
2. `packages/core/src/managers/optimistic-build-registry.ts`
3. `client/apps/game/src/three/scenes/worldmap.tsx`
4. `client/apps/game/src/three/scenes/hexception.tsx`
5. `client/apps/game/src/ui/features/settlement/construction/select-preview-building.tsx`
6. Targeted tests in core and game client

### Out of Scope

1. Broad scene manager refactor
2. Global event bus redesign
3. Unrelated military/movement systems

## Functional Requirements

1. FR-1 (P0): Button-based build after realm switch must submit and reconcile normally.
2. FR-2 (P0): Optimistic build confirmation must be processed regardless of active scene.
3. FR-3 (P0): Realm switch must not leave button flow in stale pending/failed-visible state.
4. FR-4 (P0): Pending operation lookup must remain structure-scoped (no cross-realm bleed).
5. FR-5 (P1): UI pending badges/spinners should represent real pending ops after switch.
6. FR-6 (P1): Duplicate or repeated authoritative updates remain idempotent.

## Non-Functional Requirements

1. NFR-1: Deterministic tests for realm-switch race windows.
2. NFR-2: No memory leaks from listeners or stale timers.
3. NFR-3: No measurable regression in build button response latency.
4. NFR-4: No additional flaky timing-sensitive tests.

## Proposed Design

### D1. Scene-Agnostic Reconciliation Bridge (Recommended)

Add reconciliation callback wiring that is not dependent on one specific scene being active.

Recommended approaches (choose one):

1. Preferred: central runtime subscription (always-on while client session is active) to `onStructureBuildingsUpdate`, invoking `TileManager.reconcilePendingBuildsForStructure`.
2. Minimal fallback: add equivalent reconciliation subscription in `Hexception` and ensure lifecycle cleanup parity with `WorldmapScene`.

Rationale:

1. User flow can transition between scenes while ops are pending.
2. Reconciliation should be tied to data stream availability, not camera scene.

### D2. Button Pending Continuity Policy

Refactor `SelectPreviewBuildingMenu` pending view logic to avoid reliance on component-local maps as source of truth.

1. Keep local maps as transient UX hints only.
2. Derive effective pending state from core pending registry selectors keyed by structure + building type + coordinates.
3. On `entityId` switch, clear transient local maps but preserve pending representation from core selector.

### D3. Listener and Cleanup Hardening

1. Ensure all build-related world update subscriptions are tracked and unsubscribed exactly once.
2. Guard against duplicate subscriptions on repeated setup calls.
3. Keep reconciliation idempotent under duplicate authoritative events.

## Side-Effect Risk Matrix

1. Risk: Duplicate reconciliation clears wrong operation.
   Mitigation: deterministic pending ordering + idempotent cleanup checks + duplicate update tests.
2. Risk: Scene switch leaves orphan listeners.
   Mitigation: explicit subscription registry in both setup and destroy/switchOff paths + lifecycle tests.
3. Risk: Cross-realm pending contamination.
   Mitigation: strict structure-id scoping in selectors/reconciliation + realm-isolation tests.
4. Risk: UI shows perpetual pending after failure.
   Mitigation: failure-path tests for button flow and selector consistency checks.
5. Risk: Existing build placement heuristics regress.
   Mitigation: tests for candidate tile selection and occupancy behavior across switch.

## TDD Requirements

`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`

Each milestone follows RED -> GREEN -> REFACTOR.

1. RED: Add one focused failing test for one behavior.
2. Verify expected failure reason.
3. GREEN: Minimal production change.
4. REFACTOR: Cleanup with all tests passing.

## Test Plan (Failing-First)

### M1: Reproduce Failure (P0)

1. Add button-flow test that executes:
   - build success (same realm),
   - second build success,
   - realm switch,
   - third button build -> currently fails.
2. Add scene transition test proving reconciliation callback is absent in one active-path configuration.

Exit:

1. Deterministic red test reproduces user scenario.

### M2: Scene-Agnostic Reconciliation (P0)

1. Add failing tests that require reconciliation to fire while worldmap is inactive.
2. Implement D1 bridge.
3. Validate pending op confirms/clears under delayed authoritative updates.

Exit:

1. Build #3 no longer fails in reproduced sequence.

### M3: UI Pending Continuity (P0/P1)

1. Add failing tests for `SelectPreviewBuildingMenu`:
   - pending indicator continuity across `entityId` switch,
   - no stale pending carryover to unrelated structure.
2. Implement D2 selector-driven pending source of truth.

Exit:

1. UI pending state matches core pending registry across realm switch.

### M4: Lifecycle Side-Effect Hardening (P1)

1. Add failing tests for:
   - duplicate setup does not register duplicate listeners,
   - switchOff/destroy cleans listeners/timers exactly once.
2. Implement D3 cleanup hardening.

Exit:

1. No leaked listeners/timers in teardown assertions.

### M5: Regression Matrix (P1)

1. Add matrix tests:
   - fast triple-build same realm,
   - build/build/switch/build (user scenario),
   - switch during pending then build,
   - delayed indexer update + eventual confirmation,
   - explicit tx failure after switch.

Exit:

1. Entire matrix green with deterministic timing.

## Acceptance Criteria

1. User-reported button flow succeeds reliably.
2. Build optimism persists and reconciles correctly independent of active scene.
3. Realm switch does not produce false failure perception for subsequent button builds.
4. No listener/timer leaks or duplicate callback regressions.
5. Tests cover scenario and identified side effects.

## Rollout / Validation

1. Run focused suites:
   - `pnpm --dir packages/core test src/managers/optimistic-build-registry.test.ts src/managers/tile-manager.test.ts`
   - `pnpm --dir client/apps/game test src/ui/features/settlement/construction`
   - `pnpm --dir client/apps/game test src/three/scenes`
2. Manual QA:
   - exact user scenario with button-only builds
   - repeat with indexer delay simulation
   - repeat across world/local view transitions

## Deliverables

1. This PRD/TDD scope document.
2. Failing-first regression coverage for button + realm-switch flow.
3. Minimal implementation patch for scene-agnostic reconciliation and UI pending continuity.
