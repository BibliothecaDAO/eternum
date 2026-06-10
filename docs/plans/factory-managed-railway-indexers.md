# Factory Managed Railway Indexers

This document narrows the hosting work to the first practical step:

- keep ownership on our Railway account
- create Torii indexers on demand
- stop creating managed indexers through Slot
- leave user-owned hosting for a later phase

This is a smaller and better first move.

It changes the deployment backend without forcing us to solve user OAuth, user billing, provider account linking, or new
support flows all at once.

## Product Goal

Factory should be able to create and manage Torii indexers in Railway on our account instead of Slot.

The product shape stays managed:

- users still see a simple launch flow
- users do not connect Railway
- users do not own the Railway project
- Factory still treats hosting as managed infrastructure

What changes is the backend:

- Railway replaces Slot as the managed Torii host

## Why This First

The current system is deeply Slot-shaped in the indexer path:

- create indexer
- inspect live state
- update tier
- delete deployment

Those seams already exist in one place.

That means we can swap the provider behind the existing managed flow before we build the bigger user-owned product.

This gives us:

- a cleaner provider boundary
- Railway operational experience on our account
- a path to later user-owned hosting without rewriting the indexer flow twice

## Non-Goals

- user-owned hosting
- Railway OAuth
- billing handoff to users
- multi-cloud support
- self-hosted Katana or Slot replacement
- Factory UI changes that imply users own the provider account

## Required Product Behavior

From the user point of view, the product should still behave like managed hosting.

Launch flow:

- launching a game still creates a managed indexer
- users do not see provider-account setup

Watch flow:

- users can still see whether live data exists
- users can still see whether it is healthy
- users can still retry when the managed deployment fails

Admin/operator flow:

- create managed indexer
- inspect managed indexer state
- delete managed indexer
- later, optionally adjust managed sizing profiles

## Core Decision

Do not start by replacing the whole Factory UI.

Start by replacing the backend provider behind the managed hosting path.

The first code change should make this possible:

- `managed indexer` no longer means `Slot`
- `managed indexer` means `selected managed provider`

For this phase, the selected managed provider is Railway.

## Technical Direction

## 1. Introduce A Managed Indexer Provider Boundary

The current code hardcodes Slot-specific functions in the orchestration path.

We need a provider boundary with managed-hosting language.

Suggested shape:

```ts
interface ManagedIndexerProvider {
  ensureDeployment(request: IndexerRequest, options?: ManagedIndexerOptions): ManagedIndexerActionResult;
  resolveLiveState(name: string, options?: ManagedIndexerOptions): IndexerLiveState;
  resolveLiveStates(
    names: string[],
    options?: ManagedIndexerOptions,
  ): Array<{ gameName: string; liveState: IndexerLiveState }>;
  ensureTier?(options: EnsureManagedIndexerTierOptions): ManagedIndexerActionResult;
  deleteDeployment(options: DeleteManagedIndexerOptions): DeleteManagedIndexerResult;
}
```

First implementations:

- `SlotManagedIndexerProvider`
- `RailwayManagedIndexerProvider`

The orchestration layer should depend on the interface, not the Slot implementation.

## 2. Keep The Existing Indexer Request Shape Initially

The current `IndexerRequest` already contains the important Torii deployment inputs:

- environment
- RPC URL
- namespaces
- world name
- world address
- tier
- external contracts

That is enough to create a Railway-backed Torii deployment.

Do not expand the request shape immediately unless we need Railway-specific profile metadata.

If we need provider-specific metadata, prefer adding optional managed-hosting fields deliberately instead of leaking
Railway details upward.

## 3. Use Railway CLI For The First Managed Implementation

For the first pass, use Railway CLI rather than building directly on Railway GraphQL.

Why:

- the current Slot path already shells out to a CLI
- the Railway CLI already supports:
  - add service
  - set variables
  - add volume
  - add domain
  - redeploy
  - list deployments
- this is the fastest low-risk way to get a managed provider working on our account

This should be driven by explicit env configuration, not a local developer login.

## Railway Env Contract

The Railway provider should expect explicit env vars such as:

- `RAILWAY_API_TOKEN`
- `RAILWAY_WORKSPACE_ID`
- `RAILWAY_PROJECT_ID`
- `RAILWAY_ENVIRONMENT_ID`
- `RAILWAY_TORII_IMAGE`
- `RAILWAY_TORII_VOLUME_MOUNT_PATH`

Optional:

- `RAILWAY_TORII_PUBLIC_PORT`
- `RAILWAY_TORII_START_COMMAND`
- `RAILWAY_TORII_SMALL_PROFILE`
- `RAILWAY_TORII_STANDARD_PROFILE`
- `RAILWAY_TORII_LARGE_PROFILE`

The important rule is:

- managed Railway operations must work from env-backed auth in CI and worker contexts
- they must not depend on a developer having run `railway login`

## 4. Railway Service Shape

Each managed Torii deployment should create:

1. one Railway service named after the game
2. one attached volume mounted at a fixed path
3. one Railway-generated public domain

The service should be configured from the same Torii template inputs we already use today:

