# Factory Series Launches, Auto-Retry, Indexers, And Blitz Prize Funding

This document is the persisted implementation brief for the current Factory work.

It exists so the series-launch work, recovery model, indexer policy, and blitz prize-funding flow are captured in one
place instead of being spread across chat history.

## Scope

The requested feature set is:

- Factory V2 supports both single-game and series launches.
- Series launches use one parent run with grouped steps.
- Series runs can be continued after failures.
- Series runs auto-retry on a schedule until they succeed or are explicitly cancelled.
- Indexers are created at `basic`.
- Admin can manually change an indexer tier.
- A cron reconciles indexer tiers for all games:
  - `legendary` within 30 minutes before game start
  - `pro` starting 40 minutes after game end
- Blitz games get an admin-only prize funding flow.
- Series prize funding supports one admin action that funds multiple games in one transaction.

## Current Direction

The system should keep one clear rule:

- the public Factory V2 surface is for launching and watching runs
- operator-only actions stay in admin
- the run store is the source of truth for resumability and automation

This keeps the main Factory UI calm while still allowing operational tooling for funding and tier changes.

## Delivery Status Snapshot

These items are already part of the current implementation direction and should remain the base:

- `FactoryRun.kind` distinguishes `game` and `series`
- series launches are modeled as one parent run with child game progress
- grouped series steps exist for create, configure, and follow-up tasks
- explicit recovery state drives `Continue`
- series auto-retry state is persisted in the run store
- Cloudflare worker scheduling is the home for auto-recovery and indexer tier reconciliation
- indexers default to `basic`
- admin tier updates go through the Cloudflare worker

Still to finish or extend:

- blitz prize funding step and artifacts
- admin-only prize funding UI
- worker confirmation-secret validation for prize funding
- per-game and per-series payout ledgering
- series payout selection and resend policy

## Run Model

### Single Game

Single-game runs remain unchanged in shape except for shared recovery conventions.

### Series

Series launches are one parent run with child game records.

The parent identity is:

- `environment`
- `seriesName`

Assigned `seriesGameNumber` values are persisted at creation time and never recomputed during continue or auto-retry.

For an existing series:

- next game number starts at `lastGameNumber + 1`

For a new series:

- game numbers start at `1`

## Series Step Graph

The series parent run executes grouped steps in order:

1. `create-series`
2. `create-worlds`
3. `wait-for-factory-indexes`
4. `configure-worlds`
5. `grant-lootchest-roles`
6. `grant-village-pass-roles`
7. `create-banks`
8. `create-indexers`
9. `sync-paymaster`

Rules:

- each grouped step fans out across games in `seriesGameNumber` order
- the grouped step continues through child failures instead of aborting on the first failure
- a continue or auto-retry only reruns child work that is not already successful for that grouped step
- successful child work is never repeated unless an explicit resend or override mode exists

## Auto-Retry Model

Series runs support persistent auto-retry with these fields:

- `autoRetryEnabled`
- `autoRetryIntervalMinutes`
- `nextRetryAt`
- `lastRetryAt`
- `autoRetryCancelledAt`
- `autoRetryCancelReason`

Default:

- auto-retry enabled
- default interval `15` minutes

Operator choices at launch:

- `5`
- `15`
- `30`
- `60`

Scheduling rules:

- the worker sweep runs every 5 minutes
- eligible parent series runs are continued when `nextRetryAt <= now`
- eligibility requires:
  - run kind is `series`
  - run is not complete
  - auto-retry is enabled
  - auto-retry is not cancelled
  - no active lease exists
  - the run is stalled or in attention, not actively progressing

Auto-retry continues until the full parent run succeeds, not only until `create-series` succeeds.

Cancellation stays admin/API-only in the first pass.

## Factory V2 UI

Factory V2 should keep the existing intent-first shape and add a launch target switch:

- `Single game`
- `Series`

Series mode should show one shared setup card with:

- environment
- preset
- shared config flags
- series name
- game count
- auto-retry interval

Below that, it should render compact generated game rows.

Per-game editable fields in V1 of the series form:

- `gameName`
- `startTime`

The watch surface should show:

- one parent series card
- grouped step progress
- compact child game list
- auto-retry state
- next retry time

Continue should only be shown when backend recovery explicitly marks the run as continuable.

## Indexer Policy

### Creation

All new indexers should be created at `basic`.

This applies to both single-game and series flows.

### Manual Admin Action

Admin gets explicit indexer tier controls.

The worker endpoint is responsible for:

- validating the requested tier
- dispatching the tier update workflow
- persisting the resulting indexer tier in run state

Supported manual tiers:

- `basic`
- `pro`
- `legendary`
- `epic`

### Scheduled Reconciliation

The worker cron should reconcile indexer tier for all games using launch timing.

Required policy:

- if current time is within 30 minutes before start, desired tier is `legendary`
- if current time is 40 minutes after end or later, desired tier is `pro`

