# Agent Runtime Setup

This document explains the full player-agent setup and execution path in this repository.

It is aimed at developers who need to understand:

- how a player gets an agent
- how Cartridge auth becomes a durable server-side session
- how the executor claims and runs heartbeats
- how onchain transaction activity reaches the UI
- where to look when the system is stuck or misconfigured

## Scope

This covers the current player-agent stack:

- gateway: `client/apps/agent-gateway`
- executor: `client/apps/agent-executor`
- runtime helpers: `packages/agent-runtime`
- onchain tool runtime: `client/apps/onchain-agent`
- shared contracts: `packages/types`
- client UI: `client/apps/game/src/ui/features/agents`

It does not cover:

- multi-agent orchestration
- production queue infrastructure beyond the current local heartbeat flow
- the full game-agent CLI surface in `client/apps/onchain-agent`

## System Overview

The agent system is split into five responsibilities:

1. The game client lets a player launch, authorize, enable, and inspect an agent.
2. The gateway owns durable agent records, setup flow, and player-facing APIs.
3. The executor restores the stored session, boots the onchain runtime, and runs turns.
4. the onchain-agent runtime builds the map/tool context and submits game transactions.
5. shared types define the payload contract between gateway, executor, and UI.

```mermaid
flowchart LR
    Player[Player in Game Client]
    UI[Agents UI]
    Gateway[Agent Gateway]
    DB[(Agent Tables)]
    Executor[Agent Executor]
    Runtime[Managed Runtime]
    Onchain[Onchain Agent Bootstrap]
    Provider[Eternum Provider]
    Chain[Starknet World]

    Player --> UI
    UI --> Gateway
    Gateway --> DB
    Gateway --> Executor
    Executor --> DB
    Executor --> Runtime
    Runtime --> Onchain
    Onchain --> Provider
    Provider --> Chain
    Executor --> DB
    Gateway --> UI
```

## Main Data Model

The system relies on four durable records:

- `agents`
  - one row per player/world agent
  - stores desired state, execution state, runtime config, setup state, and latest error fields
- `agent_sessions`
  - stores the active Cartridge session material and policy fingerprint
- `agent_runs`
  - one row per completed or failed execution attempt
- `agent_events`
  - append-only activity log for setup changes, runtime activity, tx activity, and recovery events

In practice:

- `agents` answers “what is the agent supposed to be doing right now?”
- `agent_runs` answers “what happened the last time we tried?”
- `agent_events` answers “what happened inside the run?”
- `agent_sessions` answers “can the server still sign on behalf of this player?”

## Lifecycle

## 1. Launch

The player launches an agent from the Agents dashboard.

The client calls:

- `POST /my/agents`

The gateway creates:

- an `agents` row
- an `agent_threads` row
- for player-session auth, an `agent_sessions` row in `pending` state
- an initial `agent.setup_changed` event

If the auth mode is `player_session`, the agent starts in:

- `setupStatus = pending_auth`
- `executionState = waiting_auth`

If setup is already satisfied, the agent can start in:

- `setupStatus = ready`
- `executionState = idle`

## 2. Cartridge Authorization

For player agents, the gateway creates a Cartridge auth URL and later exchanges the callback payload for durable session
material.

```mermaid
sequenceDiagram
    participant Player
    participant UI
    participant Gateway
    participant Cartridge
    participant DB

    Player->>UI: Launch agent
    UI->>Gateway: POST /my/agents
    Gateway->>DB: create agent + pending session
    Gateway-->>UI: authUrl
    Player->>Cartridge: Approve policies
    Cartridge-->>Gateway: callback payload
    Gateway->>DB: store encrypted session JSON
    Gateway->>DB: mark setup ready
    Gateway->>DB: append setup events
    Gateway-->>UI: ready detail
```

Important details:

- the gateway encrypts session material before persistence
- the stored policy fingerprint is later re-checked by the executor
- if the live world policy fingerprint drifts, the session is invalidated and the player must reauthorize

## 3. Enabling Autonomy

