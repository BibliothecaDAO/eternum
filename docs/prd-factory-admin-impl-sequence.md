# PRD: Factory Admin Redesign and Dashboard Migration

- Status: Draft
- Owner: Game Client Team
- Last Updated: February 11, 2026
- Primary Area: `client/apps/game/src/ui/features/admin/pages/factory.tsx`

## 1. Problem Statement

The current Factory Admin experience is difficult to iterate on because UX, orchestration, and world-specific config
state are tightly coupled in a single page component. This slows down design iteration, increases regression risk, and
makes it hard to add new configuration controls safely.

The desired product outcome is a milestone-based rollout:

1. Clean up the form and add more config customization while preserving reliable deploy/configure flows.
2. Move Factory Admin into the main dashboard experience.

## 2. Goals and Non-Goals

### Goals

1. Improve usability and maintainability of Factory Admin without breaking game deploy flows.
2. Support broader per-world configuration customization with validation.
3. Provide a clear, low-risk implementation sequence with explicit go/no-go gates.
4. Integrate Factory Admin into the main dashboard after Milestone 1 is stable.

### Non-Goals

1. Rewriting onchain deployer/config contracts.
2. Redesigning the entire landing/dashboard information architecture in this effort.
3. Changing production gameplay systems unrelated to factory deploy/config UX.

## 3. Current State Summary

### Product / UX Issues

1. Single screen combines queueing, deployment, per-world config, and indexer setup.
2. Advanced controls are discoverable only in dense in-row panels.
3. Global and per-world tx states are mixed, which can create confusing UI feedback.

### Technical Issues

1. `factory.tsx` is monolithic (~2k LOC), with mixed concerns.
2. Per-world overrides are spread across many `Record<string, ...>` states, making extension error-prone.
3. Several dead/unused states and handlers increase complexity.
4. Existing reliability risks:
   - list item keyed by array index in queue rendering
   - provider cleanup scope issue in config error path
   - status refresh effect tied to `length` only

## 4. Personas and Use Cases

1. Live Ops Admin: quickly deploys worlds, sets critical config, creates indexers.
2. Competitive Ops Admin: customizes season/blitz parameters per world before launch.
3. Dev/QA Admin: runs frequent test deployments with temporary config overrides.

## 5. Product Requirements

### Milestone 1: Form Cleanup + Expanded Config

#### Functional Requirements

1. Keep current deploy path working end-to-end: queue -> deploy -> configure -> indexer.
2. Replace fragmented override state with typed per-world override model.
3. Add validation and error messaging before transaction submission.
4. Expand configurable fields (at minimum):
   - season timing and grace windows
   - blitz registration timing and economic controls
   - settlement controls
   - battle/trade controls
   - optional advanced sections for MMR, victory points, and agent limits
5. Provide an "effective config" preview for a selected world (base + overrides).

#### UX Requirements

1. Separate workflow sections clearly:
   - queue/deploy
   - per-world configure
   - advanced/dev tools
2. Keep default path minimal and safe; put advanced config behind explicit expansion.
3. Show deterministic per-world action state (idle/running/success/error) for each action type.

#### Reliability Requirements

1. No regressions in existing deploy/config/indexer actions.
2. Validation blocks invalid numeric/time/address inputs before tx execution.
3. Error path leaves UI in recoverable state (no stuck "running").

### Milestone 2: Move Factory into Main Dashboard

#### Functional Requirements

1. Factory Admin becomes accessible from the main dashboard navigation (admin-gated).
2. Existing standalone route remains as temporary fallback until post-migration validation.
3. Bootstrap behavior is adjusted so dashboard-embedded admin does not trigger unnecessary game bootstrap flows.

#### UX Requirements

1. Embedded admin view matches landing/dashboard interaction model.
2. Mobile and desktop navigation states remain consistent.
3. Access control is explicit (feature flag and/or admin allowlist policy).

## 6. Implementation Sequence

## Phase 0: Stabilization Prep (small, low-risk)

1. Fix known reliability issues in current page.
2. Remove dead state/handlers where safe.
3. Add basic coverage for critical existing flows before structural refactor.

Exit Criteria:

1. Existing behavior unchanged for happy paths.
2. Known reliability issues above resolved.

## Phase 1A: Structural Refactor (no behavior change target)

1. Split `FactoryPage` into feature subcomponents:
   - header/status shell
   - queue/deploy list
   - per-world config panel
   - dev/advanced section
2. Extract orchestration hooks:
   - queue/status hook
   - transaction/action hook
   - world override model hook
3. Keep service boundaries in `services/` and storage interactions in `utils/storage.ts`.

Exit Criteria:

1. Parity with pre-refactor UX/behavior.
2. Reduced main page size and lower prop/state coupling.

## Phase 1B: Config Model + Validation + Expansion

1. Introduce typed `WorldConfigOverrides` model.
2. Add schema-based validation (input-level + submit-level).
3. Implement expanded configurable fields with chain-aware defaults/availability.
4. Add effective config preview panel for selected world.

Exit Criteria:

1. Admin can set and save required override fields without tx failures caused by invalid local input.
2. Expanded fields correctly map to deployer config payload.

## Phase 1C: Hardening + QA Gate

1. Add/expand tests:
   - unit tests for override merge + validation
   - interaction tests for queue/deploy/config key flows
2. Perform manual validation matrix on target chains/environments.
3. Add telemetry/logging around failure points for faster rollback diagnosis.

Exit Criteria (Milestone 1 Complete):

1. Deploy + configure + indexer flows pass QA matrix.
2. No blocker regressions.
3. Team signs off migration readiness for Milestone 2.

## Phase 2A: Dashboard Entry + Routing

1. Add Factory Admin entry in main dashboard navigation model.
2. Introduce admin gating rules and fallback UI for unauthorized users.
3. Keep standalone `/factory` route enabled for safety during rollout.

Exit Criteria:

1. Authorized users can access the admin flow from dashboard.
2. Unauthorized users cannot access controls.

## Phase 2B: Bootstrap/Runtime Integration

1. Update bootstrap skip logic to support dashboard-embedded admin mode.
2. Ensure dashboard context does not trigger unnecessary world bootstrap work while on admin view.
3. Validate wallet/controller behavior and tx permissions in embedded path.

Exit Criteria:

1. Embedded admin mode is functionally equivalent to standalone mode.
2. No measurable landing/dashboard performance regressions.

## Phase 2C: Cleanup + Route Consolidation

1. Monitor embedded usage and error rates.
2. If stable, deprecate standalone entry path (or keep as explicit internal fallback).
3. Finalize documentation and ops runbook.

Exit Criteria (Milestone 2 Complete):

1. Main dashboard is primary entry for Factory Admin.
2. Operational fallback plan documented.

## 7. Acceptance Criteria

### Milestone 1 Acceptance

1. Admin can deploy new world from queue and complete configuration without manual code changes.
2. Newly added config fields are editable, validated, and applied correctly.
3. UI state for each world action is deterministic and independently visible.

### Milestone 2 Acceptance

1. Admin can access Factory controls from dashboard navigation.
2. Embedded flow has parity with standalone flow for core actions.
3. Bootstrap and navigation side effects are controlled and documented.

## 8. Testing Strategy

1. Unit:
   - override schema validation
   - base+override merge logic
   - chain-specific fallback logic
2. Component/Integration:
   - queue item actions
   - per-world configure submit and error handling
   - expanded form field validation states
3. Manual E2E:
   - deploy -> verify deployment -> configure -> create indexer
   - repeated deploy attempts and cancellation
   - dashboard-embedded access + fallback route behavior

## 9. Rollout Plan

1. Ship Milestone 1 behind an internal/admin feature flag.
2. Run parallel validation between old and new paths in staging.
3. Enable Milestone 2 dashboard entry for internal users first.
4. Promote to full admin audience after 1-2 stable release cycles.

## 10. Risks and Mitigations

1. Risk: Regression in deploy/config transaction sequencing.
   - Mitigation: phase-gated refactor with parity checks and focused tests.
2. Risk: Invalid config combinations across chain environments.
   - Mitigation: chain-aware validation + effective config preview.
3. Risk: Dashboard migration introduces bootstrap/perf side effects.
   - Mitigation: explicit route/view-mode checks and perf smoke tests.

## 11. Dependencies

1. Existing deployer config functions in `config/deployer/config.ts`.
2. Factory admin services/hooks (`services/`, `hooks/`, `utils/storage.ts`).
3. Landing/dashboard navigation and bootstrap logic.

## 12. Open Questions

1. What exact admin gating policy should be used in production (allowlist, role check, env flag combination)?
2. Which expanded config fields are mandatory for Milestone 1 vs deferred to post-M1 hardening?
3. Should standalone `/factory` remain permanently as internal fallback?

## 13. Suggested PR Breakdown

1. PR-1: Stabilization fixes + dead code cleanup + baseline tests.
2. PR-2: Component/hook refactor with behavior parity.
3. PR-3: Typed override model + validation + expanded config fields.
4. PR-4: QA hardening + telemetry.
5. PR-5: Dashboard integration + admin gating + bootstrap adjustments.
6. PR-6: Consolidation and docs updates.
