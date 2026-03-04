# PRD Scope + TDD Plan: Optimistic Build/Move Persistence Until Authoritative Sync

## Overview

- Feature: Keep optimistic building/movement state visible and functional until authoritative ECS/indexer updates arrive.
- Status: Scoped
- Owner: Core Managers + Three / Worldmap + Settlement UI
- Created: 2026-03-04
- Last Updated: 2026-03-04

## Implementation Progress

- [x] M1: Reproduce and lock failing behavior with deterministic red tests
- [x] M2: Replace fixed build optimistic timeout with authoritative reconciliation + fallback
- [x] M3: Wire world update confirmations into optimistic build reconciliation
- [x] M4: Add stale-operation healing and safety invariants
- [x] M5: Align movement/explore pending indicator lifecycle with authoritative updates
- [ ] M6: Regression hardening for realm switching + automation continuity

## Problem Statement

Optimistic building and movement feedback currently disappear too early, before authoritative world-state updates are visible in client state.

User-visible symptoms:

1. Building appears optimistically, then disappears shortly after tx submit/hash.
2. Building later reappears once indexer/ECS sync catches up.
3. Switching realms/local view during this window amplifies the perception of failure.
4. Automation depending on client building lists can miss transiently-absent buildings.
5. Similar early-clear behavior exists for explore/travel top indicators/effects.

## Current Findings (Scope Input)

1. Build optimistic cleanup is hardcoded to `500ms` after `create_building` returns success:
   - `packages/core/src/managers/tile-manager.ts:397`
2. `create_building` can resolve to pending semantics before indexer-visible updates are available (confirmation timeout path):
   - `packages/provider/src/index.ts:751`
   - `packages/provider/src/index.ts:781`
3. Optimistic building state is represented via `Building` and `StructureBuildings` component overrides; removing these overrides removes visible build + local population/resource deltas:
   - `packages/core/src/managers/tile-manager.ts:160`
   - `packages/core/src/managers/tile-manager.ts:209`
   - `packages/core/src/managers/tile-manager.ts:227`
4. Settlement UI-local pending maps are reset on realm change, so local guard state is not durable across realm switches:
   - `client/apps/game/src/ui/features/settlement/construction/select-preview-building.tsx:151`
5. Authoritative structure-building updates already flow through world update listener and worldmap subscription:
   - `packages/core/src/systems/world-update-listener.ts:609`
   - `client/apps/game/src/three/scenes/worldmap.tsx:835`
6. Movement pending and fallback logic exists, but visual cleanup is partially tied to tx promise resolution timing:
   - `client/apps/game/src/three/scenes/worldmap.tsx:1716`
   - `client/apps/game/src/three/scenes/worldmap.tsx:1726`

## Goals

1. Optimistic building render must persist until authoritative sync confirms the change, not until arbitrary timer expiry.
2. Realm/local view switching must not drop optimistic build visibility.
3. Automation must see continuous logical occupancy/build intent until authoritative state converges.
4. Explore/travel pending indicators should follow the same authoritative lifecycle principle.
5. Behavior must self-heal if updates are delayed or partially missed.

## Non-Goals

1. Re-architecture of provider transaction pipeline.
2. Rewriting all optimistic systems in one PR.
3. Cross-feature UI redesign beyond lifecycle fixes.

## Scope

### In Scope

1. `packages/core/src/managers/tile-manager.ts`
2. `client/apps/game/src/three/scenes/worldmap.tsx`
3. Small shared policy/helper modules for reconciliation logic
4. Targeted tests in `packages/core` and `client/apps/game/src/three/scenes`
5. Optional small updates in settlement construction UI for realm-switch continuity

### Out of Scope

1. Broad store architecture rewrite
2. Non-worldmap/non-settlement unrelated visual systems
3. Provider-level confirmation timeout policy changes

## Functional Requirements