Interpretation:

- `legendary` starts at `startTime - 30m`
- the game remains eligible for high tier during the pre-start window and active period
- `pro` is enforced from `endTime + 40m`

This scheduler applies across all games, not only newly launched ones.

## Blitz Prize Funding

Prize funding is admin-only and should not live on the public Factory V2 launcher.

It should be modeled as a tracked post-launch operation for blitz games.

### Admin Confirmation

Prize funding requires a confirmation secret entered in admin UI.

Flow:

1. admin enters funding parameters
2. admin enters confirmation secret
3. UI sends secret to the Cloudflare worker
4. worker validates against an environment secret
5. only then does the worker dispatch funding execution

The UI must never persist the secret locally.

Suggested worker secret name:

- `FACTORY_PRIZE_CONFIRMATION_SECRET`

### Single Game Funding

Single-game funding action:

- admin selects a blitz game
- admin enters token amount
- worker resolves that game's prize recipient
- worker executes one ERC20 transfer
- tx hash and payout metadata are persisted in the run store

The recipient must come from trusted run or factory data, not from free-form admin input.

### Series Funding

Series funding should support one admin action that funds multiple games in one account transaction.

Rules:

- series must already be deployed before funding is allowed
- the admin UI must show the full list of games in the series
- games that already received the prize should be excluded by default
- the admin can explicitly include already-funded games when a resend is intended
- the funding transaction should be a single account multicall containing one ERC20 transfer per selected game

Default amount semantics for V1:

- the entered amount is the per-game prize amount
- each selected game receives that amount

This avoids ambiguous implicit splitting of one total budget across several games.

### Incremental Series Funding

If more games are added to a series later and funding is run again:

- already-funded games are skipped by default
- newly added unfunded games are selected by default
- the admin can change the selection before submitting

This requires a per-game payout ledger, not only a series-level “funded” boolean.

### Payout Persistence

We need durable payout records for both visibility and resend protection.

Minimum persisted shape per funded game:

- `environment`
- `gameName`
- `seriesName?`
- `recipient`
- `tokenAddress`
- `amount`
- `txHash`
- `sentAt`
- `status`
- `transferGroupId`
- `explicitResend`

`transferGroupId` groups a single-game send or a single series multicall.

## Workflow And Worker Shape For Prize Funding

Prize funding should be operator-triggered, not part of the default public launch button.

Recommended shape:

- add a dedicated admin-triggered workflow for prize funding
- model the result in run state as a post-launch step or artifact group

Prefer a separate workflow over overloading the launch workflow because:

- prize funding is admin-only
- it depends on a confirmation secret
- it may happen long after launch completion
- it needs resend-safe bookkeeping

Suggested operations:

- `send-blitz-prize`
- `send-series-blitz-prizes`

## Data And API Additions

### Run Store

Add payout state for blitz runs and series runs.

Single-game run should persist:

- latest prize funding status
- latest prize tx hash
- full prize funding history

Series run should persist:

- per-game prize funding ledger
- last transfer group
- whether all current games are funded
- which games remain unfunded

### Worker Routes

Add admin-only worker routes for:

- send prize to one blitz game
- send prize to selected games in one blitz series
- list current payout state for a series

All prize routes must validate the confirmation secret.

### Admin UI

Admin should get:

- single-game prize funding panel
- series funding panel with selectable game list
- per-game funding state display
- default selection of only unfunded games
- explicit resend toggle for funded games

The public Factory V2 UI should not expose prize funding controls.

## Testing Plan

### Series

- new series assigns contiguous game numbers
- existing series continues numbering from the current tail
- continue only reruns failed or pending child work
- auto-retry uses the stored series numbers and current step state

### Indexers

- new indexers dispatch as `basic`
- manual tier update dispatches the requested tier
- scheduled reconciliation chooses `legendary` in the 30-minute pre-start window
- scheduled reconciliation chooses `pro` from 40 minutes after end

### Prize Funding

- worker rejects funding when the secret is missing or wrong
- single-game funding resolves the trusted prize recipient and records tx data
- series funding builds one multicall for selected games
- funded games are skipped by default on later sends
- explicit resend can include already-funded games
- series funding is blocked until the series run is sufficiently deployed

## Open Decisions To Keep Explicit

These need to stay explicit and not be rediscovered from chat later:

- series funding amount should stay per-game in V1 unless product explicitly wants total-budget splitting
- prize funding should use a dedicated admin workflow, not the normal launch button path
- prize recipient should come from trusted run or factory data, never from free-form admin input
- the public Factory V2 page stays clean by keeping prize controls in admin only

## Practical Next Slice

The next implementation slice should be:

1. finish persisting series launch and auto-retry state cleanly
2. keep indexer creation at `basic` and scheduler-driven tier reconciliation
3. add worker-backed admin prize funding for a single blitz game
4. add series prize selection and single-tx multicall funding
5. persist per-game payout history and resend-safe defaults
