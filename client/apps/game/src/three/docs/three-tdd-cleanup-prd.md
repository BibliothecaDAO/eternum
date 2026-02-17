# PRD: Three.js TDD Cleanup Sprint

## Overview

- Feature: Test-driven cleanup program for `client/apps/game/src/three`
- Status: Draft v1
- Owner: Three.js Team
- Created: 2026-02-17
- Last Updated: 2026-02-17

## Document Update Log

| Update | Date (UTC)       | Author | Change |
| ------ | ---------------- | ------ | ------ |
| U1     | 2026-02-17 21:58 | Codex  | Created detailed TDD PRD with baseline, scope, milestones, test strategy, and acceptance criteria. |
| U2     | 2026-02-17 22:08 | Codex  | Marked M0 harness stabilization complete and logged implementation outcomes. |

## Executive Summary

The `three` module has meaningful policy-test momentum, but most production code remains in large orchestration files
with weak test seams. This sprint formalizes a strict red-green-refactor cleanup flow that:

1. Restores a reliable `three` test harness.
2. Extracts deterministic logic from large orchestrators into test-first policy modules.
3. Expands focused coverage on high-risk behavior while avoiding broad rewrites.

The sprint target is safer refactoring velocity, not architecture replacement.

## Baseline (as of 2026-02-17)

### Current Footprint

- Production files: `115`
- Test files: `24`
- Production lines: `39,675`
- Test lines: `1,868`
- Files with direct paired tests: `22`
- Files without direct paired tests: `93`

### Largest High-Risk Files

1. `client/apps/game/src/three/scenes/worldmap.tsx` (`4,834` lines)
2. `client/apps/game/src/three/managers/army-manager.ts` (`2,689` lines)
3. `client/apps/game/src/three/managers/structure-manager.ts` (`2,253` lines)
4. `client/apps/game/src/three/managers/army-model.ts` (`1,941` lines)
5. `client/apps/game/src/three/game-renderer.ts` (`1,517` lines)

### Immediate Test Blocker

Current command:

- `pnpm --dir client/apps/game test src/three`

Current result:

- Fails before collecting tests with `24` unhandled environment errors.
- Primary error: `ERR_REQUIRE_ESM` during jsdom setup via `html-encoding-sniffer` and `@exodus/bytes`.

This blocker is Sprint Item 0 because TDD cannot run without a stable red phase.

## Problem Statement

The module mixes deterministic policy decisions and imperative rendering side effects in large files. Existing tests are
strong where logic was extracted (chunk policy, transition policy, queue policy), but most orchestration paths still
lack safe, test-first seams. This creates three problems:

1. Refactors are risky because behavior is encoded in long methods with hidden coupling.
2. Regression detection is delayed because many changes require manual verification.
3. TDD workflow is blocked by environment instability in the `three` test command.

## Goals

1. Restore a stable, repeatable `three` test run.
2. Enforce TDD sequence on all cleanup slices:
   1. Write failing test.
   2. Verify fail reason.
   3. Implement minimal passing code.
   4. Refactor with tests green.
3. Reduce orchestration complexity by extracting deterministic rules from the top risk files.
4. Increase high-signal test coverage around chunking, visibility, selection, and manager-update convergence behavior.

## Non-Goals

1. Rewriting scene architecture end-to-end.
2. Visual redesign or gameplay behavior changes.
3. Replacing Three.js manager model.
4. Chasing blanket line coverage targets disconnected from risk.

## Scope

### In Scope

1. Test harness stabilization for `client/apps/game` Vitest + jsdom path relevant to `three`.
2. TDD extraction slices from:
   1. `client/apps/game/src/three/scenes/worldmap.tsx`
   2. `client/apps/game/src/three/managers/army-manager.ts`
   3. `client/apps/game/src/three/managers/structure-manager.ts`
   4. `client/apps/game/src/three/game-renderer.ts` (policy-only slices)
3. New or expanded tests in:
   1. `client/apps/game/src/three/scenes/*.test.ts`
   2. `client/apps/game/src/three/managers/*.test.ts`
   3. `client/apps/game/src/three/utils/*.test.ts`

### Out of Scope

1. Shader/material redesign work.
2. Cross-package platform upgrades unrelated to `three` harness or behavior.
3. Asset/content changes.
4. New game features.

## TDD Operating Model (Mandatory)

### Iron Rule

No production cleanup change lands without a failing test first.

### Per-Slice Protocol

1. `RED`
   1. Add one minimal failing test for one behavior.
   2. Run targeted test file.
   3. Confirm expected failure reason.
2. `GREEN`
   1. Implement minimum change to pass.
   2. Re-run targeted test.
3. `REFACTOR`
   1. Improve names/extraction only after green.
   2. Re-run affected test cluster.

### Required Test Commands

1. Targeted loop:
   - `pnpm --dir client/apps/game test client/apps/game/src/three/<path>/<file>.test.ts`
2. Module gate:
   - `pnpm --dir client/apps/game test src/three`

## Milestones

### M0: Harness Stabilization (1-2 days)

Objective:

Make `src/three` tests executable without environment crashes.

Deliverables:

1. Root cause fix for jsdom ESM interop failure.
2. Stable command path for `pnpm --dir client/apps/game test src/three`.
3. Short troubleshooting note added to three docs or test docs.

Exit Criteria:

1. `src/three` test command starts collecting/running tests.
2. No unhandled environment errors.

### M1: Worldmap Policy Extraction Wave (2-3 days)

Objective:

Extract deterministic decisions from `worldmap.tsx` into pure, testable modules.

Target Areas:

1. Chunk refresh token gating.
2. Hydrated refresh scheduling decisions.
3. Deferred army-selection recovery decisions.
4. Chunk cache invalidation decisions.

Deliverables:

1. New `worldmap-*.ts` policy helpers (pure functions).
2. New/expanded `worldmap-*.test.ts` suites with table-driven cases.
3. `worldmap.tsx` reduced imperative branching in touched areas.

Exit Criteria:

1. Behavior parity maintained via tests.
2. No new flaky chunk-transition tests.

### M2: Manager Convergence Extraction Wave (2-3 days)

Objective:

Move deterministic visibility/update policy out of large managers.

Target Areas:

1. Army visibility and selection edge decisions.
2. Structure visibility bucket/update gating.
3. Chunk-bound culling and movement source fallback rules.

Deliverables:

1. New manager policy modules and tests.
2. Lower branching complexity in touched manager methods.

Exit Criteria:

1. Manager policy behavior is test-protected.
2. Existing manager tests still pass.

### M3: Renderer/Scene Guardrail Wave (1-2 days)

Objective:

Extract and lock lightweight renderer/scene policy decisions with tests.

Target Areas:

1. Label render cadence policies.
2. Post-processing feature gate decisions by quality/view.
3. Shadow/toggle policy seams already separated but missing edge tests.

Deliverables:

1. Expanded tests for renderer policy paths.
2. No change to rendering architecture.

Exit Criteria:

1. Deterministic gating behavior covered.
2. No functional regressions in existing policy tests.

### M4: Hardening and Sprint Close (1 day)

Objective:

Consolidate, verify, and document the new TDD flow.

Deliverables:

1. Final pass of `src/three` tests.
2. Sprint report: slices completed, residual risks, next backlog.
3. Follow-up backlog ranked by risk and extraction readiness.

Exit Criteria:

1. TDD protocol followed for all merged slices.
2. Stable test baseline captured.

## Prioritized Slice Backlog

1. S0 (P0): Fix jsdom ESM blocker for `src/three` test execution.
2. S1 (P0): Worldmap refresh token acceptance edge cases.
3. S2 (P0): Worldmap duplicate tile update refresh/invalidation matrix.
4. S3 (P0): Worldmap army selection recovery queue conditions.
5. S4 (P1): Worldmap prefetch queue processing guards under switch-off states.
6. S5 (P1): Army visibility rule extraction for source/destination bounds.
7. S6 (P1): Army movement stale-clear policy extraction.
8. S7 (P1): Structure visible refresh gating on ownership bucket transitions.
9. S8 (P2): Renderer label cadence policy extraction and tests.
10. S9 (P2): Quality/post-processing gate decision tests.

## Requirements

### Functional Requirements

1. Each cleanup slice introduces or updates tests before production changes.
2. Extracted policy modules remain side-effect free.
3. Existing behavior remains unchanged unless explicitly declared in slice scope.
4. All touched behaviors have targeted tests in same PR.

### Non-Functional Requirements

1. `src/three` test command executes reliably in local and CI environments.
2. No new flaky tests introduced.
3. Refactors preserve runtime performance characteristics in touched paths.
4. Documentation clearly defines the enforced TDD loop.

## Validation Matrix

1. Harness
   1. `src/three` tests run without environment-level errors.
2. Policy extraction
   1. New tests fail before implementation.
   2. New tests pass after implementation.
3. Regression
   1. Existing scene/manager policy tests remain green.
4. Behavioral confidence
   1. Chunk transitions, manager updates, and visibility decisions remain stable under existing test scenarios.

## Risks and Mitigations

1. Risk: Harness fix requires dependency graph changes with side effects.
   - Mitigation: keep fix minimal, verify with targeted `src/three` run first, then broader test sampling.
2. Risk: Over-extraction creates abstraction churn.
   - Mitigation: extract only pure decision seams with active call sites and immediate tests.
3. Risk: False confidence from weak assertions.
   - Mitigation: prefer table-driven behavior assertions over mock-call-count assertions.
4. Risk: Scope creep into architectural rewrite.
   - Mitigation: reject slices lacking deterministic seam and bounded acceptance criteria.

## Definition of Done

1. `pnpm --dir client/apps/game test src/three` is stable and free of environment crashes.
2. Planned P0/P1 slices are implemented via red-green-refactor with test evidence.
3. High-risk decision logic in worldmap and managers has expanded policy-level coverage.
4. PRD execution log is updated with outcomes and residual risks.

## Execution Log

| Date       | Milestone | Status    | Notes |
| ---------- | --------- | --------- | ----- |
| 2026-02-17 | M0        | Completed | `src/three` tests now run in `node` env via `environmentMatchGlobs`; fixed node-only test assumptions and hoisted mock issues; `pnpm --dir client/apps/game test src/three` passes (`24` files, `121` tests). |
| 2026-02-17 | M1        | In Progress | Slice S1 continued with red-green-refactor extraction of worldmap refresh and structure-update decisions into policy helpers (`resolveRefreshExecutionPlan`, `resolveRefreshRunningActions`, `resolveRefreshCompletionActions`, `shouldRequestTileRefreshForStructureBoundsChange`, `resolveStructureTileUpdateActions`) and wiring in `worldmap.tsx`; targeted and full `src/three` suites pass (`25` files, `138` tests). |
| 2026-02-17 | M2-M4     | Planned   | Next slices remain as defined in backlog and milestones. |