1. FR-1 (P0): Build optimistic overrides must not be cleared by fixed-duration timer.
2. FR-2 (P0): Build optimistic overrides clear only on authoritative confirmation or explicit failure.
3. FR-3 (P0): If confirmation is delayed, optimistic state remains active with bounded fallback timeout (stale healing).
4. FR-4 (P0): Realm switching must preserve build optimism for pending operations.
5. FR-5 (P0): Local occupancy checks (`isHexOccupied`) remain true for pending build ops until reconciliation.
6. FR-6 (P1): Movement/explore pending indicators/effects are cleared by authoritative position/update events, not tx submit timing.
7. FR-7 (P1): Multiple pending builds on same structure are reconciled in order without premature clears.
8. FR-8 (P1): Automation-facing building continuity is preserved through pending->confirmed transition.

## Non-Functional Requirements

1. NFR-1: Deterministic, non-flaky tests for reconciliation/fallback policy.
2. NFR-2: No significant render-performance regression under many pending ops.
3. NFR-3: No memory leaks from retained optimistic operations or timers.
4. NFR-4: Idempotent reconciliation under duplicated world updates.

## Proposed Design

### D1. Durable Pending Optimistic Build Registry (Recommended)

Replace ad-hoc `pendingBuilds: Set<string>` behavior with a richer module-level pending operation registry in `TileManager`:

1. Key fields per op:
   - `operationId`
   - `structureEntityId`
   - `outerCol/outerRow`, `innerCol/innerRow`
   - `buildingType`
   - `startedAtMs`
   - `removeOverride` callback
   - `status` (`submitted` | `confirmed` | `failed` | `stale`)
2. Keep existing occupancy protection semantics (`isHexOccupied`) using registry membership.
3. Remove fixed `500ms` cleanup.
4. Register long fallback timeout (for example `60-120s`) for stale healing.

Rationale:

1. Encodes operation lifecycle explicitly.
2. Supports robust reconciliation from world updates.
3. Prevents premature override removal.

### D2. Authoritative Reconciliation Hook from World Updates (Recommended)

Add a reconciliation entrypoint in core manager module callable from worldmap structure-building updates:

1. On `Structure.onStructureBuildingsUpdate`, invoke reconciliation for that structure id.
2. Reconcile pending ops for that structure in deterministic order:
   - Prefer oldest pending matching expected building-type growth signal.
   - Confirm and cleanup exactly one op per qualifying authoritative delta when needed.
3. Keep operation active when update does not satisfy confirmation predicate.

Candidate confirmation predicates:

1. `activeProductions` contains/increases expected `buildingType` count.
2. Fallback predicate for ambiguous deltas: op age and no contradiction from latest counts.

### D3. Failure and Stale Healing

1. Immediate failure path:
   - On `create_building` throw: remove optimistic override immediately.
2. Stale path:
   - If no authoritative confirmation by `staleAfterMs`, mark stale and cleanup safely.
   - Emit debug diagnostics in dev mode.
3. Optional healing extension:
   - If stale but tx still pending in transaction store, extend grace window once.

### D4. Realm-Switch Continuity Guard (Settlement UI)

Preserve pending-op awareness when structure selection changes:

1. Do not rely only on component-local `pendingBuilds` maps.
2. Read core pending registry (selector/helper) to derive pending badge/loading state.
3. Keep current UI local maps only as transient UX enhancements if needed.

### D5. Movement/Explore Lifecycle Alignment

Apply same principle to movement indicators:

1. Keep pending movement/effects until authoritative position/tile update indicates completion.
2. Avoid immediate cleanup for explore on tx promise resolution alone.
3. Retain stale fallback guard (`stalePendingArmyMovementMs`) as safety net.

## Alternatives Considered

1. Increase fixed build timeout (e.g., `500ms -> 5s`)
   - Rejected: still race-prone and chain/indexer latency dependent.
2. Clear on provider `transactionComplete` event only
   - Rejected: still can precede indexer/ECS visibility.
3. Keep overrides indefinitely after success
   - Rejected: risks permanent divergence/memory leak and stale masked state.

## TDD Requirements

`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`

Each milestone follows strict RED -> GREEN -> REFACTOR:

