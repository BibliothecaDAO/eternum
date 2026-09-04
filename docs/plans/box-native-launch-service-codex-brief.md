# Box-native launch service — Codex brief

> 2026-09-03: the AWS appchain and its GitHub launch path (`game-launch.yml`, `blitz-rotation-tick.yml`, the Cloudflare
> run-store worker, `factory-run-store-prune.yml`) are deleted. The box launch service is the only launcher; mentions of
> the old path below are history.

## Goal

Replace the serverless launch stack for **madara** — the Cloudflare **run-store/dispatch worker**, the
**`game-launch.yml`** workflow, the **`blitz-rotation-tick.yml`** cron, and the **`factory-run-store-prune.yml`** cron —
with **one always-on box service**, the same shape as herald / identity / chat. It authenticates launchers, persists
launches durably, runs `create_game` on the box, and ticks the rotation locally. **Prod has the same shape** (owner: the
lab is dev, production is the same architecture) — own-infra everywhere, serverless nowhere.

## Implementation standard: Effect

Owner mandate: **TypeScript services use Effect.** Build this in Effect (typed errors, `Layer`/services for
identity/RPC/herald/db/registrar, `Schema` for the API, structured concurrency for the job worker), matching
`apps/realms` and the chat rework. It's a service, not a React app.

## Why (the serverless stack is fragile and it isn't ours)

The current design stitches Cloudflare (public API + GitHub-token holder + dispatcher) + GitHub Actions (execution) + a
git-branch run-store, **because production owns no always-on compute**. We do. Live evidence, all hit trying one lab
launch through the CI path: a **build-ordering failure** (`packages/types` now needs `@realms-world/chain` built first;
fixed at `179e0772`), then a missing **`HERALD_URL`** GitHub var, then `create.ts`'s CLI **hard-requiring a ledger** the
L2-deferred lab doesn't have. Each is env/secret plumbing or CLI over-validation that a box service — with herald, the
deployer, the registrar key, the RPC, and Postgres all local — doesn't have. (The launch _runner_ itself already skips
the ledger for dev-mode — see §5 — so this is a CLI concern, not a runner one.)

## Current state (grounded)

- **Worker** `config/deployer/clean/run-store/cloudflare-worker.js`: serves `/api/factory/runs` (+ series/rotation),
  dispatches `game-launch.yml`, stores `FactoryRunRecord`s on the `factory-runs` git branch. The client
  (`apps/game/.../factory-v2/api/factory-worker.ts`) speaks this via a **single** `VITE_PUBLIC_FACTORY_WORKER_URL`, and
  its request contract is **`gameName` + `gameStartTime`** (`create-run-request.ts`), not `start_main_at`.
- **Executor** `game-launch.yml` → `launch-step.ts` → `launchGame()` (`launch/runner.ts`) → `createRegistrarGame`. The
  runner **already permits no ledger when `devModeOn`** (`runner.ts:190` returns early when `ledgerRpcUrl` is unset).
- **Launch state is filesystem-backed today** — `writeLaunchSummary` → `.context/game-launch/*.json` (`launch/io.ts`).
- **Scheduler** `blitz-rotation-tick.yml` (`*/30`); **pruner** `factory-run-store-prune.yml` (`30 5`).
- **The box** runs herald (`:3003`), identity (`:3000`), chat (`:3005`), the sequencer, Postgres — registrar dev key
  local, direct RPC.

## The service

A Bun/Effect service (`apps/launch-service/`), `realms-launch.service` on `:3006`, tunnel `launch.<domain>`. Reuses the
deployer's launch logic.

### 1. Authentication & authorization (mutations are not public)

The service holds the **registrar key** (game-admin power). **CORS is not authentication** — a non-browser caller can
omit/spoof `Origin`. So:

- **Every mutation** (`POST /api/factory/runs`, series/rotation POSTs, delete/cancel) requires **both** a **verified
  Better Auth session** (the `.realms.party` cookie → identity `get-session`, exactly the chat's `VerifiedIdentity`
  resolver) **and** an **explicit launcher allowlist/role** — only allowlisted addresses may launch, not every signed-in
  player. Define `LAUNCHER_ALLOWLIST` (addresses) or a role claim; reject others with 403.
- **Public reads** (`GET` run status/list) stay open, browser-gated by the CORS allowlist (`play.realms.party`,
  `eternum-game.pages.dev`) — same contract as identity/chat.

### 2. Per-environment client routing (this is a client change — not "unchanged")

The client has one `VITE_PUBLIC_FACTORY_WORKER_URL`, but madara → box and appchain → worker. **Route per environment in
the client** (recommended): a map `environment → endpoint` (`madara.blitz → https://launch.<domain>`, `appchain.* →` the
existing worker URL) in `factory-v2/api/factory-worker.ts`'s base-URL resolution. Keep the `gameName`/`gameStartTime`
request contract unchanged.

### 3. Durable launch execution (a queued job, not an inline fiber)