- `RPC_URL`
- `WORLD_ADDRESS`
- `TORII_NAMESPACES`
- `TORII_EXTERNAL_CONTRACTS`
- `WORLD_BLOCK`

The Torii config can still be rendered locally into `.context` for traceability, even if Railway consumes the values as
env vars or startup arguments.

## 5. Readiness Model

The managed provider still needs a live-state contract, even if Railway does not expose the same concepts as Slot.

We should keep the existing top-level state shape:

- `existing`
- `missing`
- `indeterminate`

But we should stop pretending Railway can report Slot-style tier metadata.

For Railway V1:

- `url` should map to the Railway domain
- `version` can map to the deployed image tag if available
- `branch` can be left undefined
- `currentTier` should only be set if we intentionally map Railway profiles back to the existing tier system

## 6. Tier Strategy

This is the hardest part of the swap.

Slot has built-in tier semantics today. Railway does not have the same product model.

So we need an explicit decision:

### V1 Recommendation

Treat Railway-managed indexers as single-profile managed deployments.

That means:

- create at one stable managed profile
- do not ship real automatic tier reconciliation in the first Railway migration
- keep the `set-tier` path as either:
  - a no-op with clear logging, or
  - a profile remap only if we have a credible Railway resource mapping

This is the right tradeoff.

Trying to preserve Slot tier semantics exactly on day one will slow the migration down for very little real user value.

### Follow-Up

After the provider swap works, we can decide whether to:

- map `basic/pro/legendary/epic` to Railway sizing presets
- or replace the current managed tier model with Railway-native profiles

## 7. Run Store Compatibility

Do not force a full artifact rewrite in the same step.

The first pass should preserve the current run-store contract where possible:

- `indexerCreated`
- `indexerTier`
- `indexerUrl`
- `indexerVersion`
- `indexerBranch`
- `lastIndexerDescribeAt`

For Railway:

- `indexerUrl` should be the Railway public domain
- `indexerVersion` can be the image tag or deployment identifier if available
- `indexerBranch` can remain undefined
- `indexerTier` should be optional until we choose a real mapping

If we need richer metadata, add it behind optional fields instead of breaking the existing watch surface first.

## Implementation Plan

## Phase 1: Provider Extraction

Extract the current Slot-specific code behind a managed provider interface.

Target files:

- `config/deployer/clean/indexing/slot-torii.ts`
- `config/deployer/clean/launch/runner.ts`
- `config/deployer/clean/cli/indexer-maintenance.ts`
- `config/deployer/clean/run-store/indexer-maintenance-updates.ts`
- `config/deployer/clean/types.ts`

Desired result:

- orchestration depends on a provider resolver
- Slot remains the default until Railway is ready

## Phase 2: Railway Provider

Add `RailwayManagedIndexerProvider` with CLI-backed operations:

- ensure deployment
- inspect live state
- delete deployment

Minimum creation flow:

1. link Railway project/environment in a temp working directory
2. create or reuse a service named after the game
3. attach a volume
4. set required variables
5. generate a Railway domain
6. trigger deploy or redeploy
7. verify endpoint availability

## Phase 3: Switch Managed Default

Once Railway provider works end to end:

- add a config switch for managed provider selection
- switch managed indexer creation from Slot to Railway
- keep Slot implementation available behind the provider boundary during rollout

Suggested config:

- `MANAGED_INDEXER_PROVIDER=slot|railway`

## Phase 4: Reconcile Tiering

After Railway-managed creation is stable:

- decide whether to remap current tier semantics
- or explicitly simplify managed indexer scaling to Railway profiles

Do not block the provider migration on this.

## Acceptance Criteria

- Managed indexer orchestration no longer depends directly on Slot-only functions.
- A Railway managed provider exists behind the shared provider boundary.
- Managed create-indexer flow can create a Torii service on Railway using env-backed account credentials.
- Managed inspect flow can report whether a Railway-backed indexer exists and expose its public URL.
- Managed delete flow can remove a Railway-backed indexer.
- Existing watch and run-store flows continue to work without a full UI rewrite.
- Slot remains available as a fallback during rollout.

## Risks

### Tier Drift

The current tier model is Slot-shaped. If we do not decide how Railway maps to it, scheduled tier maintenance becomes
misleading.

That is why the initial recommendation is to migrate provider first and tier semantics second.

### CLI Output Stability

Using Railway CLI is fast, but it creates a dependency on CLI behavior and output shape.

Mitigation:

- keep parsing narrow
- prefer commands with explicit JSON output where available
- keep the provider boundary clean so we can move to direct API calls later

### Naming Collisions

Railway service naming needs to be deterministic and safe for repeated deploys.

We should use the game name as the logical identity and normalize it once in shared code.

### Partial Failure

Provider operations can fail after creating some resources.

We need:

- clear error messages
- enough metadata to retry safely
- a deletion path that can clean up partial deployments

## Recommendation

Build this as:

1. managed-provider seam
2. Railway managed provider
3. managed provider switch
4. later user-owned hosting

That keeps the code honest and lets us learn Railway operations on our account before we expose provider ownership to
users.
