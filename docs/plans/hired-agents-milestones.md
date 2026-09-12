# Hired agents — milestone scope

Companion to `hired-agents-architecture-brief.md` (2026-09-12). That document says what and why; this one says in what
order, touching which files, gated by what, and roughly how big. Sizes are engineer-days for one person who knows the
repo, without review or waiting time. They are estimates, and M0 exists partly to correct them.

Conventions: every milestone names its first consumer and its CI gate (the "wired or deleted" rule), and every milestone
that adds code names what it deletes. Each is one PR series against `next`; nothing waits for the whole programme.

---

## Dependency graph and lanes

```
M0 spikes ─┬─► M1a moves ─► M1b views/actions ─► M1c harness+CI ─► M2 runner ─┐
           │                                                                    ├─► M4 delegation ─► M7 hardening
           ├─► M3 control plane (guest-only) ───────────────────────────────────┤
           │                                                                    ├─► M5 LLM proxy ───┘
           └─► M6 billing (Stripe, test mode) ──────────────────────────────────┘
```

Three lanes can run at once after M0: the client lane (M1 → M2), the platform lane (M3 → M5), and the billing lane (M6).
M4 needs M2 and M3. M7 needs everything. With two engineers the critical path is M0 → M1 → M2 → M4 → M7, about nine to
ten weeks; with one, roughly fourteen.

| Milestone | Outcome                                                      | Size (days) | Depends on                          |
| --------- | ------------------------------------------------------------ | ----------- | ----------------------------------- |
| M0        | Unknowns confirmed, three spikes green                       | 4           | —                                   |
| M1a       | App-local sync/account/entry modules live in `packages/core` | 5           | M0                                  |
| M1b       | `createGameClient` with views and actions; web client on it  | 7           | M1a                                 |
| M1c       | Harness on the client; headless smoke in CI; deletions       | 4           | M1b                                 |
| M2        | Agent runner plays a Blitz game locally with a cost manifest | 9           | M1b                                 |
| M3        | Control plane runs guest agents in sandboxes from a UI       | 12          | M0, M2 image contract               |
| M4        | Owner grant/revoke through a signing lane, audited           | 6           | M2, M3                              |
| M5        | LLM proxy meters every call per agent; budgets enforced      | 4           | M3                                  |
| M6        | Stripe subscription + one credits meter; caps pause agents   | 8           | M5 for real usage; scaffold earlier |
| M7        | 24 h cycling, image rollback, incident loop, fleet test      | 8           | all                                 |

---

## M0 — Spikes and decisions (4 days)

Purpose: turn the brief's UNCONFIRMED items into facts before committing to file moves.

Work items

1. **Firewall brokering spike.** `deploy/madara-lab/scripts/probe-sandbox-proxy.ts`: create one sandbox with
   `networkPolicy.allow["openrouter.ai"] = [{ forwardURL }]`, a 40-line proxy using `defineSandboxProxy` from
   `@vercel/sandbox/proxy`, and a single pi-ai `complete()` call through it. Confirms: plan tier supports `forwardURL`,
   the OIDC token carries `sandbox_name`, streaming responses pass, `usage.cost` is present on the last chunk. Fallback
   decision if it fails: bearer-token proxy (brief §7).
2. **Headless client smoke recovery.** Restore
   `git show f5f226cd282^:apps/game/scripts/run-game-sync-headless-smoke.mjs` as
   `packages/core/scripts/run-game-client-headless.mjs` on `HeraldGameSyncTransport` +
   `createMicrotaskGameSyncScheduler`, against `https://herald.realms.party`. Confirms Node 22 `WebSocket` suffices and
   records baseline snapshot/apply timings.
3. **Pi runtime smoke.** `apps/agent-runner` skeleton with `@mariozechner/pi-agent-core` + `pi-ai`, one tool, the
   `openrouter` provider, `steer()` exercised. Confirms package versions and that the runner fits a 1 vCPU / 2 GB
   sandbox.
4. **Decisions recorded** in a continuity ledger `thoughts/ledgers/CONTINUITY_CLAUDE-hired-agents.md`: Vercel
   team/project and region, OpenRouter account and initial model profile, Stripe test-mode account, per-game cost
   envelope target to measure in M2.

Gate: the three probe scripts run from the repo with documented env, and the ledger lists every decision with an owner.

Deletion: none.

---

