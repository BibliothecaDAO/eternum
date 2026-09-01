# Box-native launch service — Codex brief

## Goal

Replace the serverless launch stack — the Cloudflare **run-store/dispatch worker**, the **`game-launch.yml`** workflow,
the **`blitz-rotation-tick.yml`** cron, and the **`factory-run-store-prune.yml`** cron — with **one always-on box
service**, the same shape as herald / identity / chat. It serves the factory API, runs `create_game` **directly**, keeps
its run-store in Postgres, and ticks the rotation on a systemd timer. **Prod has the same shape** (owner: the lab is
dev, production is the same architecture) — own-infra everywhere, serverless nowhere.

## Implementation standard: Effect

Owner mandate: **TypeScript services use Effect.** Build this in Effect (typed errors, `Layer`/services for the
RPC/herald/db/registrar dependencies, `Schema` for the API, structured concurrency for the rotation tick), matching
`apps/realms`. It's a service, not a React app.

## Why (the serverless stack is fragile and it isn't ours)

The current design stitches Cloudflare (public API + GitHub-token holder + dispatcher) + GitHub Actions (execution) + a
git-branch run-store, **because production owns no always-on compute**. We do. Live evidence, all hit while trying one
lab launch:

- `game-launch.yml` built only `packages/types`, which now imports `@realms-world/chain` → **CI build-ordering failure**
  (`Cannot find module @realms-world/chain`). Fixed by falling back to the full `build:packages` (`179e0772`), but the
  box has everything built already — that whole class of failure vanishes.
- Next: the workflow needed **`HERALD_URL`** as a GitHub Environment var it didn't have. The box has herald locally.
- Then the box CLI (`create.ts`) **hard-requires a ledger** (`--ledger`/`LEDGER_*`), but the lab is **L2-deferred** — no
  ledger. The bot harness launches dev-mode games without one; the single-game CLI can't. **This is the core gap the
  service must close.**

Each of those is env/secret plumbing or a code path that a box service — with herald, the deployer, the registrar key,
the RPC, and Postgres all local — simply doesn't have.

## Current state (grounded)

- **The worker** `config/deployer/clean/run-store/cloudflare-worker.js`: serves `/api/factory/runs` (+ series/rotation),
  dispatches `game-launch.yml` via the GitHub API, stores `FactoryRunRecord`s on the `factory-runs` git branch, crons
  run-store maintenance. The client (`apps/game/.../factory-v2/api/factory-worker.ts`) speaks this API via
  `VITE_PUBLIC_FACTORY_WORKER_URL`.
- **The executor** `game-launch.yml` → `bun config/deployer/clean/cli/launch-step.ts` → the deployer's `launchGame()`
  (`launch/runner.ts`) → `createRegistrarGame` (`registrar/calls.ts`). Needs `DOJO_*`, `RPC_URL`, `GAME_MANIFEST_PATH`,
  `HERALD_URL`, and (today) a ledger.
- **The scheduler** `blitz-rotation-tick.yml` (`cron: */30`) dispatches rotations from YAML configs.
- **The pruner** `factory-run-store-prune.yml` (`cron: 30 5`) trims the git-branch store.
- **The box** already runs herald (`:3003`), identity (`:3000`), chat (`:3005`), the sequencer, and Postgres — with the
  registrar dev key available (`bootstrap-game.sh` defaults) and direct RPC.

## The service

A Bun service (`apps/launch-service/`, or `apps/realms-launch/` — pick one), a `realms-launch.service` systemd unit on a
new port (e.g. `:3006`), fronted by the tunnel at `launch.<domain>`. Reuses the deployer's launch logic; adds nothing
the box doesn't already have.

### 1. Factory API (client unchanged)

Serve the routes the client already calls — `POST /api/factory/runs`, `GET /api/factory/runs?environment=`,
`GET /api/factory/runs/<env>/<name>`, series/rotation, admin delete — with the same request/response shapes
(`FactoryRunRecord`). Credentialed CORS allowlist (`play.realms.party`, `eternum-game.pages.dev`), exact-match, 403 —
same contract as identity/chat. Set `VITE_PUBLIC_FACTORY_WORKER_URL` → `https://launch.<domain>`.

### 2. Run `create_game` directly (close the dev-mode gap)

On `POST`, call the deployer's `launchGame()` in-process (no workflow, no CI build). Requirements the current CLI
misses:

- **Ledger-optional / dev-mode.** When the environment is L2-deferred (no `LEDGER_*`), launch the L3 game **without**
  the ledger relay — mirror the harness's dev-mode path and the ledger-optional pattern already in `register-preset.ts`
  (`resolveOptionalLedgerTarget`). Do not hard-require `--ledger`.
