# AI-First Harness Architecture

This document turns the repo review into a concrete target architecture for Eternum.

The goal is not "use more AI." The goal is to make the repository, delivery pipeline, and production feedback loops
legible enough that agents can do useful work safely and repeatedly.

## Why This Exists

The repo already has several strong building blocks:

- a monorepo with client, contracts, config, packages, and deploy tooling
- step-based launch automation in `config/deployer/clean`
- agent runtime foundations in `packages/game-agent`
- path-scoped Claude review workflows in `.github/workflows`

What is missing is the closed loop around those pieces.

Today, the repo has agent-assisted work. The target state is agent-operable engineering.

That means the system should be able to:

1. understand a change boundary
2. validate the change deterministically
3. deploy through explicit environments
4. observe production behavior
5. cluster and route failures
6. verify that a fix actually resolved the failure

## Current Gaps

### Validation Is Incomplete

- `test-client.yml` does not currently run the client test suite.
- The main game release flow is release-note automation, not a full promotion pipeline.
- Local smoke tooling exists for the game client, but it is not an active CI gate.

### AI Review Is Helpful But Not Yet Policy

- Claude review workflows and `pr-agent` provide useful analysis.
- They are not yet part of one deterministic pass/fail contract for shipping.

### Observability Is Fragmented

- The game client has Sentry, PostHog, and local tracing scaffolding.
- The repo does not yet encode one production health loop that reads those signals, clusters issues, and creates
  action-ready investigation work.

### Runtime Control Is Weak

- Feature control is still largely env-based or build-time boolean configuration.
- That is not enough for fast rollout, gradual exposure, fast kill, and measured rollback.

### Harness Patterns Are Unevenly Applied

- `config/deployer/clean` has strong naming, step boundaries, run-state persistence, and recovery semantics.
- Other parts of the repo still use older imperative flows or duplicate runtime/factory logic across apps.

## Architectural Principles

### 1. Agents Need Explicit Surfaces

Agents should work against named interfaces, not implied behavior.

Prefer:

- `validatePullRequest`
- `deployPreviewEnvironment`
- `runClientSmokeChecks`
- `collectProductionHealthSignals`
- `triageErrorClusters`
- `verifyIncidentResolution`

Avoid burying business meaning inside shell glue, one-off YAML branches, or app-specific inline logic.

### 2. One Workflow Per Responsibility

Each workflow should do one thing well:

- review
- validate
- deploy preview
- promote release
- canary verify
- triage production issues
- reconcile known operational drift

Do not mix release notes, tagging, deployment, smoke testing, and rollback decisions inside one opaque job.

### 3. Production Signals Must Be Machine-Readable

If agents are expected to diagnose and recover, logs and metrics must be structured, correlated, and queryable.

That includes:

- service name
- environment
- version or release id
- trace or correlation id
- user or session identifiers where appropriate
- stable error classification
- deployment linkage

### 4. The Repo Needs A Shared Operational Language

All major systems should speak the same lifecycle:

1. requested
2. validated
3. deployed to preview or staging
4. promoted
5. observed
6. triaged
7. resolved
8. verified

The clean deployer already moves in this direction. The rest of the repo should follow it.

## Target System

### 1. Source Of Truth Layers

The repo should expose five clear layers:

### Product Surfaces

- `apps/game`
- `apps/realtime-server`

These are user-facing or operator-facing products.

### Shared Runtime Packages

- `packages/*`

These should hold shared domain logic, world/factory resolution, typed contracts, and agent primitives whenever logic is
reused across products.

### Operational Control Plane

- `.github/workflows`
- `config/deployer/clean`
- `deploy/`

This layer defines how the system is reviewed, validated, released, promoted, recovered, and audited.

### Production Feedback Layer

This is only partially present today. The target state is a documented and automated layer that:

- ingests errors and health signals
- normalizes them into stable incident shapes
- stores triage context
- opens or updates issue records
- verifies fixes after deploy

### Agent Harness Layer

- `packages/game-agent`
- any future review, repair, and triage agents

This layer should consume the same shared runtime and control-plane interfaces as humans.

### 2. Pull Request Control Plane

Every PR should move through a predictable pipeline:

1. scope detection
2. static validation
3. targeted tests
4. browser and smoke validation where relevant
5. AI review passes
6. preview deployment for product surfaces
7. merge decision

### Required PR Checks

For client-facing changes:

- format
- lint
- typecheck
- targeted unit tests
- game build
- browser smoke or renderer smoke
- Claude review

For contracts/config/deployer changes:

- format
- typecheck where applicable
- contract tests
- targeted deployer tests
- Claude review

### AI Review Structure

AI review should be separated into three distinct responsibilities:

1. correctness and maintainability
2. security and trust boundaries
3. operational risk and rollout readiness

This repo already has the beginnings of path-scoped review. The next step is to make review outputs structured enough to
gate merges instead of only producing comments.

### 3. Deployment Control Plane

The deploy layer should promote immutable artifacts through explicit environments.

### Preview

For user-facing app changes, PRs should produce a preview environment automatically.

The preview environment should support:

- app smoke checks
- browser-based happy-path checks
- shareable URLs for human review
- version stamping for correlation with telemetry