## M1a — Move the non-UI modules into `packages/core/src/client/` (5 days)

Pure relocations with import rewrites. No behaviour change; the web client is the consumer on day one.

| From (`apps/game/src/`)                    | Lines | Importers    | To (`packages/core/src/client/`) | Notes                                                                                                     |
| ------------------------------------------ | ----- | ------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `sync/game-scope.ts`                       | 104   | 70           | `game-scope.ts`                  | Largest blast radius; mechanical rewrite of `@/sync/game-scope` → `@bibliothecadao/eternum/game-client`   |
| `runtime/world/world-directory.ts`         | 71    | 21           | `world-directory.ts`             | Takes the manifest as input; stops reading `apps/game/env.ts`                                             |
| `runtime/world/herald-http.ts`             | 127   | 14           | `herald-http.ts`                 | Already typed by `sync/herald-http-types.ts`; `fetch` injected                                            |
| `runtime/world/game-registry.ts`           | 76    | 6            | `game-registry.ts`               |                                                                                                           |
| `sync/recs-game-sync-store.ts`             | 272   | 1            | `recs-game-sync-store.ts`        | Drop `@/three/frame-work-owner` and `@/utils/frame-or-timeout`; `createBrowserScheduler` stays in the app |
| `sync/herald-game-sync-session.ts`         | 102   | 2            | `herald-session.ts`              | zustand callbacks become a `GameClientObserver` interface                                                 |
| `account/gameplay-account-submit.ts`       | 191   | 2            | `submit.ts`                      | Accepts any `AccountInterface`; the M4 signing lane reuses it                                             |
| `services/blitz/blitz-settlement-calls.ts` | 113   | 2 (+harness) | `entry.ts`                       | Ends the harness's cross-boundary relative import                                                         |

Also: add the `./game-client` subpath to `packages/core/package.json` exports and `tsup.config.ts`; move the matching
tests (`recs-game-sync-store.parity.test.ts` and its 93 KB fixture, `herald-game-sync-session.test.ts`,
`game-scope.test.ts`) alongside; keep `apps/game`'s `game-sync.ts` (252 lines) and `recs-store-bridge.ts` (365) in the
app for now, they are the React boundary.

Gate: `apps/game` typechecks, builds, and `pnpm test` passes with the moved tests running under `packages/core`
(`pnpm exec vitest run`). `pnpm run knip` clean, no new `ignoreWorkspaces`.

Deletion: the eight app-local files and their app-local tests.

---

## M1b — `createGameClient`, views, actions; web client bootstraps on it (7 days)

Work items

1. `packages/core/src/client/index.ts`: `createGameClient(input)` composing `setup()` from `@bibliothecadao/dojo`,
   `configManager.setActiveGame`, `setGameScope`, the Herald session, `installWorldSpatialProjection`, and
   `provider.setTransactionStreamWaiter`. Mirrors `apps/game/src/init/bootstrap.tsx` steps 1–3, 5, 6 exactly, in the
   same order (`setActiveGame` disposes the active runtime, so it must precede session start).
2. `client/views.ts`: plain functions over RECS for what `packages/react/src/hooks/helpers/*` compute today
   (`use-armies`, `use-structures`, `use-resources`, `use-stamina`, `use-buildings`, `use-trade`, `use-guilds`,
   `use-hyperstructures`, `use-quests`, `use-realm`, `use-resource-arrivals`). Each hook becomes a one-line wrapper over
   its view.
3. `client/actions.ts`: `createGameActions(client)` lifting the orchestration at `three/scenes/worldmap.tsx:1156`
   (`ArmyManager`), `:2603` and `:3323` (`ArmyActionManager` find paths + move), `:3029` (`StructureActionManager`),
   `three/scenes/hexception.tsx:240` (`TileManager`), and the four UI construction sites
   (`military/components/army-management-card.tsx:522`, `existing-armies-panel.tsx:104`,
   `settlement/construction/select-preview-building.tsx:175,281`). Scenes and panels call `client.actions.*`.
4. `apps/game/src/init/bootstrap.tsx` calls `createGameClient` and passes the result to `prepareGameRenderer` and the
   Dojo context; `recs-store-bridge.ts` reads from `client.runtime`.

Gate: the web client plays a lab game with no behaviour change (settle, move, explore, build, trade through the new
paths); existing sync recovery tests in `docs/architecture/sync-s4-recovery-proofs.md` still pass by name; the headless
smoke from M0 now calls `createGameClient` instead of hand-wiring the runtime.

