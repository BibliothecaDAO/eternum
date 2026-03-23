# Factory Wiring Plan

This document turns the current Factory V2 direction into a concrete wiring plan.

The product goal stays simple:

- one-click full deployment by default
- exact step visibility while it runs
- exact step recovery when something fails

The implementation goal is to separate:

- what the UI shows
- what the run engine knows
- what GitHub Actions executes

## Core Rule

The UI should not think in workflow files.

The UI should think in runs and steps.

The run engine should translate those steps into workflow phases, workflow reruns, contract reads, and external checks.

## Run Model

Each deployment should become one `FactoryRun`.

```ts
interface FactoryRun {
  id: string;
  mode: "blitz" | "eternum";
  network: "slot" | "mainnet";
  gameName: string;
  presetId: string;
  status: "pending" | "running" | "waiting" | "attention" | "complete";
  createdAt: string;
  updatedAt: string;
  currentStepId: string | null;
  steps: FactoryStep[];
  artifacts: FactoryRunArtifacts;
}
```

```ts
interface FactoryStep {
  id: string;
  kind: string;
  status: "pending" | "running" | "succeeded" | "already_done" | "blocked" | "failed";
  phaseId: string;
  workflowName: string;
  summary: string;
  latestEvent: string;
  errorKind: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
}
```

## What Counts As A Step

A step should be a user-meaningful unit that can be:

- shown in the UI
- retried safely
- verified independently

A step should not be:

- a random shell script
- a vague "do post launch"
- a whole workflow with several unrelated failure modes hidden inside it

## Logical Step Graph

These are the steps the UI should show and the reconciler should reason about.

### Shared Launch Steps

These exist in both game modes.

1. `create_world`
2. `wait_for_factory_index`
3. `apply_world_config`
4. `create_or_reuse_indexer`

### Blitz Steps

1. `create_world`
2. `wait_for_factory_index`
3. `apply_world_config`
4. `create_or_reuse_indexer`
5. `sync_paymaster_policy`
6. `publish_ready_state`

### Eternum Steps

1. `create_world`
2. `wait_for_factory_index`
3. `apply_world_config`
4. `create_or_reuse_indexer`
5. `wait_for_indexer_readiness`
6. `grant_village_pass_role`
7. `create_banks`
8. `publish_ready_state`

## Phase Graph

Logical steps are what the UI sees.

Execution phases are how we keep one-click deployment fast.

One phase may execute one or more logical steps. The reconciler must still record step-level outcomes inside that phase.

### Blitz Phases

#### `phase_1_world_bootstrap`

- `create_world`
- `wait_for_factory_index`

#### `phase_2_configure_world`

- `apply_world_config`
- `create_or_reuse_indexer`

#### `phase_3_open_blitz`

- `sync_paymaster_policy`
- `publish_ready_state`

### Eternum Phases

#### `phase_1_world_bootstrap`

- `create_world`
- `wait_for_factory_index`

#### `phase_2_configure_world`

- `apply_world_config`
- `create_or_reuse_indexer`
- `wait_for_indexer_readiness`

#### `phase_3_open_eternum`

- `grant_village_pass_role`
- `create_banks`
- `publish_ready_state`

## Why Hybrid Instead Of Step-Per-Workflow Only

Step-per-workflow-only is clean, but it adds GitHub Actions dispatch overhead on every step.

Pure monolithic workflows are faster, but they make recovery ugly.

The hybrid shape gives both:

- one-click speed from grouped phases
- step-level visibility from the reconciler
- step-level recovery when a phase fails halfway through

## Step Rules

Each step must expose:

- desired state
- reconciliation check
- act function
- verification check
- success normalization

### `create_world`

Desired state:

- a factory deployment exists for this run
- the world address is known

Already-done cases:

- deployment already completed
- world already registered for this deployment identity

Blocking cases:

- wrong deployment identity
- mismatched config snapshot

### `wait_for_factory_index`

Desired state:

- the world is visible from the factory read path with the data needed for downstream steps

Already-done cases:

- world row and required selectors already visible

Blocking cases:

- deployment succeeded but index never resolves within timeout

### `apply_world_config`

Desired state:

- immutable config snapshot applied for this run