### Production Promotion

Production deploy should be a separate promotion step, not a side effect of tagging.

The target release flow is:

1. build artifact once
2. validate artifact in preview
3. promote the exact artifact to production
4. run canary checks
5. either mark healthy or rollback

### Rollback

Rollback should be encoded as a first-class workflow.

That workflow should:

- identify the last healthy version
- restore traffic or static assets to that version
- record the rollback reason
- notify the feedback loop so the incident remains open until verified

### 4. Production Feedback Loop

This is the largest missing subsystem.

The target daily loop is:

1. collect production signals from each runtime surface
2. normalize them into stable error events
3. cluster similar failures
4. score severity and blast radius
5. create or update issues with evidence
6. link incidents to releases and previews
7. after a fix deploys, re-check the same cluster
8. auto-close only when the signal is actually gone

### Required Inputs

- Sentry events for client failures
- PostHog events for user and feature behavior
- structured server logs for backend services
- deploy metadata from preview and production workflows
- release ids surfaced in every runtime

### Required Outputs

- one health summary on a schedule
- one incident record per clustered problem
- one verification result per deployed fix

### 5. Runtime Feature Control

Feature rollout should move from env toggles toward operational controls.

The target feature-control model should support:

- enable for internal users only
- percentage rollout
- instant kill switch
- experiment or cohort attribution
- audit trail for who changed exposure and when

This does not need to start with a large platform migration, but the operational surface has to exist.

### 6. Shared Domain Boundaries

The repo should keep moving duplicated runtime logic into shared packages.

High-priority candidates:

- world discovery and normalization
- factory profile resolution
- manifest patching
- environment and release metadata
- incident and health event schemas

If game client and onchain agent need the same concept, the default assumption should be a shared package unless there
is clear product-specific behavior.

## Phased Migration Plan

### Phase 0: Stabilize The Existing Gates

Goal: stop shipping through weak validation paths.

Deliverables:

- re-enable client tests in `test-client.yml`
- add client typecheck and production build to PR validation
- wire the existing renderer or browser smoke checks into CI
- make one AI review check required for merge

Exit criteria:

- every client PR has a deterministic pass/fail validation path
- no release path bypasses build validation

### Phase 1: Create A Real Preview Pipeline

Goal: make app changes observable before production.

Deliverables:

- add a preview deployment workflow beside `deploy-client.yml` (the client ships to Cloudflare Pages)
- stamp preview builds with commit SHA and release metadata
- run smoke checks against preview URLs
- surface preview links directly on PRs

Exit criteria:

- user-facing changes have an automatically deployed preview
- preview verification is encoded, not manual

### Phase 2: Separate Release From Promotion

Goal: make production deploys deliberate and reversible.

Deliverables:

- split release-note generation from production promotion
- build once, promote once
- add canary verification after production deploy
- add rollback workflow with explicit last-known-good targeting

Exit criteria:

- production deploys are artifact promotions
- every production deploy has a verification result

### Phase 3: Build The Production Health Loop

Goal: turn observability into actionable work.

Deliverables:

- define a shared incident event schema
- add a scheduled health workflow
- cluster failures by stable signature
- open or update issues with evidence and release linkage
- re-check the same clusters after fixes land

Exit criteria:

- the repo can answer "what is broken in production right now?"
- incident verification is automatic after deploy

### Phase 4: Upgrade Runtime Control

Goal: make rollout and recovery fast enough to match agent implementation speed.

Deliverables:

- replace high-risk env toggles with runtime feature controls
- add percentage rollout and internal-only exposure
- log exposure decisions into telemetry
- connect rollout state to incident analysis

Exit criteria:

- features can be exposed, narrowed, or killed without rebuild-driven operations

### Phase 5: Generalize Harness Patterns Across The Repo

Goal: make the clean, step-based architecture the default.

Deliverables:

- continue migrating old deployer paths into `config/deployer/clean`
- centralize duplicated world and factory resolution logic
- define shared control-plane helpers for run state, leases, artifacts, and recovery
- standardize workflow naming and result shapes

Exit criteria:

- the top-level operational code reads like a checklist of intent
- recovery and rerun boundaries are explicit across subsystems

## What Good Looks Like

When this architecture is working, a normal change should look like this:

1. a PR is opened
2. scope detection chooses the right validation and review surfaces
3. AI review returns structured findings
4. preview deploy succeeds
5. smoke checks prove the preview is usable
6. merge promotes the same artifact
7. canary checks confirm production health
8. if something regresses, the incident loop opens or updates one issue with evidence
9. a fix lands and the same cluster is re-checked automatically
10. the issue closes only after the original signal is gone

## Near-Term Priorities For This Repo

If the team only does three things next, they should be:

1. strengthen PR validation for the client and make browser or smoke testing real
2. activate preview deployment as a first-class workflow
3. build the scheduled production health and triage loop

Those three changes would move the repo materially closer to the architecture described in the review, without requiring
a full platform rewrite first.

## Non-Goals

This plan does not assume:

- replacing human judgment
- turning every workflow into an agent workflow
- adding large platform complexity before validation is solid

The immediate goal is simpler:

make the system legible, deterministic, and recoverable enough that agents can participate safely at higher leverage.
