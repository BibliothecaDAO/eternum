# PRD Scope + TDD Plan: Realm Takeover Attached-Army Owner Sync

## Overview

- Feature: Ensure armies attached to a realm/structure immediately reflect new owner after takeover.
- Status: Scoped
- Owner: Three / Worldmap
- Created: 2026-02-28
- Last Updated: 2026-02-28

## Implementation Progress

- [ ] M1: Reproduce and lock failing behavior in manager + worldmap tests
- [ ] M2: Add owner-sync hooks for existing armies on army tile updates
- [ ] M3: Add structure-owner propagation to attached armies on realm takeover updates
- [ ] M4: Regression hardening for stale/zero-owner edge cases and visual consistency

## Problem Statement

After a realm is taken over, armies attached to that realm can remain visually and interactively mapped to the old
owner (color, mine/enemy classification, and owner-dependent behavior) until a later unrelated army update happens.

User-visible symptoms:

1. Realm label/ownership updates to new owner.
2. Attached armies remain old owner color/state on the map.
3. Click/selection ownership checks can be inconsistent with current realm owner.

## Current Findings (Scope Input)

1. Existing-army tile updates do not apply owner deltas in `ArmyManager.onTileUpdate`; they only move:
   - `client/apps/game/src/three/managers/army-manager.ts:561`
2. Realm ownership updates are handled in worldmap structure subscription, but no attached-army ownership propagation is
   executed there:
   - `client/apps/game/src/three/scenes/worldmap.tsx:821`
3. Worldmap army ownership caches (`armyHexes` / `armyStructureOwners`) drive click and owner lookups, but are not
   refreshed from structure-owner changes unless an army update arrives:
   - `client/apps/game/src/three/scenes/worldmap.tsx:1205`
   - `client/apps/game/src/three/scenes/worldmap.tsx:2533`
4. Army owner linkage is structure-based (`ownerStructureId` / explorer owner points to structure id), so structure owner
   can change without immediate direct army stream owner delta:
   - `packages/core/src/systems/world-update-listener.ts:333`
   - `client/apps/game/src/hooks/use-exploration-automation-runner.ts:36`

## Goals

1. Attached armies must reflect new owner within the same structure takeover update cycle.
2. Visual state, selection ownership checks, and worldmap ownership caches must converge in one frame/update pass.
3. Behavior must remain stable under stale/zero-owner transient payloads.

## Non-Goals

1. Rewrite of world update listener architecture.
2. Cosmetic system redesign.
3. Changes to non-worldmap scenes.

## Scope

### In Scope

1. `client/apps/game/src/three/managers/army-manager.ts`
2. `client/apps/game/src/three/scenes/worldmap.tsx`
3. Targeted test files under `client/apps/game/src/three/managers` and `client/apps/game/src/three/scenes`
4. Optional policy/helper extraction only if required for deterministic tests

### Out of Scope

1. MapDataStore refresh policy changes
2. Story/event feed changes
3. Large-scale refactors unrelated to owner sync

## Functional Requirements

1. FR-1 (P0): Existing armies process owner changes on tile updates, not only on troop updates.
2. FR-2 (P0): Structure takeover update propagates new owner to all attached armies (`owningStructureId` match).
3. FR-3 (P0): Worldmap army ownership caches are updated alongside army visual/model ownership state.
4. FR-4 (P1): Owner propagation is idempotent and safe when repeated updates arrive for same owner.
5. FR-5 (P1): Transient `0n` owner payloads must not clobber a known valid owner for attached armies.

## Non-Functional Requirements

1. NFR-1: No additional async races in chunk transition paths.
2. NFR-2: No frame-jank regression from owner propagation on structure updates.
3. NFR-3: Deterministic tests without timing flake.

## Proposed Design

### D1. ArmyManager Owner Refresh Path (Recommended)

Add an internal owner-refresh routine used by both:

1. Existing-army branch in `onTileUpdate(...)`
2. Existing `updateArmyFromExplorerTroopsUpdate(...)` path

Responsibilities:

1. Resolve final owner address/name (including structure lookup where available).
2. Merge through `resolveArmyOwnerState(...)` to protect against stale zero-owner packets.
3. Recompute `isMine`, color, label, point icon, and visible instance refresh when needed.

