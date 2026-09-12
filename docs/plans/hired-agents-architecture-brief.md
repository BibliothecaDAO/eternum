# Hired agents — architecture brief (sandboxed Pi agents on one shared game client, sold by subscription)

Written 2026-09-12 from a read of `apps/game`, `packages/*`, `apps/herald`, `apps/realms`, `apps/launch-service`,
`apps/operator`, `deploy/madara-lab/harness`, the git history of the three deleted agent/headless attempts, and the
current Vercel Sandbox, Pi, OpenRouter, and Stripe documentation. Every claim cites its source. Nothing here is built.

Motto: **KISS, always. Systemic fixes over point patches. Success of systemic work is deletion.**

---

## 0. The answer in one paragraph

Extract the non-UI half of `apps/game` into one shared, Node-clean client entry point,
`@bibliothecadao/eternum/game-client`, and make the web client its first consumer. Put a small agent runner on top of
that client (Pi `agent-core` + tools generated from the client's action surface) and run one runner per hired agent in a
**persistent Vercel Sandbox** whose egress is allowlisted to Herald, the game RPC, and our own agent gateway. The
sandbox never holds a private key or an LLM key: gameplay calls are signed by a per-owner signing lane in the control
plane using the delegation primitive the repo already chose (bind once, `rotate_public_key` to grant and revoke), and
every LLM call leaves the sandbox through the Vercel firewall's `forwardURL` into our proxy, which verifies the
sandbox's OIDC identity, injects the OpenRouter key, and records `usage.cost` per agent. That one proxy is the whole
metering system. Billing is a Stripe subscription with one metered "agent credits" price; agents are unlimited, cost is
tracked per agent and aggregated per customer. Four phases, each with a deletion and a gate.

---

## 1. What already exists, and what died

### The pieces we will reuse unchanged

| Need                               | Exists at                                                                                                                                                                                                        | Evidence                                                                                                                                                                                  |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DOM-free sync runtime              | `packages/core/src/sync/` exported as `@bibliothecadao/eternum/game-sync` (`GameSyncRuntime`, `HeraldGameSyncTransport`, schedulers)                                                                             | `apps/herald` imports it under Bun in production; the transport's only browser reference is the default `socketFactory` (`herald-game-sync-transport.ts:177`)                             |
| RECS schemas and every system call | `packages/types` (`defineContractComponents`, `createSystemCalls` with ~130 typed methods), `packages/provider` (`EternumProvider`)                                                                              | Node-safe; no React                                                                                                                                                                       |
| Game math                          | `packages/core/src/managers/*` (`ArmyActionManager`, `TileManager`, `ArmyManager`, `StaminaManager`, `ResourceManager`), `utils/combat-simulator.ts`, `raid-simulator.ts`                                        | Pure classes taking `(components, systemCalls, id)`                                                                                                                                       |
| Headless bootstrap                 | `packages/dojo` `setup(config, env, authHandler)` → `SetupResult`                                                                                                                                                | No DOM; React is a devDependency only                                                                                                                                                     |
| Headless identity                  | `packages/core/src/account/gameplay-account.ts` (`ensureGameplayAccount`, `connectGameplayAccount`, `readBoundGameplayAccount`, `StorageLike`) and `transaction-resource-bounds.ts`                              | Used by `deploy/madara-lab/harness/account-factory.ts` for 96 bots                                                                                                                        |
| Delegation primitive               | `contracts/l3/player-account/src/player_account.cairo` `rotate_public_key` (binding authority only); `apps/realms/server/binding.ts` `rotateGameplayAccountKey` with the `gameplay_account_key_rotated` log line | `docs/plans/realms-phase-2-brief.md:560-563`: "an agent plays as the owner's gameplay account via the session-gated rotate… MMR and prizes stay the owner's; take-back is another rotate" |
| Game discovery and entry           | Herald `GET /{chain}/games?player=`, `buildBlitzSettleCalls` / `buildEternumSettleCalls` (`apps/game/src/services/blitz/blitz-settlement-calls.ts`), harness `prepareHarnessBots`                                | The harness already settles, provisions, and creates explorers headlessly                                                                                                                 |
| Durable job orchestration          | `apps/launch-service/src/store.ts` (claim / lease / heartbeat / retry / fail on Postgres) and `worker.ts` (Effect race of work vs. heartbeat)                                                                    | The exact shape an agent-session supervisor needs                                                                                                                                         |
| Structured ops output              | one-line JSON `{event: "snake_case", …}` logs; `deploy/madara-lab/harness/report.ts` run manifests; `classifyTransactionError`, `WorkloadFailureClass`                                                           | The repo's stated artifact discipline                                                                                                                                                     |
| Identity server + Postgres         | `apps/realms/server` (better-auth, SIWS, `bearer()` plugin), `packages/db` `user`/`session` tables                                                                                                               | Only sign-in authority; no billing tables exist anywhere                                                                                                                                  |

### The three attempts that died, and the one lesson

- `packages/client` (deleted `6803887f89a`, PR #4961): a "headless client" that shared only the sync runtime and
  re-implemented reads, transactions, and math. It drifted (`computeStrength = count * tier`; building cost formula
  wrong) and nothing consumed it. The PR's stated follow-up: _"extract the app's non-UI core… into a shared package, not
  reviving a second client."_
- `packages/game-agent` (deleted `f6db429e4c4`, PR #4962): a Pi-based agent framework with a `GameAdapter` interface.
  Good ideas (steer-don't-queue tick, compaction with prompt reload, `list_actions` lookup tool, soul/skills/tasks as
  files). Died because it was a second client-shaped abstraction with no call site.
- `client/apps/onchain-agent` "Axis" (deleted `30b1e582fcc`): 10k lines, Cartridge-session signing, ABI-driven action
  catalog, per-agent HTTP/SSE control surface, fleet runner. Died with Cartridge.

The lesson is written into `AGENTS.md` already: **wired or deleted**. Every new module below names its first consumer
and its CI gate. Nothing lands as a library waiting for a caller.

---

## 2. Target architecture

```
                 ┌──────────────────────── apps/realms (web UI) ────────────────────────┐
                 │  Hire · Direct · Attach to game · Skills/personality · Usage · Billing │
                 └───────────────┬───────────────────────────────────────────────────────┘
                                 │ better-auth session (existing)
                 ┌───────────────▼───────────────────────────────────────────────────────┐
                 │ apps/agent-service  (box, Bun + Hono + Effect + pg — launch-service shape) │
                 │  • agents / directions / attachments / usage ledger (Postgres)          │
                 │  • sandbox supervisor: getOrCreate · resume · stop · lease/heartbeat     │
                 │  • agent gateway (WS): directions ↓, events/transcript ↑                 │
                 │  • signing lane per owner: holds delegated gameplay key, one nonce line  │
                 │  • LLM proxy (forwardURL target): OIDC verify → inject key → meter      │
                 │  • billing: Stripe customer/subscription/meter events, budget gate       │
                 └───┬─────────────────────┬───────────────────────┬───────────────────────┘
                     │ Vercel Sandbox SDK  │ WS (outbound only)    │ Stripe / OpenRouter
   ┌─────────────────▼─────────────┐       │
   │ one persistent sandbox / agent │◄──────┘
   │  apps/agent-runner (Node 22)   │──── WSS ──► herald.realms.party   (read: snapshot + diffs)
   │   @bibliothecadao/eternum/     │──── HTTPS ► rpc.realms.party      (read only: nonce/receipts)
   │     game-client  (shared)      │──── HTTPS ► openrouter.ai  ══► firewall forwardURL ══► LLM proxy
   │   pi agent-core + game tools   │
   │   /data: soul, skills, memory  │  network policy: allowlist of exactly these hosts
   └────────────────────────────────┘
```

Five boundaries, each with one owner:

1. **Game truth** stays in RECS inside the runner, fed by Herald. Same runtime, same store code as the web client.
2. **Keys** stay in the control plane. The sandbox submits _intents_ (typed calls); the signing lane signs and sends.
3. **LLM credentials and metering** live in the proxy. The sandbox cannot see the key or forge its identity.
4. **Agent memory** (soul, skills, learnings, transcript) is files in the persistent sandbox, mirrored to Postgres by
   the gateway so the UI can show it and a re-created sandbox can be re-seeded.
5. **Money** is Stripe; the control plane is the ledger of record per agent and enforces budgets before Stripe ever sees
   an invoice.

---

## 3. The shared client (`@bibliothecadao/eternum/game-client`)

This is the systemic fix and the only part of the plan that touches the web client. It answers "do not duplicate the
client" by moving code, not copying it.

### What moves out of `apps/game` into `packages/core/src/client/`

| Today (app-local)                                                                                                                                          | Becomes                                              | Notes                                                                                                                                   |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `src/sync/recs-game-sync-store.ts` (`createRecsGameSyncStore`)                                                                                             | `client/recs-game-sync-store.ts`                     | Already Node-clean (`recs-game-sync-store.parity.test.ts` runs under `@vitest-environment node`); drop the two `@/` imports             |
| `src/sync/herald-game-sync-session.ts` (`createHeraldGameSyncSession`, `buildHeraldGameStreamUrl`)                                                         | `client/herald-session.ts`                           | Callbacks become an injected `GameClientObserver` interface; scheduler injected                                                         |
| `src/sync/game-scope.ts`                                                                                                                                   | `client/game-scope.ts`                               |                                                                                                                                         |
| `src/runtime/world/herald-http.ts`, `world-directory.ts`, `game-registry.ts`                                                                               | `client/herald-http.ts`, `client/world-directory.ts` | Manifest-driven; config comes in as a value, not from `apps/game/env.ts`                                                                |
| `src/account/gameplay-account-submit.ts` (`configureGameplayAccountSubmits`)                                                                               | `client/submit.ts`                                   | Nonce dispenser + resource bounds + rotate-on-invalid-signature; accepts any `AccountInterface` so the remote signing lane plugs in     |
| `src/services/blitz/blitz-settlement-calls.ts`                                                                                                             | `client/entry.ts`                                    | The harness already imports it by relative path across the app boundary; that import goes away                                          |
| Action orchestration embedded in `src/three/scenes/worldmap.tsx:2603` (`ArmyActionManager`), `:1156` (`ArmyManager`), `hexception.tsx:240` (`TileManager`) | `client/actions.ts` (`createGameActions(client)`)    | The managers are already in core; only the "construct manager, find paths, move" glue moves. Scenes call `client.actions.moveArmy(...)` |
| Queries the React hooks wrap (`packages/react` `use-armies`, `use-structures`, `use-resources`, …)                                                         | `client/views.ts` (`createGameViews(client)`)        | Plain functions over RECS; the hooks become one-line wrappers, which is a deletion                                                      |

### The entry point

```ts
// packages/core/src/client/index.ts  →  exported as "@bibliothecadao/eternum/game-client"
export function createGameClient(input: {
  world: WorldDeployment; // chain, rpcUrl, heraldBaseUrl, namespace, worldAddress, selectors, class hashes
  gameId: number;
  presetId: number;
  scheduler: GameSyncScheduler; // browser: rAF scheduler; node: createMicrotaskGameSyncScheduler()
  socketFactory?: (url: string) => HeraldSocket;
  fetch?: typeof fetch;
  observer?: GameClientObserver; // progress, status, slice-applied, tx confirmed — UI or logger
}): Promise<GameClient>;

export interface GameClient {
  setup: SetupResult; // network.provider, components, systemCalls (unchanged types)
  runtime: GameSyncRuntime;
  projection: WorldSpatialProjection;
  views: GameViews; // myStructures(owner), armies(owner), resources(id), mapArea(bounds), market(), leaderboard()
  actions: GameActions; // moveArmy, explore, build, produce, sendResources, attack, settle, provisionRealm, …
  connect(signer: AccountInterface): void; // web: local gameplay account; agent: remote signing lane
  recover(): Promise<void>;
  dispose(): void;
}
```

`apps/game/src/init/bootstrap.tsx` steps 1–3, 5, 6 become `createGameClient(...)`; steps 4 and 7 (`prepareGameRenderer`,
`startGameRenderer`) stay. `recs-store-bridge.ts` keeps deriving zustand slices from the same RECS world; it is the
React boundary and does not move.

### Why in `packages/core` and not a new package

- Core already owns the sync runtime, the managers, and the account code; the client is the composition of those.
- A new workspace package is exactly what rotted twice: not in `build:packages`, ignored by knip, no CI. A subpath of an
  already-built, already-consumed package cannot rot silently.
- `core → dojo` is already a dependency (type import in `systems/world-update-listener.ts`); making it a runtime import
  keeps the graph acyclic (`chain ← types ← provider ← dojo ← core ← react`).

### Gate for this layer (Phase 0)

- The deleted headless smoke (`git show f5f226cd282^:apps/game/scripts/run-game-sync-headless-smoke.mjs`) comes back as
  `packages/core/scripts/run-game-client-headless.mjs`, using `HeraldGameSyncTransport` and
  `createMicrotaskGameSyncScheduler`, and runs in CI against the committed parity fixture
  (`recs-game-sync-store.parity.json`) and, nightly, against a live lab game.
- `deploy/madara-lab/harness/driver.ts` replaces its raw `CallData` construction and Herald HTTP polling with
  `client.actions` and `client.views`. The 96-bot acceptance run (`--bots 96 --minutes 10`, ≥3,500 of 3,840 actions)
  passes at the same bar. **Deletion:** `HeraldObserver`, the harness's hand-rolled path planning that duplicates
  `ArmyActionManager.findActionPaths`, and the app-relative import of `blitz-settlement-calls`.
- `apps/game` builds and its sync tests pass unchanged. `pnpm run knip` is clean with no new `ignoreWorkspaces` entry.

---

## 4. The agent runner (`apps/agent-runner`)

One Node 22 process per agent, inside the sandbox. ~1,500 lines, most of it prompt and tool text. It has no game
knowledge of its own; it is a Pi agent whose tools are `GameClient` methods.

### Loop

- **Wake sources**, not a fixed cadence: (a) a relevant Herald diff (my structures, my armies, tiles within my
  explorers' reach, attacks on me), coalesced through the client's `subscribeSliceApplied` with a minimum quiet window;
  (b) a user direction from the gateway; (c) a heartbeat (default 5 minutes in Blitz, 30 in Eternum) so a quiet map
  still gets a plan review; (d) a game-phase change (registration → live → ended).
- **Steer, don't queue.** If the agent is mid-reasoning when the world changes, inject `[WORLD STATE UPDATE]` with
  `agent.steer()`; user directions use `followUp()`. This is the one design from `packages/game-agent` worth keeping
  verbatim.
- **Compaction with reload**: `transformContext` prunes old turns and re-reads `soul.md` / `skills/` from disk into the
  system prompt, so learnings written mid-game survive.
- **Every LLM call is a cost decision.** The runner computes a cheap deterministic delta summary first; if nothing
  actionable changed and no direction is pending, it does not call the model. This is the single biggest cost lever and
  it is enforced in code, not in the prompt.

### Tools (all thin wrappers over `GameClient`)

| Tool                  | Backed by                                                                                | Notes                                                                                   |
| --------------------- | ---------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `observe`             | `client.views.*`                                                                         | Scoped views (mine, nearby, market, leaderboard, recent story events); never a raw dump |
| `list_actions`        | generated catalog from `createSystemCalls` typing + a curated domain overlay             | Keyword-filtered; keeps the tool schema small (Axis pattern)                            |
| `act`                 | `client.actions.*` → signing lane                                                        | Typed params; returns tx hash + Herald confirmation or a classified failure             |
| `simulate`            | `CombatSimulator`, `RaidSimulator`, `StaminaManager`, building cost from `configManager` | The exact math the web client uses; no re-implementation                                |
| `remember` / `recall` | files under `/data/memory`                                                               | Agent-writable learnings; mirrored to Postgres by the gateway                           |
| `report_to_owner`     | gateway event                                                                            | Short status the user sees in the UI                                                    |

### Personality and skills

- `soul.md` (personality, principles, risk appetite) and `skills/<name>/SKILL.md` (opening book, defending a rush,
  trading, hyperstructure contribution) are the user-facing "load a skill or personality" surface. Postgres is the
  source of truth; the supervisor writes them into `/data` on create and on resume.
- Model choice is a runner config value supplied by the control plane per tick class (`plan`, `react`, `chat`) and is
  invisible to the user. The runner uses pi-ai's built-in `openrouter` provider with a placeholder key; the real key is
  injected at the firewall.

### Control surface

Outbound only. The runner opens one WebSocket to the agent gateway with a per-session token. Down: `direct`, `attach`,
`detach`, `pause`, `resume`, `stop`, `config`. Up: `transcript` (Pi events), `decision`, `usage`, `status`, `error`. No
exposed sandbox port: exposed ports are public URLs, billable, and would need their own auth. The transcript lands in
Postgres, which is what the UI needs anyway, so the gateway is the one writer.

### Gate (Phase 1)

- The runner plays one Blitz game end to end on the lab chain as a self-bound guest, with the LLM proxy in the loop, and
  the run manifest records: actions attempted/confirmed, failure classes, LLM calls, tokens, USD cost, sandbox minutes.
  Target: a full Blitz under a stated cost envelope (to be measured; no number is asserted here).
- Runs locally (`bun apps/agent-runner --game <name> --guest`) and in a sandbox from the same image.

---

## 5. Identity, delegation, and signing

### The chosen primitive, and its consequence

The registry is one gameplay account per owner (`player_registry.cairo:50` "owner already bound") and settlement
reserves one seat per owner per game (`realm/blitz/contracts.cairo:95`). The phase-2 brief chose delegation by rotation:
the owner's single account is rotated to the agent, prizes and MMR stay the owner's, take-back is another rotate.

Two consequences for "unlimited agents per user":

1. Two of a user's agents cannot both be in the _same_ game as that user. That is correct (one seat per identity) and
   the UI enforces it.
2. Two of a user's agents in _different_ games share one account and therefore one nonce sequence. If each sandbox held
   the key they would race. So the key does not go into sandboxes at all.

### The signing lane

`apps/agent-service` keeps, per owner with an active grant, one `AccountInterface` backed by the delegated gameplay key
and one nonce dispenser (the existing `configureGameplayAccountSubmits` logic, lifted in Phase 0). Runners submit
`{ calls, gameId, idempotencyKey }` over the gateway; the lane signs, sends with `resolveGameTransactionResourceBounds`,
and returns the hash; confirmation arrives on the runner's own Herald `tx` channel. Benefits: no private key in an
LLM-driven process, one nonce line per account, instant revoke (drop the lane) with `rotate_public_key` as the
defense-in-depth take-back, and one audit log of every signed call keyed by agent.

### Grant and revoke (the phase-2 §C scope, unchanged)

- Grant: user clicks "let agent X play for me"; the authority rotates the owner's account to a lane-held key and logs
  `gameplay_account_key_rotated` with `agent_id`. The owner's own client sees "session moved, reconnect" (the UX the
  phase-2 brief already lists).
- Revoke: rotate back to a fresh owner key, close the lane. Phase-2's stated gate applies verbatim: _"the owner revokes
  mid-game and the driver's next action fails while the owner's client reconnects and continues; both events are in the
  audit log."_

### Guest agents

On the lab chain, agents may also play as self-bound guests (what `bfadd56a036` made work): no owner, no prizes, free
practice and the Phase 1 gate. Guest keys are also lane-held, never sandbox-held, so the runner has one code path.

---

## 6. Sandbox lifecycle and cost control (Vercel Sandbox facts as of 2026-09)

| Fact                                                                                                                                                                                                                                       | Use                                                                                                                                                                                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Persistent by default; `Sandbox.getOrCreate({ name })` resumes from the last snapshot; `onCreate` / `onResume` hooks                                                                                                                       | `name = agent_<id>`; `onResume` restarts the runner; `keepLastSnapshots: { count: 1 }`                                                                                                                                                                                         |
| Max session 24 h (Pro); session limit resets on stop/resume, sandbox lifetime unbounded                                                                                                                                                    | Supervisor cycles sessions before 24 h for Eternum long format                                                                                                                                                                                                                 |
| Pricing (iad1, Pro): $0.128 active-CPU hour, $0.0212 GB-hour provisioned, $0.60 per 1M creations, snapshots $0.08 GB-month; I/O wait is not billed; 10,000 concurrent                                                                      | 1 vCPU / 2 GB is enough (sync measured 2,472 entities in 2.6 s). A mostly-idle runner is dominated by memory: ~$0.04 per GB-hour-equivalent day at 2 GB, i.e. about $1/day per always-on agent before LLM cost. Stopping between games matters more than any code optimisation |
| Network policy: allowlist domains; `transform` injects headers at the firewall; `forwardURL` proxies a domain to us with a Vercel-signed OIDC token carrying `sandbox_name`; `defineSandboxProxy` from `@vercel/sandbox/proxy` verifies it | Allowlist: `herald.realms.party`, `rpc.realms.party`, `openrouter.ai` → `forwardURL` to our proxy, the gateway host. Nothing else, no catch-all                                                                                                                                |
| Custom images from Vercel Container Registry; snapshots make resume faster than fresh boot                                                                                                                                                 | CI builds one runner image per release from `pnpm build:packages` (build once, promote)                                                                                                                                                                                        |
| Vercel auth from outside Vercel uses an access token                                                                                                                                                                                       | The box-hosted `agent-service` uses a team access token scoped to the sandbox project                                                                                                                                                                                          |

Session policy: a sandbox session runs only while the agent is attached to a game that is `Registration` or `Live`, or
while the owner is actively chatting with it. Otherwise the supervisor stops it (snapshot). Detach and game end both
stop it. A user with fifty hired agents and none attached costs snapshot storage only.

Budget gates, enforced in the control plane before anything runs: per-agent hourly LLM cap, per-user monthly credit cap
(user-settable, default from plan), subscription status. Exhaustion pauses the agent and tells the user; it never
silently degrades to a cheaper model without the user having opted into that.

UNCONFIRMED: whether Vercel exposes per-sandbox compute usage for export. The design does not depend on it: the
supervisor knows every session start/stop and provisioned size and meters compute itself from those.

---

## 7. LLM metering

One chokepoint, the proxy:

1. Runner calls `https://openrouter.ai/api/v1/chat/completions` through pi-ai's `openrouter` provider.
2. Firewall `forwardURL` rule (no `match`, so every request is covered) sends it to `agent-service`'s proxy with
   `vercel-sandbox-oidc-token`.
3. Proxy verifies the token (`aud` = our URL, issuer, expiry), maps `sandbox_name` → agent → owner → budget, rejects if
   paused or over budget, replaces `Authorization` with the OpenRouter key, forwards, streams back.
4. OpenRouter now returns `usage` on every response with `cost` (USD), `prompt_tokens`, `completion_tokens`,
   `cached_tokens`, `reasoning_tokens`; the proxy writes one `agent_usage` row per call with the generation id as the
   idempotency key. For streaming, usage arrives in the final chunk.
5. Nightly reconciliation against `GET /api/v1/generation?id=` for any row whose cost was missing.

Per-agent OpenRouter provisioning keys (`POST /api/v1/keys` with `limit`) are a fallback if the firewall feature is not
available on our plan: then the proxy is called directly with a per-agent bearer token and the key limit is a second
ceiling. Either way the proxy remains the ledger writer.

Model routing (which model for `plan` vs `react` vs `chat`) is a config table in `agent-service`, so cost tuning never
touches the runner image.

---

## 8. Billing

### Product shape

- **Subscription** (Stripe, monthly, flat): unlocks hiring; includes N credits per month.
- **Metered overage**: one Stripe Billing Meter, event name `agent_credits`, aggregation `sum`, one metered price on the
  same subscription. One credit = one unit of internal cost at a fixed markup, covering both LLM cost and sandbox
  compute so the user sees one number. Model choice stays abstracted, which is what the product wants.
- **Unlimited agents**: no seat price. Every agent is a row; every cost row carries `agent_id`. The user's page shows
  per-agent spend; Stripe sees the per-customer sum.

### Tables (new, in `packages/db`, alongside `user`)

`billing_customer(user_id, stripe_customer_id, subscription_id, status, monthly_cap_credits)`,
`agent(id, user_id, name, soul, model_profile, sandbox_name, status)`, `agent_skill(agent_id, name, body)`,
`agent_attachment(agent_id, chain, game_id, grant_kind, granted_at, revoked_at)`,
`agent_direction(agent_id, body, delivered_at)`, `agent_event(agent_id, kind, payload, at)`,
`agent_usage(id, agent_id, kind: llm|compute, quantity, unit_cost_usd, credits, source_ref unique, at)`,
`stripe_meter_event(usage_id unique, sent_at)`.

### Flow

- Checkout → webhook `customer.subscription.*` → `billing_customer.status`. No status, no sandbox.
- `agent_usage` rows are pushed to Stripe as meter events with `identifier = usage.id` (idempotent; Stripe dedupes).
  Batched every few minutes; a failed push retries from the unsent set.
- Because Billing Meters only aggregate at invoice time, the control plane's own sum is what gates the user in real
  time. Stripe is the invoice, not the enforcement.
- Stripe's docs now steer new usage integrations to Metronome (prepaid credits, real-time visibility, credit burndown).
  Start on Billing Meters because it is one meter and one price; move to Metronome only if prepaid packs or enterprise
  contracts appear. The `agent_usage` ledger is the same either way.

---

## 9. Control plane (`apps/agent-service`)

Same stack and deployment as `apps/launch-service`: Bun, Hono, Effect, raw `pg`, systemd on the box, cookie session
verified against `apps/realms/server`, structured one-line JSON logs. One service, five responsibilities kept in
separate modules (one workflow responsibility per job, per the harness standard):

- `sessions/` — the supervisor. A `agent_session` job store with claim / lease / heartbeat / retry copied from
  `launch-service/src/store.ts`; the worker holds a sandbox session while the lease is held and stops it when the
  attachment ends. A lost lease stops the sandbox on the next heartbeat miss (no orphan VMs).
- `gateway/` — the WebSocket the runner connects to; persists transcript and events; delivers directions.
- `signing/` — per-owner lanes; the audit log of every signed call.
- `llm-proxy/` — `defineSandboxProxy`; the usage ledger writer.
- `billing/` — Stripe customer, checkout, webhooks, meter push, budget evaluation.

Public API (all behind identity): `POST /api/agents`, `PATCH /api/agents/:id` (soul, skills, model profile),
`POST /api/agents/:id/directions`, `POST /api/agents/:id/attach {chain, game}` (grant + settle if not settled),
`POST /api/agents/:id/detach`, `GET /api/agents/:id/events` (SSE), `GET /api/usage`, `POST /api/billing/checkout`,
`POST /api/billing/portal`.

UI lives in `apps/realms` (the phase-2 "one app for everything but the map"): an Agents route with hire, direct, attach,
skill editor, live transcript, spend per agent, and the Stripe portal link. Spectating what the agent does is the
existing game client in `?spectate=true`.

---

## 10. Observability and operations

- Every runner and service log line is `{ event, agent_id, session_id, game_id, release, … }` JSON. Failure classes
  reuse `classifyTransactionError`, `WorkloadFailureClass`, `WorkloadRevertReason`.
- Per agent per game, a run manifest in the shape of `deploy/madara-lab/harness/report.ts`: actions by kind,
  confirmed/reverted, latency percentiles, LLM calls, tokens, cost, sandbox minutes. Stored as `agent_event` rows and
  visible in the UI.
- Incident loop from `docs/architecture/ai-first-harness-architecture.md`: cluster by stable signature (failure class +
  entrypoint), one issue per cluster, verify after deploy.
- Release: CI builds the runner image (VCR) and tags it with the packages commit; the supervisor pins agents to an image
  tag and rolls forward by restarting sessions. Rollback is pinning the previous tag.

---

## 11. Phases, gates, deletions

| Phase | Build                                                                                                                                                           | Gate                                                                                                                                                                                                          | Deletion                                                                                                                           |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| 0     | `@bibliothecadao/eternum/game-client`; migrate `apps/game` bootstrap and scene action glue onto it; recover the headless smoke as a CI job                      | Web client unchanged in behaviour; headless smoke green in CI; harness passes the 96-bot bar through the client                                                                                               | `HeraldObserver`, harness raw-call and path duplication, app-local copies of the moved files, most of `packages/react` hook bodies |
| 1     | `apps/agent-runner` (Pi + tools); LLM proxy stub; local run as guest on the lab chain                                                                           | One full Blitz played by an agent with a measured cost manifest; steer/compaction/tool-tape verified                                                                                                          | none yet                                                                                                                           |
| 2     | `apps/agent-service` (supervisor, gateway, signing lane, proxy, grant/revoke + audit log); `apps/realms` Agents UI; runner image in VCR; sandbox network policy | Phase-2 §C gate verbatim (grant, revoke mid-game, both in audit log); an agent attached from the UI plays a live lab game inside a sandbox; a killed service leaves no running sandbox after one lease period | `deploy/madara-lab/harness/driver.ts`'s bot loop becomes a thin runner profile (`--policy scripted`) or is deleted                 |
| 3     | Billing: Stripe checkout, webhooks, meter push, budget gates, per-agent usage UI                                                                                | A test-mode customer subscribes, runs two agents in two games, sees per-agent spend, hits a cap and is paused, receives an invoice whose metered quantity equals the ledger sum                               | none                                                                                                                               |
| 4     | Hardening: session cycling under 24 h, image promotion/rollback, incident clustering, skill library                                                             | Ten agents across three concurrent games for a full Eternum day with zero orphan sandboxes and reconciled usage                                                                                               | temporary flags and holds introduced in 1–3                                                                                        |

---

## 12. Decisions taken here, and the alternatives rejected

- **Shared client as a subpath of `packages/core`, not a new package.** Rejected: new `packages/game-client` (the exact
  shape that rotted twice); keeping the code in `apps/game` and importing across the app boundary (what the harness does
  today; it breaks the package graph and cannot be built into an image).
- **Keys never enter the sandbox; a per-owner signing lane signs.** Rejected: rotating the owner's key into each sandbox
  (nonce races across a user's agents, key exposure to LLM-driven code, slow revoke); a registry change to many accounts
  per owner (contract and Herald changes, and it contradicts the phase-2 decision that prizes stay on the one owner
  account).
- **Metering at the firewall `forwardURL` proxy with OIDC identity.** Rejected: per-agent OpenRouter keys inside the
  sandbox (exfiltrable, and OpenRouter's key usage counters are not a ledger); metering in the runner (untrusted).
- **Outbound-only control channel.** Rejected: Axis's per-agent HTTP/SSE server on an exposed port (public URL, inbound
  auth, billable ingress, and a second copy of the transcript).
- **One credit meter covering LLM and compute.** Rejected: separate token and minute meters the user would have to
  understand; seat pricing per agent (the product wants unlimited agents).
- **Wake on diffs, not a fixed tick.** Rejected: `game-agent`'s 60 s tick, which would spend a model call per minute on
  a quiet map.

## 13. Open questions

- UNCONFIRMED: Vercel plan tier and whether `forwardURL` credential brokering is enabled for it; fallback is the
  bearer-token proxy in §7.
- UNCONFIRMED: acceptable per-game cost envelope; Phase 1 exists to measure it before pricing credits.
- UNCONFIRMED: whether Blitz registration requires an L2 entitlement on the production chain for owner-granted agents;
  on the lab chain it is fee-free and the value-plane audit's B1/A1 findings must be closed before an agent can spend a
  user's LORDS.
- Whether agents may talk in world chat via `apps/realtime-server` (its `channels/gameplay-account.ts` already resolves
  identity from the gameplay account, so it would be a policy decision, not new plumbing).