An in-process Effect fiber loses launches if the service dies mid-`create_game`. So:

- `POST` **persists a queued job** (Postgres) and returns **`202`** with the run id/status — it does not run inline.
- A **worker loop claims jobs with a lease** (a `claimed_until` timestamp), so exactly one runs at a time and a crash
  can't double-submit. It runs `launchGame()` via the Effect layers, **serializing registrar writes** (single-writer via
  the lease), and **recovers abandoned jobs** (expired lease) on restart.
- Clients poll the existing `GET` run route for status — same shape (`FactoryRunRecord`) as today.

### 4. Shared persistence interface (one store, two backends)

Launch summaries are filesystem-backed (`.context/game-launch`). A Postgres store must not be a **second copy**. Define
a **`RunStore` interface** (read/write run records **and** jobs) with two implementations — **filesystem** (CLI/workflow
use) and **Postgres** (box service). The launcher writes through the interface; the service injects the pg impl (its own
DB, isolated like chat's), the CLI the fs impl.

### 5. Run `create_game` via the runner's dev-mode path

Call `launchGame()`/the runner directly (not `create.ts`'s CLI). The runner already skips the ledger when `devModeOn`
(`runner.ts:190`) — **pass `devModeOn`; do not add a ledger-optional path or reimpose the CLI's ledger check**. Use the
existing `gameName`/`gameStartTime` inputs (open registration from creation until `gameStartTime` — default a ~15-min
lead so a human can register). `HERALD_URL` (local) for the GameRegistry idempotency check; `GAME_MANIFEST_PATH` for the
manifest-authoritative registrar (`0x765e…`).

### 6. Rotation as a local oneshot (not an HTTP endpoint)

A `realms-launch-rotation.timer` runs a **oneshot command** (`ExecStart` of a CLI that evaluates the rotation via the
**same Effect layers in-process** and enqueues missing games) — **not** the timer calling an unauthenticated HTTP
endpoint. Idempotent (fills only the advance-window gap).

### 7. Retire madara dispatch only

The box service handles **madara**. **Keep** the Cloudflare worker + `game-launch.yml` + `blitz-rotation-tick.yml` +
`factory-run-store-prune.yml` **for appchain** until appchain migrates; retire only the **madara** dispatch/config +
`madara.blitz` from the worker's env now.

## Own-infra migration inventory (surveyed)

Rule: **runs our runtime logic** (launches, rotations, our data — needs our keys/RPC/DB, always-on) → **box service**;
**ships artifacts from source** (build/test/lint/deploy/release) → **CI**.

| Piece                                                       | Today                        | Verdict                                         |
| ----------------------------------------------------------- | ---------------------------- | ----------------------------------------------- |
| `game-launch.yml` / worker / rotation-tick / prune          | serverless (madara+appchain) | → **box service for madara**; keep for appchain |
| AWS Lambda `LaunchService` (`deploy/appchain/cdk`)          | AWS                          | → **delete** (dies with AWS)                    |
| `daily-digest.yml`                                          | GH cron, Python over commits | **stays CI** — repo tooling, not game runtime   |
| `deploy-client.yml`, `release-*`                            | GH → Pages/registry          | **stays CI** — ships artifacts                  |
| `deploy-factory-worker.yml`                                 | GH → CF worker               | keep while the worker serves appchain           |
| `knip / lint / pr-agent / test-* / verify-terrain / claude` | GH PR                        | **stays CI** — hermetic per-commit checks       |

Beyond launch there is no other hidden service to migrate; herald/identity/chat/sequencer are the pattern.

## Verifiable gate

- A **mutation without a verified session, or from a non-allowlisted address**, is rejected (401/403); a spoofed/omitted
  `Origin` cannot launch. Public `GET` reads work.
- An authorized `POST /api/factory/runs {environment:"madara.blitz", gameName, gameStartTime:+15m}` returns **`202`**;
  the worker claims + runs it; a **preset-6** game appears in herald `/madara/games` (96-cap, joinable window) — **no
  GitHub Actions, no Cloudflare worker**. Killing the service mid-launch and restarting **recovers** the job (no lost or
  double launch).
- The client routes `madara.blitz` → the box, `appchain.*` → the worker; disallowed origin → CORS-blocked.
- The rotation timer (oneshot) enqueues missing games idempotently; run records live in the shared `RunStore` (pg on the
  box), not a second copy.

## Sequencing / owner-gated

1. Build the service (auth + durable job queue + `RunStore` interface + runner dev-mode path + rotation oneshot), in
   Effect.
2. Box rollout (I own it): systemd unit + rotation timer, tunnel `launch.<domain>` + ufw, DB, the client per-env routing
   - redeploy. **DNS `launch.<domain>` is owner-gated** (CF dashboard/`cloudflared route`). The **launcher allowlist**
     values are owner-provided.
3. Retire the madara dispatch/config; leave appchain on the serverless path.