### D2. Worldmap Structure->Army Propagation (Recommended)

On `Structure.onStructureUpdate(...)`:

1. Detect owner change for structure id.
2. Find attached armies by `army.owningStructureId` and fallback `armyStructureOwners`.
3. Push owner sync updates into ArmyManager and `updateArmyHexes(...)`.

### D3. Cache Convergence Rule

Whenever attached-army owner is recomputed, update:

1. ArmyManager runtime state (owner/isMine/color/visuals)
2. Worldmap `armyHexes` owner value used by interaction and rewards owner checks
3. Worker mirror via `gameWorkerManager.updateArmyHex(...)` through existing worldmap update flow

## Alternatives Considered

1. Structure-side only cache update (without ArmyManager refresh)
   - Rejected: fixes interaction cache but leaves army model/indicator/icon stale.
2. Wait for eventual ExplorerTroops update
   - Rejected: not deterministic, preserves current bug window.
3. Full event-bus rewrite
   - Rejected: out of scope and high risk.

## TDD Requirements

`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`

Each milestone must follow strict RED -> GREEN -> REFACTOR:

1. RED: add focused failing test for one behavior.
2. Verify failure cause matches expected bug.
3. GREEN: minimal production change to satisfy that behavior.
4. REFACTOR: cleanup only with all tests green.

## Test Plan (Failing-First)

### M1: Lock Current Failure (P0)

1. Add `army-manager` test proving existing `onTileUpdate` path does not refresh owner for already-tracked army.
2. Add `worldmap` test proving structure owner change does not update attached army owner cache/state.

Exit:

1. Tests fail against current behavior for the right reason.

### M2: Army Tile Update Owner Refresh (P0)

1. Implement owner refresh in existing-army branch of `ArmyManager.onTileUpdate`.
2. Add/expand tests to verify:
   - owner address/name change applied
   - `isMine` and color recomputed
   - icon/label refresh performed

Exit:

1. New failing tests pass.
2. Existing `army-owner-resolution` tests remain green.

### M3: Structure Takeover Propagation to Attached Armies (P0)

1. Add worldmap tests with event sequence:
   - army attached to structure `S`
   - structure owner flips from `A -> B`
   - no direct army movement/troop update arrives
2. Assert post-update:
   - attached army owner becomes `B`
   - `armyHexes` owner becomes `B`
   - selection/ownership checks classify army with new owner

Exit:

1. Failing propagation tests pass deterministically.

### M4: Edge Hardening + Regression (P1)

1. Add tests for transient `0n` incoming owner with valid existing owner.
2. Add repeated identical structure owner update test to verify idempotence.
3. Add rapid sequence test (`A -> B -> A`) to verify latest owner wins without stale apply.

Exit:

1. No regressions in targeted worldmap/army suites.

## Acceptance Criteria

1. Realm takeover updates attached armies to new owner without waiting for later unrelated army updates.
2. Army visual ownership (color/icon/label), interaction ownership, and cache ownership converge in same update cycle.
3. Added tests prove red->green path for manager and worldmap propagation behavior.
4. No failing regressions in impacted `src/three` test suites.

## Risks

1. Duplicate owner-update logic across manager methods can drift.
2. Structure update bursts could trigger unnecessary refresh churn.
3. Existing stale-owner safeguards may unintentionally block legitimate takeover updates.

## Mitigations

1. Centralize owner-application logic in a single helper in `ArmyManager`.
2. Apply owner refresh only when effective owner actually changes.
3. Add explicit tests for stale-guard behavior on takeover transitions.

## Rollout / Validation

1. Ship behind normal dev validation path with targeted test run first.
2. Run focused suites:
   - `pnpm --dir client/apps/game test src/three/managers`
   - `pnpm --dir client/apps/game test src/three/scenes`
3. Manual verification scenario:
   - create attached army at realm
   - trigger realm ownership transfer
   - verify army ownership visuals and click behavior update immediately

## Deliverables

1. This PRD/TDD scope document.
2. Failing-first tests for manager and worldmap owner propagation.
3. Minimal production patch implementing owner convergence behavior.
