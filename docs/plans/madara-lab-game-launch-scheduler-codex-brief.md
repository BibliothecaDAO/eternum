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

### A. Wire `game-launch.yml` for the lab registrar

- Add a GitHub Environment (or input→env binding) for `madara.blitz` carrying: `GAME_LAUNCH_DOJO_ACCOUNT_ADDRESS` = the
  lab **registrar/admin** account (the `DOJO_ACCOUNT_ADDRESS` `bootstrap-game` used — **not** the binding authority),
  `secret GAME_LAUNCH_DOJO_PRIVATE_KEY` = its key, and pass `RPC_URL=https://rpc.realms.party/rpc/v0_10_2` to the CLI.
- Verify the deployed lab registrar equals `constants.ts` `registrarAddress 0x23d89ba…` and that the committed
  `contracts/l3/game/manifest_madara.json` `world.address = 0x0750…242b`; reconcile whichever is stale.
- **Gate:**
  `gh workflow run game-launch.yml -f environment=madara.blitz -f launch_kind=game -f game_name=<x> -f start_time=<+30m>`
  creates a game on `rpc.realms.party` (run summary has `createGameTxHash` + `gameId`), visible in
  `herald /madara/games` with a ~30-min registration window.

### B. Deploy a run-store/dispatch worker for the lab

- Deploy `config/deployer/clean/run-store/cloudflare-worker.js` as a Cloudflare Worker (e.g. `launch.realms.party`) with
  `GITHUB_TOKEN` (a GitHub App/PAT scoped to dispatch `game-launch.yml` + write the `factory-runs` branch),
  `GITHUB_REPOSITORY=BibliothecaDAO/eternum`, `GITHUB_WORKFLOW_REF=feat/madara-lab` (→ `next` after merge),
  `FACTORY_ALLOWED_ORIGIN=https://play.realms.party` (also allow `https://eternum-game.pages.dev`),
  `FACTORY_ADMIN_SECRET`. It already accepts `madara.blitz`. Add a `wrangler.toml` under
  `config/deployer/clean/run-store/` (the repo has no wrangler config today) and a deploy step.
- The client reaches it via `VITE_PUBLIC_FACTORY_WORKER_URL` (set in the frontend brief).
- **Gate:** `POST /api/factory/runs {environment:"madara.blitz", …}` dispatches `game-launch.yml` and returns a run
  record; `GET /api/factory/runs?environment=madara.blitz` lists it; a disallowed Origin is rejected.

### C. Scheduler as a Cloudflare Worker cron (owner's preference over the GH-Actions cron)

- Extend the worker's `scheduled()` (`handleScheduledFactoryMaintenance`, cloudflare-worker.js:40-42) to also **tick a
  madara blitz rotation**: on cron, dispatch `game-launch.yml launch_kind=rotation` for a madara rotation config,
  reusing the worker's existing GitHub-dispatch path — exactly what `blitz-rotation-tick.yml` does via
  `gh workflow run`, but from the worker. This keeps scheduling in Cloudflare (own infra) and drops the GH-Actions cron
  for the lab.
- Add a rotation config `config/deployer/clean/launch-configs/madara-blitz-<name>.yaml` mirroring
  `appchain-blitz-herald.yaml` but `environmentId: madara.blitz`, `version: "1"` (lab preset), a sane cadence (e.g. one
  game every few hours, or 11:00/20:00 like appchain), `durationSeconds`, `advanceWindowGames: 1`,
  `evaluationIntervalMinutes: 30`. The runner is idempotent (fills only missing games), so frequent ticks are safe.
- Set the Worker cron trigger (`wrangler.toml [triggers] crons`) to the evaluation interval (e.g. `*/30 * * * *`).
- **Alternative (note, not recommended):** add a madara entry to `blitz-rotation-tick.yml` — simpler, but a GH-Actions
  cron, not the worker the owner asked for.
- **Gate:** the worker cron creates the scheduled madara games on time; repeated ticks create no duplicates; herald
  shows upcoming games with a ~24h joinable window.

### D. Preset alignment with the frontend

- The lab registered **preset 1** (fee-free 96-player); `DEFAULT_MADARA_PRESET_ID="1"` matches, so a no-`--version`
  launch uses it. But the factory catalog offers Regular Fast/Duel as registrar **versions 6/7** (frontend brief). Pick
  one and keep both briefs consistent: **either** register the same presets (6/7, …) on the lab via
  `registrar/register-preset` so the catalog is identical across chains (recommended), **or** the frontend maps
  `madara.blitz` launches to preset `1`. Whatever the UI sends as `version` must be registered on the lab.

## Credentials / owner-gated

- The lab **registrar/admin private key** must reach the launcher. In the AWS-mirroring design it becomes a GitHub
  Environment secret (`GAME_LAUNCH_DOJO_PRIVATE_KEY`) and the worker holds a `GITHUB_TOKEN`. This key has game-admin
  power on the lab — **owner decides** whether to place it in GitHub secrets. (It is a dev-mode lab with no funds, so
  the exposure is bounded, like the committed deployer/binding keys — but it is still an admin key.)
- **Design fork (flag for owner):** run launches in **GitHub Actions** (key in GitHub, mirrors AWS — recommended now)
  vs. **on the box** (key stays on the box; the worker cron would call a box endpoint instead of dispatching a workflow
  — more own-infra, more new code). This brief assumes GitHub Actions.

### E. Decommission AWS (owner-gated — destructive)

AWS is done. Once the CF worker + `game-launch.yml` madara path (A–C) are green:

- Tear down the CDK stack: `deploy/appchain/cdk` (the Lambda `LaunchService`, dev-stack.ts:392-438, plus whatever else
  the stack owns — this is where `katana`/`herald.jcndata.com` live). `cdk destroy` is **irreversible** and needs the
  owner's AWS credentials, which this session does not have — so the actual destroy is the owner's to run (or explicitly
  grant creds). Confirm the lab fully replaces those services first (it does: rpc/herald/identity are all on the box).
- Follow-up (separate PR): remove `deploy/appchain/**` and the AWS-only branches from the repo, and drop `appchain.*`
  from the environment lists once no appchain deployment remains — that is the deletion the systemic framing calls for.
  Keep it out of this brief's scope beyond leaving a `TODO(retire-aws)` marker so the removal is tracked.

## Verifiable gate (end to end)

1. Manual `workflow_dispatch` creates a madara game with a joinable window (herald `/madara/games`).
2. Worker POST creates + dispatches a run; the client can read its status.
3. Worker cron creates the scheduled rotation games; idempotent across ticks.
4. A human registers and plays a launched game via the client (madara game-txs already use fixed bounds — no fee
   estimation, so this works).

## Non-goals

- The appchain rotation itself (it keeps running until its own retirement); AWS teardown is §E, not a non-goal.
- Ledger/value-plane launches (`LEDGER_*`) — dev-mode only on the lab.
- The frontend catalog/worker-client/preset changes — [[factory-page-redo-frontend-brief]].

## What I (Claude) will review

- `game-launch.yml` madara env carries the registrar creds + `RPC_URL`; no key literal committed.
- The worker deploy validates `madara.blitz`, CORS-restricts to the lab origins, and dispatches on the right ref.
- The worker-cron rotation is idempotent and creates a genuinely joinable window (`start_main_at` well ahead).
- Preset ids sent by the UI are registered on the lab (§D consistency).