When the player enables autonomy, the gateway updates the agent row to make it schedulable:

- `autonomyEnabled = true`
- `executionState = idle`
- `nextWakeAt = now`

That is the point where the agent becomes eligible for executor heartbeats.

## 4. Heartbeat Claiming and Recovery

The executor does not directly run every due row it sees. It now follows a stricter order:

1. recover stale `queued` rows
2. recover stale `running` rows
3. claim only due `idle|cooldown` rows into `queued`
4. run the claimed jobs

This avoids the earlier problem where multiple heartbeat scans could manufacture duplicate work from the same due row.

```mermaid
flowchart TD
    Start[Heartbeat tick]
    RecoverQueued[Recover stale queued rows]
    RecoverRunning[Recover stale running rows]
    SelectDue[Select due idle or cooldown rows]
    Claim[Atomically flip row to queued]
    Run[Process claimed job]
    Done[Return heartbeat result]

    Start --> RecoverQueued --> RecoverRunning --> SelectDue --> Claim --> Run --> Done
```

### Recovery policy

Turn timing uses two numbers:

- `turnTimeoutMs`
  - per-agent override from runtime config, default `45_000`
- stale execution threshold
  - `max(turnTimeoutMs * 2, 90_000)`

If a row is stuck in:

- `queued`
  - it is returned to `idle` or `error`, and a recovery event is written
- `running`
  - a failed `agent_runs` row is persisted with `stale_run_recovered`
  - the agent row is moved back to `idle` if it should retry automatically
  - recovery events are appended so the UI shows that the executor repaired a hung turn

## 5. Session Restore and Runtime Bootstrap

Each claimed job goes through these stages:

1. load execution config
2. restore and validate the stored session
3. transition `queued -> running`
4. bootstrap the onchain runtime
5. run the prompt with a turn timeout
6. persist the final run row and event log

The executor now persists stage-specific failures before the turn body when possible, instead of only catching failures
after `markRunning`.

### Session restore rules

The executor restores a session only if:

- the `agent_sessions` row is still `approved`
- the stored session has not expired
- the live world auth context still matches the stored policy fingerprint
- the session material can be decrypted with the configured key set

Otherwise the gateway-facing state is moved back toward reauthorization.

## 6. Managed Runtime and Prompt Execution

The executor creates a managed runtime from:

- model provider + model id
- restored Cartridge files
- onchain-agent bootstrap output
- tool set and map context

The runtime now supports:

- explicit custom event emission
- prompt timeout handling in `runAgentTurn(...)`

Timeout behavior:

- if `runtime.prompt(...)` does not settle within `timeoutMs`
- the turn returns a failed `AgentTurnResult`
- the error message is `Turn timed out after <n>ms.`

## 7. Onchain Tools and Transaction Bridge

The onchain runtime submits writes through `@bibliothecadao/provider`.

The provider already emitted transaction lifecycle events, but the executor previously ignored them. The current flow
now bridges those events into runtime events and then into durable agent events.

```mermaid
sequenceDiagram
    participant Tool as Tool Execution
    participant Provider
    participant Bridge as Runtime Tx Observer
    participant Executor
    participant DB
    participant UI

    Tool->>Provider: submit tx
    Provider-->>Bridge: transactionSubmitted
    Bridge-->>Executor: managed_runtime.transaction_submitted
    Executor->>DB: agent.action_submitted
    Provider-->>Bridge: transactionComplete or transactionFailed
    Bridge-->>Executor: managed_runtime.transaction_confirmed
    Executor->>DB: agent.action_confirmed
    UI->>DB: fetch detail / stream events
```

### Correlation model

Each tx event carries enough information to link it back to the runtime activity that caused it:

- `runtimeToolCallId`
- `toolName`
- `contractAddress`
- `entrypoint`
- `calldataSummary`
- `txHash`
- `receiptStatus`
- `errorMessage` when present

The bridge keeps a transaction-hash-to-tool-context map so late confirmations still resolve back to the correct tool
even after the tool body has already finished.