Deletion: manager construction glue in the two scenes and four panels; hook bodies in `packages/react`.

---

## M1c — Harness on the client, headless smoke in CI (4 days)

Work items

1. `deploy/madara-lab/harness/driver.ts` (1,462 lines) uses `client.actions` for settle/provision/explorer/move/
   explore/produce and `client.views` + `client.runtime.waitForTransaction` for state and confirmation. Keep
   `WorkloadFailureClass`, `WorkloadRevertReason`, tick spacing, and `report.ts` untouched.
2. `.github/workflows/test-client.yml` (or a new `test-game-client.yml`) runs the headless smoke against the committed
   parity fixture on every PR touching `packages/core` or `apps/game/src/sync`; a nightly job runs it against a live lab
   game and uploads the JSON result as an artifact.

Gate: `pnpm lab:harness --bots 96 --minutes 10` passes the existing bar (≥3,500 of 3,840 actions) through the client.

Deletion: `deploy/madara-lab/harness/herald-observer.ts` (214 lines), the driver's raw `CallData` builders and the path
planning that duplicates `ArmyActionManager.findActionPaths`, the harness's relative import into `apps/game`.

---

## M2 — Agent runner plays a game locally (9 days)

`apps/agent-runner`, Node 22, Bun for dev. Consumer: the M3 supervisor; until then a CLI.

Work items

1. `src/config.ts`: chain, world, game, Herald/RPC URLs, gateway URL and session token, data dir, model profile. No
   `import.meta.env`.
2. `src/client.ts`: `createGameClient` with `createMicrotaskGameSyncScheduler`, `socketFactory` for Node, an observer
   that logs `{event:"agent_sync_*"}`.
3. `src/signer.ts`: `AccountInterface` implementation. `--guest` mode holds a lane-less local key via
   `ensureGameplayAccount` (self-owned, madara only) for M2; the remote-lane implementation lands in M4 behind the same
   interface.
4. `src/tools/`: `observe`, `list_actions`, `act`, `simulate`, `remember`/`recall`, `report_to_owner`. The action
   catalog is generated from `SystemCalls` keys plus a curated overlay file; `act` routes to `client.actions`.
5. `src/loop.ts`: wake sources (slice-applied deltas filtered to owned entities and reach, direction, heartbeat, phase
   change), delta summariser that gates model calls, `steer()` vs `followUp()`, `transformContext` compaction with
   soul/skills reload from `/data`.
6. `src/soul.ts`, templates for `soul.md` and three starter skills, `/data/memory` tape of every tool response.
7. `src/manifest.ts`: per-game run manifest in the `harness/report.ts` shape plus LLM calls, tokens, USD, wall time.
8. `Dockerfile` for the runner image (Ubuntu base, built packages copied in, no npm at runtime).

Gate: `bun apps/agent-runner --game <lab game> --guest` settles, provisions, and plays a full Blitz game; the manifest
records cost, which becomes the M6 pricing input. Vitest covers the delta gate (no model call on an empty delta), the
catalog generator, and steer-vs-followUp selection.

Deletion: none; this is the first new surface.

---

## M3 — Control plane, guest agents only (12 days)

`apps/agent-service` on the box, cloned from `apps/launch-service` (Bun, Hono, Effect, `pg`, systemd). Consumer:
`apps/realms` Agents route.

Work items

1. **Schema** in `packages/db/src/schema/agents.ts`: `agent`, `agent_skill`, `agent_attachment`, `agent_direction`,
   `agent_event`, `agent_session` (the job row: status, attempts, `claimed_until`, `lease_token`, `sandbox_name`,
   `image_tag`). `agent_usage` and `billing_customer` are added in M5/M6 but can be stubbed here. `drizzle-kit push` via
   the existing `with-env` script.
2. **Service scaffold**: `src/{config,main,app,auth,store,worker}.ts` copied from launch-service with the job type
   changed; identity check reuses `IDENTITY_URL` session verification; CORS from `api-cors.ts` pattern.
3. **Supervisor** `src/sessions/`:
   `Sandbox.getOrCreate({ name: agent_<id>, source: image, networkPolicy, timeout, keepLastSnapshots: {count: 1}, onCreate: seed /data, onResume: start runner detached })`;
   stop on detach, game end, lease loss; `Sandbox.list` reconciliation on boot so a crashed service finds its VMs.