- **Human-joinable window.** Take `start_main_at` from the request and open registration from creation until then (the
  launcher already derives `registration_start_at ≈ now-1`); default a sane lead (e.g. 15 min) so a person can register,
  not the harness's ~60 s.
- `HERALD_URL` (local herald) for the GameRegistry idempotency check; `GAME_MANIFEST_PATH` for the
  manifest-authoritative registrar (`0x765e…`).

### 3. Run-store in Postgres (replaces the git branch + the pruner)

Store run records in the box Postgres (its own DB, isolated like chat's — so its migrations can't collide with
herald/identity). Serve them from there. Retention/prune is a query on a timer, not a separate cron/workflow.

### 4. Rotation on a systemd timer (replaces `blitz-rotation-tick.yml`)

A `realms-launch-rotation.timer` (e.g. every 30 min) drives the same idempotent rotation evaluation (fills only missing
games in the advance window) from a config list — in-process, calling `launchGame()`. No GitHub dispatch.

### 5. Retire the serverless pieces (per environment)

For **madara/dev** now, and **prod** when it lands: the box service is the launcher. `game-launch.yml`, the Cloudflare
worker, `blitz-rotation-tick.yml`, and `factory-run-store-prune.yml` are decommissioned **once the box service covers
their environment** (leave them for appchain until it retires with AWS).

## Own-infra migration inventory (the owner's "what else?" — surveyed)

The rule: **runs our runtime logic (game state, launches, our data, on a schedule or request) → box service** (needs our
keys/RPC/DB, always-on — the box has them). **Produces/ships artifacts from source (build/test/lint/deploy/release) →
CI** (hermetic, per-commit, PR-gated — stays in GitHub Actions).

| Piece                                                        | Today                                   | Verdict                                       |
| ------------------------------------------------------------ | --------------------------------------- | --------------------------------------------- |
| `game-launch.yml`                                            | GH workflow (execution)                 | → **box launch service** (this brief)         |
| `blitz-rotation-tick.yml`                                    | GH cron `*/30`                          | → **box** (systemd timer in the service)      |
| `factory-run-store-prune.yml`                                | GH cron `30 5`                          | → **box** (Postgres retention query)          |
| `cloudflare-worker.js` (run-store/dispatch)                  | CF worker                               | → **box** (the service's API + store)         |
| AWS Lambda `LaunchService` (`deploy/appchain/cdk`)           | AWS                                     | → **delete** (dies with AWS)                  |
| `daily-digest.yml`                                           | GH cron `0 17`, Python over git commits | **stays CI** — repo tooling, not game runtime |
| `deploy-client.yml`                                          | GH dispatch → Pages                     | **stays CI** — ships an artifact              |
| `deploy-factory-worker.yml`                                  | GH dispatch → CF worker                 | → **delete** (no worker)                      |
| `release-game.yml`, `release-packages-on-changelog.yml`      | GH push/dispatch                        | **stays CI** — releases                       |
| `knip / lint / pr-agent / test-* / verify-terrain / claude*` | GH PR                                   | **stays CI** — hermetic per-commit checks     |

So beyond launch, there's no _other_ hidden service to migrate — the launch service absorbs the four launch-related
serverless pieces, the AWS Lambda + the worker-deploy get deleted, and everything else is legitimately CI. The
already-migrated set (herald, identity, chat, sequencer) is the pattern this follows.

## Verifiable gate

- A dev-mode (no-ledger) `POST /api/factory/runs {environment:"madara.blitz", game, start_main_at:+15m}` creates a
  **preset-6** game on the lab (herald `/madara/games` shows it, 96-player cap, ~15-min joinable window) — **no GitHub
  Actions, no Cloudflare worker involved**.
- The client's factory page launches against `launch.<domain>` unchanged; disallowed origin → 403.
- The rotation timer fills missing games idempotently; run records are in Postgres and served over the API.
- `game-launch.yml` / the worker / the two crons are no longer needed for madara.

## Sequencing / owner-gated

1. Build the service (API + `launchGame()` in-process + dev-mode ledger-optional + Postgres store), in Effect.
2. Box rollout (I own it): systemd unit, tunnel ingress `launch.<domain>` + ufw, DB, `VITE_PUBLIC_FACTORY_WORKER_URL`
   flip + client redeploy. **DNS `launch.<domain>` is owner-gated** (like chat/app — CF dashboard or
   `cloudflared route`).
3. Retire the serverless pieces for madara.

No Cloudflare token, no worker GitHub token, no GitHub Environment secrets needed once this lands — the box holds
everything.