1. RED: add a focused failing test for exactly one behavior.
2. Verify expected failure reason (current bug), not setup/typo failure.
3. GREEN: minimal production change to satisfy test.
4. REFACTOR: cleanup only with all relevant tests green.

## Test Plan (Failing-First)

### M1: Lock Failures (P0)

1. Add `TileManager` tests proving:
   - optimistic override is currently removed after fixed timer even without authoritative update
   - occupancy becomes false during indexer lag window
2. Add worldmap/scenes test proving:
   - authoritative structure-building update arrives after optimistic cleanup window in reproduced sequence
   - observed gap causes missing building continuity

Exit:

1. Tests fail on current code for correct reason.

### M2: Build Registry + No Fixed Timeout (P0)

1. Implement pending-op registry and remove fixed timer cleanup in `placeBuilding`.
2. Add tests:
   - success path does not cleanup immediately without confirmation signal
   - failure path still cleans up immediately
   - `isHexOccupied` remains true while pending op exists

Exit:

1. New tests pass, old behavior regression test updated to expected behavior.

### M3: Authoritative Reconciliation (P0)

1. Add reconciliation API and worldmap wiring from `onStructureBuildingsUpdate`.
2. Add tests:
   - authoritative update confirms and clears matching optimistic op
   - unmatched update does not clear pending op
   - multiple pending ops reconcile in deterministic order

Exit:

1. Reconciliation tests pass deterministically without timing flake.

### M4: Stale Healing (P1)

1. Add tests:
   - stale timeout clears orphaned pending op
   - stale cleanup is idempotent
   - stale cleanup logs diagnostic in dev mode only

Exit:

1. No leaked pending entries/timers after completion/failure/stale cleanup.

### M5: Movement/Explore Indicator Alignment (P1)

1. Add worldmap tests:
   - explore/travel indicators remain until authoritative movement update
   - tx resolve alone does not force early cleanup
   - stale fallback still clears truly stuck pending movement

Exit:

1. Pending movement UX remains stable with delayed indexer updates.

### M6: Realm Switch + Automation Continuity (P1)

1. Add settlement UI tests:
   - switching structures/realms does not drop pending build visibility state
2. Add integration test:
   - pending build remains represented in automation-relevant state until authoritative update

Exit:

1. No transient “missing building” window in local realm-switch workflow.

## Acceptance Criteria

1. Build optimistic rendering persists from tx submit through authoritative ECS/indexer update.
2. No fixed-time cleanup causes early disappearance.
3. Realm switching does not clear pending optimistic build state.
4. Automation continuity is preserved (no transient missing building due to optimistic teardown).
5. Explore/travel pending indicators follow authoritative update lifecycle.
6. Added tests demonstrate red->green progression for each milestone.

## Risks

1. Ambiguous structure-building updates may reconcile wrong pending op when many operations overlap.
2. Registry lifecycle bugs can leak timers/entries.
3. Overly aggressive stale healing can reintroduce premature clears.
4. Cross-scene wiring may miss confirmations if listeners are not active.

## Mitigations

1. Deterministic op matching policy + ordered queues per structure.
2. Centralized cleanup helper (single path for success/failure/stale).
3. Conservative stale thresholds with diagnostic telemetry.
4. Add fallback reconciliation triggers from multiple authoritative update points when needed.

## Rollout / Validation

1. Run focused suites first:
   - `pnpm --dir packages/core test src/managers`
   - `pnpm --dir client/apps/game test src/three/scenes`
2. Manual scenario matrix:
   - build in local view, wait for delayed indexer, verify no flicker/drop
   - switch realms repeatedly during pending build
   - run automation path while build pending
   - explore/travel action with delayed sync
3. Dev diagnostics:
   - log pending-op create/confirm/fail/stale transitions under dev flag

## Deliverables

1. This PRD/TDD scope document.
2. Failing-first test coverage for optimistic build/move lifecycle.
3. Minimal production patch implementing authoritative reconciliation and stale healing.