4. **Gateway** `src/gateway/`: WebSocket upgrade with per-session token; persists `transcript`/`decision`/`status`
   events; delivers queued directions; marks `delivered_at`.
5. **Network policy**: allow `herald.realms.party`, `rpc.realms.party`, gateway host; `openrouter.ai` with the M5
   `forwardURL` (a plain allow until M5 lands).
6. **Image pipeline**: `.github/workflows/build-agent-runner-image.yml` builds and pushes the runner image to Vercel
   Container Registry tagged with the commit; `agent_session.image_tag` pins it.
7. **Deploy**: `deploy/madara-lab/systemd/realms-agents.service`, add to `deploy-box.sh`'s service map (port 3007),
   `deploy-box.yml` path filter.
8. **UI** in `apps/realms/src/routes/agents.tsx` (+ `agents.$id.tsx`): hire (name, soul, skills picker), attach to a
   game from the Herald directory, direction box, live transcript over SSE, detach. Effect-TS service layer per the
   webapp brief.

Gate: from the UI, hire a guest agent, attach it to a lab game, watch it settle and act in the transcript, detach and
see the sandbox stop within one lease period; kill the service mid-game and confirm no sandbox outlives one lease period
after restart. Structured logs `agent_session_{claimed,started,stopped,lost}` present.

Deletion: the harness bot loop is superseded once the supervisor can run `--policy scripted` runners; delete it in M7
after the fleet test confirms parity.

---

## M4 — Owner delegation through a signing lane (6 days)

Implements phase-2 §C on top of M2 and M3. Consumer: the "let this agent play for me" button.

Work items

1. `apps/agent-service/src/signing/`: per-owner lane holding a lane-generated stark key,
   `configureGameplayAccountSubmits` from `packages/core/src/client/submit.ts`, one nonce dispenser, an
   `agent_signed_call` audit row per submission (agent, game, entrypoints, hash, outcome).
2. Grant/revoke on the authority server `apps/realms/server/binding.ts`: `grantAgent(owner, agentId)` rotates the
   owner's account to the lane key and logs `gameplay_account_key_rotated` with `agent_id`; `revokeAgent` rotates to a
   fresh owner key and closes the lane. Both write `agent_attachment.grant_kind = "owner"` and the audit log.
3. Runner `src/signer.ts` remote implementation: `{calls, gameId, idempotencyKey}` over the gateway, hash back,
   confirmation via the runner's own Herald `tx` channel.
4. Web client UX for "session moved to another device or agent — reconnect" in
   `apps/game/src/hooks/context/gameplay-account-sync.tsx`, using the existing invalid-signature → rotate path.
5. UI rule: one agent per user per game (settlement reserves one seat per owner).

Gate: the phase-2 brief's gate verbatim: the agent plays one lab game as a wallet-owned account through a grant; the
owner revokes mid-game; the agent's next action fails and the owner's client reconnects and continues; both events are
in the audit log. Adversarial test: a runner cannot submit for an owner whose grant is revoked even if it still holds a
gateway token.

Deletion: the M2 `--guest` local-key path collapses into a lane-held guest key, leaving one signer implementation.

---

## M5 — LLM proxy and metering (4 days)

Work items

1. `apps/agent-service/src/llm-proxy/`: `defineSandboxProxy` handler; verifies OIDC (`aud`, issuer, expiry); resolves
   `sandbox_name` → agent → owner; rejects paused or over-budget agents with a structured error the runner surfaces;
   replaces `Authorization`; forwards; on the final chunk writes
   `agent_usage(kind: llm, source_ref: generation id, quantity: tokens, unit_cost_usd from usage.cost, credits)`.
2. Model routing table `model_profile(name, plan_model, react_model, chat_model)`; runner reads its profile from the
   gateway `config` message, never from an env var.
3. Nightly reconciliation job: rows without cost are backfilled from `GET /api/v1/generation?id=`.
4. Compute metering: the supervisor writes `agent_usage(kind: compute)` on every session stop from provisioned vCPU ×
   minutes at the region's list price.
5. Budget evaluator: per-agent hourly cap, per-user monthly cap; exhaustion sets `agent.status = paused`, stops the
   sandbox, emits `agent_paused_budget`.

