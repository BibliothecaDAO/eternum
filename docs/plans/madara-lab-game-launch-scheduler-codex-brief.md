# madara-lab game-launch + scheduler — Codex brief

## Goal

Give the madara lab the same on-demand **and** scheduled game-launch layer the appchain has, so the factory page can
launch games on the lab and a rotation keeps live games running. The launcher, the deployer CLI, `game-launch.yml`, and
the Cloudflare run-store worker **already support `madara.blitz`** — it is only excluded from the standing services and
never deployed for the lab. This brief stands those up. (The frontend catalog change is a separate Opus-agent brief:
[[factory-page-redo-frontend-brief]].)

**Systemic framing (KISS).** madara _is_ the appchain — the **dev** deployment; the future mainnet appchain deploys the
same way. So do not build a parallel "madara" path beside "appchain": the launch layer is already
**environment-list-driven** (`madara.blitz` is just another environment). The net change here is a **deletion** — retire
the AWS Lambda `LaunchService` and the appchain-only GH-Actions cron, and let **one env-driven Cloudflare worker** do
dispatch + run-store + scheduling for every environment. Add config rows, don't add code paths.

## Evidence (grounded, lab repo `feat/madara-lab`)

- **Launcher already speaks madara.blitz.** `config/deployer/clean/constants.ts:22-33` defines the `madara.blitz`
  environment (chain `madara`, gameType `blitz`, `world.manifestPath = contracts/l3/game/manifest_madara.json`,
  `world.registrarAddress = 0x23d89ba402b33599107413ddb0f33f0cc38e57dcff4aa3b1989cba12076e9a5`);
  `DEFAULT_MADARA_PRESET_ID = "1"` (constants.ts:11) matches the lab's registered preset. `create_game` is
  `registrar/calls.ts:324-345` via `registrar/preset.ts:606-630`; the engine is `launch/runner.ts` (`createGame`
  :288-319, `launchGame` :391-400). The CLIs are `cli/create.ts` (single game) and `cli/launch-step.ts` (per-step, what
  CI runs). `.context/game-launch/madara-blitz-*.json` are real prior madara launches (e.g.
  `madara-blitz-a3-human.json`: world `0x0750…242b`, but a **local** RPC `127.0.0.1:5050` — a live run must target
  `https://rpc.realms.party/rpc/v0_10_2`).
- **The launch workflow.** `.github/workflows/game-launch.yml` (`workflow_dispatch`) runs
  `bun config/deployer/clean/cli/launch-step.ts` (:473); it binds creds to the GitHub Environment named by the
  `environment` input (:104) — `vars.GAME_LAUNCH_DOJO_ACCOUNT_ADDRESS` + `secrets.GAME_LAUNCH_DOJO_PRIVATE_KEY`
  (:128-136) — and threads `--start-time` (:363, :412). `madara.blitz` is already a workflow `environment` choice.
- **The dispatch + run-store worker.** `config/deployer/clean/run-store/cloudflare-worker.js` — POST `/api/factory/runs`
  validates then dispatches `game-launch.yml` via the GitHub API (:150-197, :2235-2251); GET list/read, series/rotation,
  admin delete. Backing store is a GitHub branch (`factory-runs`) via `run-store/github.ts`, **not** KV/R2. It already
  lists `madara.blitz` in `FACTORY_ENVIRONMENTS` (:24) and has a `scheduled()` cron (:40-42) that today only prunes the
  run store. Env: `GITHUB_TOKEN`, `GITHUB_REPOSITORY`, `GITHUB_WORKFLOW_FILE` (default `game-launch.yml`),
  `GITHUB_WORKFLOW_REF` (default `next`), `FACTORY_RUN_STORE_BRANCH` (default `factory-runs`), `FACTORY_ALLOWED_ORIGIN`,
  `FACTORY_ADMIN_SECRET`.
- **The scheduler today is a GitHub-Actions cron, not AWS.** `.github/workflows/blitz-rotation-tick.yml`
  (`cron: */30 * * * *`) dispatches `game-launch.yml launch_kind=rotation` for **appchain.blitz** with the herald
  (11:00) and nightwatch (20:00) rotation configs. The AWS analog is a Lambda `LaunchService`
  (`deploy/appchain/cdk/lib/dev-stack.ts:392-438`, `ALLOWED_ENVIRONMENTS=appchain.blitz,appchain.eternum`) — being
  retired, and never included madara.
