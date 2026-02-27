# PRD Scope + TDD Plan: Worldmap Move-Highlight One-Hex Desync

## Overview

- Feature: Eliminate one-hex desync between move-available highlights and interactive click/hover resolution during
  rapid chunk switching.
- Status: Implemented v1.0
- Owner: Three / Worldmap
- Created: 2026-02-26
- Last Updated: 2026-02-27

## Implementation Progress

- [x] M1: Hex conversion correctness tests added and fixed (`getHexForWorldPosition` nearest-center resolution)
- [x] M2: `InteractiveHexManager.resolveHexFromPoint` alignment tests added and passing
- [x] M3: Rapid chunk-switch action-path lookup ownership guard added and covered
- [x] M4: Regression coverage expanded for negative coordinates/churn + chunk-transition suites re-validated

## Problem Statement

When chunk transitions happen quickly, hexes shown as available movement targets can appear offset by one hex relative
to what click/hover selection resolves.

The issue is user-visible as:

1. Highlighted destination appears valid.
2. Hover/click resolves adjacent tile, or action lookup fails because key does not match highlighted tile.

## Current Findings (Scope Input)

1. `getHexForWorldPosition` uses row-first rounding and parity offset reconstruction, which can resolve to a neighboring
   hex near boundaries:
   - `client/apps/game/src/three/utils/utils.ts`
2. Interactive picking depends on that conversion:
   - `client/apps/game/src/three/managers/interactive-hex-manager.ts`
3. Highlight rendering uses forward mapping (`hex -> world`) and can remain visually consistent while picking
   (`world -> hex`) is not:
   - `client/apps/game/src/three/managers/highlight-hex-manager.ts`
4. Rapid chunk transitions increase boundary/corner interactions and stale visual windows:
   - `client/apps/game/src/three/scenes/worldmap.tsx`

## Goals

1. Ensure world pick points map to the nearest intended hex deterministically.
2. Keep highlight, hover, click, and action-path key resolution in the same coordinate contract.
3. Prove correctness under rapid chunk switching with deterministic tests.

## Non-Goals

1. Chunk architecture rewrite.
2. Map-generation changes.
3. UI redesign of highlight effects.

## Scope

### In Scope

1. `client/apps/game/src/three/utils/utils.ts` (`getHexForWorldPosition` and related helpers)
2. `client/apps/game/src/three/managers/interactive-hex-manager.ts` (pick resolution path)
3. `client/apps/game/src/three/scenes/worldmap.tsx` (selection/chunk-transition interaction checks)
4. New/updated tests in `client/apps/game/src/three/**`

### Out of Scope

1. Mobile renderer parity changes (tracked separately)
2. Combat direction systems
3. Non-worldmap scenes unless required for shared utility correctness

## TDD Requirements

`NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST`

Each behavior change must follow:

1. RED: add failing test that demonstrates desync.
2. GREEN: apply minimal fix.
3. REFACTOR: cleanup with tests still green.

## Test Plan (Failing-First)

### M1: Hex Conversion Correctness (P0)

1. [x] Add unit tests for `world -> hex` conversion against robust nearest-hex expectation.
2. [x] Cover parity boundaries, negative rows, and near-corner samples.
3. [x] Validate round-trip stability for sampled hex-local points.

Exit:

1. [x] Current implementation fails at least one boundary/corner case.
2. [x] Post-fix conversion passes all added cases.

### M2: Interaction Contract Alignment (P0)

1. [x] Add manager-level tests for `InteractiveHexManager.resolveHexFromPoint`.
2. [x] Assert picked hex key matches active interactive window membership and expected nearest hex.
3. [x] Ensure no one-neighbor drift for points near edges of highlighted cells.

Exit:

1. [x] Reproduced one-hex pick mismatch pre-fix.
2. [x] No mismatch post-fix in deterministic samples.

### M3: Rapid Chunk Switch Regression Coverage (P0)

1. [x] Add worldmap behavior test for rapid chunk switches with preserved selection + movement options.
2. [x] Assert highlighted destination and click lookup key resolve to same target under transition churn.
3. [x] Verify no stale action-path map usage after transition settle.

Exit:

1. [x] Repro test fails before fix, passes after fix.

### M4: Guardrail/Regression Suite (P1)

1. [x] Add regression cases for negative coordinate regions and chunk boundary oscillation.
2. [x] Ensure no behavioral regressions in existing chunk-transition policy tests.

Exit:

1. [x] Targeted suites green; no new flaky timing assumptions.

## Acceptance Criteria

1. No observed one-hex offset between rendered move highlights and picked/action-resolved hexes in rapid switch
   scenarios.
2. New tests demonstrate red->green for conversion, interaction, and chunk-switch behavior.
3. Existing worldmap chunk transition suites remain green.

## Risks

1. Fixing conversion math may affect any other call site using `getHexForWorldPosition`.
2. Interaction tests can become flaky if tied to real RAF/timers rather than deterministic fixtures.

## Mitigations

1. Keep conversion tests utility-local and deterministic.
2. Reuse existing chunk orchestration fixtures for race tests.
3. Scope fix to smallest shared utility surface, then validate all dependents.

## Deliverables

1. This scoped PRD/TDD document.
2. Failing-first tests for conversion, interaction, and rapid chunk switching.
3. Minimal production fix with green suites and no unrelated refactors.