Gate: every model call in a lab game has exactly one `agent_usage` row; the sandbox has no OpenRouter key in its
environment or filesystem (assert in a test that greps the image); a capped agent pauses within one call of the cap.

Deletion: the M3 plain allow for `openrouter.ai` becomes the `forwardURL` rule; the runner's placeholder key handling is
the only credential code left.

---

## M6 — Billing (8 days)

Stripe test mode can start alongside M3; real usage flows once M5 lands.

Work items

1. Stripe objects (scripted, idempotent, in `apps/agent-service/scripts/stripe-bootstrap.ts`): product, flat monthly
   price, meter `agent_credits` (sum, `customer_mapping.by_id`, `value_settings.event_payload_key = value`), metered
   price on the same product.
2. `billing_customer` table and `src/billing/`: `POST /api/billing/checkout` (Checkout session with both prices),
   `POST /api/billing/portal`, webhook handler for `checkout.session.completed`,
   `customer.subscription.{created, updated,deleted}`, `invoice.paid`, `invoice.payment_failed` with signature
   verification and idempotent event ids.
3. Meter push worker: every few minutes, unsent `agent_usage` rows → `POST /v1/billing/meter_events` with
   `identifier = usage.id`; records `stripe_meter_event`; retries the unsent set.
4. Plan rules: no active subscription → cannot attach; included credits per month; user-settable monthly cap defaulting
   from the plan; `agent.status = paused` on cap or `payment_failed`.
5. UI: subscribe/manage buttons, per-agent spend this period, per-user total vs cap, paused banners with the reason.

Gate: a test-mode customer subscribes, runs two agents in two games, hits a low cap and both pause; the upcoming
invoice's metered quantity equals the ledger sum for the period (`GET /v1/billing/meters/{id}/event_summaries` vs a SQL
sum); a webhook replay does not double-apply.

Deletion: none. Note for later: if prepaid packs or enterprise contracts appear, move the meter to Metronome; the
`agent_usage` ledger is unchanged.

---

## M7 — Hardening and launch readiness (8 days)

Work items

1. Session cycling: supervisor stops and resumes sessions before the 24 h Pro limit for Eternum-format games; runner
   resumes from `/data` and the Herald `resume{epoch,seq}` boundary without a full re-snapshot where possible.
2. Image promotion and rollback: `image_tag` per session; a `POST /api/admin/rollout {tag}` that restarts sessions in
   waves; rollback is the previous tag.
3. Incident loop per `docs/architecture/ai-first-harness-architecture.md`: cluster `agent_event(kind: error)` by failure
   class + entrypoint; one issue per cluster; verify after rollout.
4. Fleet test: ten agents across three concurrent lab games for a full Eternum day; zero orphan sandboxes; ledger
   reconciles to the proxy log and to Stripe summaries; cost per agent-day recorded.
5. Runbook in `apps/agent-service/README.md`: env, deploy, pause-all, rotate keys, drain sandboxes, replay webhooks.
6. Skill library: starter skills promoted from M2 templates; user-editable in the UI; agent-proposed edits are surfaced
   for approval, not applied silently.

Gate: the fleet test passes; the runbook's pause-all and drain commands are exercised during it.

Deletion: the harness bot loop (`driver.ts` workload section) if the scripted runner profile matches its acceptance bar;
any temporary flags, holds, or timers introduced in M2–M6.

---

## Risks that change the plan

- **`forwardURL` unavailable on the plan** (M0 finds out): M5 becomes a bearer-token proxy; sandboxes hold a per-agent
  token with an OpenRouter provisioning-key limit as the second ceiling. Two extra days.
- **`game-scope` rewrite blast radius** (70 importers): mechanical but wide; do it as its own PR with a codemod and no
  other change.
- **Runner memory in 2 GB**: RECS for a 96-player game is ~5,155 rows; the web client's 371–406 MB heap is renderer and
  asset weight, not RECS. If M0's spike shows otherwise, provision 2 vCPU / 4 GB and re-price credits.
- **Value-plane audit findings (B1, A1)**: owner-granted agents on the production chain must not spend LORDS until those
  are closed. M4 ships against the lab chain; production grants are a separate go/no-go.
- **Per-game LLM cost** unknown until M2. The delta gate in the loop is the lever; if a Blitz game exceeds the target,
  cheaper `react` models and longer quiet windows come before any architectural change.