- **Registration windows come from the launch request, not the preset.** `registrar/preset.ts:606-630` +
  `resolveRegistrationSchedule` (:562-565): `registration_start_at ≈ now-1`, open until `start_main_at` (the request's
  start time), `registration_grace_seconds` from the preset/config (overridable via `pointRegistrationGraceSeconds`). So
  a human-joinable game is simply one whose `start_main_at` is set far enough ahead (the rotation's
  `advanceWindowGames: 1` opens each game ~24h early). The harness's ~60s window is just a near-immediate
  `start_main_at`.

## The fix

> **Repo changes vs owner-run operations (keep separate).** Codex lands the repo changes; the owner runs the
> credentialed ops. **Repo:** the registrar/manifest fix (A), the `game-launch.yml` wiring (B), the worker CORS change +
> `wrangler.toml` (C), the worker rotation-config source + madara YAML (D), the preset-registration script +
> constant/default change (E). **Owner-run (needs creds):** creating the GitHub Environment and its vars/secrets,
> deploying the Worker + its secrets, the worker/`chat` DNS, running preset registration against the lab, and the live
> launch gates.

### A. Point launches at the deployed registrar (blocker 1)

- The configured registrar is **stale**: `constants.ts:31` madara `registrarAddress = 0x23d89…e9a5` returns "Contract
  not found" on the live RPC. The **deployed** registrar is the manifest's `s2-registrar_systems`
  `0x765e9ea6caf96b51e28c22337869615e101db8f61665750830c2bf51eb6a553` (world `0x7500…242b`). `calls.ts:72-83` prefers
  the configured address **unless** `GAME_MANIFEST_PATH` is set, in which case it falls back to the manifest (the
  deployed contract) — so launches currently target the missing contract.
