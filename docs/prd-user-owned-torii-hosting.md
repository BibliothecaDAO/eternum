# PRD: User-Owned Torii Hosting And Factory Integration

## Problem

Today, running Eternum infrastructure in the cloud is still operator-centric.

The current system assumes a centralized control plane:

- world launch is driven by GitHub Actions
- indexer lifecycle is managed through `slot`
- protected operations are routed through the worker and admin secrets
- users do not directly own or pay for their infrastructure

That works for shipping games, but it creates three product problems:

1. a user cannot launch their own indexer with one obvious action
2. billing and service ownership stay with us instead of the user
3. Factory still behaves like an operator console in the places where hosting matters

For users who want their own world, their own endpoint, and their own bill, this is the wrong shape.

## Opportunity

We can separate the problem into two parts:

1. `Torii` hosting
2. `Slot` execution and operator control

`Torii` is the right first wedge.

It is already a standalone service in the repo, its config is explicit, and it can run with a persistent local data
directory. That makes it a clean candidate for user-owned deployment on a cloud product such as Railway.

This means we can deliver something useful and real before attempting a deeper migration of the full Slot-backed
runtime.

## Product Goal

Let a user launch and own a production Torii deployment for their game with one clear flow inside Factory.

The user should be able to:

- choose a game or world
- choose a hosting provider
- connect their account
- deploy Torii into their own cloud account
- see deployment progress in Factory
- get a working endpoint they own and pay for

Factory should stay calm and intent-first. This should feel like "add live data hosting to my game", not "operate an
indexer fleet."

## Why Now

This unlocks a meaningful decentralization step without requiring a full rewrite of the world launch system.

It changes the ownership boundary in a way users care about:

- they pay directly
- they can see the infra in their own dashboard
- they can redeploy or delete it later
- the endpoint is no longer implicitly tied to our operator account

This also gives us a cleaner architecture for future provider expansion.

## Goals

- Users can deploy a Torii instance into their own Railway account from Factory.
- Users can pay Railway directly for that deployment.
- Factory shows deployment progress and the resulting endpoint clearly.
- Factory stores provider metadata and health state for each hosted indexer.
- Existing Slot-managed indexer flows continue to work during migration.
- The system supports at least two hosting modes:
  - `Managed by Eternum`
  - `Owned by you`

## Non-Goals

- Replacing the current Slot-based world launch system in V1
- Replacing the current mainnet or Slot factory orchestration in V1
- Shipping a generic multi-cloud marketplace in V1
- Full bring-your-own-cloud or Kubernetes support in V1
- Fully decentralized execution infrastructure in V1
- Letting arbitrary third-party providers plug in through a public interface in V1

## Users

### Primary User

An advanced player, guild operator, modder, tournament host, or community operator who wants their own live data
endpoint and is comfortable connecting a cloud account.

### Secondary User

An internal operator or admin who needs to:

- observe whether a user-owned deployment exists
- understand which provider owns it
- see whether it is healthy
- fall back to managed hosting when needed

## Jobs To Be Done

### User Job

"When I launch or manage a game, I want to attach my own live data service so I control the endpoint and the bill."

### Operator Job

"When I look at a game in Factory, I want to know who owns the indexer, where it lives, whether it is healthy, and what
action is available next."

## Current State Summary

The active flow already has the right system seams for a provider abstraction:

- run orchestration lives in the clean deployer
- indexer create/update/delete logic is centralized
- Factory V2 already has a watch surface and an indexer-management workspace
- live indexer snapshots and protected actions already exist

Relevant files today:

- [runner.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/config/deployer/clean/launch/runner.ts)
- [slot-torii.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/config/deployer/clean/indexing/slot-torii.ts)
- [indexer-maintenance.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/config/deployer/clean/cli/indexer-maintenance.ts)
- [factory-v2.md](/Users/os/conductor/workspaces/eternum/zurich-v5/docs/plans/factory-v2.md)
- [factory-v2-manage-indexers-workspace.tsx](/Users/os/conductor/workspaces/eternum/zurich-v5/client/apps/game/src/ui/features/factory-v2/components/factory-v2-manage-indexers-workspace.tsx)
- [factory-worker.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/client/apps/game/src/ui/features/factory-v2/api/factory-worker.ts)
- [torii-template.toml](/Users/os/conductor/workspaces/eternum/zurich-v5/contracts/game/torii-template.toml)

## Product Direction

The right V1 product is:

- keep world launch where it is
- make Torii hosting provider-aware
- let the user choose user-owned Railway hosting from Factory
- keep managed hosting as the fallback and migration path

This is the whole game.

Do not block this on a bigger "decentralize all infrastructure" story.

## User Experience