### Safe calldata summaries

The provider now creates UI-safe calldata summaries instead of dumping raw calldata blobs. For example:

- `explorer_id=191, directions=[0,5], explore=0`

For unknown entrypoints, it falls back to positional summaries like:

- `arg0=12, arg1=["north","east"], arg2={"nested":true}`

## 8. Durable Event Model

The executor persists several classes of events:

- setup events
  - `agent.setup_changed`
  - `agent.session_invalidated`
- tool/runtime events
  - `agent.tool_started`
  - `agent.tool_finished`
  - `agent.thought`
  - `agent.error`
- tx events
  - `agent.action_submitted`
  - `agent.action_confirmed`
- recovery events
  - `agent.run_recovered`

This is important because the UI should be able to answer “what is happening?” without tailing server logs.

## 9. Gateway Detail Shaping

The gateway derives two higher-level views from recent events plus the latest run row:

- `latestAction`
  - the latest onchain action, including tx hash, entrypoint, status, and revert reason
- `executionSummary`
  - the latest run status, wake reason, timing, and last error message

These are returned on `MyAgentDetail` so the game client does not need to reverse-engineer tx status by replaying raw
events itself.

## 10. Game Client Surfaces

The current client surfaces agent truth in two places:

- dashboard detail panel
- in-world dock

The UI now shows:

- latest onchain action
- tx hash when present
- revert reason when present
- last run summary
- stalled heartbeat warnings when:
  - autonomy is enabled
  - `nextWakeAt` is in the past
  - execution state is still `idle`, `queued`, or `running`

This gives operators three useful answers immediately:

- Is the agent authorized?
- Is the scheduler waking it?
- Did the last tx succeed, revert, or never happen?

## Local Setup

## Required services

For a useful local setup you typically need:

- agent gateway
- agent executor
- the game client if you want the dashboard or dock
- a reachable RPC / Torii / world context for the target world

## Runtime expectations

The local stack currently uses different runtimes for different services:

- gateway
  - `bun run --watch src/dev.ts`
- executor
  - `Node + tsx`
  - this matters because Cartridge session restore support is wired and tested in the Node path
- game client
  - Vite dev server

This means local development should treat:

- gateway runtime as Bun
- executor runtime as Node

That split is intentional.

## Environment

At minimum, the stack expects:

- `DATABASE_URL`
- `AGENT_SESSION_ENCRYPTION_KEYS`
- a model provider credential appropriate to the configured model provider

Common optional knobs:

- `AGENT_TURN_TIMEOUT_MS`
- `AGENT_EXECUTOR_HEARTBEAT_POLL_MS`
- `AGENT_AUTH_SKIP_VALIDATE`
- `CARTRIDGE_API_BASE`

## Concrete local environment

For a local database and local auth-skipping setup, the following exports are the baseline:

```bash
export DATABASE_URL=postgres://eternum:eternum@127.0.0.1:5430/eternum_realtime
export AGENT_SESSION_ENCRYPTION_ACTIVE_KEY_ID=local
export AGENT_SESSION_ENCRYPTION_KEYS='{"local":"MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="}'
export AGENT_AUTH_SKIP_VALIDATE=true
```

These are appropriate for local development only.

Why each one matters:

- `DATABASE_URL`
  - used by gateway and executor to read and write the agent tables
- `AGENT_SESSION_ENCRYPTION_ACTIVE_KEY_ID`
  - used by the gateway when encrypting stored Cartridge session material
- `AGENT_SESSION_ENCRYPTION_KEYS`
  - used by the gateway to encrypt and by the executor to decrypt session material
- `AGENT_AUTH_SKIP_VALIDATE=true`
  - allows local setup flows without full production validation
  - do not carry this into production

You will usually also need at least one model provider key for actual turn execution. For example:

```bash
export ANTHROPIC_API_KEY=...
```

You may also want:

```bash
export AGENT_TURN_TIMEOUT_MS=45000
export AGENT_EXECUTOR_HEARTBEAT_POLL_MS=5000
export CARTRIDGE_API_BASE=https://api.cartridge.gg
```

## Running locally

## Fast path

If your environment is already exported, the easiest path is:

```bash
pnpm install
pnpm run build:packages
node scripts/dev-agents.mjs
```

That helper starts:

- gateway
- executor
- world ingest
- game client

and prints the chosen ports.

The script wires:

- `VITE_PUBLIC_AGENT_GATEWAY_URL` into the game client
- local `PORT` values into the backend services

but it expects shared environment like `DATABASE_URL` and encryption keys to already exist in the shell that launched
it.

## Manual local startup

If you want full control, start the services one by one.

### 1. Export environment

```bash
export DATABASE_URL=postgres://eternum:eternum@127.0.0.1:5430/eternum_realtime
export AGENT_SESSION_ENCRYPTION_ACTIVE_KEY_ID=local
export AGENT_SESSION_ENCRYPTION_KEYS='{"local":"MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI="}'
export AGENT_AUTH_SKIP_VALIDATE=true
export ANTHROPIC_API_KEY=...
```

### 2. Start the gateway

```bash
PORT=8787 \
AGENT_CLIENT_ORIGIN=https://localhost:5173 \
pnpm --dir client/apps/agent-gateway dev
```

### 3. Start the executor

```bash
PORT=8788 \
pnpm --dir client/apps/agent-executor dev
```

### 4. Start the world ingest service

```bash
PORT=8789 \
pnpm --dir client/apps/agent-world-ingest dev
```

### 5. Start the game client

```bash
VITE_PUBLIC_AGENT_GATEWAY_URL=http://127.0.0.1:8787 \
pnpm --dir client/apps/game dev --host 127.0.0.1 --port 5173
```

## Local topology

```mermaid
flowchart LR
    Browser[Game Client<br/>localhost:5173]
    Gateway[Gateway<br/>localhost:8787]
    Executor[Executor<br/>localhost:8788]
    Ingest[World Ingest<br/>localhost:8789]
    Postgres[(Postgres<br/>localhost:5430)]
    Cartridge[Cartridge API]
    World[RPC and Torii]

    Browser --> Gateway
    Gateway --> Postgres
    Executor --> Postgres
    Ingest --> Postgres
    Gateway --> Cartridge
    Executor --> Cartridge
    Executor --> World
    Ingest --> World
```

## Local verification checklist

After startup, verify:

- gateway health
  - open `http://127.0.0.1:8787/my/agents` with a player header, or use the smoke script
- executor health
  - `http://127.0.0.1:8788/health`
- game client
  - `https://127.0.0.1:5173/?tab=agents`

Useful smoke path:

```bash
PLAYER_ID=<player-address> \
WORLD_ID=<world-address> \
node scripts/run-agent-system-smoke.mjs
```

That script verifies:

- gateway reachable
- executor reachable
- launch/setup flow
- autonomy enable
- heartbeat execution visibility

## Deployment

## Deployment model

At deployment time, think of the stack as three runtime classes:

1. player-facing API
   - agent gateway
2. background execution
   - agent executor
   - world ingest
3. UI
   - game client

```mermaid
flowchart TD
    Client[Public Game Client]
    Gateway[Agent Gateway Deployment]
    Executor[Agent Executor Deployment]
    Ingest[World Ingest Deployment]
    DB[(Shared Postgres)]
    RPC[RPC and Torii]
    Cartridge[Cartridge API]

    Client --> Gateway
    Gateway --> DB
    Executor --> DB
    Ingest --> DB
    Gateway --> Cartridge
    Executor --> Cartridge
    Executor --> RPC
    Ingest --> RPC
```

## Minimum deployment requirements

You need:

- one shared Postgres database
- one gateway deployment
- one executor deployment
- one world-ingest deployment if world events are part of the experience
- one game client deployment pointing at the gateway origin

You also need consistent secrets across the gateway and executor:

- `DATABASE_URL`
- `AGENT_SESSION_ENCRYPTION_KEYS`

And on the gateway specifically:

- `AGENT_SESSION_ENCRYPTION_ACTIVE_KEY_ID`

And on the executor specifically:

- model provider credentials
- any runtime tuning vars like `AGENT_TURN_TIMEOUT_MS`

## Production-safe notes

For production:

- do not use `AGENT_AUTH_SKIP_VALIDATE=true`
- do not use toy encryption keys
- keep gateway and executor key sets aligned
- keep the active key id valid on the gateway before rotating to a new key

Recommended production stance:

- inject env through your deploy platform secret store
- deploy gateway and executor independently
- point both at the same Postgres instance
- make executor health visible so stuck heartbeats are detectable quickly

## Deployment order

When rolling out the stack from scratch:

1. provision Postgres
2. deploy gateway with encryption config
3. deploy executor with matching key set and model credentials
4. deploy world ingest if used
5. deploy game client with `VITE_PUBLIC_AGENT_GATEWAY_URL`
6. run the smoke script against the deployed services

## Deployment checklist

- database reachable from gateway and executor
- gateway can encrypt and persist sessions
- executor can decrypt those sessions
- executor can resolve live world auth
- executor can reach RPC and Torii
- model provider credentials are present
- client points to the right gateway origin
- local-only auth shortcuts are disabled

## Example deployment env split

Gateway:

```bash
DATABASE_URL=...
AGENT_SESSION_ENCRYPTION_ACTIVE_KEY_ID=...
AGENT_SESSION_ENCRYPTION_KEYS=...
AGENT_CLIENT_ORIGIN=https://<your-client-origin>
CARTRIDGE_API_BASE=https://api.cartridge.gg
```

Executor:

```bash
DATABASE_URL=...
AGENT_SESSION_ENCRYPTION_KEYS=...
ANTHROPIC_API_KEY=...
AGENT_TURN_TIMEOUT_MS=45000
AGENT_EXECUTOR_HEARTBEAT_POLL_MS=5000
CARTRIDGE_API_BASE=https://api.cartridge.gg
```

Client:

```bash
VITE_PUBLIC_AGENT_GATEWAY_URL=https://<your-gateway-origin>
```

## Useful commands

Fast service smoke:

```bash
node scripts/run-agent-system-smoke.mjs
```

Executor dev server:

```bash
pnpm --dir client/apps/agent-executor dev
```

Game client:

```bash
pnpm --dir client/apps/game dev --host 127.0.0.1 --port 4173
```

## Troubleshooting

## Agent stuck in `waiting_auth`

Check:

- latest `agent.setup_changed` event
- session status in `agent_sessions`
- policy fingerprint drift or expired session

## Agent stuck in `error`

Check:

- `agents.lastErrorCode`
- `agents.lastErrorMessage`
- latest failed row in `agent_runs`
- latest `agent.error` and `agent.run_recovered` events

## No heartbeat activity

Check:

- `autonomyEnabled`
- `desiredState = running`
- `setupStatus = ready`
- `nextWakeAt`
- executor heartbeat loop enabled

If `nextWakeAt` is overdue and the UI says stalled heartbeat, inspect recovery events and executor logs.

## Tx submitted but never visible in UI

Check:

- provider tx bridge is active in the executor runtime
- `agent.action_submitted` / `agent.action_confirmed` events are being appended
- gateway detail fetch includes recent events and derived `latestAction`

## Session works in gateway but executor cannot sign

Check:

- `AGENT_SESSION_ENCRYPTION_KEYS`
- session decryption path in the executor
- live world auth resolution and policy fingerprint validation

## Mental Model

If you only keep one model in your head, use this one:

1. the gateway owns intent and setup state
2. the executor owns execution and recovery
3. the onchain-agent runtime owns map/tool behavior
4. the provider owns tx submission and confirmation events
5. the UI reads durable truth from runs and events

When debugging, ask which layer has stopped telling the truth. That is usually the layer that needs attention.