- Fix both, so neither path can hit the dead address:
  - Set `GAME_MANIFEST_PATH=contracts/l3/game/manifest_madara.json` in the madara launch env (resolution uses the
    manifest's deployed registrar).
  - Update `constants.ts:31` to `0x765e…a553`, or better **drop the hardcoded madara `registrarAddress`** so the
    manifest is the single source of truth (systemic — one address, not a stale duplicate).

### B. Wire `game-launch.yml` for the lab registrar — RPC + creds explicit (correction 2)

- Add/point a GitHub Environment for `madara.blitz`: `vars.GAME_LAUNCH_DOJO_ACCOUNT_ADDRESS` = the lab
  **registrar/admin** account (the `DOJO_*` `bootstrap-game` used, **not** the binding authority);
  `secret GAME_LAUNCH_DOJO_PRIVATE_KEY` = its key.
- **GitHub Environment vars are not automatically shell env vars** — wire them explicitly in the job, e.g.
  `GAME_LAUNCH_RPC_URL: ${{ vars.RPC_URL }}` with `vars.RPC_URL=https://rpc.realms.party/rpc/v0_10_2`, and export
  `GAME_MANIFEST_PATH=contracts/l3/game/manifest_madara.json` for the step.
- **Gate:**
  `gh workflow run game-launch.yml -f environment=madara.blitz -f launch_kind=game -f game_name=<x> -f game_start_time=<+30m>`
  (the input is **`game_start_time`**, not `start_time`) creates a game on `rpc.realms.party` (run summary has
  `createGameTxHash` + `gameId`), visible in `herald /madara/games` with a ~30-min registration window.

### C. Deploy the dispatch/run-store worker with a real CORS allowlist (blocker 3)

- Deploy `config/deployer/clean/run-store/cloudflare-worker.js` (add a `wrangler.toml` — none exists) with
  `GITHUB_TOKEN` (scoped to dispatch `game-launch.yml` + write the `factory-runs` branch),
  `GITHUB_REPOSITORY=BibliothecaDAO/eternum`, `GITHUB_WORKFLOW_REF=feat/madara-lab` (→ `next` after merge),
  `FACTORY_ADMIN_SECRET`. It already accepts `madara.blitz`.
- **CORS change (worker code — required, the current code cannot satisfy the gate).** `buildCorsHeaders`
  (cloudflare-worker.js:2559) does `FACTORY_ALLOWED_ORIGIN || requestOrigin || "*"` — one literal, reflected, and it
  **never rejects**. Replace with a comma-separated **`FACTORY_ALLOWED_ORIGINS`** allowlist: parse it, **exact-match**
  the request `Origin`, echo only the matched origin into `Access-Control-Allow-Origin` (never a list, never `*`), and
  return **403** for a browser request whose `Origin` is present but not in the list. Set
  `FACTORY_ALLOWED_ORIGINS=https://play.realms.party,https://eternum-game.pages.dev`.
- **Gate:** POST from an allowed origin dispatches + returns a run; `GET ?environment=madara.blitz` lists it; a
  disallowed `Origin` gets **403**; no response ever carries a two-origin ACAO.

### D. Scheduler = worker cron over an explicit config list (blocker 2)

- The worker's `scheduled()` today only prunes the run-store and retries rotations already in the run-store indexes — it
  does **not** know which standing rotations to bootstrap. Add the source: a worker env **`FACTORY_ROTATION_CONFIGS`** =
  comma-separated **repo-relative YAML paths**. On cron, the worker dispatches `game-launch.yml launch_kind=rotation`
  for each (idempotent — the runner fills only missing games).
- **Scope decision (resolves the contradiction).** The worker owns **madara only** for now; **leave
  `blitz-rotation-tick.yml` untouched** — the appchain rotation keeps running (appchain retires on its own schedule, not
  in this brief). When appchain retires, move its configs into `FACTORY_ROTATION_CONFIGS` and delete that workflow. (No
  "retire the appchain cron" here — that was the contradiction.)
- Add `config/deployer/clean/launch-configs/madara-blitz-<name>.yaml` (`environmentId: madara.blitz`, `version: "6"` per
  §E, `advanceWindowGames: 1`, `evaluationIntervalMinutes: 30`, a sane cadence). Set the Worker cron trigger
  (`wrangler.toml [triggers] crons`) to `*/30 * * * *`.
- **Gate:** the worker cron creates the scheduled madara games; repeated ticks create no duplicates; herald shows a ~24h
  joinable window.

### E. Preset alignment — decided (blocker 4)

- **Register madara presets 6 and 7 on the lab** (via `registrar/register-preset`), **switch the madara default +
  rotation to preset 6** (`DEFAULT_MADARA_PRESET_ID` `"1"`→`"6"`; rotation YAML `version: "6"`), and **keep preset 1
  only for the harness** (its fee-free 96-player profile). Then the frontend sends `6`/`7` unchanged — no mapping. The
  frontend brief drops its "map madara → 1" alternative accordingly.

### F. Decommission AWS (owner-gated — destructive)

AWS is done. Once A–E are green:

- Tear down the CDK stack `deploy/appchain/cdk` (the Lambda `LaunchService`, dev-stack.ts:392-438, plus whatever else
  the stack owns — `katana`/`herald.jcndata.com`). `cdk destroy` is **irreversible** and needs the owner's AWS creds,
  which this session does not have — so the owner runs it (or explicitly grants creds). Confirm the lab replaces those
  first (it does: rpc/herald/identity are on the box).
- Follow-up (separate PR): remove `deploy/appchain/**` and drop `appchain.*` env rows once no appchain deployment
  remains. Leave a `TODO(retire-aws)` marker so the removal is tracked.

## Verifiable gate (end to end)

1. Manual `gh workflow run … -f game_start_time=<+30m>` creates a madara game with a joinable window (herald
   `/madara/games`).
2. Worker POST from an allowed origin dispatches + returns a run; a disallowed `Origin` → 403; the client reads status.
3. Worker cron creates the scheduled rotation games from `FACTORY_ROTATION_CONFIGS`; idempotent across ticks.
4. Launches target the deployed registrar `0x765e…a553` (A), on preset 6 (E).
5. A human registers and plays a launched game via the client (madara game-txs use fixed bounds — no fee estimation).

## Non-goals

- The appchain rotation and `blitz-rotation-tick.yml` (untouched here — §D); the AWS _teardown itself_ is §F, not a
  non-goal.
- Ledger/value-plane launches (`LEDGER_*`) — dev-mode only on the lab.
- The frontend catalog/worker-client/preset-send changes — [[factory-page-redo-frontend-brief]].

## What I (Claude) will review

- Launches resolve the **manifest** registrar `0x765e…a553` (A) — the stale constant is fixed or gone; no launch can hit
  `0x23d89…`.
- `game-launch.yml` passes `RPC_URL`/`GAME_MANIFEST_PATH` explicitly (correction 2) and the gate uses `game_start_time`.
- The worker CORS is an exact-match allowlist that echoes one origin and 403s the rest (blocker 3) — no key literal
  committed.
- The worker cron dispatches from `FACTORY_ROTATION_CONFIGS`, madara-only, `blitz-rotation-tick.yml` untouched (blocker
  2); idempotent, joinable window.
- Presets 6/7 registered on the lab, default→6, harness keeps 1 (blocker 4); the `version` the UI sends is registered.
- Repo changes and owner-run ops are cleanly separated.