## Entry Points

The user can start this flow from two places:

1. during game launch in Factory
2. from the existing "manage indexers" workspace for an already-created game

### Launch-Time Flow

When the user launches a game, Factory should include an explicit hosting choice.

New section in the start flow:

- `Live data hosting`

Options:

- `Managed by Eternum`
- `Owned by you (Railway)`

When the user picks `Managed by Eternum`:

- behavior stays close to the current managed indexer flow

When the user picks `Owned by you (Railway)`:

- Factory asks the user to connect Railway
- Factory explains in plain language:
  - "This deploys Torii into your Railway account"
  - "Railway bills you directly"
  - "You can manage or delete it from Railway later"

### Post-Launch Flow

Inside the watch surface for a game, the user should see a single hosting card.

It should answer:

1. Who owns the live data service?
2. Is it healthy?
3. What can I do next?

Card states:

- `No live data service`
- `Managed by Eternum`
- `Owned by you`
- `Deploying`
- `Needs attention`
- `Healthy`

Primary actions:

- `Connect Railway`
- `Deploy Torii`
- `Open endpoint`
- `Open in Railway`
- `Retry deployment`
- `Switch to managed hosting`

Secondary actions:

- `Refresh`
- `Show details`
- `Delete deployment`

## Factory Changes

Factory needs product changes, not just backend wiring.

The current V2 direction is already correct:

- simple launcher
- simple watch surface
- hide operator detail by default

This hosting work should reinforce that, not regress it.

### New Factory Concept: Hosting Owner

Every game should expose one hosting ownership state:

- `managed`
- `user-owned`

This state should be visible in both start and watch paths.

### Start Flow Changes

Add a hosting chooser to the dominant launch card.

The launch card should show:

- game type
- environment
- setup
- live data hosting choice
- one main launch action

If the user chooses Railway:

- show a compact "Connected to Railway" state if already authorized
- otherwise show `Connect Railway`
- show a short estimated resource profile:
  - `small`
  - `standard`
  - `large`

We should not expose raw cache and memory knobs in V1. The user should pick a profile, not a wall of infrastructure
settings.

### Watch Flow Changes

The watch flow should include a dedicated hosting card beneath the main status card.

The card should include:

- ownership label
- provider label
- deployment status
- last checked time
- public endpoint URL
- provider dashboard link
- current plan/profile
- health summary

If the deployment is unhealthy, the top-level copy should stay plain:

- `Live data is not responding`
- `Deployment is still starting`
- `Connection to Railway needs to be refreshed`

Avoid workflow jargon here.

### Manage Indexers Workspace Changes

The current manage-indexers workspace assumes an admin/operator posture.

We need to split it conceptually into two cases:

1. protected operator actions for managed hosting
2. user-owned hosting management for user-owned deployments

For user-owned deployments, this workspace should stop looking like a secret-backed operator surface.

Instead it should show:

- provider
- owner
- endpoint
- health
- actions available through the provider integration

Protected actions such as force-delete or emergency migration can still exist, but they should sit in an explicit admin
section, not in the normal user-owned flow.

## Functional Requirements

## V1 Scope

V1 supports one user-owned provider:

- Railway

V1 supports one user-owned workload:

- Torii only

V1 supports these user actions:

1. connect Railway
2. deploy Torii into a Railway project
3. see deployment progress
4. retrieve the public endpoint
5. open the Railway dashboard
6. refresh health status
7. retry failed deployment
8. delete the deployment from Factory

V1 supports these operator actions:

1. see whether a game uses managed or user-owned hosting
2. inspect provider metadata
3. move a game back to managed hosting if needed

## Authentication And Account Linking

The system must support a Railway account connection flow.

Requirements:

- user can authorize Eternum against Railway
- authorization is stored server-side
- Factory knows whether the current user has a live Railway connection
- Factory can select a target workspace or project location
- Factory can revoke or refresh the connection

If auth expires, Factory should clearly say so and offer reconnection.

## Deployment

The system must be able to create a Railway-backed Torii deployment from Factory.

The deployment should provision:

- a Torii service
- a persistent volume
- required environment variables
- a public URL

Minimum deployment inputs:

- world name
- world address
- RPC URL
- namespaces
- external contracts
- world block
- deployment profile

The deployment should be associated with the Factory run record.

## Health And Readiness

The system must track:

- deployment requested
- deployment provisioning
- Torii process started
- public endpoint available
- readiness passed

Health checks should distinguish:

- not yet provisioned
- provisioning
- running but not ready
- ready
- failed
- unknown

## Persistence

The system must persist provider metadata per deployment.

Required fields:

- hosting ownership mode
- provider id
- provider project id
- provider service id
- provider environment id
- provider volume id, if present
- dashboard URL
- public endpoint URL
- profile
- deployment status
- created at
- last checked at

## Deletion

The user must be able to delete their Railway-backed deployment from Factory.

Deletion behavior:

1. confirm destructive action
2. delete remote resources
3. update Factory state
4. preserve audit metadata in run history

If remote deletion partially fails, the system should preserve enough metadata for retry and support.

## Provider Model

We need to stop hardcoding Slot as the only backend.

### New Abstraction

Introduce a provider boundary around indexer hosting.

Example shape:

```ts
interface IndexerHostingProvider {
  ensureDeployment(request: EnsureIndexerDeploymentRequest): Promise<EnsureIndexerDeploymentResult>;
  getDeployment(request: GetIndexerDeploymentRequest): Promise<IndexerDeploymentState>;
  deleteDeployment(request: DeleteIndexerDeploymentRequest): Promise<DeleteIndexerDeploymentResult>;
  refreshHealth(request: RefreshIndexerHealthRequest): Promise<IndexerDeploymentState>;
}
```

Initial implementations:

- `SlotIndexerHostingProvider`
- `RailwayIndexerHostingProvider`

This keeps orchestration code speaking in product terms:

- ensure deployment
- refresh health
- delete deployment

instead of provider terms:

- call `slot`
- call Railway API

### Ownership Model

The hosting provider and the hosting owner are not the same thing.

We need both fields:

- `provider`
- `ownershipMode`

Example:

- provider: `slot`, ownership mode: `managed`
- provider: `railway`, ownership mode: `user-owned`

This matters because a future provider could still be managed by us, or a future Slot-compatible path could become
user-owned.

## Railway Product Design

## Railway Deployment Shape

Each user-owned deployment should create:

1. a Torii service
2. one persistent volume mounted to the service
3. one public domain

Environment variables should include:

- `RPC_URL`
- `WORLD_ADDRESS`
- `TORII_NAMESPACES`
- `TORII_EXTERNAL_CONTRACTS`
- `WORLD_BLOCK`
- `TORII_PROFILE`

The Torii template should map profile to runtime defaults such as:

- cache size
- concurrency
- polling interval

This should not require the user to edit raw TOML in V1.

## Deployment Profiles

V1 should expose three profiles:

- `Small`
- `Standard`
- `Large`

These should map to different runtime settings and provider resource presets.

Why:

- current repo configs already imply different resource shapes for Slot and mainnet
- users should not guess infrastructure numbers
- support becomes easier when the surface is opinionated

## Factory And Run Store Changes

## Run Record Changes

Add hosting metadata to game and series game artifacts.

Suggested shape:

```ts
interface HostedIndexerArtifact {
  ownershipMode: "managed" | "user-owned";
  provider: "slot" | "railway";
  deploymentStatus:
    | "not_requested"
    | "requested"
    | "provisioning"
    | "starting"
    | "ready"
    | "failed"
    | "deleting"
    | "deleted";
  profile?: "small" | "standard" | "large";
  endpointUrl?: string;
  dashboardUrl?: string;
  providerProjectId?: string;
  providerServiceId?: string;
  providerEnvironmentId?: string;
  providerVolumeId?: string;
  createdAt?: string;
  lastCheckedAt?: string;
  errorMessage?: string;
}
```

This artifact should sit beside the existing indexer artifacts, then eventually replace the Slot-only shape once the
migration is complete.

## Worker/API Changes

We will need user-scoped provider endpoints in addition to admin-scoped protected endpoints.

New categories:

- auth endpoints
- user-owned deployment endpoints
- deployment status endpoints

Examples:

- `POST /hosting/railway/connect/start`
- `POST /hosting/railway/connect/callback`
- `POST /hosting/deployments`
- `GET /hosting/deployments/:id`
- `POST /hosting/deployments/:id/refresh`
- `DELETE /hosting/deployments/:id`

Admin-only routes remain for managed infrastructure actions.

## Launch Flow Changes

When a game is created, the launch request should optionally include hosting intent.

Suggested new launch field:

```ts
type IndexerHostingIntent =
  | { mode: "managed" }
  | { mode: "user-owned"; provider: "railway"; profile: "small" | "standard" | "large" };
```

Launch behavior:

- if `managed`, preserve current indexer creation behavior
- if `user-owned`, create the world as normal, then create the Railway deployment using resolved world metadata

This means the world launch and the Torii deployment become related but distinct steps.

## New Factory Step Language

For user-owned hosting, the step copy should stay user-centered.

Prefer:

- `Preparing live data`
- `Connecting your Railway account`
- `Creating your Torii deployment`
- `Waiting for live data to come online`
- `Live data is ready`