Already-done cases:

- same snapshot already applied

Blocking cases:

- different snapshot already applied

### `create_or_reuse_indexer`

Desired state:

- the run has a healthy indexer endpoint

Already-done cases:

- existing indexer is healthy and points at the same world

Blocking cases:

- existing indexer conflicts with the requested world

### `wait_for_indexer_readiness`

Desired state:

- indexer serves the data needed for follow-up steps

Already-done cases:

- readiness probe already passes

Blocking cases:

- indexer exists but never becomes queryable

### `sync_paymaster_policy`

Desired state:

- live paymaster policy matches desired policy

Already-done cases:

- no diff

Blocking cases:

- policy sync repeatedly fails verification

### `grant_village_pass_role`

Desired state:

- `realm_internal_systems` has the required role on `villagePass`

Already-done cases:

- role already granted

Blocking cases:

- wrong target contract
- wrong admin credentials

### `create_banks`

Desired state:

- expected Eternum banks exist with the expected layout

Already-done cases:

- all expected banks already exist

Blocking cases:

- partial conflicting bank layout

### `publish_ready_state`

Desired state:

- run marked complete and visible in the UI as ready

Already-done cases:

- run already published as ready

Blocking cases:

- required upstream steps not verified

## Reconciler Contract

The reconciler should expose only a few operations:

- `createRun(request)`
- `getRun(runId)`
- `continueRun(runId)`
- `retryStep(runId, stepId)`
- `refreshRun(runId)`

### `continueRun`

Used by the normal one-click flow.

Behavior:

1. load run
2. find the first incomplete logical step
3. reconcile it
4. if already satisfied, mark it and continue
5. if work is needed, dispatch the phase that owns it
6. observe phase result
7. update all affected logical steps
8. stop when blocked or complete

### `retryStep`

Used only after failure or blockage.

Behavior:

1. load run
2. load target step
3. reconcile target step
4. if already satisfied, mark `already_done`
5. otherwise dispatch only the phase logic needed for that step
6. verify and update

## Workflow Structure

The GitHub layer should move to:

- one orchestrator workflow per run
- reusable phase workflows
- optional direct step recovery workflows

### Candidate Workflow Files

- `factory-v2-orchestrate.yml`
- `factory-v2-phase-world-bootstrap.yml`
- `factory-v2-phase-configure-world.yml`
- `factory-v2-phase-open-blitz.yml`
- `factory-v2-phase-open-eternum.yml`

Optional recovery workflows if needed:

- `factory-v2-step-create-world.yml`
- `factory-v2-step-apply-world-config.yml`
- `factory-v2-step-create-indexer.yml`
- `factory-v2-step-sync-paymaster.yml`
- `factory-v2-step-grant-village-pass.yml`
- `factory-v2-step-create-banks.yml`

## What The UI Should Show

The UI should stay extremely simple.

### Start A Game

- choose mode
- choose network
- choose preset
- enter game name
- launch

### Check A Game

- enter or pick game name
- see one status card
- see one primary action
- optionally reveal details

When the run is healthy, the UI should not expose phase names or CI jargon.

When the run fails, the UI should reveal:

- which logical step failed
- whether retry is safe
- one clear retry action

## Suggested Build Order

1. Freeze the logical step graph in code.
2. Build the `FactoryRun` and `FactoryStep` types.
3. Build the reconciler interfaces before workflow rewrites.
4. Implement Blitz first.
5. Use Blitz to prove:
   - one-click full deploy
   - step-level recovery
   - already-done normalization
6. Implement Eternum on the same run engine.
7. Rewrite workflows into phase-based reusable workflows.
8. Replace mock UI data with reconciler-backed data.

## Immediate Next Build Tasks

- [ ] Define `FactoryRun` and `FactoryStep` in code
- [ ] Define the logical step ids as constants
- [ ] Implement a run repository interface
- [ ] Implement a GitHub Actions dispatch/watch adapter
- [ ] Implement a factory contract read adapter
- [ ] Implement Blitz reconciler logic
- [ ] Wire the current V2 UI to `getRun` and `continueRun`
- [ ] Add step-level retry for blocked runs
- [ ] Add Eternum-only adapters and steps