Avoid:

- `Dispatch Railway provider mutation`
- `Create remote service`
- `Provision volume`

That detail belongs in expanded logs only.

## Rollout Plan

## Phase 0: Provider Seams

Create the provider abstraction and reshape stored artifacts.

Deliverables:

- provider interface
- Slot implementation moved behind it
- run-store artifact updates
- UI state model updated to speak in hosting terms

## Phase 1: Railway Template

Ship a Railway-ready Torii template and a manual handoff flow.

Deliverables:

- Railway deployable Torii image
- provider config contract
- public template
- manual "Deploy on Railway" handoff from Factory

This is the fastest way to validate demand.

## Phase 2: Connected Railway Flow

Add Railway OAuth and in-product provisioning.

Deliverables:

- connect account flow
- workspace selection
- create service, volume, and URL
- deployment progress in Factory

This is the first true one-click release.

## Phase 3: Full Factory Integration

Make user-owned hosting feel native in launch and watch flows.

Deliverables:

- hosting choice in start flow
- hosting card in watch flow
- user-owned manage-hosting workspace
- migration between managed and user-owned modes

## Phase 4: Additional Providers And Deeper Decentralization

Evaluate:

- Northflank
- bring-your-own-cloud
- self-hosted world runtime bundles

This is where broader infrastructure sovereignty work belongs.

## Risks

### Product Risk

Users may say they want "decentralization" but only a subset will actually connect a cloud account and pay for it.

That is why the Railway template phase matters. It is the cheapest way to validate whether people really want this badly
enough to act.

### Support Risk

User-owned infra creates a new support shape:

- provider auth failures
- quota issues
- billing issues
- deleted resources
- expired connections

Factory needs support-friendly state and diagnostics from day one.

### Operational Risk

Stateful Torii hosting means:

- one volume
- no horizontal replication on the same service shape
- short downtime during redeploy

That is acceptable for V1, but it should be explicit.

### Scope Risk

Trying to decentralize Slot execution in the same project would turn a good wedge into an ocean.

Do not do that in this PRD.

## Success Metrics

### Adoption

- percentage of eligible games with user-owned hosting selected
- number of Railway account connections created
- number of user-owned Torii deployments created

### Activation

- percentage of Railway-connected users who complete deployment
- median time from connect to healthy endpoint
- percentage of deployments healthy within target time

### Reliability

- deployment success rate
- health-check pass rate after 1 hour
- delete success rate
- retry success rate

### Product Outcome

- percentage of deployed games using user-owned hosting after 30 days
- support volume per 100 deployments
- number of users who migrate from managed to user-owned hosting

## Acceptance Criteria

- Factory start flow supports a hosting choice between managed and user-owned Railway.
- A user can connect Railway from Factory.
- A user can deploy Torii into their Railway account from Factory.
- Factory shows deployment progress in plain language.
- Factory stores and displays provider metadata and endpoint state.
- Existing managed Slot-backed indexer flows continue to work.
- Admin can still inspect and recover hosting state when needed.
- The new hosting flow does not turn Factory back into an operator console.

## Open Questions

- Should the first Railway release start as a template handoff or go straight to OAuth provisioning?
- Should user-owned hosting be available during launch only, or also for any existing game immediately?
- Do we want one Railway project per game or one project with multiple Torii services per user?
- What plan/profile defaults are economically safe for mainnet-sized worlds?
- Should public SQL access be exposed directly, or fronted by a lightweight proxy later?

## Initial Implementation Surface

Likely code areas:

- [slot-torii.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/config/deployer/clean/indexing/slot-torii.ts)
- [indexer.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/config/deployer/clean/indexing/indexer.ts)
- [runner.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/config/deployer/clean/launch/runner.ts)
- [types.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/config/deployer/clean/types.ts)
- [store.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/config/deployer/clean/run-store/store.ts)
- [factory-worker.ts](/Users/os/conductor/workspaces/eternum/zurich-v5/client/apps/game/src/ui/features/factory-v2/api/factory-worker.ts)
- [factory-v2-content.tsx](/Users/os/conductor/workspaces/eternum/zurich-v5/client/apps/game/src/ui/features/factory-v2/components/factory-v2-content.tsx)
- [factory-v2-manage-indexers-workspace.tsx](/Users/os/conductor/workspaces/eternum/zurich-v5/client/apps/game/src/ui/features/factory-v2/components/factory-v2-manage-indexers-workspace.tsx)

## Recommendation

Ship this in order:

1. provider seam
2. Railway template
3. Railway OAuth provisioning
4. full Factory integration

That gets the useful part into users' hands quickly, keeps the architecture honest, and avoids turning one clear product
bet into a sprawling infra migration.
